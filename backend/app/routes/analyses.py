from datetime import timedelta
from pathlib import PurePosixPath

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import quota
from app.auth import current_user
from app.config import settings
from app.db import get_db
from app.errors import ApiError
from app.models import Analysis, AnalysisStatus, Stage, User
from app.storage import Storage, get_storage

router = APIRouter()
UPLOAD_TTL_S = 900
CONTENT_TYPES = {".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm", ".avi": "video/x-msvideo"}


class AnalysisIn(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    size: int = Field(ge=1)
    content_type: str = Field(default="", max_length=100)  # 참고용. 실제 값은 확장자로 정한다.
    consent: bool


def delete_analysis_files(storage: Storage, analysis_id: int) -> None:
    """분석 하나의 모든 파일(원본, 재생본, 오버레이)을 지운다. DELETE /me와 공용이다."""
    storage.delete_prefix(f"analyses/{analysis_id}/")


def _mine(db: Session, user: User, analysis_id: int, lock: bool = False) -> Analysis:
    q = select(Analysis).where(Analysis.id == analysis_id, Analysis.user_id == user.id)
    a = db.scalar(q.with_for_update() if lock else q)
    if not a:
        raise ApiError(404, "ANALYSIS_NOT_FOUND", "분석을 찾을 수 없습니다.")
    return a


def _progress(a: Analysis) -> list[dict]:
    # progress는 {단계: {status, detail, at}} 형태로 가정한다. 단계 순서대로 내보낸다.
    p = a.progress or {}
    return [{"stage": s.value, "status": p[s.value].get("status", "done"),
             "detail": p[s.value].get("detail"), "at": p[s.value].get("at")} for s in Stage if s.value in p]


def _out(a: Analysis, storage: Storage) -> dict:
    done = a.status == AnalysisStatus.done
    return {
        "id": a.id, "status": a.status.value, "stage": a.stage.value if a.stage else None,
        "progress": _progress(a),
        "report": a.report if done else None,  # ponytail: Task 10에서 타입 있는 Report로 교체
        "playback_url": storage.presign_get(a.playback_key) if done and a.playback_key else None,
        "overlay_url": storage.presign_get(f"analyses/{a.id}/overlay.json") if done else None,
        "error": ({"code": a.error_code or "ANALYSIS_FAILED", "message": "분석에 실패했습니다. 영상을 다시 올려 주세요."}
                  if a.status == AnalysisStatus.failed else None),
        "created_at": a.created_at,
    }


@router.post("/analyses", status_code=201)
def create_analysis(body: AnalysisIn, user: User = Depends(current_user), db: Session = Depends(get_db),
                    storage: Storage = Depends(get_storage)):
    if not body.consent:
        raise ApiError(400, "CONSENT_REQUIRED", "영상 분석에 동의해야 업로드할 수 있습니다.")
    ext = PurePosixPath(body.filename).suffix.lower()
    if ext not in CONTENT_TYPES:
        raise ApiError(400, "UNSUPPORTED_VIDEO", "mp4, mov, webm, avi 영상만 올릴 수 있습니다.")
    if body.size > settings.max_video_bytes:
        raise ApiError(400, "VIDEO_TOO_LARGE", f"영상은 {settings.max_video_bytes // 1024 // 1024}MB 이하여야 합니다.")
    try:
        quota.reserve_analysis(db, user)
        now = quota._now()
        a = Analysis(user_id=user.id, created_at=now, consent_at=now, source_size=body.size)
        db.add(a)
        db.flush()
        a.source_key = f"analyses/{a.id}/source{ext}"
        db.commit()  # 한도 확인과 행 생성을 한 트랜잭션으로 묶고 잠금을 푼다.
    except Exception:
        db.rollback()
        raise
    headers = {"Content-Type": CONTENT_TYPES[ext]}
    return {"id": a.id, "upload_url": storage.presign_put(a.source_key, headers["Content-Type"], UPLOAD_TTL_S),
            "upload_headers": headers, "expires_at": now + timedelta(seconds=UPLOAD_TTL_S)}


@router.post("/analyses/{analysis_id}/submit")
def submit_analysis(analysis_id: int, user: User = Depends(current_user), db: Session = Depends(get_db),
                    storage: Storage = Depends(get_storage)):
    a = _mine(db, user, analysis_id, lock=True)
    if a.status == AnalysisStatus.created:
        if storage.head(a.source_key) != a.source_size:
            db.rollback()
            raise ApiError(409, "UPLOAD_INCOMPLETE", "영상 업로드가 끝나지 않았습니다. 다시 올려 주세요.")
        a.status = AnalysisStatus.queued
        db.commit()
    else:
        db.rollback()  # 이미 제출됨: 그대로 현재 상태를 돌려준다.
    return _out(a, storage)


@router.get("/analyses")
def list_analyses(limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0),
                  user: User = Depends(current_user), db: Session = Depends(get_db),
                  storage: Storage = Depends(get_storage)):
    mine = Analysis.user_id == user.id
    rows = db.scalars(select(Analysis).where(mine).order_by(Analysis.id.desc()).limit(limit).offset(offset))
    return {"items": [_out(a, storage) for a in rows],
            "total": db.scalar(select(func.count()).where(mine).select_from(Analysis))}


@router.get("/analyses/{analysis_id}")
def get_analysis(analysis_id: int, user: User = Depends(current_user), db: Session = Depends(get_db),
                 storage: Storage = Depends(get_storage)):
    return _out(_mine(db, user, analysis_id), storage)


@router.delete("/analyses/{analysis_id}", status_code=204)
def delete_analysis(analysis_id: int, user: User = Depends(current_user), db: Session = Depends(get_db),
                    storage: Storage = Depends(get_storage)):
    a = _mine(db, user, analysis_id)
    delete_analysis_files(storage, a.id)
    db.delete(a)
    db.commit()
    return Response(status_code=204)

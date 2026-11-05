import json
import logging
import signal
import tempfile
import time
from collections.abc import Callable
from datetime import datetime, timedelta
from pathlib import Path, PurePosixPath

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import quota
from app.db import SessionLocal
from app.models import Analysis, AnalysisStatus, Stage
from app.pipeline.run import PIPELINE_VERSION, Context, PipelineError, PipelineResult, run_pipeline
from app.storage import Storage

log = logging.getLogger("worker")
STALE_AFTER = timedelta(minutes=10)
MAX_ATTEMPTS = 2
INTERNAL_MESSAGE = "분석 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요."


def _live(db: Session, analysis_id: int) -> Analysis | None:
    """행을 잠가 가져온다. 삭제됐거나 없으면 None."""
    a = db.scalar(select(Analysis).where(Analysis.id == analysis_id, Analysis.deleted_at.is_(None))
                  .with_for_update())
    if not a:
        db.rollback()
    return a


def claim_next(db: Session) -> Analysis | None:
    a = db.scalar(select(Analysis).where(Analysis.status == AnalysisStatus.queued, Analysis.deleted_at.is_(None))
                  .order_by(Analysis.id).limit(1).with_for_update(skip_locked=True))
    if not a:
        db.rollback()
        return None
    now = quota._now()
    a.status, a.attempts, a.started_at, a.heartbeat_at = AnalysisStatus.processing, a.attempts + 1, now, now
    db.commit()
    return a


def requeue_stale(db: Session, now: datetime) -> int:
    rows = db.scalars(select(Analysis).where(
        Analysis.status == AnalysisStatus.processing, Analysis.deleted_at.is_(None),
        Analysis.heartbeat_at < now - STALE_AFTER).with_for_update(skip_locked=True)).all()
    for a in rows:
        if a.attempts < MAX_ATTEMPTS:
            a.status = AnalysisStatus.queued
        else:
            a.status, a.error_code, a.finished_at = AnalysisStatus.failed, "WORKER_TIMEOUT", now
            a.progress = {**(a.progress or {}), "error": {"message": "분석 시간이 너무 오래 걸렸습니다. 다시 올려 주세요."}}
    db.commit()
    return len(rows)


def set_stage(db: Session, analysis_id: int, stage: str, detail: dict | None, status: str = "done") -> None:
    a = _live(db, analysis_id)
    if not a:
        return
    now = quota._now()
    a.progress = {**(a.progress or {}), stage: {"status": status, "detail": detail, "at": now.isoformat()}}
    a.stage, a.heartbeat_at = Stage(stage), now
    db.commit()


def _fail(db: Session, analysis_id: int, code: str, message: str) -> None:
    a = _live(db, analysis_id)
    if not a:
        return
    a.status, a.error_code, a.finished_at = AnalysisStatus.failed, code, quota._now()
    # 사용자 메시지는 progress["error"]에 둔다. API의 단계 목록은 Stage 키만 읽으므로 섞이지 않는다.
    a.progress = {**(a.progress or {}), "error": {"message": message}}
    db.commit()


def _finish(db: Session, storage: Storage, aid: int, res: PipelineResult, workdir: Path) -> None:
    prefix = f"analyses/{aid}"
    overlay = workdir / "overlay.json"
    overlay.write_text(json.dumps(res.overlay, ensure_ascii=False))
    storage.upload(res.playback_path, f"{prefix}/playback.mp4", "video/mp4")
    storage.upload(overlay, f"{prefix}/overlay.json", "application/json")
    a = _live(db, aid)
    if not a:  # 처리 중 삭제됨: 방금 올린 파일을 지우고 결과는 쓰지 않는다.
        storage.delete_analysis_files(aid)
        return
    a.playback_key, a.report, a.trace = f"{prefix}/playback.mp4", res.report.model_dump(mode="json"), res.trace
    a.pipeline_version, a.status, a.finished_at = PIPELINE_VERSION, AnalysisStatus.done, quota._now()
    db.commit()


def process(db: Session, a: Analysis, storage: Storage, pipeline: Callable = run_pipeline,
            llm=None, table=None) -> None:
    aid = a.id
    try:
        # 서명 URL은 재사용될 수 있어 claim 뒤에 크기를 다시 확인한다.
        if storage.head(a.source_key) != a.source_size:
            return _fail(db, aid, "UPLOAD_CHANGED", "업로드한 영상이 바뀌었습니다. 다시 올려 주세요.")
        with tempfile.TemporaryDirectory() as tmp:
            workdir = Path(tmp)
            storage.download(a.source_key, workdir / f"source{PurePosixPath(a.source_key).suffix}")
            ctx = Context(aid, workdir, storage, llm, table,
                          lambda stage, detail=None, status="done": set_stage(db, aid, stage, detail, status))
            _finish(db, storage, aid, pipeline(ctx), workdir)
    except PipelineError as e:
        db.rollback()
        _fail(db, aid, e.code, e.message)
    except Exception:
        log.exception("분석 %s 처리 실패", aid)
        db.rollback()
        _fail(db, aid, "INTERNAL_ERROR", INTERNAL_MESSAGE)


def main() -> None:
    stop = False

    def _stop(*_):
        nonlocal stop
        stop = True

    signal.signal(signal.SIGTERM, _stop)
    signal.signal(signal.SIGINT, _stop)
    storage, last_sweep = Storage.from_settings(), 0.0
    while not stop:
        with SessionLocal() as db:
            if time.monotonic() - last_sweep >= 60:
                requeue_stale(db, quota._now())
                last_sweep = time.monotonic()
            a = claim_next(db)
            if a:
                process(db, a, storage)
                continue
        time.sleep(2)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()

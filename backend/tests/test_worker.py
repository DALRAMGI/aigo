from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from pydantic import BaseModel

from app import worker
from app.models import Analysis, AnalysisStatus
from app.pipeline.run import PipelineError, PipelineResult

NOW = datetime(2026, 11, 5, 12, 0, tzinfo=timezone.utc)


class Rep(BaseModel):
    verdict: str = "ok"


def mk(db, user, status=AnalysisStatus.queued, **kw):
    a = Analysis(user_id=user.id, status=status, source_size=3, **kw)
    db.add(a)
    db.flush()
    a.source_key = f"analyses/{a.id}/source.mp4"
    db.flush()
    return a


def put_source(storage, a, data=b"abc"):
    storage.s3.put_object(Bucket=storage.bucket, Key=a.source_key, Body=data)


def ok_pipeline(ctx):
    ctx.on_stage("scan", {"n": 1})
    p = ctx.workdir / "out.mp4"
    p.write_bytes(b"mp4")
    return PipelineResult(report=Rep(), trace={"t": 1}, playback_path=p, overlay={"boxes": []})


def raising(exc):
    def f(ctx):
        raise exc
    return f


def test_two_workers_claim_different_jobs(db, user):
    a, b = mk(db, user), mk(db, user)
    x, y = worker.claim_next(db), worker.claim_next(db)
    assert {x.id, y.id} == {a.id, b.id}
    assert x.status == AnalysisStatus.processing and x.attempts == 1 and x.heartbeat_at
    assert worker.claim_next(db) is None


def test_claim_skips_deleted(db, user):
    mk(db, user, deleted_at=NOW)
    assert worker.claim_next(db) is None


def test_stale_job_requeued_once(db, user):
    a = mk(db, user, status=AnalysisStatus.processing, attempts=1, heartbeat_at=NOW - timedelta(minutes=11))
    fresh = mk(db, user, status=AnalysisStatus.processing, attempts=1, heartbeat_at=NOW - timedelta(minutes=5))
    assert worker.requeue_stale(db, NOW) == 1
    assert a.status == AnalysisStatus.queued and fresh.status == AnalysisStatus.processing


def test_stale_job_fails_second_time(db, user):
    a = mk(db, user, status=AnalysisStatus.processing, attempts=2, heartbeat_at=NOW - timedelta(minutes=11))
    worker.requeue_stale(db, NOW)
    assert a.status == AnalysisStatus.failed and a.error_code and a.finished_at


def test_stale_ignores_deleted(db, user):
    a = mk(db, user, status=AnalysisStatus.processing, attempts=1, deleted_at=NOW,
           heartbeat_at=NOW - timedelta(minutes=11))
    assert worker.requeue_stale(db, NOW) == 0 and a.status == AnalysisStatus.processing


def test_set_stage_records_progress(db, user):
    a = mk(db, user)
    worker.set_stage(db, a.id, "scan", {"n": 2})
    assert a.progress["scan"]["status"] == "done" and a.progress["scan"]["detail"] == {"n": 2}
    assert a.stage.value == "scan" and a.progress["scan"]["at"]


def test_pipeline_error_saves_user_message(db, user, storage):
    a = mk(db, user); put_source(storage, a); a = worker.claim_next(db)
    worker.process(db, a, storage, raising(PipelineError("NO_VIDEO", "차량 영상이 아닙니다.")))
    assert a.status == AnalysisStatus.failed and a.error_code == "NO_VIDEO"
    assert a.progress["error"]["message"] == "차량 영상이 아닙니다."


def test_unexpected_error_hides_detail(db, user, storage, caplog):
    a = mk(db, user); put_source(storage, a); a = worker.claim_next(db)
    worker.process(db, a, storage, raising(RuntimeError("secret-db-password")))
    assert a.error_code == "INTERNAL_ERROR" and "secret" not in str(a.progress)
    assert "secret-db-password" in caplog.text


def test_upload_changed_fails(db, user, storage):
    a = mk(db, user); put_source(storage, a, b"abcdef"); a = worker.claim_next(db)
    worker.process(db, a, storage, ok_pipeline)
    assert a.status == AnalysisStatus.failed and a.error_code == "UPLOAD_CHANGED"


def test_deleted_during_processing_is_not_recreated(db, user, storage):
    a = mk(db, user); put_source(storage, a); a = worker.claim_next(db)

    def pipeline(ctx):
        r = ok_pipeline(ctx)
        a.erase(NOW)  # 처리 중 사용자가 삭제
        db.commit()
        return r

    worker.process(db, a, storage, pipeline)
    assert a.deleted_at and a.report is None and a.status == AnalysisStatus.processing
    keys = storage.s3.list_objects_v2(Bucket=storage.bucket, Prefix=f"analyses/{a.id}/").get("KeyCount")
    assert keys == 0


def test_success_uploads_outputs_and_saves_report(db, user, storage):
    a = mk(db, user); put_source(storage, a); a = worker.claim_next(db)
    worker.process(db, a, storage, ok_pipeline)
    assert a.status == AnalysisStatus.done and a.report == {"verdict": "ok"} and a.trace == {"t": 1}
    assert a.playback_key == f"analyses/{a.id}/playback.mp4" and a.finished_at and a.pipeline_version
    assert storage.head(a.playback_key) == 3 and storage.head(f"analyses/{a.id}/overlay.json")

import threading

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.auth import get_clerk
from app.db import SessionLocal, get_db
from app.main import create_app
from app.models import Analysis, Order, OrderStatus, User
from app.storage import get_storage
from tests.conftest import _OTHER_KEY, issue_token


@pytest.fixture
def client(db, storage, fake_clerk):
    app = create_app()
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_clerk] = lambda: fake_clerk
    app.dependency_overrides[get_storage] = lambda: storage
    return TestClient(app)


def auth(sub="user_a", **kw):
    return {"Authorization": f"Bearer {issue_token(sub, f'{sub}@example.com', **kw)}"}


def assert_401(r):
    assert r.status_code == 401
    assert r.json()["code"] == "UNAUTHORIZED" and r.json()["message"]


def test_missing_token_401(client):
    assert_401(client.get("/api/v1/me"))


def test_expired_token_401(client):
    assert_401(client.get("/api/v1/me", headers=auth(expired=True)))


def test_wrong_key_401(client):
    assert_401(client.get("/api/v1/me", headers=auth(key=_OTHER_KEY)))


def test_wrong_origin_401(client):
    assert_401(client.get("/api/v1/me", headers=auth(azp="https://evil.example")))


def test_garbage_token_401(client):
    assert_401(client.get("/api/v1/me", headers={"Authorization": "Bearer nope"}))


def test_first_request_creates_user(client, db, fake_clerk):
    r = client.get("/api/v1/me", headers=auth("user_a"))
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == "user_a@example.com" and body["name"] == "홍 길동"
    row = db.scalar(select(User).where(User.clerk_user_id == "user_a"))
    assert row and body["id"] == row.id
    # 두 번째 요청은 Clerk을 다시 부르지 않는다.
    client.get("/api/v1/me", headers=auth("user_a"))
    assert fake_clerk.get_calls == ["user_a"]


def test_clerk_fetch_failure_503_creates_no_row(client, db, fake_clerk):
    fake_clerk.fail_get = True
    r = client.get("/api/v1/me", headers=auth("user_b"))
    assert r.status_code == 503 and r.json()["code"] == "AUTH_PROVIDER_UNAVAILABLE"
    assert db.scalar(select(func.count()).select_from(User).where(User.clerk_user_id == "user_b")) == 0


def test_concurrent_first_requests_create_one_user(fake_clerk):
    # 요청마다 별개 세션이 필요하므로 롤백용 db 대신 실제 커밋을 하고 직접 정리한다.
    barrier = threading.Barrier(2, timeout=5)
    fake_clerk.on_get = barrier.wait  # 둘 다 "없음"을 본 뒤에 INSERT하게 만든다.
    app = create_app()
    app.dependency_overrides[get_clerk] = lambda: fake_clerk
    c = TestClient(app)
    sub = "user_race"
    results = []
    try:
        ts = [threading.Thread(target=lambda: results.append(c.get("/api/v1/me", headers=auth(sub)))) for _ in range(2)]
        [t.start() for t in ts]
        [t.join() for t in ts]
        assert [r.status_code for r in results] == [200, 200]
        assert results[0].json()["id"] == results[1].json()["id"]
        with SessionLocal() as s:
            assert s.scalar(select(func.count()).select_from(User).where(User.clerk_user_id == sub)) == 1
    finally:
        with SessionLocal() as s:
            s.execute(User.__table__.delete().where(User.clerk_user_id == sub))
            s.commit()


def _analysis(db, user, source, playback):
    a = Analysis(user_id=user.id, source_key=source, playback_key=playback)
    db.add(a)
    db.flush()
    return a


def test_delete_me_removes_analyses_files_and_clerk_user(client, db, storage, fake_clerk, user):
    other = User(clerk_user_id="user_other")
    db.add(other)
    db.flush()
    _analysis(db, user, "u/1/source.mp4", "u/1/play.mp4")
    _analysis(db, user, "u/2/source.mp4", None)
    _analysis(db, other, "u/3/source.mp4", None)
    for k in ("u/1/source.mp4", "u/1/play.mp4", "u/2/source.mp4", "u/3/source.mp4"):
        storage.s3.put_object(Bucket=storage.bucket, Key=k, Body=b"x")

    r = client.delete("/api/v1/me", headers=auth(user.clerk_user_id))
    assert r.status_code == 204
    assert [storage.head(k) for k in ("u/1/source.mp4", "u/1/play.mp4", "u/2/source.mp4")] == [None] * 3
    assert storage.head("u/3/source.mp4") == 1  # 다른 사용자 파일은 그대로
    assert db.scalar(select(func.count()).select_from(User).where(User.id == user.id)) == 0
    assert db.scalar(select(func.count()).select_from(Analysis).where(Analysis.user_id == user.id)) == 0
    assert db.scalar(select(func.count()).select_from(Analysis).where(Analysis.user_id == other.id)) == 1
    assert fake_clerk.deleted == [user.clerk_user_id]


def test_delete_me_keeps_order_without_user(client, db, user, product):
    o = Order(toss_order_id="t1", idempotency_key="k1", user_id=user.id, product_id=product.id,
              product_name="n", unit_price=1, quantity=1, amount=1, status=OrderStatus.paid,
              recipient_name="r", phone="p", address="a")
    db.add(o)
    db.flush()
    assert client.delete("/api/v1/me", headers=auth(user.clerk_user_id)).status_code == 204
    db.expire_all()
    kept = db.get(Order, o.id)
    assert kept is not None and kept.user_id is None


def test_delete_me_clerk_failure_503(client, fake_clerk, user):
    fake_clerk.fail_delete = True
    r = client.delete("/api/v1/me", headers=auth(user.clerk_user_id))
    assert r.status_code == 503 and r.json()["code"] == "AUTH_PROVIDER_UNAVAILABLE"

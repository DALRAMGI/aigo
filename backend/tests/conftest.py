import os

# 실제 키 없이 실행되도록 app import 전에 테스트 설정을 넣는다.
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg:///dashpi_test")
os.environ.setdefault("TOSS_SECRET_KEY", "test_sk_dummy")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.errors import ApiError  # noqa: E402
from app.main import create_app  # noqa: E402


@pytest.fixture
def client():
    return TestClient(create_app())


@pytest.fixture
def client_with_error_route():
    app = create_app()

    @app.get("/api/v1/_test/error")
    def _raise():
        raise ApiError(404, "NOT_FOUND", "찾을 수 없습니다.")

    return TestClient(app)


@pytest.fixture
def client_with_int_route():
    app = create_app()

    @app.get("/api/v1/_test/items")
    def _items(limit: int = 10):
        return {"limit": limit}

    return TestClient(app)


@pytest.fixture(scope="session")
def _migrated():
    # 마이그레이션 자체도 테스트 DB에 적용해 검증한다.
    from alembic import command
    from alembic.config import Config

    command.upgrade(Config("alembic.ini"), "head")


@pytest.fixture
def db(_migrated):
    """테스트마다 바깥 트랜잭션을 열고 끝에 롤백한다. commit()은 savepoint만 해제한다."""
    from sqlalchemy.orm import Session

    from app.db import engine

    with engine.connect() as conn:
        outer = conn.begin()
        session = Session(conn, join_transaction_mode="create_savepoint", expire_on_commit=False)
        try:
            yield session
        finally:
            session.close()
            outer.rollback()


@pytest.fixture
def user(db):
    from app.models import User

    u = User(clerk_user_id="user_test_1", email="a@example.com", name="테스터")
    db.add(u)
    db.flush()
    return u


@pytest.fixture
def product(db):
    from app.models import Product

    p = Product(slug="t-1", name="테스트 상품", description="설명", price=100000,
                specs={"k": "v"}, image_url="", active=True)
    db.add(p)
    db.flush()
    return p


@pytest.fixture
def storage():
    import boto3
    from moto import mock_aws

    from app.storage import Storage

    with mock_aws():
        boto3.client("s3", region_name="us-east-1").create_bucket(Bucket="test-bucket")
        yield Storage(bucket="test-bucket", region="us-east-1", endpoint_url=None,
                      access_key_id="testing", secret_access_key="testing")

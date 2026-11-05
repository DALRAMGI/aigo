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

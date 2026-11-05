import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.auth import get_clerk
from app.db import get_db
from app.main import create_app
from app.models import Order, OrderStatus, Product
from tests.conftest import issue_token


class FakeToss:
    def __init__(self):
        self.calls: list[tuple] = []
        self.error = None  # TossError를 넣으면 다음 호출이 실패한다

    def confirm(self, payment_key, order_id, amount, idempotency_key):
        self.calls.append((payment_key, order_id, amount, idempotency_key))
        if self.error:
            raise self.error
        return {"status": "DONE"}


@pytest.fixture
def fake_toss():
    return FakeToss()


@pytest.fixture
def client(db, fake_clerk, fake_toss):
    from app.toss import get_toss

    app = create_app()
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_clerk] = lambda: fake_clerk
    app.dependency_overrides[get_toss] = lambda: fake_toss
    return TestClient(app)


def auth(sub="user_a"):
    return {"Authorization": f"Bearer {issue_token(sub, f'{sub}@example.com')}"}


@pytest.fixture
def other_auth():
    return auth("user_b")


BODY = {"recipient_name": "홍길동", "phone": "010-0000-0000", "address": "경기 안산", "address_detail": "101호"}


def place(client, slug="t-1", quantity=1, headers=None):
    return client.post("/api/v1/orders", json={**BODY, "product_slug": slug, "quantity": quantity},
                       headers=headers or auth())


@pytest.fixture
def order(client, product):
    return place(client, quantity=2).json()


def confirm(client, order, amount=None, key="pk_1", headers=None):
    return client.post(f"/api/v1/orders/{order['id']}/confirm",
                       json={"payment_key": key, "amount": order["amount"] if amount is None else amount},
                       headers=headers or auth())


def test_products_list_active_only_without_auth(client, product, db):
    db.add(Product(slug="off", name="x", price=1, active=False))
    db.flush()
    r = client.get("/api/v1/products?limit=100")
    assert r.status_code == 200 and r.json()["total"] == 1
    assert [p["slug"] for p in r.json()["items"]] == ["t-1"]
    assert client.get("/api/v1/products/t-1").json()["price"] == 100000
    assert client.get("/api/v1/products/off").json()["code"] == "PRODUCT_NOT_FOUND"


def test_create_order_uses_db_price(client, product):
    # 클라이언트가 amount를 보내도 무시된다.
    r = client.post("/api/v1/orders", headers=auth(),
                    json={**BODY, "product_slug": "t-1", "quantity": 2, "amount": 1})
    assert r.status_code == 201
    b = r.json()
    assert b["amount"] == 200000 and b["status"] == "pending"
    assert b["order_name"] == "테스트 상품 2개" and b["toss_order_id"].startswith("dashpi_")
    assert place(client).json()["order_name"] == "테스트 상품"


@pytest.mark.parametrize("q", [0, 6, -1])
def test_quantity_must_be_1_to_5(client, product, q):
    assert place(client, quantity=q).status_code == 422


def test_inactive_product_rejected(client, product, db):
    product.active = False
    db.flush()
    r = place(client)
    assert r.status_code == 404 and r.json()["code"] == "PRODUCT_NOT_FOUND"
    assert place(client, slug="nope").json()["code"] == "PRODUCT_NOT_FOUND"


def test_confirm_amount_mismatch_409(client, order, fake_toss):
    r = confirm(client, order, amount=1)
    assert r.status_code == 409 and r.json()["code"] == "ORDER_AMOUNT_MISMATCH"
    assert fake_toss.calls == []


def test_confirm_success_marks_paid(client, order, fake_toss, db):
    r = confirm(client, order)
    assert r.status_code == 200 and r.json()["status"] == "paid"
    o = db.get(Order, order["id"])
    assert o.status == OrderStatus.paid and o.payment_key == "pk_1" and o.paid_at
    assert fake_toss.calls[0][1:3] == (order["toss_order_id"], 200000)


def test_confirm_twice_calls_toss_once(client, order, fake_toss):
    assert confirm(client, order).status_code == 200
    assert confirm(client, order).json()["status"] == "paid"
    assert len(fake_toss.calls) == 1


def test_paid_order_with_different_key_or_amount_409(client, order, fake_toss):
    confirm(client, order)
    assert confirm(client, order, key="pk_other").status_code == 409
    assert confirm(client, order, amount=1).status_code == 409
    assert len(fake_toss.calls) == 1


def test_toss_network_error_keeps_pending_and_retry_reuses_key(client, order, fake_toss, db):
    from app.toss import TossError

    fake_toss.error = TossError("NETWORK_ERROR", "down", True)
    r = confirm(client, order)
    assert r.status_code == 502 and r.json()["code"] == "PAYMENT_RETRY"
    assert db.get(Order, order["id"]).status == OrderStatus.pending
    fake_toss.error = None
    assert confirm(client, order).status_code == 200
    assert fake_toss.calls[0][3] == fake_toss.calls[1][3]


def test_toss_rejection_marks_failed_with_message(client, order, fake_toss, db):
    from app.toss import TossError

    fake_toss.error = TossError("REJECT_CARD_COMPANY", "카드사가 거절했습니다.", False)
    r = confirm(client, order)
    assert r.status_code == 402 and r.json() == {"code": "PAYMENT_REJECTED", "message": "카드사가 거절했습니다."}
    assert db.get(Order, order["id"]).status == OrderStatus.failed
    fake_toss.error = None
    again = confirm(client, order)
    assert again.status_code == 409 and again.json()["code"] == "ORDER_NOT_PAYABLE"
    assert len(fake_toss.calls) == 1


def test_other_users_order_404(client, order, other_auth, fake_toss):
    assert client.get(f"/api/v1/orders/{order['id']}", headers=other_auth).status_code == 404
    assert confirm(client, order, headers=other_auth).status_code == 404
    assert client.get("/api/v1/orders", headers=other_auth).json() == {"items": [], "total": 0}
    assert fake_toss.calls == []


def test_list_and_get_orders(client, order, product):
    place(client)
    r = client.get("/api/v1/orders?limit=1", headers=auth())
    assert r.json()["total"] == 2 and len(r.json()["items"]) == 1
    assert client.get(f"/api/v1/orders/{order['id']}", headers=auth()).json()["address"] == "경기 안산 101호"
    assert client.get("/api/v1/orders/999999", headers=auth()).status_code == 404
    assert client.get("/api/v1/orders?limit=101", headers=auth()).status_code == 422
    assert client.get("/api/v1/orders").status_code == 401

import base64

import httpx

from app.config import settings

CONFIRM_URL = "https://api.tosspayments.com/v1/payments/confirm"


class TossError(Exception):
    def __init__(self, code: str, message: str, retryable: bool):
        super().__init__(message)
        self.code, self.message, self.retryable = code, message, retryable


class TossClient:
    def confirm(self, payment_key: str, order_id: str, amount: int, idempotency_key: str) -> dict:
        auth = base64.b64encode(f"{settings.toss_secret_key}:".encode()).decode()
        try:
            r = httpx.post(
                CONFIRM_URL,
                json={"paymentKey": payment_key, "orderId": order_id, "amount": amount},
                headers={"Authorization": f"Basic {auth}", "Idempotency-Key": idempotency_key},
                timeout=30,
            )
        except httpx.HTTPError as e:
            raise TossError("NETWORK_ERROR", "토스 서버에 연결할 수 없습니다.", True) from e
        if r.is_success:
            return r.json()
        try:
            body = r.json()
        except ValueError:
            body = {}
        # 5xx와 키 오류(401/403)는 사용자의 결제 실패가 아니므로 다시 시도할 수 있게 둔다.
        retryable = r.status_code >= 500 or r.status_code in (401, 403)
        raise TossError(body.get("code", "UNKNOWN"), body.get("message", "결제가 거절되었습니다."), retryable)


def get_toss() -> TossClient:
    """FastAPI 의존성. 테스트에서는 dependency_overrides로 바꾼다."""
    return TossClient()

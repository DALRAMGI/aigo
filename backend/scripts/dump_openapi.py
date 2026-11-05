"""FastAPI 스키마를 frontend/openapi.json으로 쓴다.

backend/.env를 읽지 않도록 frontend에서 실행한다.
  cd frontend && TOSS_SECRET_KEY=test_x DATABASE_URL=postgresql:///dashpi_test \
    uv run --project ../backend python ../backend/scripts/dump_openapi.py
"""

import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.main import create_app  # noqa: E402

out = BACKEND.parent / "frontend" / "openapi.json"
out.write_text(json.dumps(create_app().openapi(), ensure_ascii=False, indent=2) + "\n")

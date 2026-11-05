import base64
import logging
import time
from collections.abc import Callable
from functools import cached_property
from pathlib import Path
from typing import Any, TypeVar

import cv2
from openai import OpenAI, OpenAIError
from pydantic import BaseModel, ValidationError

from app.config import settings
from app.errors import PipelineError

log = logging.getLogger("llm")
T = TypeVar("T", bound=BaseModel)

PROMPT_VERSION = "2026-11-05.1"  # 프롬프트를 바꾸면 올리고 평가 세트를 다시 돌린다.
JPEG_QUALITY = 85
LONG_EDGE = 1280
REQUEST_TIMEOUT_S = 180


class InvalidOutput(ValueError):
    """모델 응답이 스키마나 코드 검증을 통과하지 못했다. 메시지는 재요청에 그대로 쓴다."""


def image_part(path: Path) -> dict:
    img = cv2.imread(str(path))
    scale = LONG_EDGE / max(img.shape[:2])
    if scale < 1:
        img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    jpeg = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])[1].tobytes()
    return {"type": "input_image", "detail": "high",
            "image_url": "data:image/jpeg;base64," + base64.b64encode(jpeg).decode()}


class LLM:
    """분석 하나에 하나씩 만든다. calls에 쌓인 호출 기록이 trace로 간다."""

    def __init__(self, client: OpenAI | None = None):
        self._given = client
        self.calls: list[dict] = []

    @cached_property
    def client(self) -> OpenAI:  # 키가 없어도 worker와 테스트가 뜨도록 첫 호출 때 만든다.
        return self._given or OpenAI(api_key=settings.openai_api_key, timeout=REQUEST_TIMEOUT_S)

    def parse_structured(self, messages: list[dict], schema: type[T], *, repair: str | None = None) -> T:
        if repair:
            messages = [*messages, {"role": "user", "content": f"직전 응답이 검증에 실패했다: {repair}\n고쳐서 다시 답하라."}]
        started = time.perf_counter()
        try:
            r = self.client.responses.parse(
                model=settings.openai_model, input=messages, text_format=schema,
                reasoning={"effort": settings.openai_reasoning_effort},
                store=False)  # 번호판과 얼굴이 담긴 프레임을 OpenAI 쪽에 남기지 않는다.
        except ValidationError as e:
            raise InvalidOutput(f"응답이 스키마와 다르다: {e.error_count()}개 오류") from e
        except OpenAIError as e:
            log.exception("모델 호출 실패")
            raise PipelineError("MODEL_FAILED", "AI 분석 호출에 실패했습니다. 잠시 후 다시 시도해 주세요.") from e
        u = r.usage
        self.calls.append({"schema": schema.__name__, "seconds": round(time.perf_counter() - started, 2),
                           "input_tokens": u.input_tokens if u else 0, "output_tokens": u.output_tokens if u else 0,
                           "reasoning_tokens": u.output_tokens_details.reasoning_tokens if u else 0})
        if r.output_parsed is None:
            raise InvalidOutput("응답이 비었거나 거절됐다")
        return r.output_parsed


def ask(llm: Any, messages: list[dict], schema: type[T], check: Callable[[T], None] = lambda _: None) -> T:
    """스키마나 코드 검증에 실패하면 오류를 알려 주고 한 번만 다시 묻는다."""
    repair = None
    for _ in range(2):
        try:
            out = llm.parse_structured(messages, schema, repair=repair)
            check(out)
            return out
        except InvalidOutput as e:
            repair = str(e)
    raise PipelineError("MODEL_INVALID", "AI 분석 결과를 확인하지 못했습니다. 영상을 다시 올려 주세요.")

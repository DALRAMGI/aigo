from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from app.storage import Storage

PIPELINE_VERSION = "0"  # Task 10에서 실제 파이프라인과 함께 올린다.


class PipelineError(Exception):
    """사용자에게 보여 줄 메시지가 있는 분석 실패."""

    def __init__(self, code: str, message: str):
        super().__init__(f"{code}: {message}")
        self.code, self.message = code, message


@dataclass
class Context:
    analysis_id: int
    workdir: Path  # 원본 영상은 workdir/source.<확장자>
    storage: Storage
    llm: Any
    table: Any
    on_stage: Callable[..., None]  # (stage, detail=None, status="done")


@dataclass
class PipelineResult:
    report: BaseModel  # ponytail: Task 10에서 Report로 교체
    trace: dict
    playback_path: Path
    overlay: dict


def run_pipeline(ctx: Context) -> PipelineResult:
    raise NotImplementedError("Task 10에서 구현")

"""관찰이 접촉을 못 봤을 때 센서 신호로 촬영 차의 충돌을 추정한다."""
from dataclasses import dataclass

from app.pipeline.locate import ALIGN_S, Candidate
from app.report import Evidence

STRONG = {"motion": 0.6, "audio": 0.6, "decel": 0.6}  # 초기값, Task 7에서 조정
SENSOR_TEXT = {"audio": "충돌음이 크게 남", "motion": "화면이 크게 흔들림", "decel": "앞차가 급정지함"}


@dataclass
class Estimate:
    t: float
    facts: list[Evidence]


def _strong(c: Candidate) -> dict[str, float] | None:
    """강하게 잡히고 시각이 ALIGN_S 안에 모인 신호. 흔들림(촬영 차 충격)이 반드시 있어야 한다."""
    hits = {k: c.peaks[k] for k, v in STRONG.items() if c.signals.get(k, 0.0) >= v and c.peaks.get(k) is not None}
    if "motion" not in hits or len(hits) < 2 or round(max(hits.values()) - min(hits.values()), 6) > ALIGN_S:
        return None
    return hits


def estimate_collision(candidates: list[Candidate]) -> Estimate | None:
    scored = [(sum(c.signals[k] for k in hits), hits) for c in candidates if (hits := _strong(c))]
    if not scored:
        return None
    hits = max(scored, key=lambda s: s[0])[1]
    # 흔들림과 소리는 접촉 뒤에 온다. 가장 이른 신호 시각을 충돌 시각으로 둔다.
    facts = sorted((Evidence(t=t, text=SENSOR_TEXT[k]) for k, t in hits.items()), key=lambda e: e.t)
    return Estimate(t=facts[0].t, facts=facts)

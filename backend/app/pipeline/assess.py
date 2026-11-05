import json
from typing import Literal

from pydantic import BaseModel

from app.fault import Chart, FaultTable, calculate
from app.llm import InvalidOutput, ask
from app.pipeline.focus import Keyframe
from app.pipeline.observe import NEAR_FRAME_S, Fact, Observation, near_frame
from app.report import Evidence, FaultAssessment, FaultStep, Report, SeriousViolation, confidence

NO_ACCIDENT = "영상에서 사고를 확인하지 못했습니다."
NO_EVIDENCE = "영상에서 근거 시각이 있는 사실을 확인하지 못했습니다."
NO_CHART = "기준 도표를 찾지 못했습니다."
NO_COLLISION = "충돌 순간을 확인하지 못해 과실비율을 내지 않았습니다."
SeriousItem = Literal[
    "신호위반", "중앙선 침범", "제한속도 20km/h 초과", "앞지르기·끼어들기 위반", "철길건널목 통과 위반", "횡단보도 보행자 보호 위반",
    "무면허운전", "음주운전", "보도 침범", "승객 추락 방지 위반", "어린이보호구역 위반", "화물 고정 위반",
]
UNSEEABLE = ("무면허운전", "음주운전", "제한속도 20km/h 초과")  # 영상으로 확인할 수 없어 근거가 있어도 unknown이다.

PROMPT = """너는 교통사고 관찰 기록을 기준 도표에 맞추는 분석가다. 입력은 관찰 기록과 후보 도표뿐이다. 한국어로 쓴다.

원칙
- 번호가 붙은 사실만 쓴다. 사실에 없는 내용은 어떤 칸에도 쓰지 않는다. 그럴듯한 추측도 안 된다.
- 과실 비율이나 퍼센트, 법정 기한, 금액 같은 숫자를 쓰지 않는다. 숫자는 코드가 계산한다.
- 근거를 적는 칸(fact)에는 그 주장을 직접 뒷받침하는 사실 번호를 쓴다. 그런 사실이 없으면 null이다.

작성
- chart_id: 사고 상황이 후보 도표의 situation과 실제로 맞을 때만 고른다. 맞는 도표가 없거나 후보가 없으면 null이다. 억지로 고르지 않는다.
- me: 고른 도표에서 촬영 차가 A인지 B인지 적는다. 도표를 고르지 않으면 null이다.
- applied: 사실이 직접 보여 주는 수정요소 id와 사실 번호다.
- unknown: 결과에 영향을 줄 수 있지만 영상으로 판단할 수 없는 수정요소 id다. 사실이 해당 없음을 보여 주면 적지 않는다.
- serious: 12대 중과실 중 이 사고와 관련 있어 보이는 항목만 적는다. likelihood high는 그 사실이 위반 자체를 직접 보여 줄 때만 쓴다. 가까이 있었다, 접근했다 정도면 low나 unknown이다. 음주, 무면허, 속도는 영상으로 알 수 없으니 unknown이다.
- severity: 사실에 보이는 파손과 충격으로 고른다. 알 수 없으면 null이다.
- timeline: 사고 흐름을 보여 주는 사실 번호를 시간순으로 적는다.
- favorable, unfavorable: 촬영 차 운전자에게 유리하거나 불리한 점이다.
- actions_now, actions_later: 일반적인 대응 안내다. 부상 여부처럼 사실에 없는 상황을 있다고 쓰지 않는다. 사용자가 읽는 글이므로 도표 후보, 사실 번호 같은 입력 구조 이야기는 쓰지 않는다.
"""


class Pick(BaseModel):
    id: str
    fact: int | None


class Cite(BaseModel):
    fact: int | None
    text: str


class SeriousPick(BaseModel):
    item: SeriousItem
    likelihood: Literal["high", "medium", "low", "unknown"]
    fact: int | None


class AssessOut(BaseModel):
    """모델은 사실 번호로만 근거를 댄다. 시각과 근거 문장은 코드가 관찰 기록에서 가져오고 숫자는 코드가 낸다."""
    accident_type: str | None
    summary: str
    severity: Literal["low", "medium", "high"] | None
    timeline: list[int | None]
    chart_id: str | None
    me: Literal["A", "B"] | None
    applied: list[Pick]
    unknown: list[str]
    serious: list[SeriousPick]
    favorable: list[Cite]
    unfavorable: list[Cite]
    actions_now: list[str]
    actions_later: list[str]


def _none(reason: str) -> Report:
    return Report(involvement="none", reason=reason, accident_type=None, summary=None, collision_t=None,
                  confidence="low", severity=None, timeline=[], facts=[], unseen=[], fault=None, fault_note=None,
                  serious_violations=[], favorable=[], unfavorable=[], actions_now=[], actions_later=[])


def _messages(o: Observation, facts: list[Fact], collision_t: float | None, charts: list[Chart]) -> list[dict]:
    record = {"involvement": o.involvement, "scene": o.scene, "road": o.road, "ego_action": o.ego_action,
              "other_action": o.other_action, "signal": o.signal, "collision_t": collision_t, "unseen": o.unseen,
              "facts": [{"fact": i, "t": f.t, "text": f.text} for i, f in enumerate(facts)]}
    # 기본과실과 증감 숫자는 보여 주지 않는다. 모델이 결과를 맞춰 고르지 못하게 한다.
    options = [{"id": c.id, "title": c.title, "situation": c.situation,
                "modifiers": [{"id": m.id, "party": m.party, "label": m.label} for m in c.modifiers]} for c in charts]
    text = json.dumps({"observation": record, "charts": options}, ensure_ascii=False)
    return [{"role": "system", "content": PROMPT}, {"role": "user", "content": text}]


def _fault(chart: Chart, out: AssessOut, cite) -> FaultAssessment:
    mods = {m.id: m for m in chart.modifiers}
    picks = {p.id: cite(p.fact) for p in out.applied if p.id in mods}
    backed = {i: e for i, e in picks.items() if e}
    # 근거 없이 적용했다고 한 수정요소는 버리지 않고 범위를 넓히는 unknown으로 돌린다.
    unknown = [i for i in out.unknown if i in mods] + [i for i, e in picks.items() if not e]
    res = calculate(chart, out.me, list(backed), unknown)

    def name(i: str) -> str:
        return f"{'내' if mods[i].party == out.me else '상대'} {mods[i].label}"

    return FaultAssessment(
        chart_id=chart.id, chart_title=chart.title, source_url=chart.source, me=out.me, base=res.base,
        my_min=res.my_min, my_max=res.my_max,
        steps=[FaultStep(label=name(s.id), delta=s.effect, evidence=backed[s.id]) for s in res.steps],
        unknown=[name(i) for i in dict.fromkeys(unknown) if i not in backed])


def assess(observation: Observation, keyframes: list[Keyframe], table: FaultTable, llm, duration: float) -> Report:
    o = observation
    if o.involvement == "none":
        return _none(o.reason or NO_ACCIDENT)
    facts = sorted((f for f in o.facts if 0 <= f.t <= duration and near_frame(f.t, keyframes)), key=lambda f: f.t)
    if not facts:
        return _none(NO_EVIDENCE)
    # 충돌 시각은 그 곁에 프레임에서 본 사실이 있어야 확인된 것이다.
    collision_t = o.collision_t if o.collision_t is not None and any(
        abs(f.t - o.collision_t) <= NEAR_FRAME_S for f in facts) else None
    judged = o.involvement == "party" and collision_t is not None
    charts = table.shortlist(o.scene) if judged else []

    def check(out: AssessOut) -> None:
        if not judged or out.chart_id is None:
            return
        if out.chart_id not in {c.id for c in charts}:
            raise InvalidOutput(f"{out.chart_id}는 후보 도표에 없다. 후보 중에서 고르거나 null로 답하라.")
        if out.me is None:
            raise InvalidOutput("도표를 골랐으면 me에 A나 B를 적어야 한다.")

    out = ask(llm, _messages(o, facts, collision_t, charts), AssessOut, check)

    def cite(i: int | None) -> Evidence | None:
        return facts[i] if i is not None and 0 <= i < len(facts) else None

    def claims(items: list[Cite]) -> list[str]:
        return [f"{c.text} ({e.t:.1f}초)" for c in items if (e := cite(c.fact))] if judged else []

    def serious(p: SeriousPick) -> SeriousViolation:
        e = cite(p.fact)
        if e is None or p.item in UNSEEABLE:
            return SeriousViolation(item=p.item, likelihood="unknown", evidence=None)
        return SeriousViolation(item=p.item, likelihood=p.likelihood, evidence=e)

    fault = _fault(table.get(out.chart_id), out, cite) if judged and out.chart_id else None
    note = None if fault or o.involvement != "party" else NO_CHART if judged else NO_COLLISION
    return Report(
        involvement=o.involvement, reason=None, accident_type=out.accident_type, summary=out.summary,
        collision_t=collision_t, confidence=confidence(collision_t is not None, len(facts), len(fault.unknown) if fault else 0),
        severity=out.severity if collision_t is not None else None,
        timeline=[e for i in out.timeline if (e := cite(i))], facts=facts, unseen=o.unseen, fault=fault, fault_note=note,
        serious_violations=[serious(p) for p in out.serious] if judged else [],
        favorable=claims(out.favorable), unfavorable=claims(out.unfavorable),
        actions_now=out.actions_now, actions_later=out.actions_later)

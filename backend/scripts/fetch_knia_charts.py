"""손해보험협회 과실비율정보포털에서 도표를 내려받아 data/fault_charts.json을 만든다.

수치는 페이지에서 그대로 파싱한다. 하나라도 파싱에 실패하면 파일을 쓰지 않고 오류로 끝낸다.
실행: cd backend && uv run python scripts/fetch_knia_charts.py [차43-2 ...]
"""
import html
import json
import re
import sys
from pathlib import Path

import httpx

URL = "https://accident.knia.or.kr/myaccident-content?chartNo={no}&chartType=1"
OUT = Path(__file__).resolve().parent.parent / "data" / "fault_charts.json"
DEFAULT = ["차43-2", "차43-3", "차43-1", "차41-1", "차42-2", "차51-1", "차16-1", "차44-1"]


def text(s: str) -> str:
    s = re.sub(r"<br\s*/?>", " ", s, flags=re.I)
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", s)).split())


def one(pat: str, s: str, what: str, flags=re.S) -> re.Match:
    m = re.search(pat, s, flags)
    if not m:
        raise ValueError(f"{what} 파싱 실패")
    return m


def parse(no: str, page: str) -> dict:
    page = re.sub(r"<script.*?</script>", "", page, flags=re.S)
    head = one(r'<h3 class="title">([^<]+)</h3>', page, "도표 번호")
    if text(head.group(1)) != no:
        raise ValueError(f"도표 번호 불일치: {text(head.group(1))}")
    title = text(one(r'data-depth="3"[^>]*>([^<]+)</a>', page, "제목").group(1))
    situation = text(one(r"<dt>사고 상황</dt>\s*<dd>(.*?)</dd>", page, "사고 상황").group(1))
    base_a = int(one(r'data-ratio-a="(\d+)"', page, "기본과실 A").group(1))
    base_b = int(one(r'data-ratio-b="(\d+)"', page, "기본과실 B").group(1))
    if base_a + base_b != 100:
        raise ValueError(f"기본과실 합이 100이 아님: {base_a}:{base_b}")
    body = one(r'<ul class="factorList[^"]*"[^>]*>(.*?)</ul>', page, "가감요소 목록").group(1)
    modifiers = []
    for i, li in enumerate(re.findall(r"<li>(.*?)</li>", body, re.S), 1):
        a = int(one(r'<em class="isA">(-?\d+)</em>', li, "가감 A").group(1))
        b = int(one(r'<em class="isB">(-?\d+)</em>', li, "가감 B").group(1))
        label = text(one(r"<strong>(.*?)</strong>", li, "가감요소 이름").group(1))
        party = label[:1]
        if party not in "AB" or label[1:2] != " ":
            raise ValueError(f"가감요소 당사자를 알 수 없음: {label}")
        mine, other = (a, b) if party == "A" else (b, a)
        if other != 0:
            raise ValueError(f"양쪽 증감이 있는 가감요소는 지원하지 않음: {label} {a}/{b}")
        modifiers.append({"id": f"{party.lower()}{i}", "label": label[2:], "party": party, "delta": mine})
    if not modifiers:
        raise ValueError("가감요소가 없음")
    return {"id": no, "title": title, "situation": situation, "base_a": base_a,
            "modifiers": modifiers, "source": URL.format(no=no)}


def main(nos: list[str]) -> None:
    charts = []
    for no in nos:
        r = httpx.get(URL.format(no=no), timeout=30, follow_redirects=True)
        r.raise_for_status()
        try:
            charts.append(parse(no, r.text))
        except ValueError as e:
            sys.exit(f"{no}: {e}")
    OUT.write_text(json.dumps(charts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(charts)}개 도표 저장: {OUT}")


if __name__ == "__main__":
    main(sys.argv[1:] or DEFAULT)

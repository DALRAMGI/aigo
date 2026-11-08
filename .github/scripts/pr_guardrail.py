"""PR 가드레일 (ADR 0001, 0003).

관리자(jcmaker)가 아닌 사람의 PR에서 확인한다.
1. apps/api/ 와 가드레일 파일(.github/, AGENTS.md, CLAUDE.md)을 바꾸지 않았다.
2. PR 본문의 작업 내용, 변경 사유, 작업자 칸이 비어 있지 않다.
3. docs/adr/ 에 ADR 파일을 하나 이상 추가했다.

입력은 환경 변수로 받는다: PR_AUTHOR, PR_BODY, CHANGED_FILES(줄바꿈 구분, "상태\t경로", 상태는 GitHub API 값 added/modified/removed/renamed).
"""
import os
import re
import sys

OWNER = "jcmaker"
REQUIRED = ["작업 내용", "변경 사유", "작업자"]
GUARDED = (".github/", "AGENTS.md", "CLAUDE.md")


def section(body: str, title: str) -> str:
    # "## 제목" 다음부터 다음 "## " 전까지. HTML 주석은 빼고 본다.
    m = re.search(rf"^##\s*{re.escape(title)}\s*$(.*?)(?=^##\s|\Z)", body, re.M | re.S)
    if not m:
        return ""
    return re.sub(r"<!--.*?-->", "", m.group(1), flags=re.S).strip()


def check(author: str, body: str, changed: list[tuple[str, str]]) -> list[str]:
    if author == OWNER:
        return []
    errors = []
    api = [p for _, p in changed if p.startswith("apps/api/")]
    if api:
        errors.append(
            "백엔드(apps/api)는 조준형(jcmaker)만 고칠 수 있습니다(ADR 0003). 이 파일들의 변경을 빼 주세요: "
            + ", ".join(api[:10]))
    guarded = [p for _, p in changed if p.startswith(GUARDED)]
    if guarded:
        errors.append("가드레일 파일(.github/, AGENTS.md, CLAUDE.md)은 조준형(jcmaker)만 고칠 수 있습니다: " + ", ".join(guarded[:10]))
    for title in REQUIRED:
        if not section(body, title):
            errors.append(f"PR 본문의 '{title}' 칸이 비어 있습니다. 조준형(jcmaker)이 작업 내용, 변경 사유, 작업자를 남기라고 했습니다.")
    added_adr = [p for s, p in changed if s in ("added", "renamed") and re.fullmatch(r"docs/adr/\d{4}-[^/]+\.md", p)
                 and not p.endswith("0000-template.md")]
    if not added_adr:
        errors.append("docs/adr/ 에 ADR 파일을 하나 추가해 주세요. 양식: docs/adr/0000-template.md (ADR 0001)")
    return errors


def main() -> int:
    changed = [tuple(line.split("\t", 1)) for line in os.environ.get("CHANGED_FILES", "").splitlines() if "\t" in line]
    errors = check(os.environ.get("PR_AUTHOR", ""), os.environ.get("PR_BODY", ""), changed)
    for e in errors:
        print(f"::error::{e}")
    if not errors:
        print("PR 가드레일 통과")
    return 1 if errors else 0


def _selftest() -> None:
    ok_body = "## 작업 내용\n문구 수정\n## 변경 사유\n오타\n## 작업자\n홍길동 (gildong)\n## ADR\n"
    adr = [("added", "docs/adr/0005-x.md"), ("modified", "apps/web/a.tsx")]
    assert check("jcmaker", "", [("modified", "apps/api/x.py")]) == []
    assert check("gildong", ok_body, adr) == []
    assert len(check("gildong", ok_body, adr + [("modified", "apps/api/app/main.py")])) == 1
    empty = "## 작업 내용\n<!-- 설명 -->\n\n## 변경 사유\n\n## 작업자\n<!-- x -->\n"
    assert len(check("gildong", empty, adr)) == 3
    assert len(check("gildong", ok_body, [("modified", "docs/adr/0001-record-decisions.md")])) == 1
    assert len(check("gildong", ok_body, [("added", "docs/adr/0000-template.md")])) == 1
    assert len(check("gildong", ok_body, adr + [("modified", ".github/scripts/pr_guardrail.py"), ("modified", "AGENTS.md")])) == 1


if __name__ == "__main__":
    if sys.argv[1:] == ["--selftest"]:
        _selftest()
        print("selftest ok")
        sys.exit(0)
    sys.exit(main())

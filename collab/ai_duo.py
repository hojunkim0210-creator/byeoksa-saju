#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gemini × Claude 협업 파이프라인 (테스트가 판정하는 버전)

흐름 (라운드마다):
  1. 개발자 AI가 허용된 파일에 대한 '패치(unified diff)'만 제출한다. 전체 파일 재작성 금지.
  2. 스크립트가 패치를 검사한다 — 허용 파일 밖 변경이면 거부, git apply --check 실패면 거부.
  3. 패치를 적용하고 `npm test`를 실행한다 (만세력 정답표·CSS·문구 보존·모바일 검사).
  4. 리뷰어 AI가 '원래 코드 + 패치 + 테스트 결과'를 보고 JSON으로 판정한다.
  5. 테스트 통과 AND 리뷰 승인일 때만 작업 브랜치에 커밋한다. main 머지는 사람이 한다.

사용 예:
  python collab/ai_duo.py "대운 카드에 대운수 계산 근거(절기와 일수)를 작은 글씨로 표시" \
      --files site/js/app.js site/css/style.css --rounds 3

  # API 없이 흐름만 점검 (가짜 응답)
  python collab/ai_duo.py "자가 점검" --files site/js/app.js --mock

역할 교대: --developer claude --reviewer gemini 로 바꿀 수 있다.
"""

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOG_DIR = ROOT / "collab" / "logs"
MAX_FILE_CHARS = 120_000  # 프롬프트에 넣을 파일 크기 상한 (큰 파일은 --files 로 나눠서 맡긴다)

RULES = (ROOT / "AI_RULES.md").read_text(encoding="utf-8") if (ROOT / "AI_RULES.md").exists() else ""

DEVELOPER_PROMPT = f"""당신은 이 저장소의 개발자입니다. 아래 저장소 규칙을 반드시 지킵니다.

{RULES}

[제출 형식 — 반드시 지킬 것]
- 설명은 '## 변경 요약' 아래 5줄 이내.
- 코드는 ```diff 블록 하나에 git unified diff 형식(--- a/경로, +++ b/경로, @@ 헝크)으로만 제출합니다.
- 허용된 파일 외에는 건드리지 않습니다. 파일 전체를 다시 쓰지 말고 바꿀 부분만 헝크로 냅니다.
- 컨텍스트 줄은 원본과 한 글자도 다르지 않아야 합니다(공백 포함).
"""

REVIEWER_PROMPT = f"""당신은 이 저장소의 코드 리뷰어입니다. 아래 저장소 규칙을 기준으로 판정합니다.

{RULES}

입력으로 '작업 목표, 원래 파일, 제출된 패치, 자동 테스트 결과'를 받습니다.
테스트가 실패했다면 승인할 수 없습니다. 테스트가 잡지 못하는 문제(목표 미달, 문구 훼손, 콘셉트 이탈,
보안·개인정보 문제, 불필요한 변경)를 찾아 지적합니다.

반드시 JSON 한 덩어리로만 답합니다 (다른 텍스트 금지):
{{"verdict": "approve" 또는 "request_changes", "issues": ["구체적 지적과 수정 방법", ...]}}
"""


# ───────────────────────────── 모델 호출 ─────────────────────────────
def call_gemini(system_prompt: str, user_message: str) -> str:
    from google import genai  # pip install google-genai  (구 google-generativeai 는 지원 종료)
    from google.genai import types
    model = os.environ.get("GEMINI_MODEL")
    if not model:
        sys.exit("GEMINI_MODEL 이 비어 있습니다. .env 에 현재 제공되는 Gemini 모델 이름을 적어 주세요.")
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    resp = client.models.generate_content(
        model=model,
        contents=user_message,
        config=types.GenerateContentConfig(system_instruction=system_prompt, temperature=0.2, max_output_tokens=32768),
    )
    return resp.text or ""


def call_claude(system_prompt: str, user_message: str) -> str:
    import anthropic  # pip install anthropic
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    resp = client.messages.create(
        model=os.environ.get("CLAUDE_MODEL", "claude-sonnet-5-5"),
        max_tokens=32000,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )
    return "".join(block.text for block in resp.content if getattr(block, "type", "") == "text")


def call_mock(role: str):
    """API 없이 파이프라인만 점검하는 가짜 모델. 개발자는 주석 한 줄 추가, 리뷰어는 승인."""
    scenario = os.environ.get("AI_DUO_MOCK", "ok")  # ok | break_text | outside (안전장치 점검용)

    def _call(system_prompt: str, user_message: str) -> str:
        if role == "developer":
            m = re.search(r"### 파일: (\S+)\n```[a-z]*\n(.*?)\n```", user_message, re.S)
            path, body = m.group(1), m.group(2)
            lines = body.split("\n")
            if scenario == "outside":
                path = "site/index.html"  # 허용되지 않은 파일 → 스크립트가 거부해야 함
            if scenario == "break_text":  # '크르르' 대사가 든 줄을 지움 → 문구 보존 테스트가 실패해야 함
                i = next(k for k, l in enumerate(lines) if "크르르" in l)
                return ("## 변경 요약\n- (mock) 대사 한 줄 삭제\n\n```diff\n"
                        f"--- a/{path}\n+++ b/{path}\n@@ -{i},3 +{i},2 @@\n {lines[i - 1]}\n-{lines[i]}\n {lines[i + 1]}\n```")
            return ("## 변경 요약\n- (mock) 첫 줄 위에 주석 추가\n\n```diff\n"
                    f"--- a/{path}\n+++ b/{path}\n@@ -1,1 +1,2 @@\n+// ai_duo mock 점검용 주석\n {lines[0]}\n```")
        return json.dumps({"verdict": "approve", "issues": []}, ensure_ascii=False)
    return _call


PROVIDERS = {"gemini": call_gemini, "claude": call_claude}


# ───────────────────────────── 보조 함수 ─────────────────────────────
def sh(*args, check=True, **kw):
    return subprocess.run(args, cwd=ROOT, text=True, capture_output=True, check=check, **kw)


def ensure_clean_git():
    if sh("git", "rev-parse", "--is-inside-work-tree", check=False).returncode != 0:
        sys.exit("git 저장소 안에서 실행해야 합니다. (git init 후 첫 커밋을 만들어 주세요)")
    if sh("git", "status", "--porcelain").stdout.strip():
        sys.exit("작업 트리에 커밋되지 않은 변경이 있습니다. 먼저 커밋하거나 정리해 주세요.")


def extract_diff(text: str) -> str:
    blocks = re.findall(r"```diff\n(.*?)```", text, re.S)
    if not blocks:
        raise ValueError("```diff 블록이 없습니다.")
    diff = blocks[-1]
    return diff if diff.endswith("\n") else diff + "\n"


def touched_files(diff: str) -> set:
    files = set()
    for line in diff.splitlines():
        if line.startswith(("--- a/", "+++ b/")):
            files.add(line[6:].strip())
    return files


def run_tests() -> tuple:
    r = sh("npm", "test", check=False)
    out = (r.stdout + "\n" + r.stderr)
    summary = "\n".join(l for l in out.splitlines() if re.match(r"^(not ok|# (pass|fail))", l))
    failures = re.findall(r"^not ok.*?(?=^(?:ok|not ok|# tests)|\Z)", out, re.S | re.M)
    return r.returncode == 0, summary + ("\n\n" + "\n".join(f[:1500] for f in failures[:5]) if failures else "")


def parse_review(text: str) -> dict:
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return {"verdict": "request_changes", "issues": ["리뷰가 JSON 형식이 아닙니다: " + text[:300]]}
    try:
        data = json.loads(m.group(0))
    except json.JSONDecodeError:
        return {"verdict": "request_changes", "issues": ["리뷰 JSON 파싱 실패: " + m.group(0)[:300]]}
    if data.get("verdict") not in ("approve", "request_changes"):
        data["verdict"] = "request_changes"
    return data


def file_blocks(files) -> str:
    parts = []
    for f in files:
        p = ROOT / f
        body = p.read_text(encoding="utf-8") if p.exists() else ""
        if len(body) > MAX_FILE_CHARS:
            sys.exit(f"{f} 가 너무 큽니다({len(body)}자). 작업을 더 작은 파일 단위로 나눠 주세요.")
        lang = {".js": "javascript", ".css": "css", ".html": "html", ".py": "python"}.get(p.suffix, "")
        parts.append(f"### 파일: {f}\n```{lang}\n{body}\n```")
    return "\n\n".join(parts)


# ───────────────────────────── 메인 루프 ─────────────────────────────
def main():
    ap = argparse.ArgumentParser(description="Gemini × Claude 협업 (테스트 판정)")
    ap.add_argument("goal", help="작업 목표 (한 문장~한 문단)")
    ap.add_argument("--files", nargs="+", required=True, help="수정을 허용할 파일 (저장소 기준 경로)")
    ap.add_argument("--rounds", type=int, default=3)
    ap.add_argument("--developer", choices=["gemini", "claude"], default="gemini")
    ap.add_argument("--reviewer", choices=["gemini", "claude"], default="claude")
    ap.add_argument("--mock", action="store_true", help="API 없이 흐름만 점검")
    args = ap.parse_args()

    try:
        from dotenv import load_dotenv  # 선택 사항
        load_dotenv(ROOT / ".env")
    except ImportError:
        pass

    allowed = set(args.files)
    for f in allowed:
        if not (ROOT / f).exists():
            sys.exit(f"허용 파일이 없습니다: {f}")

    developer = call_mock("developer") if args.mock else PROVIDERS[args.developer]
    reviewer = call_mock("reviewer") if args.mock else PROVIDERS[args.reviewer]

    ensure_clean_git()
    base_branch = sh("git", "rev-parse", "--abbrev-ref", "HEAD").stdout.strip()
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")[:-3]
    work_branch = f"duo/{stamp}"
    sh("git", "switch", "-c", work_branch)
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_path = LOG_DIR / f"{stamp}.md"
    log = [f"# 협업 로그 {stamp}", f"- 목표: {args.goal}", f"- 허용 파일: {', '.join(sorted(allowed))}",
           f"- 개발자: {args.developer} / 리뷰어: {args.reviewer}{' (mock)' if args.mock else ''}", ""]

    originals = file_blocks(sorted(allowed))
    feedback = ""
    approved = False
    for rnd in range(1, args.rounds + 1):
        print(f"▶ Round {rnd}: 개발자({args.developer}) 패치 작성 중…")
        dev_msg = (f"[작업 목표]\n{args.goal}\n\n[수정 허용 파일 — 원본]\n{originals}\n\n"
                   + (f"[이전 시도에 대한 피드백]\n{feedback}\n\n위 피드백을 반영해 '원본 기준' 패치를 처음부터 다시 제출하세요." if feedback else ""))
        dev_out = developer(DEVELOPER_PROMPT, dev_msg)
        log += [f"## Round {rnd} — 개발자", dev_out, ""]

        sh("git", "checkout", "--", ".")  # 매 라운드 원본 기준으로 적용
        try:
            diff = extract_diff(dev_out)
            outside = touched_files(diff) - allowed
            if outside:
                raise ValueError(f"허용되지 않은 파일 변경: {', '.join(sorted(outside))}")
            patch = LOG_DIR / f"{stamp}-r{rnd}.diff"
            patch.write_text(diff, encoding="utf-8")
            chk = sh("git", "apply", "--check", "--recount", str(patch), check=False)
            if chk.returncode != 0:
                raise ValueError("패치 적용 불가 (컨텍스트 불일치): " + chk.stderr.strip()[:800])
            sh("git", "apply", "--recount", str(patch))
        except ValueError as e:
            feedback = f"패치 거부: {e}"
            print("  ✗", feedback)
            log += [f"### 스크립트 판정: {feedback}", ""]
            continue

        print("  ▷ 테스트 실행 중…")
        ok, test_report = run_tests()
        print("  ", "✓ 테스트 통과" if ok else "✗ 테스트 실패")
        log += ["### 테스트 결과", "```", test_report, "```", ""]

        print(f"  ▷ 리뷰어({args.reviewer}) 검토 중…")
        rev_msg = (f"[작업 목표]\n{args.goal}\n\n[원래 파일]\n{originals}\n\n[제출된 패치]\n```diff\n{diff}```\n\n"
                   f"[자동 테스트 결과: {'통과' if ok else '실패'}]\n{test_report}")
        review = parse_review(reviewer(REVIEWER_PROMPT, rev_msg))
        log += ["### 리뷰", "```json", json.dumps(review, ensure_ascii=False, indent=2), "```", ""]

        if ok and review["verdict"] == "approve":
            sh("git", "add", "-A", *sorted(allowed))
            sh("git", "commit", "-m", f"duo: {args.goal[:60]}\n\n개발자 {args.developer}, 리뷰어 {args.reviewer}, 라운드 {rnd}, 테스트 통과")
            approved = True
            print(f"🎉 테스트 통과 + 리뷰 승인 → 브랜치 '{work_branch}' 에 커밋했습니다.")
            break
        feedback = (("[테스트 실패]\n" + test_report + "\n\n") if not ok else "") + \
                   "[리뷰 지적]\n" + "\n".join(f"- {i}" for i in review.get("issues", []))
        print("  ↺ 피드백을 개발자에게 돌려보냅니다.")

    if not approved:
        sh("git", "checkout", "--", ".")
        sh("git", "switch", base_branch)
        sh("git", "branch", "-D", work_branch, check=False)
        log.append("## 결과: 승인되지 않음 — 변경을 버리고 원래 브랜치로 돌아갔습니다.")
        print("⚠️ 라운드 안에 승인되지 않았습니다. 변경은 버렸고, 로그를 확인하세요.")
    else:
        log.append(f"## 결과: 승인 — 브랜치 {work_branch}. 확인 후 PR을 열어 사람이 머지하세요.")
    log_path.write_text("\n".join(log), encoding="utf-8")
    print(f"📝 로그: {log_path.relative_to(ROOT)}")
    sys.exit(0 if approved else 1)


if __name__ == "__main__":
    main()

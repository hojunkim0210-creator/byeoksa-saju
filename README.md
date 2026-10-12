# 벽사신견(辟邪神犬) 사주

1998년 강원도 영월 산자락 외딴 흙집을 지키던 백구 지박령이 읽어주는 사주 리포트 웹입니다.

## 폴더 구성

```
site/                  ← 배포되는 웹사이트 (GitHub Pages에는 이 폴더만 올라감)
  index.html
  css/style.css
  js/saju-core.js      ← 만세력 계산 (절기 시각표 1900~2100 포함, DOM 없음)
  js/app.js            ← 화면·이벤트
  mung.jpg, icon-192.png, icon-512.png, manifest.json
tests/                 ← 자동 테스트 (이게 통과해야 배포됨)
  unit/                ← 만세력 정답 테스트 (천문연구원 공표 절기와 대조 등)
  static/              ← CSS 클래스 누락 검사, 문구 보존 검사
  e2e/                 ← 320·360·390px 모바일 브라우저 검사
tools/solar_terms.py   ← 절기 시각표 생성기 (VSOP87 천문 계산)
collab/ai_duo.py       ← Gemini × Claude 협업 스크립트 (패치 제출 → 테스트 판정)
AI_RULES.md            ← 사람·AI 공통 작업 규칙 (문구 보존 등)
```

## 처음 한 번: GitHub에 올리고 배포 켜기

1. GitHub에서 새 저장소를 만들고 이 폴더 전체를 올립니다 (`.env`는 올라가지 않습니다).
2. 저장소 **Settings → Pages → Source**를 **GitHub Actions**로 바꿉니다.
3. 이후 `main`에 올라오는 변경은 테스트가 통과할 때만 자동 배포됩니다.

## 테스트 실행 (내 컴퓨터에서)

```bash
npm install
npx playwright install chromium
npm test            # 전체 (약 15초)
npm run test:unit   # 브라우저 없이 빠른 검사만
```

Python 3가 필요합니다 (문구 보존 검사에서 사용).

## 두 AI 협업 (`collab/ai_duo.py`)

```bash
pip install google-genai anthropic python-dotenv
cp .env.example .env      # 키와 모델 이름 입력
git switch main
python collab/ai_duo.py "할 일 설명" --files site/js/app.js --rounds 3
python collab/ai_duo.py "자가 점검" --files site/js/app.js --mock   # API 없이 흐름만 확인
```

- 개발자 AI는 **허용된 파일에 대한 패치만** 제출합니다. 다른 파일을 건드리면 자동으로 거부돼요.
- 패치를 적용한 뒤 `npm test`가 돌고, 리뷰어 AI가 **원본·패치·테스트 결과**를 함께 보고 판정합니다.
- **테스트 통과 + 리뷰 승인**일 때만 `duo/날짜` 브랜치에 커밋됩니다. `main` 머지는 사람이 PR로 합니다.
- 승인되지 않으면 변경을 버리고 원래 브랜치로 돌아갑니다. 로그는 `collab/logs/`에 남습니다.

## 만세력 계산 기준

- 연주: 입춘 절입 **시각** 기준 / 월주: 직전 절(節) 절입 **시각** 기준
- 대운수: 순행은 출생→다음 절기, 역행은 직전 절기→출생 일수 ÷ 3 (반올림)
- 절기표 정확도: 한국천문연구원 공표 2026·2027년 절기 24개와 최대 0.6분 차이
- 출생 시진 안에 절입 시각이 걸치면 결과 화면에 "절입 경계 경고"를 띄웁니다.
- 서울의 역사적 표준시(1954~61년 UTC+8:30)와 서머타임 시기를 반영합니다.

## 남은 과제

- **결제**: 유료 본문이 결제 전부터 페이지에 들어 있고 `unlockContent()`로 열립니다. 실제 결제 전, 서버 승인 후에만 본문을 내려주는 구조가 필요합니다.
- **음력 입력**: 현재 비활성. 음양력 변환 데이터가 필요합니다.
- **공유 링크**: 직업·꿈 등 입력값이 URL에 그대로 실립니다. 짧은 ID 방식으로 바꾸는 것을 권장합니다.
- **야자시**: 23:30~24:00 출생의 일주 처리 기준(야자시/조자시) 선택 기능이 없습니다.

# 벽사신견(辟邪神犬) 사주

1998년 강원도 영월 산자락 외딴 흙집을 지키던 백구 지박령이 읽어주는 사주 리포트 웹입니다.

## 무엇이 들어 있나

| 기능 | 내용 | 요금 |
|---|---|---|
| 벽사 사주 풀이 | 원국·대운·오행, 심리 투시, 악연 경고, 후각 감별 | 무료 |
| 천명 리포트 | 6개 장 + 맞춤 개운부(부적) 이미지·배경화면 저장, 무료 풀이 요약 | 유료 4,900원 (`SALE.price`) |
| 신년운세 | 다음 해 열두 달 점수(무료) + 달별 할 일·조심·분야별 흐름·한 해 비방(유료) | 유료 4,900원 |
| 궁합 상세 리포트 | 무료 궁합 아래: 싸우는 패턴·필요한 한마디·함께할 해·데이트 비방 | 유료 3,900원 |
| 소원 부적 | 재물·연애·합격·건강·액막이 중 하나, 금테 부적 + 풀이 + 배경화면 | 유료 1,900원 |
| 인연 궁합 | 두 사람의 일간 오행·일지 합충·띠로 점수와 근거 | 무료 |
| 오늘의 운세 | 오늘 일진과 내 일간의 십신 관계로 점수·할 일·피할 일 | 무료 |
| 벽사 패 뽑기 | 오리지널 22장 덱, 하루 한 장(같은 날엔 같은 패) | 무료 |
| 백구에게 묻기 | 8개 질문 버튼, 내 사주로 답함 | 무료 |
| 공유 카드 | 1080×1920 세로 이미지(일주·동물 이름·태그) | 무료 |
| 사이트 공유하기 | 카톡 등으로 첫 화면 주소만 보냄(개인정보 없음), 링크 미리보기 이미지 `img/og-image.jpg` | 무료 |

## 폴더 구성

```
site/                  ← 배포되는 웹사이트 (GitHub Pages에는 이 폴더만 올라감)
  index.html           ← 모든 화면 (대문·입력·결과·궁합·운세·패·묻기)
  legal.html           ← 이용약관 · 개인정보처리방침 · 환불 안내 · 오락 목적 고지 · 사업자 정보
  css/style.css        ← 디자인 ("밤의 대문 앞, 노란 부적" — docs/DESIGN.md)
  js/saju-core.js      ← 만세력·궁합·일진·패 계산 (절기 시각표 1900~2100 포함, DOM 없음)
  js/app.js            ← 사주 풀이 화면·문장·결제 화면·부적
  js/extras.js         ← 궁합·오늘의 운세·벽사 패·백구에게 묻기·공유 카드
  js/shop.js           ← 유료 상품: 신년운세·궁합 상세·소원 부적, 대문 진열
  img/talisman.webp    ← 개운부 바탕 그림 (tools/make_talisman.py로 생성)
  mung.jpg, icon-192.png, icon-512.png, manifest.json
functions/             ← 결제 확인 서버 (Cloudflare Pages Functions, /api/payment/complete)
tests/                 ← 자동 테스트 (이게 통과해야 배포됨)
  unit/                ← 만세력 정답(천문연구원 절기 대조)·궁합·일진·패 계산
  static/              ← CSS 클래스 누락, 문구 보존, 약관 링크, 배포 캐시 목록 검사
  e2e/                 ← 320·360·390px 모바일 브라우저 검사, 사람마다 다른 풀이, 새 기능
tools/solar_terms.py   ← 절기 시각표 생성기 (VSOP87 천문 계산)
tools/make_talisman.py ← 부적 그림 생성기 (Noto Serif CJK 글꼴, OFL)
tools/make_og_image.py ← 카톡·SNS 링크 미리보기 이미지 생성기 (1200×630)
collab/ai_duo.py       ← Gemini × Claude 협업 스크립트 (패치 제출 → 테스트 판정)
docs/DESIGN.md         ← 색·글꼴·배치 기준
AI_RULES.md            ← 사람·AI 공통 작업 규칙 (문구 보존 등)
```

## 처음 한 번: GitHub에 올리고 배포 켜기

1. GitHub에서 새 저장소를 만들고 이 폴더 전체를 올립니다 (`.env`는 올라가지 않습니다).
2. 저장소 **Settings → Pages → Source**를 **GitHub Actions**로 바꿉니다.
3. 이후 `main`에 올라오는 변경은 테스트가 통과할 때만 자동 배포됩니다.
4. 배포할 때 CSS·JS 주소 뒤에 커밋 번호(`?v=…`)가 붙어서, 방문자 브라우저가 새 버전을 자동으로 받아 갑니다.
   새 JS·CSS 파일을 추가하면 `.github/workflows/deploy.yml`의 목록에도 넣어야 합니다(빠뜨리면 테스트가 알려 줍니다).

## 할인 (공유 할인 · 할인 코드)

- 사이트를 공유한 사람, 공유 링크(`?from=share`)로 들어온 사람, 할인 코드를 넣은 사람에게 **유료 상품 1건 1,000원 할인** (기기당 1회, 7일).
- 할인 코드 추가: `site/js/app.js`의 `PROMO_CODES`에 대문자로 넣는다. 예) `'OPEN2026': '오픈 기념 코드'`. 지금 코드: `BAEKGU`
- 할인 금액을 바꾸면 `SHARE_DISCOUNT.amount`와 `functions/api/payment/complete.js`의 `SHARE_DISCOUNT`를 같이 바꾼다 (테스트가 어긋나면 알려 줌).
- 할인은 이용자 기기에 기록되므로, 기기를 바꾸면 다시 받을 수 있다. 큰 금액 할인에는 쓰지 말 것.

## 가격·이벤트 바꾸기

`site/js/app.js` 맨 위의 `SALE`만 고치면 화면의 모든 가격 표시가 바뀝니다.

```js
const SALE = { price: 4900, eventName: '오픈 기념 이벤트', eventEndsOn: null };  // eventEndsOn: '2026-12-31' 처럼 넣으면 종료일 표시
```

"오늘 ○○명", "자정까지 80% 할인"처럼 사실이 아닌 숫자·기한은 표시·광고법 위반 소지가 있어 넣지 않습니다.

## 판매 전에 꼭 할 일

1. **사업자 정보 마무리**: 상호(Pathlogue)·대표·연락처는 들어가 있습니다. 사업자등록번호·통신판매업 신고번호·주소가 나오면
   `site/legal.html`의 "진행 중" 칸과 `site/index.html` 바닥글(`footerBiz`)을 채웁니다. 전자상거래법상 첫 화면에 표시해야 합니다.
2. **결제 켜기**: 아래 "실제 결제 켜기".
3. **약관 검토**: `legal.html`은 판매 전 초안입니다. 법률 전문가 검토를 받으세요.

## 실제 결제 켜기 (포트원 + Cloudflare Pages)

지금은 `PAYMENT.mode = 'test'`라서 결제창의 "테스트로 봉인 해제" 버튼으로 바로 열립니다. 실제 판매는 이렇게 켭니다.

1. **결제대행사 계약 + 포트원 가입** (https://admin.portone.io): 계약한 결제대행사를 포트원에 연결하면 아래 3가지가 나옵니다.
   - 상점 아이디(`store-…`), 채널 키(`channel-key-…`) → 공개해도 되는 값
   - API Secret → **비밀**. 코드·깃에 절대 넣지 않습니다
2. **Cloudflare Pages로 옮기기** (GitHub Pages는 결제가 주목적인 사이트에 쓸 수 없음)
   - Cloudflare 대시보드 → Workers & Pages → 만들기 → Pages → 이 GitHub 저장소 연결
   - 빌드 명령: 비움 / 빌드 출력 디렉터리: `site`
   - 설정 → 환경 변수(암호화): `PORTONE_API_SECRET`, 실판매 시작 후 `REQUIRE_LIVE=1`
   - `functions/api/payment/complete.js`가 자동으로 `/api/payment/complete` 주소가 됩니다 (포트원에 결제 상태·금액·상품명을 직접 확인)
   - 사용자 지정 도메인 연결 후, `site/index.html` 머리의 og:url·og:image·canonical 주소 3곳을 새 도메인으로 바꿉니다
3. **`site/js/app.js`의 `PAYMENT`만 채우기**
   ```js
   const PAYMENT = { mode: 'portone', storeId: 'store-…', channelKey: 'channel-key-…', payMethod: 'CARD',
                     orderName: '벽사신견 천명 리포트', verifyUrl: '/api/payment/complete' };
   ```
   가격을 바꾸면 `app.js`의 `PRODUCTS`(리포트는 `SALE.price`)와 `functions/api/payment/complete.js`의 `CATALOG`를 같이 바꿉니다 (둘이 다르면 테스트가 실패로 알려 줌).
4. 포트원 **테스트 채널**로 휴대폰·PC에서 결제 → 리포트 열림 → 포트원 콘솔에서 취소까지 해 본 뒤 실채널로 바꿉니다.

알아 둘 점: 리포트 문장은 지금도 페이지 안에서 만들어지므로, 개발자 도구를 다루는 사람은 결제 없이 열 수 있습니다.
결제 위조(금액 바꿔치기 등)는 서버 확인으로 막지만, 문장 자체를 서버에서만 만들려면 리포트 생성 코드를 서버로 옮기는 작업이 더 필요합니다.

## 테스트 실행 (내 컴퓨터에서)

```bash
npm install
npx playwright install chromium
npm test            # 전체 (약 30초)
npm run test:unit   # 브라우저 없이 빠른 검사만
```

Python 3가 필요합니다 (문구 보존 검사에서 사용).

## 부적 그림 다시 만들기

```bash
pip install numpy scipy pillow
python tools/make_talisman.py      # site/img/talisman.webp 생성, 일주 글자 자리(personalSlot) 출력
```

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

## 개인정보

- 사주 계산은 모두 브라우저 안에서 합니다. 서버로 보내는 생년월일은 없습니다.
- 기기에 남는 것: 생년월일·시·성별(`byeoksa.profile.v1`), 오늘 뒤집은 패(`byeoksa.tarot.날짜`), 무작위 식별값(`byeoksa.anon.v1`),
  결제한 리포트 표시(`byeoksa.paid.암호값`), 휴대폰 결제 중 잠시 맡긴 입력값(`byeoksa.pending.v1`, 결제가 끝나면 삭제).
  "이 기기에서 지우기"를 누르면 모두 지워집니다.
- 공유 링크에는 생년월일·시·성별만 담기고 직업·꿈은 담기지 않습니다.

## 남은 과제

- **결제**: 위 "실제 결제 켜기". 리포트 생성 코드를 서버로 옮기면 결제 우회까지 막을 수 있습니다.
- **음력 입력**: 현재 비활성. 음양력 변환 데이터가 필요합니다.
- **공유 링크**: 생년월일이 주소에 그대로 실립니다. 짧은 ID 방식으로 바꾸면 더 안전합니다(서버 필요).
- **야자시**: 23:30~24:00 출생의 일주 처리 기준(야자시/조자시) 선택 기능이 없습니다.

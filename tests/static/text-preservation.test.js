// 콘셉트·설화·대사·풀이 문구 보존 검사.
// 기준: tests/baseline/texts_gemini_standalone.json (Gemini 단독실행본에서 추출한 한글 문구 조각 전부)
// 연도 숫자와 간지만 바뀐 경우(동적 연도 처리)는 같은 문구로 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const GANJI = '갑을병정무기경신임계';
const ZHI = '자축인묘진사오미신유술해';
// 백구의 개 소리 추임새('크르르...', '킁킁...', '킁...')는 사용자 요청(2026-10-13, 지인 반응)으로 뺐다 → 비교할 때 양쪽에서 걷어낸다
const norm = s => s
  .replace(/(크르르|킁킁|킁)\.\.\.!?\s*/g, '')
  .replace(/\d{4}/g, 'YYYY')
  .replace(new RegExp(`[${GANJI}][${ZHI}](?=년|·|\\))`, 'g'), 'GG')
  .replace(/[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/g, 'GG')
  .replace(/\s+/g, ' ').trim();

// 의도적으로 바꾼 문구 (기능 변경에 따른 안내문) — 여기 없는 손실은 실패
const ALLOWED_REMOVED = [
  // 2026-10-13 사용자 요청: 헌화비 칸을 '전부 묶음 + 따로 사는 풀이 넷' 목록으로 바꾸며 단일 결제 버튼 문구 제거
  '내 인생을 바꿀 6단계 기밀 포트폴리오 열람하기 🐾',
  // 결제대행사 심사 대비 (2026-10-13): 효과 장담('보험', '보증', '차단', '영구')·사람 상담으로 보일 '1:1' 표현을 판매 문구에서 순화
  '1998년 겨울 강원도 영월 산자락 외딴 흙집 지박령의 1:1 맞춤형 인생 돌파 비방록',
  '망설이다 날아갈 3년 치 피 같은 돈과 멘탈을 생각하면, 이 복채는 네 인생 가장 싼 보험이다.',
  '지박령이 보증하는 1:1 맞춤형 인생 기밀 지침서',
  // 개 소리 표현 순화 (2026-10-13)
  '⚠️ 지박령이 낮게 으르렁거립니다...',
  // 꿈 뒤 조사 '을(를)' → 받침에 맞게 '을'/'를' (문장은 그대로, 2026-10-12)
  ']을(를) 품은 네 가슴속 불길이 내 털끝을 태우는구나.',
  ']을(를) 향한 핵심 기술과 역량을 칼처럼 벼려내라. 상반기엔 조용히 내실을 다지고 하반기부터 판을 벌려라.',
  ']을(를) 향해 갈 때 네 성과를 낚아채고 혓바닥으로 네 칼을 갈던 인간들의 썩은 내가 보인다. 네 칼날을 갈아 판을 뒤엎을',
  ']을(를) 향해 달리면서 유독 피로하고 지쳤던 이유는 능력이 부족해서가 아니다.',
  // 사람마다 다르게 (사용자 요청 2026-10-12 21:57): 재물 방위는 재성 오행 방위로, 물건 조사는 받침에 맞게
  ': 잠잘 때 머리를 [',
  '] 방향으로 두고, 작업 책상 위에 [',
  ']을(를) 두어 재물의 살을 튕겨내라.',
  // 심리 투시 고정 100% → 사주로 계산한 값
  '심리 투시 100%',
  // 설화(1998년 겨울에 지박령이 됨)와 시간이 어긋나 사용자 요청으로 수정 (2026-10-12)
  '수백 년간 대문 앞을 지키며 검증된 벽사(辟邪) 비방과 소장용 디지털 황금 액막이 부적을 영구 제공한다.',
  '짓껄여도 귓등으로도 흘려듣지 마라. 이 문턱을 지키며 수백 년을 보았으나, 제 고집대로 밀어붙인 자만이 살아서 성채를 세웠다.',
  '⚠️ 안내: 현재 24절기 만세력 정밀 연산은 [양력] 기준으로 동작합니다.',
  '정확한 분석을 위해 가급적 양력 생년월일 입력을 권장합니다. (음력 자동변환은 절기 DB 업데이트 예정)',
  '음력', // → '음력 (준비 중)'
  // 판매 전환(2026-10-12, 사용자 결정 A): 실제 집계가 아닌 수치·기준 정가 취소선·매일 반복 마감은 표시·광고 문제 소지 → 이벤트 설정값(SALE) 표시로 교체
  '🕯️ 오늘 1,842명 액운 정화 완료',
  '⚡ 1인 청년·개발자 응원 특가',
  '정가 ₩19,900',
  '오늘 자정까지만 80% 할인 제공 (단 1회 열람 시 평생 소장)',
  '액막이 헌화비 ₩3,900',
  // 가격을 설정값에서 표시하도록 숫자만 <span class="sale-price">로 감쌈 (문장은 그대로)
  '커피 한 잔 값(3,900원)으로 3년 치 액운 차단',
  '정성 완료 시 봉인이 풀리고 6단계 퇴마 비밀 포트폴리오가 전체 공개됩니다.',
  '액막이 복채(3,900원) 정성 완료 시 봉인이 풀리고 6단계 퇴마 비밀 포트폴리오가 전체 공개됩니다.',
  // 표기 오류 수정 (2026-10-12): '6기둥'(실제는 글자 수), '[돼지띠(해)] 띠'(띠 중복)
  '기둥의 명조를 훑어보니',
  '] 띠의 인연이다. 네가 인생의 벼랑 끝에 몰려도 손가락질하지 않고 묵묵히 네 등을 받쳐줄 사람이며, 이 사람을 맞이하는 순간 막혀 있던 네 재물의 수문이 함께 터진다.',
  // 사랑의 냄새를 리포트 천생연분 체취와 일치 — 원래 '맑은 솔잎 흙내'는 목(木) 유형 값으로 보존
  '이었을 것이다. 달콤한 향수 뒤에 숨겨진 곰팡이 냄새... 하지만 너를 평생 지켜줄 맑은 솔잎 흙내를 풍기는 [',
  // 복사에 실패해도 '복사 완료'라고 알리던 오류 메시지 (2026-10-12): 실패 시 직접 복사 창을 띄우도록 변경
  '📋 요약문 복사 완료! 🐾',
  '🔗 링크 복사 완료!',
  // 디자인 개편(2026-10-12): 옛 CSS 파일 머리의 개발용 설명 주석 (화면에 나오지 않음)
  '- !important 남발 및 중복 셀렉터 완전 제거',
  '- 모바일 반응형 (320px ~ 460px) 최적화',
  '- 전통 한지 명식지 테마 (가독성 100% 보장)',
  '벽사신견(辟邪神犬) 사주 - 통합 디자인 시스템 (CSS Design System)',
].map(norm);

function currentFragments() {
  const files = ['site/index.html', 'site/js/app.js', 'site/js/saju-core.js', 'site/css/style.css'].map(f => path.join(ROOT, f));
  const out = execFileSync('python3', ['-I', path.join(ROOT, 'tools/extract_texts.py'), ...files], { encoding: 'utf8' });
  return JSON.parse(out);
}

test('기준 문구가 모두 남아 있다 (연도·간지 차이, 허용 목록, 코드 주석 제외)', () => {
  const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/baseline/texts_gemini_standalone.json'), 'utf8'));
  const cur = currentFragments();
  const curNorm = new Set(cur.map(norm));
  const curJoined = cur.map(norm).join('\n');
  const isDevComment = s => /^(\/\/|\*|\/\*)/.test(s.trim()); // 화면에 나오지 않는 코드 주석은 보존 대상 아님
  // "2. 문장", "제목: 내용"처럼 번호·제목과 문장이 데이터로 분리 저장된 경우를 위해, 번호를 떼고 ': ' 기준으로 나눈 각 문장이 모두 있는지 본다
  const parts = s => s.split(/:\s+/).map(x => norm(x.replace(/^[\s:•·\-]*(\d+\.\s*)?/, ''))).filter(x => /[가-힣].*[가-힣]/.test(x));
  const lost = base.filter(s => {
    if (isDevComment(s)) return false;
    const n = norm(s);
    if (curNorm.has(n) || curJoined.includes(n) || ALLOWED_REMOVED.includes(n)) return false;
    return !parts(s).every(x => curJoined.includes(x));
  });
  assert.deepEqual(lost, [], `사라진 문구 ${lost.length}개:\n` + lost.join('\n'));
});

test('전체 한글 글자 수가 기준보다 줄지 않았다', () => {
  const count = arr => arr.reduce((n, s) => n + (s.match(/[가-힣]/g) || []).length, 0);
  const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/baseline/texts_gemini_standalone.json'), 'utf8'));
  const cur = currentFragments();
  assert.ok(count(cur) >= count(base), `기준 ${count(base)}자 → 현재 ${count(cur)}자`);
});

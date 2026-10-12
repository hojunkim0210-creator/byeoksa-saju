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
const norm = s => s
  .replace(/\d{4}/g, 'YYYY')
  .replace(new RegExp(`[${GANJI}][${ZHI}](?=년|·|\\))`, 'g'), 'GG')
  .replace(/[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/g, 'GG')
  .replace(/\s+/g, ' ').trim();

// 의도적으로 바꾼 문구 (기능 변경에 따른 안내문) — 여기 없는 손실은 실패
const ALLOWED_REMOVED = [
  '⚠️ 안내: 현재 24절기 만세력 정밀 연산은 [양력] 기준으로 동작합니다.',
  '정확한 분석을 위해 가급적 양력 생년월일 입력을 권장합니다. (음력 자동변환은 절기 DB 업데이트 예정)',
  '음력', // → '음력 (준비 중)'
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

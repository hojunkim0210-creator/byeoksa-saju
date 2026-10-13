// HTML·JS에서 쓰는 클래스가 CSS에 모두 정의돼 있는지 (스타일 유실 사고 재발 방지)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path');
const SITE = path.resolve(__dirname, '../../site');
const read = p => fs.readFileSync(path.join(SITE, p), 'utf8');

// 상태·조합용으로 다른 셀렉터 안에서만 쓰이는 클래스 (단독 정의가 필요 없음)
const ALLOW = new Set(['wood', 'fire', 'earth', 'metal', 'water', 'current-daeun', 'active', 'yr-roadmap', 'yr-peak']);

test('사용 중인 모든 클래스에 CSS 정의가 있다', () => {
  const css = read('css/style.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const defined = new Set((css.replace(/\{[^}]*\}/g, '{}').match(/\.[a-zA-Z][\w-]*/g) || []).map(s => s.slice(1)));
  const used = new Set();
  const sources = ['index.html', 'legal.html', 'js/app.js', 'js/extras.js', 'js/shop.js'].map(read);
  for (const src of sources) {
    for (const m of src.matchAll(/class=\\?"([^"$`{\\]+)\\?"/g)) m[1].split(/\s+/).filter(Boolean).forEach(c => used.add(c));
    for (const m of src.matchAll(/classList\.(?:add|toggle|remove)\('([\w-]+)'/g)) used.add(m[1]);
  }
  const missing = [...used].filter(c => !defined.has(c) && !ALLOW.has(c)).sort();
  assert.deepEqual(missing, [], `CSS 정의가 없는 클래스: ${missing.join(', ')}`);
});

test('화면 단계 틀(.view-step)이 세로 배치로 정의돼 있다', () => {
  const css = read('css/style.css');
  assert.match(css, /\.view-step\s*\{[^}]*flex-direction:\s*column/);
});

test('index.html이 네 파일 구조를 참조한다', () => {
  const html = read('index.html');
  for (const ref of ['css/style.css', 'js/saju-core.js', 'js/app.js']) assert.ok(html.includes(ref), ref);
  assert.ok(!/data:image\/[a-z]+;base64/.test(html), 'base64 이미지 내장 금지');
});

test('대문 바닥글의 약관 링크가 legal.html의 실제 절을 가리킨다', () => {
  const html = read('index.html'), legal = read('legal.html');
  const anchors = [...html.matchAll(/href="legal\.html#([\w-]+)"/g)].map(m => m[1]);
  assert.ok(anchors.length >= 3, '바닥글 약관 링크가 3개 이상이어야 함');
  for (const a of anchors) assert.ok(legal.includes(`id="${a}"`), `legal.html에 #${a} 절이 없음`);
  for (const must of ['오락 콘텐츠', '청약철회', '브라우저 저장소', 'Google Fonts', '사업자등록번호']) assert.ok(legal.includes(must), must);
});

test('결제창에 청약철회 제한 안내가 있다 (전자상거래법 17조 6항 표시 의무)', () => {
  const html = read('index.html');
  const modal = html.slice(html.indexOf('id="paymentModal"'));
  assert.match(modal.slice(0, 2000), /청약철회/);
});

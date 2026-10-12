// 확장 기능(궁합·오늘의 운세·타로) 계산 테스트
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../site/js/saju-core.js');

const four = (y, m, d, h = null) => C.calculateFourPillars(y, m, d, h);
const gz = i => C.STEMS[i.stemIdx].char + C.BRANCHES[i.branchIdx].char;

test('일진: 알려진 날짜와 일치 (2024-01-01 갑자, 2026-10-12 기미)', () => {
  assert.equal(gz(C.getDayPillarIdx(2024, 1, 1)), '갑자');
  assert.equal(gz(C.getDayPillarIdx(2026, 10, 12)), '기미');
});

test('오행 관계: 목→화 생, 목→토 극, 반대 방향, 같음', () => {
  assert.equal(C.elementRelation('wood', 'fire'), 'generates');
  assert.equal(C.elementRelation('fire', 'wood'), 'generatedBy');
  assert.equal(C.elementRelation('wood', 'earth'), 'controls');
  assert.equal(C.elementRelation('earth', 'wood'), 'controlledBy');
  assert.equal(C.elementRelation('metal', 'metal'), 'same');
});

test('지지 관계: 자축 육합, 신자 삼합, 자오 충', () => {
  assert.equal(C.branchRelation(0, 1).yukhap, true);
  assert.equal(C.branchRelation(8, 0).samhap, true);
  assert.equal(C.branchRelation(0, 6).chung, true);
  assert.deepEqual(C.branchRelation(0, 0), { yukhap: false, samhap: false, chung: false });
});

test('궁합: 순서를 바꿔도 점수가 같고 35~98 범위', () => {
  const people = [[2002, 10, 4], [1990, 3, 10, 6], [1985, 7, 22, 2], [1972, 1, 15, 9], [1999, 8, 18, 8]];
  for (const a of people) for (const b of people) {
    const pa = four(...a), pb = four(...b);
    const s1 = C.calculateCompatibility(pa, pb, C.calculateOheng(pa), C.calculateOheng(pb)).score;
    const s2 = C.calculateCompatibility(pb, pa, C.calculateOheng(pb), C.calculateOheng(pa)).score;
    assert.equal(s1, s2); assert.ok(s1 >= 35 && s1 <= 98);
  }
});

test('궁합: 천간합(갑기)이면 가산 근거가 붙는다', () => {
  // 일간이 갑(甲)과 기(己)인 두 날짜를 찾아 비교
  const find = stem => { for (let d = 1; d <= 31; d++) { const p = four(2000, 1, d); if (p.dStemIdx === stem) return p; } };
  const a = find(0), b = find(5);
  const r = C.calculateCompatibility(a, b, C.calculateOheng(a), C.calculateOheng(b));
  assert.ok(r.parts.some(p => p.key === 'stemHap' && p.points > 0));
});

test('오늘의 운세: 같은 사람·같은 날이면 같은 결과, 30~97 범위', () => {
  const me = four(2002, 10, 4);
  const a = C.calculateDailyFortune(me, 2026, 10, 12), b = C.calculateDailyFortune(me, 2026, 10, 12);
  assert.deepEqual(a, b);
  assert.equal(a.dayStem.char + a.dayBranch.char, '기미');
  for (let d = 1; d <= 31; d++) { const s = C.calculateDailyFortune(me, 2026, 12, d).score; assert.ok(s >= 30 && s <= 97); }
});

test('타로: 같은 날 같은 패, 22장 고르게 분포, 역방향 약 30%', () => {
  assert.deepEqual(C.drawDailyTarot('k', 2026, 10, 12, 22), C.drawDailyTarot('k', 2026, 10, 12, 22));
  const seen = new Array(22).fill(0); let rev = 0, n = 0;
  for (let y = 2020; y <= 2030; y++) for (let m = 1; m <= 12; m++) for (let d = 1; d <= 28; d++) {
    const r = C.drawDailyTarot('person', y, m, d, 22); seen[r.index]++; if (r.reversed) rev++; n++;
  }
  assert.ok(seen.every(c => c > n / 22 * 0.7), `분포 ${seen}`);
  assert.ok(rev / n > 0.25 && rev / n < 0.35, `역방향 비율 ${(rev / n).toFixed(2)}`);
});

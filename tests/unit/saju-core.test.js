// 만세력 코어 단위 테스트 — 브라우저 없이 node --test 로 실행
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../site/js/saju-core.js');

const pillar = (s, b) => s.char + b.char;
const four = (y, m, d, h = null) => C.calculateFourPillars(y, m, d, h);

test('일주: 알려진 갑자일·무오일과 일치', () => {
  assert.equal(pillar(four(1949, 10, 1).dStem, four(1949, 10, 1).dBranch), '갑자');
  assert.equal(pillar(four(2024, 1, 1).dStem, four(2024, 1, 1).dBranch), '갑자');
  assert.equal(pillar(four(2000, 1, 1).dStem, four(2000, 1, 1).dBranch), '무오');
});

// 한국천문연구원 공표값(공공데이터포털 특일 정보, KST) — 12절(節)
const KASI = {
  2026: ['01-05 17:23', '02-04 05:02', '03-05 22:59', '04-05 03:40', '05-05 20:49', '06-06 00:48',
         '07-07 10:57', '08-07 20:43', '09-07 23:41', '10-08 15:29', '11-07 18:52', '12-07 11:53'],
  2027: ['01-05 23:10', '02-04 10:46', '03-06 04:40', '04-05 09:17', '05-06 02:25', '06-06 06:26',
         '07-07 16:37', '08-08 02:27', '09-08 05:28', '10-08 21:17', '11-08 00:39', '12-07 17:38'],
};
test('절기표: 천문연구원 공표 시각과 ±1.5분 이내', () => {
  for (const [year, list] of Object.entries(KASI)) {
    list.forEach((s, idx) => {
      const [md, hm] = s.split(' '); const [mo, d] = md.split('-').map(Number); const [hh, mm] = hm.split(':').map(Number);
      const official = Date.UTC(+year, mo - 1, d, hh - 9, mm);
      const diffMin = Math.abs(C.getTermUtcMs(+year, idx) - official) / 60000;
      assert.ok(diffMin <= 1.5, `${year} ${C.TERM_NAMES[idx]} 오차 ${diffMin.toFixed(1)}분`);
    });
  }
});

test('절기표: 1900~2100년 전부 존재하고 간격이 29~32일', () => {
  let prev = null;
  for (let y = 1900; y <= 2100; y++) for (let i = 0; i < 12; i++) {
    const t = C.getTermUtcMs(y, i); assert.ok(t !== null);
    if (prev !== null) { const g = (t - prev) / 86400000; assert.ok(g > 29 && g < 32, `${y}-${i} 간격 ${g}`); }
    prev = t;
  }
});

test('연주: 입춘 절입 시각에서 해가 바뀜 (2026-02-04 05:02)', () => {
  const before = four(2026, 2, 4, 1);  // 축시 01:30~03:29
  const after = four(2026, 2, 4, 3);   // 묘시 05:30~07:29
  assert.equal(pillar(before.yStem, before.yBranch), '을사');
  assert.equal(pillar(after.yStem, after.yBranch), '병오');
  assert.equal(pillar(before.mStem, before.mBranch), '기축');
  assert.equal(pillar(after.mStem, after.mBranch), '경인');
});

test('연주: 입춘이 2월 5일인 해 (1984) 2월 4일생은 전년도', () => {
  const p = four(1984, 2, 4, 6);
  assert.equal(pillar(p.yStem, p.yBranch), '계해');
});

test('월주: 절기 날짜가 고정표와 다른 해 (1920-01-05는 소한 전이라 자월)', () => {
  const p = four(1920, 1, 5);
  assert.equal(p.mBranch.char, '자');
});

test('절입 경계: 출생 시진 안에 절입이 있으면 표시, 없으면 null', () => {
  const b = four(2026, 3, 5, 11); // 해시 21:30~23:29, 경칩 22:59
  assert.ok(b.termBoundary && b.termBoundary.name === '경칩');
  assert.equal(four(2026, 3, 5, 9).termBoundary, null); // 유시 17:30~19:29
  assert.ok(four(2026, 3, 5, null).termBoundary);       // 시간 모름 → 그날 하루 전체
});

test('대운수: 순행=다음 절기까지, 역행=직전 절기부터 (÷3, 반올림)', () => {
  const p = four(1990, 3, 10, 6);
  const male = C.calculateDaeun(1990, 3, 10, 'M', p.yStemIdx, p.mStemIdx, p.mBranchIdx, p.dStemIdx, p);
  const female = C.calculateDaeun(1990, 3, 10, 'F', p.yStemIdx, p.mStemIdx, p.mBranchIdx, p.dStemIdx, p);
  assert.equal(male.isForward, true);   // 경오년(양) 남성 → 순행
  assert.equal(male.daeunNum, 9);       // 다음 절기(청명)까지 약 26일
  assert.equal(female.isForward, false);
  assert.equal(female.daeunNum, 1);     // 직전 절기(경칩)부터 약 4일
  const gap = (p.nextTerm.utcMs - p.prevTerm.utcMs) / 86400000;
  assert.ok(Math.abs(male.daeunDays + female.daeunDays - gap) < 1e-6);
});

test('서울 역사 표준시: 1958년 UTC+8:30(+서머타임), 1988년 서머타임, 현행 UTC+9', () => {
  assert.equal(C.seoulOffsetMinutes(C.seoulLocalToUtc(1958, 1, 15, 12, 0)), 510);
  assert.equal(C.seoulOffsetMinutes(C.seoulLocalToUtc(1958, 6, 15, 12, 0)), 570);
  assert.equal(C.seoulOffsetMinutes(C.seoulLocalToUtc(1988, 7, 1, 12, 0)), 600);
  assert.equal(C.seoulOffsetMinutes(C.seoulLocalToUtc(2026, 10, 12, 12, 0)), 540);
});

test('월주: 1920~2030 매일 정오 기준으로 월지가 순서대로만 바뀜', () => {
  let prev = null, changes = 0;
  for (let t = Date.UTC(1920, 0, 1); t <= Date.UTC(2030, 11, 31); t += 86400000) {
    const d = new Date(t); const p = four(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), 6);
    if (prev !== null && p.mBranchIdx !== prev) { assert.equal(p.mBranchIdx, (prev + 1) % 12); changes++; }
    prev = p.mBranchIdx;
  }
  assert.equal(changes, 111 * 12); // 1920 소한 ~ 2030 대설 전부 범위 안
});

test('십신: 일간과 같은 천간은 비견', () => {
  for (let i = 0; i < 10; i++) assert.equal(C.getSipsin(i, i), '비견');
});

// 음력 → 양력 바꾸기 검사 (업데이트 44, 2026-11-09 대표님 "음력도 추가했으면 좋겠어")
//   기준: 한국천문연구원 천문우주지식정보 '음양력 변환'(https://astro.kasi.re.kr/life/pageView/8)에서 2026-11-09에 받은 자료.
//   ① 음력 1920~2030년 모든 달(평달 1,332 + 윤달 40)의 첫날·날수 — tests/unit/kasi-lunar-1920-2030.json
//   ② 날짜를 하나씩 물어 받은 48개(윤달 23·음력 12월생이 양력 새해로 넘어감 6·입춘 근처 6·큰달 30일·범위 끝·평범한 날 13)와 그날 일진
//   한국과 중국 음력이 다른 해(2012년 한국 윤3월·중국 윤4월, 2017년 한국 윤5월·중국 윤6월)는 한국 기준이어야 한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const S = require('../../site/js/saju-core.js');
const KASI = require('./kasi-lunar-1920-2030.json').years;

const ymd = s => (s.error ? s.error : `${s.y}-${String(s.m).padStart(2, '0')}-${String(s.d).padStart(2, '0')}`);
const addDays = (iso, n) => { const t = new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000); return t.toISOString().slice(0, 10); };

test('천문연구원 1920~2030년 모든 달: 음력 1월 1일의 양력 날짜·달마다 날수·윤달이 표와 같고, 모든 달의 첫날도 맞는다', () => {
  let months = 0;
  const leaps = [];
  for (let y = S.LUNAR_FIRST_YEAR; y <= S.LUNAR_LAST_YEAR; y++) {
    const [start, lens, leapMonth, leapLen] = KASI[y];
    assert.equal(S.lunarLeapMonth(y), leapMonth, `${y}년 윤달`);
    if (leapMonth) leaps.push(`${y}:${leapMonth}`);
    let first = `${y}-${start}`;   // 천문연구원 자료로 다음 달 첫날을 이어서 센다
    for (let m = 1; m <= 12; m++) {
      for (const leap of (m === leapMonth ? [false, true] : [false])) {
        const len = leap ? leapLen : (lens[m - 1] === '1' ? 30 : 29);
        assert.equal(ymd(S.lunarToSolar(y, m, 1, leap)), first, `${y}년 ${leap ? '윤' : ''}${m}월 1일`);
        assert.equal(S.lunarMonthDays(y, m, leap), len, `${y}년 ${leap ? '윤' : ''}${m}월 날수`);
        assert.equal(ymd(S.lunarToSolar(y, m, len, leap)), addDays(first, len - 1), `${y}년 ${leap ? '윤' : ''}${m}월 마지막 날`);
        first = addDays(first, len); months++;
      }
    }
    if (y < S.LUNAR_LAST_YEAR) assert.equal(first, `${y + 1}-${KASI[y + 1][0]}`, `${y}년 섣달 다음 날 = ${y + 1}년 설날`);
  }
  assert.equal(months, 1372);
  assert.equal(leaps.length, 40);
  assert.ok(leaps.includes('2012:3') && leaps.includes('2017:5'), '한국 기준 윤달(2012 윤3월·2017 윤5월)');
});

// 천문연구원에 하나씩 물어 받은 날짜: [음력 년, 월, 일, 윤달, 양력, 그날 일진, 고른 까닭]
const PICKS = [
  [1922, 5, 1, true, '1922-06-25', '갑자', '윤달'],
  [1941, 6, 15, true, '1941-08-07', '정해', '윤달'],
  [1955, 3, 10, true, '1955-05-01', '임술', '윤달'],
  [1957, 8, 1, true, '1957-09-24', '기해', '윤달'],
  [1966, 3, 29, true, '1966-05-19', '무인', '윤달'],
  [1976, 8, 20, true, '1976-10-13', '무술', '윤달'],
  [1984, 10, 1, true, '1984-11-23', '신유', '윤달'],
  [1987, 6, 29, true, '1987-08-23', '갑진', '윤달'],
  [1990, 5, 5, true, '1990-06-27', '계해', '윤달'],
  [1993, 3, 3, true, '1993-04-24', '을해', '윤달'],
  [1995, 8, 15, true, '1995-10-09', '계유', '윤달'],
  [1998, 5, 1, true, '1998-06-24', '임인', '윤달'],
  [2001, 4, 9, true, '2001-05-31', '갑오', '윤달'],
  [2004, 2, 1, true, '2004-03-21', '기해', '윤달'],
  [2006, 7, 7, true, '2006-08-30', '신묘', '윤달'],
  [2009, 5, 25, true, '2009-07-17', '계해', '윤달'],
  [2012, 3, 1, true, '2012-04-21', '임자', '윤달'],
  [2014, 9, 9, true, '2014-11-01', '병자', '윤달'],
  [2017, 5, 1, true, '2017-06-24', '임오', '윤달'],
  [2020, 4, 8, true, '2020-05-30', '계유', '윤달'],
  [2023, 2, 1, true, '2023-03-22', '기묘', '윤달'],
  [2025, 6, 1, true, '2025-07-25', '을미', '윤달'],
  [2028, 5, 1, true, '2028-06-23', '기묘', '윤달'],
  [1920, 12, 1, false, '1921-01-09', '임신', '12월생 새해'],
  [1959, 12, 27, false, '1960-01-25', '임자', '12월생 새해'],
  [1970, 12, 20, false, '1971-01-16', '신축', '12월생 새해'],
  [1993, 12, 12, false, '1994-01-23', '기유', '12월생 새해'],
  [1999, 12, 25, false, '2000-01-31', '무자', '12월생 새해'],
  [2008, 12, 29, false, '2009-01-24', '기사', '12월생 새해'],
  [1960, 1, 8, false, '1960-02-04', '임술', '입춘 근처'],
  [1985, 12, 26, false, '1986-02-04', '기묘', '입춘 근처'],
  [1996, 12, 27, false, '1997-02-04', '정축', '입춘 근처'],
  [2007, 12, 28, false, '2008-02-04', '갑술', '입춘 근처'],
  [2020, 12, 22, false, '2021-02-03', '임오', '입춘 근처'],
  [1974, 12, 25, false, '1975-02-05', '임오', '입춘 근처'],
  [1920, 1, 1, false, '1920-02-20', '무신', '그 밖'],
  [2000, 2, 30, false, '2000-04-04', '임진', '그 밖'],
  [1994, 2, 30, false, '1994-04-10', '병인', '그 밖'],
  [2030, 12, 29, false, '2031-01-22', '임술', '그 밖'],
  [2030, 1, 1, false, '2030-02-03', '기사', '그 밖'],
  [1950, 1, 1, false, '1950-02-17', '계미', '그 밖'],
  [1945, 8, 15, false, '1945-09-20', '임진', '그 밖'],
  [1972, 7, 15, false, '1972-08-23', '병술', '그 밖'],
  [1980, 8, 15, false, '1980-09-23', '기해', '그 밖'],
  [2002, 10, 4, false, '2002-11-08', '경진', '그 밖'],
  [2026, 1, 1, false, '2026-02-17', '임술', '그 밖'],
  [2026, 8, 15, false, '2026-09-25', '임인', '그 밖'],
  [2027, 1, 1, false, '2027-02-07', '정사', '그 밖']
];

test('천문연구원에 하나씩 물어 받은 48개 날짜: 양력 날짜와 그날 일진(태어난 날 글자)이 맞는다', () => {
  assert.ok(PICKS.length >= 30);
  for (const [y, m, d, leap, solar, iljin, why] of PICKS) {
    const s = S.lunarToSolar(y, m, d, leap);
    assert.equal(ymd(s), solar, `음력 ${y}년 ${leap ? '윤' : ''}${m}월 ${d}일 (${why})`);
    const p = S.calculateFourPillars(s.y, s.m, s.d, null);
    assert.equal(p.dStem.char + p.dBranch.char, iljin, `양력 ${solar}의 일진 (${why})`);
  }
  for (const why of ['윤달', '12월생 새해', '입춘 근처']) assert.ok(PICKS.filter(p => p[6] === why).length >= 6, why);
});

test('바꿀 수 없는 음력 날짜는 까닭을 알려 준다 (화면은 이걸로 하오체 안내를 띄운다)', () => {
  assert.deepEqual(S.lunarToSolar(1995, 3, 1, true), { error: 'leap', leapMonth: 8 }, '1995년 윤달은 8월');
  assert.deepEqual(S.lunarToSolar(2024, 3, 1, true), { error: 'leap', leapMonth: 0 }, '2024년은 윤달 없음');
  assert.deepEqual(S.lunarToSolar(2017, 6, 1, true), { error: 'leap', leapMonth: 5 }, '2017년은 중국과 달리 윤6월이 없다');
  assert.deepEqual(S.lunarToSolar(2017, 5, 30, true), { error: 'day', days: 29 });
  assert.deepEqual(S.lunarToSolar(2017, 5, 30, false), { error: 'day', days: 29 });
  assert.deepEqual(S.lunarToSolar(2017, 5, 0, false), { error: 'day', days: 29 });
  assert.deepEqual(S.lunarToSolar(1919, 12, 1, false), { error: 'range' });
  assert.deepEqual(S.lunarToSolar(2031, 1, 1, false), { error: 'range' });
  assert.deepEqual(S.lunarToSolar(1990, 13, 1, false), { error: 'month' });
  assert.deepEqual(S.lunarToSolar(1990, 0, 1, false), { error: 'month' });
  assert.equal(S.lunarMonthDays(2024, 3, true), 0);
  assert.equal(S.lunarLeapMonth(1919), 0);
});

test('음력 표를 옮겨 온 출처와 MIT 허가문이 saju-core.js에 남아 있다', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../../site/js/saju-core.js'), 'utf8');
  assert.ok(src.includes('korean-lunar-calendar 0.3.6'));
  assert.ok(src.includes('Copyright (c) 2022 Jinil Lee'));
  assert.ok(src.includes('Permission is hereby granted, free of charge'));
  assert.ok(src.includes('THE SOFTWARE IS PROVIDED "AS IS"'));
});

// 음력 생일 입력 (업데이트 44, 2026-11-09 대표님 "음력도 추가했으면 좋겠어")
//   입력 화면과 궁합·오늘의 운세(묻기·신년운세도 같은 입력 조각) 칸에서 음력(윤달 포함)을 받아
//   한국천문연구원 기준 음력 표로 양력으로 바꿔 계산한다. 첫 카드 위에 "음력 ○년 ○월 ○일을 양력 ○년 ○월 ○일로 보았소." 한 줄.
//   없는 날짜·없는 윤달은 하오체 안내로 막는다. 바꾼 날짜 자체는 tests/unit/lunar.test.js가 천문연구원 자료와 맞춰 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium, openPage, SITE } = require('./helpers');

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

const consoleErrors = page => page._console.filter(t => !/^Failed to load resource|^Fetch API cannot load file:\/\/\/api\//.test(t));

/** 입력 화면에서 넣고 풀이 보기 → 보이는 화면·확인 한 줄·본문(확인 한 줄 뺀 것)·알림 */
async function submit(page, { y, m, d, cal = 'solar', leap = false, gender = 'F', hour = '-1' }) {
  await page.evaluate(() => { document.getElementById('introGateModal').style.display = 'none'; goToStep(2); });
  await page.fill('#year', String(y)); await page.fill('#month', String(m)); await page.fill('#day', String(d));
  await page.selectOption('#hourSelect', hour); await page.selectOption('#gender', gender);
  await page.selectOption('#calendarType', cal);
  if (cal === 'lunar') await page.setChecked('#leapMonth', !!leap);
  await page.evaluate(() => submitAndGoToResult()); await page.waitForTimeout(300);
  return page.evaluate(() => ({
    view: [...document.querySelectorAll('.app-container > .view-step')].find(v => v.style.display !== 'none').id,
    note: document.getElementById('lunarNote').hidden ? null : document.getElementById('lunarNote').textContent,
    tag: document.getElementById('animalTag').textContent,
    body: (() => { const c = document.getElementById('viewResult').cloneNode(true); c.querySelector('#lunarNote').remove(); return c.innerText; })()
  }));
}

test('입력 화면: 음력 1993년 12월 12일은 양력 1994년 1월 23일과 똑같은 풀이이고, 첫 카드 위에 확인 한 줄이 나온다', async () => {
  const { ctx, page } = await openPage(browser);
  assert.equal(await page.isVisible('#leapWrap'), false, '양력일 때 윤달 칸은 숨긴다');
  const L = await submit(page, { y: 1993, m: 12, d: 12, cal: 'lunar', hour: '6' });
  assert.equal(L.view, 'viewResult');
  assert.equal(L.note, '음력 1993년 12월 12일을 양력 1994년 1월 23일로 보았소.');
  assert.match(L.tag, /기유/, '태어난 날 기유(천문연구원 일진)');
  const prof = await page.evaluate(() => JSON.parse(localStorage.getItem('byeoksa.profile.v1')));
  assert.deepEqual(prof, { y: 1994, m: 1, d: 23, hour: 6, gender: 'F', lunar: { y: 1993, m: 12, d: 12, leap: false } }, '양력으로 저장하고 음력은 곁에');
  // 결제 뒤 돌아오기(휴대폰 결제 페이지) — 음력으로 넣은 손님은 음력 그대로 다시 넣어 같은 풀이·같은 한 줄
  await page.evaluate(() => {
    const sd = currentSajuData; goToStep(2); setCalendarInput(null); document.getElementById('year').value = '';
    PRODUCT_HOOKS.report.resume({ y: sd.y, m: sd.m, d: sd.d, hourVal: sd.hourVal, genderVal: sd.genderVal, userJob: '', userMajor: '', userHobby: '', userDream: '', lunar: sd.lunar });
  });
  await page.waitForTimeout(300);
  assert.equal(await page.textContent('#lunarNote'), L.note);
  assert.equal(await page.evaluate(() => document.getElementById('calendarType').value), 'lunar');
  assert.deepEqual(page._errors, []); assert.deepEqual(consoleErrors(page), []);
  await ctx.close();

  const r = await openPage(browser);
  const S = await submit(r.page, { y: 1994, m: 1, d: 23, hour: '6' });
  assert.equal(S.note, null, '양력으로 넣으면 확인 한 줄은 없다');
  assert.equal(L.body, S.body, '음력으로 넣어도 바꾼 양력 날짜와 풀이가 같아야 한다');
  await r.ctx.close();
});

test('윤달: 2017년 윤5월 1일 = 양력 6월 24일(임오), 평5월 1일 = 양력 5월 26일(계축) — 한국 기준(중국은 그해 윤6월)', async () => {
  const { ctx, page } = await openPage(browser);
  const a = await submit(page, { y: 2017, m: 5, d: 1, cal: 'lunar', leap: true, gender: 'M' });
  assert.equal(a.note, '음력 2017년 윤5월 1일을 양력 2017년 6월 24일로 보았소.');
  assert.match(a.tag, /임오/);
  const b = await submit(page, { y: 2017, m: 5, d: 1, cal: 'lunar', gender: 'M' });
  assert.equal(b.note, '음력 2017년 5월 1일을 양력 2017년 5월 26일로 보았소.');
  assert.match(b.tag, /계축/);
  assert.deepEqual(page._errors, []); assert.deepEqual(consoleErrors(page), []);
  await ctx.close();
});

test('없는 윤달·없는 날짜는 하오체 안내로 막고 입력 화면에 머문다', async () => {
  const cases = [
    [{ y: 1995, m: 3, d: 1, leap: true }, "음력 1995년에는 윤3월이 없소. 그해 윤달은 8월이오. '윤달' 표시를 다시 확인하시오."],
    [{ y: 2024, m: 3, d: 1, leap: true }, "음력 2024년에는 윤달이 없소. '윤달' 표시를 빼고 다시 고하시오."],
    [{ y: 2017, m: 5, d: 30, leap: true }, '음력 2017년 윤5월은 29일까지만 있소. 날짜를 다시 확인하시오.'],
    [{ y: 2017, m: 5, d: 30 }, '음력 2017년 5월은 29일까지만 있소. 날짜를 다시 확인하시오.']
  ];
  for (const [v, msg] of cases) {
    const { ctx, page } = await openPage(browser);
    const r = await submit(page, { ...v, cal: 'lunar' });
    assert.equal(r.view, 'viewInput', JSON.stringify(v));
    assert.deepEqual(page._alerts, [msg]);
    await ctx.close();
  }
  // 음력 30일이 있는 큰달은 받는다 (2000년 2월은 30일까지)
  const { ctx, page } = await openPage(browser);
  const ok = await submit(page, { y: 2000, m: 2, d: 30, cal: 'lunar' });
  assert.equal(ok.note, '음력 2000년 2월 30일을 양력 2000년 4월 4일로 보았소.');
  // 양력은 예전처럼 달력에 없는 날을 막는다
  const bad = await submit(page, { y: 2000, m: 2, d: 30 });
  assert.equal(bad.view, 'viewInput');
  assert.ok(page._alerts.some(a => a.includes('존재하지 않는 날짜')));
  await ctx.close();
});

test("양력으로 되돌리면 윤달 칸이 숨고 표시가 지워진다 · 새로 열고 '내 사주'를 누르면 음력 그대로 채워진다 · 결과 링크는 늘 양력", async () => {
  const { ctx, page } = await openPage(browser);
  await page.evaluate(() => { document.getElementById('introGateModal').style.display = 'none'; goToStep(2); });
  await page.selectOption('#calendarType', 'lunar');
  assert.equal(await page.isVisible('#leapWrap'), true);
  await page.check('#leapMonth');
  await page.selectOption('#calendarType', 'solar');
  assert.equal(await page.isVisible('#leapWrap'), false);
  assert.equal(await page.isChecked('#leapMonth'), false);
  await submit(page, { y: 2020, m: 4, d: 8, cal: 'lunar', leap: true });
  await page.reload(); await page.waitForTimeout(300);
  await page.evaluate(() => { document.getElementById('introGateModal').style.display = 'none'; openMySaju(); });
  const f = await page.evaluate(() => ({ y: year.value, m: month.value, d: day.value, cal: calendarType.value, leap: leapMonth.checked, shown: !leapWrap.hidden }));
  assert.deepEqual(f, { y: '2020', m: '4', d: '8', cal: 'lunar', leap: true, shown: true });
  await ctx.close();

  const r = await openPage(browser, { url: 'file://' + SITE + '?y=2020&m=5&d=30&g=F' });
  const v = await r.page.evaluate(() => ({ cal: calendarType.value, note: lunarNote.hidden }));
  assert.deepEqual(v, { cal: 'solar', note: true }, '결과 링크의 날짜는 양력');
  await r.ctx.close();
});

test('궁합·오늘의 운세 입력 조각도 음력(윤달)을 받는다', async () => {
  const { ctx, page } = await openPage(browser);
  await page.evaluate(() => { document.getElementById('introGateModal').style.display = 'none'; openFeature('compat'); });
  await page.fill('#caY', '1993'); await page.fill('#caM', '12'); await page.fill('#caD', '12'); await page.selectOption('#caC', 'lunar');
  assert.equal(await page.isVisible('#caLWrap'), true);
  await page.fill('#cbY', '2020'); await page.fill('#cbM', '4'); await page.fill('#cbD', '15'); await page.selectOption('#cbC', 'lunar'); await page.check('#cbL'); await page.selectOption('#cbG', 'M');
  await page.fill('#caName', '민지'); await page.fill('#cbName', '준석');
  await page.click('#compatGo'); await page.waitForTimeout(300);
  const notes = await page.evaluate(() => [...document.querySelectorAll('#compatResult .birth-note')].map(e => e.textContent));
  assert.deepEqual(notes, ['민지 — 음력 1993년 12월 12일을 양력 1994년 1월 23일로 보았소.', '준석 — 음력 2020년 윤4월 15일을 양력 2020년 6월 6일로 보았소.']);
  const lunarScore = await page.textContent('#compatResult .score-num');
  await page.fill('#cbD', '30'); await page.click('#compatGo'); await page.waitForTimeout(200);
  assert.equal(await page.textContent('#compatErr'), '상대: 음력 2020년 윤4월은 29일까지만 있소. 날짜를 다시 확인하시오.');
  // 같은 두 사람을 양력으로 넣으면 점수가 같다
  await page.evaluate(() => openFeature('compat'));
  await page.selectOption('#caC', 'solar'); await page.fill('#caY', '1994'); await page.fill('#caM', '1'); await page.fill('#caD', '23');
  await page.fill('#cbY', '2020'); await page.fill('#cbM', '6'); await page.fill('#cbD', '6'); await page.selectOption('#cbG', 'M');
  await page.click('#compatGo'); await page.waitForTimeout(300);
  assert.equal(await page.textContent('#compatResult .score-num'), lunarScore);
  assert.equal(await page.$$eval('#compatResult .birth-note', e => e.length), 0);

  // 저장된 생일이 없을 때 오늘의 운세 첫 입력 칸
  await page.evaluate(() => { localStorage.removeItem('byeoksa.profile.v1'); openFeature('daily'); });
  await page.fill('#pfY', '1985'); await page.fill('#pfM', '11'); await page.fill('#pfD', '14'); await page.selectOption('#pfC', 'lunar');
  await page.click('#pfGo'); await page.waitForTimeout(300);
  const line = await page.textContent('#viewDaily .profile-line');
  assert.match(line, /^1985\. 12\. 25\. \(음력 1985\. 11\. 14\.\)/);
  const prof = await page.evaluate(() => JSON.parse(localStorage.getItem('byeoksa.profile.v1')));
  assert.deepEqual(prof.lunar, { y: 1985, m: 11, d: 14, leap: false });
  assert.deepEqual(page._errors, []); assert.deepEqual(consoleErrors(page), []);
  await ctx.close();
});

test("밤 자시: '밤 자시 (23:30 ~ 24:00 · 다음 날로 셈)'를 고르면 다음 날 자시로 계산하고 확인 줄을 쓴다 (업데이트 44, 더블체크 2-1)", async () => {
  const { ctx, page } = await openPage(browser);
  const opts = await page.$$eval('#hourSelect option', o => o.map(x => x.textContent));
  assert.ok(opts.includes('자시 (밤 12:00 ~ 01:29)') && opts[opts.length - 1] === '밤 자시 (23:30 ~ 24:00 · 다음 날로 셈)');
  const a = await submit(page, { y: 2024, m: 3, d: 9, hour: '12' });
  assert.equal(a.note, '밤 11시 30분 넘어 태어나 다음 날(양력 2024년 3월 10일) 자시로 셈하였소.');
  assert.match(a.tag, /계유/, '더블체크 재현: 3월 9일 밤 11시 45분생은 계유일(3월 10일)');
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('byeoksa.profile.v1'))), { y: 2024, m: 3, d: 10, hour: 0, gender: 'F', late: true });
  await page.reload(); await page.waitForTimeout(300);
  await page.evaluate(() => { document.getElementById('introGateModal').style.display = 'none'; openMySaju(); });
  assert.deepEqual(await page.evaluate(() => ({ y: year.value, m: month.value, d: day.value, h: hourSelect.value })), { y: '2024', m: '3', d: '9', h: '12' }, "다시 열면 적은 날짜와 '밤 자시' 그대로");
  await ctx.close();

  const r = await openPage(browser);
  const b = await submit(r.page, { y: 2024, m: 3, d: 10, hour: '0' });
  assert.equal(b.note, null);
  assert.equal(a.body, b.body, '3월 10일 자시로 넣은 것과 같은 풀이');
  const c = await submit(r.page, { y: 2023, m: 12, d: 31, hour: '12' });
  assert.equal(c.note, '밤 11시 30분 넘어 태어나 다음 날(양력 2024년 1월 1일) 자시로 셈하였소.', '해 넘김');
  const e = await submit(r.page, { y: 1993, m: 12, d: 12, cal: 'lunar', hour: '12' });
  assert.equal(e.note, '음력 1993년 12월 12일을 양력 1994년 1월 23일로 보았고, 밤 11시 30분 넘어 태어나 다음 날(1월 24일) 자시로 셈하였소.');
  assert.deepEqual(r.page._errors, []); assert.deepEqual(consoleErrors(r.page), []);
  await r.ctx.close();
});

test('궁합 입력 칸: 시간에 시각이 붙고 밤 자시도 고를 수 있다 · 음력도 아직 오지 않은 날은 막는다 (업데이트 44, 더블체크 2-5·2-1·1-4)', async () => {
  const { ctx, page } = await openPage(browser);
  await page.evaluate(() => { document.getElementById('introGateModal').style.display = 'none'; openFeature('compat'); });
  const opts = await page.$$eval('#cbH option', o => o.map(x => x.textContent));
  assert.ok(opts.includes('축시 (01:30 ~ 03:29)') && opts.includes('해시 (21:30 ~ 23:29)') && opts.includes('밤 자시 (23:30 ~ 24:00 · 다음 날로 셈)'), opts.join(' / '));
  await page.fill('#caName', '민지');
  await page.fill('#caY', '1990'); await page.fill('#caM', '3'); await page.fill('#caD', '10'); await page.selectOption('#caH', '12');
  await page.fill('#cbY', '1985'); await page.fill('#cbM', '12'); await page.fill('#cbD', '25'); await page.selectOption('#cbG', 'M');
  await page.click('#compatGo'); await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#compatResult .birth-note')].map(e => e.textContent)),
    ['민지 — 밤 11시 30분 넘어 태어나 다음 날(양력 1990년 3월 11일) 자시로 셈하였소.']);
  await page.selectOption('#cbC', 'lunar'); await page.fill('#cbY', '2026'); await page.fill('#cbM', '12'); await page.fill('#cbD', '1');
  await page.click('#compatGo'); await page.waitForTimeout(200);
  assert.equal(await page.textContent('#compatErr'), '상대: 아직 오지 않은 날이오. 태어난 날을 다시 확인하시오.', '음력 2026-12-01 = 양력 2027년 (테스트 시계 2026-10-12)');
  assert.deepEqual(page._errors, []); assert.deepEqual(consoleErrors(page), []);
  await ctx.close();
});


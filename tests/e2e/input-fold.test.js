// 업데이트 48 (2026-11-13): 대문까지 온 손님이 무료 풀이로 안 넘어가서 — 입력 화면을 첫 화면 안으로.
//   ① 선택 칸 넷(일·전공·취미·꿈)은 접어 둔다(값이 있으면 펼침) ② 귀신 그림 주의 문구는 버튼 아래(문구 그대로)
//   ③ 대문 버튼 아래 한 줄 ④ '바로 입력' 주소 ?go=input — 대문을 건너뛰고 입력 화면부터(visit·direct·input 을 세고 home 은 안 센다)
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium, openPage, SITE } = require('./helpers');

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });
const viewOf = page => page.evaluate(() => [...document.querySelectorAll('.app-container > .view-step')].find(v => v.style.display !== 'none').id);
const toInput = page => page.evaluate(() => { document.getElementById('introGateModal').style.display = 'none'; document.getElementById('moreFields').open = false; goToStep(2); });
const SIZES = [[320, 568], [360, 640], [375, 667], [414, 736], [375, 812], [430, 932], [1440, 900]];

test("입력: '무료 풀이 보기' 버튼이 320×568부터 데스크톱까지 첫 화면 안에 있다(하단 메뉴에 가리지 않고) · 가로 넘침 없음", async () => {
  for (const [width, height] of SIZES) {
    const { ctx, page } = await openPage(browser, { width, height });
    await toInput(page); await page.waitForTimeout(150);
    const r = await page.evaluate(() => {
      const b = document.querySelector('#viewInput .btn-submit').getBoundingClientRect();
      const tab = document.getElementById('tabBar').getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, limit: Math.min(innerHeight, tab.top), ox: document.documentElement.scrollWidth - innerWidth, y: scrollY };
    });
    assert.equal(r.y, 0, `${width}×${height}: 스크롤 없이`);
    assert.ok(r.top >= 0 && r.bottom <= r.limit, `${width}×${height}: 버튼 아래끝 ${Math.round(r.bottom)} > 보이는 높이 ${Math.round(r.limit)}`);
    assert.ok(r.ox <= 0, `${width}×${height}: 가로 넘침 ${r.ox}`);
    await ctx.close();
  }
});

test('입력: 선택 칸 넷은 접혀 있고 누르면 펼쳐진다 · 값이 있으면 펼쳐서 보여 준다 · 접힌 채로도 풀이가 나온다', async () => {
  const { ctx, page } = await openPage(browser);
  await toInput(page);
  for (const id of ['userJob', 'userMajor', 'userHobby', 'userDream']) assert.equal(await page.isVisible('#' + id), false, id + ' 접힘');
  assert.match(await page.textContent('#moreFields summary'), /직업·꿈까지 적으면 더 자세히 봐 주겠소\s*\(선택\)/);
  await page.click('#moreFields summary');
  for (const id of ['userJob', 'userMajor', 'userHobby', 'userDream']) assert.equal(await page.isVisible('#' + id), true, id + ' 펼침');
  await page.evaluate(() => { document.getElementById('moreFields').open = false; document.getElementById('userDream').value = '내 가게'; goToStep(1); goToStep(2); });
  assert.equal(await page.evaluate(() => document.getElementById('moreFields').open), true, '값이 있으면 펼친다');
  await page.evaluate(() => { document.getElementById('userDream').value = ''; document.getElementById('moreFields').open = false; });
  await page.fill('#year', '1994'); await page.fill('#month', '5'); await page.fill('#day', '17');
  await page.evaluate(() => submitAndGoToResult()); await page.waitForTimeout(400);
  assert.equal(await viewOf(page), 'viewResult');
  assert.deepEqual(page._errors, []); assert.deepEqual(page._alerts, []);
  await ctx.close();
});

test('입력: 귀신 그림 주의 문구는 글자 그대로, 버튼 아래에 있다 · 대문 버튼 아래 한 줄', async () => {
  const { ctx, page } = await openPage(browser, { width: 375, height: 667 });
  assert.match(await page.textContent('#viewLanding .free-line'), /^생년월일만 넣으면 돈을 받지 않고 바로 풀어 드리오\.$/);
  const home = await page.evaluate(() => { const b = document.querySelector('#viewLanding .btn-main').getBoundingClientRect(), l = document.querySelector('#viewLanding .free-line').getBoundingClientRect(); return l.top >= b.bottom - 1; });
  assert.ok(home, '한 줄은 시작 버튼 아래');
  await toInput(page);
  assert.equal(await page.$$eval('#viewInput .scare-notice', n => n.length), 1);
  assert.match(await page.textContent('#viewInput .scare-notice'), /풀이 결과에는 귀신 그림이 나옵니다\. 어린이·노약자·임산부, 무서운 그림을 힘들어하는 분은 주의하세요\. \(그림은 직접 눌러야 보입니다\)\s*$/);
  const below = await page.evaluate(() => document.querySelector('#viewInput .scare-notice').getBoundingClientRect().top >= document.querySelector('#viewInput .btn-submit').getBoundingClientRect().bottom - 1);
  assert.ok(below, '주의 문구가 버튼 아래');
  await ctx.close();
});

test("'바로 입력' 주소 ?go=input: 대문 없이 입력 화면이 열리고 visit·direct·input 만 센다(home 은 안 센다) · 주소에서 go 가 지워진다 · 다른 값은 대문", async () => {
  const a = await openPage(browser, { url: 'file://' + SITE + '?go=input' });
  assert.equal(await viewOf(a.page), 'viewInput');
  assert.equal(await a.page.evaluate(() => getComputedStyle(document.getElementById('introGateModal')).display), 'none', '대문 안내창이 덮지 않는다');
  assert.equal(await a.page.evaluate(() => location.search), '');
  assert.deepEqual(await a.page.evaluate(() => window.__trackLog), ['visit', 'direct', 'input']);
  await a.page.fill('#year', '1990'); await a.page.fill('#month', '3'); await a.page.fill('#day', '10');
  await a.page.evaluate(() => submitAndGoToResult()); await a.page.waitForTimeout(400);
  assert.equal(await viewOf(a.page), 'viewResult');
  assert.deepEqual(await a.page.evaluate(() => window.__trackLog), ['visit', 'direct', 'input', 'free']);
  assert.deepEqual(a.page._errors, []);
  await a.ctx.close();
  for (const q of ['?go=result', '?go=', '?go=INPUT%3Cb%3E', '?go=viewHelp']) {
    const b = await openPage(browser, { url: 'file://' + SITE + q });
    assert.equal(await viewOf(b.page), 'viewLanding', q);
    assert.ok(!(await b.page.evaluate(() => window.__trackLog)).includes('direct'), q);
    assert.deepEqual(b.page._errors, []);
    await b.ctx.close();
  }
  // 결과 링크와 같이 오면 결과 링크가 이긴다
  const c = await openPage(browser, { url: 'file://' + SITE + '?go=input&y=1990&m=3&d=10&g=M' });
  await c.page.waitForTimeout(500);
  assert.equal(await viewOf(c.page), 'viewResult');
  await c.ctx.close();
});

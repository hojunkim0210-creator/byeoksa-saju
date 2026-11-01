// 첫 진입 관문 (2026-11-01 벤치마킹: 다른 운세 서비스 9곳 모두 첫 화면에 바로 내용):
//   序와 대문 안내창을 한 관문으로 합쳤다. 序는 하루 한 번(마지막 줄 뒤 현판 버튼 → 접견실), 건너뛰기·같은 날 재방문·결과 링크는 관문 없이 바로 화면.
//   helpers.openPage는 자동 테스트용으로 序를 건너뛰므로(QUIET), 여기서는 序가 실제로 도는 조건(움직임 줄이기로 짧게)으로 연다.
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium, SITE } = require('./helpers');

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

async function realPage({ seen = false, url = 'file://' + SITE } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page._errors = []; page.on('pageerror', e => page._errors.push(e.message));
  await page.route('**/*', r => { const u = r.request().url(); (u.startsWith('file:') || u.startsWith('data:')) ? r.continue() : r.abort(); });
  // seen: 'today' = 오늘 이미 序를 봄, 'yesterday' = 어제 봄 (값은 YYYY-MM-DD, app.js todayStr 와 같은 모양)
  if (seen) await page.addInitScript(when => { const d = new Date(); if (when === 'yesterday') d.setDate(d.getDate() - 1); const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; try { localStorage.setItem('byeoksa.seen.v1', s); } catch (e) { /* 무시 */ } }, seen);
  await page.goto(url); await page.waitForTimeout(700);
  return { ctx, page };
}
// 실제로 그려져 있는지: 조상이 display:none이면 자식의 computed display는 그대로라서 getClientRects로 본다
const shown = (page, id) => page.evaluate(i => { const e = document.getElementById(i); if (!e || e.hidden) return false; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return false; return e.getClientRects().length > 0; }, id);
const gateDisplay = page => page.evaluate(() => getComputedStyle(document.getElementById('introGateModal')).display);
const viewOf = page => page.evaluate(() => [...document.querySelectorAll('.app-container > .view-step')].find(v => v.style.display !== 'none').id);

test('처음 온 손님: 관문은 序 한 겹 — 줄을 다 읽으면 현판 버튼이 나오고, 누르면 접견실(입력)로', async () => {
  const { ctx, page } = await realPage();
  assert.ok(await shown(page, 'openingVeil'), '序가 보인다');
  assert.ok(!(await shown(page, 'gateEnterBtn')), '대문 안내창의 글·버튼은 序에 합쳐져 따로 보이지 않는다');
  assert.ok(!(await shown(page, 'openingEnter')), '현판 버튼은 다 읽기 전엔 없다');
  const n = await page.$$eval('#openingLines p', ps => ps.length);
  for (let i = 1; i < n; i++) { await page.click('#openingLines'); await page.waitForTimeout(60); }   // 첫 줄은 저절로
  assert.ok(await shown(page, 'openingEnter'), '마지막 줄 뒤 현판 버튼');
  assert.ok(!(await shown(page, 'openingSkip')), '건너뛰기는 현판 버튼으로 바뀐다');
  await page.click('#openingEnter'); await page.waitForTimeout(1500);
  assert.ok(!(await shown(page, 'openingVeil')), '序가 걷힌다');
  assert.equal(await gateDisplay(page), 'none', '대문 안내창도 닫힌다');
  assert.equal(await viewOf(page), 'viewInput');
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

test('건너뛰기: 序를 걷고 관문 없이 대문(홈)으로', async () => {
  const { ctx, page } = await realPage();
  await page.click('#openingSkip'); await page.waitForTimeout(1200);
  assert.ok(!(await shown(page, 'openingVeil')));
  assert.equal(await gateDisplay(page), 'none');
  assert.equal(await viewOf(page), 'viewLanding');
  await ctx.close();
});

test('같은 날 다시 오면: 序도 대문 안내창도 없이 바로 대문(홈)', async () => {
  const { ctx, page } = await realPage({ seen: 'today' });
  assert.ok(!(await shown(page, 'openingVeil')));
  assert.equal(await gateDisplay(page), 'none');
  assert.equal(await viewOf(page), 'viewLanding');
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

test('다음 날 오면 다시 序부터 (하루 한 번, 2026-11-01 대표님 결정), 본 날짜를 다시 적는다', async () => {
  const { ctx, page } = await realPage({ seen: 'yesterday' });
  assert.ok(await shown(page, 'openingVeil'), '어제 봤으면 오늘은 다시 序');
  const d = new Date(); const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  assert.equal(await page.evaluate(() => localStorage.getItem('byeoksa.seen.v1')), today);
  await ctx.close();
});

test('결과 링크(?y=…)로 들어오면 관문 없이 결과가 바로 보인다 (전엔 대문 안내창이 결과를 덮었다)', async () => {
  const { ctx, page } = await realPage({ url: 'file://' + SITE + '?y=2002&m=10&d=4&g=M' });
  await page.waitForTimeout(2500);   // 풀이 의식(움직임 줄이기라 짧다) 뒤
  assert.ok(!(await shown(page, 'openingVeil')));
  assert.equal(await gateDisplay(page), 'none');
  assert.equal(await viewOf(page), 'viewResult');
  await ctx.close();
});

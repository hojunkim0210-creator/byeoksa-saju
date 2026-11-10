// 숫자 세기 묶어 보내기 (업데이트 47, 2026-11-10 보안 점검 3번)
//   같은 순간에 생긴 단계(첫 화면 방문 + 대문 도착)는 한 요청에 실어 보낸다 — 서버 장부(KV) 쓰기를 줄이려고.
//   숫자 세기는 파일·localhost·자동 브라우저에서는 꺼지므로, 여기서는 가짜 주소(https://byeoksa.test)로 사이트를 열고
//   자동 브라우저 표시를 가린 뒤 sendBeacon이 무엇을 보내는지만 본다(실제 서버로는 아무것도 가지 않는다).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require('./helpers');

const SITE_DIR = path.resolve(__dirname, '../../site');
let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

async function sitePage(url = 'https://byeoksa.test/') {
  // 자동 브라우저의 이름표('HeadlessChrome')는 로봇으로 걸러지므로 보통 휴대폰 이름표를 단다
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  const page = await ctx.newPage();
  page._errors = []; page.on('pageerror', e => page._errors.push(e.message));
  await page.route('**/*', r => r.abort());
  await page.route('https://byeoksa.test/**', r => {
    const u = new URL(r.request().url());
    if (u.pathname.startsWith('/api/')) return r.fulfill({ status: 204, body: '' });
    const file = path.join(SITE_DIR, u.pathname === '/' ? 'index.html' : u.pathname);
    return fs.existsSync(file) && fs.statSync(file).isFile() ? r.fulfill({ path: file }) : r.fulfill({ status: 404, body: '' });
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    window.__beacons = [];
    navigator.sendBeacon = (u, body) => { window.__beacons.push([u, String(body)]); return true; };
  });
  await page.goto(url); await page.waitForTimeout(700);
  return { ctx, page };
}
const beacons = page => page.evaluate(() => window.__beacons.map(([u, b]) => [u, JSON.parse(b).e]));

test('첫 화면: 방문과 대문 도착을 한 요청으로 보내고, 그 뒤 단계는 하나씩 — 탭 하나에 한 번', async () => {
  const { ctx, page } = await sitePage();
  assert.deepEqual(await beacons(page), [['/api/count', ['visit', 'home']]]);
  await page.click('#viewLanding .btn-main'); await page.waitForTimeout(300);
  assert.deepEqual((await beacons(page)).slice(1), [['/api/count', 'input']]);
  await page.evaluate(() => { goToStep(1); goToStep(2); goToStep(1); }); await page.waitForTimeout(300);
  assert.equal((await beacons(page)).length, 2, '같은 탭에서 다시 가도 또 세지 않는다');
  await page.evaluate(() => goToStep(2));
  await page.fill('#year', '1990'); await page.fill('#month', '3'); await page.fill('#day', '10');
  await page.evaluate(() => submitAndGoToResult()); await page.waitForTimeout(300);
  assert.deepEqual((await beacons(page)).slice(2), [['/api/count', 'free']]);
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

test('결과 링크로 들어오면 방문·무료 풀이만(대문·입력을 거치지 않는다), 화면을 떠날 때 모아 둔 것을 바로 보낸다', async () => {
  const { ctx, page } = await sitePage('https://byeoksa.test/?y=1990&m=3&d=10&g=M');
  const sent = (await beacons(page)).flatMap(([, e]) => e);
  assert.deepEqual(sent.sort(), ['free', 'visit']);
  await page.evaluate(() => { window.__beacons.length = 0; track('payopen'); window.dispatchEvent(new Event('pagehide')); });
  assert.deepEqual(await beacons(page), [['/api/count', 'payopen']], '80ms를 기다리지 않고 떠나는 순간 보낸다');
  await ctx.close();
});

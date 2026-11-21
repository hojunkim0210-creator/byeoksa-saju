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
  assert.deepEqual(await beacons(page), [['/api/count', ['visit', 'src_none', 'home']]]);   // src_none = 어디서 왔는지 모름 (업데이트 50)
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
  assert.deepEqual(sent.sort(), ['free', 'src_none', 'visit']);
  await page.evaluate(() => { window.__beacons.length = 0; track('payopen'); window.dispatchEvent(new Event('pagehide')); });
  assert.deepEqual(await beacons(page), [['/api/count', 'payopen']], '80ms를 기다리지 않고 떠나는 순간 보낸다');
  await ctx.close();
});

// 업데이트 50 (2026-11-21): 어디서 왔나 — 첫 방문과 같은 요청에 분류 이름 하나, 주소의 표시는 센 뒤 지운다
test("프로필 링크 표시(?go=input&s=tt): 방문·틱톡·바로 입력·입력을 한 요청으로, 주소에서 표시가 지워진다", async () => {
  const { ctx, page } = await sitePage('https://byeoksa.test/?go=input&s=tt');
  assert.deepEqual(await beacons(page), [['/api/count', ['visit', 'src_tt', 'direct', 'input']]]);
  assert.equal(await page.evaluate(() => location.search), '');
  await page.reload(); await page.waitForTimeout(500);
  const again = (await beacons(page)).flatMap(([, e]) => [].concat(e));
  assert.ok(!again.includes('visit') && !again.some(e => e.startsWith('src_')), '같은 탭에서 다시 열어도 방문·경로는 또 세지 않는다');
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

test('표시가 없는 첫 화면은 알 수 없음, 다른 표시(utm)는 지우고 결과 링크 값은 남긴다', async () => {
  const a = await sitePage();
  assert.deepEqual(await beacons(a.page), [['/api/count', ['visit', 'src_none', 'home']]]);
  await a.ctx.close();
  const b = await sitePage('https://byeoksa.test/?utm_source=instagram&utm_medium=bio&y=1990&m=3&d=10&g=M');
  const sent = (await beacons(b.page)).flatMap(([, e]) => e);
  assert.ok(sent.includes('src_ig'));
  const qs = await b.page.evaluate(() => location.search);
  assert.ok(!qs.includes('utm_'), qs);
  await b.ctx.close();
});

test('sourceOf 판단 규칙: 표시 > 공유 링크 > 앱 안 브라우저 > 바로 전 주소', async () => {
  const { ctx, page } = await sitePage();
  const cases = await page.evaluate(() => {
    const S = (q, ua, ref) => sourceOf(q, ua || 'Safari', ref || '', 'byeoksa.com');
    return {
      tag: S('?s=yt', 'Instagram 300'), share: S('?from=share'), compat: S('?compat=1&n=a'),
      ig: S('', 'Mozilla/5.0 (iPhone) Instagram 312.0'), tt: S('', 'Mozilla/5.0 musical_ly_33.1 BytedanceWebview'), kakao: S('', 'Mozilla/5.0 KAKAOTALK 10.4'),
      threads: S('', '', 'https://l.threads.net/'), blog: S('', '', 'https://m.blog.naver.com/x/1'), naver: S('', '', 'https://m.search.naver.com/search?q=a'),
      google: S('', '', 'https://www.google.co.kr/'), yt: S('', '', 'https://m.youtube.com/'), z2027: S('', '', 'https://byeoksa.com/2027/ox'),
      inside: S('', '', 'https://byeoksa.com/legal'), etc: S('', '', 'https://example.com/'), none: S(''), junk: S('?s=zzz')
    };
  });
  assert.deepEqual(cases, { tag: 'src_yt', share: 'src_share', compat: 'src_share', ig: 'src_ig', tt: 'src_tt', kakao: 'src_kakao',
    threads: 'src_th', blog: 'src_blog', naver: 'src_search', google: 'src_search', yt: 'src_yt', z2027: 'src_z2027',
    inside: null, etc: 'src_etc', none: 'src_none', junk: 'src_none' });
  await ctx.close();
});

// 궁합 공유 입구 (업데이트 38, 2026-11-07): 결과의 '상대에게 보내기', 받은 사람은 序 없이 바로 궁합 입력으로.
//   자동 테스트에서는 숫자를 서버로 보내지 않고 window.__trackLog 에 단계 이름만 쌓인다(app.js track).
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium, openPage, SITE } = require('./helpers');

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

async function runCompat(page, nameA) {
  await page.evaluate(() => { const m = document.getElementById('introGateModal'); if (m) m.style.display = 'none'; openFeature('compat'); });
  await page.fill('#caName', nameA);
  // 생년월일 칸 채우기: 나(ca)·상대(cb)의 연·월·일
  await page.fill('#caY', '1990'); await page.fill('#caM', '3'); await page.fill('#caD', '10');
  await page.fill('#cbY', '1992'); await page.fill('#cbM', '7'); await page.fill('#cbD', '21');
  await page.click('#compatGo');
  await page.waitForTimeout(300);
}
const log = page => page.evaluate(() => window.__trackLog || []);

test('궁합 결과에 큰 \'상대에게 보내기\' 단추가 있고, 누르면 공유 창에 생일 없는 링크가 간다', async () => {
  const { ctx, page } = await openPage(browser);
  await page.evaluate(() => { window.__shared = null; navigator.share = async d => { window.__shared = d; }; });
  await runCompat(page, '민지');
  assert.ok(await page.isVisible('#compatShare'));
  assert.equal((await page.textContent('#compatShare')).trim(), '상대에게 보내기');
  await page.click('#compatShare'); await page.waitForTimeout(200);
  const shared = await page.evaluate(() => window.__shared);
  assert.match(shared.url, /\?compat=1&n=%EB%AF%BC%EC%A7%80$/);
  assert.ok(!/1990|1992|[?&](y|m|d|h|g)=/.test(shared.url), '링크에 생일이 들어가면 안 된다: ' + shared.url);
  assert.equal(shared.text, '너랑 나 궁합 공짜로 봐 준대. 생일만 넣어 봐');
  const tracked = await log(page);
  assert.ok(tracked.includes('compat') && tracked.includes('compatsend'), JSON.stringify(tracked));
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

test('이름을 안 적으면 링크에 별명이 없고, 공유 창이 없으면 복사 문구로 바뀐다', async () => {
  const { ctx, page } = await openPage(browser);
  await page.evaluate(() => { navigator.share = undefined; window.__copied = null; window.prompt = (msg, t) => { window.__copied = t; return null; }; });
  await runCompat(page, '');
  await page.click('#compatShare'); await page.waitForTimeout(200);
  const copied = await page.evaluate(() => window.__copied);
  assert.match(copied, /^너랑 나 궁합 공짜로 봐 준대\. 생일만 넣어 봐\n.*\?compat=1$/);
  const sms = await page.getAttribute('#compatSms', 'href');
  assert.match(sms, /^sms:\?&body=/);
  assert.ok(decodeURIComponent(sms).includes('?compat=1'));
  await ctx.close();
});

test('받는 쪽이 못 읽는 글자(이모지 등)가 든 이름은 링크에 별명을 붙이지 않는다', async () => {
  const { ctx, page } = await openPage(browser);
  await page.evaluate(() => { window.__shared = null; navigator.share = async d => { window.__shared = d; }; });
  await runCompat(page, '민지♥');
  await page.click('#compatShare'); await page.waitForTimeout(200);
  assert.match((await page.evaluate(() => window.__shared)).url, /\?compat=1$/);
  await ctx.close();
});

test('받은 사람: 링크로 들어오면 대문·序 없이 바로 궁합 입력, 벽사견 한 줄, 보낸 사람 별명이 상대 이름 칸에', async () => {
  const { ctx, page } = await openPage(browser, { url: 'file://' + SITE + '?compat=1&n=' + encodeURIComponent('민지') });
  await page.waitForTimeout(300);
  const view = await page.evaluate(() => [...document.querySelectorAll('.app-container > .view-step')].find(v => v.style.display !== 'none').id);
  assert.equal(view, 'viewCompat');
  assert.match(await page.textContent('.compat-invite'), /^민지가 그대와 궁합을 보고 싶다는구려\. 위에는 그대 생일, 아래에는 민지의 생일을 넣어 보시오\.$/);
  assert.equal(await page.inputValue('#cbName'), '민지');
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('introGateModal')).display), 'none');
  assert.deepEqual(await log(page), ['visit', 'invited']);
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

test('받은 사람: 별명의 끝 글자에 맞는 조사 — 받침 있으면 \'이\', 영문으로 끝나면 조사 없는 문장', async () => {
  for (const [nick, expect] of [['준석', /^준석이 그대와 궁합을/], ['Tom', /^Tom, 이 사람이 그대와 궁합을/]]) {
    const { ctx, page } = await openPage(browser, { url: 'file://' + SITE + '?compat=1&n=' + encodeURIComponent(nick) });
    await page.waitForTimeout(200);
    assert.match(await page.textContent('.compat-invite'), expect);
    await ctx.close();
  }
});

test('받은 사람: 별명이 없거나 이상한 글자(태그 등)면 별명 없이 안내하고, 주소에서 꼬리표는 지운다', async () => {
  for (const q of ['?compat=1', '?compat=1&n=' + encodeURIComponent('<img src=x onerror=alert(1)>')]) {
    const { ctx, page } = await openPage(browser, { url: 'file://' + SITE + q });
    await page.waitForTimeout(200);
    assert.match(await page.textContent('.compat-invite'), /^누군가 그대와 궁합을 보고 싶다는구려/);
    assert.equal(await page.inputValue('#cbName'), '');
    assert.ok(!(await page.evaluate(() => location.search)), '주소의 ?compat 꼬리표는 지워야 한다');
    assert.deepEqual(page._alerts, []);
    await ctx.close();
  }
});

test('보통 방문(링크 없이)에는 초대 안내가 나오지 않는다', async () => {
  const { ctx, page } = await openPage(browser);
  await page.evaluate(() => openFeature('compat'));
  assert.equal((await page.$$('.compat-invite')).length, 0);
  await ctx.close();
});

test('실제 손님처럼(자동 테스트 표시 없이) 링크를 열어도 序·대문 안내창이 덮지 않고 궁합 입력이 바로 보인다', async () => {
  // helpers.openPage 는 序를 건너뛰는 테스트 표시를 켠다 → 여기서는 표시 없이 연다 (opening.test.js 와 같은 방식)
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', r => { const u = r.request().url(); (u.startsWith('file:') || u.startsWith('data:')) ? r.continue() : r.abort(); });
  await page.goto('file://' + SITE + '?compat=1&n=' + encodeURIComponent('민지')); await page.waitForTimeout(700);
  const state = await page.evaluate(() => ({
    veil: (() => { const v = document.getElementById('openingVeil'); return !!v && !v.hidden && getComputedStyle(v).display !== 'none'; })(),
    gate: getComputedStyle(document.getElementById('introGateModal')).display,
    view: [...document.querySelectorAll('.app-container > .view-step')].find(v => v.style.display !== 'none').id
  }));
  assert.deepEqual(state, { veil: false, gate: 'none', view: 'viewCompat' });
  assert.ok(await page.isVisible('.compat-invite'));
  assert.deepEqual(errors, []);
  await ctx.close();
});

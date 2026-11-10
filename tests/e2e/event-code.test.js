// 무료 코드 이벤트 화면 (업데이트 45, 2026-11-10 — 대표님 "카카오페이 나오면 바로 시작, 미리 준비만")
//   꺼져 있으면(EVENT.enabled false, 기본) 결제창에 아무 칸도 없다. 켜면 '무료 이벤트 코드' 칸이 생기고,
//   맞는 코드면 결제 없이 천명 리포트가 열린다(서버 /api/code 는 여기서 가짜로 답한다 — 서버 자체는 tests/unit/code-server.test.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium, openPage, fillAndSubmit } = require('./helpers');

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

const toast = page => page.evaluate(() => document.getElementById('toastMsg').textContent);
const consoleErrors = page => page._console.filter(t => !/^Failed to load resource|^Fetch API cannot load file:\/\/\/api\//.test(t));

/** 가짜 서버: GOOD… 은 처음 OK·그다음 USED, DOWN… 은 통신 실패, 나머지는 WRONG */
async function fakeCodeServer(page) {
  await page.evaluate(() => {
    const real = window.fetch; const used = new Set(); window.__codeCalls = [];
    window.fetch = async (u, o) => {
      if (u !== '/api/code') return real(u, o);
      const code = JSON.parse(o.body).code.toUpperCase().replace(/[^0-9A-Z]/g, '');
      window.__codeCalls.push(code);
      if (code.startsWith('DOWN')) throw new TypeError('network');
      const status = code === 'GOODGOODGOOD' ? (used.has(code) ? 'USED' : (used.add(code), 'OK')) : 'WRONG';
      return new Response(JSON.stringify({ status }), { status: status === 'OK' ? 200 : status === 'USED' ? 409 : 404, headers: { 'Content-Type': 'application/json' } });
    };
  });
}
async function tryCode(page, code) {
  await page.evaluate(() => { const f = document.querySelector('#paymentModal .event-fold'); if (f) f.open = true; });
  await page.fill('#paymentModal .event-input', code);
  await page.click('#paymentModal .event-apply');
  await page.waitForTimeout(250);
  return toast(page);
}

test('꺼져 있으면(기본) 결제창에 무료 이벤트 코드 칸이 없다 — 손님 화면 변화 0', async () => {
  const { ctx, page } = await openPage(browser);
  assert.equal(await page.evaluate(() => EVENT.enabled), false);
  await fillAndSubmit(page);
  await page.evaluate(() => openPaymentModal()); await page.waitForTimeout(150);
  assert.equal(await page.$$eval('#paymentModal .event-fold', e => e.length), 0);
  assert.equal(await page.$$eval('#paymentModal .promo-fold', e => e.length), 1, '할인 코드 칸은 그대로');
  assert.ok(!/무료 이벤트 코드/.test(await page.evaluate(() => document.body.innerText)));
  await ctx.close();
});

test('켜면: 틀림·통신 실패는 하오체 안내, 맞는 코드면 결제 없이 리포트가 열리고 다시 와도 열려 있다 · 같은 코드 두 번째는 막힌다', async () => {
  const { ctx, page } = await openPage(browser);
  await page.evaluate(() => { EVENT.enabled = true; });
  await fakeCodeServer(page);
  await fillAndSubmit(page);
  await page.evaluate(() => openPaymentModal()); await page.waitForTimeout(150);
  const note = await page.textContent('#paymentModal .event-note');
  assert.match(note, /만 19세 이상만 쓸 수 있습니다/);
  assert.match(note, /할인 코드\(1,000원\)는 위 칸에/);
  // 할인 칸에 무료 코드를 넣으면 알려 준다
  await page.evaluate(() => { document.querySelector('#paymentModal .promo-fold').open = true; });
  await page.fill('#paymentModal .promo-input', 'abcd-efgh-jkmn');
  await page.click('#paymentModal .promo-apply'); await page.waitForTimeout(150);
  assert.equal(await toast(page), "무료 이벤트 코드는 아래 '무료 이벤트 코드' 칸에 넣으시오.");
  assert.equal(await tryCode(page, 'BADX-BADX-BADX'), '그런 무료 코드는 없소. 받은 코드를 다시 확인하시오.');
  assert.equal(await tryCode(page, 'DOWN-DOWN-DOWN'), '지금은 코드를 확인할 수 없소. 잠시 뒤 다시 해 보시오.');
  assert.equal(await page.evaluate(() => reportUnlocked), false, '틀린 코드로는 열리지 않는다');
  assert.equal(await tryCode(page, 'good-good-good'), '무료 코드가 맞소. 천명 리포트 6개 장의 봉인을 풀었소.');
  const st = await page.evaluate(() => ({
    unlocked: reportUnlocked, overlay: getComputedStyle(document.getElementById('paywallOverlay')).display,
    rec: JSON.parse(localStorage.getItem('byeoksa.paid.report.' + sajuKey(currentSajuData))), log: window.__trackLog
  }));
  assert.equal(st.unlocked, true); assert.equal(st.overlay, 'none');
  assert.equal(st.rec.paymentId, 'event-code', "기록은 결제와 구분되는 'event-code' 표시");
  assert.ok(st.log.includes('codeopen'), "숫자 세기 '무료 코드로 엶'");
  assert.match(await page.textContent('#reviewAskId'), /무료 코드로 열었으니 후기의 결제 번호 칸에는 '무료 이벤트'라고/);
  // 결제 취소 확인(실결제 모드)이 이 기록을 지우지 않는다
  const relocked = await page.evaluate(async () => { PAYMENT.mode = 'portone'; PAYMENT.verifyUrl = '/api/payment/complete'; const n = await verifyStoredPayments(); PAYMENT.mode = 'test'; PAYMENT.verifyUrl = ''; return n; });
  assert.equal(relocked, 0);
  assert.ok(await page.evaluate(() => !!localStorage.getItem('byeoksa.paid.report.' + sajuKey(currentSajuData))));
  // 다른 생년월일에 같은 코드를 또 쓰면 막힌다 (서버가 USED)
  await fillAndSubmit(page, { y: '1985', m: '12', d: '25', gender: 'F' });
  await page.evaluate(() => openPaymentModal()); await page.waitForTimeout(150);
  assert.equal(await tryCode(page, 'GOOD-GOOD-GOOD'), '이미 쓰인 코드요. 코드는 한 번만 쓸 수 있소.');
  assert.equal(await page.evaluate(() => reportUnlocked), false);
  // 처음 생년월일로 다시 오면 그대로 열려 있다 (이 기기에 기억)
  await fillAndSubmit(page);
  assert.equal(await page.evaluate(() => reportUnlocked), true);
  assert.deepEqual(page._errors, []); assert.deepEqual(consoleErrors(page), []);
  await ctx.close();
});

test("후기에 event 표시가 있으면 '실제 구매자' 대신 '무료 이벤트 참여'로 밝힌다", async () => {
  const { ctx, page } = await openPage(browser);
  await page.evaluate(() => window.BYEOKSA_SHOP.setReviews([{ text: '생각보다 길게 읽었소', who: '민지', event: true }, { text: '돈 이야기가 맞았소', who: '준석', verified: true }]));
  const t = await page.evaluate(() => document.getElementById('reviewsHomeList').innerText);
  assert.match(t, /민지 · 무료 이벤트 참여/);
  assert.match(t, /준석 · 실제 구매자/);
  await ctx.close();
});

// 결제 흐름 테스트: 테스트 모드 / 포트원 결제창(가짜) / 휴대폰 결제 페이지 복귀 / 서버 확인 실패 / 결제 기억
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium, openPage, fillAndSubmit, SITE } = require('./helpers');

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

const ME = { y: '2002', m: '10', d: '4', hour: '-1', gender: 'M', job: '대학생', dream: '창업' };
const viewOf = page => page.evaluate(() => [...document.querySelectorAll('.app-container > .view-step')].find(v => v.style.display !== 'none').id);
const locked = page => page.evaluate(() => getComputedStyle(document.getElementById('paywallOverlay')).display !== 'none');

test('테스트 모드: 버튼은 "테스트로 봉인 해제", 누르면 리포트가 열리고 같은 사주는 새로고침해도 열려 있다', async () => {
  const { ctx, page } = await openPage(browser);
  await fillAndSubmit(page, ME);
  assert.match(await page.textContent('#payButton'), /테스트로 봉인 해제/);
  assert.ok(await locked(page));
  await page.evaluate(() => openPaymentModal());
  await page.click('#payButton'); await page.waitForTimeout(300);
  assert.equal(await viewOf(page), 'viewReport');
  await page.reload(); await page.waitForTimeout(300);
  await fillAndSubmit(page, ME);
  assert.equal(await locked(page), false, '같은 사주는 다시 열린 상태');
  assert.ok(await page.isVisible('#reportReopen'));
  await fillAndSubmit(page, { ...ME, d: '5' });
  assert.equal(await locked(page), true, '다른 생년월일은 다시 잠김');
  assert.ok(await page.isHidden('#reportReopen'));
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

test('결제창 안내: 상품·가격·제공 방식·환불 제한·미성년자 안내가 보인다', async () => {
  const { ctx, page } = await openPage(browser);
  await fillAndSubmit(page, ME);
  await page.evaluate(() => openPaymentModal());
  const t = await page.textContent('#paymentModal');
  for (const w of ['천명 리포트', '4,900원', '자동 결제 없음', '청약철회', '만 19세 미만', '법정대리인']) assert.ok(t.includes(w), w);
  await ctx.close();
});

async function livePage(fake) {
  const { ctx, page } = await openPage(browser);
  await page.evaluate(f => {
    PAYMENT.mode = 'portone'; PAYMENT.storeId = 'store-test'; PAYMENT.channelKey = 'channel-key-test';
    renderPaymentMode();
    window.__calls = [];
    window.PortOne = { requestPayment: async o => { window.__calls.push(o); return eval(f)(o); } };
  }, fake);
  return { ctx, page };
}

test('포트원 결제 성공: 4,900원·KRW로 요청하고, 개인정보는 주소에 싣지 않으며, 리포트가 열린다', async () => {
  const { ctx, page } = await livePage('o => ({ paymentId: o.paymentId, txId: "tx-1" })');
  await fillAndSubmit(page, ME);
  assert.match(await page.textContent('#payButton'), /4,900원 결제/);
  assert.ok(await page.isHidden('#paymentTestNote'), '테스트 안내 문구는 숨김');
  await page.evaluate(() => openPaymentModal());
  await page.click('#payButton'); await page.waitForTimeout(400);
  const [call] = await page.evaluate(() => window.__calls);
  assert.equal(call.totalAmount, 4900); assert.equal(call.currency, 'KRW');
  assert.equal(call.storeId, 'store-test'); assert.equal(call.channelKey, 'channel-key-test');
  assert.match(call.paymentId, /^byeoksa-/);
  assert.ok(!/2002|창업|대학생/.test(call.redirectUrl), call.redirectUrl);
  assert.equal(await viewOf(page), 'viewReport');
  const pending = await page.evaluate(() => localStorage.getItem('byeoksa.pending.v1'));
  assert.equal(pending, null, '결제가 끝나면 맡겨 둔 입력값은 지운다');
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

test('포트원 결제 실패·취소: 잠긴 채로 남고 안내가 뜬다', async () => {
  const { ctx, page } = await livePage('o => ({ code: "FAILURE_TYPE_PG", message: "사용자가 결제를 취소했습니다" })');
  await fillAndSubmit(page, ME);
  await page.evaluate(() => openPaymentModal());
  await page.click('#payButton'); await page.waitForTimeout(400);
  assert.ok(await locked(page));
  assert.notEqual(await viewOf(page), 'viewReport');
  assert.match(await page.textContent('#toastMsg'), /결제가 완료되지 않았다/);
  await ctx.close();
});

test('서버 확인이 실패하면 열지 않는다 (verifyUrl)', async () => {
  const { ctx, page } = await livePage('o => ({ paymentId: o.paymentId })');
  await page.route('https://verify.test/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'FAILED' }) }));
  await page.evaluate(() => { PAYMENT.verifyUrl = 'https://verify.test/api/payment/complete'; });
  await fillAndSubmit(page, ME);
  await page.evaluate(() => openPaymentModal());
  await page.click('#payButton'); await page.waitForTimeout(500);
  assert.ok(await locked(page));
  assert.match(await page.textContent('#toastMsg'), /결제 확인에 실패/);
  await ctx.close();
});

test('휴대폰 결제 페이지에서 돌아오면: 맡겨 둔 사주를 다시 풀고 리포트를 연다, 주소는 깨끗해진다', async () => {
  const { ctx, page } = await openPage(browser);
  await page.evaluate(() => { const data = { y: 2002, m: 10, d: 4, hourVal: -1, genderVal: 'M', userJob: '대학생', userMajor: '', userHobby: '', userDream: '창업' };
    localStorage.setItem('byeoksa.pending.v1', JSON.stringify({ paymentId: 'byeoksa-abc', productId: 'report', subjectKey: sajuKey(data), data, at: Date.now() })); });
  await page.goto('file://' + SITE + '?pay=return&paymentId=byeoksa-abc&transactionType=PAYMENT&txId=tx-9');
  await page.waitForTimeout(500);
  assert.equal(await viewOf(page), 'viewReport');
  assert.match(await page.textContent('#reportSummary'), /을사일주/);
  assert.ok(!page.url().includes('paymentId'), page.url());
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

test('휴대폰 결제 페이지에서 실패로 돌아오면 잠긴 채 안내', async () => {
  const { ctx, page } = await openPage(browser);
  await page.evaluate(() => { const data = { y: 2002, m: 10, d: 4, hourVal: -1, genderVal: 'M', userDream: '창업' };
    localStorage.setItem('byeoksa.pending.v1', JSON.stringify({ paymentId: 'byeoksa-x', productId: 'report', subjectKey: sajuKey(data), data, at: Date.now() })); });
  await page.goto('file://' + SITE + '?pay=return&paymentId=byeoksa-x&code=FAILURE_TYPE_PG&message=%EC%B7%A8%EC%86%8C');
  await page.waitForTimeout(500);
  assert.equal(await viewOf(page), 'viewResult');
  assert.ok(await locked(page));
  await ctx.close();
});

test('키 작은 휴대폰(375×667)에서도 결제창 제목과 결제 버튼에 닿는다', async () => {
  const { ctx, page } = await openPage(browser, { width: 375, height: 667 });
  await fillAndSubmit(page, ME);
  await page.evaluate(() => openPaymentModal());
  const r = await page.evaluate(() => {
    const b = document.querySelector('#paymentModal .modal-box').getBoundingClientRect();
    return { top: b.top, bottom: b.bottom, vh: innerHeight };
  });
  assert.ok(r.top >= 0 && r.bottom <= r.vh, JSON.stringify(r));
  await page.locator('#payButton').scrollIntoViewIfNeeded();
  assert.ok(await page.locator('#payButton').isVisible());
  await page.click('#payButton'); await page.waitForTimeout(300);
  assert.equal(await viewOf(page), 'viewReport');
  await ctx.close();
});

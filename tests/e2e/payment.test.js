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

// 2026-10-27: 결제 성공 뒤 '열림' 표시는 이 기기에만 남는다 → 뒤에 결제를 취소(환불)해도 리포트가 열려 있던 문제.
//   사이트를 열 때마다 저장된 결제 번호를 확인 서버에 다시 묻고, 취소된 결제면 표시를 지워 다시 잠근다 (app.js verifyStoredPayments).
async function reloadWithVerifyAnswer(page, status, body) {
  // 다음 페이지 로드부터 결제 확인 서버가 이렇게 답한다 (status 0 = 통신 오류). helpers의 가짜 서버보다 뒤에 끼워 넣어 덮어쓴다
  await page.addInitScript(([s, b]) => {
    const realFetch = window.fetch;
    window.fetch = (u, o) => u === '/api/payment/complete'
      ? (s === 0 ? Promise.reject(new TypeError('network down')) : Promise.resolve(new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })))
      : realFetch(u, o);
  }, [status, body]);
  await page.reload(); await page.waitForTimeout(700);
}
async function payForReport(page) {
  await fillAndSubmit(page, ME);
  await page.evaluate(() => openPaymentModal());
  await page.click('#payButton'); await page.waitForTimeout(400);
  assert.equal(await viewOf(page), 'viewReport');
}

test('결제 뒤 취소(환불)된 결제: 다시 들어오면 열림 표시가 지워지고 리포트가 잠긴다', async () => {
  const { ctx, page } = await livePage('o => ({ paymentId: o.paymentId })');
  await payForReport(page);
  await reloadWithVerifyAnswer(page, 400, { status: 'INVALID', reason: 'status:CANCELLED' });
  assert.equal(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('byeoksa.paid.')).length), 0, '열림 표시를 지운다');
  assert.match(await page.textContent('#toastMsg'), /취소된 결제/);
  await fillAndSubmit(page, ME);
  assert.ok(await locked(page), '같은 사주도 다시 잠김');
  assert.ok(await page.isHidden('#reportReopen'));
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

test('확인 서버가 "없는 결제"(404)라 해도 잠근다', async () => {
  const { ctx, page } = await livePage('o => ({ paymentId: o.paymentId })');
  await payForReport(page);
  await reloadWithVerifyAnswer(page, 404, { status: 'NOT_FOUND' });
  await fillAndSubmit(page, ME);
  assert.ok(await locked(page));
  await ctx.close();
});

test('통신 오류·설정 오류(500)·서버 장애(502)·가격 불일치(400 amount)면 열림 표시를 지우지 않는다', async () => {
  for (const [status, body] of [[0, null], [500, { status: 'NOT_CONFIGURED' }], [502, { status: 'UPSTREAM_ERROR' }], [400, { status: 'INVALID', reason: 'amount' }]]) {
    const { ctx, page } = await livePage('o => ({ paymentId: o.paymentId })');
    await payForReport(page);
    await reloadWithVerifyAnswer(page, status, body);
    await fillAndSubmit(page, ME);
    assert.equal(await locked(page), false, `${status} ${JSON.stringify(body)}: 열린 채로 둔다`);
    await ctx.close();
  }
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

test('결제 동의(필수 체크): 체크 안 하면 결제가 진행되지 않고, 체크하면 열린다 (리포트·상품 결제창 모두)', async () => {
  const { ctx, page } = await openPage(browser);
  await fillAndSubmit(page, ME);
  await page.evaluate(() => { window.__BYEOKSA_TEST__ = false; openPaymentModal(); });
  assert.equal(await page.isChecked('#payAgree'), false, '처음엔 체크 안 됨');
  await page.click('#payButton'); await page.waitForTimeout(300);
  assert.notEqual(await viewOf(page), 'viewReport', '동의 없이는 열리지 않음');
  assert.ok(await page.evaluate(() => document.querySelector('#paymentModal .pay-agree').classList.contains('is-missing')));
  await page.check('#payAgree'); await page.click('#payButton'); await page.waitForTimeout(300);
  assert.equal(await viewOf(page), 'viewReport');
  // 상품 결제창(신년운세)
  await page.evaluate(() => { localStorage.setItem('byeoksa.profile.v1', JSON.stringify({ y: 2002, m: 10, d: 4, hour: -1, gender: 'M' })); openFeature('newyear'); });
  await page.click('#nyBuy');
  assert.equal(await page.isChecked('#productPayAgree'), false);
  await page.click('#productPayBtn'); await page.waitForTimeout(200);
  assert.ok(await page.isVisible('#productModal'), '동의 없이는 결제창이 그대로');
  await page.check('#productPayAgree'); await page.click('#productPayBtn'); await page.waitForTimeout(300);
  assert.ok(!(await page.isVisible('#productModal')), '동의 후 결제 완료');
  await ctx.close();
});

test('바닥글: 대표자·사업자번호·주소·연락처·개인정보 보호책임자가 "항목: 값"으로 보인다', async () => {
  const { ctx, page } = await openPage(browser);
  const t = await page.textContent('#footerBiz');
  for (const k of ['상호: 패스로그', '대표: 김호준', '사업자등록번호: 104-14-22768', '통신판매업 신고번호:', '주소: 제주특별자치도', '전화: 010-2582-9143', '이메일: pathlogue.help@gmail.com', '개인정보 보호책임자: 김호준']) assert.ok(t.includes(k), k);
  await ctx.close();
});

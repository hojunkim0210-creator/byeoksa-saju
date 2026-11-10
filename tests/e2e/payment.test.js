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
  assert.equal(call.payMethod, 'CARD'); assert.equal(call.easyPay, undefined, '카드 버튼은 카카오페이 준비 뒤에도 그대로 KCP 카드 결제');
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
  assert.match(await page.textContent('#toastMsg'), /결제가 완료되지 않았소/);
  await ctx.close();
});

// 2026-11-01: 카카오페이 버튼(KCP 간편결제 허브형). KCP 승인 전까지 app.js PAYMENT.kakaoPay.enabled=false 로 숨겨 둔다.
//   켜면 같은 상품·금액을 포트원에 payMethod EASY_PAY + easyPayProvider KAKAOPAY 로 요청한다 (카드 버튼은 그대로).
test('카카오페이 버튼: 스위치가 꺼져 있으면 보이지 않고, 켜면 같은 금액을 간편결제(KAKAOPAY)로 KCP 채널에 요청하고 리포트가 열린다', async () => {
  const { ctx, page } = await livePage('o => ({ paymentId: o.paymentId })');
  await fillAndSubmit(page, ME);
  await page.evaluate(() => openPaymentModal());
  assert.ok(await page.isHidden('#payKakaoButton'), '꺼짐: 카카오페이 버튼 숨김');
  await page.evaluate(() => { PAYMENT.kakaoPay.enabled = true; renderPaymentMode(); });
  assert.ok(await page.isVisible('#payKakaoButton'), '켬: 카카오페이 버튼 보임');
  assert.match(await page.textContent('#payKakaoButton'), /카카오페이로 4,900원 결제/);
  await page.click('#payKakaoButton'); await page.waitForTimeout(400);
  const [call] = await page.evaluate(() => window.__calls);
  assert.equal(call.payMethod, 'EASY_PAY'); assert.deepEqual(call.easyPay, { easyPayProvider: 'KAKAOPAY' });
  assert.equal(call.channelKey, 'channel-key-test', '전용 채널 키를 안 적으면 KCP 채널 그대로');
  assert.equal(call.storeId, 'store-test'); assert.equal(call.totalAmount, 4900); assert.equal(call.orderName, '벽사신견 천명 리포트');
  assert.equal(await viewOf(page), 'viewReport');
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

test('카카오페이 전용 채널 키를 적어 두면(KCP가 별도 사이트코드를 준 경우) 그 채널로 요청한다', async () => {
  const { ctx, page } = await livePage('o => ({ paymentId: o.paymentId })');
  await fillAndSubmit(page, ME);
  await page.evaluate(() => { PAYMENT.kakaoPay.enabled = true; PAYMENT.kakaoPay.channelKey = 'channel-key-kakao'; openPaymentModal(); });
  await page.click('#payKakaoButton'); await page.waitForTimeout(400);
  const [call] = await page.evaluate(() => window.__calls);
  assert.equal(call.channelKey, 'channel-key-kakao'); assert.equal(call.payMethod, 'EASY_PAY');
  assert.equal(await viewOf(page), 'viewReport');
  await ctx.close();
});

// 2026-11-01 벤치마킹(포스텔러 상품 페이지의 '구매하기 7,700원' 바): 잠긴 결과 화면에는 하단 메뉴 위에 가격 + '봉인 풀기' 바가 늘 보인다
test('결과 화면 하단 구매 바: 잠긴 동안만 가격과 함께 보이고, 누르면 결제창, 열리면 사라진다', async () => {
  const { ctx, page } = await openPage(browser);
  assert.ok(await page.isHidden('#buyBar'), '대문에서는 없음');
  await fillAndSubmit(page, ME);
  assert.ok(await page.isVisible('#buyBar'), '잠긴 결과 화면: 보임');
  assert.match(await page.textContent('#buyBar'), /4,900원/);
  const r = await page.evaluate(() => { const b = document.getElementById('buyBar').getBoundingClientRect(), t = document.getElementById('tabBar').getBoundingClientRect(); return { bBottom: b.bottom, tTop: t.top, bLeft: b.left, bRight: b.right, vw: innerWidth }; });
  assert.ok(r.bBottom <= r.tTop + 1 && r.bLeft >= 0 && r.bRight <= r.vw, `하단 메뉴 바로 위, 화면 안: ${JSON.stringify(r)}`);
  await page.click('.buy-bar-btn'); await page.waitForTimeout(200);
  assert.ok(await page.isVisible('#paymentModal'), '누르면 결제창');
  await page.click('#payButton'); await page.waitForTimeout(400);   // 테스트 결제 → 리포트 열림
  assert.equal(await viewOf(page), 'viewReport');
  assert.ok(await page.isHidden('#buyBar'), '리포트 화면: 없음');
  await page.evaluate(() => goToStep(3));
  assert.ok(await page.isHidden('#buyBar'), '열린 사주의 결과 화면: 없음');
  await page.evaluate(() => goToStep(1));
  assert.ok(await page.isHidden('#buyBar'));
  assert.deepEqual(page._errors, []);
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

// 업데이트 47 (2026-11-10 보안 점검 4번): 확인이 한 번 끊겨도 손님이 결제 번호를 잃지 않게 화면에 남는 상자를 띄우고,
//   대기 기록을 남겨 다시 들어오면(또는 '다시 확인'을 누르면) 서버에 다시 묻는다. 여는 것은 서버가 '결제 완료'라고 답할 때만.
const failBoxShown = page => page.evaluate(() => getComputedStyle(document.getElementById('payFailModal')).display !== 'none');
const pendingOf = page => page.evaluate(() => JSON.parse(localStorage.getItem('byeoksa.pending.v1') || 'null'));
const paidKeys = page => page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('byeoksa.paid.')).length);
/** 결제는 했는데 확인 서버가 답을 못 한 상태(502)를 만든다 */
async function payWithVerifyDown(page) {
  await page.route('https://verify.test/**', r => r.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ status: 'UPSTREAM_ERROR' }) }));
  await page.evaluate(() => { PAYMENT.verifyUrl = 'https://verify.test/api/payment/complete'; });
  await fillAndSubmit(page, ME);
  await page.evaluate(() => openPaymentModal());
  await page.click('#payButton'); await page.waitForTimeout(500);
}

test('서버 확인이 실패하면 열지 않는다 — 사라지는 알림 대신 결제 번호가 적힌 상자가 남고, 대기 기록도 남는다 (verifyUrl)', async () => {
  const { ctx, page } = await livePage('o => ({ paymentId: o.paymentId })');
  await payWithVerifyDown(page);
  assert.ok(await locked(page));
  assert.ok(await failBoxShown(page), '남는 안내 상자');
  const [call] = await page.evaluate(() => window.__calls);
  assert.equal(await page.textContent('#payFailId'), call.paymentId);
  const box = await page.textContent('#payFailModal');
  for (const w of ['결제 확인이 끊겼소', '다시 결제하지 마시오', '다시 확인', '번호 복사', '고객센터에 문의']) assert.ok(box.includes(w), w);
  assert.equal((await pendingOf(page)).paymentId, call.paymentId, '대기 기록은 남긴다');
  assert.equal(await paidKeys(page), 0);
  await page.waitForTimeout(2800);
  assert.ok(await failBoxShown(page), '알림처럼 저절로 사라지지 않는다');
  // 고객센터에 문의: 결제 번호가 문의 칸에 들어간다
  await page.click('#payFailHelp'); await page.waitForTimeout(200);
  assert.equal(await viewOf(page), 'viewHelp');
  assert.equal(await page.inputValue('#helpOrder'), call.paymentId);
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

test("확인이 끊긴 뒤 '다시 확인'을 누르면: 서버가 결제 완료라고 답할 때 리포트가 열린다 · 아직 답을 못 하면 그대로", async () => {
  const { ctx, page } = await livePage('o => ({ paymentId: o.paymentId })');
  await payWithVerifyDown(page);
  await page.click('#payFailRetry'); await page.waitForTimeout(400);
  assert.ok(await failBoxShown(page), '아직 답이 없으면 상자는 그대로');
  assert.match(await page.textContent('#toastMsg'), /아직 확인하지 못했소/);
  assert.ok(await locked(page));
  await page.unroute('https://verify.test/**');
  await page.route('https://verify.test/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'PAID' }) }));
  await page.click('#payFailRetry'); await page.waitForTimeout(500);
  assert.equal(await failBoxShown(page), false);
  assert.equal(await viewOf(page), 'viewReport');
  assert.equal(await pendingOf(page), null);
  assert.equal(await paidKeys(page), 1);
  await page.waitForTimeout(700);
  assert.match(await page.textContent('#toastMsg'), /결제를 다시 확인했소\. 봉인을 풀었소\./);
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

test('확인이 끊긴 손님이 다시 들어오면: 서버에 다시 물어 결제 완료면 보던 풀이를 다시 그리고 리포트를 연다', async () => {
  const { ctx, page } = await livePage('o => ({ paymentId: o.paymentId })');
  await payWithVerifyDown(page);
  assert.ok(await locked(page));
  await page.reload(); await page.waitForTimeout(1500);   // 새로 열면 확인 서버(helpers의 가짜 서버)가 '결제 완료'라고 답한다
  assert.equal(await viewOf(page), 'viewReport', '입력을 다시 하지 않아도 열린다');
  assert.equal(await pendingOf(page), null);
  assert.equal(await paidKeys(page), 1);
  assert.equal(await failBoxShown(page), false);
  assert.match(await page.textContent('#toastMsg'), /결제를 다시 확인했소/);
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

test('다시 들어왔을 때 서버 답에 따라: 취소·실패는 대기 기록을 지우고 잠근 채 · 아직 결제 전일 수 있는 답은 1시간이 지난 기록만 지움 · 통신 오류는 그대로 · 7일이 지나면 묻지 않고 지움', async () => {
  const cases = [
    // [확인 서버 답, 대기 기록 나이(분), 남아야 하나]
    [[400, { status: 'INVALID', reason: 'status:CANCELLED' }], 5, false],
    [[400, { status: 'INVALID', reason: 'status:FAILED' }], 5, false],
    [[404, { status: 'NOT_FOUND' }], 5, true],            // 다른 탭에서 결제하는 중일 수 있다
    [[400, { status: 'INVALID', reason: 'status:READY' }], 5, true],
    [[404, { status: 'NOT_FOUND' }], 120, false],         // 두 시간 전 것 — 결제창을 닫고 떠난 기록
    [[400, { status: 'INVALID', reason: 'status:READY' }], 120, false],
    [[0, null], 120, true],                               // 통신 오류
    [[502, { status: 'UPSTREAM_ERROR' }], 120, true],
    [[400, { status: 'INVALID', reason: 'amount' }], 120, true],   // 금액 불일치 등은 손님 탓이 아니다 — 문의로 풀 일
    [[200, { status: 'PAID' }], 8 * 24 * 60, false]       // 7일이 지난 기록은 묻지 않고 지운다(열지도 않는다)
  ];
  for (const [[status, body], ageMin, kept] of cases) {
    const { ctx, page } = await livePage('o => ({ paymentId: o.paymentId })');
    await fillAndSubmit(page, ME);
    await page.evaluate(min => {
      const sd = currentSajuData;
      localStorage.setItem('byeoksa.pending.v1', JSON.stringify({ paymentId: 'byeoksa-test-recheck', productId: 'report', subjectKey: sajuKey(sd),
        data: { y: sd.y, m: sd.m, d: sd.d, hourVal: sd.hourVal, genderVal: sd.genderVal, userJob: sd.userJob, userMajor: '', userHobby: '', userDream: sd.userDream }, at: Date.now() - min * 60000 }));
    }, ageMin);
    await reloadWithVerifyAnswer(page, status, body);
    const label = `${status} ${JSON.stringify(body)} · ${ageMin}분 전`;
    assert.equal(!!(await pendingOf(page)), kept, `${label}: 대기 기록`);
    assert.equal(await paidKeys(page), 0, `${label}: 열림 표시는 생기지 않는다`);
    assert.notEqual(await viewOf(page), 'viewReport', label);
    assert.equal(await failBoxShown(page), false, `${label}: 다시 들어왔을 때는 조용히`);
    assert.deepEqual(page._errors, [], label);
    await ctx.close();
  }
});

test('휴대폰 결제 페이지에서 돌아오면: 맡겨 둔 사주를 다시 풀고 리포트를 연다, 주소는 깨끗해진다', async () => {
  const { ctx, page } = await openPage(browser);
  await page.evaluate(() => { const data = { y: 2002, m: 10, d: 4, hourVal: -1, genderVal: 'M', userJob: '대학생', userMajor: '', userHobby: '', userDream: '창업' };
    localStorage.setItem('byeoksa.pending.v1', JSON.stringify({ paymentId: 'byeoksa-abc', productId: 'report', subjectKey: sajuKey(data), data, at: Date.now() })); });
  await page.goto('file://' + SITE + '?pay=return&paymentId=byeoksa-abc&transactionType=PAYMENT&txId=tx-9');
  await page.waitForTimeout(500);
  assert.equal(await viewOf(page), 'viewReport');
  assert.match(await page.textContent('#reportSummary'), /태어난 날 을사/);
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

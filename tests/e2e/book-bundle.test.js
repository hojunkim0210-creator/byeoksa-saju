// 리포트 책 넘김 + 전부 묶음 보따리(10,900원) 테스트
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium, openPage, fillAndSubmit } = require('./helpers');

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

const ME = { y: '2002', m: '10', d: '4', hour: '-1', gender: 'M', job: '대학생', dream: '개발자로서의 성공' };
const PROFILE = { y: 2002, m: 10, d: 4, hour: -1, gender: 'M' };
const viewOf = page => page.evaluate(() => [...document.querySelectorAll('.app-container > .view-step')].find(v => v.style.display !== 'none').id);
const shownPages = page => page.evaluate(() => BOOK.pages.map((p, i) => p.els.every(el => el.offsetParent !== null) ? i : -1).filter(i => i >= 0));

async function unlockReport(page) {
  await fillAndSubmit(page, ME);
  await page.evaluate(() => openPaymentModal());
  await page.click('#payButton'); await page.waitForTimeout(300);
}

test('리포트 책: 8장, 한 번에 한 장만 보이고, 넘기면 그 장 첫머리가 화면 위에 맞춰진다', async () => {
  const { ctx, page } = await openPage(browser);
  await unlockReport(page);
  assert.equal(await viewOf(page), 'viewReport');
  assert.equal(await page.evaluate(() => BOOK.pages.length), 8);
  assert.deepEqual(await shownPages(page), [0]);
  assert.match(await page.textContent('#bookCount'), /^1 \/ 8$/);
  assert.ok(await page.isDisabled('#bookPrev'));
  for (let i = 1; i < 8; i++) {
    await page.click('#bookNext'); await page.waitForTimeout(80);
    assert.deepEqual(await shownPages(page), [i]);
    // 이 장의 첫 요소가 쪽 표시줄 바로 아래(화면 위쪽)에 있어야 한다
    const r = await page.evaluate(i => {
      const el = BOOK.pages[i].els[0].getBoundingClientRect(), bar = document.getElementById('bookBar').getBoundingClientRect();
      return { top: el.top, barBottom: bar.bottom };
    }, i);
    assert.ok(r.top >= r.barBottom - 1 && r.top < r.barBottom + 40, `${i}장 위치 ${JSON.stringify(r)}`);
  }
  assert.match(await page.textContent('#bookNext'), /첫 장으로/);
  assert.ok(await page.isVisible('.talisman-canvas'));
  await page.click('#bookNext'); await page.waitForTimeout(80);
  assert.deepEqual(await shownPages(page), [0], '마지막 장에서 누르면 첫 장');
  await page.click('#bookDots .book-dot:nth-child(5)'); await page.waitForTimeout(80);
  assert.deepEqual(await shownPages(page), [4], '점을 누르면 그 장으로');
  await page.click('#bookPrev'); await page.waitForTimeout(80);
  assert.deepEqual(await shownPages(page), [3]);
  // 장 이름이 깨지지 않는다
  const names = await page.evaluate(() => BOOK.pages.map(p => p.name));
  for (const n of names) assert.ok(n && !/undefined|null/.test(n), n);
  assert.ok(names.some(n => /^20\d\d~20\d\d년/.test(n)), names.join(' | '));
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

test('리포트 책: 옆으로 밀면 넘어가고, 인쇄할 때는 모든 장이 펼쳐진다', async () => {
  const { ctx, page } = await openPage(browser);
  await unlockReport(page);
  const swipe = (x0, x1) => page.evaluate(([x0, x1]) => {
    const b = document.getElementById('reportBook');
    const t = (x) => new Touch({ identifier: 1, target: b, clientX: x, clientY: 400 });
    b.dispatchEvent(new TouchEvent('touchstart', { touches: [t(x0)], changedTouches: [t(x0)] }));
    b.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t(x1)] }));
  }, [x0, x1]);
  await swipe(320, 80); await page.waitForTimeout(80);
  assert.deepEqual(await shownPages(page), [1]);
  await swipe(80, 320); await page.waitForTimeout(80);
  assert.deepEqual(await shownPages(page), [0]);
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  assert.equal(await page.evaluate(() => document.querySelectorAll('.book-off').length), 0);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  assert.deepEqual(await shownPages(page), [0]);
  await ctx.close();
});

test('묶음: 대문 진열에 10,900원(따로 사면 13,700원), 생년월일이 없으면 입력 화면으로', async () => {
  const { ctx, page } = await openPage(browser);
  await page.evaluate(() => { document.getElementById('introGateModal').style.display = 'none'; goToStep(1); });
  const t = (await page.textContent('.shop-item-bundle')).replace(/\s+/g, ' ');
  assert.ok(t.includes('10,900원') && t.includes('13,700원'), t);
  await page.click('.shop-item-bundle'); await page.waitForTimeout(200);
  assert.equal(await viewOf(page), 'viewInput');
  await ctx.close();
});

test('묶음 결제 한 번이면 리포트·신년운세·궁합 상세가 모두 열리고, 다른 생년월일은 잠겨 있다', async () => {
  const { ctx, page } = await openPage(browser);
  await page.evaluate(p => { document.getElementById('introGateModal').style.display = 'none'; localStorage.setItem('byeoksa.profile.v1', JSON.stringify(p)); goToStep(1); }, PROFILE);
  await page.click('.shop-item-bundle'); await page.waitForTimeout(200);
  const modal = (await page.textContent('#productModal')).replace(/\s+/g, ' ');
  for (const w of ['천명 리포트', '신년운세', '궁합 상세', '13,700원', '10,900원', '만 19세 미만', '청약철회']) assert.ok(modal.includes(w), w);
  assert.ok(!modal.includes('부적'), '묶음 결제창에 부적 없음 (2026-10-19 카드사 심사)');
  await page.click('#productPayBtn'); await page.waitForTimeout(300);
  assert.match(await page.textContent('#toastMsg'), /보따리가 풀렸다/);
  assert.match(await page.textContent('[data-shop-price="bundle"]'), /다 풀었다/);

  // 신년운세
  await page.evaluate(() => openFeature('newyear')); await page.waitForTimeout(200);
  assert.equal(await page.$('#nyBuy'), null, '신년운세 봉인 없음');
  // 궁합 상세 (나 = 묶음 산 사람, 상대는 누구든)
  await page.evaluate(() => openFeature('compat')); await page.waitForTimeout(150);
  await page.fill('#cbY', '1999'); await page.fill('#cbM', '3'); await page.fill('#cbD', '21');
  await page.click('#compatGo'); await page.waitForTimeout(250);
  assert.equal(await page.$('#compatBuy'), null, '궁합 상세 봉인 없음');
  assert.ok(await page.$('.compat-detail'));
  // 천명 리포트
  await fillAndSubmit(page, ME);
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('paywallOverlay')).display), 'none');
  // 다른 생년월일
  await fillAndSubmit(page, { ...ME, d: '5' });
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.getElementById('paywallOverlay')).display), 'none', '다른 사주는 잠김');
  await page.evaluate(() => openFeature('newyear')); await page.waitForTimeout(200);
  assert.ok(await page.$('#nyBuy'), '다른 사람 신년운세는 잠김');
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

test('묶음: 리포트 결제창·봉인 카드에서 권유하고, 리포트 결제창에서 사면 리포트 책이 바로 열린다', async () => {
  const { ctx, page } = await openPage(browser);
  await fillAndSubmit(page, ME);
  await page.evaluate(() => openPaymentModal());
  assert.match(await page.textContent('#reportBundleBtn'), /전부 10,900원/);
  await page.click('#reportBundleBtn'); await page.waitForTimeout(200);
  assert.ok(await page.isVisible('#productModal'));
  assert.ok(await page.isHidden('#paymentModal'));
  await page.click('#productPayBtn'); await page.waitForTimeout(400);
  assert.equal(await viewOf(page), 'viewReport');
  assert.deepEqual(await shownPages(page), [0]);
  // 봉인 카드 권유는 묶음을 가진 사람에게는 안 보인다
  await page.evaluate(() => openFeature('newyear')); await page.waitForTimeout(250);
  assert.equal(await page.$('[data-bundle-from]'), null);
  await ctx.close();

  const fresh = await openPage(browser);
  await fresh.page.evaluate(p => { document.getElementById('introGateModal').style.display = 'none'; localStorage.setItem('byeoksa.profile.v1', JSON.stringify(p)); openFeature('newyear'); }, PROFILE);
  await fresh.page.waitForTimeout(200);
  assert.ok(await fresh.page.$('[data-bundle-from="newyear"]'), '신년운세 봉인 카드에 묶음 권유');
  await fresh.page.click('[data-bundle-from="newyear"]'); await fresh.page.waitForTimeout(200);
  assert.match(await fresh.page.textContent('#productModal'), /전부 묶음 보따리/);
  await fresh.ctx.close();
});

test('묶음 실결제(포트원 흉내): 10,900원·묶음 상품명으로 요청', async () => {
  const { ctx, page } = await openPage(browser);
  await page.evaluate(p => {
    document.getElementById('introGateModal').style.display = 'none';
    localStorage.setItem('byeoksa.profile.v1', JSON.stringify(p)); goToStep(1);
    PAYMENT.mode = 'portone'; PAYMENT.storeId = 's'; PAYMENT.channelKey = 'c'; window.__calls = [];
    window.PortOne = { requestPayment: async o => { window.__calls.push(o); return { paymentId: o.paymentId }; } };
  }, PROFILE);
  await page.click('.shop-item-bundle'); await page.waitForTimeout(150);
  await page.click('#productPayBtn'); await page.waitForTimeout(400);
  const [c] = await page.evaluate(() => window.__calls);
  assert.equal(c.totalAmount, 10900);
  assert.equal(c.orderName, '벽사신견 전부 묶음 보따리');
  assert.match(await page.textContent('#toastMsg'), /보따리가 풀렸다/);
  await ctx.close();
});

test('결과 화면 헌화비 칸: 처음부터 묶음(10,900원·13,700원)을 앞에, 따로 사는 풀이 셋도 모두 보여 준다', async () => {
  const { ctx, page } = await openPage(browser);
  await fillAndSubmit(page, ME);
  const t = (await page.textContent('#paywallOverlay .price-box')).replace(/\s+/g, ' ');
  for (const w of ['전부 묶음 보따리', '10,900', '13,700원', '하나씩 따로', '천명 리포트', '4,900원', '신년운세', '궁합 상세 리포트', '3,900원']) assert.ok(t.includes(w), w);
  assert.ok(!t.includes('부적'), '헌화비 칸에 부적 없음 (2026-10-19 카드사 심사)');
  assert.ok(!/undefined|NaN/.test(t), t);
  assert.equal(await page.locator('.plan-row').count(), 3);
  // 리포트 줄 → 리포트 결제창, 신년운세 줄 → 신년운세 화면
  await page.click('#planRowReport'); await page.waitForTimeout(150);
  assert.ok(await page.isVisible('#paymentModal'));
  await page.evaluate(() => closePaymentModal());
  await page.click('.plan-row:has-text("신년운세")'); await page.waitForTimeout(250);
  assert.equal(await viewOf(page), 'viewNewYear');
  // 묶음 버튼으로 바로 산다
  await page.evaluate(() => goToStep(3)); await page.waitForTimeout(150);
  await page.click('.btn-pay-bundle'); await page.waitForTimeout(200);
  assert.match(await page.textContent('#productModal'), /전부 묶음 보따리/);
  await page.click('#productPayBtn'); await page.waitForTimeout(400);
  assert.equal(await viewOf(page), 'viewReport');
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

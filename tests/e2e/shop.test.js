// 유료 상품(신년운세·궁합 상세·전부 묶음)과 공유 할인 테스트 (소원 부적은 2026-10-19 카드사 심사 "부적 상품 불가"로 뺌)
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium, openPage, SITE } = require('./helpers');

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

const BROKEN = /undefined|NaN|\[object Object\]|null(?![가-힣])/;
const ME = { y: 2002, m: 10, d: 4, hour: -1, gender: 'M' };
async function withMe(page, p = ME) {
  await page.evaluate(p => { document.getElementById('introGateModal').style.display = 'none'; localStorage.setItem('byeoksa.profile.v1', JSON.stringify(p)); goToStep(1); }, p);
}
const text = (page, sel) => page.evaluate(s => document.querySelector(s).innerText, sel);

test('대문 진열: 유료 풀이 3가지 + 전부 묶음과 가격, 부적 상품은 없다', async () => {
  const { ctx, page } = await openPage(browser);
  await withMe(page);
  const items = await page.$$eval('.shop-item', els => els.map(e => e.innerText.replace(/\s+/g, ' ')));
  assert.equal(items.length, 4);
  assert.ok(!items.some(t => t.includes('부적')), '부적 상품 없음');
  assert.equal(await page.evaluate(() => typeof PRODUCTS.wish), 'undefined');
  assert.equal(await page.$('#viewWish'), null);
  for (const [name, price] of [['천명 리포트', '4,900원'], ['신년운세', '4,900원'], ['궁합 상세', '3,900원'], ['전부 묶음', '10,900원']]) {
    assert.ok(items.some(t => t.includes(name) && t.includes(price)), name + ' ' + price);
  }
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

test('신년운세: 무료로 12달 점수·볕 드는 달·몸 사릴 달, 결제하면 12달 풀이가 열리고 다시 와도 열려 있다', async () => {
  const { ctx, page } = await openPage(browser);
  await withMe(page);
  await page.evaluate(() => openFeature('newyear')); await page.waitForTimeout(200);
  assert.equal(await page.$$eval('.ny-bar', e => e.length), 12);
  const free = await text(page, '#newYearBody');
  assert.match(free, /볕 드는 달/); assert.match(free, /몸 사릴 달/); assert.match(free, /봉인 안에/);
  assert.ok(!BROKEN.test(free), free.match(/.{0,20}(undefined|NaN|null).{0,20}/));
  assert.equal(await page.$$eval('.ny-month', e => e.length), 0, '결제 전엔 달별 풀이 없음');
  await page.click('#nyBuy'); await page.waitForTimeout(150);
  const modal = await text(page, '#productModal');
  for (const w of ['벽사신견 신년운세', '4,900원', '청약철회', '만 19세 미만']) assert.ok(modal.includes(w), w);
  await page.click('#productPayBtn'); await page.waitForTimeout(300);
  assert.equal(await page.$$eval('.ny-month', e => e.length), 12);
  const full = await text(page, '#newYearBody');
  assert.ok(!BROKEN.test(full), full.match(/.{0,30}(undefined|NaN|null).{0,20}/));
  assert.match(full, /분야별로 기운이 몰리는 달/); assert.match(full, /한 해 비방/);
  await page.evaluate(() => { goToStep(1); openFeature('newyear'); });
  assert.equal(await page.$$eval('.ny-month', e => e.length), 12, '같은 사람은 다시 열림');
  await page.evaluate(() => localStorage.setItem('byeoksa.profile.v1', JSON.stringify({ y: 1990, m: 3, d: 10, hour: 6, gender: 'F' })));
  await page.evaluate(() => openFeature('newyear'));
  assert.equal(await page.$$eval('.ny-month', e => e.length), 0, '다른 사람은 잠김');
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

const PEOPLE = [[1990, 3, 10, 6, 'M'], [1985, 7, 22, 2, 'F'], [2001, 11, 3, -1, 'M'], [1972, 1, 15, 9, 'F'], [1995, 5, 30, 11, 'M'], [1968, 9, 9, 0, 'F'], [2004, 2, 14, 4, 'F'], [1979, 12, 25, 7, 'M']]
  .map(([y, m, d, hour, gender]) => ({ y, m, d, hour, gender }));

test('신년운세 풀이가 사람마다 다르고 깨진 값이 없다', async () => {
  const { ctx, page } = await openPage(browser);
  const out = await page.evaluate(people => {
    const S = window.BYEOKSA_SHOP, X = window.BYEOKSA_EXTRAS;
    return people.map(p => {
      const D = S.newYearData(p);
      return { ny: D.months.map(m => m.score + m.sipsin).join(',') + D.best.map(m => m.m).join(',') };
    });
  }, PEOPLE);
  assert.ok(new Set(out.map(o => o.ny)).size >= 6, '신년운세 달 흐름');
  await ctx.close();
});

test('궁합 상세: 무료 결과 아래 봉인, 결제하면 두 사람 이름으로 열린다 (이름은 글자로만 표시)', async () => {
  const { ctx, page } = await openPage(browser);
  await withMe(page);
  await page.evaluate(() => openFeature('compat'));
  await page.fill('#caName', '<b>호준</b>'); await page.fill('#cbName', '민지');
  await page.fill('#cbY', '2001'); await page.fill('#cbM', '5'); await page.fill('#cbD', '17');
  await page.click('#compatGo'); await page.waitForTimeout(300);
  assert.ok(await page.isVisible('#compatBuy'));
  await page.click('#compatBuy'); await page.click('#productPayBtn'); await page.waitForTimeout(300);
  const t = await text(page, '#compatDetail');
  assert.match(t, /싸우는 패턴/); assert.match(t, /함께하면 좋은 해/); assert.match(t, /민지/);
  assert.ok(t.includes('<b>호준</b>'), '이름 속 꺾쇠는 글자로');
  assert.equal(await page.$$eval('#compatDetail b', e => e.filter(x => x.textContent === '호준').length), 0, 'HTML로 해석되면 안 됨');
  assert.ok(!BROKEN.test(t), t.match(/.{0,30}(undefined|NaN|null).{0,20}/));
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

test('공유 할인: 공유하면 1,000원 할인이 붙고, 한 번 쓰면 사라진다', async () => {
  const { ctx, page } = await openPage(browser);
  await withMe(page);
  await page.evaluate(() => { navigator.share = async () => {}; });
  await page.evaluate(() => shareSite()); await page.waitForTimeout(100);
  const shelf = await text(page, '.shop-shelf');
  assert.ok(shelf.includes('3,900원') && shelf.includes('900원'), shelf);
  await page.evaluate(() => openFeature('newyear')); await page.waitForTimeout(300);
  await page.click('#nyBuy');
  assert.match(await text(page, '#productModal'), /3,900원 \(정가 4,900원, 1,000원 할인\)/);
  await page.click('#productPayBtn'); await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => activeCoupon()), null, '사용 후 사라짐');
  await page.evaluate(() => shareSite());
  assert.equal(await page.evaluate(() => activeCoupon()), null, '한 기기에서 한 번만');
  await ctx.close();
});

test('공유 링크(?from=share)로 들어오면 할인, 주소는 깨끗해진다', async () => {
  const { ctx, page } = await openPage(browser, { url: 'file://' + SITE + '?from=share' });
  assert.ok(await page.evaluate(() => !!activeCoupon()));
  assert.ok(!page.url().includes('from=share'));
  await ctx.close();
});

test('포트원 결제: 신년운세는 상품명·할인가로 요청된다', async () => {
  const { ctx, page } = await openPage(browser);
  await withMe(page);
  await page.evaluate(() => {
    PAYMENT.mode = 'portone'; PAYMENT.storeId = 'store-t'; PAYMENT.channelKey = 'channel-key-t';
    window.__calls = []; window.PortOne = { requestPayment: async o => { window.__calls.push(o); return { paymentId: o.paymentId }; } };
    grantCoupon('invite');
  });
  await page.evaluate(() => openFeature('newyear'));
  await page.click('#nyBuy'); await page.click('#productPayBtn'); await page.waitForTimeout(400);
  const [c] = await page.evaluate(() => window.__calls);
  assert.equal(c.orderName, '벽사신견 신년운세'); assert.equal(c.totalAmount, 3900);
  assert.equal(JSON.parse(c.customData).product, 'newyear');
  assert.equal(await page.$$eval('.ny-month', e => e.length), 12);
  await ctx.close();
});

test('할인 코드: 맞는 코드는 1,000원 할인, 틀린 코드는 안내만', async () => {
  const { ctx, page } = await openPage(browser);
  await withMe(page);
  await page.evaluate(() => openFeature('newyear')); await page.waitForTimeout(300);
  await page.click('#nyBuy');
  await page.click('#productModal .promo-fold summary');   // 코드 칸은 접혀 있다
  await page.fill('#productModal .promo-input', 'nope'); await page.click('#productModal .promo-apply'); await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => activeCoupon()), null);
  await page.fill('#productModal .promo-input', 'byeoksa'); await page.click('#productModal .promo-apply'); await page.waitForTimeout(150);
  assert.match(await page.evaluate(() => document.querySelector('#productModal').innerText), /3,900원 \(정가 4,900원/);
  await page.evaluate(() => { closePaymentModal(); });
  await page.evaluate(() => { goToStep(1); });
  await ctx.close();
});

test('휴대폰 결제 복귀: 신년운세도 돌아오면 열린다', async () => {
  for (const [productId, check] of [['newyear', '.ny-month']]) {
    const { ctx, page } = await openPage(browser);
    await page.evaluate(pid => {
      const p = { y: 2002, m: 10, d: 4, hour: -1, gender: 'M' };
      const key = SajuCore.hashSeed(`${p.y}-${p.m}-${p.d}-${p.hour}-${p.gender}`).toString(36) + '.' + window.BYEOKSA_SHOP.targetYear();
      const data = p;
      localStorage.setItem('byeoksa.pending.v1', JSON.stringify({ paymentId: 'byeoksa-r-1', productId: pid, subjectKey: key, data, at: Date.now() }));
    }, productId);
    await page.goto('file://' + SITE + '?pay=return&paymentId=byeoksa-r-1');
    await page.waitForTimeout(800);
    assert.ok(await page.$(check), productId);
    assert.deepEqual(page._errors, []);
    await ctx.close();
  }
});

test('한 화면 안에서 같은 문장이 되풀이되지 않는다 (신년운세·결과+리포트)', async () => {
  const dup = text => {
    const sents = text.replace(/\s+/g, ' ').split(/(?<=[.!?"”])\s+/).map(s => s.trim()).filter(s => s.length >= 25);
    const c = {}; sents.forEach(s => (c[s] = (c[s] || 0) + 1));
    return Object.keys(c).filter(k => c[k] > 1);
  };
  for (const p of PEOPLE.slice(0, 5)) {
    const { ctx, page } = await openPage(browser);
    await withMe(page, p);
    await page.evaluate(() => openFeature('newyear')); await page.click('#nyBuy'); await page.click('#productPayBtn'); await page.waitForTimeout(200);
    assert.deepEqual(dup(await text(page, '#viewNewYear')), [], `신년운세 ${p.y}`);
    await ctx.close();
  }
});

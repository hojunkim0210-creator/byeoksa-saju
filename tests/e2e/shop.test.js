// 유료 상품(신년운세·궁합 상세·소원 부적)과 공유 할인 테스트
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

test('대문 진열: 유료 풀이 4가지 + 전부 묶음과 가격', async () => {
  const { ctx, page } = await openPage(browser);
  await withMe(page);
  const items = await page.$$eval('.shop-item', els => els.map(e => e.innerText.replace(/\s+/g, ' ')));
  assert.equal(items.length, 5);
  for (const [name, price] of [['천명 리포트', '4,900원'], ['신년운세', '4,900원'], ['궁합 상세', '3,900원'], ['소원 부적', '1,900원'], ['전부 묶음', '10,900원']]) {
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

test('신년운세·소원 부적 풀이가 사람마다 다르고 깨진 값이 없다', async () => {
  const { ctx, page } = await openPage(browser);
  const out = await page.evaluate(people => {
    const S = window.BYEOKSA_SHOP, X = window.BYEOKSA_EXTRAS;
    return people.map(p => {
      const D = S.newYearData(p);
      const sj = X.readSaju(p);
      const wishes = Object.keys(S.WISHES).map(w => { const r = S.wishReading(sj, w); return r.label + '|' + r.text + '|' + r.goodMonths.map(m => m.m).join(','); });
      return { ny: D.months.map(m => m.score + m.sipsin).join(',') + D.best.map(m => m.m).join(','), wishes };
    });
  }, PEOPLE);
  assert.ok(new Set(out.map(o => o.ny)).size >= 6, '신년운세 달 흐름');
  for (let w = 0; w < 5; w++) assert.ok(new Set(out.map(o => o.wishes[w])).size >= 3, '소원 ' + w);
  for (const o of out) for (const s of o.wishes) assert.ok(!BROKEN.test(s), s);
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

test('소원 부적: 고르면 금테 부적(봉인), 결제하면 풀이·배경화면 저장 버튼', async () => {
  const { ctx, page } = await openPage(browser);
  await withMe(page);
  await page.evaluate(() => openFeature('wish'));
  assert.equal(await page.$$eval('.wish-card', e => e.length), 5);
  await page.click('.wish-card[data-wish="pass"]'); await page.waitForTimeout(400);
  assert.ok(await page.isVisible('.wish-stage.is-sealed'));
  const painted = await page.evaluate(() => { const c = document.getElementById('wishCanvas'); const d = c.getContext('2d').getImageData(450, 120, 1, 1).data; return d[3] > 0; });
  assert.ok(painted, '부적이 그려짐');
  await page.click('#wishBuy'); await page.click('#productPayBtn'); await page.waitForTimeout(600);
  assert.ok(await page.isVisible('.wish-stage.is-open'));
  assert.ok(await page.isVisible('#wishSave'));
  const t = await text(page, '#wishBody');
  assert.match(t, /부적이 힘을 쓰는 달/); assert.ok(!BROKEN.test(t), t.match(/.{0,30}(undefined|NaN|null).{0,20}/));
  assert.ok(await page.isVisible('.wish-card[data-wish="pass"] .wish-owned'), '받은 소원 표시');
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
  await page.evaluate(() => openFeature('wish')); await page.click('.wish-card[data-wish="money"]'); await page.waitForTimeout(300);
  await page.click('#wishBuy');
  assert.match(await text(page, '#productModal'), /900원 \(정가 1,900원, 1,000원 할인\)/);
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
  await page.evaluate(() => openFeature('wish')); await page.click('.wish-card[data-wish="love"]'); await page.waitForTimeout(300);
  await page.click('#wishBuy');
  await page.fill('#productModal .promo-input', 'nope'); await page.click('#productModal .promo-apply'); await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => activeCoupon()), null);
  await page.fill('#productModal .promo-input', 'baekgu'); await page.click('#productModal .promo-apply'); await page.waitForTimeout(150);
  assert.match(await page.evaluate(() => document.querySelector('#productModal').innerText), /900원 \(정가 1,900원/);
  await page.evaluate(() => { closePaymentModal(); });
  await page.evaluate(() => { goToStep(1); });
  await ctx.close();
});

test('휴대폰 결제 복귀: 소원 부적·신년운세도 돌아오면 열린다', async () => {
  for (const [productId, check] of [['wish', '.wish-stage.is-open'], ['newyear', '.ny-month']]) {
    const { ctx, page } = await openPage(browser);
    await page.evaluate(pid => {
      const p = { y: 2002, m: 10, d: 4, hour: -1, gender: 'M' };
      const key = SajuCore.hashSeed(`${p.y}-${p.m}-${p.d}-${p.hour}-${p.gender}`).toString(36) + (pid === 'wish' ? '.money' : '.' + window.BYEOKSA_SHOP.targetYear());
      const data = pid === 'wish' ? { p, wishId: 'money' } : p;
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

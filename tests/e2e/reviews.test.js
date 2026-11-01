// 실제 손님 흔적 (2026-11-01 후기 1단계, 벤치마킹 ④): 후기·결제 수·후기 남기기 단추는 실제 값이 있을 때만 보이고, 없으면 흔적도 없다 (가짜 후기·가짜 숫자 금지)
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium, openPage, fillAndSubmit } = require('./helpers');

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

const home = page => page.evaluate(() => { document.getElementById('introGateModal').style.display = 'none'; goToStep(1); });
const hidden = (page, id) => page.evaluate(i => { const e = document.getElementById(i); return !e || e.hidden || getComputedStyle(e).display === 'none'; }, id);

test('기본: 후기 칸·결제 수·후기 남기기 단추가 모두 숨겨져 있다 (실제 값이 없으니)', async () => {
  const { ctx, page } = await openPage(browser);
  await home(page); await page.waitForTimeout(300);
  for (const id of ['reviewsHome', 'shopCount', 'reviewsPay']) assert.ok(await hidden(page, id), id + ' 숨김');
  await fillAndSubmit(page); await page.evaluate(() => openPaymentModal());
  assert.ok(await hidden(page, 'reviewsPay'), '결제창 후기 칸 숨김');
  await page.click('#payButton'); await page.waitForTimeout(400);
  assert.ok(await hidden(page, 'reviewAsk'), '폼 주소가 없으면 후기 남기기 없음');
  assert.ok(!/명이 봉인을 풀었다/.test(await page.evaluate(() => document.body.innerText)), '결제 수 문구 없음');
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

test('후기가 있으면 대문과 결제창에 "실제 구매자" 표시와 함께 보인다, 글은 글자 그대로(HTML 해석 안 함)', async () => {
  const { ctx, page } = await openPage(browser);
  await home(page);
  await page.evaluate(() => BYEOKSA_SHOP.setReviews([{ text: '밤에 읽고 소름 <b>x</b>', who: '제주 손님', when: '2026-11', verified: true }, { text: '둘째 줄', who: '', when: '', verified: false }]));
  const t = await page.evaluate(() => ({ hidden: document.getElementById('reviewsHome').hidden, n: document.querySelectorAll('#reviewsHomeList .review-item').length,
    first: document.querySelector('#reviewsHomeList .review-item').innerText, html: document.querySelector('#reviewsHomeList .review-text').innerHTML }));
  assert.equal(t.hidden, false); assert.equal(t.n, 2);
  assert.match(t.first, /밤에 읽고 소름/); assert.match(t.first, /제주 손님 · 실제 구매자 · 2026-11/);
  assert.ok(t.html.includes('&lt;b&gt;'), 'HTML 태그는 글자로 보인다');
  await fillAndSubmit(page); await page.evaluate(() => openPaymentModal());
  assert.equal(await hidden(page, 'reviewsPay'), false);
  assert.match(await page.textContent('#reviewsPay'), /밤에 읽고 소름/);
  await ctx.close();
});

test('결제 수: 서버가 센 수가 100 미만이면 숨기고, 100 이상이면 보이며, 서버 오류면 숨긴다', async () => {
  const { ctx, page } = await openPage(browser);
  await home(page);
  const show = n => page.evaluate(async n => {
    window.fetch = u => String(u).includes('/api/stats') ? Promise.resolve(new Response(JSON.stringify({ status: 'OK', paid: n }), { status: 200, headers: { 'Content-Type': 'application/json' } })) : Promise.reject(new Error('x'));
    await BYEOKSA_SHOP.renderStats(); const el = document.getElementById('shopCount'); return { hidden: el.hidden, text: el.textContent };
  }, n);
  assert.equal((await show(7)).hidden, true, '7명은 숨김');
  const many = await show(120); assert.equal(many.hidden, false); assert.match(many.text, /120명이 봉인을 풀었다/);
  const bad = await page.evaluate(async () => { window.fetch = () => Promise.resolve(new Response('oops', { status: 502 })); await BYEOKSA_SHOP.renderStats(); return document.getElementById('shopCount').hidden; });
  assert.equal(bad, true, '서버 오류면 숨김');
  await ctx.close();
});

test('후기 남기기: 폼 주소가 있으면 리포트 끝에 새 창 링크와 결제 번호가 보인다', async () => {
  const { ctx, page } = await openPage(browser);
  await page.evaluate(() => BYEOKSA_SHOP.setReviewFormUrl('https://forms.example.com/byeoksa'));
  await fillAndSubmit(page); await page.evaluate(() => openPaymentModal()); await page.click('#payButton'); await page.waitForTimeout(400);
  const r = await page.evaluate(() => { const a = document.getElementById('reviewAskLink'); return { hidden: document.getElementById('reviewAsk').hidden, href: a.href, target: a.target, rel: a.rel, id: document.getElementById('reviewAskId').textContent }; });
  assert.equal(r.hidden, false); assert.equal(r.href, 'https://forms.example.com/byeoksa'); assert.equal(r.target, '_blank'); assert.match(r.rel, /noopener/);
  assert.match(r.id, /결제 번호 test/);
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

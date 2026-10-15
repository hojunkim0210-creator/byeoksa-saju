// 공통 브라우저 헬퍼: 외부 네트워크(폰트·결제 SDK)는 차단하고 로컬 파일만 연다.
const path = require('path');
const { chromium } = require('playwright');

const SITE = path.resolve(__dirname, '../../site/index.html');
const FIXED_NOW = new Date('2026-10-12T10:00:00+09:00'); // 결과 재현성을 위한 고정 시각

async function openPage(browser, { width = 390, height = 844, url = 'file://' + SITE, now = FIXED_NOW } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page._errors = []; page._alerts = [];
  page.on('pageerror', e => page._errors.push(e.message));
  page.on('dialog', async d => { page._alerts.push(d.message()); await d.accept(); });
  await page.addInitScript(() => {
    window.__BYEOKSA_TEST__ = true;
    // 파일로 연 사이트에는 결제 확인 서버가 없으므로, 기본 주소('/api/payment/complete')만 '결제 완료'로 답하는 가짜 서버를 둔다
    const realFetch = window.fetch;
    window.fetch = (u, o) => u === '/api/payment/complete'
      ? Promise.resolve(new Response(JSON.stringify({ status: 'PAID' }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      : realFetch(u, o);
  });   // 첫 진입·풀이 의식 연출 건너뛰기
  if (now) await page.clock.setFixedTime(now);
  await page.route('**/*', r => {
    const u = r.request().url();
    (u.startsWith('file:') || u.startsWith('data:')) ? r.continue() : r.abort();
  });
  await page.goto(url);
  await page.waitForTimeout(300);
  // 사이트는 실결제(포트원) 모드로 배포된다. 자동 테스트는 기본을 '테스트 결제'로 돌려 놓고, 실결제 흐름은 각 테스트가 가짜 결제창으로 따로 검사한다.
  await page.evaluate(() => { if (typeof PAYMENT !== 'undefined') { PAYMENT.mode = 'test'; PAYMENT.verifyUrl = ''; if (typeof renderPaymentMode === 'function') renderPaymentMode(); } }).catch(() => {});
  return { ctx, page };
}

async function fillAndSubmit(page, { y = '1990', m = '3', d = '10', hour = '6', gender = 'M', job = '개발자', dream = '창업' } = {}) {
  await page.evaluate(() => { const m = document.getElementById('introGateModal'); if (m) m.style.display = 'none'; goToStep(2); });
  await page.fill('#year', y); await page.fill('#month', m); await page.fill('#day', d);
  await page.selectOption('#hourSelect', hour); await page.selectOption('#gender', gender);
  await page.fill('#userJob', job); await page.fill('#userDream', dream);
  await page.evaluate(() => submitAndGoToResult());
  await page.waitForTimeout(400);
}

module.exports = { chromium, SITE, FIXED_NOW, openPage, fillAndSubmit };

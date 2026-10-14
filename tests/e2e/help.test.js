// 고객센터: 바닥글·약관 링크로 열리고, 입력 검사를 하고, 메일·문자 글을 바르게 만든다 (아무것도 저장하지 않음)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path');
const { chromium, openPage, SITE } = require('./helpers');

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });
const shown = (page, id) => page.evaluate(v => getComputedStyle(document.getElementById(v)).display, id);

test('바닥글 "고객센터" 링크가 고객센터 화면을 연다', async () => {
  const { ctx, page } = await openPage(browser);
  await page.evaluate(() => { document.getElementById('introGateModal').style.display = 'none'; goToStep(1); });
  await page.click('.footer-links a:has-text("고객센터")');
  assert.equal(await shown(page, 'viewHelp'), 'flex');
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

test('약관 페이지에서 index.html#help로 오면 첫 연출 없이 고객센터가 열린다', async () => {
  const { ctx, page } = await openPage(browser, { url: 'file://' + SITE + '#help' });
  assert.equal(await shown(page, 'viewHelp'), 'flex');
  assert.equal(await shown(page, 'introGateModal'), 'none');
  await ctx.close();
});

test('입력 검사: 연락처·내용·동의가 없으면 막고, 다 맞으면 통과', async () => {
  const { ctx, page } = await openPage(browser, { url: 'file://' + SITE + '#help' });
  await page.click('#helpMail');
  assert.match(await page.textContent('#helpErr'), /휴대폰 번호를 적어/);
  await page.fill('#helpContact', '02-123'); await page.fill('#helpBody', '리포트가 안 열려요');
  await page.click('#helpMail');
  assert.match(await page.textContent('#helpErr'), /다시 확인/);
  await page.fill('#helpContact', '010-1234-5678'); await page.click('#helpMail');
  assert.match(await page.textContent('#helpErr'), /동의/);
  await page.check('input[name="helpReply"][value="email"]');
  assert.equal(await page.getAttribute('#helpContact', 'type'), 'email');
  const r = await page.evaluate(() => {
    const H = BYEOKSA_HELP;
    const base = { type: '환불 요청', order: '', reply: 'email', contact: 'a@b.co', body: '환불해 주세요', agree: true };
    return { ok: H.helpCheck(base), badMail: H.helpCheck({ ...base, contact: 'ab.co' }),
      mail: decodeURIComponent(H.helpMailUrl({ ...base, order: 'pay-1' })), sms: H.helpSmsUrl(base) };
  });
  assert.equal(r.ok, '');
  assert.match(r.badMail, /이메일 주소/);
  assert.match(r.mail, /^mailto:pathlogue\.help@gmail\.com\?subject=\[벽사신견 문의\] 환불 요청&body=/);
  assert.match(r.mail, /주문번호: pay-1/);
  assert.match(r.mail, /답변 받을 방법: 이메일 \(a@b\.co\)/);
  assert.match(r.sms, /^sms:01025829143\?&body=/);
  // 문의 내용은 기기에도 저장하지 않는다
  const stored = await page.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));
  assert.doesNotMatch(stored, /환불해 주세요|010-1234-5678/);
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

test('사업자 정보가 등록증과 같고, 옛 이메일이 남아 있지 않다', () => {
  const site = path.resolve(__dirname, '../../site');
  const read = f => fs.readFileSync(path.join(site, f), 'utf8');
  for (const f of ['index.html', 'legal.html']) {
    const s = read(f);
    assert.ok(s.includes('패스로그 (Pathlogue)'), f + ' 상호');
    assert.ok(s.includes('104-14-22768'), f + ' 등록번호');
    assert.ok(s.includes('원노형로 102, 101동 208호'), f + ' 주소');
    assert.ok(s.includes('pathlogue.help@gmail.com'), f + ' 이메일');
  }
  for (const f of ['index.html', 'legal.html', 'js/app.js', 'js/extras.js', 'js/shop.js']) assert.ok(!read(f).includes('ghwnstm02'), f + ' 옛 이메일');
});

// 끼워 넣기(XSS) 막기 (업데이트 46, 2026-11-10 보안 점검 1번 — marketing/보안점검_1110.md)
//   전에는 결과 링크 주소의 job·major·hobby·dream 값이 입력 칸에 들어간 뒤 걸러지지 않고 화면(innerHTML)에 들어가,
//   꿈 칸에 그림 태그를 넣은 주소를 열기만 해도 끼워 넣은 스크립트가 돌았다.
//   지금은 ① 주소에서 이 네 값을 받지 않고 ② 손님이 적은 네 값은 계산 전에 한 번 걸러(cleanUserText) 태그가 되지 못한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium, openPage, SITE } = require('./helpers');

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

const PAYLOADS = {
  job: '<svg onload="window.__xss=(window.__xss||0)+1">직장인',
  major: '"><img src=x onerror="window.__xss=(window.__xss||0)+1">',
  hobby: "'><iframe srcdoc='<script>parent.__xss=9</script>'></iframe>",
  dream: '<img src=x onerror="window.__xss=(window.__xss||0)+1">건물주'
};
/** 끼워 넣은 것이 화면에 생겼는지: 스크립트가 돌았는지 + 끼워 넣은 태그가 실제 요소가 됐는지 */
const injected = page => page.evaluate(() => ({
  ran: window.__xss || 0,
  nodes: document.querySelectorAll('img[src="x"], svg[onload], iframe[srcdoc], [onerror]:not(.ghost-img), [onload]:not(.ghost-img)').length   // .ghost-img 의 onload·onerror 는 사이트 자신의 귀신 그림 처리
}));
const consoleErrors = page => page._console.filter(t => !/^Failed to load resource|^Fetch API cannot load file:\/\/\/api\//.test(t));

test('결과 링크 주소의 job·major·hobby·dream 값은 받지 않는다 — 태그를 넣은 주소를 열어도 아무것도 끼어들지 않는다', async () => {
  const q = Object.entries(PAYLOADS).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const { ctx, page } = await openPage(browser, { url: `file://${SITE}?y=1990&m=3&d=10&h=6&g=M&${q}` });
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('.app-container > .view-step')].find(v => v.style.display !== 'none').id), 'viewResult', '결과 링크는 그대로 열린다');
  await page.evaluate(() => { unlockContent(); window.dispatchEvent(new Event('beforeprint')); }); await page.waitForTimeout(400);
  assert.deepEqual(await injected(page), { ran: 0, nodes: 0 });
  assert.deepEqual(await page.evaluate(() => ['userJob', 'userMajor', 'userHobby', 'userDream'].map(id => document.getElementById(id).value)), ['', '', '', ''], '주소의 네 값은 입력 칸에 넣지 않는다');
  assert.match(await page.textContent('#fitContent'), /이루고픈 천명|현재의 신분/, '적지 않았을 때의 기본 말로 풀이한다');
  assert.deepEqual(page._errors, []); assert.deepEqual(consoleErrors(page), []);
  await ctx.close();
});

test('손님이 칸에 직접 태그를 적어도(또는 결제 뒤 되살린 값에 들어 있어도) 글자로만 보이고 요소가 되지 않는다 — 무료 결과·리포트 6장·요약문', async () => {
  const { ctx, page } = await openPage(browser);
  await page.evaluate(() => { document.getElementById('introGateModal').style.display = 'none'; goToStep(2); });
  await page.fill('#year', '1994'); await page.fill('#month', '5'); await page.fill('#day', '17'); await page.selectOption('#gender', 'F');
  // maxlength는 사람이 치는 글만 막으므로, 프로그램이 넣는 값(결제 뒤 되살리기 등)처럼 직접 넣어 본다
  await page.evaluate(p => { for (const [k, v] of Object.entries(p)) document.getElementById('user' + k[0].toUpperCase() + k.slice(1)).value = v; }, PAYLOADS);
  await page.evaluate(() => submitAndGoToResult()); await page.waitForTimeout(500);
  await page.evaluate(() => { openPaymentModal(); closePaymentModal(); unlockContent(); window.dispatchEvent(new Event('beforeprint')); }); await page.waitForTimeout(500);
  assert.deepEqual(await injected(page), { ran: 0, nodes: 0 });
  const sd = await page.evaluate(() => ({ job: currentSajuData.userJob, major: currentSajuData.userMajor, hobby: currentSajuData.userHobby, dream: currentSajuData.userDream }));
  for (const v of Object.values(sd)) { assert.ok(!/[<>&"'`\\]/.test(v), `걸러지지 않은 글자: ${v}`); assert.ok([...v].length <= 40, `40자를 넘는다: ${v}`); }
  assert.match(await page.evaluate(() => document.getElementById('viewResult').innerText), /＜img src=x/, '적은 글은 글자로 보인다');
  // 결제 뒤 되살리기(휴대폰 결제 페이지 다녀오기)로 들어온 값도 같은 문을 지난다
  await page.evaluate(p => { PRODUCT_HOOKS.report.resume({ y: 1994, m: 5, d: 17, hourVal: -1, genderVal: 'F', userJob: p.job, userMajor: p.major, userHobby: p.hobby, userDream: p.dream }); }, PAYLOADS);
  await page.waitForTimeout(500);
  assert.deepEqual(await injected(page), { ran: 0, nodes: 0 });
  assert.deepEqual(page._errors, []); assert.deepEqual(consoleErrors(page), []);
  await ctx.close();
});

test("평범한 글은 깨지지 않는다 — 'R&D 연구원'·\"O'Reilly\"·따옴표·긴 글(40자까지)", async () => {
  const { ctx, page } = await openPage(browser);
  assert.deepEqual(await page.evaluate(() => [cleanUserText('R&D 연구원'), cleanUserText("O'Reilly 책 쓰기"), cleanUserText('  "나만의" 가게\n열기 '), cleanUserText(null), cleanUserText('a\\b`c')]),
    ['R＆D 연구원', 'O’Reilly 책 쓰기', '”나만의” 가게 열기', '', 'a＼b‘c']);
  assert.equal(await page.evaluate(() => { const v = cleanUserText('가'.repeat(39) + '𠮷𠮷'); return [...v].length + v.slice(-2); }), '40𠮷', '40자까지, 두 칸짜리 글자를 반으로 자르지 않는다');
  assert.deepEqual(await page.evaluate(() => [cleanUserText('🎨'), cleanUserText('개발자😀'), cleanUserText('🏃‍♀️ 달리기'), cleanUserText('세계 여행 ✈️ 하면서 일하기')]), ['', '개발자', '달리기', '세계 여행 하면서 일하기'],
    "그림 이모지는 뺀다 — 화면에서 감추는 글자라 이모지만 적으면 '[]'로 보였다");
  for (const id of ['userJob', 'userMajor', 'userHobby', 'userDream']) assert.equal(await page.getAttribute('#' + id, 'maxlength'), '40');
  await page.evaluate(() => { document.getElementById('introGateModal').style.display = 'none'; goToStep(2); });
  await page.fill('#year', '1990'); await page.fill('#month', '3'); await page.fill('#day', '10');
  await page.fill('#userJob', 'R&D 연구원'); await page.fill('#userDream', "O'Reilly 책 쓰기");
  await page.evaluate(() => submitAndGoToResult()); await page.waitForTimeout(500);
  const t = await page.evaluate(() => document.getElementById('viewResult').innerText);
  assert.ok(t.includes('R＆D 연구원') && t.includes('O’Reilly 책 쓰기'), '적은 글이 그대로 읽힌다');
  assert.ok(!/&amp;|&lt;|&#39;|undefined/.test(t), '깨진 글자가 없다');
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

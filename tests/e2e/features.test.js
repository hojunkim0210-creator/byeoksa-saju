// 확장 기능 화면 테스트: 궁합 · 오늘의 운세 · 벽사 패 · 백구에게 묻기 · 공유 카드 버튼
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium, openPage, fillAndSubmit } = require('./helpers');

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

const BROKEN = /undefined|NaN|\[object Object\]|\((wood|fire|earth|metal|water)\)/;
const BAD_JOSA = /\[(비견|정재|편재|겁재)\]으로|\]가다|나가 주고/;

async function home(page) { await page.evaluate(() => { document.getElementById('introGateModal').style.display = 'none'; goToStep(1); }); }

test('홈 부적 메뉴 4개가 각 화면을 연다', async () => {
  const { ctx, page } = await openPage(browser);
  for (const [label, view] of [['인연 궁합', 'viewCompat'], ['오늘의 운세', 'viewDaily'], ['벽사 패 뽑기', 'viewTarot'], ['백구에게 묻기', 'viewChat']]) {
    await home(page);
    await page.click(`.slip:has-text("${label}")`);
    assert.equal(await page.evaluate(v => getComputedStyle(document.getElementById(v)).display, view), 'flex', label);
  }
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

test('오늘의 운세: 생년월일이 없으면 입력을 받고, 넣으면 점수·할 일이 나온다', async () => {
  const { ctx, page } = await openPage(browser);
  await home(page); await page.click('.slip:has-text("오늘의 운세")');
  assert.ok(await page.isVisible('#pfGo'));
  await page.fill('#pfY', '2002'); await page.fill('#pfM', '2'); await page.fill('#pfD', '30'); await page.click('#pfGo');
  assert.match(await page.textContent('#pfErr'), /존재하지 않는 날짜/);
  await page.fill('#pfD', '4'); await page.fill('#pfM', '10'); await page.click('#pfGo');
  const t = await page.textContent('#dailyBody');
  assert.match(t, /2026년 10월 12일 · 기미\(己未\)일/);
  assert.match(t, /이렇게 하거라/); assert.doesNotMatch(t, BROKEN); assert.doesNotMatch(t, BAD_JOSA);
  await ctx.close();
});

test('궁합: 결과 점수가 계산 코어와 같고 근거가 붙는다', async () => {
  const { ctx, page } = await openPage(browser);
  await home(page); await page.click('.slip:has-text("인연 궁합")');
  await page.fill('#caY', '2002'); await page.fill('#caM', '10'); await page.fill('#caD', '4');
  await page.fill('#cbName', '민지'); await page.fill('#cbY', '1990'); await page.fill('#cbM', '3'); await page.fill('#cbD', '10');
  await page.selectOption('#cbH', '6'); await page.selectOption('#cbG', 'F');
  await page.click('#compatGo');
  const shown = Number(await page.textContent('#compatResult .score-num'));
  const expected = await page.evaluate(() => {
    const a = SajuCore.calculateFourPillars(2002, 10, 4, null), b = SajuCore.calculateFourPillars(1990, 3, 10, 6);
    return SajuCore.calculateCompatibility(a, b, SajuCore.calculateOheng(a), SajuCore.calculateOheng(b)).score;
  });
  assert.equal(shown, expected);
  const t = await page.textContent('#compatResult');
  assert.match(t, /민지/); assert.ok((await page.$$('#compatResult .reason')).length >= 1);
  assert.doesNotMatch(t, BROKEN); assert.doesNotMatch(t, BAD_JOSA);
  await ctx.close();
});

test('벽사 패: 22장 오리지널 덱, 뒤집으면 풀이가 나오고 같은 날 다시 열면 그대로', async () => {
  const { ctx, page } = await openPage(browser);
  const names = await page.evaluate(() => window.BYEOKSA_EXTRAS.DECK.map(c => c.name + c.hanja));
  assert.equal(new Set(names).size, 22);
  await home(page); await page.click('.slip:has-text("벽사 패 뽑기")');
  assert.ok(await page.isHidden('#tarotReading'));
  await page.click('#tarotCard');
  assert.ok(await page.isVisible('#tarotReading'));
  const first = await page.textContent('#tarotReading .feature-card-title');
  await home(page); await page.click('.slip:has-text("벽사 패 뽑기")');
  assert.ok(await page.isVisible('#tarotReading'), '같은 날 다시 열면 뒤집힌 상태');
  assert.equal(await page.textContent('#tarotReading .feature-card-title'), first);
  await ctx.close();
});

test('백구에게 묻기: 8개 질문 모두 여러 사주에서 깨진 값 없이 답한다', async () => {
  const { ctx, page } = await openPage(browser);
  const res = await page.evaluate(() => {
    const X = window.BYEOKSA_EXTRAS; const out = [];
    for (const p of [{ y: 2002, m: 10, d: 4, hour: -1, gender: 'M' }, { y: 1990, m: 3, d: 10, hour: 6, gender: 'F' }, { y: 1972, m: 1, d: 15, hour: 9, gender: 'M' },
      { y: 1985, m: 7, d: 22, hour: 2, gender: 'F' }, { y: 1999, m: 8, d: 18, hour: 8, gender: 'M' }]) {
      const sj = X.readSaju(p);
      for (const t of X.TOPICS) out.push({ id: t.id, text: X.answer(t.id, p, sj).replace(/<[^>]+>/g, '') });
    }
    return out;
  });
  for (const r of res) {
    assert.ok(r.text.length > 30, r.id);
    assert.doesNotMatch(r.text, BROKEN, r.id); assert.doesNotMatch(r.text, BAD_JOSA, r.id);
  }
  assert.ok(res.filter(r => r.id === 'body').every(r => /병원/.test(r.text)), '건강 답변에는 병원 안내가 있어야 함');
  // 화면에서 실제로 대화가 오가는지
  await page.evaluate(() => localStorage.setItem('byeoksa.profile.v1', JSON.stringify({ y: 2002, m: 10, d: 4, hour: -1, gender: 'M' })));
  await home(page); await page.click('.slip:has-text("백구에게 묻기")');
  await page.click('.chat-chip[data-topic="money"]'); await page.waitForTimeout(900);
  assert.equal((await page.$$('.chat-msg.me')).length, 1);
  assert.equal((await page.$$('.chat-msg.dog')).length, 2);
  await ctx.close();
});

test('결과 화면에 공유 카드 저장 버튼이 있고, 공유 링크에는 꿈·직업이 실리지 않는다', async () => {
  const { ctx, page } = await openPage(browser);
  await fillAndSubmit(page, { dream: '비밀스러운꿈', job: '비밀직업' });
  assert.ok(await page.isVisible('text=공유 카드 저장'));
  const link = await page.evaluate(async () => { let got = null; window.prompt = (_, t) => { got = t; }; Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { got = t; return Promise.resolve(); } }, configurable: true }); copyShareUrl(); await new Promise(r => setTimeout(r, 50)); return got; });
  assert.match(link, /y=1990/); assert.doesNotMatch(decodeURIComponent(link), /비밀/);
  await ctx.close();
});

test('"이 기기에서 지우기"는 생년월일·패 기록·식별값을 모두 지운다 (개인정보처리방침과 일치)', async () => {
  const { ctx, page } = await openPage(browser);
  await home(page); await page.click('.slip:has-text("벽사 패 뽑기")');
  await page.evaluate(() => localStorage.setItem('byeoksa.profile.v1', JSON.stringify({ y: 2002, m: 10, d: 4, hour: -1, gender: 'M' })));
  await home(page); await page.click('.slip:has-text("벽사 패 뽑기")');
  await page.evaluate(() => localStorage.setItem('byeoksa.tarot.2026-10-12', '3'));
  await home(page); await page.click('.slip:has-text("오늘의 운세")');
  await page.click('#dailyBody [data-act="forget"]');
  const left = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('byeoksa.')));
  assert.deepEqual(left, []);
  assert.ok(await page.isVisible('#pfGo'), '지운 뒤에는 생년월일 입력이 다시 나와야 함');
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

test('약관 페이지: 320px에서 가로 넘침 없고, 대문 바닥글 링크로 열린다', async () => {
  const path = require('path');
  const legal = 'file://' + path.resolve(__dirname, '../../site/legal.html');
  const { ctx, page } = await openPage(browser, { width: 320, url: legal + '#refund' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
  for (const id of ['terms', 'privacy', 'refund', 'disclaimer', 'business', 'credits']) assert.ok(await page.$('#' + id), id);
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

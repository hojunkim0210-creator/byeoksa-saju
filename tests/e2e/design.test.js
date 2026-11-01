// 디자인 2차 (2026-11-01 벤치마킹 ⑤⑥):
//   ⑤ 강조는 카드당 '핵심' 줄 하나 — 본문 strong·impact 낱말은 굵게만(형광펜·붓 밑줄·색 없음). 색은 핵심 줄과 악연 경고 카드에만.
//   ⑥ 긴 단락은 '더 보기'로 접되 글은 그대로 남는다(문구 보존). 짧은 글은 접지 않는다. 새 풀이를 하면 다시 접힌다. 펼친 뒤 단추는 '접기'로 남는다(업데이트 28).
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium, openPage, fillAndSubmit } = require('./helpers');

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

test('본문 강조: strong은 굵게만 — 형광펜·밑줄 없음, 한눈에 카드도 형광펜 없음, impact 낱말은 본문 색', async () => {
  const { ctx, page } = await openPage(browser);
  await fillAndSubmit(page);
  const r = await page.evaluate(() => {
    const cs = el => getComputedStyle(el);
    const s = document.querySelector('#fitContent strong:not([class])');
    const g = document.querySelector('.glance-val strong');
    const red = document.querySelector('#viewResult .impact-red:not(#ghostWarningCard *):not(.key-line *)');
    const ghost = document.querySelector('#ghostWarningCard .impact-red');
    return {
      strong: s && { bg: cs(s).backgroundImage, bb: cs(s).borderBottomWidth, fw: cs(s).fontWeight },
      glance: g && cs(g).backgroundImage,
      red: red && { color: cs(red).color, around: cs(red.parentElement).color },
      ghost: ghost && cs(ghost).color
    };
  });
  assert.ok(r.strong, '본문 strong이 있다');
  assert.equal(r.strong.bg, 'none', '형광펜 없음'); assert.equal(r.strong.bb, '0px', '붓 밑줄 없음'); assert.ok(parseInt(r.strong.fw, 10) >= 700, '굵게');
  if (r.glance) assert.equal(r.glance, 'none', '한눈에 카드 형광펜 없음');
  if (r.red) assert.equal(r.red.color, r.red.around, '본문 impact-red는 둘레 글자 색');
  if (r.ghost) assert.notEqual(r.ghost, 'rgb(43, 35, 29)', '악연 경고 카드의 붉은 낱말은 그대로');
  await ctx.close();
});

// ⑧ 불티는 대문 사진 안에서만 ⑨ 상단 공유 버튼은 내리고 설화록 단추로 (공유는 아래 '공유하기'와 결과 화면에)
test('불티는 대문 사진 안에서만 여덟 점, 상단 바에는 공유 대신 설화록 단추', async () => {
  const { ctx, page } = await openPage(browser);
  await page.evaluate(() => { document.getElementById('introGateModal').style.display = 'none'; goToStep(1); });
  const r = await page.evaluate(() => ({
    inPortrait: document.querySelectorAll('.spirit-portrait-box .embers i').length,
    outside: document.querySelectorAll('.embers:not(.spirit-portrait-box .embers)').length,
    clipped: getComputedStyle(document.querySelector('.spirit-portrait-box .embers')).overflow,
    topbar: [...document.querySelectorAll('.home-topbar button')].map(b => b.textContent.trim()),
    shareBelow: !!document.querySelector('#viewLanding [onclick*="shareSite"], #viewLanding .coupon-share, #viewLanding a[onclick*="share"]') || /공유하기/.test(document.getElementById('viewLanding').textContent)
  }));
  assert.ok(r.inPortrait >= 4 && r.inPortrait <= 8, '사진 안 불티 4~8점: ' + r.inPortrait);
  assert.equal(r.outside, 0, '사진 밖에는 불티 없음');
  assert.equal(r.clipped, 'hidden');
  assert.ok(!r.topbar.some(t => /공유/.test(t)), '상단 바에 공유 버튼 없음: ' + r.topbar.join(','));
  assert.ok(r.topbar.some(t => /설화록/.test(t)), '상단 바에 설화록 단추');
  assert.ok(r.shareBelow, '대문 아래쪽에는 공유하기가 남아 있다');
  await page.click('.home-topbar-link'); await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('hanjiScrollModal')).display !== 'none'), true, '설화록이 열린다');
  await ctx.close();
});

const foldState = (page, sel) => page.evaluate(s => {
  const el = document.querySelector(s); const btn = el.nextElementSibling;
  return { clamped: el.classList.contains('fold-clamp'), open: el.classList.contains('is-open'), overflow: el.scrollHeight > el.clientHeight + 1,
    btn: (btn && btn.classList.contains('fold-more')) ? btn.textContent : null, aria: btn && btn.getAttribute('aria-expanded'), focus: document.activeElement === btn };
}, sel);

test('긴 단락 접기: 대문 설화 단락은 더 보기로 접히고 누르면 펼쳐진다, 글은 그대로', async () => {
  const { ctx, page } = await openPage(browser);
  await page.evaluate(() => { document.getElementById('introGateModal').style.display = 'none'; goToStep(1); });
  const before = await foldState(page, '.lore-strip');
  assert.ok(before.clamped && before.overflow && before.btn === '더 보기', JSON.stringify(before));
  assert.ok(await page.evaluate(() => document.querySelector('.lore-strip').textContent.includes('벽사견은 지금도 대문 앞에서')), '접혀도 글은 남아 있다');
  await page.click('.lore-strip + .fold-more');
  const after = await foldState(page, '.lore-strip');
  assert.ok(after.open && !after.overflow && after.btn === '접기' && after.aria === 'true' && after.focus, '펼친 뒤 단추는 접기로 남고 초점 유지: ' + JSON.stringify(after));
  await page.click('.lore-strip + .fold-more');
  const refold = await foldState(page, '.lore-strip');
  assert.ok(!refold.open && refold.overflow && refold.btn === '더 보기' && refold.aria === 'false', '다시 누르면 접힘: ' + JSON.stringify(refold));
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

test('긴 단락 접기: 결과의 긴 풀이는 접히고 짧은 글은 안 접히며, 다른 사주를 풀면 다시 접힌다', async () => {
  const { ctx, page } = await openPage(browser);
  await fillAndSubmit(page);
  const items = await page.evaluate(() => [...document.querySelectorAll('#viewResult [data-fold]')].map(el => {
    const btn = el.nextElementSibling;
    return { id: el.id, clamped: el.classList.contains('fold-clamp'), btn: !!(btn && btn.classList.contains('fold-more')), overflow: el.scrollHeight > el.clientHeight + 1 };
  }));
  assert.ok(items.some(x => x.clamped), '접힌 긴 풀이가 있다: ' + JSON.stringify(items));
  assert.ok(items.every(x => x.clamped === x.btn), '접힌 것에만 더 보기 단추: ' + JSON.stringify(items));
  assert.ok(items.filter(x => x.clamped).every(x => x.overflow), '접힌 것은 실제로 넘치는 글');
  const long = items.find(x => x.clamped);
  await page.click(`#${long.id} + .fold-more`);
  const opened = await foldState(page, '#' + long.id);
  assert.ok(opened.open && opened.btn === '접기' && opened.aria === 'true', JSON.stringify(opened));
  await fillAndSubmit(page, { y: '1995', m: '3', d: '15', gender: 'F' });
  const again = await foldState(page, '#' + long.id);
  assert.ok(again.clamped && !again.open && again.btn === '더 보기', '새 풀이는 다시 접힌다: ' + JSON.stringify(again));
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

// 업데이트 52 (2026-11-22): 무료 결과 화면 다듬기 — 디자인 스킬 점검에서 나온 '안전한 것'이 그대로 있는지.
//   10년 운 줄의 '현재' 칸이 보이게, 흐린 작은 글씨를 우리 색(--ink-soft)으로, 제목·표·알림을 화면 낭독이 알아듣게, 누름 자리.
//   풀이 글·결제·가격은 바꾸지 않았다(text-preservation / tone / payment 테스트가 본다).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path');
const { chromium, openPage, fillAndSubmit, SITE } = require('./helpers');

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

test("10년 운 줄: 마흔 넘은 손님도 '현재' 칸이 화면 안에 보인다 (페이지는 맨 위 그대로)", async () => {
  for (const [y, w] of [['1965', 320], ['1975', 375], ['1958', 360], ['1994', 320]]) {
    const { ctx, page } = await openPage(browser, { width: w, height: 667 });
    await fillAndSubmit(page, { y, m: '4', d: '9', hour: '3', gender: 'F' });
    const r = await page.evaluate(() => {
      const ds = document.getElementById('daeunScroll'), cur = ds.querySelector('.current-daeun');
      const a = ds.getBoundingClientRect(), c = cur.getBoundingClientRect();
      return { inside: c.left >= a.left - 1 && c.right <= a.right + 1, aria: cur.getAttribute('aria-current'), sy: scrollY, tab: ds.getAttribute('tabindex'), label: ds.getAttribute('aria-label') };
    });
    assert.ok(r.inside, `${y}년생 ${w}px: '현재' 칸이 줄 밖`);
    assert.equal(r.aria, 'true'); assert.equal(r.sy, 0); assert.equal(r.tab, '0'); assert.ok(r.label.includes('10년 운'));
    await ctx.close();
  }
});

test('흐린 작은 글씨를 우리 색으로: 10년 운 둘째 줄·오행 %·시간 모름 글·표 이름 칸이 대비 4.5:1 이상', async () => {
  const js = fs.readFileSync(path.join(path.dirname(SITE), 'js/app.js'), 'utf8');
  assert.ok(!/color:#64748b|color:#888;/.test(js), '팔레트 밖 회색(#64748b·#888)이 남아 있다');
  const { ctx, page } = await openPage(browser, { width: 375, height: 667 });
  await fillAndSubmit(page, { y: '1985', m: '12', d: '3', hour: '-1', gender: 'M', job: '', dream: '' });
  await page.evaluate(() => document.querySelectorAll('#viewResult details').forEach(d => { d.open = true; }));
  const r = await page.evaluate(() => {
    const rgb = s => s.match(/[\d.]+/g).map(Number);
    const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const paper = [230, 214, 179];   // --paper
    const ratio = el => { const c = getComputedStyle(el); let F = rgb(c.color).slice(0, 3); let o = 1; for (let e = el; e && e.id !== 'viewResult'; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); F = F.map((v, i) => v * o + paper[i] * (1 - o)); const a = lum(F), b = lum(paper); return +((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2); };
    const pick = sel => { const el = document.querySelector(sel); return el ? ratio(el) : null; };
    return { daeun2: pick('#daeunScroll .daeun-sub > div:nth-child(2)'), term: pick('#daeunScroll .daeun-sub > div:nth-child(2) .daeun-term'), hourUnknown: pick('.hour-unknown-text'), label: pick('td.label-col'),
      goldStrong: [...document.querySelectorAll('#mindItem1 strong, #mindItem2 strong')].filter(s => getComputedStyle(s).color === 'rgb(154, 106, 18)').length };
  });
  for (const k of ['daeun2', 'term', 'hourUnknown', 'label']) assert.ok(r[k] === null ? k === 'hourUnknown' : r[k] >= 4.5, `${k} 대비 ${r[k]}:1`);
  assert.equal(r.goldStrong, 0, '속마음 카드의 굵은 글은 먹색(강조는 카드당 하나)');
  await ctx.close();
});

test('화면 낭독: 카드 제목은 제목으로, 사주 표는 줄·칸 이름이 있고, 알림은 읽어 준다 (겉모양·글은 그대로)', async () => {
  const { ctx, page } = await openPage(browser, { width: 375, height: 667 });
  await fillAndSubmit(page, {});
  const r = await page.evaluate(() => ({
    headings: document.querySelectorAll('#viewResult [role="heading"][aria-level="2"]').length,
    table: document.querySelector('.saju-table').getAttribute('aria-label'),
    cols: document.querySelectorAll('.saju-table th[scope="col"]').length,
    rows: document.querySelectorAll('.saju-table td.label-col[role="rowheader"]').length,
    toast: document.getElementById('toastMsg').getAttribute('role') + '/' + document.getElementById('toastMsg').getAttribute('aria-live'),
    emoji: document.getElementById('animalEmoji').getAttribute('aria-hidden'),
  }));
  assert.equal(r.headings, 8); assert.equal(r.table, '사주 여덟 글자 표'); assert.equal(r.cols, 5); assert.equal(r.rows, 6);
  assert.equal(r.toast, 'status/polite'); assert.equal(r.emoji, 'true');
  await ctx.close();
});

test("누름 자리: '더 보기'·'사주 다시 적기'·저장 공유 버튼이 44px쯤, 구매 바가 떠 있으면 알림이 그 위에 뜬다", async () => {
  const { ctx, page } = await openPage(browser, { width: 320, height: 568 });
  await fillAndSubmit(page, {});
  const r = await page.evaluate(() => {
    const hit = (el) => { const b = el.getBoundingClientRect(); const c = getComputedStyle(el, '::before'); return b.height + (c.content !== 'none' ? -(parseFloat(c.top) || 0) - (parseFloat(c.bottom) || 0) : 0); };
    document.querySelectorAll('#viewResult details').forEach(d => { d.open = true; });
    const toast = document.getElementById('toastMsg'); toast.style.display = 'block'; toast.textContent = '결과 링크를 복사했소.';
    const t = toast.getBoundingClientRect(), bar = document.getElementById('buyBar').getBoundingClientRect();
    return { fold: Math.min(...[...document.querySelectorAll('#viewResult .fold-more')].map(hit)), back: hit(document.querySelector('#viewResult > .btn-nav-back')),
      action: Math.min(...[...document.querySelectorAll('#viewResult .action-bar .btn-action')].map(b => b.getBoundingClientRect().height)),
      barOn: document.body.classList.contains('buy-bar-on'), toastBottom: t.bottom, barTop: bar.top };
  });
  assert.ok(r.fold >= 44, `더 보기 ${r.fold}`); assert.ok(r.back >= 44, `사주 다시 적기 ${r.back}`); assert.ok(r.action >= 44, `저장·공유 ${r.action}`);
  assert.ok(r.barOn, '잠긴 결과 화면에는 구매 바가 있다');
  assert.ok(r.toastBottom <= r.barTop + 1, `알림 아래 ${Math.round(r.toastBottom)} > 구매 바 위 ${Math.round(r.barTop)}`);
  await ctx.close();
});

test('실제 손님 길(자동 테스트 표시 없이): 막이 먼저 내려오고, 풀이가 끝까지 나오며, 알림을 잇달아 띄워도 뒤 알림이 2.5초를 채운다', async () => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', r => { const u = r.request().url(); (u.startsWith('file:') || u.startsWith('data:')) ? r.continue() : r.abort(); });
  await page.goto('file://' + SITE + '?go=input'); await page.waitForTimeout(400);
  await page.fill('#year', '1990'); await page.fill('#month', '3'); await page.fill('#day', '10');
  const first = await page.evaluate(() => { submitAndGoToResult(); return { veil: !document.getElementById('ritualVeil').hidden, resultShown: getComputedStyle(document.getElementById('viewResult')).display !== 'none' }; });
  assert.equal(first.veil, true, '누르자마자 막이 내려온다');
  assert.equal(first.resultShown, false, '풀이 계산은 막이 그려진 뒤에');
  await page.waitForFunction(() => getComputedStyle(document.getElementById('viewResult')).display !== 'none' && document.getElementById('animalTitle').textContent.trim().length > 1, null, { timeout: 3000 });
  await page.waitForFunction(() => document.getElementById('ritualVeil').hidden, null, { timeout: 8000 });
  const t = await page.evaluate(() => document.getElementById('viewResult').innerText);
  assert.ok(t.length > 3000 && !/undefined|NaN/.test(t), '풀이 글이 온전히 나온다');
  await page.evaluate(() => { showToast('하나'); });
  await page.waitForTimeout(2000);
  await page.evaluate(() => { showToast('둘'); });
  await page.waitForTimeout(1200);
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('toastMsg')).display), 'block', '뒤 알림이 앞 알림 타이머에 지워지면 안 된다');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// 업데이트 53 (2026-11-24 대표님 "네, 숨겨 줘"): 꿈을 안 적은 손님에게는 조화율 카드와 '한눈에'의 '그대 꿈' 줄을 보이지 않는다
test("꿈을 안 적으면 조화율 카드·'그대 꿈' 줄이 없고 '[이루고픈 천명]'이 화면에 안 나온다 — 꿈을 적으면 예전처럼 나온다", async () => {
  const { ctx, page } = await openPage(browser, { width: 375, height: 667 });
  const look = () => page.evaluate(() => {
    const card = document.getElementById('dreamFitCard');
    return { cardShown: getComputedStyle(card).display !== 'none', keys: [...document.querySelectorAll('#glanceCard .glance-key')].map(k => k.textContent.trim()), note: document.querySelector('#glanceCard .glance-note').textContent,
      glance: document.getElementById('glanceCard').innerText,
      seen: (() => { const c = document.getElementById('viewResult').cloneNode(true); c.querySelectorAll('[hidden]').forEach(e => e.remove()); const box = c.querySelector('.paywall, #paywallBox'); return [...c.querySelectorAll('#glanceCard, #animalCard, .animal-card')].map(e => e.textContent).join(' '); })() };
  });
  await fillAndSubmit(page, { job: '', dream: '' });
  let r = await look();
  assert.equal(r.cardShown, false, '꿈 빈칸: 조화율 카드가 보이면 안 된다');
  assert.ok(!r.keys.includes('그대 꿈'), '꿈 빈칸: 한눈에 카드에 그대 꿈 줄');
  assert.equal(r.keys.length, 5); assert.ok(r.note.includes('다섯 줄'), r.note);
  assert.ok(!/이루고픈 천명|조화율/.test(r.glance + r.seen), '꿈 빈칸: 한눈에 카드에 임시 글자나 조화율이 보인다');
  // 직업만 적어도(꿈은 빈칸) 카드는 없다
  await page.evaluate(() => goToStep(2)); await fillAndSubmit(page, { job: '디자이너', dream: '' });
  assert.equal((await look()).cardShown, false);
  // 꿈을 적으면 예전처럼
  await page.evaluate(() => goToStep(2)); await fillAndSubmit(page, { job: '디자이너', dream: '내 가게 열기' });
  r = await look();
  assert.equal(r.cardShown, true); assert.ok(r.keys.includes('그대 꿈')); assert.equal(r.keys.length, 6); assert.ok(r.note.includes('여섯 줄'), r.note);
  assert.match(r.glance, /내 가게 열기\] — 조화율 \d+%/);
  // 다시 빈칸으로 풀면 또 숨는다(앞 풀이의 카드가 남지 않는다)
  await page.evaluate(() => goToStep(2)); await page.fill('#userJob', ''); await page.fill('#userDream', ''); await fillAndSubmit(page, { job: '', dream: '' });
  assert.equal((await look()).cardShown, false);
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

test("꿈을 안 적으면 풀이 문장의 임시 글자에서 대괄호만 빠진다('이루고픈 천명을…') — 꿈을 적으면 '[적은 꿈]' 그대로", async () => {
  const { ctx, page } = await openPage(browser, { width: 375, height: 667 });
  const seen = () => page.evaluate(() => { const c = document.getElementById('viewResult').cloneNode(true); c.querySelectorAll('[hidden]').forEach(e => e.remove()); return { all: c.textContent, sniff: document.getElementById('sniffCareerText').textContent }; });
  for (const who of [{ y: '1994', m: '5', d: '17', gender: 'F' }, { y: '1985', m: '12', d: '3', gender: 'M', hour: '-1' }, { y: '1972', m: '1', d: '20', gender: 'F' }]) {
    await page.evaluate(() => goToStep(2));
    await fillAndSubmit(page, { ...who, job: '', dream: '' });
    const r = await seen();
    assert.ok(!/\[\s*이루고픈 천명\s*\]/.test(r.all), `${who.y}: 대괄호째 남은 임시 글자`);
    assert.ok(!/\[\s*\]/.test(r.sniff), `${who.y}: 빈 대괄호`);
    assert.match(r.sniff, /^"이루고픈 천명[을은이]/, `${who.y}: ` + r.sniff.slice(0, 40));   // 문장은 사람마다 다르다
  }
  await page.evaluate(() => goToStep(2));
  await fillAndSubmit(page, { job: '개발자', dream: '창업' });
  assert.match((await seen()).sniff, /^"\[창업\][을은이]/);
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

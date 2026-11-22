// 업데이트 51 (2026-11-22): 입력 화면 다듬기 — 디자인 스킬 점검에서 나온 '안전한 것'이 그대로 있는지.
//   숫자 칸 큰 자판(inputmode)·이름표와 칸 잇기(label for)·칸 안 안내 글씨 대비·음력을 골라도 버튼이 하단 메뉴 위에·알림 뒤 고칠 칸에 커서.
//   글·색·글꼴·높이는 바꾸지 않았다(문구 보존·첫 화면 검사는 text-preservation / input-fold 테스트가 본다).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path');
const { chromium, openPage, SITE } = require('./helpers');

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

const toInput = page => page.evaluate(() => { const m = document.getElementById('introGateModal'); if (m) m.style.display = 'none'; goToStep(2); document.getElementById('moreFields').open = false; });

test('숫자 칸은 큰 숫자 자판(inputmode), 이름표는 칸과 이어지고(label for), 이름 없는 고르기 칸이 없다', async () => {
  const { ctx, page } = await openPage(browser, { width: 375, height: 667 });
  await toInput(page);
  const r = await page.evaluate(() => {
    const q = id => document.getElementById(id);
    const named = el => !!(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || document.querySelector(`label[for="${el.id}"]`) || el.closest('label'));
    return {
      modes: ['year', 'month', 'day'].map(id => q(id).getAttribute('inputmode') + '/' + q(id).type),
      fors: [...document.querySelectorAll('#viewInput label.form-label')].map(l => l.getAttribute('for')),
      spans: document.querySelectorAll('#viewInput span.form-label').length,
      unnamed: [...document.querySelectorAll('#viewInput input, #viewInput select')].filter(el => !named(el)).map(el => el.id),
      labelText: document.querySelector('#viewInput label[for="year"]').textContent.trim(),
    };
  });
  assert.deepEqual(r.modes, ['numeric/number', 'numeric/number', 'numeric/number']);
  assert.deepEqual(r.fors, ['year', 'hourSelect', 'userJob', 'userMajor', 'userHobby', 'userDream']);
  assert.equal(r.spans, 0);
  assert.deepEqual(r.unnamed, [], '이름 없는 칸');
  assert.equal(r.labelText, '태어난 날 (생년월일)');   // 글은 그대로
  // 이름표를 누르면 그 칸에 커서가 간다
  await page.click('#viewInput label[for="year"]');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'year');
  await ctx.close();
});

test('칸 안 안내 글씨가 읽을 만큼 진하다(대비 4.5:1 이상) — 새 색 없이 먹-연(--ink-soft)', async () => {
  const { ctx, page } = await openPage(browser, { width: 375, height: 667 });
  await toInput(page);
  const r = await page.evaluate(() => {
    const el = document.getElementById('year');
    const ph = getComputedStyle(el, '::placeholder'); const bg = getComputedStyle(el).backgroundColor;
    const rgb = s => s.match(/[\d.]+/g).map(Number);
    const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const B = rgb(bg), F = rgb(ph.color), a = (F[3] === undefined ? 1 : F[3]) * parseFloat(ph.opacity || '1');
    const mix = F.slice(0, 3).map((v, i) => v * a + B[i] * (1 - a));
    const L1 = lum(mix), L2 = lum(B);
    return { ratio: (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05), color: ph.color, ink: getComputedStyle(document.documentElement).getPropertyValue('--ink-soft').trim() };
  });
  assert.ok(r.ratio >= 4.5, `안내 글씨 대비 ${r.ratio.toFixed(2)}:1`);
  assert.equal(r.color, 'rgb(91, 78, 66)', '색은 --ink-soft(#5B4E42)');
  await ctx.close();
});

test("'음력'을 골라 윤달 줄이 생겨도, 어중간한 화면 높이에서도 '무료 풀이 보기'가 하단 메뉴 위에 다 보인다", async () => {
  for (const [w, h, lunar] of [[360, 640, true], [375, 812, true], [320, 568, true], [360, 610, false], [360, 770, false], [375, 762, false], [360, 640, false]]) {
    const { ctx, page } = await openPage(browser, { width: w, height: h });
    await toInput(page);
    if (lunar) await page.selectOption('#calendarType', 'lunar');
    await page.waitForTimeout(100);
    const r = await page.evaluate(() => {
      const b = document.querySelector('#viewInput .btn-submit').getBoundingClientRect();
      const t = document.getElementById('tabBar').getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, tab: t.top, sy: scrollY, leap: !document.getElementById('leapWrap').hidden };
    });
    assert.equal(r.leap, lunar);
    assert.ok(r.top >= 0 && r.bottom <= r.tab, `${w}×${h}${lunar ? ' 음력' : ''}: 버튼 ${Math.round(r.top)}~${Math.round(r.bottom)}, 하단 메뉴 ${Math.round(r.tab)}`);
    await ctx.close();
  }
});

test('알림을 닫으면 고칠 칸에 커서가 간다 (알림 문장은 그대로)', async () => {
  const { ctx, page } = await openPage(browser, { width: 375, height: 667 });
  await toInput(page);
  await page.fill('#year', '1990');
  await page.evaluate(() => submitAndGoToResult());
  assert.equal(await page.evaluate(() => document.activeElement.id), 'month');
  await page.fill('#month', '2'); await page.fill('#day', '30');
  await page.evaluate(() => submitAndGoToResult());
  assert.equal(await page.evaluate(() => document.activeElement.id), 'day');
  await page.fill('#month', '13');
  await page.evaluate(() => submitAndGoToResult());
  assert.equal(await page.evaluate(() => document.activeElement.id), 'month');
  assert.deepEqual(page._alerts, ['생년월일을 온전히 대지 않으면 등 뒤의 그림자를 벗겨낼 수 없소!', '존재하지 않는 날짜(예: 2월 30일 등)요. 올바른 생년월일을 확인하고 다시 적으시오!', '올바른 생월과 생일을 고하시오!']);
  await ctx.close();
});

test('휴대폰 느낌: hover는 마우스 기기에서만, 두 번 눌러 확대 막기, 화면 전환 스크롤은 미끄러지지 않는다', () => {
  const css = fs.readFileSync(path.join(path.dirname(SITE), 'css/style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/^\.btn-main:hover/m.test(css), '주 버튼 hover가 @media (hover: hover) 밖에 있다');
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\) \{ \.btn-main:hover/);
  assert.match(css, /button, a, summary, label, select, input \{ touch-action: manipulation; \}/);
  assert.ok(!/user-scalable\s*=\s*no|maximum-scale/.test(fs.readFileSync(SITE, 'utf8')), '손가락 확대를 막으면 안 된다');
  const js = fs.readFileSync(path.join(path.dirname(SITE), 'js/app.js'), 'utf8');
  assert.ok(!/window\.scrollTo\(\{[^}]*smooth/.test(js), '화면 전환 스크롤은 바로');
});

// ── 대문 (같은 업데이트 51) ──────────────────────────────────────────────
test('대문: 좁은 폰(320·344)에서 쪽지 설명 글이 도장 밑으로 들어가지 않고, 가로 넘침이 없다', async () => {
  for (const w of [320, 344]   /* 360부터는 실제 글꼴에서 겹치지 않는다(테스트는 글꼴을 막아 글자가 더 넓다) */) {
    const { ctx, page } = await openPage(browser, { width: w, height: 700 });
    await page.evaluate(() => { const m = document.getElementById('introGateModal'); if (m) m.style.display = 'none'; });
    const r = await page.evaluate(() => {
      const overlaps = [...document.querySelectorAll('#viewLanding .slip')].filter(s => {
        const d = s.querySelector('.slip-desc'), seal = s.querySelector('.slip-seal').getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(d);
        return [...range.getClientRects()].some(c => c.right > seal.left + 1 && c.bottom > seal.top + 1 && c.left < seal.right && c.top < seal.bottom);
      }).length;
      return { overlaps, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
    });
    assert.equal(r.overlaps, 0, `${w}px: 도장에 가린 쪽지 ${r.overlaps}장`);
    assert.ok(r.sw <= r.cw, `${w}px: 가로 넘침`);
    await ctx.close();
  }
});

test('대문: 페이지 맨 끝(사업자 정보)이 하단 메뉴에 붙지 않고, 작은 누름 자리가 넓어졌고, 꺼진 이벤트 띠는 처음부터 숨김', async () => {
  const html = fs.readFileSync(SITE, 'utf8');
  assert.match(html, /<p class="event-strip sale-event-badge" style="display:none">/);
  assert.match(html, /class="spirit-portrait-img" width="800" height="800" fetchpriority="high"/);
  for (const w of [320, 375, 414]) {
    const { ctx, page } = await openPage(browser, { width: w, height: 700 });
    await page.evaluate(() => { const m = document.getElementById('introGateModal'); if (m) m.style.display = 'none'; window.scrollTo(0, document.body.scrollHeight); });
    await page.waitForTimeout(100);
    const r = await page.evaluate(() => {
      const hit = (el, pseudo) => { const b = el.getBoundingClientRect(); const c = getComputedStyle(el, pseudo); const ext = pseudo && c.content !== 'none' ? -(parseFloat(c.top) || 0) - (parseFloat(c.bottom) || 0) : 0; return b.height + ext; };
      return {
        gap: document.getElementById('tabBar').getBoundingClientRect().top - document.getElementById('footerBiz').getBoundingClientRect().bottom,
        link2027: document.querySelector('.home-2027-link').getBoundingClientRect().height,
        topbar: hit(document.querySelector('#viewLanding .home-topbar-link'), '::before'),
        footer: hit(document.querySelector('.footer-links a'), '::before'),
        strip: getComputedStyle(document.querySelector('.event-strip')).display,
      };
    });
    assert.ok(r.gap >= 10, `${w}px: 맨 끝 줄과 하단 메뉴 사이 ${Math.round(r.gap)}px`);
    assert.ok(r.link2027 >= 43, `${w}px: 2027 링크 누름 자리 ${r.link2027}`);
    assert.ok(r.topbar >= 44, `${w}px: 설화록 단추 누름 자리 ${r.topbar}`);
    assert.ok(r.footer >= 36, `${w}px: 바닥글 링크 누름 자리 ${r.footer}`);
    assert.equal(r.strip, 'none');
    await ctx.close();
  }
});

test('대문: 설화록을 닫자마자 다시 열어도 그대로 열려 있다', async () => {
  const { ctx, page } = await openPage(browser, { width: 375, height: 667 });
  await page.evaluate(() => { const m = document.getElementById('introGateModal'); if (m) m.style.display = 'none'; openHanjiScroll(); closeHanjiScroll(); openHanjiScroll(); });
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('hanjiScrollModal')).display), 'flex');
  await page.evaluate(() => closeHanjiScroll()); await page.waitForTimeout(450);
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('hanjiScrollModal')).display), 'none');
  await ctx.close();
});

// 모바일 브라우저 테스트 (Playwright Chromium). 320·360·390px에서 전체 흐름을 돌린다.
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium, openPage, fillAndSubmit } = require('./helpers');

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

// 결과 화면의 가로 넘침 요소와 대비 3:1 미만 글자를 찾는다
const AUDIT = () => {
  const vw = document.documentElement.clientWidth;
  const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const parse = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(parseFloat); return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
  // 바탕색을 거슬러 올라가며 찾는다. 먹 붓 띠(brush.webp)처럼 그림 바탕인 요소는 CSS만으로 대비를 셀 수 없어 그 요소는 건너뛴다(null)
  const bgOf = el => { while (el) { const cs = getComputedStyle(el); if (/brush\.webp/.test(cs.backgroundImage)) return null; const c = parse(cs.backgroundColor); if (c && c.a > 0.5) return c.rgb; el = el.parentElement; } return [13, 9, 11]; };
  const overflow = [], low = [];
  document.querySelectorAll('.view-step:not([style*="none"]) *').forEach(el => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (r.width === 0 || cs.visibility === 'hidden') return;
    if (r.right > vw + 1 && !el.closest('.daeun-scroll')) overflow.push(String(el.className || el.tagName));
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1)) return;
    const fg = parse(cs.color); if (!fg) return;
    const bg = bgOf(el); if (!bg) return;
    const L1 = lum(fg.rgb), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (ratio < 3) low.push(`${el.className || el.tagName} ${ratio.toFixed(1)}:1 "${el.textContent.trim().slice(0, 12)}"`);
  });
  return { scrollW: document.documentElement.scrollWidth, vw, overflow: overflow.slice(0, 5), low: low.slice(0, 5) };
};

for (const [w, h] of [[320, 568], [360, 640], [390, 844]]) {
  test(`${w}px: 첫 화면·입력·결과·결제 해제까지 오류·넘침·저대비 없음`, async () => {
    const { ctx, page } = await openPage(browser, { width: w, height: h });
    // 첫 안내창(솟을대문): 대문·'들어가겠습니다' 버튼이 화면 안에 보이거나 안내창 자체 스크롤로 닿을 수 있어야 함
    const intro = await page.evaluate(() => { const o = document.getElementById('introGateModal'), b = document.getElementById('gateEnterBtn'); const r = b.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, vh: innerHeight, scrollable: o.scrollHeight > o.clientHeight, overflowY: getComputedStyle(o).overflowY }; });
    assert.ok((intro.top >= 0 && intro.bottom <= intro.vh + 1) || (intro.scrollable && intro.overflowY === 'auto'), `들어가기 버튼이 화면 밖: ${JSON.stringify(intro)}`);
    await page.click('#gateEnterBtn'); await page.waitForTimeout(500);   // 대문이 열리고(테스트는 바로) 접견실로
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('introGateModal')).display), 'none');
    for (const step of [1, 2]) {
      await page.evaluate(s => { document.getElementById('introGateModal').style.display = 'none'; goToStep(s); }, step);
      const a = await page.evaluate(AUDIT);
      assert.equal(a.scrollW, a.vw, `${step}단계 가로 넘침 ${JSON.stringify(a.overflow)}`);
    }
    const fonts = await page.evaluate(() => ['year', 'month', 'day', 'userJob', 'hourSelect'].map(id => parseFloat(getComputedStyle(document.getElementById(id)).fontSize)));
    assert.ok(fonts.every(f => f >= 16), `iOS 자동 확대 방지: 입력 글꼴 16px 이상이어야 함 ${fonts}`);
    await fillAndSubmit(page);
    const r = await page.evaluate(AUDIT);
    assert.equal(r.scrollW, r.vw, `결과 가로 넘침 ${JSON.stringify(r.overflow)}`);
    assert.deepEqual(r.low, [], '대비 3:1 미만 글자');
    await page.evaluate(() => showToast('🕯️ 액막이 복채 정성 접수 완료! 6단계 퇴마 포트폴리오 전체 해제'));
    const t = await page.evaluate(() => { const r = document.getElementById('toastMsg').getBoundingClientRect(); return [r.left, r.right, innerWidth]; });
    assert.ok(t[0] >= 0 && t[1] <= t[2], `토스트가 화면 밖 ${t}`);
    await page.evaluate(() => unlockContent()); await page.waitForTimeout(300);
    const u = await page.evaluate(AUDIT);
    assert.equal(u.scrollW, u.vw, '결제 해제 후 가로 넘침');
    assert.deepEqual(page._errors, [], 'JS 오류');
    await ctx.close();
  });
}

test('입력 검증: 2월 30일 거부, 음력 선택 불가', async () => {
  const { ctx, page } = await openPage(browser);
  await fillAndSubmit(page, { m: '2', d: '30' });
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.getElementById('viewInput')).display), 'none');
  assert.ok(page._alerts.some(a => a.includes('존재하지 않는 날짜')));
  assert.equal(await page.evaluate(() => document.querySelector('#calendarType option[value=lunar]').disabled), true);
  await ctx.close();
});

test('결과: 대운수 9세(1990-03-10 남 오시), 요약문 출생시 "오시(午時)"', async () => {
  const { ctx, page } = await openPage(browser);
  await fillAndSubmit(page);
  assert.match(await page.textContent('#daeunBadge'), /순행.*9세 대운/);
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('termBoundaryNote')).display), 'none');
  const copied = await page.evaluate(async () => { let got = null; Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { got = t; return Promise.resolve(); } }, configurable: true }); copySummaryText(); await new Promise(r => setTimeout(r, 50)); return got; });
  assert.match(copied, /출생시: 오시\(午時\)/);
  await ctx.close();
});

test('절입 경계: 2026-03-05 해시(경칩 22:59 포함)는 안내 표시', async () => {
  const { ctx, page } = await openPage(browser);
  await fillAndSubmit(page, { y: '2026', m: '3', d: '5', hour: '11' });
  const note = await page.evaluate(() => { const e = document.getElementById('termBoundaryNote'); return { shown: getComputedStyle(e).display !== 'none', text: e.textContent }; });
  assert.ok(note.shown); assert.match(note.text, /경칩.*3월 5일 22:59/);
  await ctx.close();
});

test('동적 연도: 2029년 3월 기준이면 로드맵이 2029~2031년', async () => {
  const { ctx, page } = await openPage(browser, { now: new Date('2029-03-01T10:00:00+09:00') });
  assert.equal(await page.textContent('.yr-roadmap'), '2029~2031년');
  await fillAndSubmit(page);
  await page.evaluate(() => unlockContent());
  const txt = await page.evaluate(() => document.getElementById('unlockedReportContainer').textContent);
  assert.match(txt, /2029년 \(기유년 己酉\)/);
  assert.match(await page.evaluate(() => document.getElementById('viewResult').innerText), /불과 1~2년 전쯤\(2027~2028년, 정미·무신년\)/);
  await ctx.close();
});

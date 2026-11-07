// 여러 사람으로 돌려 보기 (업데이트 38, 2026-11-07 대표님 당부: "날짜·성별을 바꿔도 값이 제대로 나오게 해야 두세 번 일 안 한다")
//   11/3 전체 점검과 같은 5명(생년월일·성별·태어난 시간 — 모름 포함, 직업·꿈 빈칸 포함) + 궁합 3쌍(남녀·여여·남남)으로
//   무료 결과 · 결제창 · 궁합 · '상대에게 보내기' · 받은 링크 열기 · 숫자 세기 호출을 돌려
//   깨진 값(undefined·NaN·null·빈 괄호)·조사 오류·콘솔 오류가 0개인지 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium, openPage, SITE } = require('./helpers');

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

const PEOPLE = [
  { label: '1994 여 시간 모름', y: '1994', m: '1', d: '23', hour: '-1', gender: 'F', job: '애견미용사', dream: '억만장자' },
  { label: '1990 남 오시', y: '1990', m: '3', d: '10', hour: '6', gender: 'M', job: '개발자', dream: '창업' },
  { label: '2002 남 시간 모름 (꿈 빈칸)', y: '2002', m: '10', d: '4', hour: '-1', gender: 'M', job: '학생', dream: '' },
  { label: '1985 여 자시', y: '1985', m: '12', d: '25', hour: '0', gender: 'F', job: '간호사', dream: '건물주' },
  { label: '1972 남 해시 (직업 빈칸)', y: '1972', m: '7', d: '15', hour: '11', gender: 'M', job: '', dream: '세계 여행' }
];
const PAIRS = [
  { label: '남녀', a: { name: '준석', y: '1990', m: '3', d: '10', h: '6', g: 'M' }, b: { name: '민지', y: '1994', m: '1', d: '23', h: '-1', g: 'F' } },
  { label: '여여', a: { name: '수아', y: '1985', m: '12', d: '25', h: '0', g: 'F' }, b: { name: '하은', y: '1999', m: '5', d: '5', h: '-1', g: 'F' } },
  { label: '남남', a: { name: '영철', y: '1972', m: '7', d: '15', h: '11', g: 'M' }, b: { name: '동현', y: '2002', m: '10', d: '4', h: '-1', g: 'M' } }
];

/** 깨진 값: 계산이 비었거나 틀렸을 때 화면에 새는 글자 */
function brokenBits(text) {
  const out = [];
  for (const re of [/undefined/g, /NaN/g, /\bnull\b/g, /\[object Object\]/g, /\$\{/g, /\[\s*\]/g, /\(\s*\)/g, /''/g]) {
    for (const m of text.matchAll(re)) out.push(text.slice(Math.max(0, m.index - 20), m.index + m[0].length + 20).replace(/\n/g, ' '));
  }
  return out;
}

/** 조사 오류: [직업]과 / '꿈'은 처럼 끼워 넣은 낱말 뒤의 조사가 받침과 맞는지 (2026-11-01 '[애견미용사]과' 같은 실수를 잡는다) */
function josaErrors(text) {
  const out = [];
  const res = [/\[([^\]\n]{1,30})\](을|를|이|가|은|는|과|와)(?![가-힣])/g, /'([^'\s][^'\n]{0,28}[^'\s]|[^'\s])'(을|를|이|가|은|는|과|와)(?![가-힣])/g];
  for (const re of res) for (const m of text.matchAll(re)) {
    // 괄호 풀이는 건너뛰고 본말에 맞춘다: '흡기귀(…귀신)가' → 흡기귀가 (조사는 괄호 앞 낱말을 따른다)
    let word = m[1]; while (/\([^()]*\)\s*$/.test(word)) word = word.replace(/\s*\([^()]*\)\s*$/, '');
    const last = word.replace(/[^가-힣]+$/, '').match(/[가-힣]$/);
    if (!last) continue;
    const has = (last[0].charCodeAt(0) - 0xAC00) % 28 !== 0;
    const ok = { '을': has, '를': !has, '이': has, '가': !has, '은': has, '는': !has, '과': has, '와': !has }[m[2]];
    if (!ok) out.push(m[0]);
  }
  return out;
}
// 파일로 여는 테스트에서만 생기는 것은 뺀다: 외부 주소 차단(Failed to load resource), 결제 수 서버 /api/stats (실제 사이트에는 있다)
const consoleErrors = page => page._console.filter(t => !/^Failed to load resource|^Fetch API cannot load file:\/\/\/api\//.test(t));

test('사주 5명: 무료 결과·결제창에 깨진 값·조사 오류·콘솔 오류가 없고, 숫자 세기(free·payopen)가 불린다', async () => {
  const seen = [];
  for (const p of PEOPLE) {
    const { ctx, page } = await openPage(browser);
    await page.evaluate(() => { document.getElementById('introGateModal').style.display = 'none'; goToStep(2); });
    await page.fill('#year', p.y); await page.fill('#month', p.m); await page.fill('#day', p.d);
    await page.selectOption('#hourSelect', p.hour); await page.selectOption('#gender', p.gender);
    await page.fill('#userJob', p.job); await page.fill('#userDream', p.dream);
    await page.evaluate(() => submitAndGoToResult()); await page.waitForTimeout(400);
    const view = await page.evaluate(() => [...document.querySelectorAll('.app-container > .view-step')].find(v => v.style.display !== 'none').id);
    assert.equal(view, 'viewResult', p.label);
    const text = await page.evaluate(() => document.getElementById('viewResult').innerText);
    assert.ok(text.length > 2000, `${p.label}: 결과 글이 너무 짧다 (${text.length}자)`);
    assert.deepEqual(brokenBits(text), [], `${p.label}: 깨진 값`);
    assert.deepEqual(josaErrors(text), [], `${p.label}: 조사 오류`);
    const emptyKeys = await page.evaluate(() => [...document.querySelectorAll('#viewResult .key-line-text')].filter(e => e.getClientRects().length && !e.innerText.trim()).length);
    assert.equal(emptyKeys, 0, `${p.label}: 비어 있는 핵심 줄`);
    await page.evaluate(() => openPaymentModal()); await page.waitForTimeout(150);
    const modal = await page.evaluate(() => document.getElementById('paymentModal').innerText);
    assert.deepEqual(brokenBits(modal), [], `${p.label}: 결제창 깨진 값`);
    const log = await page.evaluate(() => window.__trackLog || []);
    assert.deepEqual(log, ['visit', 'free', 'payopen'], `${p.label}: 숫자 세기 호출`);
    assert.deepEqual(page._errors, [], `${p.label}: 페이지 오류`);
    assert.deepEqual(consoleErrors(page), [], `${p.label}: 콘솔 오류`);
    seen.push(text.slice(0, 400));
    await ctx.close();
  }
  assert.equal(new Set(seen).size, PEOPLE.length, '사람마다 결과 첫머리가 달라야 한다');
});

test('궁합 3쌍(남녀·여여·남남): 결과·보내기·받은 링크 열기까지 깨진 값·조사 오류·콘솔 오류가 없다', async () => {
  for (const { label, a, b } of PAIRS) {
    const { ctx, page } = await openPage(browser);
    await page.evaluate(() => { window.__shared = null; navigator.share = async d => { window.__shared = d; }; document.getElementById('introGateModal').style.display = 'none'; openFeature('compat'); });
    for (const [pre, v] of [['ca', a], ['cb', b]]) {
      await page.fill(`#${pre}Name`, v.name);
      await page.fill(`#${pre}Y`, v.y); await page.fill(`#${pre}M`, v.m); await page.fill(`#${pre}D`, v.d);
      await page.selectOption(`#${pre}H`, v.h); await page.selectOption(`#${pre}G`, v.g);
    }
    await page.click('#compatGo'); await page.waitForTimeout(300);
    const text = await page.evaluate(() => document.getElementById('compatResult').innerText);
    const score = Number(await page.textContent('#compatResult .score-num'));
    assert.ok(Number.isInteger(score) && score >= 0 && score <= 100, `${label}: 점수 ${score}`);
    assert.ok((await page.textContent('#compatResult .score-band')).trim(), `${label}: 점수 이름이 비었다`);
    assert.ok(text.includes(a.name) && text.includes(b.name), `${label}: 두 사람 이름`);
    const styles = await page.evaluate(() => [...document.querySelectorAll('#compatResult .feature-text')].map(e => e.innerText).filter(t => / — /.test(t)));
    assert.equal(styles.length, 2, `${label}: 사랑하는 방식 두 줄`);
    assert.ok(styles.every(t => t.split(' — ')[1].trim().length > 10), `${label}: 사랑하는 방식이 비었다`);
    assert.deepEqual(brokenBits(text), [], `${label}: 깨진 값`);
    assert.deepEqual(josaErrors(text), [], `${label}: 조사 오류`);

    await page.click('#compatShare'); await page.waitForTimeout(200);
    const url = (await page.evaluate(() => window.__shared)).url;
    assert.ok(url.endsWith('?compat=1&n=' + encodeURIComponent(a.name)), `${label}: 보내는 링크 ${url}`);
    for (const v of [a, b]) assert.ok(!url.includes(v.y), `${label}: 링크에 생년이 들어갔다`);
    assert.deepEqual(await page.evaluate(() => window.__trackLog), ['visit', 'compat', 'compatsend'], `${label}: 숫자 세기 호출`);
    assert.deepEqual(page._errors, [], `${label}: 페이지 오류`);
    assert.deepEqual(consoleErrors(page), [], `${label}: 콘솔 오류`);
    await ctx.close();

    // 받은 사람이 링크를 연다 (파일로 여는 테스트라 주소의 꼬리표만 옮긴다)
    const r = await openPage(browser, { url: 'file://' + SITE + url.slice(url.indexOf('?')) });
    const invite = await r.page.textContent('.compat-invite');
    assert.ok(invite.startsWith(`${a.name}${/[가-힣]/.test(a.name.slice(-1)) && (a.name.slice(-1).charCodeAt(0) - 0xAC00) % 28 ? '이' : '가'} 너랑 궁합을 보고 싶다는구나.`), `${label}: 받은 사람 안내 "${invite}"`);
    assert.equal(await r.page.inputValue('#cbName'), a.name);
    assert.deepEqual(brokenBits(invite), []);
    assert.deepEqual(await r.page.evaluate(() => window.__trackLog), ['visit', 'invited']);
    assert.deepEqual(r.page._errors, []); assert.deepEqual(consoleErrors(r.page), []);
    await r.ctx.close();
  }
});

test('점검 도구 자체 확인: 알려진 실수는 잡고, 맞는 글은 그냥 둔다', () => {
  assert.deepEqual(josaErrors('너는 [애견미용사]과 잘 맞는다'), ['[애견미용사]과']);
  assert.deepEqual(josaErrors("꿈 '억만장자'은 쇠 기운"), ["'억만장자'은"]);
  assert.deepEqual(josaErrors('너는 [애견미용사]와 잘 맞고, [회사원]이 된다. [흡기귀(吸氣鬼, 기운을 빨아먹는 귀신)]가 붙는다'), []);
  assert.equal(brokenBits('점수 NaN점, 이름 undefined, 직업 []와').length, 3);
  assert.deepEqual(brokenBits('점수 82점, 직업 [개발자]와'), []);
});

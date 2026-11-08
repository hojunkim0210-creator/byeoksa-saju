// 여러 사람으로 돌려 보기 (업데이트 38, 2026-11-07 대표님 당부: "날짜·성별을 바꿔도 값이 제대로 나오게 해야 두세 번 일 안 한다")
//   11/3 전체 점검과 같은 5명(생년월일·성별·태어난 시간 — 모름 포함, 직업·꿈 빈칸 포함) + 궁합 3쌍(남녀·여여·남남)으로
//   무료 결과 · 결제창 · 궁합 · '상대에게 보내기' · 받은 링크 열기 · 숫자 세기 호출을 돌려
//   깨진 값(undefined·NaN·null·빈 괄호)·조사 오류·콘솔 오류가 0개인지 본다.
// 업데이트 39 (2026-11-08 디자인 검수): 토끼날(卯) 사람 1명 추가('지닌으로' 깨짐), 괄호 뒤 조사 규칙('운(정재)로' → '으로'),
//   오늘의 운세·벽사견에게 묻기(8가지 답)·신년운세 무료 맛보기와 접어 둔 사주 표도 같은 기준으로 본다.
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
  { label: '1972 남 해시 (직업 빈칸)', y: '1972', m: '7', d: '15', hour: '11', gender: 'M', job: '', dream: '세계 여행' },
  { label: '1994 여 시간 모름 (토끼날 계묘)', y: '1994', m: '5', d: '17', hour: '-1', gender: 'F', job: '회사원', dream: '내 가게 열기' },
  // 업데이트 44 (2026-11-09 더블체크 1-3): 첫 10년 운 전인 어린이 2명과 여덟 칸을 다 지난 90대 1명
  { label: '2020 남 시간 모름 (만 6세, 첫 10년 운 전)', y: '2020', m: '6', d: '15', hour: '-1', gender: 'M', job: '', dream: '' },
  { label: '2024 여 시간 모름 (만 2세, 첫 10년 운 전)', y: '2024', m: '6', d: '15', hour: '-1', gender: 'F', job: '', dream: '' },
  { label: '1935 남 시간 모름 (만 91세, 여덟 칸 뒤)', y: '1935', m: '6', d: '15', hour: '-1', gender: 'M', job: '', dream: '' }
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

/** 조사 오류: [직업]과 / '꿈'은 / 운(정재)로 처럼 끼워 넣은 낱말 뒤의 조사가 받침과 맞는지
 *  (2026-11-01 '[애견미용사]과', 2026-11-08 '기운(살)로'·'소띠(축)을' 같은 실수를 잡는다) */
const JOSA = '(으로|로|을|를|이|가|은|는|과|와)(?![가-힣])';
function josaErrors(text) {
  const out = [];
  const res = [
    new RegExp(`\\[([^\\]\\n]{1,30})\\]${JOSA}`, 'g'),                      // [끼워 넣은 낱말]조사
    new RegExp(`'([^'\\s][^'\\n]{0,28}[^'\\s]|[^'\\s])'${JOSA}`, 'g'),       // '끼워 넣은 낱말'조사
    new RegExp(`([가-힣]+)\\(([^()\\n]{1,30})\\)${JOSA}`, 'g')                  // 낱말(괄호 풀이)조사 — 조사는 괄호 앞 낱말을 따른다
  ];
  for (const re of res) for (const m of text.matchAll(re)) {
    // 괄호 풀이는 건너뛰고 본말에 맞춘다: '흡기귀(…귀신)가' → 흡기귀가
    let word = m[1]; while (/\([^()]*\)\s*$/.test(word)) word = word.replace(/\s*\([^()]*\)\s*$/, '');
    const last = word.replace(/[^가-힣]+$/, '').match(/[가-힣]$/);
    if (!last) continue;
    const jong = (last[0].charCodeAt(0) - 0xAC00) % 28, has = jong !== 0;   // 받침 0 = 없음, 8 = ㄹ
    const j = m[m.length - 1];
    const ok = { '으로': has && jong !== 8, '로': !has || jong === 8, '을': has, '를': !has, '이': has, '가': !has, '은': has, '는': !has, '과': has, '와': !has }[j];
    if (!ok) out.push(m[0]);
  }
  return out;
}
// 파일로 여는 테스트에서만 생기는 것은 뺀다: 외부 주소 차단(Failed to load resource), 결제 수 서버 /api/stats (실제 사이트에는 있다)
const consoleErrors = page => page._console.filter(t => !/^Failed to load resource|^Fetch API cannot load file:\/\/\/api\//.test(t));

test('사주 6명: 무료 결과·결제창·오늘의 운세·묻기·신년운세 맛보기에 깨진 값·조사 오류·콘솔 오류가 없고, 숫자 세기(free·payopen)가 불린다', async () => {
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
    // 접어 둔 사주 표(업데이트 39)는 화면 글에 안 잡히니 따로 본다
    const table = await page.evaluate(() => document.querySelector('#viewResult .saju-table').textContent);
    assert.deepEqual(brokenBits(table), [], `${p.label}: 사주 표 깨진 값`);
    const first = await page.evaluate(() => document.getElementById('animalDesc').textContent);
    assert.ok(!/지닌으로/.test(first), `${p.label}: '지닌으로' 깨짐 — "${first.slice(0, 90)}"`);
    if (p.label.includes('토끼날')) assert.ok(/매력을 지닌 토끼의 기질로 빚어졌소/.test(first), `${p.label}: 첫 카드 "${first.slice(0, 90)}"`);
    await page.evaluate(() => openPaymentModal()); await page.waitForTimeout(150);
    const modal = await page.evaluate(() => document.getElementById('paymentModal').innerText);
    assert.deepEqual(brokenBits(modal), [], `${p.label}: 결제창 깨진 값`);
    await page.evaluate(() => closePaymentModal());
    // 같은 사람으로 오늘의 운세 · 묻기(첫 인사 + 8가지 답) · 신년운세 무료 맛보기
    const more = await page.evaluate(() => {
      const out = {};
      openFeature('daily'); out.daily = document.getElementById('viewDaily').innerText;
      openFeature('chat'); out.chatHello = document.getElementById('viewChat').innerText;
      const prof = JSON.parse(localStorage.getItem('byeoksa.profile.v1'));
      const X = window.BYEOKSA_EXTRAS, sj = X.readSaju(prof);
      out.chat = X.TOPICS.map(t => X.answer(t.id, prof, sj).replace(/<[^>]+>/g, ' ')).join('\n');
      openFeature('newyear'); out.newyear = document.getElementById('viewNewYear').innerText;
      return out;
    });
    for (const [k, t] of Object.entries(more)) {
      assert.ok(t.trim().length > 30, `${p.label}: ${k} 글이 비었다`);
      assert.deepEqual(brokenBits(t), [], `${p.label}: ${k} 깨진 값`);
      assert.deepEqual(josaErrors(t), [], `${p.label}: ${k} 조사 오류`);
    }
    const log = await page.evaluate(() => window.__trackLog || []);
    assert.deepEqual(log, ['visit', 'free', 'payopen'], `${p.label}: 숫자 세기 호출`);
    assert.deepEqual(page._errors, [], `${p.label}: 페이지 오류`);
    assert.deepEqual(consoleErrors(page), [], `${p.label}: 콘솔 오류`);
    seen.push(text.slice(0, 400));
    await ctx.close();
  }
  assert.equal(new Set(seen).size, PEOPLE.length, '사람마다 결과 첫머리가 달라야 한다');
});

test("'지금 운'은 지금 나이에 맞는 칸 — 어린이는 '첫 10년 운이 열리기 전', 90대는 늘린 칸 중 '현재' 칸 (업데이트 44, 더블체크 1-3·3-1)", async () => {
  for (const p of PEOPLE.filter(x => /첫 10년 운 전|여덟 칸 뒤/.test(x.label))) {
    const { ctx, page } = await openPage(browser);
    await page.evaluate(() => { document.getElementById('introGateModal').style.display = 'none'; goToStep(2); });
    await page.fill('#year', p.y); await page.fill('#month', p.m); await page.fill('#day', p.d);
    await page.selectOption('#hourSelect', p.hour); await page.selectOption('#gender', p.gender);
    await page.evaluate(() => submitAndGoToResult()); await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const t = id => document.getElementById(id).innerText;
      unlockContent();
      return { comment: t('daeunComment'), key: document.querySelector('#daeunCard .key-line-text') ? document.querySelector('#daeunCard .key-line-text').innerText : '',
        glance: t('glanceList'), summary: (document.querySelector('.rs-card') || {}).innerText || '', current: document.querySelectorAll('#daeunScroll .current-daeun').length,
        cols: document.querySelectorAll('#daeunScroll .daeun-item').length, child: !document.getElementById('childNote').hidden };
    });
    if (/첫 10년 운 전/.test(p.label)) {
      assert.match(r.comment, /아직 첫 10년 운이 열리기 전이오\./, p.label);
      assert.match(r.key, /^지금은 첫 10년 운이 열리기 전, 만 \d세 · \d+세에 첫 10년 운\([가-힣]{2}\)이 열리오\.$/, p.label);
      assert.match(r.glance, /첫 10년 운은 \d+세에 열리오\(지금은 그 전\)/, p.label);
      assert.match(r.summary, /첫 10년 운 [가-힣]{2} · \d+세에 열림 \(지금 만 \d세\)/, p.label);
      assert.equal(r.current, 0); assert.equal(r.child, true, '어린이 한 줄');
      assert.ok(!/한복판/.test(r.comment + r.key + r.glance), p.label);
    } else {
      assert.equal(r.current, 1, '늘린 칸 중 현재 칸 하나'); assert.ok(r.cols > 8);
      const m = r.key.match(/^지금은 (\d+)세부터의 10년 운\([가-힣]{2}\) 한복판, 만 (\d+)세/);
      assert.ok(m && +m[1] <= +m[2] && +m[2] <= +m[1] + 9, `${p.label}: ${r.key}`);
      assert.equal(r.child, false);
    }
    assert.deepEqual(page._errors, []);
    await ctx.close();
  }
});

test('아직 오지 않은 날짜(2028-01-01)는 입력 화면·궁합 모두 하오체 안내로 막는다 (업데이트 44, 더블체크 1-4)', async () => {
  const { ctx, page } = await openPage(browser);   // 테스트 시계는 2026-10-12
  await page.evaluate(() => { document.getElementById('introGateModal').style.display = 'none'; goToStep(2); });
  await page.fill('#year', '2028'); await page.fill('#month', '1'); await page.fill('#day', '1');
  await page.evaluate(() => submitAndGoToResult()); await page.waitForTimeout(200);
  assert.deepEqual(page._alerts, ['아직 오지 않은 날이오. 태어난 날을 다시 확인하시오.']);
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.getElementById('viewInput')).display), 'none');
  await page.evaluate(() => openFeature('compat'));
  await page.fill('#caY', '1990'); await page.fill('#caM', '3'); await page.fill('#caD', '10');
  await page.fill('#cbY', '2028'); await page.fill('#cbM', '1'); await page.fill('#cbD', '1');
  await page.click('#compatGo'); await page.waitForTimeout(200);
  assert.equal(await page.textContent('#compatErr'), '상대: 아직 오지 않은 날이오. 태어난 날을 다시 확인하시오.');
  await ctx.close();
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
    assert.ok(invite.startsWith(`${a.name}${/[가-힣]/.test(a.name.slice(-1)) && (a.name.slice(-1).charCodeAt(0) - 0xAC00) % 28 ? '이' : '가'} 그대와 궁합을 보고 싶다는구려.`), `${label}: 받은 사람 안내 "${invite}"`);
    assert.equal(await r.page.inputValue('#cbName'), a.name);
    assert.deepEqual(brokenBits(invite), []);
    assert.deepEqual(await r.page.evaluate(() => window.__trackLog), ['visit', 'invited']);
    assert.deepEqual(r.page._errors, []); assert.deepEqual(consoleErrors(r.page), []);
    await r.ctx.close();
  }
});

test('점검 도구 자체 확인: 알려진 실수는 잡고, 맞는 글은 그냥 둔다', () => {
  // 괄호 뒤 조사 (업데이트 39, 검수 12번)
  assert.deepEqual(josaErrors('나쁜 기운(살)로 변할 조짐이다'), ['기운(살)로']);
  assert.deepEqual(josaErrors('꾸준한 돈이 쌓이는 운(정재)로 들어온다'), ['운(정재)로']);
  assert.deepEqual(josaErrors('귀인인 소띠(축)을 곁에 두고'), ['소띠(축)을']);
  assert.deepEqual(josaErrors('나쁜 기운(살)으로 변하고, 운(정재)으로 들어오고, 소띠(축)를 곁에, [별]로 가고, 운(정재)이 앉는다'), []);
  assert.deepEqual(josaErrors('[달]으로 간다'), ['[달]으로']);
  assert.deepEqual(josaErrors('너는 [애견미용사]과 잘 맞는다'), ['[애견미용사]과']);
  assert.deepEqual(josaErrors("꿈 '억만장자'은 쇠 기운"), ["'억만장자'은"]);
  assert.deepEqual(josaErrors('너는 [애견미용사]와 잘 맞고, [회사원]이 된다. [흡기귀(吸氣鬼, 기운을 빨아먹는 귀신)]가 붙는다'), []);
  assert.equal(brokenBits('점수 NaN점, 이름 undefined, 직업 []와').length, 3);
  assert.deepEqual(brokenBits('점수 82점, 직업 [개발자]와'), []);
});

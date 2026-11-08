// 벽사견 말투 = 하오체 + '그대' (업데이트 41, 2026-11-08 대표님 결정 — 지침 marketing/말투_하오체.md)
//   첫인상 화면(대문·관문·입력·무료 결과·결제 유도·알림)에 반말 말끝(~다·~거라·~느냐…)과 '너·네가·네 ○○'이 남으면 실패한다.
//   따옴표 안(다른 사람 말·손님 속말·주문)과 옛이야기 서술(대문 설화 띠 앞 두 줄), 손님 쪽 단추·다짐 말은 반말 그대로 둔다.
//   궁합·운세·묻기(업데이트 42)와 유료 리포트(43)는 아직 반말 — 그 단계에서 이 검사에 화면을 더한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium, openPage } = require('./helpers');

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

const KEEP = ['문을 두드린다', '사주를 꿰뚫어 보는 눈을 뜬다', '내 안의 흉살은 물러가고 천명이 일어선다'];   // 손님 쪽 단추·다짐, 주문
const unquote = t => t.replace(/"[^"\n]*"|'[^'\n]*'|“[^”\n]*”|‘[^’\n]*’/g, ' ');
function leftovers(text) {
  let t = text; for (const k of KEEP) t = t.split(k).join(' ');
  t = unquote(t);
  const out = [];
  for (const m of t.matchAll(/([가-힣]+)(?=\s*([.!?…]|$))/gm)) {
    const w = m[1];
    if (!m[2] && /(지|마)$/.test(w)) continue;   // 줄 끝의 '민지'·'○마' 같은 이름은 말끝이 아니다 (~지·~마 말끝은 마침표·물음표가 붙는다)
    if (/(습니다|[합됩입갑]니다)$/.test(w)) continue;          // 존댓말(결제·약관 안내)
    if (/(는|은|을|인|던|할|될|올|갈)지$/.test(w)) continue;   // '어떻게 닿는지'처럼 묻는 말을 품은 이름씨 꼴 — 말끝이 아니다
    if (/(다|거라|어라|아라|여라|마라|구나|느냐|냐|라|마|지)$/.test(w) && !/(니다)$/.test(w)) out.push(t.slice(Math.max(0, m.index - 25), m.index + w.length + 2).replace(/\s+/g, ' '));
  }
  for (const m of t.matchAll(/(?<![가-힣])(너는|너를|네가|네게|네겐|널|넌|너의|너만)(?![가-힣])|(?<![가-힣])너(?=[,\s])|(?<![가-힣])네 (?!기둥|가지 지표)(?=[가-힣])/g)) {   // '네 기둥'·'네 가지 지표'는 숫자 넷
    out.push('[부르는 말] ' + t.slice(Math.max(0, m.index - 20), m.index + 14).replace(/\s+/g, ' '));
  }
  return out;
}

test('점검 도구 자체 확인: 반말·너는 잡고, 하오체·따옴표 속 말·존댓말은 그냥 둔다', () => {
  assert.equal(leftovers('그대의 뼈대는 단단하다. 너는 끝까지 버틴다.').length, 3);
  assert.deepEqual(leftovers('그대의 뼈대는 단단하오. "같이 하자"며 다가온 자. 결제가 완료되었습니다. 네 기둥 원국'), []);
});

async function screens(page, p) {
  // 관문(대문 안내창)과 대문 — 옛이야기 서술 두 줄은 뺀다
  const gate = await page.evaluate(() => document.querySelector('#introGateModal .intro-modal-body').innerText);
  const landing = await page.evaluate(() => { const c = document.getElementById('viewLanding').cloneNode(true); c.querySelectorAll('.lore-line, .lore-sub, .site-footer').forEach(e => e.remove()); return c.innerText || c.textContent; });
  await page.evaluate(() => { document.getElementById('introGateModal').style.display = 'none'; goToStep(2); });
  const input = await page.evaluate(() => document.getElementById('viewInput').innerText);
  await page.evaluate(() => submitAndGoToResult()); await page.waitForTimeout(150);   // 빈칸 알림
  await page.fill('#year', p.y); await page.fill('#month', p.m); await page.fill('#day', p.d);
  await page.selectOption('#hourSelect', p.hour); await page.selectOption('#gender', p.gender);
  await page.fill('#userJob', p.job); await page.fill('#userDream', p.dream);
  await page.evaluate(() => submitAndGoToResult()); await page.waitForTimeout(400);
  const result = await page.evaluate(() => document.getElementById('viewResult').innerText);
  const extra = await page.evaluate(() => RITUAL_LINES.join('. '));
  return { gate, landing, input, alerts: page._alerts.join('\n'), result, ritual: extra };
}

test('첫인상 화면은 하오체 + \'그대\' — 사주 3명(토끼날·시간 앎·꿈 빈칸)으로 반말 말끝·너/네가가 남지 않는다', async () => {
  for (const p of [
    { y: '1994', m: '5', d: '17', hour: '-1', gender: 'F', job: '회사원', dream: '내 가게 열기' },
    { y: '1990', m: '3', d: '10', hour: '6', gender: 'M', job: '개발자', dream: '창업' },
    { y: '1972', m: '7', d: '15', hour: '11', gender: 'M', job: '', dream: '' }
  ]) {
    const { ctx, page } = await openPage(browser);
    const s = await screens(page, p);
    for (const [k, v] of Object.entries(s)) {
      assert.ok(v.trim().length > 5, `${k} 글이 비었다`);
      assert.deepEqual(leftovers(v), [], `${p.y}-${p.m}-${p.d} ${k}: 반말이 남았다`);
    }
    assert.match(s.result, /그대/, '무료 결과에 그대가 나와야 한다');
    assert.deepEqual(page._errors, []);
    await ctx.close();
  }
});

// 업데이트 42: 궁합(입력·결과·상세 맛보기·보내기)·받은 링크 안내·오늘의 운세·벽사 패·묻기(인사·8가지 답)·신년운세 맛보기·상품/묶음 결제창 설명.
//   손님이 친구에게 보내는 공유 문구("너랑 나 궁합 공짜로 봐 준대…")와 손님이 고르는 질문 칩("돈은 언제 모여?")은 손님 말이라 반말 그대로.
test('무료 기능 화면도 하오체 + \'그대\' — 궁합·운세·패·묻기·신년운세 맛보기·결제창 설명 (사주 2명, 궁합 2쌍)', async () => {
  const SITE = require('./helpers').SITE;
  for (const p of [
    { y: '1994', m: '5', d: '17', hour: '-1', gender: 'F', b: { y: '1990', m: '3', d: '10', g: 'M' } },
    { y: '1985', m: '12', d: '25', hour: '0', gender: 'F', b: { y: '1999', m: '5', d: '5', g: 'F' } }
  ]) {
    const { ctx, page } = await openPage(browser);
    await page.evaluate(prof => { document.getElementById('introGateModal').style.display = 'none'; localStorage.setItem('byeoksa.profile.v1', JSON.stringify(prof)); },
      { y: +p.y, m: +p.m, d: +p.d, hour: +p.hour, gender: p.gender });
    const s = {};
    // 궁합: 입력 화면 → 결과(무료 카드 + 상세 맛보기 + 보내기) → 상세 결제창 설명
    await page.evaluate(() => openFeature('compat'));
    s.compatForm = await page.evaluate(() => document.getElementById('viewCompat').innerText);
    await page.fill('#caName', '민지'); await page.fill('#cbName', '준석');
    await page.fill('#cbY', p.b.y); await page.fill('#cbM', p.b.m); await page.fill('#cbD', p.b.d); await page.selectOption('#cbG', p.b.g);
    await page.click('#compatGo'); await page.waitForTimeout(300);
    s.compatResult = await page.evaluate(() => document.getElementById('compatResult').innerText);
    await page.click('#compatBuy'); await page.waitForTimeout(150);
    s.compatModal = await page.evaluate(() => document.getElementById('productModalBody').innerText);
    await page.evaluate(() => closePaymentModal());
    // 오늘의 운세 · 벽사 패(뒤집기) · 묻기(인사 + 8가지 답)
    await page.evaluate(() => openFeature('daily')); s.daily = await page.evaluate(() => document.getElementById('viewDaily').innerText);
    await page.evaluate(() => openFeature('tarot')); await page.click('#tarotCard'); await page.waitForTimeout(400);
    s.tarot = await page.evaluate(() => document.getElementById('viewTarot').innerText);
    await page.evaluate(() => openFeature('chat')); s.chatHello = await page.evaluate(() => document.getElementById('viewChat').innerText);
    s.chat = await page.evaluate(() => { const prof = JSON.parse(localStorage.getItem('byeoksa.profile.v1')); const X = window.BYEOKSA_EXTRAS, sj = X.readSaju(prof); return X.TOPICS.map(tp => X.answer(tp.id, prof, sj).replace(/<[^>]+>/g, ' ')).join('\n'); });
    // 신년운세 맛보기 → 결제창 설명, 묶음 결제창 설명
    await page.evaluate(() => openFeature('newyear')); s.newyear = await page.evaluate(() => document.getElementById('viewNewYear').innerText);
    await page.click('#nyBuy'); await page.waitForTimeout(150);
    s.nyModal = await page.evaluate(() => document.getElementById('productModalBody').innerText);
    await page.evaluate(() => { closePaymentModal(); openBundleFromShelf(); });
    s.bundleModal = await page.evaluate(() => document.getElementById('productModalBody').innerText);
    for (const [k, v] of Object.entries(s)) {
      assert.ok(v.trim().length > 20, `${k} 글이 비었다`);
      assert.deepEqual(leftovers(v), [], `${p.y}-${p.m}-${p.d} ${k}: 반말이 남았다`);
    }
    assert.match(s.compatResult, /그대|두 사람/);
    assert.deepEqual(page._errors, []);
    await ctx.close();
  }
  // 받은 궁합 링크의 안내 한 줄
  const r = await openPage(browser, { url: 'file://' + SITE + '?compat=1&n=' + encodeURIComponent('민지') });
  const invite = await r.page.textContent('.compat-invite');
  assert.match(invite, /^민지가 그대와 궁합을 보고 싶다는구려\. 위에는 그대 생일, 아래에는 민지의 생일을 넣어 보시오\.$/);
  assert.deepEqual(leftovers(invite), []);
  await r.ctx.close();
});

// 업데이트 43: 유료 글 — 천명 리포트 6장(요약·부적 포함), 신년운세 열두 달 풀이, 궁합 상세 본문.
//   두 사람이 서로에게 할 한마디("고마워, 네 덕분이야.")와 말다툼 때 피할 말("넌 왜 그렇게 눈치를 보냐")은 따옴표 속 말이라 반말 그대로.
test('유료 글도 하오체 + \'그대\' — 리포트 6장·신년운세 열두 달·궁합 상세 (사주 2명, 궁합 2쌍, 테스트 결제)', async () => {
  for (const p of [
    { y: '1994', m: '5', d: '17', hour: '-1', gender: 'F', job: '회사원', dream: '내 가게 열기', b: { y: '1990', m: '3', d: '10', g: 'M' } },
    { y: '1972', m: '7', d: '15', hour: '11', gender: 'M', job: '', dream: '', b: { y: '1985', m: '12', d: '25', g: 'F' } }
  ]) {
    const { ctx, page } = await openPage(browser);
    await page.evaluate(() => { document.getElementById('introGateModal').style.display = 'none'; goToStep(2); });
    await page.fill('#year', p.y); await page.fill('#month', p.m); await page.fill('#day', p.d);
    await page.selectOption('#hourSelect', p.hour); await page.selectOption('#gender', p.gender);
    await page.fill('#userJob', p.job); await page.fill('#userDream', p.dream);
    await page.evaluate(() => submitAndGoToResult()); await page.waitForTimeout(400);
    const s = {};
    await page.evaluate(() => { unlockContent(); }); await page.waitForTimeout(300);
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));   // 책장을 모두 펼친다(인쇄 직전과 같게)
    s.report = await page.evaluate(() => document.getElementById('viewReport').innerText);
    await page.evaluate(() => openFeature('newyear')); await page.click('#nyBuy'); await page.click('#productPayBtn'); await page.waitForTimeout(400);
    s.newyearFull = await page.evaluate(() => document.getElementById('viewNewYear').innerText);
    await page.evaluate(() => openFeature('compat'));
    await page.fill('#caName', '민지'); await page.fill('#cbName', '준석');
    await page.fill('#cbY', p.b.y); await page.fill('#cbM', p.b.m); await page.fill('#cbD', p.b.d); await page.selectOption('#cbG', p.b.g);
    await page.click('#compatGo'); await page.waitForTimeout(300);
    await page.click('#compatBuy'); await page.click('#productPayBtn'); await page.waitForTimeout(400);
    s.compatDetail = await page.evaluate(() => (document.getElementById('compatDetail') || {}).innerText || '');
    assert.ok(s.report.length > 3000, `리포트가 너무 짧다 (${s.report.length}자)`);
    assert.match(s.newyearFull, /열두 달|1월|월/); assert.match(s.compatDetail, /싸우는 패턴/);
    for (const [k, v] of Object.entries(s)) assert.deepEqual(leftovers(v), [], `${p.y}-${p.m}-${p.d} ${k}: 반말이 남았다`);
    assert.match(s.compatDetail, /"(네 생각 좋다, 한번 해 봐|고마워, 네 덕분이야|괜찮아, 내가 여기 있을게|약속한 건 꼭 지킬게|천천히 생각해도 돼)\."/, '서로에게 할 한마디는 반말 그대로');
    assert.deepEqual(page._errors, []);
    await ctx.close();
  }
});

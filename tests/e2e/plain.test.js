// 쉬운 말 (2026-11-02, 손님 평 "뭔 소린지 모르겠다" → 대표님 "더 쉽게"): 조화율 카드
//   조사는 받침에 맞게, 돈 꿈(억만장자 등)은 쇠 기운으로 알아듣고, 명리 용어 없이 쉬운 제목·쉬운 문장, 12운성에는 괄호 풀이
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium, openPage } = require('./helpers');

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

// 카드에 나오면 안 되는 명리 용어 (손님이 모르는 말)
const JARGON = ['원국', '일간', '일지', '식상', '재성', '관성', '인성', '비겁', '오행', '기질', '담금질', '연단', '십신', '12운성'];

async function submit(page, { y, m, d, hour = '-1', gender = 'F', job, major, hobby, dream }) {
  await page.evaluate(() => { document.getElementById('introGateModal').style.display = 'none'; goToStep(2); });
  await page.fill('#year', y); await page.fill('#month', m); await page.fill('#day', d);
  await page.selectOption('#hourSelect', hour); await page.selectOption('#gender', gender);
  await page.fill('#userJob', job); await page.fill('#userMajor', major); await page.fill('#userHobby', hobby); await page.fill('#userDream', dream);
  await page.evaluate(() => submitAndGoToResult()); await page.waitForTimeout(400);
  return page.evaluate(() => ({ text: document.getElementById('fitContent').innerText, key: document.querySelector('#dreamFitCard .key-line-text').innerText }));
}

test('조화율 카드: 조사가 받침에 맞고(애견미용사와), 억만장자는 돈 꿈으로 알아듣고, 명리 용어 없이 쉬운 제목·쉬운 문장·12운성 풀이로 말한다', async () => {
  const { ctx, page } = await openPage(browser);
  const { text: t, key } = await submit(page, { y: '1994', m: '1', d: '23', job: '애견미용사', major: '경영학과', hobby: '러닝', dream: '억만장자' });
  assert.ok(t.includes('[애견미용사]와'), '조사: ' + t.slice(0, 200));
  assert.ok(!t.includes('[애견미용사]과'));
  assert.ok(!/냄새를 맡지 못했다|가늠하기 어렵/.test(t), '억만장자를 돈 꿈으로 알아들어야 한다');
  assert.ok(t.includes('쇠 기운(맺고 끊는 힘)'), '돈 꿈 = 쇠 기운');
  for (const w of ['지금 하는 일과 공부', '틈틈이 하는 일', '벽사견의 한마디', '왜 이 점수인가']) assert.ok(t.includes(w), w);
  for (const w of ['현세의 신분과 무기', '정신의 숨구멍', '벽사견의 일갈', '조화율을 맡은 근거']) assert.ok(!t.includes(w), '옛 제목이 남았다: ' + w);
  assert.ok(t.includes('100%에 가까울수록 잘 맞는다'), '카드가 무엇을 보는지 첫 줄에');
  assert.ok(/너는 [^.]+ 같은 사람이다\./.test(t), '일과 공부: 너는 ○○ 같은 사람이다');
  assert.ok(/네 사주에 (없는|모자란) [가-힣]+ 기운\([^)]+\)/.test(t), '취미: 어떤 기운이 모자라고 무엇을 채우는지');
  assert.ok(/다섯 기운\(나무·불·흙·쇠·물\) 중 \d가지가 있어/.test(t) && /꿈 '억만장자'는 쇠 기운/.test(t) && /\d+%로 보았다\./.test(t), '점수 근거의 쉬운 문장: ' + t.slice(-250));
  assert.ok(/'[가-힣]+'\([^)]*자리\)/.test(t), '12운성 쉬운 말 풀이: ' + (t.match(/자리[^.]*/) || [''])[0]);
  for (const w of JARGON) { assert.ok(!t.includes(w), '카드 본문에 명리 용어: ' + w); assert.ok(!key.includes(w), '핵심 줄에 명리 용어: ' + w); }
  assert.ok(key.includes('네 재주를 밖으로 꺼내 보이는 일') && /조화율 \d+%/.test(key) && /다섯 기운 중 \d가지/.test(key), '핵심 줄: ' + key);
  assert.deepEqual(page._errors, []);
  await ctx.close();
});

test('조화율 카드: 꿈을 못 알아들을 때는 손님 탓이 아니라 점수를 어떻게 매겼는지 평어로 말한다', async () => {
  const { ctx, page } = await openPage(browser);
  const { text: t, key } = await submit(page, { y: '1994', m: '1', d: '23', job: '회사원', major: '', hobby: '', dream: '그냥 잘 살기' });
  assert.ok(/가늠하기 어렵다.*고른 정도/.test(t), t.slice(-300));
  assert.ok(t.includes('왜 이 점수인가'));
  assert.ok(key.includes('아직 흐린 꿈'), key);
  for (const w of JARGON) assert.ok(!t.includes(w) && !key.includes(w), '명리 용어: ' + w);
  await ctx.close();
});

// 업데이트 38 (2026-11-07 대표님 당부 "말 풀이 쉽게 하는 규칙 지키고"): 새로 넣은 글 — 궁합 '상대에게 보내기'·받은 사람 안내 한 줄·대표님용 숫자 페이지에도 명리 용어가 없어야 한다
const NEW_JARGON = [...JARGON, '일주', '일진', '천간', '지지', '명식', '대운', '흉살', '사주팔자', '日柱', '木', '火', '土', '金', '水'];
const { SITE } = require('./helpers');

test('새 글(업데이트 38): 궁합 공유 상자·받은 사람 안내·숫자 페이지에 명리 용어가 없다', async () => {
  const { ctx, page } = await openPage(browser);
  await page.evaluate(() => { document.getElementById('introGateModal').style.display = 'none'; openFeature('compat'); });
  await page.fill('#caName', '민지');
  await page.fill('#caY', '1994'); await page.fill('#caM', '1'); await page.fill('#caD', '23');
  await page.fill('#cbY', '1990'); await page.fill('#cbM', '3'); await page.fill('#cbD', '10');
  await page.click('#compatGo'); await page.waitForTimeout(300);
  const share = await page.textContent('.compat-share');
  assert.ok(share.includes('상대에게 보내기'), share);
  for (const w of NEW_JARGON) assert.ok(!share.includes(w), '공유 상자에 명리 용어: ' + w);
  await ctx.close();

  const r = await openPage(browser, { url: 'file://' + SITE + '?compat=1&n=' + encodeURIComponent('민지') });
  const invite = await r.page.textContent('.compat-invite');
  for (const w of NEW_JARGON) assert.ok(!invite.includes(w), '받은 사람 안내에 명리 용어: ' + w);
  await r.ctx.close();

  const path = require('path'); const { pathToFileURL } = require('url');
  const { renderPage } = await import(pathToFileURL(path.resolve(__dirname, '../../functions/numbers.js')).href);
  const pageText = renderPage([{ day: '2026-11-07', visit: 10, free: 5, payopen: 2, paid: 1, compat: 3, compatsend: 1, invited: 1 }])
    .replace(/<style>[\s\S]*?<\/style>/, '').replace(/<[^>]+>/g, ' ');
  for (const w of NEW_JARGON) assert.ok(!pageText.includes(w), '숫자 페이지에 명리 용어: ' + w);
});

// 업데이트 39 (2026-11-08 디자인 검수 7번): 묻기·신년운세 무료 맛보기·풀이 의식·대운 칸 이름표 — 쉬운 말 먼저, 용어는 괄호 안에만
//   ('상관·목욕·제왕'처럼 보통 낱말과 겹치는 용어는 이 넓은 글 검사에서 빼고, 대운 칸은 모양으로 따로 본다)
const TERMS_39 = ['일주', '천간', '일지', '명식', '오행', '화개', '정재', '편재', '정관', '편관', '식신', '겁재', '정인', '편인', '비견', '포트폴리오', '골든타임'];
const outsideParens = t => { let s = t; while (/\([^()]*\)/.test(s)) s = s.replace(/\([^()]*\)/g, ''); return s; };
const SIPSIN_RE = '(비견|겁재|식신|상관|편재|정재|편관|정관|편인|정인)';
const UNSUNG_RE = '(장생|목욕|관대|건록|제왕|쇠|병|사|묘|절|태|양)';

test('새 글(업데이트 39): 묻기 첫 인사·8가지 답, 신년운세 맛보기, 풀이 의식 줄에 괄호 밖 명리 용어가 없고, 대운 칸은 \'쉬운 말(용어)\' 모양이다', async () => {
  for (const p of [{ y: '1994', m: '5', d: '17', hour: '-1', gender: 'F' }, { y: '1990', m: '3', d: '10', hour: '6', gender: 'M' }, { y: '1972', m: '7', d: '15', hour: '11', gender: 'M' }]) {
    const { ctx, page } = await openPage(browser);
    await submit(page, { ...p, job: '회사원', major: '', hobby: '', dream: '' });
    const t = await page.evaluate(() => {
      const o = {};
      openFeature('chat'); o.chatHello = document.getElementById('viewChat').innerText;
      const prof = JSON.parse(localStorage.getItem('byeoksa.profile.v1')); const X = window.BYEOKSA_EXTRAS, sj = X.readSaju(prof);
      o.chat = X.TOPICS.map(tp => X.answer(tp.id, prof, sj).replace(/<[^>]+>/g, ' ')).join('\n');
      openFeature('newyear'); o.newyear = document.getElementById('viewNewYear').innerText;
      o.ritual = RITUAL_LINES.join(' ');
      o.result = document.getElementById('viewResult').innerText;   // 무료 결과(결제 이유 카드 포함) — 제목의 옛 용어는 그대로 두므로 외래어·'화개의 자리'만 본다
      o.daeunCells = [...document.querySelectorAll('#daeunScroll .daeun-sub')].map(e => [...e.children].map(c => c.textContent.trim()));
      return o;
    });
    for (const k of ['chatHello', 'chat', 'newyear', 'ritual']) {
      const out = outsideParens(t[k]);
      for (const w of TERMS_39) assert.ok(!out.includes(w), `${p.y}-${p.m}-${p.d} ${k}: 괄호 밖 용어 '${w}' — …${out.slice(Math.max(0, out.indexOf(w) - 30), out.indexOf(w) + 20)}…`);
    }
    for (const w of ['포트폴리오', '골든타임', '화개의 자리']) assert.ok(!outsideParens(t.result).includes(w), `무료 결과에 '${w}'`);
    assert.ok(t.daeunCells.length >= 6, '대운 칸');
    for (const [a, b] of t.daeunCells) {
      assert.match(a, new RegExp(`^[가-힣 ]+\\(${SIPSIN_RE}\\)$`), `대운 칸 윗줄 '${a}'`);
      assert.match(b, new RegExp(`^[가-힣 ]+\\(${UNSUNG_RE}\\)$`), `대운 칸 아랫줄 '${b}'`);
    }
    await ctx.close();
  }
});

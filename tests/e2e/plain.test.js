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

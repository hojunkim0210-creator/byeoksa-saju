// 사주 맞춤 문장 검사: 생년월일만 바꿨을 때 판정 문장이 실제로 달라지는지, 깨진 값이 없는지.
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium, openPage, fillAndSubmit } = require('./helpers');

// 꿈·직업은 모두 같게 고정 → 달라지는 건 오직 사주 때문
const PEOPLE = [
  ['1990', '3', '10', '6', 'M'], ['1985', '7', '22', '2', 'F'], ['2001', '11', '3', '-1', 'M'], ['1972', '1', '15', '9', 'F'],
  ['1995', '5', '30', '11', 'M'], ['1968', '9', '9', '0', 'F'], ['2004', '2', '14', '4', 'F'], ['1979', '12', '25', '7', 'M'],
  ['1983', '4', '2', '5', 'M'], ['1999', '8', '18', '8', 'F'], ['1960', '6', '1', '3', 'M'], ['2010', '10', '31', '10', 'F'],
];

let results = [];
test.before(async () => {
  const browser = await chromium.launch();
  for (const [y, m, d, hour, gender] of PEOPLE) {
    const { ctx, page } = await openPage(browser);
    await fillAndSubmit(page, { y, m, d, hour, gender, job: '개발자', dream: '창업' });
    await page.evaluate(() => unlockContent());
    results.push(await page.evaluate(() => {
      const t = sel => (document.querySelector(sel) || {}).innerText || '';
      const cards = [...document.querySelectorAll('#unlockedReportContainer .portfolio-highlight')].map(e => e.innerText);
      return {
        who: '',
        allText: document.getElementById('viewResult').innerText,
        enemies: cards.find(c => c.includes('3대 악연')) || '',
        lovers: [...document.querySelectorAll('#unlockedReportContainer .portfolio-highlight')].filter(e => e.innerText.includes('파멸의 연인') || e.innerText.includes('천생연분')).map(e => e.innerText).join('\n'),
        wealth: ([...document.querySelectorAll('#unlockedReportContainer .portfolio-section-card')].find(c => c.innerText.includes('누재살(漏財煞) 봉인법')) || { innerText: '' }).innerText,
        roadmap: [...document.querySelectorAll('.timeline-relation')].map(e => e.innerText).join('\n'),
        ghost: t('#ghostDesc'), sniff: t('#sniffLoveText') + t('#sniffWealthText') + t('#sniffCareerText'),
        mind: t('#mindItem2'),
        guard: ([...document.querySelectorAll('#unlockedReportContainer .portfolio-highlight')].find(e => e.innerText.includes('누재살 방어 3대 황금 비방')) || { innerText: '' }).innerText,
        plan: ([...document.querySelectorAll('#unlockedReportContainer .portfolio-highlight')].find(e => e.innerText.includes('몰입 결계')) || { innerText: '' }).innerText.split('➕')[0],
        mindPct: t('#mindBadge'), fitPct: t('#fitScore'),
        ghostKind: (document.querySelector('#ghostPortrait .ghost-portrait') || { dataset: {} }).dataset.ghost || '', ghostLore: t('#ghostLore .ghost-lore'),
        ghostSvg: !!document.querySelector('#ghostPortrait svg'), age: new Date().getFullYear() - +document.getElementById('year').value,
      };
    }));
    await ctx.close();
  }
  await browser.close();
});

test('깨진 값(undefined·NaN·[object Object]·영문 오행 코드)이 없다', () => {
  for (const r of results) {
    const bad = r.allText.match(/.{0,30}(undefined|NaN|\[object Object\]|\((wood|fire|earth|metal|water)\)).{0,15}/);
    assert.equal(bad, null, bad && bad[0]);
  }
});

const distinct = key => new Set(results.map(r => r[key])).size;
for (const [key, label, min] of [
  ['enemies', '3대 악연 유형', 3], ['lovers', '파멸의 연인·천생연분', 4], ['wealth', '누재살 재물 진단', 2],
  ['roadmap', '3개년 로드맵 명식 대조', 4], ['guard', '누재살 방어 3대 비방', 5], ['plan', '천명 100일 작전 세 수칙', 5],
  ['mindPct', '심리 투시 %', 4], ['fitPct', '영적 조화율 %', 4], ['ghost', '악연 징조 카드', 3], ['sniff', '후각 감별 티저', 4], ['mind', '밤의 함정', 3],
]) {
  test(`${label}: ${PEOPLE.length}명 중 최소 ${min}가지 이상으로 갈린다`, () => {
    assert.ok(distinct(key) >= min, `${label} 서로 다른 결과 ${distinct(key)}가지`);
  });
}

test('등 뒤 귀신 그림: 모두에게 그림이 있고, 12명 중 4종 이상으로 갈린다', () => {
  for (const r of results) { assert.ok(r.ghostSvg, '귀신 그림 없음'); assert.ok(r.ghostLore.length > 60, '귀신 설명 없음'); }
  assert.ok(new Set(results.map(r => r.ghostKind)).size >= 4, `귀신 ${new Set(results.map(r => r.ghostKind)).size}종`);
});

test('만 19세 미만에게는 지난 연애를 단정하는 문장이 나오지 않는다', () => {
  for (const r of results) {
    if (r.age >= 19) continue;
    assert.ok(!/거쳐간 인연|스쳐 지나간 인연|살을 섞/.test(r.sniff + r.lovers), '미성년 연애 문장');
  }
  assert.ok(results.some(r => r.age < 19), '미성년 표본 없음');
});

test('심리 투시·영적 조화율이 숫자로 나오고 범위 안이다', () => {
  for (const r of results) {
    const m = Number((r.mindPct.match(/(\d+)%/) || [])[1]), f = Number((r.fitPct.match(/(\d+)%/) || [])[1]);
    assert.ok(m >= 60 && m <= 99, r.mindPct); assert.ok(f >= 60 && f <= 98, r.fitPct);
  }
});

test('꿈 뒤 조사가 받침에 맞는다 ("을(를)" 같은 겸용 표기가 없다)', () => {
  for (const r of results) assert.ok(!/\]을\(를\)/.test(r.allText), '을(를) 남아 있음');
});

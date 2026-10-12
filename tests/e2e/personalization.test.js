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
  ['roadmap', '3개년 로드맵 명식 대조', 4], ['ghost', '악연 징조 카드', 3], ['sniff', '후각 감별 티저', 4], ['mind', '밤의 함정', 3],
]) {
  test(`${label}: ${PEOPLE.length}명 중 최소 ${min}가지 이상으로 갈린다`, () => {
    assert.ok(distinct(key) >= min, `${label} 서로 다른 결과 ${distinct(key)}가지`);
  });
}

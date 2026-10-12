// 화면 회귀 스냅샷: 각 단계의 모든 보이는 요소에 대해 (태그·클래스·텍스트·주요 계산 스타일·위치)를 기록한다.
// 사용: node tests/e2e/snapshot.js <html 경로> <출력.json>
const { chromium, openPage, fillAndSubmit } = require('./helpers');
const PROPS = ['display','position','color','background-color','font-size','font-weight','line-height','width','height',
  'margin-top','margin-bottom','padding-top','padding-left','border-top-width','border-top-color','border-radius','flex-direction','gap','text-align','opacity'];

async function snap(page) {
  return page.evaluate((PROPS) => [...document.querySelectorAll('body *')].filter(e => {
      const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
    }).map(e => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
      return [e.tagName, String(e.className), [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join("|").slice(0, 80),
        PROPS.map(p => cs.getPropertyValue(p)).join(';'), Math.round(r.x + scrollX), Math.round(r.y + scrollY), Math.round(r.width), Math.round(r.height)].join('§'); }), PROPS);
}

(async () => {
  const [file, out] = process.argv.slice(2);
  const browser = await chromium.launch();
  const { page } = await openPage(browser, { url: 'file://' + require('path').resolve(file) });
  const res = { intro: await snap(page) };
  await page.evaluate(() => { document.getElementById('introGateModal').style.display = 'none'; openHanjiScroll(); });
  await page.waitForTimeout(900); res.scroll = await snap(page);
  await page.evaluate(() => { closeHanjiScroll(); }); await page.waitForTimeout(400);
  await page.evaluate(() => goToStep(1)); res.landing = await snap(page);
  await fillAndSubmit(page); res.result = await snap(page);
  await page.evaluate(() => unlockContent()); await page.waitForTimeout(600); res.unlocked = await snap(page);
  require('fs').writeFileSync(out, JSON.stringify(res));
  console.log(Object.entries(res).map(([k, v]) => `${k}:${v.length}`).join(' '), '| errors:', page._errors.length);
  await browser.close();
})();

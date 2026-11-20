// 2027 띠별 운세 페이지 (업데이트 49, 2026-11-20 — 검색으로 오는 손님용 무료 페이지 site/2027/)
//   글은 marketing/2027_띠별_표.md 한 표에서만 옮겨 tools/zodiac2027/build.js 가 만든다.
//   12띠 + 목록 1장이 있고, 제목·설명이 서로 다르고, 끝 버튼이 '바로 입력' 주소로 가고, 하오체이고, 휴대폰에서 가로로 넘치지 않는지 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path');
const { chromium, openPage } = require('./helpers');
const { ZODIAC, ENDING, VERSION } = require('../../tools/zodiac2027/build.js');

const ROOT = path.resolve(__dirname, '../..');
const DIR = path.join(ROOT, 'site/2027');
const read = f => fs.readFileSync(f, 'utf8');
const FILES = ['index.html', ...ZODIAC.map(z => `${z.slug}.html`)];
const pick = (html, re) => (html.match(re) || [])[1];
const textOf = html => html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<head>[\s\S]*?<\/head>/, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ');

test('띠별 페이지 13장(목록 + 12띠)이 있고, 스크립트로 다시 만든 것과 같다(손으로 고치지 않았다)', () => {
  assert.equal(ZODIAC.length, 12);
  for (const f of FILES) assert.ok(fs.existsSync(path.join(DIR, f)), `site/2027/${f} 없음`);
  // 같은 스크립트로 임시 폴더에 만들어 비교
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'z2027-'));
  const src = read(path.join(ROOT, 'tools/zodiac2027/build.js')).replace("path.resolve(__dirname, '../../site/2027')", JSON.stringify(path.join(tmp, '2027')));
  fs.writeFileSync(path.join(tmp, 'build.js'), src);
  require('child_process').execFileSync(process.execPath, [path.join(tmp, 'build.js')]);
  for (const f of FILES) assert.equal(read(path.join(DIR, f)), read(path.join(tmp, '2027', f)), `site/2027/${f}가 스크립트 결과와 다르다 — node tools/zodiac2027/build.js 로 다시 만드시오`);
  assert.equal(read(path.join(ROOT, 'site/sitemap.xml')), read(path.join(tmp, 'sitemap.xml')), 'sitemap.xml이 스크립트 결과와 다르다');
});

test('페이지마다 고유한 제목·설명·canonical·og 태그, CSS 꼬리표는 대문과 같은 ?v=', () => {
  const titles = new Set(), descs = new Set(), canon = new Set();
  const indexTag = pick(read(path.join(ROOT, 'site/index.html')), /css\/style\.css(\?v=\d+)/);
  assert.equal(indexTag, `?v=${VERSION}`, 'build.js VERSION과 index.html 꼬리표가 다르다');
  for (const f of FILES) {
    const h = read(path.join(DIR, f));
    const title = pick(h, /<title>([^<]+)<\/title>/), desc = pick(h, /<meta name="description" content="([^"]+)"/), c = pick(h, /<link rel="canonical" href="([^"]+)"/);
    assert.ok(title && desc && c, `${f}: 제목·설명·canonical 중 빠진 것`);
    assert.match(title, /^2027년 .+ 운세 — 정미년 붉은 양의 해 \| 벽사신견$/, `${f}: 제목 모양 ${title}`);
    titles.add(title); descs.add(desc); canon.add(c);
    assert.equal(c, f === 'index.html' ? 'https://byeoksa.com/2027/' : `https://byeoksa.com/2027/${f.replace('.html', '')}`);
    for (const p of ['og:title', 'og:description', 'og:image', 'og:url']) assert.ok(h.includes(`property="${p}"`), `${f}: ${p} 없음`);
    assert.equal(pick(h, /property="og:url" content="([^"]+)"/), c);
    assert.ok(!/noindex/.test(h), `${f}: 검색에서 빠지면 안 된다`);
    assert.equal(pick(h, /css\/style\.css(\?v=\d+)/), indexTag, `${f}: CSS 꼬리표가 대문과 다르다`);
    assert.ok(!/<script/i.test(h), `${f}: 스크립트를 넣지 않는다(숫자 세기·결제 없음)`);
  }
  assert.equal(titles.size, 13); assert.equal(descs.size, 13); assert.equal(canon.size, 13);
  for (const z of ZODIAC) assert.ok(read(path.join(DIR, `${z.slug}.html`)).includes(`<title>2027년 ${z.name}띠`), `${z.slug}: 제목에 ${z.name}띠`);
});

test('글은 표 그대로: 한 줄·좋은 달·조심할 달·끝 문장, 끝 버튼 \'생일로 정확히 보기\' → /?go=input, 목록은 12띠로 이어진다', () => {
  for (const z of ZODIAC) {
    const h = read(path.join(DIR, `${z.slug}.html`));
    assert.ok(h.includes(z.line), `${z.slug}: 한 줄`);
    assert.ok(h.includes(`<p class="zodiac-why">${z.why}</p>`), `${z.slug}: '왜 그런가' 단락`);
    assert.ok(h.includes(`${z.years}년생 등`), `${z.slug}: 태어난 해`);
    const ys = z.years.split('·').map(Number);
    assert.equal(ys.length, 5); assert.ok(ys.every((y, i) => i === 0 || y - ys[i - 1] === 12), `${z.slug}: 열두 해 간격`);
    assert.ok(Math.max(...ys) <= 2007, `${z.slug}: 만 19세 미만 해(2008년생~)는 빼기`);
    assert.ok(h.includes(`<dt>좋은 달</dt><dd>${z.good}</dd>`), `${z.slug}: 좋은 달`);
    assert.ok(h.includes(`<dt>조심할 달</dt><dd>${z.care}`), `${z.slug}: 조심할 달`);
    assert.ok(h.includes(ENDING), `${z.slug}: 끝 문장`);
    assert.ok(/입춘\(2027년 2월 4일 오전 10시 46분\)/.test(h), `${z.slug}: 입춘 안내`);
    assert.match(h, /<a class="btn-main zodiac-btn" href="\/\?go=input">생일로 정확히 보기<\/a>/, `${z.slug}: 끝 버튼`);
    assert.ok(h.includes('href="index.html"'), `${z.slug}: 목록으로 가는 길`);
  }
  const idx = read(path.join(DIR, 'index.html'));
  for (const z of ZODIAC) assert.ok(idx.includes(`href="${z.slug}.html"`), `목록 → ${z.slug}`);
  assert.match(idx, /href="\/\?go=input">생일로 정확히 보기</);
  // 기획 블로그 초안이 이 폴더에 있으면(깃에는 없음) '왜 그런가' 줄·태어난 해가 한 글자도 다르지 않은지
  const blogPath = path.join(ROOT, 'marketing/블로그_2027띠별_12편.md');
  if (fs.existsSync(blogPath)) {
    const b = read(blogPath).split('\n');
    for (const z of ZODIAC) {
      const i = b.indexOf(`■ 2027년, ${z.name}띠에게는`);
      assert.ok(i >= 0, `블로그에 ${z.name}띠 절이 없음`);
      assert.equal(b[i + 2].trim(), z.why, `${z.name}: '왜 그런가' 줄이 블로그와 다르다`);
      assert.ok(b.includes(`■ ${z.name}띠 (${z.years}년생 등)`), `${z.name}: 태어난 해가 블로그와 다르다`);
    }
  }
  // 기획 표가 이 폴더에 있으면(깃에는 없음) 표의 한 줄·달과 한 글자도 다르지 않은지
  const tablePath = path.join(ROOT, 'marketing/2027_띠별_표.md');
  if (fs.existsSync(tablePath)) {
    const t = read(tablePath);
    for (const z of ZODIAC) {
      const row = t.split('\n').find(l => l.startsWith(`| ${z.name} (${z.zhi})`));
      assert.ok(row, `표에 ${z.name} 줄이 없음`);
      const cells = row.split('|').map(s => s.trim());
      assert.equal(cells[3], z.line, `${z.name}: 한 줄이 표와 다르다`);
      assert.ok(cells[4].startsWith(z.good), `${z.name}: 좋은 달이 표와 다르다`);
      assert.ok(cells[5].startsWith(z.care), `${z.name}: 조심할 달이 표와 다르다`);
    }
  }
});

test('하오체 + 그대, 명리 용어는 쉬운 말 뒤 괄호 안에만, 숫자 순위·겁주는 말 없음', () => {
  const TERMS = ['육합', '삼합', '반합', '방합', '원진', '본명년', '충', '형·파'];
  const BANNED = ['대박', '최악', '큰일', '1위', '순위'];
  for (const f of FILES) {
    const t = textOf(read(path.join(DIR, f))).replace(/"[^"]*"|'[^']*'/g, ' ');
    for (const b of BANNED) assert.ok(!t.includes(b), `${f}: '${b}'`);
    const outside = t.replace(/\([^)]*\)/g, ' ');   // 괄호 밖
    for (const w of TERMS.filter(w => w !== '충')) assert.ok(!outside.includes(w), `${f}: 명리 용어 '${w}'가 괄호 밖에 있다`);
    for (const m of t.matchAll(/\(([^)]*)\)/g)) if (TERMS.includes(m[1])) assert.match(t.slice(Math.max(0, m.index - 6), m.index), /[가-힣]\s*$/, `${f}: '(${m[1]})' 앞에 쉬운 말이 없다`);
    const bad = [];
    for (const m of t.matchAll(/([가-힣]+)(?=\s*[.!?…])/g)) {
      const w = m[1];
      if (/(습니다|[합됩입갑]니다)$/.test(w)) continue;   // 바닥글 고지(존댓말)
      if (/(다|거라|어라|아라|마라|구나|느냐|냐|라|지)$/.test(w)) bad.push(w);
      if (/^(해요|자요)$/.test(w)) bad.push(w);
    }
    for (const m of t.matchAll(/(?<![가-힣])(너는|너를|네가|네게|너의|너에게)(?![가-힣])/g)) bad.push(m[1]);
    assert.deepEqual(bad, [], `${f}: 반말 말끝·부르는 말 ${bad.join(', ')}`);
  }
});

test('대문에 작은 글 링크 \'2027 띠별 운세\', robots.txt·sitemap.xml에 새 페이지', () => {
  const html = read(path.join(ROOT, 'site/index.html'));
  assert.match(html, /<a class="home-2027-link" href="2027\/"><span>2027 띠별 운세<\/span><\/a>/);
  const robots = read(path.join(ROOT, 'site/robots.txt'));
  assert.match(robots, /^Sitemap: https:\/\/byeoksa\.com\/sitemap\.xml$/m);
  assert.ok(!/^Disallow: \/$/m.test(robots), '사이트 전체를 막으면 안 된다');
  const sm = read(path.join(ROOT, 'site/sitemap.xml'));
  for (const u of ['https://byeoksa.com/', 'https://byeoksa.com/2027/', ...ZODIAC.map(z => `https://byeoksa.com/2027/${z.slug}`)]) assert.ok(sm.includes(`<loc>${u}</loc>`), u);
  const h = read(path.join(ROOT, 'site/_headers'));
  assert.ok(h.includes('/2027/*\n  Cache-Control: no-cache'), '_headers: 띠별 페이지도 no-cache');
});

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

test('휴대폰 375·320 폭에서 13장 모두 가로 넘침 없음, 버튼이 보이고 오류 없음', async () => {
  for (const width of [375, 320]) {
    for (const f of FILES) {
      const { ctx, page } = await openPage(browser, { width, height: 700, url: 'file://' + path.join(DIR, f), now: null });
      const r = await page.evaluate(() => {
        const btn = document.querySelector('.zodiac-btn'); const b = btn.getBoundingClientRect();
        const over = [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => e.className || e.tagName);
        return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, over: over.slice(0, 5), btnW: b.width, bg: getComputedStyle(btn).backgroundColor };
      });
      assert.ok(r.sw <= r.cw, `${width}px ${f}: 가로 넘침 ${r.sw} > ${r.cw} (${r.over.join(', ')})`);
      assert.deepEqual(r.over, [], `${width}px ${f}: 화면 밖으로 나간 요소`);
      assert.ok(r.btnW > 200, `${width}px ${f}: 버튼 폭 ${r.btnW}`);
      assert.equal(r.bg, 'rgb(165, 42, 31)', `${width}px ${f}: 버튼이 주사 현판 색이 아님(CSS가 안 붙음)`);
      assert.deepEqual(page._errors, [], `${f}: 화면 오류`);
      await ctx.close();
    }
  }
});

// 2027 띠별 운세 페이지 만들기 (업데이트 49, 2026-11-20)
//   글은 모두 marketing/2027_띠별_표.md 한 표에서만 옮겼다(영상·블로그·스레드와 같은 말). 표가 바뀌면 아래 ZODIAC를 고치고
//   `node tools/zodiac2027/build.js` 를 돌리면 site/2027/ 의 HTML 13개를 다시 만든다(손으로 HTML을 고치지 말 것).
//   그 뒤 sitemap.xml 도 이 스크립트가 같이 다시 쓴다. CSS 꼬리표는 VERSION — 사이트를 올릴 때 index.html 의 ?v= 와 같게.
const fs = require('fs');
const path = require('path');

const VERSION = 49;
const ORIGIN = 'https://byeoksa.com';
const OUT = path.resolve(__dirname, '../../site/2027');

// 표 그대로: 띠 이름, 글자, 한 줄, 좋은 달, 조심할 달(덧붙임 있으면 note)
// years·why = marketing/블로그_2027띠별_12편.md 의 각 띠 '■ ○띠 (…년생 등)'과 '■ 2027년, ○띠에게는' 둘째 줄 그대로
//   (2026-11-20 기획 대화 요청 — 검색에 걸릴 글을 조금 더. 태어난 해는 만 19세 미만 해를 뺀 다섯 해)
const ZODIAC = [
  { slug: 'rat',     name: '쥐',     zhi: '子', line: '가까운 사이에서 서운한 말이 오가기 쉬운 해라오. 말 한마디를 아끼시오.', good: '1월쯤', care: '6월쯤',
    years: '1948·1960·1972·1984·1996', why: '양(未)과 쥐(子)는 서로 등을 돌리기 쉬운 사이(원진)라, 멀리 있는 사람보다 곁에 있는 사람과의 말에서 마음이 상하기 쉽소.' },
  { slug: 'ox',      name: '소',     zhi: '丑', line: '양과 정면으로 마주 보는 해라, 큰 결정에서 부딪히기 쉽소. 서두르지 마시오.', good: '12월쯤', care: '7월쯤', careNote: '해와 겹쳐 가장 조심',
    years: '1949·1961·1973·1985·1997', why: '소(丑)와 양(未)은 정면으로 마주 보는 자리(충)라, 이사·이직·큰 계약처럼 판을 바꾸는 일에서 부딪히기 쉽소. 특히 7월쯤은 해의 기운과 겹쳐 한 번 더 살피시오.' },
  { slug: 'tiger',   name: '범',     zhi: '寅', alias: '호랑이띠', line: '손에 잡히는 돈 기회가 보이기 쉬운 해라오. 욕심만 줄이면 되오.', good: '11월쯤', care: '8월쯤',
    years: '1950·1962·1974·1986·1998', why: '범(寅)은 나무, 양(未)은 흙이오. 나무가 흙을 다루는 모양이라 범띠에게 2027년은 눈앞에 돈 될 일이 보이기 쉬운 해라오.' },
  { slug: 'rabbit',  name: '토끼',   zhi: '卯', line: '붉은 양과 손잡는 띠요. 사람을 통해 길이 열리기 쉽소.', good: '10월쯤', care: '9월쯤',
    years: '1951·1963·1975·1987·1999', why: '토끼(卯)·양(未)·돼지(亥)는 한 무리로 손잡는 사이(삼합)라, 2027년 토끼띠는 혼자보다 사람을 통해 일이 풀리기 쉽소.' },
  { slug: 'dragon',  name: '용',     zhi: '辰', line: '비슷한 결의 사람과 엮이기 쉬운 해라오. 경쟁도 협력도 가까이 있소.', good: '9월쯤', care: '10월쯤',
    years: '1952·1964·1976·1988·2000', why: '용(辰)과 양(未)은 둘 다 흙이오. 같은 결끼리 만나니 동료가 되기도, 경쟁자가 되기도 쉬운 해라오.' },
  { slug: 'snake',   name: '뱀',     zhi: '巳', line: '양의 불기운을 등에 업기 쉬운 해라오. 드러내면 눈에 띄오.', good: '8월쯤', care: '11월쯤',
    years: '1953·1965·1977·1989·2001', why: '뱀(巳)·말(午)·양(未)은 여름 불기운으로 한 줄에 서는 사이(방합)라, 2027년 뱀띠는 숨기기보다 드러낼 때 눈에 띄기 쉽소.' },
  { slug: 'horse',   name: '말',     zhi: '午', line: '붉은 양과 가장 단단히 손잡는 띠요. 함께하는 일이 풀리기 쉽소.', good: '7월쯤', care: '12월쯤',
    years: '1954·1966·1978·1990·2002', why: '말(午)과 양(未)은 짝을 이루는 사이(육합)라, 2027년 말띠는 함께하는 일·짝과 하는 일이 풀리기 쉽소.' },
  { slug: 'goat',    name: '양',     zhi: '未', line: '그대의 해가 돌아왔소. 눈에 띄는 만큼 흔들리기도 쉬우니 중심을 잡으시오.', good: '6월쯤', care: '1월쯤',
    years: '1955·1967·1979·1991·2003', why: '2027년은 양띠의 해(본명년)라오. 사람들 눈에 자주 띄는 만큼, 마음이 이리저리 흔들리기도 쉬운 해라오.' },
  { slug: 'monkey',  name: '원숭이', zhi: '申', line: '뒤에서 밀어 주는 기운을 받기 쉬운 해라오. 도움을 사양하지 마시오.', good: '5월쯤', care: '2월쯤',
    years: '1956·1968·1980·1992·2004', why: '양(未)은 흙, 원숭이(申)는 쇠요. 흙이 쇠를 낳는 모양이라 2027년 원숭이띠는 뒤에서 밀어 주는 힘을 받기 쉽소.' },
  { slug: 'rooster', name: '닭',     zhi: '酉', line: '갈고닦은 솜씨가 인정받기 쉬운 해라오.', good: '4월쯤', care: '3월쯤',
    years: '1957·1969·1981·1993·2005', why: '양(未)은 흙, 닭(酉)은 쇠요. 흙이 쇠를 길러 주는 모양이라, 그동안 갈고닦은 솜씨가 빛을 보기 쉬운 해라오.' },
  { slug: 'dog',     name: '개',     zhi: '戌', line: '말이 엇갈리기 쉬운 해라오. 확인하고 또 확인하시오.', good: '3월쯤', care: '4월쯤',
    years: '1958·1970·1982·1994·2006', why: '개(戌)와 양(未)은 서로 걸리기 쉬운 사이(형·파)라, 같은 말을 하고도 다르게 알아듣기 쉬운 해라오.' },
  { slug: 'pig',     name: '돼지',   zhi: '亥', line: '붉은 양과 손잡는 띠요. 묵혀 둔 일을 꺼내기 좋은 해라오.', good: '2월쯤', care: '5월쯤',
    years: '1959·1971·1983·1995·2007', why: '돼지(亥)·토끼(卯)·양(未)은 한 무리로 손잡는 사이(삼합)라, 2027년 돼지띠는 미뤄 둔 일을 다시 꺼내기 좋은 해라오.' },
];

// 표 아래의 공통 문장
const ENDING = '다만 같은 띠라도 태어난 날이 다르면 좋은 달이 달라지기 쉽소. 그대 생일로 보면 30초요.';
const IPCHUN = '띠는 1월 1일이 아니라 입춘(2027년 2월 4일 오전 10시 46분)에 바뀌오. 1월이나 2월 초에 태어났다면 전해 띠일 수 있소.';
const MONTH_NOTE = '달도 절기(계절이 바뀌는 날)로 나누기에 날짜를 딱 자르지 않고 \'○월쯤\'으로 적었소.';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const tti = z => `${z.name}띠`;
const ttiFull = z => z.alias ? `${tti(z)}(${z.alias})` : tti(z);

function head({ title, desc, url }) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- 업데이트 49: tools/zodiac2027/build.js 가 만든 파일 — 글은 marketing/2027_띠별_표.md 에서만. 손으로 고치지 말고 스크립트를 고쳐 다시 만든다 -->
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${url}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:image" content="${ORIGIN}/img/og-image.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${url}">
  <meta property="og:site_name" content="벽사신견 사주">
  <meta property="og:type" content="article">
  <meta property="og:locale" content="ko_KR">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#1A1C2E">
  <link rel="icon" href="../icon-192.png" type="image/png">
  <link rel="apple-touch-icon" href="../icon-192.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Song+Myung&family=Noto+Serif+KR:wght@400;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../css/style.css?v=${VERSION}">
</head>
<body>
<div class="app-container zodiac-page">
`;
}

const footer = `
  <footer class="site-footer">
    <nav class="footer-links" aria-label="약관">
      <a href="../legal.html#terms">이용약관</a>
      <a href="../legal.html#privacy">개인정보처리방침</a>
      <a href="../legal.html#business">사업자 정보</a>
    </nav>
    <p class="footer-note">벽사신견의 풀이는 전통 명리 해석을 바탕으로 한 오락 콘텐츠입니다.</p>
  </footer>
</div>
</body>
</html>
`;

const cta = `
  <section class="zodiac-cta">
    <p class="zodiac-ending">${ENDING}</p>
    <a class="btn-main zodiac-btn" href="/?go=input">생일로 정확히 보기</a>
  </section>
`;

const ttiGrid = current => `
  <nav class="zodiac-grid" aria-label="2027 띠별 운세">
${ZODIAC.map(z => z.slug === current
    ? `    <span class="zodiac-chip is-current" aria-current="page"><span class="zodiac-chip-zhi" aria-hidden="true">${z.zhi}</span>${tti(z)}</span>`
    : `    <a class="zodiac-chip" href="${z.slug}.html"><span class="zodiac-chip-zhi" aria-hidden="true">${z.zhi}</span>${tti(z)}</a>`).join('\n')}
  </nav>
`;

function ttiPage(z) {
  const title = `2027년 ${ttiFull(z)} 운세 — 정미년 붉은 양의 해 | 벽사신견`;
  const desc = `2027년 정미년(붉은 양의 해) ${ttiFull(z)} 운세(${z.years}년생 등). ${z.line} 좋은 달 ${z.good}, 조심할 달 ${z.care}.`;
  const care = z.careNote ? `${z.care} <span class="zodiac-month-note">— ${z.careNote}</span>` : z.care;
  return head({ title, desc, url: `${ORIGIN}/2027/${z.slug}` }) + `
  <nav class="feature-nav zodiac-nav"><a class="btn-nav-back" href="index.html">← 2027 띠별 운세</a><a class="zodiac-home" href="../index.html">벽사신견 대문</a></nav>

  <header class="zodiac-head">
    <span class="zodiac-seal" aria-hidden="true">${z.zhi}</span>
    <h1 class="feature-title">2027년 ${ttiFull(z)} 운세</h1>
    <p class="zodiac-sub">정미년(丁未年) · 붉은 양의 해</p>
  </header>

  <section class="feature-card zodiac-card">
    <h2 class="feature-card-title">벽사견이 본 ${tti(z)}의 2027년</h2>
    <p class="zodiac-line">${z.line}</p>
    <p class="zodiac-why">${z.why}</p>
    <p class="zodiac-years"><span class="zodiac-years-label">${tti(z)} 해에 태어난 사람</span> ${z.years}년생 등</p>
    <dl class="zodiac-months">
      <div class="zodiac-month"><dt>좋은 달</dt><dd>${z.good}</dd></div>
      <div class="zodiac-month is-care"><dt>조심할 달</dt><dd>${care}</dd></div>
    </dl>
    <p class="feature-note">${MONTH_NOTE}</p>
    <p class="feature-note">${IPCHUN}</p>
  </section>
` + cta + `
  <h2 class="zodiac-grid-title">다른 띠의 2027년</h2>` + ttiGrid(z.slug) + footer;
}

function indexPage() {
  const title = '2027년 띠별 운세 — 정미년 붉은 양의 해 | 벽사신견';
  const desc = '2027년 정미년(붉은 양의 해) 띠별 운세. 쥐띠부터 돼지띠까지 열두 띠의 한 줄과 좋은 달·조심할 달을 벽사견이 짚어 드리오.';
  return head({ title, desc, url: `${ORIGIN}/2027/` }) + `
  <nav class="feature-nav zodiac-nav"><a class="btn-nav-back" href="../index.html">← 벽사신견 대문</a></nav>

  <header class="zodiac-head">
    <span class="zodiac-seal" aria-hidden="true">未</span>
    <h1 class="feature-title">2027년 띠별 운세</h1>
    <p class="zodiac-sub">정미년(丁未年) · 붉은 양의 해</p>
    <p class="zodiac-intro">그대의 띠를 고르시오. 열두 띠마다 한 줄과 좋은 달·조심할 달을 적어 두었소.</p>
  </header>

  <ul class="zodiac-list">
${ZODIAC.map(z => `    <li><a class="zodiac-item" href="${z.slug}.html"><span class="zodiac-item-zhi" aria-hidden="true">${z.zhi}</span><span class="zodiac-item-text"><span class="zodiac-item-name">${ttiFull(z)}</span><span class="zodiac-item-line">${z.line}</span></span></a></li>`).join('\n')}
  </ul>

  <p class="zodiac-ipchun">${IPCHUN}</p>
` + cta + footer;
}

function sitemap() {
  const urls = [`${ORIGIN}/`, `${ORIGIN}/2027/`, ...ZODIAC.map(z => `${ORIGIN}/2027/${z.slug}`)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}
</urlset>
`;
}

if (require.main === module) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'index.html'), indexPage());
  for (const z of ZODIAC) fs.writeFileSync(path.join(OUT, `${z.slug}.html`), ttiPage(z));
  fs.writeFileSync(path.resolve(OUT, '../sitemap.xml'), sitemap());
  console.log(`site/2027/ 에 ${ZODIAC.length + 1}개, site/sitemap.xml 을 만들었소.`);
}

module.exports = { ZODIAC, ENDING, IPCHUN, VERSION };

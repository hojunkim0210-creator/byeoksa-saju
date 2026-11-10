// 캐시 무효화 꼬리표(?v=업데이트 번호)와 배포 경로 검사
// 업데이트 46 (2026-11-10 보안 점검 2번): 예전에는 .github/workflows/deploy.yml 이 Push마다 GitHub Pages(○○.github.io/byeoksa-saju)에도
//   사이트 복사본을 올렸다. 그 복사본에는 결제 확인 서버·보안 헤더가 없어(거기서 결제하면 돈만 나가고 리포트가 안 열린다) 배포 작업을 없앴다.
//   실제 사이트는 Cloudflare Pages가 git에서 바로 배포한다. 테스트는 ci.yml 이 main Push·PR 때 그대로 돈다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '../..');

test('GitHub Pages로 사이트 복사본을 올리는 작업이 없다 (배포는 Cloudflare Pages 한 곳)', () => {
  const dir = path.join(ROOT, '.github/workflows');
  const files = fs.readdirSync(dir).filter(f => /\.ya?ml$/.test(f));
  assert.ok(files.includes('ci.yml'), '테스트 워크플로(ci.yml)는 남아 있어야 한다');
  for (const f of files) {
    const y = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.ok(!/deploy-pages|upload-pages-artifact|configure-pages|pages:\s*write/.test(y), `${f}: GitHub Pages 배포 단계가 있다`);
  }
});

// 2026-10-27: 실제 사이트(Cloudflare Pages)는 git에서 바로 배포된다(파일 주소를 바꿔 주는 단계가 없다).
//   그래서 원본 HTML에 ?v=업데이트번호 꼬리표를 직접 붙여 둔다 — 안 붙이면 전에 왔던 손님의 브라우저가 옛 CSS·JS를
//   새 HTML에 입혀 첫 화면이 깨진다(2026-10-27 맥북 크롬에서 실제로 남). 올릴 때마다 숫자를 그 업데이트 번호로 바꾼다.
const tagsIn = html => [...html.matchAll(/(?:href|src)="(?:(?:css|js)\/[^"?]+|manifest\.json)(\?v=[^"]*)?"/g)].map(m => m[1] || '');
test('index.html·legal.html의 CSS·JS·manifest 주소에 같은 ?v=숫자 꼬리표가 붙어 있다 (실제 사이트 캐시 무효화)', () => {
  const tags = {};
  for (const f of ['site/index.html', 'site/legal.html']) {
    const t = tagsIn(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    assert.ok(t.length > 0, `${f}: CSS·JS 참조를 찾지 못함`);
    assert.ok(t.every(x => /^\?v=\d+$/.test(x)), `${f}: ?v=숫자 꼬리표가 빠지거나 모양이 다른 참조 ${JSON.stringify(t)}`);
    assert.equal(new Set(t).size, 1, `${f}: 꼬리표가 서로 다름 ${JSON.stringify(t)}`);
    tags[f] = t[0];
  }
  assert.equal(tags['site/index.html'], tags['site/legal.html'], 'index.html과 legal.html의 꼬리표가 다르다');
});

test('_headers: CSS·JS는 HTML처럼 no-cache (Cloudflare 브라우저 캐시 TTL이 max-age=0을 4시간으로 덮어쓰므로)', () => {
  const h = fs.readFileSync(path.join(ROOT, 'site/_headers'), 'utf8');
  for (const p of ['/\n', '/*.html\n', '/css/*\n', '/js/*\n']) assert.ok(h.includes(p + '  Cache-Control: no-cache'), `_headers ${p.trim()} 가 no-cache가 아님`);
});

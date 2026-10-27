// 배포 때 붙이는 캐시 무효화 표시(?v=커밋)가 사이트가 쓰는 CSS·JS를 빠짐없이 덮는지
// (새 JS 파일을 추가하고 deploy.yml 목록에 안 넣으면, 방문자 브라우저가 옛 파일을 계속 쓰는 사고를 막는다)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const deploy = fs.readFileSync(path.join(ROOT, '.github/workflows/deploy.yml'), 'utf8');

test('index.html의 로컬 CSS·JS·manifest가 모두 버전 표시 대상이다', () => {
  const line = deploy.split('\n').find(l => l.includes('sed -i -E') && l.includes('site/index.html'));
  assert.ok(line, 'deploy.yml에서 index.html용 sed 줄을 찾지 못함');
  const listed = (line.match(/\(css[^)]*\)/) || [''])[0].slice(1, -1).split('|').map(s => s.replace(/\\\./g, '.'));
  const html = fs.readFileSync(path.join(ROOT, 'site/index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:href|src)="((?:css|js)\/[^"?]+|manifest\.json)(?:\?v=[^"]*)?"/g)].map(m => m[1]);
  const missing = refs.filter(r => !listed.includes(r));
  assert.deepEqual(missing, [], `deploy.yml 버전 표시 목록에 빠진 파일: ${missing.join(', ')}`);
  const expected = Number((deploy.match(/test "\$COUNT" -eq (\d+)/) || [])[1]);
  assert.equal(refs.length, expected, `index.html 참조 ${refs.length}곳 ≠ deploy.yml 기대값 ${expected}`);
});

test('legal.html의 스타일시트도 버전 표시 대상이다', () => {
  assert.match(deploy, /site\/legal\.html/);
});

// 2026-10-27: 실제 사이트(Cloudflare Pages)는 위 워크플로를 거치지 않고 git에서 바로 배포된다.
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

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
  const refs = [...html.matchAll(/(?:href|src)="((?:css|js)\/[^"?]+|manifest\.json)"/g)].map(m => m[1]);
  const missing = refs.filter(r => !listed.includes(r));
  assert.deepEqual(missing, [], `deploy.yml 버전 표시 목록에 빠진 파일: ${missing.join(', ')}`);
  const expected = Number((deploy.match(/test "\$COUNT" -eq (\d+)/) || [])[1]);
  assert.equal(refs.length, expected, `index.html 참조 ${refs.length}곳 ≠ deploy.yml 기대값 ${expected}`);
});

test('legal.html의 스타일시트도 버전 표시 대상이다', () => {
  assert.match(deploy, /site\/legal\.html/);
});

// 리포트 장마다 사진 (2026-11-03, 벤치마킹 ⑦): 파일 6장이 있고 가볍고(400KB 아래), app.js가 모두 가리킨다
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path');

test('리포트 장 사진 6장이 있고 각각 400KB 아래이며 app.js가 가리킨다', () => {
  const app = fs.readFileSync(path.resolve(__dirname, '../../site/js/app.js'), 'utf8');
  for (let i = 1; i <= 6; i++) {
    const f = path.resolve(__dirname, `../../site/img/report/ch${i}.jpg`);
    assert.ok(fs.existsSync(f), f);
    assert.ok(fs.statSync(f).size < 400 * 1024, 'too big: ' + f);
    assert.ok(app.includes(`img/report/ch${i}.jpg`), 'app.js ch' + i);
  }
});

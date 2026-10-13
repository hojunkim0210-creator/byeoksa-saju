// 등 뒤 귀신 그림 5종 파일이 모두 있고 너무 크지 않다
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
test('귀신 그림 5종(목·화·토·금·수)이 있고 각 150KB 이하', () => {
  for (const k of ['wood', 'fire', 'earth', 'metal', 'water']) {
    const f = path.resolve(__dirname, `../../site/img/ghosts/${k}.jpg`);
    assert.ok(fs.existsSync(f), `${k}.jpg 없음`);
    assert.ok(fs.statSync(f).size < 150 * 1024, `${k}.jpg 너무 큼`);
  }
});

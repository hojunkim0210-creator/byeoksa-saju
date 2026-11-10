// 무료 코드 이벤트 서버(functions/api/code.js) 검사 (업데이트 45, 2026-11-10 — 카카오페이와 함께 켤 때까지 꺼 둠)
//   코드 원문은 저장소에 없으므로(marketing/이벤트_코드_명단.md, 깃 제외) 확인·사용 기록은 시험용 지문으로 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const load = f => import(pathToFileURL(path.resolve(__dirname, '../../functions', f)).href);
const kv = () => { const m = new Map(); return { m, get: async k => (m.has(k) ? m.get(k) : null), put: async (k, v) => { m.set(k, v); } }; };
const post = (body, headers = {}) => new Request('https://byeoksa.com/api/code', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });

test('꺼져 있으면(기본값) 어떤 코드도 받지 않는다 — 켜는 날까지 서버도 503 OFF', async () => {
  const C = await load('api/code.js');
  assert.equal(C.EVENT_ON, false);
  const r = await C.onRequestPost({ request: post(JSON.stringify({ code: 'ABCD-EFGH-JKLM' })), env: { COUNTS: kv() } });
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { status: 'OFF' });
});

test('지문 목록: 18개(선착순 15 + 예비 3), 모두 64자리 16진수, 소금은 32자리', async () => {
  const C = await load('api/code.js');
  assert.equal(C.CODE_HASHES.size, 18);
  for (const h of C.CODE_HASHES) assert.match(h, /^[0-9a-f]{64}$/);
  assert.match(C.SALT, /^[0-9a-f]{32}$/);
});

test('맞는 코드는 한 번만 — 두 번째는 USED, 틀린 코드·짧은 코드는 WRONG, 대소문자·하이픈·띄어쓰기는 상관없다', async () => {
  const C = await load('api/code.js');
  const salt = 'test-salt';
  const h = await C.codeHash(C.normalizeCode('TEST-CODE-2345'), salt);
  const store = kv();
  const opt = { kv: store, hashes: new Set([h]), on: true, salt };
  assert.deepEqual(await C.redeem('test code 2345', opt), [200, { status: 'OK' }]);
  assert.deepEqual(await C.redeem('TEST-CODE-2345', opt), [409, { status: 'USED' }]);
  assert.deepEqual(await C.redeem('TEST-CODE-2346', opt), [404, { status: 'WRONG' }]);
  assert.deepEqual(await C.redeem('TEST-2345', opt), [404, { status: 'WRONG' }]);
  assert.equal(store.m.size, 1);
  assert.ok([...store.m.keys()].every(k => k === `code:${h}`), "사용 기록은 'code:지문' 이름 하나뿐 (손님 정보 없음)");
  assert.deepEqual(await C.redeem('TEST-CODE-2345', { ...opt, kv: null }), [503, { status: 'OFF' }], '장부가 없으면 한 번만 쓰게 할 수 없으니 받지 않는다');
  const broken = { get: async () => { throw new Error('kv'); }, put: async () => {} };
  assert.deepEqual(await C.redeem('TEST-CODE-2345', { ...opt, kv: broken }), [503, { status: 'OFF' }], "장부 오류는 '틀린 코드'라고 하지 않는다");
});

test('다른 사이트에서 온 요청은 403, 잘못된 몸통은 400', async () => {
  const C = await load('api/code.js');
  const a = await C.onRequestPost({ request: post(JSON.stringify({ code: 'ABCD-EFGH-JKLM' }), { Origin: 'https://evil.example' }), env: { COUNTS: kv() } });
  assert.equal(a.status, 403);
  const b = await C.onRequestPost({ request: post('not json'), env: { COUNTS: kv() } });
  assert.equal(b.status, 400);
  const c = await C.onRequestPost({ request: post(JSON.stringify({ code: 12345 })), env: { COUNTS: kv() } });
  assert.equal(c.status, 400);
});

test("숫자 세기: '무료 코드로 엶'(codeopen) 단계를 받고, 대표님 숫자 페이지에 칸이 있다", async () => {
  const { EVENTS } = await load('api/count.js');
  assert.ok(EVENTS.includes('codeopen'));
  const N = await load('numbers.js');
  assert.equal(N.LABELS.codeopen, '무료 코드로 엶');
  assert.match(N.renderPage([{ day: '2026-11-10', visit: 5, codeopen: 2 }]), /무료 코드로 엶/);
});

test('약관·개인정보의 무료 코드 이벤트 안내는 켜기 전까지 주석으로만 있다(손님 화면 변화 0)', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../../site/legal.html'), 'utf8');
  const visible = src.replace(/<!--[\s\S]*?-->/g, '');
  assert.ok(!/무료 코드/.test(visible), '주석 밖에 무료 코드 안내가 있다');
  assert.ok(/만 19세 이상만 참여할 수 있으며/.test(src) && /무료 코드 사용 기록/.test(src), '켤 때 풀 안내가 주석으로 준비돼 있어야 한다');
});

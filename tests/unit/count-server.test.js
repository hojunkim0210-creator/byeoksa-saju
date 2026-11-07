// 이용 횟수 집계 서버(functions/api/count.js)와 대표님용 숫자 페이지(functions/numbers.js) 검사 (업데이트 38, 2026-11-07)
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');
const load = f => import(pathToFileURL(path.resolve(__dirname, '../../functions', f)).href);
const kv = () => { const m = new Map(); return { m, get: async k => (m.has(k) ? m.get(k) : null), put: async (k, v) => { m.set(k, v); } }; };
const post = (body, headers = {}) => new Request('https://byeoksa.com/api/count', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

test('날짜는 한국 시간 기준이다 (UTC 15시가 넘으면 다음 날)', async () => {
  const { dayKey } = await load('api/count.js');
  assert.equal(dayKey(new Date('2026-11-07T14:59:00Z')), '2026-11-07');
  assert.equal(dayKey(new Date('2026-11-07T15:00:00Z')), '2026-11-08');
});

test('POST /api/count: 알려진 단계 이름이면 그날 합계에 1을 더한다', async () => {
  const { onRequestPost, kvKey, dayKey } = await load('api/count.js');
  const COUNTS = kv();
  for (let i = 0; i < 3; i++) assert.equal((await onRequestPost({ request: post({ e: 'visit' }), env: { COUNTS } })).status, 204);
  assert.equal(COUNTS.m.get(kvKey(dayKey(), 'visit')), '3');
  assert.equal([...COUNTS.m.keys()].length, 1);
});

test('저장되는 것은 숫자 하나뿐이다 — 본문에 다른 값을 실어 보내도 저장하지 않는다', async () => {
  const { onRequestPost } = await load('api/count.js');
  const COUNTS = kv();
  await onRequestPost({ request: post({ e: 'free', birth: '1990-03-10', name: '민지' }, { 'CF-Connecting-IP': '1.2.3.4' }), env: { COUNTS } });
  assert.deepEqual([...COUNTS.m.values()], ['1']);
  assert.ok([...COUNTS.m.keys()].every(k => /^n:\d{4}-\d{2}-\d{2}:free$/.test(k)));
});

test('모르는 단계 이름·깨진 본문은 거절, 다른 사이트에서 온 요청은 403', async () => {
  const { onRequestPost } = await load('api/count.js');
  const COUNTS = kv();
  assert.equal((await onRequestPost({ request: post({ e: 'hack' }), env: { COUNTS } })).status, 400);
  assert.equal((await onRequestPost({ request: post('not json'), env: { COUNTS } })).status, 400);
  assert.equal((await onRequestPost({ request: post({ e: 'visit' }, { Origin: 'https://evil.example' }), env: { COUNTS } })).status, 403);
  assert.equal(COUNTS.m.size, 0);
});

test('장부(KV)가 아직 연결되지 않았으면 조용히 끝난다', async () => {
  const { onRequestPost } = await load('api/count.js');
  assert.equal((await onRequestPost({ request: post({ e: 'visit' }), env: {} })).status, 204);
});

test('장부가 고장 나도 손님 쪽에는 오류를 주지 않는다', async () => {
  const { onRequestPost } = await load('api/count.js');
  const COUNTS = { get: async () => { throw new Error('kv down'); }, put: async () => { throw new Error('kv down'); } };
  assert.equal((await onRequestPost({ request: post({ e: 'visit' }), env: { COUNTS } })).status, 204);
});

test('/numbers: 열쇠가 없거나 틀리면 404, 열쇠가 설정되지 않았어도 404', async () => {
  const { onRequestGet } = await load('numbers.js');
  const env = { NUMBERS_KEY: 'a-long-secret-key' };
  for (const url of ['https://byeoksa.com/numbers', 'https://byeoksa.com/numbers?k=wrong', 'https://byeoksa.com/numbers?k=a-long-secret-keyX']) {
    assert.equal((await onRequestGet({ request: new Request(url), env })).status, 404);
  }
  assert.equal((await onRequestGet({ request: new Request('https://byeoksa.com/numbers?k='), env: {} })).status, 404);
});

test('/numbers: 열쇠가 맞으면 표를 보여 주고, 검색·저장되지 않게 하며, 결제 완료는 포트원 응답에서 센다', async () => {
  const { onRequestGet } = await load('numbers.js');
  const { kvKey, dayKey } = await load('api/count.js');
  const COUNTS = kv();
  COUNTS.m.set(kvKey(dayKey(), 'visit'), '40'); COUNTS.m.set(kvKey(dayKey(), 'free'), '20'); COUNTS.m.set(kvKey(dayKey(), 'payopen'), '5');
  const real = global.fetch;
  let calls = 0;
  global.fetch = async (u, o) => { calls++; assert.match(String(u), /^https:\/\/api\.portone\.io\/payments\?requestBody=/); assert.equal(o.headers.Authorization, 'PortOne s3cret'); return new Response(JSON.stringify({ page: { totalCount: 1 } }), { status: 200 }); };
  try {
    const res = await onRequestGet({ request: new Request('https://byeoksa.com/numbers?k=a-long-secret-key'), env: { NUMBERS_KEY: 'a-long-secret-key', COUNTS, PORTONE_API_SECRET: 's3cret' } });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('Cache-Control'), /no-store/);
    assert.match(res.headers.get('X-Robots-Tag'), /noindex/);
    const t = await res.text();
    assert.match(t, /noindex/); assert.match(t, /첫 화면 방문/); assert.match(t, /50%/);   // 무료 풀이 20 / 방문 40
    assert.equal(calls, 14);
    assert.ok(!t.includes('s3cret') && !t.includes('a-long-secret-key'), '비밀 값이 페이지에 나오면 안 된다');
  } finally { global.fetch = real; }
});

test('renderPage: 장부가 없으면 안내를 보이고, 0으로 나누는 비율은 - 로 나온다', async () => {
  const { renderPage, pct, lastDays } = await load('numbers.js');
  assert.equal(pct(1, 0), '-'); assert.equal(pct(1, 4), '25%');
  assert.equal(lastDays(3, new Date('2026-11-07T03:00:00Z')).join(), '2026-11-07,2026-11-06,2026-11-05');
  const t = renderPage([{ day: '2026-11-07', visit: NaN, free: NaN, payopen: NaN, paid: 2, compat: NaN, compatsend: NaN, invited: NaN }], { configured: false });
  assert.match(t, /장부\(KV\)가 연결되지 않아/);
});

test('집계 이벤트 이름은 화면 쪽(app.js·extras.js·shop.js)이 보내는 것과 같다', async () => {
  const { EVENTS } = await load('api/count.js');
  const fs = require('fs');
  const src = ['app.js', 'extras.js', 'shop.js'].map(f => fs.readFileSync(path.resolve(__dirname, '../../site/js', f), 'utf8')).join('\n');
  const sent = [...src.matchAll(/track\('([a-z]+)'\)/g)].map(m => m[1]);
  assert.ok(sent.length >= 5);
  for (const e of new Set(sent)) assert.ok(EVENTS.includes(e), `${e} 가 서버 목록(EVENTS)에 없다`);
});

test('브라우저 sendBeacon 이 보내는 모양(text/plain 글자)도 그대로 받는다', async () => {
  const { onRequestPost, kvKey, dayKey } = await load('api/count.js');
  const COUNTS = kv();
  const request = new Request('https://byeoksa.com/api/count', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8', Origin: 'https://byeoksa.com' }, body: '{"e":"compatsend"}' });
  assert.equal((await onRequestPost({ request, env: { COUNTS } })).status, 204);
  assert.equal(COUNTS.m.get(kvKey(dayKey(), 'compatsend')), '1');
});

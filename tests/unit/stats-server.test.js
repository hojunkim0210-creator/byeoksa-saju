// 실측 결제 수 서버(functions/api/stats.js) 검사 — 포트원 응답은 가짜로 흉내 낸다 (2026-11-01 후기 1단계)
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');
const load = () => import(pathToFileURL(path.resolve(__dirname, '../../functions/api/stats.js')).href);
const withFetch = async (impl, fn) => { const real = global.fetch; global.fetch = impl; try { return await fn(); } finally { global.fetch = real; } };
const req = { url: 'https://byeoksa.com/api/stats' };
const ok = n => async () => new Response(JSON.stringify({ items: [{}], page: { number: 0, size: 1, totalCount: n } }), { status: 200 });

test('조건: 이 상점·결제 완료·실결제만, 판매 시작일부터, 건수만 필요하니 한 건만 달라고 한다', async () => {
  const { buildQuery, STORE_ID, SINCE } = await load();
  const q = buildQuery({ until: '2026-11-01T00:00:00Z' });
  assert.deepEqual(q.filter, { storeId: STORE_ID, status: ['PAID'], isTest: false, from: SINCE, until: '2026-11-01T00:00:00Z' });
  assert.deepEqual(q.page, { number: 0, size: 1 });
  assert.match(STORE_ID, /^store-[0-9a-f-]{36}$/);
});

test('readCount: 포트원 응답의 page.totalCount 만 믿는다', async () => {
  const { readCount } = await load();
  assert.equal(readCount({ items: [], page: { number: 0, size: 1, totalCount: 123 } }), 123);
  assert.equal(readCount({ page: { totalCount: -1 } }), null);
  assert.equal(readCount({ page: { totalCount: '12' } }), null);
  assert.equal(readCount({}), null);
  assert.equal(readCount(null), null);
});

test('GET /api/stats: 포트원에 requestBody 쿼리로 묻고, 비밀 키는 Authorization 헤더로만, 숫자만 돌려주며 10분 캐시 헤더', async () => {
  const { onRequestGet } = await load();
  let seen = null;
  const res = await withFetch(async (url, opts) => { seen = { url, opts }; return ok(57)(); }, () => onRequestGet({ request: req, env: { PORTONE_API_SECRET: 'sk-secret' } }));
  assert.equal(res.status, 200);
  const txt = await res.text();
  assert.deepEqual(JSON.parse(txt), { status: 'OK', paid: 57 });
  assert.ok(!txt.includes('sk-secret'), '비밀 키가 응답에 섞이지 않는다');
  assert.match(res.headers.get('Cache-Control'), /max-age=600/);
  const u = new URL(seen.url);
  assert.equal(u.origin + u.pathname, 'https://api.portone.io/payments');
  const body = JSON.parse(u.searchParams.get('requestBody'));
  assert.deepEqual(body.filter.status, ['PAID']); assert.equal(body.filter.isTest, false); assert.ok(body.filter.from && body.filter.until);
  assert.equal(seen.opts.headers.Authorization, 'PortOne sk-secret');
});

test('비밀 키가 없으면 500, 포트원 오류·이상한 응답이면 502 (화면은 조용히 숨긴다)', async () => {
  const { onRequestGet } = await load();
  assert.equal((await onRequestGet({ request: req, env: {} })).status, 500);
  const env = { PORTONE_API_SECRET: 'sk' };
  assert.equal((await withFetch(async () => new Response('x', { status: 500 }), () => onRequestGet({ request: req, env }))).status, 502);
  assert.equal((await withFetch(async () => new Response('{}', { status: 200 }), () => onRequestGet({ request: req, env }))).status, 502);
  assert.equal((await withFetch(async () => new Response('not json', { status: 200 }), () => onRequestGet({ request: req, env }))).status, 502);
});

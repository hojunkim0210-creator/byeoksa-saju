// 결제 확인 서버(functions/api/payment/complete.js) 검사 — 포트원 응답은 가짜로 흉내 낸다
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');
const load = () => import(pathToFileURL(path.resolve(__dirname, '../../functions/api/payment/complete.js')).href);

const PAID = { status: 'PAID', amount: { total: 4900 }, currency: 'KRW', orderName: '벽사신견 천명 리포트', channel: { type: 'LIVE' } };

test('checkPayment: 완료·금액(정가/공유 할인가)·통화·상품명·실채널을 모두 본다', async () => {
  const { checkPayment } = await load();
  assert.equal(checkPayment(PAID).ok, true);
  assert.equal(checkPayment({ ...PAID, amount: { total: 3900 } }).ok, true, '공유 할인가');
  assert.equal(checkPayment({ ...PAID, amount: { total: 2900 } }).ok, false, '할인 두 번은 안 됨');
  assert.equal(checkPayment({ ...PAID, status: 'READY' }).ok, false);
  assert.equal(checkPayment({ ...PAID, amount: { total: 100 } }).ok, false, '금액 바꿔치기');
  assert.equal(checkPayment({ ...PAID, currency: 'USD' }).ok, false);
  assert.equal(checkPayment({ ...PAID, orderName: '다른 상품' }).ok, false);
  assert.equal(checkPayment({ ...PAID, orderName: '벽사신견 궁합 상세 리포트', amount: { total: 3900 } }).ok, true);
  assert.equal(checkPayment({ ...PAID, orderName: '벽사신견 궁합 상세 리포트', amount: { total: 4900 } }).ok, false, '상품과 금액 불일치');
  assert.equal(checkPayment({ ...PAID, orderName: '벽사신견 소원 부적', amount: { total: 1900 } }).ok, false, '부적 상품은 2026-10-19 판매 중단 (카드사 심사)');
  assert.equal(checkPayment({ ...PAID, channel: { type: 'TEST' } }, { requireLive: true }).ok, false);
  assert.equal(checkPayment({ ...PAID, channel: { type: 'TEST' } }).ok, true);
});

test('서버 상품 목록이 사이트(app.js PRODUCTS)와 이름·가격이 같다', async () => {
  const { CATALOG, SHARE_DISCOUNT } = await load();
  const fs = require('fs');
  const app = fs.readFileSync(path.resolve(__dirname, '../../site/js/app.js'), 'utf8');
  const sale = Number(app.match(/price:\s*(\d+),\s*\/\/ 원/)[1]);
  const rows = [...app.matchAll(/name: '([^']+)',\s*price: (SALE\.price|\d+)/g)].map(m => [m[1], m[2] === 'SALE.price' ? sale : Number(m[2])]);
  assert.ok(rows.length >= 4);
  assert.deepEqual(Object.fromEntries(rows), CATALOG);
  assert.equal(Number(app.match(/SHARE_DISCOUNT = \{ amount: (\d+)/)[1]), SHARE_DISCOUNT);
});

async function call(body, env, portone) {
  const { onRequestPost } = await load();
  const seen = [];
  const realFetch = global.fetch;
  global.fetch = async (url, opt) => { seen.push({ url, opt }); return portone(url); };
  try {
    const res = await onRequestPost({ request: new Request('https://x.test/api/payment/complete', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }), env });
    return { status: res.status, json: await res.json(), seen };
  } finally { global.fetch = realFetch; }
}
const ok = obj => new Response(JSON.stringify(obj), { status: 200 });

test('onRequestPost: 포트원에 비밀키로 조회하고 PAID면 PAID를 돌려준다', async () => {
  const r = await call({ paymentId: 'byeoksa-abc123-x9y8z7' }, { PORTONE_API_SECRET: 'sk_test' }, () => ok(PAID));
  assert.equal(r.status, 200); assert.equal(r.json.status, 'PAID');
  assert.equal(r.seen[0].url, 'https://api.portone.io/payments/byeoksa-abc123-x9y8z7');
  assert.equal(r.seen[0].opt.headers.Authorization, 'PortOne sk_test');
});

test('onRequestPost: 이상한 요청·설정 없음·없는 결제·금액 불일치는 거절', async () => {
  assert.equal((await call('not json', { PORTONE_API_SECRET: 'k' }, () => ok(PAID))).status, 400);
  assert.equal((await call({ paymentId: '../../admin' }, { PORTONE_API_SECRET: 'k' }, () => ok(PAID))).status, 400);
  assert.equal((await call({ paymentId: 'byeoksa-a-b' }, {}, () => ok(PAID))).status, 500);
  assert.equal((await call({ paymentId: 'byeoksa-a-b' }, { PORTONE_API_SECRET: 'k' }, () => new Response('{}', { status: 404 }))).status, 404);
  const bad = await call({ paymentId: 'byeoksa-a-b' }, { PORTONE_API_SECRET: 'k' }, () => ok({ ...PAID, amount: { total: 10 } }));
  assert.equal(bad.status, 400); assert.equal(bad.json.status, 'INVALID');
  const price = await call({ paymentId: 'byeoksa-a-b' }, { PORTONE_API_SECRET: 'k', PRICES: '{"벽사신견 천명 리포트":5900}' }, () => ok({ ...PAID, amount: { total: 5900 } }));
  assert.equal(price.json.status, 'PAID', '가격 환경 변수');
});

test('site/ 코드에 포트원 비밀키 자리가 없다 (비밀키는 서버 환경 변수에만)', () => {
  const fs = require('fs');
  const app = fs.readFileSync(path.resolve(__dirname, '../../site/js/app.js'), 'utf8');
  assert.ok(!/apiSecret|API_SECRET|PORTONE_API/i.test(app));
});

test('결제 확인 서버: 전부 묶음 보따리 10,900원 (공유 할인 9,900원)도 인정', async () => {
  const { checkPayment } = await load();
  const B = { status: 'PAID', amount: { total: 10900 }, currency: 'KRW', orderName: '벽사신견 전부 묶음 보따리', channel: { type: 'LIVE' } };
  assert.equal(checkPayment(B).ok, true);
  assert.equal(checkPayment({ ...B, amount: { total: 9900 } }).ok, true);
  assert.equal(checkPayment({ ...B, amount: { total: 4900 } }).ok, false, '묶음을 리포트 값으로 결제 불가');
});

test('배포 설정: 실결제(포트원) 모드, KCP 채널 키·상점 아이디가 있고, 결제 확인 서버를 거친다', () => {
  const fs = require('fs');
  const app = fs.readFileSync(path.resolve(__dirname, '../../site/js/app.js'), 'utf8');
  const cfg = app.match(/const PAYMENT = \{[\s\S]*?\n  \};/)[0];
  assert.match(cfg, /mode: 'portone'/);
  assert.match(cfg, /storeId: 'store-[0-9a-f-]{36}'/);
  assert.match(cfg, /channelKey: 'channel-key-[0-9a-f-]{36}'/);
  assert.match(cfg, /verifyUrl: '\/api\/payment\/complete'/);
});

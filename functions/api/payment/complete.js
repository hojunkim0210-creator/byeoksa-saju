// 결제 확인 서버 — Cloudflare Pages Functions:  POST /api/payment/complete  { "paymentId": "byeoksa-..." }
//
// 하는 일: 브라우저가 "결제됐다"고 알려 오면, 그 말을 믿지 않고 포트원(PortOne)에 직접 물어
//         ① 결제 완료(PAID)인지 ② 상품명이 목록에 있고 금액이 정가(또는 공유 할인가)·원화인지 ③ (설정 시) 실결제 채널인지 확인한다.
//
// Cloudflare Pages 프로젝트 설정 → 환경 변수(암호화)에 넣을 값:
//   PORTONE_API_SECRET  포트원 관리자 콘솔 → 결제 연동 → 연동 정보 → API Secret  (절대 site/ 코드나 깃에 넣지 말 것)
//   PRICES              가격을 바꿨을 때만: 상품명별 가격 JSON, 예) {"벽사신견 신년운세":5900}  (app.js PRODUCTS와 같게)
//   REQUIRE_LIVE        '1'이면 테스트 채널로 결제된 건은 거절 (실판매 시작 후 켜기)
// 그리고 site/js/app.js 의 PAYMENT.verifyUrl 을 '/api/payment/complete' 로 바꾼다.

// 상품 목록 — site/js/app.js 의 PRODUCTS 와 이름·가격이 같아야 한다
export const CATALOG = {
  '벽사신견 천명 리포트': 4900,
  '벽사신견 신년운세': 4900,
  '벽사신견 궁합 상세 리포트': 3900,
  '벽사신견 소원 부적': 1900,
  '벽사신견 전부 묶음 보따리': 10900
};
export const SHARE_DISCOUNT = 1000;   // 공유 할인 (app.js SHARE_DISCOUNT.amount 와 같게)
export const ORDER_NAME = '벽사신견 천명 리포트';
const ID_PATTERN = /^byeoksa-[a-z0-9]+-[a-z0-9]+$/;

/** 포트원 결제 정보가 우리 상품 결제가 맞는지 (순수 함수 — 테스트용으로 따로 뺌)
 *  금액은 상품 정가 또는 정가 − 공유 할인만 인정한다 */
export function checkPayment(p, { catalog = CATALOG, discount = SHARE_DISCOUNT, requireLive = false } = {}) {
  if (!p || typeof p !== 'object') return { ok: false, reason: 'no-payment' };
  if (p.status !== 'PAID') return { ok: false, reason: 'status:' + p.status };
  const list = catalog[p.orderName];
  if (!list) return { ok: false, reason: 'orderName' };
  const total = p.amount && p.amount.total;
  if (total !== list && total !== list - discount) return { ok: false, reason: 'amount' };
  if (p.currency !== 'KRW') return { ok: false, reason: 'currency' };
  if (requireLive && (!p.channel || p.channel.type !== 'LIVE')) return { ok: false, reason: 'test-channel' };
  return { ok: true };
}

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

export async function onRequestPost({ request, env }) {
  let body = null;
  try { body = await request.json(); } catch (e) { /* 아래에서 거절 */ }
  const paymentId = body && body.paymentId;
  if (typeof paymentId !== 'string' || !ID_PATTERN.test(paymentId)) return json({ status: 'BAD_REQUEST' }, 400);
  if (!env.PORTONE_API_SECRET) return json({ status: 'NOT_CONFIGURED' }, 500);

  const r = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `PortOne ${env.PORTONE_API_SECRET}` }
  });
  if (!r.ok) return json({ status: 'NOT_FOUND' }, 404);
  const payment = await r.json();

  let catalog = CATALOG;
  try { if (env.PRICES) catalog = { ...CATALOG, ...JSON.parse(env.PRICES) }; } catch (e) { /* 잘못된 설정은 무시 */ }
  const v = checkPayment(payment, { catalog, requireLive: env.REQUIRE_LIVE === '1' });
  if (!v.ok) return json({ status: 'INVALID', reason: v.reason }, 400);
  return json({ status: 'PAID' });
}

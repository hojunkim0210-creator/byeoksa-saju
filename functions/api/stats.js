// 실측 결제 수 — Cloudflare Pages Functions:  GET /api/stats  →  { "status": "OK", "paid": 123 }
//
// 하는 일: 포트원에 "이 상점의 실결제(테스트 아님) 중 결제 완료(PAID) 건수"를 물어 그 숫자만 돌려준다. 손님 정보는 담지 않는다.
//         취소(환불)된 건은 상태가 바뀌어 저절로 빠진다. 결과는 10분 동안 캐시한다(포트원에 너무 자주 묻지 않게).
// 환경 변수: PORTONE_API_SECRET (결제 확인 서버 complete.js 와 같은 값, Cloudflare 에만). PORTONE_STORE_ID 는 선택(없으면 아래 STORE_ID).
// 화면: site/js/shop.js renderStats — 수가 STATS_MIN_SHOW(100) 이상일 때만 "N명이 봉인을 풀었다"를 보인다. 가짜 숫자 금지 규칙에 따라 센 값만 쓴다.

export const STORE_ID = 'store-67ebf046-cd7c-4e32-972a-458803ee77e0';   // app.js PAYMENT.storeId 와 같다 (비밀 값 아님)
export const SINCE = '2026-10-01T00:00:00+09:00';   // 판매 시작 전 날짜. 포트원은 from 을 비우면 최근 90일만 세므로 꼭 넣는다
export const CACHE_SECONDS = 600;

/** 포트원 '결제 건 다건 조회'(GET /payments)에 보낼 조건 — 순수 함수(테스트용). 건수만 필요하니 한 건만 달라고 한다 */
export function buildQuery({ storeId = STORE_ID, since = SINCE, until = new Date().toISOString() } = {}) {
  return { filter: { storeId, status: ['PAID'], isTest: false, from: since, until }, page: { number: 0, size: 1 } };
}

/** 포트원 응답에서 건수만 (없거나 이상하면 null) */
export function readCount(body) {
  const n = body && body.page && body.page.totalCount;
  return (Number.isInteger(n) && n >= 0) ? n : null;
}

const json = (obj, status = 200, cache = 'no-store') => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache }
});

export async function onRequestGet({ request, env }) {
  if (!env.PORTONE_API_SECRET) return json({ status: 'NOT_CONFIGURED' }, 500);
  const cache = (typeof caches !== 'undefined' && caches.default) ? caches.default : null;   // Cloudflare 캐시 (테스트 환경엔 없다)
  const key = cache ? new Request(new URL(request.url).origin + '/api/stats') : null;
  if (cache) { try { const hit = await cache.match(key); if (hit) return hit; } catch (e) { /* 캐시 없이 진행 */ } }
  const q = buildQuery({ storeId: env.PORTONE_STORE_ID || STORE_ID });
  // GET 에 본문을 싣는 대신 포트원 안내대로 requestBody 쿼리에 JSON 문자열을 넣는다
  const r = await fetch('https://api.portone.io/payments?requestBody=' + encodeURIComponent(JSON.stringify(q)), {
    headers: { Authorization: `PortOne ${env.PORTONE_API_SECRET}` }
  });
  if (!r.ok) return json({ status: 'UPSTREAM_ERROR' }, 502);
  let n = null;
  try { n = readCount(await r.json()); } catch (e) { n = null; }
  if (n === null) return json({ status: 'UPSTREAM_ERROR' }, 502);
  const res = json({ status: 'OK', paid: n }, 200, `public, max-age=${CACHE_SECONDS}`);
  if (cache) { try { await cache.put(key, res.clone()); } catch (e) { /* 무시 */ } }
  return res;
}

// 이용 횟수 집계 — Cloudflare Pages Functions:  POST /api/count  { "e": "visit" }  →  204
//
// 하는 일: 손님이 어느 단계까지 오는지 알려고 "하루에 몇 번"만 센다(업데이트 38, 2026-11-07).
//         보내는 것은 단계 이름 하나뿐이다. 생년월일·이름·IP·쿠키·기기 식별값은 받지도 저장하지도 않는다.
//         저장은 날짜(한국 기준) + 단계 이름별 합계 숫자 하나씩이다. 읽는 쪽은 functions/numbers.js.
// Cloudflare Pages 설정에서 해 둘 것(대표님 몫 — 안 해 두면 이 서버는 아무것도 저장하지 않고 조용히 끝난다):
//   ① KV 네임스페이스 하나 만들기(이름 예: byeoksa-counts)  ② Pages 프로젝트 → 설정 → 바인딩 → KV 네임스페이스, 변수 이름은 COUNTS
// 한계: KV는 "읽고 더해 쓰기"라 같은 순간에 겹치면 한두 건 빠질 수 있다. 방향을 보는 용도라 그대로 둔다.

export const EVENTS = ['visit', 'free', 'payopen', 'compat', 'compatsend', 'invited'];
export const KEEP_SECONDS = 400 * 86400;   // 13개월쯤 지난 숫자는 저절로 사라진다

/** 한국 시간 기준 날짜 'YYYY-MM-DD' (순수 함수 — 테스트용) */
export function dayKey(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
export const kvKey = (day, event) => `n:${day}:${event}`;

const empty = (status) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return empty(403);   // 다른 사이트에서 보낸 숫자는 받지 않는다
  let e = null;
  try { const body = await request.json(); e = body && body.e; } catch (x) { return empty(400); }
  if (!EVENTS.includes(e)) return empty(400);
  if (!env.COUNTS) return empty(204);   // 아직 장부가 연결되지 않음 — 아무것도 하지 않는다
  const key = kvKey(dayKey(), e);
  try {
    const cur = parseInt(await env.COUNTS.get(key), 10);
    await env.COUNTS.put(key, String((Number.isInteger(cur) && cur >= 0 ? cur : 0) + 1), { expirationTtl: KEEP_SECONDS });
  } catch (x) { /* 숫자 세기 때문에 손님 화면이 영향받으면 안 된다 */ }
  return empty(204);
}

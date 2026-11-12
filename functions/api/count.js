// 이용 횟수 집계 — Cloudflare Pages Functions:  POST /api/count  { "e": "visit" }  또는  { "e": ["visit", "home"] }  →  204
//
// 하는 일: 손님이 어느 단계까지 오는지 알려고 "하루에 몇 번"만 센다(업데이트 38, 2026-11-07).
//         보내는 것은 단계 이름뿐이다. 생년월일·이름·IP·쿠키·기기 식별값은 받지도 저장하지도 않는다.
//         저장은 날짜(한국 기준)마다 장부 한 장 `d:날짜` = { 단계 이름: 합계, _w: 그날 쓴 횟수 } 이다. 읽는 쪽은 functions/numbers.js.
// 업데이트 47 (2026-11-10 보안 점검 3번 — marketing/보안점검_1110.md):
//   ① 우리 사이트 화면에서 온 요청만 받는다(fromOurSite) — 주소를 밖에서 직접 두드리는 요청은 403.
//   ② 무료 요금제는 장부(KV) 쓰기가 하루 1,000번이고 무료 코드의 '사용 완료'(code.js)도 같은 장부를 쓴다.
//      그래서 숫자 세기는 하루 DAY_WRITE_BUDGET(800)번까지만 쓰고 나머지는 코드 몫으로 남긴다. 넘은 날은 그 뒤 숫자가 덜 세진다(화면에는 영향 없음).
//   ③ 같은 순간의 단계(방문 + 대문 도착)는 한 요청으로 받아 한 번만 쓴다. 날마다 장부가 한 장이라 숫자 페이지가 읽는 횟수도 준다.
//   (업데이트 46까지는 `n:날짜:단계` 숫자 하나씩이었다 — 그 날짜들은 numbers.js 가 옛 모양으로도 읽는다.)
// Cloudflare Pages 설정에서 해 둘 것(대표님 몫 — 안 해 두면 이 서버는 아무것도 저장하지 않고 조용히 끝난다):
//   ① KV 네임스페이스 하나 만들기(이름 예: byeoksa-counts)  ② Pages 프로젝트 → 설정 → 바인딩 → KV 네임스페이스, 변수 이름은 COUNTS
// 한계: KV는 "읽고 더해 쓰기"라 같은 순간에 겹치면 한두 건 빠질 수 있다. 방향을 보는 용도라 그대로 둔다.

// home = 대문 도착, input = 입력 화면 도착 (업데이트 45 — 방문과 무료 풀이 사이 어디서 빠지는지), codeopen = 무료 코드로 리포트를 엶
// direct = '바로 입력' 주소(?go=input)로 들어옴 (업데이트 48 — 대문을 건너뛰므로 home 대신 이것을 센다)
export const EVENTS = ['visit', 'home', 'input', 'free', 'payopen', 'compat', 'compatsend', 'invited', 'codeopen', 'direct'];
export const KEEP_SECONDS = 400 * 86400;   // 13개월쯤 지난 숫자는 저절로 사라진다
export const DAY_WRITE_BUDGET = 800;        // 숫자 세기가 하루에 장부에 쓰는 횟수 한도 (무료 요금제 1,000번 중 200번은 무료 코드 몫)
export const MAX_BATCH = 4;                 // 한 요청에 실을 수 있는 단계 수

/** 한국 시간 기준 날짜 'YYYY-MM-DD' (순수 함수 — 테스트용) */
export function dayKey(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
export const dayBookKey = day => `d:${day}`;                    // 그날 장부 한 장 (업데이트 47)
export const kvKey = (day, event) => `n:${day}:${event}`;       // 업데이트 46까지의 옛 모양 (numbers.js 가 옛 날짜를 읽을 때만 쓴다)

/** 우리 사이트 화면에서 온 요청인가 — Origin이 우리 주소이거나, Origin이 없으면 Sec-Fetch-Site·Referer가 같은 사이트일 때 (순수 함수) */
export function fromOurSite(request) {
  const self = new URL(request.url).origin;
  const origin = request.headers.get('Origin');
  if (origin) return origin === self;
  const site = request.headers.get('Sec-Fetch-Site');
  if (site) return site === 'same-origin';
  const ref = request.headers.get('Referer');
  if (ref) { try { return new URL(ref).origin === self; } catch (e) { return false; } }
  return false;   // 아무 표시도 없으면(주소를 직접 두드린 요청) 받지 않는다
}

/** 요청 본문의 e(글자 하나 또는 배열)를 단계 이름 목록으로. 잘못됐으면 null */
export function eventsOf(e) {
  const list = Array.isArray(e) ? e : [e];
  if (!list.length || list.length > MAX_BATCH) return null;
  if (!list.every(x => typeof x === 'string' && EVENTS.includes(x))) return null;
  return [...new Set(list)];
}

/** 장부 글자를 { 단계: 숫자, _w } 로 (깨졌으면 빈 장부) */
export function readBook(raw) {
  let o = null;
  try { o = raw ? JSON.parse(raw) : null; } catch (e) { o = null; }
  const book = { _w: 0 };
  if (o && typeof o === 'object') {
    for (const k of EVENTS) if (Number.isInteger(o[k]) && o[k] > 0) book[k] = o[k];
    if (Number.isInteger(o._w) && o._w > 0) book._w = o._w;
  }
  return book;
}

const empty = (status) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });

export async function onRequestPost({ request, env }) {
  if (!fromOurSite(request)) return empty(403);   // 다른 사이트·밖에서 직접 보낸 숫자는 받지 않는다
  let names = null;
  try { const body = await request.json(); names = eventsOf(body && body.e); } catch (x) { return empty(400); }
  if (!names) return empty(400);
  if (!env.COUNTS) return empty(204);   // 아직 장부가 연결되지 않음 — 아무것도 하지 않는다
  const key = dayBookKey(dayKey());
  try {
    const book = readBook(await env.COUNTS.get(key));
    if (book._w >= DAY_WRITE_BUDGET) return empty(204);   // 오늘 몫을 다 썼다 — 남은 쓰기는 무료 코드 몫
    for (const n of names) book[n] = (book[n] || 0) + 1;
    book._w += 1;
    await env.COUNTS.put(key, JSON.stringify(book), { expirationTtl: KEEP_SECONDS });
  } catch (x) { /* 숫자 세기 때문에 손님 화면이 영향받으면 안 된다 */ }
  return empty(204);
}

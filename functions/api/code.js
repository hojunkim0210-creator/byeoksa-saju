// 무료 코드 이벤트 — Cloudflare Pages Functions:  POST /api/code  { "code": "ABCD-EFGH-JKLM" }
//
// 하는 일 (업데이트 45, 2026-11-10 — 대표님 "카카오페이 나오면 바로 시작, 미리 준비만"): 이벤트로 나눠 준 무료 코드가 맞는지 보고,
//   맞으면 '사용 완료'를 적어 두 번 못 쓰게 한다. 맞으면 화면(app.js)이 결제 없이 천명 리포트를 연다.
//   코드 원문은 어디에도 두지 않는다(대표님 marketing/이벤트_코드_명단.md 에만, 깃 제외). 여기엔 되돌릴 수 없는 지문(SHA-256)만 있다.
//   코드는 12자리(헷갈리는 0·O·1·I를 뺀 32글자)라, 공개된 지문으로 거꾸로 맞히는 것은 사실상 불가능하다.
//   '사용 완료' 기록은 이미 연결된 숫자 장부(KV 바인딩 COUNTS)에 `code:<지문>` 이름으로 쓴다 — 대시보드 작업이 필요 없다. 손님 정보는 적지 않는다.
// 응답: 200 {status:'OK'} · 404 {status:'WRONG'} · 409 {status:'USED'} · 503 {status:'OFF'}(이벤트 꺼짐·장부 없음·장부 오류) · 403 다른 사이트 · 400 잘못된 요청
// 한계: KV는 곳에 따라 1분쯤 늦게 퍼지므로 같은 코드를 거의 동시에 두 곳에서 넣으면 둘 다 열릴 수 있다(코드는 DM으로 한 사람에게만 가므로 그대로 둔다).
// 켜는 법: EVENT_ON = true — 화면 쪽 site/js/app.js 의 EVENT.enabled 도 같이 켠다(CLAUDE.md 2절 업데이트 45).

export const EVENT_ON = false;
export const SALT = 'a6baaa21e396ad012c0060af83e23313';
export const CODE_HASHES = new Set([
  '9d68718b541ce386f6285c7ad310395f7c121ada84edef35bf67096c900b7475',
  'd1ba86af15dbf46ae945a97c21e2c0fd26c6c63799b07367ea308a75bf6644a1',
  '4248e38280bcc9afc213aeeda4d780edb6e00822d1e62c9756fae18ea84352c3',
  'bdcbb5dc783a006330bffa206da261f2113ea4bb084f37290deb8f1941fdefeb',
  '1b5f324d35cb94ec2ab2e8cb9255af9c2e379ea67f2868ea4d223c8afd7770c3',
  '17a73de48fc151597044861b296f2378edffcfc3e60c7200ef473fb74fcea2b4',
  '34108848267ca714e700f86c29bcbc9a9c716b3aea6588751ca813e49402e055',
  'e03a0ce1e376d2611528ddb3d3e6c9a53ed32f7a83cf005240a4599cfd40798d',
  'a3f43c747355304ea4a8e65959c5d3f83b95ea900aa1879a9561888cb032b3d6',
  '1dedac2d834d892a7303140bb766c52d083f9768a90a384dd4679370c2505834',
  '12076e2ed5bb03c4863bbccfce56a1762f5a3e1988cdb1e2b514d77073ff6166',
  '77a991e076128fc38524ea706eaca8857f4b12176f9b5aeddbbdda16c616a4c9',
  '156cc070f25eacde19645b08c0672db4b78e260f9d41d6a756077289826a256b',
  '53b22a0e1aa2251bc8356f783282ad5b56363dc8189bbf1fdb0c83fcf645ccee',
  'fcc50a0d4fb8f0574febc769ece536c9d7991784c0faf586cdea2276ad4ae585',
  '5ccf838240a9d9c56df7e4fdb162ff351413b8088dd5beb4cbee0e35bf75bdca',
  'fb424514c783c7f539f8dc58280b1a047a43b6cb545d4e44c0b3fd5e5b03619a',
  'c3b0f869e8b9e6c83897b39dadb556c2e204846f1c250251ac8bd729a804bef9'
]);
export const USED_SECONDS = 400 * 86400;   // '사용 완료' 기록은 13개월쯤 뒤 저절로 지워진다(이벤트는 그 전에 끝난다)

/** 대소문자·하이픈·띄어쓰기를 지운 코드 (순수 함수 — 테스트용) */
export function normalizeCode(raw) {
  return String(raw || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/** 코드 지문: SHA-256(소금 + ':' + 코드) 16진수 */
export async function codeHash(norm, salt = SALT) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${norm}`));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** 코드 확인 + 사용 기록. 테스트에서 지문 목록·장부·스위치를 바꿔 넣을 수 있게 나눴다. [상태 코드, 본문] */
export async function redeem(raw, { kv, hashes = CODE_HASHES, on = EVENT_ON, salt = SALT } = {}) {
  if (!on || !kv) return [503, { status: 'OFF' }];
  const norm = normalizeCode(raw);
  if (norm.length !== 12) return [404, { status: 'WRONG' }];
  const h = await codeHash(norm, salt);
  if (!hashes.has(h)) return [404, { status: 'WRONG' }];
  const key = `code:${h}`;
  try {
    if (await kv.get(key)) return [409, { status: 'USED' }];
    await kv.put(key, new Date().toISOString(), { expirationTtl: USED_SECONDS });
  } catch (e) {
    return [503, { status: 'OFF' }];   // 장부 오류 — 손님 탓이 아니니 '틀린 코드'라고 하지 않는다
  }
  return [200, { status: 'OK' }];
}

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json(403, { status: 'FORBIDDEN' });   // 다른 사이트에서 보낸 요청은 받지 않는다
  let code = null;
  try { const body = await request.json(); code = body && body.code; } catch (e) { return json(400, { status: 'BAD' }); }
  if (typeof code !== 'string' || code.length > 40) return json(400, { status: 'BAD' });
  const [status, body] = await redeem(code, { kv: env.COUNTS });
  return json(status, body);
}

// 대표님용 숫자 페이지 — Cloudflare Pages Functions:  GET /numbers?k=열쇠
//
// 하는 일: 최근 14일의 단계별 이용 횟수(functions/api/count.js 가 쌓은 숫자)와 결제 완료 건수(포트원, stats.js 와 같은 방법)를 표 하나로 보여 준다.
//         열쇠(NUMBERS_KEY)가 맞을 때만 보인다. 검색에 안 잡히게 noindex, 저장 안 되게 no-store.
// Cloudflare Pages 환경 변수(암호화)에 넣을 값: NUMBERS_KEY  = 대표님이 정한 긴 글자(깃·대화·사이트 코드에 쓰지 말 것)
//   (PORTONE_API_SECRET·COUNTS 는 결제 확인 서버·count.js 가 쓰는 것과 같다)
// 주소는 대표님만 북마크한다: https://byeoksa.com/numbers?k=열쇠

import { EVENTS, DAY_WRITE_BUDGET, dayKey, dayBookKey, kvKey, readBook } from './api/count.js';
import { buildQuery, readCount, STORE_ID } from './api/stats.js';

export const DAYS = 14;
export const LEGACY_LAST_DAY = '2026-11-12';   // 이 날짜까지는 옛 장부 모양(`n:날짜:단계`)도 읽는다 — 업데이트 47을 올린 날 전후
export const LABELS = {
  visit: '첫 화면 방문', home: '대문 도착', input: '입력 화면 도착', free: '무료 풀이 봄', payopen: '결제창 연 횟수', paid: '결제 완료',
  compat: '궁합 결과 봄', compatsend: '궁합 "상대에게 보내기"', invited: '보낸 궁합 링크로 들어옴',
  codeopen: '무료 코드로 엶'   // 업데이트 45 — 무료 코드 이벤트를 켠 뒤부터 쌓인다
};

/** 오늘부터 거슬러 올라간 날짜 목록 'YYYY-MM-DD' (순수 함수 — 테스트용) */
export function lastDays(n = DAYS, now = new Date()) {
  return Array.from({ length: n }, (_, i) => dayKey(new Date(now.getTime() - i * 86400000)));
}

/** 'a / b' 비율을 퍼센트 글로. b가 0이면 '-' */
export function pct(a, b) {
  if (!(b > 0) || !Number.isFinite(a)) return '-';
  return Math.round((a / b) * 100) + '%';
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const html = (body, status = 200) => new Response(body, {
  status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }
});

/** 표 페이지 만들기 (순수 함수 — 테스트용). rows = [{ day, visit, home, input, free, payopen, paid, compat, compatsend, invited, codeopen }] 최신이 위 */
export function renderPage(rows, { configured = true, paidKnown = true, writesToday = null } = {}) {
  const sum = k => rows.reduce((n, r) => n + (Number.isFinite(r[k]) ? r[k] : 0), 0);
  const total = Object.fromEntries(['visit', 'home', 'input', 'free', 'payopen', 'paid', 'compat', 'compatsend', 'invited', 'codeopen'].map(k => [k, sum(k)]));
  const cell = v => (Number.isFinite(v) ? v : '-');
  // 깔때기는 '대문 도착'을 세기 시작한 날부터만 더한다(업데이트 45 전 날짜는 대문·입력 숫자가 없어 비율이 어긋난다). 아직 한 번도 안 셌으면 예전처럼 방문 → 무료 풀이.
  const oldest = rows.map(r => r.home > 0).lastIndexOf(true);   // rows는 최신이 위 → 대문 숫자가 있는 가장 오래된 날
  const stepped = oldest >= 0;
  const fRows = stepped ? rows.slice(0, oldest + 1) : rows;
  const f = Object.fromEntries(['visit', 'home', 'input', 'free', 'payopen', 'paid'].map(k => [k, fRows.reduce((n, r) => n + (Number.isFinite(r[k]) ? r[k] : 0), 0)]));
  const funnelTitle = stepped && fRows.length < rows.length
    ? `어디서 줄어드나 (${fRows.length}일 합계 — 대문·입력을 세기 시작한 ${esc(fRows[fRows.length - 1].day.slice(5))}부터)`
    : `어디서 줄어드나 (${rows.length}일 합계)`;
  const cols = ['visit', 'home', 'input', 'free', 'payopen', 'paid', 'compat', 'compatsend', 'invited', 'codeopen'];
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>벽사신견 숫자</title>
<style>body{font-family:-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;background:#121426;color:#E6D6B3;margin:0;padding:16px;line-height:1.5}
h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:24px 0 8px;color:#E3B341}p{margin:4px 0;color:#D8C49A;font-size:14px}
.warn{background:#861F17;color:#fff;padding:10px 12px;border-radius:8px;margin:12px 0}
table{border-collapse:collapse;width:100%;font-size:14px}th,td{border-bottom:1px solid rgba(227,179,65,.22);padding:6px 8px;text-align:right}
th:first-child,td:first-child{text-align:left;white-space:nowrap}th{color:#E3B341;font-weight:600;font-size:12.5px;vertical-align:bottom}
.wrap{overflow-x:auto}.big td{font-size:15px}</style></head><body>
<h1>벽사신견 숫자</h1><p>최근 ${rows.length}일(한국 시간). 개인정보 없이 횟수만 센 것입니다.</p>
${configured ? '' : '<div class="warn">아직 숫자 장부(KV)가 연결되지 않아 방문·풀이 횟수는 비어 있습니다. 결제 완료만 보입니다.</div>'}
${paidKnown ? '' : '<div class="warn">포트원에서 결제 완료 건수를 가져오지 못했습니다(- 로 표시).</div>'}
${Number.isInteger(writesToday) ? `<p>오늘 숫자 장부에 쓴 횟수: <strong>${writesToday}</strong> / ${DAY_WRITE_BUDGET}번. ${writesToday >= DAY_WRITE_BUDGET ? '오늘 몫을 다 써서 지금부터 숫자는 세지 않습니다(내일 다시 셉니다). 무료 코드는 그대로 됩니다.' : '이 횟수를 넘으면 그날은 더 세지 않고, 남은 쓰기는 무료 코드 몫으로 둡니다.'}</p>` : ''}
<h2>${funnelTitle}</h2>
<table class="big"><tbody>
<tr><td>첫 화면 방문</td><td>${cell(f.visit)}</td><td></td></tr>
${stepped ? `<tr><td>→ 대문 도착</td><td>${cell(f.home)}</td><td>${pct(f.home, f.visit)}</td></tr>
<tr><td>→ 입력 화면 도착</td><td>${cell(f.input)}</td><td>${pct(f.input, f.home)}</td></tr>
<tr><td>→ 무료 풀이 봄</td><td>${cell(f.free)}</td><td>${pct(f.free, f.input)}</td></tr>` : `<tr><td>→ 무료 풀이 봄</td><td>${cell(f.free)}</td><td>${pct(f.free, f.visit)}</td></tr>`}
<tr><td>→ 결제창 연 횟수</td><td>${cell(f.payopen)}</td><td>${pct(f.payopen, f.free)}</td></tr>
<tr><td>→ 결제 완료</td><td>${cell(f.paid)}</td><td>${pct(f.paid, f.payopen)}</td></tr>
</tbody></table>
<p>오른쪽 %는 바로 윗줄 대비입니다. 결제창은 한 사람이 여러 번 열 수 있어 100%를 넘을 수도 있습니다.</p>
<p>'대문 도착'·'입력 화면 도착'은 업데이트 45를 올린 날부터 셉니다(탭 하나에 한 번). 위 표는 그 숫자가 있는 날부터만 더합니다. 결과 링크·궁합 링크로 바로 들어온 손님은 대문·입력을 거치지 않아, 무료 풀이가 입력보다 많을 수도 있습니다.</p>
<h2>궁합 공유</h2>
<table class="big"><tbody>
<tr><td>궁합 결과 봄</td><td>${cell(total.compat)}</td><td></td></tr>
<tr><td>→ "상대에게 보내기" 누름</td><td>${cell(total.compatsend)}</td><td>${pct(total.compatsend, total.compat)}</td></tr>
<tr><td>→ 보낸 링크로 들어옴</td><td>${cell(total.invited)}</td><td>${pct(total.invited, total.compatsend)}</td></tr>
</tbody></table>
<h2>날짜별</h2>
<div class="wrap"><table><thead><tr><th>날짜</th>${cols.map(k => `<th>${esc(LABELS[k])}</th>`).join('')}</tr></thead><tbody>
${rows.map(r => `<tr><td>${esc(r.day.slice(5))}</td>${cols.map(k => `<td>${cell(r[k])}</td>`).join('')}</tr>`).join('\n')}
</tbody></table></div>
</body></html>`;
}

/** 하루치 결제 완료 건수 — 포트원에서 센다. 못 가져오면 NaN */
async function paidOn(day, env) {
  try {
    const from = `${day}T00:00:00+09:00`;
    const until = new Date(new Date(from).getTime() + 86400000).toISOString();
    const q = buildQuery({ storeId: env.PORTONE_STORE_ID || STORE_ID, since: from, until });
    const r = await fetch('https://api.portone.io/payments?requestBody=' + encodeURIComponent(JSON.stringify(q)), {
      headers: { Authorization: `PortOne ${env.PORTONE_API_SECRET}` }
    });
    if (!r.ok) return NaN;
    const n = readCount(await r.json());
    return n === null ? NaN : n;
  } catch (e) { return NaN; }
}

export async function onRequestGet({ request, env }) {
  const key = new URL(request.url).searchParams.get('k') || '';
  // 열쇠가 없거나 틀리면 이 주소가 있다는 사실도 알려 주지 않는다
  if (!env.NUMBERS_KEY || key.length !== env.NUMBERS_KEY.length || key !== env.NUMBERS_KEY) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const days = lastDays();
  const configured = !!env.COUNTS;
  let writesToday = null;
  const rows = await Promise.all(days.map(async (day, idx) => {
    const row = { day };
    if (!configured) { for (const e of EVENTS) row[e] = NaN; }
    else {
      try {
        const book = readBook(await env.COUNTS.get(dayBookKey(day)));   // 그날 장부 한 장 (업데이트 47)
        for (const e of EVENTS) row[e] = book[e] || 0;
        if (idx === 0) writesToday = book._w;
        if (day <= LEGACY_LAST_DAY) {   // 업데이트 46까지 쓰던 옛 모양(단계마다 숫자 하나)도 더한다 — 바꾼 날에는 두 모양이 섞여 있다
          for (const e of EVENTS) { const n = parseInt(await env.COUNTS.get(kvKey(day, e)), 10); if (Number.isInteger(n) && n > 0) row[e] += n; }
        }
      } catch (x) { for (const e of EVENTS) row[e] = NaN; }
    }
    row.paid = env.PORTONE_API_SECRET ? await paidOn(day, env) : NaN;
    return row;
  }));
  return html(renderPage(rows, { configured, paidKnown: rows.every(r => Number.isFinite(r.paid)), writesToday }));
}

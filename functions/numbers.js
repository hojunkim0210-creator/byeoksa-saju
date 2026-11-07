// 대표님용 숫자 페이지 — Cloudflare Pages Functions:  GET /numbers?k=열쇠
//
// 하는 일: 최근 14일의 단계별 이용 횟수(functions/api/count.js 가 쌓은 숫자)와 결제 완료 건수(포트원, stats.js 와 같은 방법)를 표 하나로 보여 준다.
//         열쇠(NUMBERS_KEY)가 맞을 때만 보인다. 검색에 안 잡히게 noindex, 저장 안 되게 no-store.
// Cloudflare Pages 환경 변수(암호화)에 넣을 값: NUMBERS_KEY  = 대표님이 정한 긴 글자(깃·대화·사이트 코드에 쓰지 말 것)
//   (PORTONE_API_SECRET·COUNTS 는 결제 확인 서버·count.js 가 쓰는 것과 같다)
// 주소는 대표님만 북마크한다: https://byeoksa.com/numbers?k=열쇠

import { EVENTS, dayKey, kvKey } from './api/count.js';
import { buildQuery, readCount, STORE_ID } from './api/stats.js';

export const DAYS = 14;
export const LABELS = {
  visit: '첫 화면 방문', free: '무료 풀이 봄', payopen: '결제창 연 횟수', paid: '결제 완료',
  compat: '궁합 결과 봄', compatsend: '궁합 "상대에게 보내기"', invited: '보낸 궁합 링크로 들어옴'
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

/** 표 페이지 만들기 (순수 함수 — 테스트용). rows = [{ day, visit, free, payopen, paid, compat, compatsend, invited }] 최신이 위 */
export function renderPage(rows, { configured = true, paidKnown = true } = {}) {
  const sum = k => rows.reduce((n, r) => n + (Number.isFinite(r[k]) ? r[k] : 0), 0);
  const total = Object.fromEntries(['visit', 'free', 'payopen', 'paid', 'compat', 'compatsend', 'invited'].map(k => [k, sum(k)]));
  const cell = v => (Number.isFinite(v) ? v : '-');
  const cols = ['visit', 'free', 'payopen', 'paid', 'compat', 'compatsend', 'invited'];
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
<h2>어디서 줄어드나 (14일 합계)</h2>
<table class="big"><tbody>
<tr><td>첫 화면 방문</td><td>${cell(total.visit)}</td><td></td></tr>
<tr><td>→ 무료 풀이 봄</td><td>${cell(total.free)}</td><td>${pct(total.free, total.visit)}</td></tr>
<tr><td>→ 결제창 연 횟수</td><td>${cell(total.payopen)}</td><td>${pct(total.payopen, total.free)}</td></tr>
<tr><td>→ 결제 완료</td><td>${cell(total.paid)}</td><td>${pct(total.paid, total.payopen)}</td></tr>
</tbody></table>
<p>오른쪽 %는 바로 윗줄 대비입니다. 결제창은 한 사람이 여러 번 열 수 있어 100%를 넘을 수도 있습니다.</p>
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
  const rows = await Promise.all(days.map(async day => {
    const row = { day };
    for (const e of EVENTS) {
      let v = NaN;
      if (configured) { try { const n = parseInt(await env.COUNTS.get(kvKey(day, e)), 10); v = Number.isInteger(n) ? n : 0; } catch (x) { v = NaN; } }
      row[e] = v;
    }
    row.paid = env.PORTONE_API_SECRET ? await paidOn(day, env) : NaN;
    return row;
  }));
  return html(renderPage(rows, { configured, paidKnown: rows.every(r => Number.isFinite(r.paid)) }));
}

// 두 스냅샷을 비교해 다른 요소만 출력한다. 사용: node compare_snapshots.js a.json b.json
const fs = require('fs');
const [a, b] = process.argv.slice(2).map(p => JSON.parse(fs.readFileSync(p, 'utf8')));
let total = 0;
for (const k of Object.keys(a)) {
  const A = a[k], B = b[k] || []; let diff = 0; const n = Math.max(A.length, B.length);
  for (let i = 0; i < n; i++) if (A[i] !== B[i]) { if (diff < 4) console.log(`[${k}#${i}]\n  - ${A[i]}\n  + ${B[i]}`); diff++; }
  console.log(`${k}: 요소 ${A.length} vs ${B.length}, 다른 항목 ${diff}`); total += diff;
}
process.exit(total ? 1 : 0);

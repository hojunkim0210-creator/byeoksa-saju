/**
 * 벽사신견 확장 기능: 인연 궁합 · 오늘의 운세 · 벽사 패 뽑기 · 벽사견에게 묻기 · 결과 공유 카드
 * - 계산은 SajuCore(saju-core.js), 공용 문장과 도우미(josa, getPersona, EL_KO 등)는 app.js 것을 쓴다.
 * - 생년월일은 이 기기 브라우저에만 저장된다(app.js saveProfile). 서버로 보내지 않는다.
 */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const stripTags = html => String(html).replace(/<[^>]+>/g, '');
  /** 주어 + 조사: '나' → '내가', '민지' → '민지가', '준석' → '준석이' */
  const subj = name => (name === '나' ? '내가' : name + josa(name, '이'));
  /** 서술격 조사: 받침 있으면 '이다', 없으면 '다' */
  const copula = word => (josa(word, '이') === '이' ? '이오' : '요');
  const HOUR_NAMES = ['자시', '축시', '인시', '묘시', '진시', '사시', '오시', '미시', '신시', '유시', '술시', '해시'];

  function today() {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
  }

  /** 생년월일로 원국·오행·맞춤 값 한 번에 */
  function readSaju(p) {
    const pillars = calculateFourPillars(p.y, p.m, p.d, p.hour >= 0 ? p.hour : null);
    const oheng = calculateOheng(pillars);
    const ps = getPersona(pillars.dStemIdx, pillars.dBranchIdx, oheng);
    return { pillars, oheng, ps, ilju: pillars.dStem.char + pillars.dBranch.char, iljuHanja: pillars.dStem.hanja + pillars.dBranch.hanja };
  }

  // ─────────────────────────────────────────────────────────────────────
  // 생년월일 입력 조각 (궁합 상대, 저장된 정보가 없을 때)
  // ─────────────────────────────────────────────────────────────────────
  // 시간 칸 글: 첫 입력 화면과 같게 시각을 붙인다 (업데이트 44, 더블체크 2-5). 12 = 밤 자시(다음 날 자시로 셈, 2-1)
  const HOUR_TIMES = ['밤 12:00 ~ 01:29', '01:30 ~ 03:29', '03:30 ~ 05:29', '05:30 ~ 07:29', '07:30 ~ 09:29', '09:30 ~ 11:29',
    '11:30 ~ 13:29', '13:30 ~ 15:29', '15:30 ~ 17:29', '17:30 ~ 19:29', '19:30 ~ 21:29', '21:30 ~ 23:29'];
  function birthFieldsHtml(prefix, v) {
    v = v || {};
    const L = v.lunar && v.lunar.y ? v.lunar : null;   // 음력으로 넣었던 사람은 음력 그대로 채운다 (업데이트 44)
    const D = L || (v.late && v.y ? addDaysYmd(v, -1) : v);   // 밤 자시로 넣었던 사람은 적은 날짜 그대로
    const hourSel = v.late ? LATE_ZI : v.hour;
    const hourOpts = ['<option value="-1">시간 모름</option>']
      .concat(HOUR_NAMES.map((n, i) => `<option value="${i}" ${hourSel === i ? 'selected' : ''}>${n} (${HOUR_TIMES[i]})</option>`))
      .concat(`<option value="${LATE_ZI}" ${hourSel === LATE_ZI ? 'selected' : ''}>밤 자시 (23:30 ~ 24:00 · 다음 날로 셈)</option>`).join('');
    return `
      <div class="input-row">
        <input type="number" inputmode="numeric" id="${prefix}Y" placeholder="년 (1990)" value="${D.y || ''}" aria-label="태어난 해">
        <input type="number" inputmode="numeric" id="${prefix}M" placeholder="월" value="${D.m || ''}" aria-label="태어난 달">
        <input type="number" inputmode="numeric" id="${prefix}D" placeholder="일" value="${D.d || ''}" aria-label="태어난 날">
      </div>
      <div class="input-row">
        <select id="${prefix}C" data-cal="${prefix}LWrap" aria-label="양력·음력">
          <option value="solar">양력</option>
          <option value="lunar" ${L ? 'selected' : ''}>음력</option>
        </select>
        <label class="leap-check" id="${prefix}LWrap" ${L ? '' : 'hidden'}><input type="checkbox" id="${prefix}L" ${L && L.leap ? 'checked' : ''}> 윤달</label>
      </div>
      <div class="input-row">
        <select id="${prefix}H" aria-label="태어난 시간">${hourOpts}</select>
        <select id="${prefix}G" aria-label="성별">
          <option value="M" ${v.gender === 'M' ? 'selected' : ''}>남성</option>
          <option value="F" ${v.gender === 'F' ? 'selected' : ''}>여성</option>
        </select>
      </div>`;
  }

  /** 입력 조각 읽기. 잘못되면 { error } */
  function readBirthFields(prefix) {
    const y = parseInt($(prefix + 'Y').value, 10), m = parseInt($(prefix + 'M').value, 10), d = parseInt($(prefix + 'D').value, 10);
    if (!y || !m || !d) return { error: '생년월일을 온전히 적어 내시오.' };
    if (y < 1920 || y > 2030) return { error: '생년은 1920년부터 2030년 사이로 적으시오.' };
    const cal = $(prefix + 'C'), leapBox = $(prefix + 'L');
    let s = { y, m, d }, lunar = null;
    if (cal && cal.value === 'lunar') {   // 음력 → 양력 (업데이트 44): 바꾼 양력 날짜로 계산하고, 음력은 확인용으로 곁에 둔다
      const leap = !!(leapBox && leapBox.checked);
      const r = SajuCore.lunarToSolar(y, m, d, leap);
      if (r.error) return { error: lunarErrorText(r, y, m, leap) };
      s = r; lunar = { y, m, d, leap };
    } else {
      const t = new Date(Date.UTC(y, m - 1, d));
      if (t.getUTCFullYear() !== y || t.getUTCMonth() + 1 !== m || t.getUTCDate() !== d) return { error: '존재하지 않는 날짜요. 다시 확인하시오.' };
    }
    if (isFutureDate(s)) return { error: FUTURE_TEXT };   // 오늘 뒤의 날짜 (업데이트 44, 더블체크 1-4)
    let hour = parseInt($(prefix + 'H').value, 10);
    const late = hour === LATE_ZI;   // 밤 자시 → 다음 날 자시 (더블체크 2-1)
    if (late) { s = addDaysYmd(s, 1); hour = 0; }
    return { y: s.y, m: s.m, d: s.d, hour, gender: $(prefix + 'G').value, ...(lunar ? { lunar } : {}), ...(late ? { late: true } : {}) };
  }

  /** 저장된 내 생년월일이 없으면 짧은 입력 칸을 보여주고, 있으면 바로 진행 */
  function withProfile(container, title, onReady) {
    const p = loadProfile();
    if (p) { onReady(p); return; }
    container.innerHTML = `
      <div class="feature-card">
        <h3 class="feature-card-title">${esc(title)}</h3>
        <p class="feature-note">생년월일은 이 기기 브라우저에만 기억해 두고, 어디로도 보내지 않소.</p>
        ${birthFieldsHtml('pf')}
        <p class="form-error" id="pfErr" role="alert"></p>
        <button class="btn-submit" id="pfGo">벽사견에게 생년월일 알려주기</button>
      </div>`;
    $('pfGo').onclick = () => {
      const b = readBirthFields('pf');
      if (b.error) { $('pfErr').textContent = b.error; return; }
      saveProfile(b);
      onReady(b);
    };
  }

  function profileLine(p, sj) {
    const hour = p.hour >= 0 ? ` ${HOUR_NAMES[p.hour]}` : '';
    const lunar = p.lunar && p.lunar.y ? ` (음력 ${p.lunar.y}. ${p.lunar.leap ? '윤' : ''}${p.lunar.m}. ${p.lunar.d}.)` : '';   // 업데이트 44
    const prev = p.late ? addDaysYmd(p, -1) : null;   // 밤 자시로 넣었으면 적은 날도 보인다
    const late = prev ? ` (${prev.m}월 ${prev.d}일 밤생, 다음 날로 셈)` : '';
    return `<p class="profile-line">${p.y}. ${p.m}. ${p.d}.${lunar}${hour}${late} · 태어난 날 ${esc(sj.ilju)}
      <button class="link-btn" data-act="change">다른 생년월일로</button>
      <button class="link-btn" data-act="forget">이 기기에서 지우기</button></p>`;
  }

  // 이 사이트가 기기에 남긴 것(생년월일·패 기록·무작위 식별값)을 모두 지운다 — 개인정보처리방침 2항
  function forgetAll() {
    clearProfile();
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('byeoksa.')) keys.push(k); }
      keys.forEach(k => localStorage.removeItem(k));
    } catch (e) { /* 저장소를 못 쓰는 환경이면 지울 것도 없다 */ }
  }

  function bindProfileLinks(root, rerender) {
    root.querySelectorAll('[data-act="change"]').forEach(b => { b.onclick = () => { clearProfile(); rerender(); }; });
    root.querySelectorAll('[data-act="forget"]').forEach(b => {
      b.onclick = () => { forgetAll(); showToast('이 기기에 남은 생년월일과 패 기록을 지웠소.'); rerender(); };
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // ① 인연 궁합
  // ─────────────────────────────────────────────────────────────────────
  // 쉬운 말 (2026-11-03 대표님 점검): 오늘의 운세·궁합도 결과 화면과 같은 말을 쓴다
  const EL_NAME = { wood: '나무', fire: '불', earth: '흙', metal: '쇠', water: '물' };
  const sp = n => ((window.BYEOKSA_PHRASES && window.BYEOKSA_PHRASES.sp) ? window.BYEOKSA_PHRASES.sp(n) : n);
  // 두 사람이 사랑하는 방식 — 일간 10 (궁합 무료 풀이, 2026-11-03 내용 보강)
  const LOVE_STYLE = {
    '갑': '큰 나무답게 곧게 사랑하는 편이오. 한번 정하면 오래 버티지만, 굽히는 말은 서툴 수 있소.',
    '을': '담쟁이답게 기대어 사랑하는 편이오. 곁에 붙어 있을 때 가장 환하고, 혼자 두면 금세 시들기 쉽소.',
    '병': '태양답게 환하게 사랑하는 편이오. 표현이 크고 빠른 만큼, 식는 것도 티가 나기 쉽소.',
    '정': '촛불답게 조용히 오래 사랑하는 편이오. 말보다 챙김으로 보여 주는 쪽이라, 그 챙김을 알아봐 주면 좋소.',
    '무': '큰 산답게 묵묵히 사랑하는 편이오. 흔들리지 않는 대신 먼저 다가가는 걸음이 느릴 수 있소.',
    '기': '기름진 땅답게 품어 사랑하는 편이오. 다 받아 주다 제 속을 말 못 할 수 있으니, 먼저 물어봐 주면 좋소.',
    '경': '무쇠답게 단단하게 사랑하는 편이오. 한 말은 지키지만, 부드러운 말 한마디가 아쉬울 수 있소.',
    '신': '보석답게 섬세하게 사랑하는 편이오. 작은 말에 빛나고 작은 말에 긁히기 쉬우니, 말을 고르면 좋소.',
    '임': '큰물답게 넓게 사랑하는 편이오. 다 받아들이는 듯하다가 한번 넘치면 걷잡기 어려울 수 있소.',
    '계': '안개비답게 스며드는 사랑을 하는 편이오. 티 안 나게 챙기고 티 안 나게 서운해하기 쉬우니, 자주 물어봐 주면 좋소.'
  };
  const COMPAT_BANDS = [
    { min: 88, name: '천생의 짝', text: '대문 앞에서 수많은 인연을 맡아 봤지만, 이렇게 서로의 냄새가 포개지는 짝은 흔치 않소. 놓치면 두고두고 아쉬울 인연이오.',
      alt: ['두 냄새가 하나처럼 섞이오. 서로 애쓰지 않아도 결이 맞는 사이라, 이런 짝은 대문 앞에서도 한 해에 몇 번 못 보오.', '한쪽이 숨을 들이쉬면 다른 쪽이 내쉬는 사이요. 말보다 먼저 통하는 인연이니, 흔한 다툼으로 흘려보내지 마시오.'] },
    { min: 75, name: '서로를 살리는 인연', text: '한쪽이 지칠 때 다른 쪽이 기운을 불어넣는 사이요. 지금처럼 서로의 편이 되어 주면 해가 갈수록 단단해지오.',
      alt: ['서로의 빈자리를 채워 주는 냄새요. 한 사람이 넘어질 때 다른 사람이 손을 내미는 사이라, 오래 갈수록 값이 오르는 인연이오.', '같이 있으면 둘 다 기운이 오르는 사이요. 따로 있을 때보다 함께 있을 때 더 나은 사람이 되는 인연이니, 그 느낌을 믿으시오.'] },
    { min: 62, name: '맞춰 가며 단단해질 인연', text: '처음부터 꼭 맞는 사이는 아니오. 하지만 서로의 다른 점을 알아 가는 만큼 깊어지는, 공들일 가치가 있는 인연이오.',
      alt: ['결이 조금 다르오. 다만 그 다름이 서로를 넓혀 주는 쪽이라, 한 해 두 해 지날수록 맞물리는 인연이오.', '맞춘 만큼 맞는 사이요. 저절로 되는 인연이 아니라 손이 가는 인연이지만, 손을 들인 만큼 돌려받소.'] },
    { min: 50, name: '냄새가 엇갈리는 인연', text: '끌리는 데는 이유가 있지만, 같은 일에도 서로 다른 냄새를 맡소. 말하지 않으면 모르는 사이이니 속마음을 꺼내 놓으시오.',
      alt: ['같은 자리에 서서 다른 쪽을 보는 사이요. 틀린 게 아니라 다른 것이니, 상대가 무엇을 보고 있는지 먼저 물으시오.', '끌림과 어긋남이 같이 나는 냄새요. 가까워질수록 다른 점이 보이는 사이이니, 서운함은 그날 안에 말로 푸시오.'] },
    { min: 0, name: '부딪히며 배우는 인연', text: '불꽃이 잘 튀는 사이요. 서로를 바꾸려 들면 상처가 남고, 다름을 인정하면 서로에게 가장 큰 공부가 되오.',
      alt: ['서로 반대편에서 온 냄새요. 부딪히는 만큼 배우는 사이이니, 이기려 들지 말고 들어 보시오.', '한쪽이 당기면 다른 쪽이 미는 사이요. 그 힘이 다툼이 되기도 하고 균형이 되기도 하니, 어느 쪽이 될지는 말투에 달렸소.'] }
  ];
  // 두 사람 일간의 결 — 다섯 오행끼리 25가지 (A가 B에게 어떤 기운인지)
  const STEM_IMAGE = { '갑': '큰 나무', '을': '담쟁이', '병': '태양', '정': '촛불', '무': '큰 산', '기': '기름진 땅', '경': '무쇠', '신': '보석', '임': '큰물', '계': '안개비' };
  const PAIR_LINE = {
    wood: { wood: '같은 숲에서 자란 두 나무요. 나란히 서면 바람을 함께 막지만, 햇빛을 두고 다투면 둘 다 가늘어지오.', fire: '나무가 불을 키우오. 한쪽이 내어 주고 한쪽이 타오르는 사이라, 내어 주는 쪽이 지치지 않게 살피시오.', earth: '나무가 땅에 뿌리를 내리오. 뿌리 내리는 쪽은 편하고 땅은 무거우니, 무게를 나누어 지시오.', metal: '쇠가 나무를 다듬소. 깎이는 쪽은 아프지만 그래서 기둥이 되오. 깎는 손이 너무 세지 않게 하시오.', water: '물이 나무를 키우오. 받는 쪽은 자라고 주는 쪽은 줄어드니, 고마움을 말로 돌려주시오.' },
    fire: { wood: '불이 나무를 태워 빛을 내오. 타오르는 쪽은 환하지만 땔감이 되는 쪽을 아껴야 오래 타오.', fire: '두 개의 불이오. 같이 있으면 눈부시게 밝고, 같이 있으면 쉽게 타 버리오. 식히는 시간을 따로 두시오.', earth: '불이 땅을 데우오. 데워진 땅은 무엇이든 키우니, 둘이 함께 벌이는 일이 잘 자라오.', metal: '불이 쇠를 녹여 모양을 만드오. 녹는 쪽은 아프고 달구는 쪽은 급하니, 식힐 때를 알아야 하오.', water: '물이 불을 끄오. 서로를 식히기도 하고 꺼뜨리기도 하는 사이라, 뜨거울 때 물을 붓지 마시오.' },
    earth: { wood: '땅이 나무를 받치오. 받치는 쪽은 묵묵하고 자라는 쪽은 눈에 띄니, 받치는 수고를 알아주시오.', fire: '땅이 불을 품소. 불은 땅을 데우고 땅은 불을 가두니, 서로 적당히 식히고 데우는 사이요.', earth: '두 개의 산이오. 둘 다 잘 움직이지 않아 다툼은 적지만, 먼저 다가가는 법도 둘 다 모르오.', metal: '땅이 쇠를 낳소. 품은 쪽은 내어 주고 나온 쪽은 빛나니, 빛나는 쪽이 고개를 돌려 보시오.', water: '땅이 물길을 막기도 하고 내기도 하오. 막으면 다투고 내면 함께 흐르니, 길을 터 주는 쪽이 이기오.' },
    metal: { wood: '쇠가 나무를 베오. 자르는 쪽은 시원하고 잘리는 쪽은 아프니, 잘라 낼 것과 둘 것을 먼저 합의하시오.', fire: '불이 쇠를 단련하오. 달궈지는 쪽은 괴롭지만 그래서 칼이 되오. 둘이 겪는 뜨거움이 헛되지 않소.', earth: '땅이 쇠를 품어 낳소. 받는 쪽은 자라고 품는 쪽은 비우니, 비운 자리를 채워 주시오.', metal: '두 자루의 칼이오. 날이 맞으면 든든하고 날이 어긋나면 서로 베니, 말을 벼리되 겨누지 마시오.', water: '쇠가 물을 낳소. 맑은 물은 쇠에서 나오니, 내어 주는 쪽은 말이 적고 받는 쪽은 깊어지오.' },
    water: { wood: '물이 나무를 키우오. 키우는 쪽은 줄고 자라는 쪽은 크니, 자란 만큼 그늘을 돌려주시오.', fire: '물이 불을 누르오. 식혀 주면 고맙고 꺼 버리면 원망이니, 끼얹지 말고 적시시오.', earth: '땅이 물을 가두오. 가두면 고이고 터 주면 흐르니, 둘 사이에 물길 하나는 늘 열어 두시오.', metal: '쇠가 물을 낳소. 받는 쪽은 맑아지고 주는 쪽은 닳으니, 닳는 줄 모르는 쪽을 살피시오.', water: '두 줄기 물이오. 만나면 한 강이 되지만 어디로 흐를지는 둘 다 모르니, 방향은 함께 정하시오.' }
  };

  function compatPartText(part, A, B, seed) {
    const nm = who => (who === 'A' ? A : B);
    const el = k => EL_NAME[k];   // '나무·불 기운'처럼 쉬운 이름으로
    const alt = ((seed >>> 0) + part.key.length) % 2 === 1;   // 짝마다 두 갈래를 번갈아 (같은 합·충이라도 문장이 다르게, 2026-10-25)
    switch (part.key) {
      case 'stemHap': return alt ? `두 사람의 타고난 기운이 <strong>서로 끌어당기는 짝(천간합)</strong>으로 묶여 있소. 이유 없이 자꾸 눈이 가고 마음이 쓰였다면 그게 이 합의 냄새요.`
        : `두 사람의 타고난 기운이 <strong>서로 끌어당기는 짝(천간합)</strong>이오. 처음 만난 날부터 서로를 끌어당기는 냄새가 났을 것이오.`;
      case 'stemSame': return alt ? `두 사람 다 <strong>${el(part.detail.el)} 기운</strong> 사람이오. 같은 결이라 편한데, 같은 결이라 양보도 잘 안 되오. 먼저 물러서는 쪽이 이기오.`
        : `두 사람의 타고난 기운이 같은 <strong>${el(part.detail.el)} 기운</strong>이오. 말하지 않아도 통하지만, 고집이 부딪히면 둘 다 물러서지 않소.`;
      case 'stemGenerate': {
        const g = part.detail.giver === 'A' ? A : B, r = part.detail.giver === 'A' ? B : A;
        return alt ? `<strong>${esc(subj(g))}</strong> 기운을 보태고 <strong>${esc(subj(r))}</strong> 그 기운으로 자라는 <strong>키우고 자라는 사이(상생)</strong>요. 주는 쪽이 비는 줄 모르고 주니, 받는 쪽이 채워 주시오.`
          : `<strong>${esc(subj(g))}</strong> 주고 <strong>${esc(subj(r))}</strong> 받는 <strong>흐름(상생)</strong>이오. 받는 쪽이 고마움을 말로 꺼내야 오래 가오.`;
      }
      case 'stemControl': {
        const c = nm(part.detail.controller);
        return alt ? `<strong>${esc(c)}</strong> 쪽이 판을 쥐는 <strong>누르는 사이(상극)</strong>요. 끌림이 세서 시작은 빠르지만, 눌리는 쪽이 말을 잃기 시작하면 멈춰 서서 들으시오.`
          : `<strong>${esc(c)}</strong>의 기운이 상대를 누르는 <strong>사이(상극)</strong>요. 끌림은 강하지만, 한쪽이 숨 막혀 하지 않는지 살펴야 하오.`;
      }
      case 'dayYukhap': return alt ? `태어난 날의 글자(생활 자리)가 <strong>손을 잡는 사이(육합)</strong>로 맞물리오. 같이 사는 자리, 같이 먹는 밥상에서 편해지는 사이요.`
        : `배우자 자리인 태어난 날의 글자끼리 <strong>손을 잡는 사이(육합)</strong>요. 한 지붕 아래 살면 더 편안해지는 궁합이오.`;
      case 'daySamhap': return alt ? `태어난 날의 글자가 <strong>한 패(삼합)</strong>요. 같은 일을 꾸밀 때 손발이 맞고, 셋째 사람이 끼면 더 커지는 사이요.`
        : `태어난 날의 글자가 <strong>한 패(삼합)</strong>로 이어지오. 같은 목표를 함께 좇을 때 힘이 몇 배가 되오.`;
      case 'dayChung': return alt ? `태어난 날의 글자가 <strong>정면으로 부딪히는 사이(충)</strong>요. 사소한 버릇이 유난히 거슬리는 사이라, 거슬리는 것을 고치려 말고 피할 자리를 만드시오.`
        : `태어난 날의 글자가 <strong>정면으로(충)</strong> 부딪히오. 생활 습관과 말투에서 불꽃이 튀니, 다툼은 그날을 넘기지 마시오.`;
      case 'yearYukhap': return alt ? `띠가 <strong>손을 잡는 사이(육합)</strong>요. 양쪽 집안 어른들이 먼저 알아보고 반기는 인연이오.`
        : `띠끼리 <strong>손을 잡는 사이(육합)</strong>요. 서로의 집안과 주변 사람들도 이 인연을 반기오.`;
      case 'yearSamhap': return alt ? `띠가 <strong>한 패(삼합)</strong>요. 서로의 친구가 친구가 되는 사이라, 모임 자리가 편하오.`
        : `띠끼리 <strong>한 패(삼합)</strong>요. 함께 어울리는 무리가 자연스럽게 겹치오.`;
      case 'yearChung': return alt ? `띠가 <strong>정면으로 부딪히는 사이(충)</strong>요. 둘 사이는 괜찮아도 집안·친구 일로 틀어지기 쉬우니, 바깥일은 바깥에 두시오.`
        : `띠가 <strong>정면으로(충)</strong> 맞서오. 서로의 가족·친구와는 거리를 적당히 두는 게 좋소.`;
      case 'fillA': return alt ? `<strong>${esc(A)}</strong>에게 비어 있는 <strong>${part.detail.els.map(el).join('·')}</strong> 기운이 상대에겐 넉넉하오. 이 사람 곁에서 유난히 마음이 놓였다면 그 때문이오.`
        : `<strong>${esc(A)}</strong>에게 모자란 <strong>${part.detail.els.map(el).join('·')}</strong> 기운을 상대가 넉넉히 품고 있소. 곁에 있기만 해도 기운이 채워지오.`;
      case 'fillB': {
        const who = A === '나' ? '그대가' : `<strong>${esc(subj(A))}</strong>`;   // 이름을 적었으면 이름으로
        return alt ? `<strong>${esc(B)}</strong>에게 비어 있는 <strong>${part.detail.els.map(el).join('·')}</strong> 기운이 ${who} 넉넉히 가진 것이오. 상대가 그대 곁에서 편해지는 이유가 여기 있소.`
          : `<strong>${esc(B)}</strong>에게 모자란 <strong>${part.detail.els.map(el).join('·')}</strong> 기운을 ${who} 넉넉히 품고 있소. ${who} 상대의 빈자리를 메워 주는 사람이오.`;
      }
      default: return '';
    }
  }

  function renderCompat() {
    const me = loadProfile();
    const form = $('compatForm');
    // 친구가 보낸 링크로 들어왔으면 벽사견 한 줄 (업데이트 38). 별명은 보낸 사람이 선택으로 넣은 것만, 글자 종류·길이를 app.js에서 걸러 온다
    const from = window.__compatInviteFrom;
    // 별명이 한글로 끝나면 '민지가'처럼 조사를 붙이고, 영문·숫자로 끝나면 조사가 틀릴 수 있어 조사 없는 문장으로
    const fromSubj = !from ? '' : /[가-힣]$/.test(from) ? `<strong>${esc(from)}</strong>${josa(from, '이')}` : `<strong>${esc(from)}</strong>, 이 사람이`;
    const inviteLine = from === undefined ? '' : (from
      ? `<p class="compat-invite">${fromSubj} 그대와 궁합을 보고 싶다는구려. 위에는 그대 생일, 아래에는 ${esc(from)}의 생일을 넣어 보시오.</p>`
      : `<p class="compat-invite">누군가 그대와 궁합을 보고 싶다는구려. 위에는 그대 생일, 아래에는 그 사람의 생일을 넣어 보시오.</p>`);
    form.innerHTML = `
      ${inviteLine}
      <h3 class="feature-card-title">나</h3>
      <input type="text" id="caName" maxlength="10" placeholder="내 이름 (선택, 저장하지 않음)" aria-label="내 이름">
      ${birthFieldsHtml('ca', me || {})}
      <h3 class="feature-card-title">상대</h3>
      <input type="text" id="cbName" maxlength="10" placeholder="부를 이름 (선택, 저장하지 않음)" aria-label="상대를 부를 이름" value="${esc(from || '')}">
      ${birthFieldsHtml('cb', {})}
      <p class="form-error" id="compatErr" role="alert"></p>
      <button class="btn-submit" id="compatGo">두 사람의 궁합 냄새 맡기</button>
      <p class="feature-note">상대의 생년월일은 저장하지 않소. 재미로 보는 전통 풀이요.</p>`;
    $('compatResult').innerHTML = '';
    $('compatGo').onclick = () => {
      const a = readBirthFields('ca'), b = readBirthFields('cb');
      if (a.error) { $('compatErr').textContent = '나: ' + a.error; return; }
      if (b.error) { $('compatErr').textContent = '상대: ' + b.error; return; }
      $('compatErr').textContent = '';
      saveProfile(a);
      const nameA = ($('caName').value || '').trim() || '나';
      const nameB = ($('cbName').value || '').trim() || '상대';
      showCompatResult(a, b, nameA, nameB === nameA ? nameB + '(상대)' : nameB);
    };
  }

  // 궁합 '상대에게 보내기' (업데이트 38): 공유 창(휴대폰은 카카오톡 등)을 열고, 안 되면 링크 복사. 링크에는 생일·이름이 없고, 내가 이름을 적었다면 그 별명만 선택으로 붙는다.
  const COMPAT_SHARE_TEXT = '너랑 나 궁합 공짜로 봐 준대. 생일만 넣어 봐';
  function compatShareUrl(nameA) {
    const nick = (nameA && nameA !== '나') ? nameA.trim().slice(0, 10) : '';
    if (nick && !NICK_RE.test(nick)) return siteHomeUrl() + '?compat=1';   // 받는 쪽이 못 읽는 글자(이모지 등)면 별명 없이
    return siteHomeUrl() + '?compat=1' + (nick ? '&n=' + encodeURIComponent(nick) : '');
  }
  function bindCompatShare(nameA) {
    const url = compatShareUrl(nameA);
    const sent = () => { if (window.track) window.track('compatsend'); };
    $('compatShare').onclick = async () => {
      sent();
      if (navigator.share) {
        try { await navigator.share({ title: '벽사신견 궁합', text: COMPAT_SHARE_TEXT, url }); return; }
        catch (e) { if (e && e.name === 'AbortError') return; /* 그 밖의 실패는 복사로 */ }
      }
      copyText(`${COMPAT_SHARE_TEXT}\n${url}`, '링크를 복사했소. 카카오톡이나 문자에 붙여 넣으시오.');
    };
    $('compatCopy').onclick = () => { sent(); copyText(`${COMPAT_SHARE_TEXT}\n${url}`, '링크를 복사했소. 카카오톡이나 문자에 붙여 넣으시오.'); };
    $('compatSms').href = 'sms:?&body=' + encodeURIComponent(`${COMPAT_SHARE_TEXT}\n${url}`);
    $('compatSms').onclick = sent;
  }

  function showCompatResult(a, b, nameA, nameB) {
    const A = readSaju(a), B = readSaju(b);
    const r = SajuCore.calculateCompatibility(A.pillars, B.pillars, A.oheng, B.oheng);
    const band = COMPAT_BANDS.find(x => r.score >= x.min);
    const seed = SajuCore.hashSeed(`${a.y}-${a.m}-${a.d}-${a.hour}|${b.y}-${b.m}-${b.d}-${b.hour}`) >>> 0;
    const bandText = seed % 3 === 0 ? band.text : band.alt[(seed >>> 2) % band.alt.length];
    const pairLine = `${esc(subj(nameA))} ${STEM_IMAGE[A.pillars.dStem.char]}(${A.pillars.dStem.hanja}), ${esc(subj(nameB))} ${STEM_IMAGE[B.pillars.dStem.char]}(${B.pillars.dStem.hanja}). ${PAIR_LINE[A.ps.dmEl][B.ps.dmEl]}`;
    const tile = (sj, nm) => `
      <div class="compat-person">
        <span class="compat-name">${esc(nm)}</span>
        <span class="compat-ilju">${esc(sj.iljuHanja)}</span>
        <span class="compat-ilju-ko">태어난 날 ${esc(sj.ilju)} · ${EL_NAME[sj.ps.dmEl]} 기운</span>
      </div>`;
    const parts = r.parts.length ? r.parts : [{ key: 'none', points: 0 }];
    const yearLine = parts.some(q => /^year/.test(q.key)) ? '' : '<li class="reason neutral">띠끼리는 서로 밀지도 당기지도 않소. 집안·친구 일은 둘이 하기 나름이오.</li>';   // 띠 이야기가 없으면 한 줄 (2026-11-03)
    const styleA = LOVE_STYLE[A.pillars.dStem.char] || '', styleB = LOVE_STYLE[B.pillars.dStem.char] || '';
    const lunarNotes = [[a, nameA], [b, nameB]].filter(([p]) => (p.lunar && p.lunar.y) || p.late)   // 음력·밤 자시로 넣은 사람은 어느 날로 보았는지 (업데이트 44)
      .map(([p, nm]) => `<p class="birth-note">${esc(nm)} — ${birthNoteText(p, p)}</p>`).join('');
    $('compatResult').innerHTML = `
      <div class="feature-card compat-card">
        <div class="compat-pair">${tile(A, nameA)}<span class="compat-knot" aria-hidden="true">結</span>${tile(B, nameB)}</div>
        ${lunarNotes}
        <div class="score-block">
          <span class="score-num">${r.score}</span><span class="score-unit">점</span>
          <span class="score-band">${band.name}</span>
        </div>
        <p class="feature-text">"${bandText}"</p>
        <h3 class="feature-card-title">벽사견이 맡은 냄새</h3>
        <ul class="reason-list">
          <li class="reason neutral">${pairLine}</li>
          ${parts.map(p => p.key === 'none'
            ? `<li class="reason neutral">${seed % 2 ? '두 사람의 기운이 서로를 당기지도 밀지도 않소. 정해진 것이 없는 사이라, 같이 쌓은 시간이 그대로 궁합이 되오.' : '두 사람의 기운이 크게 끌어당기지도 밀어내지도 않소. 함께 보낸 시간이 곧 궁합이 되는 사이요.'}</li>`
            : `<li class="reason ${p.points >= 0 ? 'plus' : 'minus'}">${compatPartText(p, nameA, nameB, seed)}</li>`).join('')}${yearLine}
        </ul>
        <h3 class="feature-card-title">두 사람이 사랑하는 방식</h3>
        <p class="feature-text"><strong>${esc(nameA)}</strong> — ${styleA}</p>
        <p class="feature-text"><strong>${esc(nameB)}</strong> — ${styleB}</p>
        <div class="compat-share">
          <button class="btn-submit" id="compatShare" type="button">상대에게 보내기</button>
          <p class="compat-share-sub">카카오톡이나 문자로 궁합 보는 문을 보내오. 링크에는 생일이 들어가지 않고, 내 이름을 적었다면 별명으로만 붙소.
            <a class="link-btn" id="compatSms" href="#">문자로 보내기</a> · <button class="link-btn" id="compatCopy" type="button">링크만 복사</button></p>
        </div>
        <p class="feature-note">궁합 점수는 전통 명리의 합·충·생극을 바탕으로 한 재미 풀이이며, 두 사람의 관계를 정해 주지 않소.</p>
      </div>`;
    bindCompatShare(nameA);
    if (window.track) window.track('compat');
    // 유료 '궁합 상세 리포트' 자리 (shop.js)
    if (window.BYEOKSA_SHOP) window.BYEOKSA_SHOP.afterCompat(a, b, nameA, nameB, A, B, r);
    $('compatResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ─────────────────────────────────────────────────────────────────────
  // ② 오늘의 운세
  // ─────────────────────────────────────────────────────────────────────
  const DAILY_TEXT = {
    '비견': { head: '오늘은 어깨를 나란히 할 사람이 곁에 서오. 혼자 끙끙대던 일을 나눌 기회요.', do: ['막힌 일은 동료에게 먼저 말을 걸어 푸시오', '운동이나 산책으로 몸을 데우시오'], avoid: ['내 몫을 지키려고 고집을 세우는 것'] },
    '겁재': { head: '오늘은 그대 몫을 노리는 손이 가까이 있소. 지갑과 말을 단단히 여미시오.', do: ['약속과 금액은 글로 남기시오', '해야 할 일 하나만 끝까지 붙드시오'], avoid: ['충동구매·돈 빌려주기', '남의 싸움에 끼어들기'] },
    '식신': { head: '오늘은 손끝에서 재주가 술술 풀리는 날이오. 즐기는 일이 곧 성과가 되오.', do: ['미뤄 둔 작업물을 하나 완성해 내보이시오', '맛있는 밥 한 끼로 기운을 채우시오'], avoid: ['과식과 늦잠'] },
    '상관': { head: '오늘은 말과 생각이 날카롭게 벼려지오. 좋은 생각은 많지만 말 한마디에 탈이 날 수 있소.', do: ['떠오른 생각은 적어 두고 하루 묵히시오', '창작·기획처럼 머리를 쓰는 일에 몰두하시오'], avoid: ['윗사람과 논쟁하기', '규칙을 가볍게 넘기기'] },
    '편재': { head: '오늘은 뜻밖의 돈 냄새가 스치오. 판은 크게 보되 손은 신중하게 움직이시오.', do: ['새로운 제안은 일단 들어 보시오', '흩어진 지출을 한 번 정리하시오'], avoid: ['한 방을 노리는 투자·내기'] },
    '정재': { head: '오늘은 차곡차곡 쌓이는 날이오. 작은 성실함이 정확히 보답받소.', do: ['미뤄 둔 정산·서류를 마무리하시오', '고정 지출을 하나 줄이시오'], avoid: ['남의 부탁으로 일정 망치기'] },
    '편관': { head: '오늘은 거센 바람이 몰아치오. 압박이 오지만 버티면 그대 이름이 서오.', do: ['가장 어려운 일을 오전에 먼저 해치우시오', '마감과 약속 시간을 다시 확인하시오'], avoid: ['무리한 일정·과속', '감정적인 맞대응'] },
    '정관': { head: '오늘은 자리와 체면이 바로 서는 날이오. 공식적인 일에서 인정을 받소.', do: ['보고·면접·발표처럼 드러나는 일에 나서시오', '단정한 차림으로 대문을 나서시오'], avoid: ['규칙을 어기는 지름길'] },
    '편인': { head: '오늘은 촉이 서늘하게 깨어나오. 남들이 못 보는 것을 보지만 생각이 많아지기 쉽소.', do: ['낯선 공부나 책 한 장을 펼치시오', '직감이 가리키는 쪽을 한 번 믿어 보시오'], avoid: ['생각만 하다 하루를 흘려보내기'] },
    '정인': { head: '오늘은 귀인의 손길이 닿는 날이오. 배우고 도움받는 일이 술술 풀리오.', do: ['도움이 필요하면 망설이지 말고 청하시오', '자격·공부 계획을 세우시오'], avoid: ['받기만 하고 고맙다는 말 빠뜨리기'] }
  };
  const DAILY_BANDS = [[85, '대길(大吉)'], [72, '길(吉)'], [58, '평(平)'], [45, '조심'], [0, '근신(謹愼)']];

  function renderDaily() {
    const body = $('dailyBody');
    withProfile(body, '오늘의 운세를 보려면 생년월일이 필요하오', p => {
      const sj = readSaju(p);
      const t = today();
      const f = SajuCore.calculateDailyFortune(sj.pillars, t.y, t.m, t.d);
      const txt = DAILY_TEXT[f.sipsin];
      const band = DAILY_BANDS.find(b => f.score >= b[0])[1];
      // 행운의 색·숫자·방위 (2026-10-27 대표님: "날마다 안 바뀌는 느낌"): 예전엔 원국의 모자란 오행으로만 골라 사람마다 늘 같은 값이었다.
      //   이제는 오늘 일진의 천간이 내 일간에 닿는 십신에 따라, 그 기운이 흘러갈 다음 자리(상생 순서)의 오행으로 고른다.
      //   비겁 날→식상(설기) · 식상 날→재성(식상생재) · 재성 날→관성(재생관) · 관성 날→인성(관인상생) · 인성 날→비겁(인생비겁)
      //   숫자는 그 오행의 두 수 중 오늘 천간의 음양(양→홀수, 음→짝수)으로, 색은 오늘 지지에 따라 돌아가며 고른다.
      const GEN = { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' };      // 내가 생하는 오행(식상)
      const CTRL = { wood: 'earth', fire: 'metal', earth: 'water', metal: 'wood', water: 'fire' };     // 내가 극하는 오행(재성)
      const flip = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k]));
      const GEN_BY = flip(GEN), CTRL_BY = flip(CTRL);                                                  // 나를 생하는(인성)·극하는(관성) 오행
      const me = sj.ps.dmEl;
      const luckyEl = ({ '비견': GEN[me], '겁재': GEN[me], '식신': CTRL[me], '상관': CTRL[me], '편재': CTRL_BY[me], '정재': CTRL_BY[me], '편관': GEN_BY[me], '정관': GEN_BY[me], '편인': me, '정인': me })[f.sipsin] || sj.ps.weakKey;
      const remedy = ELEMENT_REMEDIES[luckyEl];
      const nums = remedy.num.split(',').map(s => s.trim()), colors = remedy.color.split(',').map(s => s.trim());
      const luckyNum = nums[f.stemIdx % 2] || nums[0], luckyColor = colors[f.branchIdx % colors.length] || colors[0];
      const myBranch = BRANCHES[sj.pillars.dBranchIdx].char, todayBranch = f.dayBranch.char;
      let relation = '';
      if (f.relation.yukhap) relation = `오늘의 글자(${todayBranch})가 그대가 태어난 날의 글자(${myBranch})와 <strong>손을 잡는 사이(육합)</strong>요. 사람 사이의 일이 부드럽게 풀리오.`;
      else if (f.relation.samhap) relation = `오늘의 글자(${todayBranch})가 그대가 태어난 날의 글자(${myBranch})와 <strong>한 패(삼합)</strong>로 이어지오. 함께하는 일에 힘이 붙소.`;
      else if (f.relation.chung) relation = `오늘의 글자(${todayBranch})가 그대가 태어난 날의 글자(${myBranch})와 <strong>정면으로(충)</strong> 부딪히오. 이동과 결정은 한 박자 늦추시오.`;
      body.innerHTML = `
        ${profileLine(p, sj)}
        <div class="feature-card">
          <p class="daily-date">${t.y}년 ${t.m}월 ${t.d}일 · <strong>${f.dayStem.char}${f.dayBranch.char}(${f.dayStem.hanja}${f.dayBranch.hanja})일</strong></p>
          <div class="score-block">
            <span class="score-num">${f.score}</span><span class="score-unit">점</span>
            <span class="score-band">${band}</span>
          </div>
          <p class="feature-text">"${txt.head}"</p>
          <p class="feature-note">오늘의 기운이 그대에게 <strong>${sp(f.sipsin)}</strong>${josa(sp(f.sipsin), '으로')} 들어오오.</p>
          ${relation ? `<p class="feature-text relation-note">${relation}</p>` : ''}
          <div class="todo-grid">
            <div class="todo do"><h4>이렇게 하시오</h4><ul>${txt.do.map(x => `<li>${x}</li>`).join('')}</ul></div>
            <div class="todo avoid"><h4>이건 피하시오</h4><ul>${txt.avoid.map(x => `<li>${x}</li>`).join('')}</ul></div>
          </div>
          <div class="lucky-row">
            <div><span>행운의 색</span><strong>${luckyColor}</strong></div>
            <div><span>행운의 숫자</span><strong>${luckyNum}</strong></div>
            <div><span>좋은 방위</span><strong>${remedy.dir}</strong></div>
          </div>
          <p class="feature-note">행운의 색·숫자·방위는 오늘 들어온 <strong>${sp(f.sipsin)}</strong>이 막히지 않고 흘러가도록 <strong>${EL_NAME[luckyEl]} 기운</strong> 쪽으로 골랐소. 내일은 날의 기운이 바뀌니 색도 숫자도 바뀌오. 그대 사주에 늘 모자란 <strong>${EL_NAME[sj.ps.weakKey]} 기운</strong>은 리포트의 비방으로 채우시오.</p>
        </div>`;
      bindProfileLinks(body, renderDaily);
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // ③ 벽사 패 — 벽사신견 세계관으로 새로 지은 22장 (기존 타로 그림·이름을 쓰지 않음)
  // ─────────────────────────────────────────────────────────────────────
  const DECK = [
    { name: '대문', hanja: '門', key: '새 시작 · 문턱', up: '닫혀 있던 문이 열리오. 망설이던 첫걸음을 내디딜 때요. 문턱만 넘으면 길은 생각보다 넓소.', rev: '문 앞에서 너무 오래 서 있었소. 준비가 덜 됐다는 핑계로 기회를 흘려보내고 있지는 않은지 돌아보시오.' },
    { name: '벽사견', hanja: '犬', key: '충직 · 지킴', up: '그대 곁을 묵묵히 지키는 존재가 있소. 그 믿음에 기대도 좋고, 그대 또한 누군가의 벽사견이 되어 주시오.', rev: '지켜야 할 것과 놓아야 할 것을 헷갈리고 있소. 의리라는 이름으로 그대를 갉아먹는 관계는 없는지 맡아 보시오.' },
    { name: '부적', hanja: '符', key: '보호 · 액막이', up: '삿된 기운이 그대를 비껴가오. 지금 지키고 있는 원칙이 곧 그대의 부적이오.', rev: '방심한 틈으로 액이 스미오. 작은 경고를 무시하지 말고 몸과 돈의 빗장을 다시 걸으시오.' },
    { name: '등불', hanja: '燈', key: '희망 · 길잡이', up: '어둠 속에서 길을 비춰 줄 불빛이 켜지오. 먼저 손 내미는 사람의 말에 귀 기울이시오.', rev: '등불이 흔들리오. 남의 빛만 좇다 그대 길을 잃지 않도록, 스스로 불씨를 지키시오.' },
    { name: '달', hanja: '月', key: '직감 · 불안', up: '말로 설명 못 할 촉이 정확하오. 마음이 가리키는 쪽을 믿어 보시오.', rev: '밤마다 커지는 불안은 실체보다 그림자가 크오. 걱정을 종이에 적으면 절반은 사라지오.' },
    { name: '해', hanja: '日', key: '성취 · 드러남', up: '그동안의 노력이 환하게 드러나오. 숨지 말고 그대가 한 일을 당당히 내보이시오.', rev: '빛이 너무 강하면 눈이 멀어 버리오. 성과에 취해 주변을 살피지 못하고 있지는 않은지 돌아보시오.' },
    { name: '산', hanja: '山', key: '버팀 · 인내', up: '쉽게 무너지지 않는 힘이 그대 안에 있소. 지금은 오르는 중이니 숨을 고르며 한 걸음씩 가시오.', rev: '고집이 산처럼 굳었소. 버티는 것과 막혀 있는 것은 다르니, 길을 돌아가는 지혜도 필요하오.' },
    { name: '물', hanja: '水', key: '흐름 · 감정', up: '막혔던 감정이 흘러가며 마음이 맑아지오. 흐름에 몸을 맡기면 저절로 풀리는 일이 있소.', rev: '고인 물은 썩소. 말하지 못한 서운함이 쌓여 있다면 오늘은 꺼내 놓으시오.' },
    { name: '바람', hanja: '風', key: '변화 · 소식', up: '먼 데서 바람이 소식을 싣고 오오. 변화가 두렵더라도 창문을 열어 두시오.', rev: '바람에 휩쓸려 이리저리 흔들리고 있소. 남의 말보다 그대 중심부터 붙드시오.' },
    { name: '장독', hanja: '甕', key: '저장 · 재물', up: '묵힐수록 깊어지는 장맛처럼, 지금 모은 것이 훗날 큰 밑천이 되오. 꾸준히 채우시오.', rev: '장독에 금이 갔소. 새는 돈과 시간의 구멍부터 찾아 막으시오.' },
    { name: '쇠방울', hanja: '鈴', key: '경고 · 깨움', up: '방울이 울리오. 놓치고 있던 것을 일깨워 주는 신호가 오오. 귀를 열어 두시오.', rev: '경고를 듣고도 모른 척하고 있소. 같은 실수를 되풀이하기 전에 멈춰 서시오.' },
    { name: '짚신', hanja: '履', key: '여정 · 발걸음', up: '길을 나설 때요. 이동·여행·이직처럼 발을 옮기는 일에 좋은 기운이 붙소.', rev: '짚신 바닥이 닳았소. 쉬지 않고 달리기만 했다면 오늘은 발을 쉬게 하시오.' },
    { name: '매듭', hanja: '結', key: '인연 · 약속', up: '단단한 매듭이 지어지오. 약속과 계약, 새로운 인연이 오래 갈 기운이오.', rev: '엉킨 매듭은 당길수록 조이오. 억지로 풀려 하지 말고 한 발 물러서 실마리를 찾으시오.' },
    { name: '거울', hanja: '鏡', key: '성찰 · 진실', up: '거울 속 그대 모습을 똑바로 볼 때요. 스스로에게 솔직해지면 답이 보일 것이오.', rev: '거울이 흐리오. 남의 눈에 비친 모습만 신경 쓰다 진짜 그대를 잃고 있지는 않은지 보시오.' },
    { name: '칼', hanja: '劍', key: '결단 · 끊어냄', up: '끊어낼 것을 단칼에 베어낼 때요. 미련 없는 결단이 새 길을 여오.', rev: '칼끝이 그대를 향하오. 날 선 말이 결국 그대를 다치게 하니, 오늘은 칼을 칼집에 넣어 두시오.' },
    { name: '그물', hanja: '網', key: '얽매임 · 집착', up: '그물에 걸린 것을 알아차렸다면 반은 풀려난 것이오. 무엇이 그대를 붙잡는지 이름을 붙여 보시오.', rev: '스스로 친 그물에 갇혀 있소. 해야 한다는 생각을 하나만 내려놓아도 숨통이 트이오.' },
    { name: '까치', hanja: '鵲', key: '반가운 소식', up: '까치가 대문 위에서 울고 있소. 기다리던 연락이나 반가운 손님이 찾아오오.', rev: '좋은 소식이 조금 늦어지오. 조급해하지 말고 문을 열어 둔 채 기다리시오.' },
    { name: '여우', hanja: '狐', key: '속임수 · 경계', up: '영리함이 필요한 때요. 정면 돌파보다 꾀를 내어 돌아가는 길이 이기오.', rev: '달콤한 말 뒤에 꼬리가 보이고 있소. 너무 좋은 조건은 한 번 더 의심하시오.' },
    { name: '소나무', hanja: '松', key: '변치 않음 · 절개', up: '사계절 푸른 소나무처럼, 흔들림 없는 마음이 결국 인정받소.', rev: '변하지 않는 것과 변하지 못하는 것은 다르오. 낡은 방식을 고집하고 있지는 않은지 보시오.' },
    { name: '우물', hanja: '井', key: '근원 · 내면', up: '깊은 우물에서 맑은 물을 길어 올리오. 처음 마음과 뿌리로 돌아가면 힘이 솟소.', rev: '우물이 말랐소. 남에게 주기만 하다 바닥난 기운을 오늘은 그대를 위해 채우시오.' },
    { name: '아궁이', hanja: '竈', key: '집 · 생계', up: '아궁이에 불이 지펴지오. 집안과 생계가 따뜻해지고, 식구와 함께하는 일이 잘 풀리오.', rev: '아궁이 불이 꺼져 가오. 바깥일에 쫓겨 집과 가까운 사람을 소홀히 하고 있지는 않은지 보시오.' },
    { name: '별', hanja: '星', key: '소망 · 이끄심', up: '오래 품어 온 소망에 별빛이 닿소. 멀어 보여도 방향은 맞소. 꾸준히 걸어가시오.', rev: '별을 보느라 발밑을 못 보오. 큰 꿈일수록 오늘 할 작은 일부터 챙기시오.' }
  ];

  function personKey() {
    const p = loadProfile();
    if (p) return `${p.y}-${p.m}-${p.d}-${p.hour}`;
    try {
      let k = localStorage.getItem('byeoksa.anon.v1');
      if (!k) { k = Math.random().toString(36).slice(2); localStorage.setItem('byeoksa.anon.v1', k); }
      return k;
    } catch (e) { return 'guest'; }
  }

  function renderTarot() {
    const body = $('tarotBody');
    const t = today();
    const draw = SajuCore.drawDailyTarot(personKey(), t.y, t.m, t.d, DECK.length);
    const card = DECK[draw.index];
    const flippedKey = `byeoksa.tarot.${t.y}-${t.m}-${t.d}`;
    let already = false;
    try { already = localStorage.getItem(flippedKey) === String(draw.index); } catch (e) { /* 무시 */ }
    body.innerHTML = `
      <p class="feature-note tarot-date">${t.y}년 ${t.m}월 ${t.d}일의 패</p>
      <button class="tarot-card ${already ? 'is-flipped' : ''}" id="tarotCard" aria-label="패 뒤집기">
        <span class="tarot-inner">
          <span class="tarot-face tarot-back" aria-hidden="true"><span class="tarot-back-seal">辟邪</span></span>
          <span class="tarot-face tarot-front ${draw.reversed ? 'is-reversed' : ''}">
            <span class="tarot-hanja">${card.hanja}</span>
            <span class="tarot-name">${card.name}</span>
            <span class="tarot-key">${card.key}</span>
          </span>
        </span>
      </button>
      <p class="tarot-hint" id="tarotHint" ${already ? 'hidden' : ''}>패를 눌러 뒤집으시오</p>
      <div class="feature-card tarot-reading" id="tarotReading" ${already ? '' : 'hidden'}>
        <h3 class="feature-card-title">${card.name}(${card.hanja}) · ${draw.reversed ? '거꾸로 선 패' : '바로 선 패'}</h3>
        <p class="feature-text">"${draw.reversed ? card.rev : card.up}"</p>
        <p class="feature-note">벽사 패는 벽사신견 세계관으로 새로 지은 22장이오. 하루에 한 장, 같은 날엔 같은 패가 나오오.</p>
      </div>`;
    $('tarotCard').onclick = () => {
      $('tarotCard').classList.add('is-flipped');
      $('tarotHint').hidden = true;
      $('tarotReading').hidden = false;
      try { localStorage.setItem(flippedKey, String(draw.index)); } catch (e) { /* 무시 */ }
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // ④ 벽사견에게 묻기 (버튼식 대화 — 서버·AI 없이 사주로 답한다)
  // ─────────────────────────────────────────────────────────────────────
  const CAREER_BY_EL = {
    wood: '그대는 뻗어 나가며 키워 내는 기운이오. 교육·기획·콘텐츠처럼 무언가를 길러 내는 일에서 빛나오.',
    fire: '그대는 드러내고 밝히는 기운이오. 말·무대·브랜드·영업처럼 사람 앞에 서는 일에서 빛나오.',
    earth: '그대는 품고 다지는 기운이오. 운영·관리·중개·부동산처럼 판을 안정시키는 일에서 빛나오.',
    metal: '그대는 가르고 다듬는 기운이오. 분석·법·품질·개발처럼 정확함이 무기가 되는 일에서 빛나오.',
    water: '그대는 스며들고 흐르는 기운이오. 연구·상담·유통·글쓰기처럼 깊이와 흐름을 다루는 일에서 빛나오.'
  };
  const BODY_BY_WEAK = {
    wood: '목(木)이 모자라면 몸이 쉽게 굳고 근육과 눈이 쉬이 지치오. 아침 스트레칭과 푸른 채소를 가까이하시오.',
    fire: '화(火)가 모자라면 손발이 차고 기운이 쉽게 가라앉소. 햇볕을 쬐고 몸을 따뜻하게 데우시오.',
    earth: '토(土)가 모자라면 속이 예민해지고 끼니가 들쭉날쭉해지오. 제때 따뜻한 밥을 챙겨 먹으시오.',
    metal: '금(金)이 모자라면 숨이 얕아지고 피부와 목이 쉬이 건조해지오. 깊게 숨 쉬고 물을 자주 마시시오.',
    water: '수(水)가 모자라면 잠이 얕고 머리가 쉽게 달아오르오. 잠자리에 들기 전 화면을 멀리하시오.'
  };
  // 돈 질문 전용: 올해 천간이 어떤 자리로 들어오느냐에 따른 돈 이야기 (일 질문의 연도 문장과 겹치지 않게)
  const MONEY_YEAR = {
    bi: '올해는 돈을 나눠 가질 사람이 붙는 해라오. 공동 지출·더치페이·동업 이야기는 처음부터 몫을 글로 정해 두시오.',
    sik: '올해는 재주가 돈으로 바뀌는 해라오. 취미나 특기로 작은 부수입을 시험해 보기 좋소.',
    jae: '올해는 돈이 직접 들어오는 해라오. 들어온 만큼 바로 떼어 두는 통장 하나를 만드시오.',
    gwan: '올해는 책임과 함께 돈이 오는 해라오. 급여·직책이 오르는 만큼 체면 지출도 늘어나니 상한을 정해 두시오.',
    in: '올해는 돈보다 배움과 문서가 먼저 오는 해라오. 자격·계약에 쓰는 돈은 아끼지 말되, 충동적인 강의 결제는 삼가시오.'
  };
  const TOPICS = [
    { id: 'love', label: '💘 연애운이 궁금해' },
    { id: 'money', label: '💰 돈은 언제 모여?' },
    { id: 'work', label: '💼 나한테 맞는 일은?' },
    { id: 'body', label: '🌿 몸과 기운은 어때?' },
    { id: 'warn', label: '⚠️ 올해 조심할 건?' },
    { id: 'noble', label: '🤝 내 귀인은 누구야?' },
    { id: 'today', label: '🌙 오늘 한마디 해줘' },
    { id: 'me', label: '🔮 나는 어떤 사람이야?' }
  ];

  function answer(topic, p, sj) {
    const P = sj.pillars, ps = sj.ps;
    const nobles = NOBLE_PEOPLE[P.dStemIdx] || ['소띠(축)', '양띠(미)'];
    const yearSipsin = getSipsin(P.dStemIdx, ((NOW_Y - 4) % 10 + 10) % 10);
    const ruin = RUIN_LOVERS[ps.dmEl], soul = SOULMATE_SCENTS[ps.weakKey];
    switch (topic) {
      case 'love': {
        const group = SIPSIN_GROUP[yearSipsin];
        const loveYear = (p.gender === 'M' && group === 'jae') || (p.gender === 'F' && group === 'gwan');
        return `그대에게 가장 해로운 건 <strong>[${ruin.title}]</strong>${josa(ruin.title, '을')} 풍기는 자라오. ${ruin.trait}<br><br>`
          + `대신 <strong>[${soul.title}]</strong>${josa(soul.title, '을')} 풍기는 사람을 곁에 두시오. 띠로는 <strong>${nobles.join(', ')}</strong> 쪽에서 귀한 인연이 오오.`
          + (loveYear ? `<br><br>올해(${NOW_Y}년)는 그대에게 <strong>${sp(yearSipsin)}</strong>의 해라, 인연의 문이 활짝 열리는 시기요. 소개와 모임을 마다하지 마시오.` : '');
      }
      case 'money':
        // 쉬운 말 (업데이트 39, 검수 7번): '천간은 네게 정재로' → '기운은 네게 꾸준한 돈이 쌓이는 운(정재)으로'
        return `${wealthDiagnosis(ps, 'chat')}<br><br>올해(${NOW_Y}년)의 기운은 그대에게 <strong>${sp(yearSipsin)}</strong>${josa(sp(yearSipsin), '으로')} 들어오오. ${MONEY_YEAR[SIPSIN_GROUP[yearSipsin]]}`;
      case 'work':
        return `${CAREER_BY_EL[ps.dmEl]}<br><br>그리고 올해는 <strong>${sp(yearSipsin)}</strong>의 해라오. ${YEAR_SIPSIN_TEXT_10[yearSipsin]}`;
      case 'body':
        return `${BODY_BY_WEAK[ps.weakKey]}<br><br><strong>다만 이건 다섯 기운(오행)으로 보는 재미 풀이일 뿐이오. 아픈 곳이 있으면 내 말 말고 의원(병원)부터 찾으시오.</strong>`;
      case 'warn': {
        const yb = ((NOW_Y - 4) % 12 + 12) % 12;
        const chung = (yb - P.dBranchIdx + 12) % 12 === 6;
        return (chung ? `올해 ${yearGanji(NOW_Y)}년의 띠 글자가 그대가 태어난 날의 글자와 <strong>정면으로(충)</strong> 부딪히오. 이사·이직·관계의 큰 변동은 서두르지 말고 두 번 따지시오.<br><br>` : '')
          + `그리고 그대 같은 ${EL_NAME[ps.dmEl]} 기운 사람에게 유독 들러붙는 이런 자를 조심하시오: ${ENEMY_TYPES[ps.dmEl][1]}`;
      }
      case 'noble':
        return `그대에게 하늘이 보낸 귀인(천을귀인)은 <strong>${nobles.join(', ')}</strong>${copula(nobles[nobles.length - 1])}. 이 띠의 사람이 막힌 길을 열어 주는 경우가 많소.<br><br>`
          + `냄새로 말하자면 <strong>[${soul.title}]</strong>${josa(soul.title, '을')} 풍기는 사람이오. ${soul.scent}`;
      case 'today': {
        const t = today();
        const f = SajuCore.calculateDailyFortune(P, t.y, t.m, t.d);
        return `오늘은 <strong>${f.dayStem.char}${f.dayBranch.char}일</strong>, 그대에게 <strong>${sp(f.sipsin)}</strong>의 날이오. ${DAILY_TEXT[f.sipsin].head}<br><br>오늘 점수는 <strong>${f.score}점</strong>이오. 자세한 건 대문 앞 '오늘의 운세' 쪽지를 떼어 보시오.`;
      }
      case 'me': {
        const reading = getDynamicColdReading(P.dStem, P.dBranch, '천명');
        return `그대는 태어난 날이 <strong>${sj.ilju}</strong>인 사람, ${P.dStem.trait} 기운을 타고났소.<br><br>${stripTags(reading.innerSoul)}`;   // '○○일주' 대신 쉬운 말 (업데이트 39)
      }
      default: return '무슨 말인지 냄새가 안 잡히오. 다른 걸 물어보시오.';
    }
  }

  function renderChat() {
    const body = $('chatBody');
    withProfile(body, '벽사견이 답하려면 그대 생년월일 냄새가 필요하오', p => {
      const sj = readSaju(p);
      body.innerHTML = `
        ${profileLine(p, sj)}
        <div class="chat-log" id="chatLog" aria-live="polite"></div>
        <div class="chat-chips" id="chatChips"></div>
        <p class="feature-note">벽사견의 답은 그대 사주로 지어낸 오락 풀이요. 건강·돈·법처럼 중요한 결정은 전문가와 상의하시오.</p>`;
      bindProfileLinks(body, renderChat);
      const log = $('chatLog'), chips = $('chatChips');
      const say = (who, html) => {
        const b = document.createElement('div');
        b.className = `chat-msg ${who}`;
        b.innerHTML = who === 'dog'
          ? `<img class="chat-avatar" src="mung.jpg" alt=""><div class="chat-bubble">${html}</div>`
          : `<div class="chat-bubble">${html}</div>`;
        log.appendChild(b);
        b.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      };
      const asked = new Set();
      const drawChips = () => {
        chips.innerHTML = TOPICS.map(t => `<button class="chat-chip ${asked.has(t.id) ? 'is-asked' : ''}" data-topic="${t.id}">${t.label}</button>`).join('');
        chips.querySelectorAll('.chat-chip').forEach(btn => {
          btn.onclick = () => {
            const topic = btn.dataset.topic;
            const label = TOPICS.find(t => t.id === topic).label;
            asked.add(topic);
            chips.querySelectorAll('button').forEach(x => { x.disabled = true; });
            say('me', esc(label));
            const typing = document.createElement('div');
            typing.className = 'chat-msg dog typing';
            typing.innerHTML = '<img class="chat-avatar" src="mung.jpg" alt=""><div class="chat-bubble"><span></span><span></span><span></span></div>';
            log.appendChild(typing);
            setTimeout(() => { typing.remove(); say('dog', answer(topic, p, sj)); drawChips(); }, 650);
          };
        });
      };
      say('dog', `태어난 날이 <strong>${sj.ilju}</strong>인 사람이로구려. 그대 냄새는 기억해 두었소. 궁금한 걸 골라 물어보시오.`);   // 원래: '○○일주로구나' (업데이트 39, 검수 7번)
      drawChips();
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // ⑤ 결과 공유 카드 (인스타그램 스토리 1080×1920)
  // ─────────────────────────────────────────────────────────────────────
  function loadImage(src) {
    return new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
  }

  function wrapLines(ctx, text, maxWidth) {
    const lines = []; let line = '';
    for (const ch of text) {
      if (ctx.measureText(line + ch).width > maxWidth && line) { lines.push(line); line = ch; } else line += ch;
    }
    if (line) lines.push(line);
    return lines;
  }

  async function downloadShareCard() {
    if (typeof currentSajuData === 'undefined' || !currentSajuData) { showToast('사주를 먼저 봐야 공유 카드를 만들 수 있소.'); return; }
    const S = currentSajuData;
    const ps = getPersona(S.dStemIdx, S.dBranchIdx, S.ohengResult);
    const yearSipsin = getSipsin(S.dStemIdx, ((NOW_Y - 4) % 10 + 10) % 10);
    const font = '"Song Myung", "Noto Serif KR", serif';
    const body = '"Gowun Batang", "Noto Serif KR", serif';
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
    const ctx = c.getContext('2d');
    try {
      try { await Promise.all([document.fonts.load(`80px ${font}`), document.fonts.load(`40px ${body}`)]); } catch (e) { /* 대체 글꼴 */ }
      const bg = ctx.createLinearGradient(0, 0, 0, 1920);
      bg.addColorStop(0, '#252840'); bg.addColorStop(1, '#14151F');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, 1080, 1920);
      const glow = ctx.createRadialGradient(540, 470, 40, 540, 470, 520);
      glow.addColorStop(0, 'rgba(227,179,65,0.28)'); glow.addColorStop(1, 'rgba(227,179,65,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, 1080, 1000);

      const dog = await loadImage('mung.jpg');
      ctx.save(); ctx.beginPath(); ctx.arc(540, 470, 230, 0, Math.PI * 2); ctx.clip();
      const sw = dog.width, sh = dog.height, side = Math.min(sw, sh);
      ctx.drawImage(dog, (sw - side) / 2, sh * 0.06, side, side, 310, 240, 460, 460);
      ctx.restore();
      ctx.strokeStyle = 'rgba(227,179,65,0.6)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(540, 470, 244, 0, Math.PI * 2); ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#E3B341'; ctx.font = `46px ${font}`;
      ctx.fillText('벽사신견이 맡은 나의 사주', 540, 170);
      ctx.fillStyle = '#F4EEE2'; ctx.font = `210px ${font}`;
      ctx.fillText(`${S.dStem.hanja}${S.dBranch.hanja}`, 540, 990);
      ctx.fillStyle = '#E3B341'; ctx.font = `54px ${font}`;
      ctx.fillText(`태어난 날 ${S.dStem.char}${S.dBranch.char}`, 540, 1080);   // 쉬운 말 (42)

      const title = (document.getElementById('animalTitle') || {}).textContent || '';
      ctx.fillStyle = '#F4EEE2'; ctx.font = `44px ${body}`;
      wrapLines(ctx, title, 860).slice(0, 3).forEach((l, i) => ctx.fillText(l, 540, 1190 + i * 64));

      const tags = [`타고난 기운 ${EL_NAME[ps.dmEl]}`, `모자란 기운 ${EL_NAME[ps.weakKey]}`, `${NOW_Y}년 ${SIPSIN_SHORT[yearSipsin] || yearSipsin}`];   // 쉬운 말 (42): 일간·십신 대신
      ctx.font = `36px ${body}`;
      let y = 1430;
      tags.forEach(tg => {
        const w = ctx.measureText(tg).width + 60;
        ctx.strokeStyle = 'rgba(227,179,65,0.55)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(540 - w / 2, y - 46, w, 66, 33) : ctx.rect(540 - w / 2, y - 46, w, 66); ctx.stroke();
        ctx.fillStyle = '#F4EEE2'; ctx.fillText(tg, 540, y);
        y += 92;
      });
      ctx.fillStyle = 'rgba(244,238,226,0.6)'; ctx.font = `32px ${body}`;
      ctx.fillText(location.host ? `${location.host}${location.pathname.replace(/index\.html$/, '')}` : '벽사신견 사주', 540, 1840);
    } catch (e) {
      showToast('공유 카드를 그리지 못했소. 잠시 뒤 다시 눌러 보시오.');
      return;
    }
    let blob = null;
    try { blob = await new Promise(res => c.toBlob(res, 'image/png')); } catch (e) { blob = null; }
    if (!blob) { showToast('이 브라우저에서는 저장이 막혔소. 화면을 캡처해 공유하시오.'); return; }
    const fileName = `벽사신견_${S.dStem.char}${S.dBranch.char}일주_공유카드.png`;
    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: '벽사신견 사주' }); return; } catch (e) { /* 취소 시 내려받기 */ }
    }
    const a = document.createElement('a'); a.download = fileName; a.href = URL.createObjectURL(blob); a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    showToast('📸 공유 카드를 저장했소. 스토리에 올려 보시오');
  }


  // ─────────────────────────────────────────────────────────────────────
  // 📮 고객센터: 문의 내용은 어디에도 저장하지 않고 손님 기기의 메일·문자 앱으로 넘긴다 (서버 없음)
  // ─────────────────────────────────────────────────────────────────────
  const HELP_EMAIL = 'pathlogue.help@gmail.com';
  const HELP_PHONE = '01025829143';
  const HELP_SUBJECT = '[벽사신견 문의]';

  function helpForm() {
    const reply = (document.querySelector('input[name="helpReply"]:checked') || {}).value || 'sms';
    return {
      type: $('helpType').value,
      order: $('helpOrder').value.trim(),
      reply,
      contact: $('helpContact').value.trim(),
      body: $('helpBody').value.trim(),
      agree: $('helpAgree').checked
    };
  }

  /** 입력 검사: 문제가 있으면 안내 문장, 없으면 '' */
  function helpCheck(f) {
    if (!f.contact) return f.reply === 'sms' ? '답변 받을 휴대폰 번호를 적어 주세요.' : '답변 받을 이메일 주소를 적어 주세요.';
    if (f.reply === 'sms' && !/^01[016789]\d{7,8}$/.test(f.contact.replace(/[\s-]/g, ''))) return '휴대폰 번호를 다시 확인해 주세요. (예: 010-1234-5678)';
    if (f.reply === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.contact)) return '이메일 주소를 다시 확인해 주세요. (예: name@gmail.com)';
    if (f.body.length < 5) return '문의 내용을 조금 더 적어 주세요.';
    if (!f.agree) return '연락처를 받는 데 동의해 주셔야 답을 드릴 수 있어요.';
    return '';
  }

  /** 메일·문자에 들어갈 글 */
  function helpMessage(f) {
    return [
      `문의 종류: ${f.type}`,
      `주문번호: ${f.order || '없음'}`,
      `답변 받을 방법: ${f.reply === 'sms' ? '문자' : '이메일'} (${f.contact})`,
      '',
      f.body
    ].join('\n');
  }

  function helpMailUrl(f) {
    return `mailto:${HELP_EMAIL}?subject=${encodeURIComponent(`${HELP_SUBJECT} ${f.type}`)}&body=${encodeURIComponent(helpMessage(f))}`;
  }
  function helpSmsUrl(f) {
    // ?&body= : 아이폰과 안드로이드 모두 본문이 채워지는 형식
    return `sms:${HELP_PHONE}?&body=${encodeURIComponent(`${HELP_SUBJECT}\n${helpMessage(f)}`)}`;
  }

  function renderHelp() {
    const err = $('helpErr');
    err.textContent = '';
    if ($('viewHelp').dataset.bound) return;
    $('viewHelp').dataset.bound = '1';
    const contact = $('helpContact');
    const syncReply = () => {
      const sms = helpForm().reply === 'sms';
      contact.type = sms ? 'tel' : 'email';
      contact.inputMode = sms ? 'tel' : 'email';
      contact.placeholder = sms ? '답변 받을 휴대폰 번호 (010-0000-0000)' : '답변 받을 이메일 주소 (name@gmail.com)';
    };
    document.querySelectorAll('input[name="helpReply"]').forEach(r => { r.onchange = () => { contact.value = ''; syncReply(); err.textContent = ''; }; });
    $('helpBody').oninput = () => { $('helpCount').textContent = `${$('helpBody').value.length} / 1000`; };
    const send = (makeUrl) => {
      const f = helpForm(); const problem = helpCheck(f);
      err.textContent = problem;
      if (problem) return;
      window.location.href = makeUrl(f);
    };
    $('helpMail').onclick = () => send(helpMailUrl);
    $('helpSms').onclick = () => send(helpSmsUrl);
    $('helpCopy').onclick = () => {
      const f = helpForm(); const problem = helpCheck(f);
      err.textContent = problem;
      if (problem) return;
      copyText(`${HELP_SUBJECT}\n${helpMessage(f)}`, `📋 문의 내용을 복사했다. ${HELP_EMAIL}로 보내 주거라.`);
    };
    syncReply();
  }

  // ─────────────────────────────────────────────────────────────────────
  // 진입점
  // ─────────────────────────────────────────────────────────────────────
  const FEATURES = {
    compat: { view: 'viewCompat', render: renderCompat },
    daily: { view: 'viewDaily', render: renderDaily },
    tarot: { view: 'viewTarot', render: renderTarot },
    chat: { view: 'viewChat', render: renderChat },
    help: { view: 'viewHelp', render: renderHelp }
  };

  function openFeature(name) {
    const f = FEATURES[name];
    if (!f) return;
    f.render();
    showView(f.view);
  }

  window.openFeature = openFeature;
  window.downloadShareCard = downloadShareCard;
  // 테스트용 내보내기 (화면 동작에는 쓰지 않음)
  window.BYEOKSA_HELP = { helpCheck, helpMessage, helpMailUrl, helpSmsUrl };
  window.BYEOKSA_EXTRAS = { DECK, DAILY_TEXT, TOPICS, answer, readSaju, COMPAT_BANDS,
    // 유료 상품(shop.js)이 함께 쓰는 도우미
    withProfile, profileLine, bindProfileLinks, showCompatResult, subj, copula, HOUR_NAMES,
    registerFeature: (name, view, render) => { FEATURES[name] = { view, render }; } };
})();

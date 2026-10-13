/**
 * 벽사신견 확장 기능: 인연 궁합 · 오늘의 운세 · 벽사 패 뽑기 · 백구에게 묻기 · 결과 공유 카드
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
  const copula = word => (josa(word, '이') === '이' ? '이다' : '다');
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
  function birthFieldsHtml(prefix, v) {
    v = v || {};
    const hourOpts = ['<option value="-1">시간 모름</option>']
      .concat(HOUR_NAMES.map((n, i) => `<option value="${i}" ${v.hour === i ? 'selected' : ''}>${n}</option>`)).join('');
    return `
      <div class="input-row">
        <input type="number" inputmode="numeric" id="${prefix}Y" placeholder="년 (1990)" value="${v.y || ''}" aria-label="태어난 해">
        <input type="number" inputmode="numeric" id="${prefix}M" placeholder="월" value="${v.m || ''}" aria-label="태어난 달">
        <input type="number" inputmode="numeric" id="${prefix}D" placeholder="일" value="${v.d || ''}" aria-label="태어난 날">
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
    if (!y || !m || !d) return { error: '생년월일을 온전히 적어 내거라.' };
    if (y < 1920 || y > 2030) return { error: '생년은 1920년부터 2030년 사이로 적거라.' };
    const t = new Date(Date.UTC(y, m - 1, d));
    if (t.getUTCFullYear() !== y || t.getUTCMonth() + 1 !== m || t.getUTCDate() !== d) return { error: '존재하지 않는 날짜다. 다시 확인하거라.' };
    return { y, m, d, hour: parseInt($(prefix + 'H').value, 10), gender: $(prefix + 'G').value };
  }

  /** 저장된 내 생년월일이 없으면 짧은 입력 칸을 보여주고, 있으면 바로 진행 */
  function withProfile(container, title, onReady) {
    const p = loadProfile();
    if (p) { onReady(p); return; }
    container.innerHTML = `
      <div class="feature-card">
        <h3 class="feature-card-title">${esc(title)}</h3>
        <p class="feature-note">생년월일은 이 기기 브라우저에만 기억해 두고, 어디로도 보내지 않는다.</p>
        ${birthFieldsHtml('pf')}
        <p class="form-error" id="pfErr" role="alert"></p>
        <button class="btn-submit" id="pfGo">백구에게 생년월일 알려주기 🐾</button>
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
    return `<p class="profile-line">${p.y}. ${p.m}. ${p.d}.${hour} · ${esc(sj.ilju)}일주
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
      b.onclick = () => { forgetAll(); showToast('이 기기에 남은 생년월일과 패 기록을 지웠다.'); rerender(); };
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // ① 인연 궁합
  // ─────────────────────────────────────────────────────────────────────
  const COMPAT_BANDS = [
    { min: 88, name: '천생의 짝', text: '대문 앞에서 수많은 인연을 맡아 봤지만, 이렇게 서로의 냄새가 포개지는 짝은 드물다. 놓치면 두고두고 아쉬울 인연이다.' },
    { min: 75, name: '서로를 살리는 인연', text: '한쪽이 지칠 때 다른 쪽이 기운을 불어넣는 사이다. 지금처럼 서로의 편이 되어 주면 해가 갈수록 단단해진다.' },
    { min: 62, name: '맞춰 가며 단단해질 인연', text: '처음부터 꼭 맞는 사이는 아니다. 하지만 서로의 다른 점을 알아 가는 만큼 깊어지는, 공들일 가치가 있는 인연이다.' },
    { min: 50, name: '냄새가 엇갈리는 인연', text: '끌리는 데는 이유가 있지만, 같은 일에도 서로 다른 냄새를 맡는다. 말하지 않으면 모르는 사이이니 속마음을 꺼내 놓거라.' },
    { min: 0, name: '부딪히며 배우는 인연', text: '불꽃이 잘 튀는 사이다. 서로를 바꾸려 들면 상처가 남고, 다름을 인정하면 서로에게 가장 큰 공부가 된다.' }
  ];

  function compatPartText(part, A, B) {
    const nm = who => (who === 'A' ? A : B);
    const el = k => EL_KO[k];
    switch (part.key) {
      case 'stemHap': return `두 사람의 일간이 <strong>천간합(天干合)</strong>이다. 처음 만난 날부터 서로를 끌어당기는 냄새가 났을 게다.`;
      case 'stemSame': return `두 사람의 일간이 같은 <strong>${el(part.detail.el)}</strong> 기운이다. 말하지 않아도 통하지만, 고집이 부딪히면 둘 다 물러서지 않는다.`;
      case 'stemGenerate': {
        const g = part.detail.giver === 'A' ? A : B, r = part.detail.giver === 'A' ? B : A;
        return `<strong>${esc(subj(g))}</strong> 주고 <strong>${esc(subj(r))}</strong> 받는 <strong>상생(相生)</strong>의 흐름이다. 받는 쪽이 고마움을 말로 꺼내야 오래 간다.`;
      }
      case 'stemControl': {
        const c = nm(part.detail.controller);
        return `<strong>${esc(c)}</strong>의 기운이 상대를 누르는 <strong>상극(相剋)</strong>이다. 끌림은 강하지만, 한쪽이 숨 막혀 하지 않는지 살펴야 한다.`;
      }
      case 'dayYukhap': return `배우자 자리인 일지(日支)끼리 <strong>육합(六合)</strong>이다. 한 지붕 아래 살면 더 편안해지는 궁합이다.`;
      case 'daySamhap': return `일지가 <strong>삼합(三合)</strong>으로 이어진다. 같은 목표를 함께 좇을 때 힘이 몇 배가 된다.`;
      case 'dayChung': return `일지가 <strong>충(沖)</strong>으로 부딪힌다. 생활 습관과 말투에서 불꽃이 튀니, 다툼은 그날을 넘기지 마라.`;
      case 'yearYukhap': return `띠끼리 <strong>육합</strong>이다. 서로의 집안과 주변 사람들도 이 인연을 반긴다.`;
      case 'yearSamhap': return `띠끼리 <strong>삼합</strong>이다. 함께 어울리는 무리가 자연스럽게 겹친다.`;
      case 'yearChung': return `띠가 <strong>충</strong>으로 맞선다. 서로의 가족·친구와는 거리를 적당히 두는 게 좋다.`;
      case 'fillA': return `<strong>${esc(A)}</strong>에게 모자란 <strong>${part.detail.els.map(el).join('·')}</strong> 기운을 상대가 넉넉히 품고 있다. 곁에 있기만 해도 기운이 채워진다.`;
      case 'fillB': {
        const who = A === '나' ? '네가' : `<strong>${esc(subj(A))}</strong>`;   // 이름을 적었으면 이름으로
        return `<strong>${esc(B)}</strong>에게 모자란 <strong>${part.detail.els.map(el).join('·')}</strong> 기운을 ${who} 넉넉히 품고 있다. ${who} 상대의 빈자리를 메워 주는 사람이다.`;
      }
      default: return '';
    }
  }

  function renderCompat() {
    const me = loadProfile();
    const form = $('compatForm');
    form.innerHTML = `
      <h3 class="feature-card-title">나</h3>
      <input type="text" id="caName" maxlength="10" placeholder="내 이름 (선택, 저장하지 않음)" aria-label="내 이름">
      ${birthFieldsHtml('ca', me || {})}
      <h3 class="feature-card-title">상대</h3>
      <input type="text" id="cbName" maxlength="10" placeholder="부를 이름 (선택, 저장하지 않음)" aria-label="상대를 부를 이름">
      ${birthFieldsHtml('cb', {})}
      <p class="form-error" id="compatErr" role="alert"></p>
      <button class="btn-submit" id="compatGo">두 사람의 궁합 냄새 맡기 🐾</button>
      <p class="feature-note">상대의 생년월일은 저장하지 않는다. 재미로 보는 전통 풀이다.</p>`;
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

  function showCompatResult(a, b, nameA, nameB) {
    const A = readSaju(a), B = readSaju(b);
    const r = SajuCore.calculateCompatibility(A.pillars, B.pillars, A.oheng, B.oheng);
    const band = COMPAT_BANDS.find(x => r.score >= x.min);
    const tile = (sj, nm) => `
      <div class="compat-person">
        <span class="compat-name">${esc(nm)}</span>
        <span class="compat-ilju">${esc(sj.iljuHanja)}</span>
        <span class="compat-ilju-ko">${esc(sj.ilju)}일주 · ${EL_KO[sj.ps.dmEl]}</span>
      </div>`;
    const parts = r.parts.length ? r.parts : [{ key: 'none', points: 0 }];
    $('compatResult').innerHTML = `
      <div class="feature-card compat-card">
        <div class="compat-pair">${tile(A, nameA)}<span class="compat-knot" aria-hidden="true">結</span>${tile(B, nameB)}</div>
        <div class="score-block">
          <span class="score-num">${r.score}</span><span class="score-unit">점</span>
          <span class="score-band">${band.name}</span>
        </div>
        <p class="feature-text">"${band.text}"</p>
        <h3 class="feature-card-title">백구가 맡은 냄새</h3>
        <ul class="reason-list">
          ${parts.map(p => p.key === 'none'
            ? `<li class="reason neutral">두 사람의 기운이 크게 끌어당기지도 밀어내지도 않는다. 함께 보낸 시간이 곧 궁합이 되는 사이다.</li>`
            : `<li class="reason ${p.points >= 0 ? 'plus' : 'minus'}">${compatPartText(p, nameA, nameB)}</li>`).join('')}
        </ul>
        <p class="feature-note">궁합 점수는 전통 명리의 합·충·생극을 바탕으로 한 재미 풀이이며, 두 사람의 관계를 정해 주지 않는다.</p>
      </div>`;
    // 유료 '궁합 상세 리포트' 자리 (shop.js)
    if (window.BYEOKSA_SHOP) window.BYEOKSA_SHOP.afterCompat(a, b, nameA, nameB, A, B, r);
    $('compatResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ─────────────────────────────────────────────────────────────────────
  // ② 오늘의 운세
  // ─────────────────────────────────────────────────────────────────────
  const DAILY_TEXT = {
    '비견': { head: '오늘은 어깨를 나란히 할 사람이 곁에 선다. 혼자 끙끙대던 일을 나눌 기회다.', do: ['막힌 일은 동료에게 먼저 말을 걸어 풀어라', '운동이나 산책으로 몸을 데워라'], avoid: ['내 몫을 지키려고 고집을 세우는 것'] },
    '겁재': { head: '오늘은 네 몫을 노리는 손이 가까이 있다. 지갑과 말을 단단히 여며라.', do: ['약속과 금액은 글로 남겨라', '해야 할 일 하나만 끝까지 붙들어라'], avoid: ['충동구매·돈 빌려주기', '남의 싸움에 끼어들기'] },
    '식신': { head: '오늘은 손끝에서 재주가 술술 풀리는 날이다. 즐기는 일이 곧 성과가 된다.', do: ['미뤄 둔 작업물을 하나 완성해 내보여라', '맛있는 밥 한 끼로 기운을 채워라'], avoid: ['과식과 늦잠'] },
    '상관': { head: '오늘은 말과 생각이 날카롭게 벼려진다. 좋은 생각은 많지만 말 한마디에 탈이 날 수 있다.', do: ['떠오른 생각은 적어 두고 하루 묵혀라', '창작·기획처럼 머리를 쓰는 일에 몰두하라'], avoid: ['윗사람과 논쟁하기', '규칙을 가볍게 넘기기'] },
    '편재': { head: '오늘은 뜻밖의 돈 냄새가 스친다. 판은 크게 보되 손은 신중하게 움직여라.', do: ['새로운 제안은 일단 들어 보거라', '흩어진 지출을 한 번 정리하라'], avoid: ['한 방을 노리는 투자·내기'] },
    '정재': { head: '오늘은 차곡차곡 쌓이는 날이다. 작은 성실함이 정확히 보답받는다.', do: ['미뤄 둔 정산·서류를 마무리하라', '고정 지출을 하나 줄여라'], avoid: ['남의 부탁으로 일정 망치기'] },
    '편관': { head: '오늘은 거센 바람이 몰아친다. 압박이 오지만 버티면 네 이름이 선다.', do: ['가장 어려운 일을 오전에 먼저 해치워라', '마감과 약속 시간을 다시 확인하라'], avoid: ['무리한 일정·과속', '감정적인 맞대응'] },
    '정관': { head: '오늘은 자리와 체면이 바로 서는 날이다. 공식적인 일에서 인정을 받는다.', do: ['보고·면접·발표처럼 드러나는 일에 나서라', '단정한 차림으로 대문을 나서라'], avoid: ['규칙을 어기는 지름길'] },
    '편인': { head: '오늘은 촉이 서늘하게 깨어난다. 남들이 못 보는 것을 보지만 생각이 많아지기 쉽다.', do: ['낯선 공부나 책 한 장을 펼쳐라', '직감이 가리키는 쪽을 한 번 믿어 보거라'], avoid: ['생각만 하다 하루를 흘려보내기'] },
    '정인': { head: '오늘은 귀인의 손길이 닿는 날이다. 배우고 도움받는 일이 술술 풀린다.', do: ['도움이 필요하면 망설이지 말고 청하라', '자격·공부 계획을 세워라'], avoid: ['받기만 하고 고맙다는 말 빠뜨리기'] }
  };
  const DAILY_BANDS = [[85, '대길(大吉)'], [72, '길(吉)'], [58, '평(平)'], [45, '조심'], [0, '근신(謹愼)']];

  function renderDaily() {
    const body = $('dailyBody');
    withProfile(body, '오늘의 운세를 보려면 생년월일이 필요하다', p => {
      const sj = readSaju(p);
      const t = today();
      const f = SajuCore.calculateDailyFortune(sj.pillars, t.y, t.m, t.d);
      const txt = DAILY_TEXT[f.sipsin];
      const band = DAILY_BANDS.find(b => f.score >= b[0])[1];
      const remedy = ELEMENT_REMEDIES[sj.ps.weakKey];
      const myBranch = BRANCHES[sj.pillars.dBranchIdx].char, todayBranch = f.dayBranch.char;
      let relation = '';
      if (f.relation.yukhap) relation = `오늘 일진의 지지(${todayBranch})가 네 일지(${myBranch})와 <strong>육합</strong>이다. 사람 사이의 일이 부드럽게 풀린다.`;
      else if (f.relation.samhap) relation = `오늘 일진의 지지(${todayBranch})가 네 일지(${myBranch})와 <strong>삼합</strong>으로 이어진다. 함께하는 일에 힘이 붙는다.`;
      else if (f.relation.chung) relation = `오늘 일진의 지지(${todayBranch})가 네 일지(${myBranch})와 <strong>충</strong>으로 부딪힌다. 이동과 결정은 한 박자 늦춰라.`;
      body.innerHTML = `
        ${profileLine(p, sj)}
        <div class="feature-card">
          <p class="daily-date">${t.y}년 ${t.m}월 ${t.d}일 · <strong>${f.dayStem.char}${f.dayBranch.char}(${f.dayStem.hanja}${f.dayBranch.hanja})일</strong></p>
          <div class="score-block">
            <span class="score-num">${f.score}</span><span class="score-unit">점</span>
            <span class="score-band">${band}</span>
          </div>
          <p class="feature-text">"${txt.head}"</p>
          <p class="feature-note">오늘 일진의 천간이 네 일간에 <strong>${f.sipsin}</strong>${josa(f.sipsin, '으로')} 들어온다.</p>
          ${relation ? `<p class="feature-text relation-note">${relation}</p>` : ''}
          <div class="todo-grid">
            <div class="todo do"><h4>이렇게 하거라</h4><ul>${txt.do.map(x => `<li>${x}</li>`).join('')}</ul></div>
            <div class="todo avoid"><h4>이건 피하거라</h4><ul>${txt.avoid.map(x => `<li>${x}</li>`).join('')}</ul></div>
          </div>
          <div class="lucky-row">
            <div><span>행운의 색</span><strong>${remedy.color.split(',')[0]}</strong></div>
            <div><span>행운의 숫자</span><strong>${remedy.num}</strong></div>
            <div><span>좋은 방위</span><strong>${remedy.dir}</strong></div>
          </div>
          <p class="feature-note">행운의 색·숫자·방위는 네 원국에 가장 모자란 <strong>${EL_KO[sj.ps.weakKey]}</strong> 기운을 채우는 쪽으로 골랐다. 내일은 또 다른 일진이 온다.</p>
        </div>`;
      bindProfileLinks(body, renderDaily);
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // ③ 벽사 패 — 벽사신견 세계관으로 새로 지은 22장 (기존 타로 그림·이름을 쓰지 않음)
  // ─────────────────────────────────────────────────────────────────────
  const DECK = [
    { name: '대문', hanja: '門', key: '새 시작 · 문턱', up: '닫혀 있던 문이 열린다. 망설이던 첫걸음을 내디딜 때다. 문턱만 넘으면 길은 생각보다 넓다.', rev: '문 앞에서 너무 오래 서 있었다. 준비가 덜 됐다는 핑계로 기회를 흘려보내고 있지는 않은지 돌아보거라.' },
    { name: '백구', hanja: '犬', key: '충직 · 지킴', up: '네 곁을 묵묵히 지키는 존재가 있다. 그 믿음에 기대도 좋고, 너 또한 누군가의 백구가 되어 주거라.', rev: '지켜야 할 것과 놓아야 할 것을 헷갈리고 있다. 의리라는 이름으로 너를 갉아먹는 관계는 없는지 맡아 보거라.' },
    { name: '부적', hanja: '符', key: '보호 · 액막이', up: '삿된 기운이 너를 비껴간다. 지금 지키고 있는 원칙이 곧 너의 부적이다.', rev: '방심한 틈으로 액이 스민다. 작은 경고를 무시하지 말고 몸과 돈의 빗장을 다시 걸어라.' },
    { name: '등불', hanja: '燈', key: '희망 · 길잡이', up: '어둠 속에서 길을 비춰 줄 불빛이 켜진다. 먼저 손 내미는 사람의 말에 귀 기울이거라.', rev: '등불이 흔들린다. 남의 빛만 좇다 네 길을 잃지 않도록, 스스로 불씨를 지켜라.' },
    { name: '달', hanja: '月', key: '직감 · 불안', up: '말로 설명 못 할 촉이 정확하다. 마음이 가리키는 쪽을 믿어 보거라.', rev: '밤마다 커지는 불안은 실체보다 그림자가 크다. 걱정을 종이에 적으면 절반은 사라진다.' },
    { name: '해', hanja: '日', key: '성취 · 드러남', up: '그동안의 노력이 환하게 드러난다. 숨지 말고 네가 한 일을 당당히 내보여라.', rev: '빛이 너무 강하면 눈이 먼다. 성과에 취해 주변을 살피지 못하고 있지는 않은지 돌아보거라.' },
    { name: '산', hanja: '山', key: '버팀 · 인내', up: '쉽게 무너지지 않는 힘이 네 안에 있다. 지금은 오르는 중이니 숨을 고르며 한 걸음씩 가라.', rev: '고집이 산처럼 굳었다. 버티는 것과 막혀 있는 것은 다르니, 길을 돌아가는 지혜도 필요하다.' },
    { name: '물', hanja: '水', key: '흐름 · 감정', up: '막혔던 감정이 흘러가며 마음이 맑아진다. 흐름에 몸을 맡기면 저절로 풀리는 일이 있다.', rev: '고인 물은 썩는다. 말하지 못한 서운함이 쌓여 있다면 오늘은 꺼내 놓거라.' },
    { name: '바람', hanja: '風', key: '변화 · 소식', up: '먼 데서 바람이 소식을 싣고 온다. 변화가 두렵더라도 창문을 열어 두거라.', rev: '바람에 휩쓸려 이리저리 흔들리고 있다. 남의 말보다 네 중심부터 붙들어라.' },
    { name: '장독', hanja: '甕', key: '저장 · 재물', up: '묵힐수록 깊어지는 장맛처럼, 지금 모은 것이 훗날 큰 밑천이 된다. 꾸준히 채워라.', rev: '장독에 금이 갔다. 새는 돈과 시간의 구멍부터 찾아 막거라.' },
    { name: '쇠방울', hanja: '鈴', key: '경고 · 깨움', up: '방울이 울린다. 놓치고 있던 것을 일깨워 주는 신호가 온다. 귀를 열어 두거라.', rev: '경고를 듣고도 모른 척하고 있다. 같은 실수를 되풀이하기 전에 멈춰 서거라.' },
    { name: '짚신', hanja: '履', key: '여정 · 발걸음', up: '길을 나설 때다. 이동·여행·이직처럼 발을 옮기는 일에 좋은 기운이 붙는다.', rev: '짚신 바닥이 닳았다. 쉬지 않고 달리기만 했다면 오늘은 발을 쉬게 하거라.' },
    { name: '매듭', hanja: '結', key: '인연 · 약속', up: '단단한 매듭이 지어진다. 약속과 계약, 새로운 인연이 오래 갈 기운이다.', rev: '엉킨 매듭은 당길수록 조인다. 억지로 풀려 하지 말고 한 발 물러서 실마리를 찾아라.' },
    { name: '거울', hanja: '鏡', key: '성찰 · 진실', up: '거울 속 네 모습을 똑바로 볼 때다. 스스로에게 솔직해지면 답이 보인다.', rev: '거울이 흐리다. 남의 눈에 비친 모습만 신경 쓰다 진짜 너를 잃고 있지는 않은지 보거라.' },
    { name: '칼', hanja: '劍', key: '결단 · 끊어냄', up: '끊어낼 것을 단칼에 베어낼 때다. 미련 없는 결단이 새 길을 연다.', rev: '칼끝이 너를 향한다. 날 선 말이 결국 너를 다치게 하니, 오늘은 칼을 칼집에 넣어 두거라.' },
    { name: '그물', hanja: '網', key: '얽매임 · 집착', up: '그물에 걸린 것을 알아차렸다면 반은 풀려난 것이다. 무엇이 너를 붙잡는지 이름을 붙여 보거라.', rev: '스스로 친 그물에 갇혀 있다. 해야 한다는 생각을 하나만 내려놓아도 숨통이 트인다.' },
    { name: '까치', hanja: '鵲', key: '반가운 소식', up: '까치가 대문 위에서 운다. 기다리던 연락이나 반가운 손님이 찾아온다.', rev: '좋은 소식이 조금 늦어진다. 조급해하지 말고 문을 열어 둔 채 기다리거라.' },
    { name: '여우', hanja: '狐', key: '속임수 · 경계', up: '영리함이 필요한 때다. 정면 돌파보다 꾀를 내어 돌아가는 길이 이긴다.', rev: '달콤한 말 뒤에 꼬리가 보인다. 너무 좋은 조건은 한 번 더 의심하거라.' },
    { name: '소나무', hanja: '松', key: '변치 않음 · 절개', up: '사계절 푸른 소나무처럼, 흔들림 없는 마음이 결국 인정받는다.', rev: '변하지 않는 것과 변하지 못하는 것은 다르다. 낡은 방식을 고집하고 있지는 않은지 보거라.' },
    { name: '우물', hanja: '井', key: '근원 · 내면', up: '깊은 우물에서 맑은 물을 길어 올린다. 처음 마음과 뿌리로 돌아가면 힘이 솟는다.', rev: '우물이 말랐다. 남에게 주기만 하다 바닥난 기운을 오늘은 너를 위해 채우거라.' },
    { name: '아궁이', hanja: '竈', key: '집 · 생계', up: '아궁이에 불이 지펴진다. 집안과 생계가 따뜻해지고, 식구와 함께하는 일이 잘 풀린다.', rev: '아궁이 불이 꺼져 간다. 바깥일에 쫓겨 집과 가까운 사람을 소홀히 하고 있지는 않은지 보거라.' },
    { name: '별', hanja: '星', key: '소망 · 이끄심', up: '오래 품어 온 소망에 별빛이 닿는다. 멀어 보여도 방향은 맞다. 꾸준히 걸어가거라.', rev: '별을 보느라 발밑을 못 본다. 큰 꿈일수록 오늘 할 작은 일부터 챙기거라.' }
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
      <p class="tarot-hint" id="tarotHint" ${already ? 'hidden' : ''}>패를 눌러 뒤집거라</p>
      <div class="feature-card tarot-reading" id="tarotReading" ${already ? '' : 'hidden'}>
        <h3 class="feature-card-title">${card.name}(${card.hanja}) · ${draw.reversed ? '거꾸로 선 패' : '바로 선 패'}</h3>
        <p class="feature-text">"${draw.reversed ? card.rev : card.up}"</p>
        <p class="feature-note">벽사 패는 벽사신견 세계관으로 새로 지은 22장이다. 하루에 한 장, 같은 날엔 같은 패가 나온다.</p>
      </div>`;
    $('tarotCard').onclick = () => {
      $('tarotCard').classList.add('is-flipped');
      $('tarotHint').hidden = true;
      $('tarotReading').hidden = false;
      try { localStorage.setItem(flippedKey, String(draw.index)); } catch (e) { /* 무시 */ }
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // ④ 백구에게 묻기 (버튼식 대화 — 서버·AI 없이 사주로 답한다)
  // ─────────────────────────────────────────────────────────────────────
  const CAREER_BY_EL = {
    wood: '너는 뻗어 나가며 키워 내는 기운이다. 교육·기획·콘텐츠처럼 무언가를 길러 내는 일에서 빛난다.',
    fire: '너는 드러내고 밝히는 기운이다. 말·무대·브랜드·영업처럼 사람 앞에 서는 일에서 빛난다.',
    earth: '너는 품고 다지는 기운이다. 운영·관리·중개·부동산처럼 판을 안정시키는 일에서 빛난다.',
    metal: '너는 가르고 다듬는 기운이다. 분석·법·품질·개발처럼 정확함이 무기가 되는 일에서 빛난다.',
    water: '너는 스며들고 흐르는 기운이다. 연구·상담·유통·글쓰기처럼 깊이와 흐름을 다루는 일에서 빛난다.'
  };
  const BODY_BY_WEAK = {
    wood: '목(木)이 모자라면 몸이 쉽게 굳고 근육과 눈이 쉬이 지친다. 아침 스트레칭과 푸른 채소를 가까이하거라.',
    fire: '화(火)가 모자라면 손발이 차고 기운이 쉽게 가라앉는다. 햇볕을 쬐고 몸을 따뜻하게 데워라.',
    earth: '토(土)가 모자라면 속이 예민해지고 끼니가 들쭉날쭉해진다. 제때 따뜻한 밥을 챙겨 먹거라.',
    metal: '금(金)이 모자라면 숨이 얕아지고 피부와 목이 쉬이 건조해진다. 깊게 숨 쉬고 물을 자주 마셔라.',
    water: '수(水)가 모자라면 잠이 얕고 머리가 쉽게 달아오른다. 잠자리에 들기 전 화면을 멀리하거라.'
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
        return `네게 가장 해로운 건 <strong>[${ruin.title}]</strong>${josa(ruin.title, '을')} 풍기는 자다. ${ruin.trait}<br><br>`
          + `대신 <strong>[${soul.title}]</strong>${josa(soul.title, '을')} 풍기는 사람을 곁에 두거라. 띠로는 <strong>${nobles.join(', ')}</strong> 쪽에서 귀한 인연이 온다.`
          + (loveYear ? `<br><br>올해(${NOW_Y}년)는 네게 <strong>${yearSipsin}</strong>의 해라, 인연의 문이 활짝 열리는 시기다. 소개와 모임을 마다하지 마라.` : '');
      }
      case 'money':
        return `${wealthDiagnosis(ps)}<br><br>올해(${NOW_Y}년) 천간은 네게 <strong>${yearSipsin}</strong>${josa(yearSipsin, '으로')} 들어온다. ${YEAR_SIPSIN_TEXT_10[yearSipsin]}`;
      case 'work':
        return `${CAREER_BY_EL[ps.dmEl]}<br><br>그리고 올해는 <strong>${yearSipsin}</strong>의 해다. ${YEAR_SIPSIN_TEXT_10[yearSipsin]}`;
      case 'body':
        return `${BODY_BY_WEAK[ps.weakKey]}<br><br><strong>다만 이건 오행으로 보는 재미 풀이일 뿐이다. 아픈 곳이 있으면 내 말 말고 의원(병원)부터 찾거라.</strong>`;
      case 'warn': {
        const yb = ((NOW_Y - 4) % 12 + 12) % 12;
        const chung = (yb - P.dBranchIdx + 12) % 12 === 6;
        return (chung ? `올해 ${yearGanji(NOW_Y)}년의 지지가 네 일지와 <strong>충(沖)</strong>으로 부딪힌다. 이사·이직·관계의 큰 변동은 서두르지 말고 두 번 따져라.<br><br>` : '')
          + `그리고 네 ${EL_KO[ps.dmEl]} 일간에 유독 들러붙는 이런 자를 조심하거라: ${ENEMY_TYPES[ps.dmEl][1]}`;
      }
      case 'noble':
        return `네 천을귀인은 <strong>${nobles.join(', ')}</strong>${copula(nobles[nobles.length - 1])}. 이 띠의 사람이 막힌 길을 열어 주는 경우가 많다.<br><br>`
          + `냄새로 말하자면 <strong>[${soul.title}]</strong>${josa(soul.title, '을')} 풍기는 사람이다. ${soul.scent}`;
      case 'today': {
        const t = today();
        const f = SajuCore.calculateDailyFortune(P, t.y, t.m, t.d);
        return `오늘은 <strong>${f.dayStem.char}${f.dayBranch.char}일</strong>, 네게 <strong>${f.sipsin}</strong>의 날이다. ${DAILY_TEXT[f.sipsin].head}<br><br>오늘 점수는 <strong>${f.score}점</strong>이다. 자세한 건 대문 앞 '오늘의 운세' 부적을 떼어 보거라.`;
      }
      case 'me': {
        const reading = getDynamicColdReading(P.dStem, P.dBranch, '천명');
        return `너는 <strong>${sj.ilju}일주</strong>, ${P.dStem.trait} 기운을 타고났다.<br><br>${stripTags(reading.innerSoul)}`;
      }
      default: return '무슨 말인지 냄새가 안 잡힌다. 다른 걸 물어보거라.';
    }
  }

  function renderChat() {
    const body = $('chatBody');
    withProfile(body, '백구가 답하려면 네 생년월일 냄새가 필요하다', p => {
      const sj = readSaju(p);
      body.innerHTML = `
        ${profileLine(p, sj)}
        <div class="chat-log" id="chatLog" aria-live="polite"></div>
        <div class="chat-chips" id="chatChips"></div>
        <p class="feature-note">백구의 답은 네 사주로 지어낸 오락 풀이다. 건강·돈·법처럼 중요한 결정은 전문가와 상의하거라.</p>`;
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
      say('dog', `<strong>${sj.ilju}일주</strong>로구나. 네 냄새는 기억해 두었다. 궁금한 걸 골라 물어보거라.`);
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
    if (typeof currentSajuData === 'undefined' || !currentSajuData) { showToast('사주를 먼저 봐야 공유 카드를 만들 수 있다.'); return; }
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
      ctx.fillText(`${S.dStem.char}${S.dBranch.char}일주`, 540, 1080);

      const title = (document.getElementById('animalTitle') || {}).textContent || '';
      ctx.fillStyle = '#F4EEE2'; ctx.font = `44px ${body}`;
      wrapLines(ctx, title, 860).slice(0, 3).forEach((l, i) => ctx.fillText(l, 540, 1190 + i * 64));

      const tags = [`일간 ${EL_KO[ps.dmEl]}`, `모자란 기운 ${EL_KO[ps.weakKey]}`, `${NOW_Y}년 ${yearSipsin}`];
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
      showToast('공유 카드를 그리지 못했다. 잠시 뒤 다시 눌러 보거라.');
      return;
    }
    let blob = null;
    try { blob = await new Promise(res => c.toBlob(res, 'image/png')); } catch (e) { blob = null; }
    if (!blob) { showToast('이 브라우저에서는 저장이 막혔다. 화면을 캡처해 공유하거라.'); return; }
    const fileName = `벽사신견_${S.dStem.char}${S.dBranch.char}일주_공유카드.png`;
    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: '벽사신견 사주' }); return; } catch (e) { /* 취소 시 내려받기 */ }
    }
    const a = document.createElement('a'); a.download = fileName; a.href = URL.createObjectURL(blob); a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    showToast('📸 공유 카드를 저장했다. 스토리에 올려 보거라 🐾');
  }

  // ─────────────────────────────────────────────────────────────────────
  // 진입점
  // ─────────────────────────────────────────────────────────────────────
  const FEATURES = {
    compat: { view: 'viewCompat', render: renderCompat },
    daily: { view: 'viewDaily', render: renderDaily },
    tarot: { view: 'viewTarot', render: renderTarot },
    chat: { view: 'viewChat', render: renderChat }
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
  window.BYEOKSA_EXTRAS = { DECK, DAILY_TEXT, TOPICS, answer, readSaju, COMPAT_BANDS,
    // 유료 상품(shop.js)이 함께 쓰는 도우미
    withProfile, profileLine, bindProfileLinks, showCompatResult, subj, copula, HOUR_NAMES,
    registerFeature: (name, view, render) => { FEATURES[name] = { view, render }; } };
})();

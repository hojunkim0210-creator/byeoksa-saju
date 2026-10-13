/**
 * 벽사신견 유료 상품: 신년운세 · 궁합 상세 리포트 · 소원 부적 (+ 대문 '백구의 비방 보따리' 진열)
 * - 계산은 SajuCore, 공용 도우미(josa·getPersona·EL_KO 등)와 결제(purchase·priceFor 등)는 app.js 것을 쓴다.
 * - 문장은 반말 백구 말투, 개 소리 추임새 없음. 효과를 장담하지 않는다(오락 콘텐츠).
 */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const X = window.BYEOKSA_EXTRAS;
  const hash = s => SajuCore.hashSeed(s);
  const pickBy = (arr, seed) => arr[seed % arr.length];
  const EL_HANJA = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' };
  const REMEDY = k => ELEMENT_REMEDIES[k];

  /** 신년운세 대상 해: 9월부터는 다음 해 */
  function targetYear() { const d = new Date(); return d.getMonth() + 1 >= 9 ? d.getFullYear() + 1 : d.getFullYear(); }
  function personKeyOf(p) { return hash(`${p.y}-${p.m}-${p.d}-${p.hour}-${p.gender}`).toString(36); }

  // ─────────────────────────────────────────────────────────────────────
  // 달의 기운: 그 달 월주가 내 일간·일지와 맺는 관계
  // ─────────────────────────────────────────────────────────────────────
  const MONTH_PTS = { '정재': 14, '정관': 12, '정인': 12, '식신': 12, '편재': 8, '편인': 5, '비견': 4, '상관': 1, '겁재': -5, '편관': -7 };

  /** 양력 y년 m월의 월주 (그달 20일 기준 — 절입(4~8일) 뒤라 그 달 기운이 확실하다) */
  function monthPillar(y, m) {
    const p = calculateFourPillars(y, m, 20, null);
    return { y, m, stemIdx: p.mStemIdx, branchIdx: p.mBranchIdx };
  }

  function monthFortune(sj, mp) {
    const dS = sj.pillars.dStemIdx, dB = sj.pillars.dBranchIdx;
    const sipsin = getSipsin(dS, mp.stemIdx);
    const rel = SajuCore.branchRelation(dB, mp.branchIdx);
    const fill = (STEMS[mp.stemIdx].el === sj.ps.weakKey ? 1 : 0) + (BRANCHES[mp.branchIdx].el === sj.ps.weakKey ? 1 : 0);
    let score = 58 + MONTH_PTS[sipsin] + (rel.yukhap ? 9 : 0) + (rel.samhap ? 5 : 0) - (rel.chung ? 11 : 0) + fill * 5;
    score += (hash(`${sj.ilju}|${mp.y}-${mp.m}`) % 5) - 2;
    return { ...mp, sipsin, rel, fill, score: Math.max(32, Math.min(96, score)),
      ganji: STEMS[mp.stemIdx].char + BRANCHES[mp.branchIdx].char, ganjiHanja: STEMS[mp.stemIdx].hanja + BRANCHES[mp.branchIdx].hanja };
  }

  /** 앞으로 12달 (이번 달부터) */
  function next12(sj) {
    const d = new Date(); const out = [];
    for (let i = 0; i < 12; i++) { const t = new Date(d.getFullYear(), d.getMonth() + i, 1); out.push(monthFortune(sj, monthPillar(t.getFullYear(), t.getMonth() + 1))); }
    return out;
  }

  // ─────────────────────────────────────────────────────────────────────
  // 공용: 봉인 카드(맛보기 + 결제 버튼), 상품 결제창
  // ─────────────────────────────────────────────────────────────────────
  function sealCard({ productId, title, hook, items, buttonLabel, btnId, bundleFrom }) {
    const pr = priceFor(productId);
    const bundleLine = bundleFrom ? `<button class="btn-bundle" data-bundle-from="${bundleFrom}">📦 <span>이것까지 리포트·신년운세·소원 부적 5종·궁합 상세 <strong>전부 ${won(PRODUCTS.bundle.price)}원</strong></span></button>` : '';
    return `
      <div class="feature-card seal-card">
        <div class="seal-card-head">
          <span class="seal-card-stamp" aria-hidden="true">封</span>
          <h3 class="feature-card-title">${title}</h3>
        </div>
        <p class="seal-hook">${hook}</p>
        <ul class="seal-list">${items.map(t => `<li>${t}</li>`).join('')}</ul>
        <div class="seal-fog" aria-hidden="true"><span></span><span></span><span></span></div>
        <div class="seal-price">
          <strong>${won(pr.final)}원</strong>${pr.coupon ? ` <s>${won(pr.list)}원</s>` : ''}
          <span class="seal-price-note">1회 결제 · 결제 즉시 열람</span>
        </div>
        <p class="coupon-line" data-coupon-line="${productId}" hidden></p>
        <button class="btn-pay" id="${btnId}">${buttonLabel}</button>
        ${bundleLine}
        <p class="feature-note">전통 명리 해석을 바탕으로 한 오락 콘텐츠이며, 특정 결과를 보장하지 않는다.</p>
      </div>`;
  }

  /** 상품 결제창: 상품·가격·제공·환불·미성년자 안내 → purchase() */
  function openProductModal(productId, { title, desc, provide, again, subjectKey, data }) {
    const pr = priceFor(productId);
    const live = PAYMENT.mode === 'portone';
    $('productModalBody').innerHTML = `
      <h3>${title}</h3>
      <p>${desc}</p>
      <dl class="product-info">
        <dt>상품</dt><dd>${esc(PRODUCTS[productId].name)}</dd>
        <dt>가격</dt><dd>${won(pr.final)}원${pr.coupon ? ` (정가 ${won(pr.list)}원, ${won(pr.list - pr.final)}원 할인)` : ''} · 1회 결제, 자동 결제 없음</dd>
        <dt>제공</dt><dd>${provide}</dd>
        <dt>다시 보기</dt><dd>${again}</dd>
      </dl>
      <p class="payment-notice">결제 후 내용이 열리면 디지털 콘텐츠의 특성상 청약철회(환불)가 제한됩니다. 내용이 열리지 않았거나 정상적으로 보이지 않으면 환불해 드립니다. <a href="legal.html#refund" target="_blank" rel="noopener">환불 안내 보기</a></p>
      <p class="payment-notice">만 19세 미만은 법정대리인(부모님 등)의 동의를 받아 결제해 주십시오. 동의 없이 결제한 경우 본인 또는 법정대리인이 취소할 수 있습니다.</p>
      ${promoRowHtml()}
      <button class="btn-submit" id="productPayBtn">${live ? `💳 ${won(pr.final)}원 결제하기` : '테스트로 봉인 해제해보기 🐾'}</button>
      <button class="btn-close" onclick="closePaymentModal()">닫기</button>`;
    $('productPayBtn').onclick = () => purchase(productId, subjectKey, data, $('productPayBtn'));
    const m = $('productModal');
    m._reopen = () => openProductModal(productId, { title, desc, provide, again, subjectKey, data });
    if (!m.dataset.promoBound) { m.addEventListener('promo', () => { if (m._reopen) m._reopen(); }); m.dataset.promoBound = '1'; }
    m.style.display = 'flex';
  }

  // ═════════════════════════════════════════════════════════════════════
  // ① 신년운세
  // ═════════════════════════════════════════════════════════════════════
  const NY = {
    '비견': { key: '어깨 나란히', good: ['함께 뛸 사람을 모으기 좋은 달이다. 혼자 끙끙대던 일을 같이 할 사람에게 털어놓거라.', '운동·공부 모임처럼 같은 목표를 가진 무리에 들어가면 힘이 붙는다.'], caution: ['내 몫과 남의 몫을 흐리게 두지 마라. 돈 나눌 일은 말로 말고 글로 정해 두거라.', '자존심 싸움에 시간을 쓰기 쉽다. 이겨도 남는 게 없는 말다툼은 먼저 접거라.'], say: '혼자 다 짊어지지 마라. 이번 달은 옆자리가 비어 있지 않다.' },
    '겁재': { key: '내 몫 지키기', good: ['경쟁이 붙어야 실력이 느는 달이다. 비교당하는 자리를 피하지 말고 실력으로 받아쳐라.', '승부욕이 살아나는 달이다. 미뤄 둔 도전 하나를 이번에 끝내거라.'], caution: ['돈을 빌려 달라는 말, 같이 하자는 투자 이야기가 들어오기 쉽다. 한 번 더 자고 나서 답하거라.', '충동적으로 지르는 지출이 커지는 달이다. 큰돈은 사흘 묵혀 두고 결정하거라.'], say: '이번 달은 지갑 끈이 곧 네 운이다. 함부로 풀지 마라.' },
    '식신': { key: '재주가 밥이 됨', good: ['즐겨 하던 일이 성과로 이어지기 좋은 달이다. 만들어 둔 것을 밖에 내보이거라.', '먹고 쉬는 것까지 운이 되는 달이다. 몸을 잘 먹이고 꾸준히 쌓아라.'], caution: ['편안함에 늘어지기 쉽다. 하루 한 가지라도 끝내는 습관을 지키거라.', '먹는 것으로 스트레스를 풀다 몸이 무거워지기 쉽다. 야식은 줄이거라.'], say: '네가 좋아서 하던 일이 오늘 누군가에게 쓸모가 된다. 그걸 숨기지 마라.' },
    '상관': { key: '말과 재능이 터짐', good: ['아이디어와 말솜씨가 번뜩이는 달이다. 발표·글쓰기·창작은 이번 달에 몰아서 하거라.', '틀을 깨는 시도가 눈에 띄는 달이다. 새로운 방식을 하나 시험해 보거라.'], caution: ['윗사람과 말이 부딪치기 쉽다. 옳은 말도 한 번 삼키고 때를 골라 하거라.', '규칙을 가볍게 넘기다 탈이 나기 쉽다. 서류와 마감은 두 번 확인하거라.'], say: '말은 칼이다. 벨 데를 골라 쓰면 무기가 되고, 아무 데나 휘두르면 네가 다친다.' },
    '편재': { key: '큰돈이 움직임', good: ['뜻밖의 기회와 돈 이야기가 들어오기 좋은 달이다. 사람을 많이 만나고 판을 넓게 보거라.', '사고파는 감각이 살아나는 달이다. 중고 정리·부업처럼 손을 움직이는 돈벌이를 시험해 보거라.'], caution: ['들어오는 만큼 새는 길도 넓다. 카드값과 구독을 이번 달에 한 번 정리하거라.', '한 방에 큰돈을 노리는 이야기는 듣기만 하거라. 계약서는 네 눈으로 끝까지 읽어라.'], say: '돈 냄새가 짙은 달일수록 코를 더 차갑게 써라.' },
    '정재': { key: '꼬박꼬박 쌓임', good: ['성실함이 그대로 돈이 되는 달이다. 적금·저축처럼 차곡차곡 모으는 일을 시작하기 좋다.', '살림과 계획을 정리하기 좋은 달이다. 한 달 지출표를 만들어 두거라.'], caution: ['아끼느라 꼭 필요한 데까지 굶기지 마라. 몸과 공부에 드는 돈은 아끼는 돈이 아니다.', '변화를 너무 두려워하면 들어온 기회를 놓친다. 작게라도 한 걸음은 내딛거라.'], say: '티끌이 태산이 되는 달이다. 오늘 아낀 한 끼 값을 우습게 보지 마라.' },
    '편관': { key: '거센 압박·시험', good: ['버티는 힘이 시험받는 달이다. 맞서서 넘기면 실력과 평판이 한꺼번에 오른다.', '어려운 일을 맡을수록 이름이 서는 달이다. 남이 피하는 일 하나를 맡아 보거라.'], caution: ['과로와 스트레스가 몸으로 오기 쉽다. 잠을 줄여 가며 버티지 마라.', '윗사람·기관과 마찰이 생기기 쉽다. 감정보다 기록과 절차로 대응하거라.'], say: '무거운 짐은 등을 곧게 펴고 져야 덜 무겁다. 이번 달은 허리를 펴거라.' },
    '정관': { key: '자리와 인정', good: ['노력이 공식적으로 인정받기 좋은 달이다. 승진·합격·계약처럼 이름이 걸린 일에 도전하거라.', '약속과 규칙을 지킨 만큼 신뢰가 쌓이는 달이다. 맡은 일을 반듯하게 끝내거라.'], caution: ['남의 눈을 너무 의식하면 몸이 굳는다. 완벽보다 제때 끝내는 것을 택하거라.', '체면 때문에 거절 못 하는 부탁이 늘기 쉽다. 할 수 있는 만큼만 받아라.'], say: '이번 달은 네가 한 약속이 너를 지킨다. 작은 약속부터 지켜라.' },
    '편인': { key: '촉과 감각', good: ['직감이 날카로워지는 달이다. 낯선 공부·기술·취미를 파고들면 남다른 감각을 얻는다.', '혼자 생각을 정리하기 좋은 달이다. 일기나 메모로 머릿속을 꺼내 두거라.'], caution: ['생각만 많아지고 실행이 늦어지기 쉽다. 하루 한 가지는 손으로 끝내거라.', '사람을 의심하는 마음이 커지기 쉽다. 확인 없이 단정 짓지 마라.'], say: '촉이 오면 적어 두거라. 이번 달 네 촉은 잘 맞는 편이다.' },
    '정인': { key: '배움과 귀인', good: ['배움과 문서운이 좋은 달이다. 자격증·시험·계약 서류를 이번 달에 챙기거라.', '도와주는 사람이 나타나기 좋은 달이다. 어려운 일은 혼자 버티지 말고 먼저 물어보거라.'], caution: ['받기만 하다 보면 기대는 버릇이 든다. 도움을 받았으면 작게라도 갚아라.', '계획만 세우고 시작을 미루기 쉽다. 시작 날짜를 달력에 박아 두거라.'], say: '이번 달은 묻는 자가 얻는다. 모르는 걸 부끄러워하지 마라.' }
  };
  const NY_REL = {
    yukhap: '네 일지와 합을 맺는 달이라 사람과 인연이 부드럽게 이어진다. 만남·화해·협업에 좋다.',
    samhap: '네 일지와 한 무리를 이루는 달이라 모임과 단체 일에서 힘을 얻는다.',
    chung: '네 일지와 부딪치는 달이라 집·연애·생활 리듬이 흔들리기 쉽다. 이사·큰 계약·이별 같은 결정은 서두르지 마라.'
  };
  const SCORE_BANDS = [[80, '볕 드는 달'], [66, '순한 달'], [52, '평이한 달'], [0, '몸 사릴 달']];
  const bandOf = s => SCORE_BANDS.find(b => s >= b[0])[1];

  function newYearData(p) {
    const sj = X.readSaju(p);
    const TY = targetYear();
    const months = [];
    for (let i = 0; i < 12; i++) { let m = i + 2, y = TY; if (m > 12) { m -= 12; y += 1; } months.push(monthFortune(sj, monthPillar(y, m))); }
    const ys = ((TY - 4) % 10 + 10) % 10, yb = ((TY - 4) % 12 + 12) % 12;
    const ySipsin = getSipsin(sj.pillars.dStemIdx, ys);
    const yRel = SajuCore.branchRelation(sj.pillars.dBranchIdx, yb);
    const avg = Math.round(months.reduce((n, m) => n + m.score, 0) / 12);
    const sorted = [...months].sort((a, b) => b.score - a.score);
    return { sj, TY, months, ySipsin, yRel, ys, yb, avg, best: sorted.slice(0, 3), worst: sorted.slice(-2).reverse() };
  }
  let _nyTY = 0;
  const mLabel = mf => (_nyTY && mf.y !== _nyTY ? `${mf.y}년 ${mf.m}월` : `${mf.m}월`);

  function renderNewYear() {
    const body = $('newYearBody');
    X.withProfile(body, `${targetYear()}년 신년운세를 보려면 생년월일이 필요하다`, p => drawNewYear(p));
  }

  function drawNewYear(p) {
    const body = $('newYearBody');
    const D = newYearData(p);
    _nyTY = D.TY;
    const key = personKeyOf(p) + '.' + D.TY;
    const paid = isPaidFor('newyear', key);
    const yName = `${yearGanji(D.TY)}(${yearGanji(D.TY, true)})년`;
    $('newYearTitle').textContent = `${D.TY}년 신년운세`;
    const bars = D.months.map(m => `
      <li class="ny-bar ${m.rel.chung ? 'is-chung' : ''}">
        <span class="ny-bar-m">${m.y !== D.TY ? '이듬해 ' : ''}${m.m}월</span>
        <span class="ny-bar-track"><span class="ny-bar-fill" style="width:${m.score}%"></span></span>
        <span class="ny-bar-s">${m.score}</span>
        <span class="ny-bar-k">${NY[m.sipsin].key}</span>
      </li>`).join('');
    const head = `
      ${X.profileLine(p, D.sj)}
      <div class="feature-card ny-head">
        <p class="ny-year">${yName} · ${esc(D.sj.ilju)}일주</p>
        <div class="score-block"><span class="score-num">${D.avg}</span><span class="score-unit">점</span><span class="score-band">${bandOf(D.avg)}의 해</span></div>
        <p class="feature-text">${D.TY}년의 천간이 네게 <strong>${D.ySipsin}</strong>${josa(D.ySipsin, '으로')} 들어온다. ${YEAR_SIPSIN_TEXT_10[D.ySipsin]}</p>
        ${D.yRel.chung ? `<p class="feature-text">게다가 그해의 띠가 네 일지와 부딪친다. 생활의 터전이 한 번 크게 흔들리는 해이니, 큰 결정일수록 천천히 가거라.</p>` : ''}
        ${(D.yRel.yukhap || D.yRel.samhap) ? `<p class="feature-text">그해의 띠가 네 일지와 손을 잡는다. 사람 덕을 보는 해이니 인연을 넓히거라.</p>` : ''}
        <h3 class="feature-card-title">열두 달 기운</h3>
        <ol class="ny-bars">${bars}</ol>
        <div class="ny-picks">
          <p><span class="ny-pick-tag good">볕 드는 달</span> <strong>${D.best.map(mLabel).join(' · ')}</strong></p>
          <p><span class="ny-pick-tag bad">몸 사릴 달</span> <strong>${D.worst.map(mLabel).join(' · ')}</strong></p>
        </div>
        <p class="feature-note">월 기운은 양력 달 기준(그달 절입 뒤의 월주)으로 계산했다. 점수는 재미로 보는 전통 풀이다.</p>
      </div>`;

    if (!paid) {
      const w = D.worst[0], b = D.best[0];
      body.innerHTML = head + sealCard({
        productId: 'newyear', btnId: 'nyBuy',
        title: `${D.TY}년 열두 달, 봉인된 이야기`,
        hook: `가장 몸을 사려야 할 달은 <strong>${mLabel(w)}</strong>이다. 그 달에 무엇이 네 발목을 잡는지, 그리고 <strong>${mLabel(b)}</strong>에 들어오는 볕을 붙잡으려면 언제부터 무엇을 준비해야 하는지는 이 봉인 안에 적어 두었다.`,
        items: ['달마다 <strong>할 일</strong>과 <strong>피할 일</strong>, 백구 한마디 (12달)', '돈 · 일 · 공부 · 인연 · 건강, <strong>분야별로 기운이 몰리는 달</strong>', '네 사주에 모자란 기운을 채우는 <strong>한 해 비방</strong> (색 · 방위 · 숫자)', 'PDF로 저장해 한 해 동안 꺼내 보기'],
        buttonLabel: `📜 ${D.TY}년 봉인 풀기`, bundleFrom: 'newyear'
      });
      bindBundle(body, p, 'newyear');
      $('nyBuy').onclick = () => openProductModal('newyear', {
        title: `📜 ${D.TY}년 신년운세 봉인 풀기`,
        desc: `${esc(D.sj.ilju)}일주의 ${D.TY}년 열두 달 풀이와 분야별 흐름, 한 해 비방이 열린다.`,
        provide: '결제 즉시 이 화면에서 열람 · PDF로 저장 가능',
        again: '같은 기기·같은 생년월일로 들어오면 다시 열림',
        subjectKey: key, data: p
      });
      renderCouponLines();
    } else {
      body.innerHTML = head + newYearFull(D);
      const pb = $('nyPrint'); if (pb) pb.onclick = () => printReport();
    }
    X.bindProfileLinks(body, renderNewYear);
  }

  function newYearFull(D) {
    const sj = D.sj;
    const cards = D.months.map(m => {
      const t = NY[m.sipsin], s = hash(`${sj.ilju}|${m.y}-${m.m}|ny`);
      const extra = m.rel.chung ? NY_REL.chung : m.rel.yukhap ? NY_REL.yukhap : m.rel.samhap ? NY_REL.samhap : '';
      const fillTxt = m.fill ? `네 사주에 모자란 <strong>${EL_KO[sj.ps.weakKey]}</strong> 기운이 채워지는 달이다. 미뤄 둔 결심을 이때 실행하거라.` : '';
      return `
        <article class="ny-month">
          <header><span class="ny-month-m">${mLabel(m)}</span><span class="ny-month-g">${m.ganji}(${m.ganjiHanja})월 · ${m.sipsin}</span><span class="ny-month-s">${m.score}점 · ${bandOf(m.score)}</span></header>
          <p><span class="ny-tag do">할 일</span>${pickBy(t.good, s)}</p>
          <p><span class="ny-tag avoid">조심</span>${pickBy(t.caution, s >>> 3)}</p>
          ${extra ? `<p><span class="ny-tag rel">인연</span>${extra}</p>` : ''}
          ${fillTxt ? `<p><span class="ny-tag fill">보충</span>${fillTxt}</p>` : ''}
          <p class="ny-say">"${t.say}"</p>
        </article>`;
    }).join('');
    const pick = names => D.months.filter(m => names.includes(m.sipsin)).sort((a, b) => b.score - a.score).slice(0, 3);
    const line = (label, arr, why) => `<li><strong>${label}</strong> — ${arr.length ? arr.map(mLabel).join(' · ') : '두드러진 달 없음'}${arr.length ? `. ${why}` : `. 한 해 내내 고르게 움직이는 편이다.`}</li>`;
    const loveMonths = D.months.filter(m => m.rel.yukhap || m.rel.samhap).sort((a, b) => b.score - a.score).slice(0, 3);
    const healthMonths = D.months.filter(m => m.rel.chung || m.sipsin === '편관');
    const r = REMEDY(sj.ps.weakKey);
    return `
      <div class="feature-card">
        <h3 class="feature-card-title">달마다 할 일과 피할 일</h3>
        <div class="ny-months">${cards}</div>
      </div>
      <div class="feature-card">
        <h3 class="feature-card-title">분야별로 기운이 몰리는 달</h3>
        <ul class="ny-fields">
          ${line('돈', pick(['정재', '편재']), '들어오는 돈의 길이 열리는 달이다. 저축과 부업은 이때 시작하거라.')}
          ${line('일·자리', pick(['정관', '편관']), '평가와 책임이 몰리는 달이다. 이름이 걸린 일은 이때 정면으로 맞서라.')}
          ${line('공부·문서', pick(['정인', '편인']), '배움과 서류운이 붙는 달이다. 시험·자격·계약은 이때 챙기거라.')}
          ${line('재능·표현', pick(['식신', '상관']), '만든 것을 내보이기 좋은 달이다. 발표와 창작은 이때 몰아서 하거라.')}
          ${line('인연', loveMonths, '사람과의 매듭이 부드럽게 풀리는 달이다. 만남과 화해는 이때 하거라.')}
          <li><strong>몸</strong> — ${healthMonths.length ? `${healthMonths.map(mLabel).join(' · ')}에는 무리하지 마라. 잠과 끼니를 먼저 챙기거라.` : '크게 흔들리는 달은 없다. 그래도 환절기마다 몸을 살펴라.'} 몸이 오래 아프면 풀이보다 병원이 먼저다.</li>
        </ul>
      </div>
      <div class="feature-card">
        <h3 class="feature-card-title">${D.TY}년 한 해 비방 · ${EL_KO[sj.ps.weakKey]} 기운 채우기</h3>
        <p class="feature-text">네 사주에 가장 모자란 기운은 <strong>${EL_KO[sj.ps.weakKey]}</strong>이다. 한 해 동안 <strong>${r.color}</strong> 계열을 몸에 지니고, <strong>${r.food}</strong>${josa(r.food, '을')} 가까이하거라. 중요한 결정은 <strong>${r.dir}</strong>을 바라보고 내리고, 행운의 숫자는 <strong>${r.num}</strong>이다.</p>
        <p class="feature-text">가장 볕 드는 <strong>${D.best.map(mLabel).join(' · ')}</strong>에 큰일을 맞추고, <strong>${D.worst.map(mLabel).join(' · ')}</strong>에는 새 일을 벌이기보다 지키는 쪽을 택하거라.</p>
        <p class="ny-say">"한 해는 길다. 나쁜 달에 겁먹지 말고, 좋은 달에 게으르지 마라. 나는 대문 앞에서 네 발소리를 기다리마."</p>
        <button class="btn-close" id="nyPrint">🖨️ PDF로 저장</button>
      </div>`;
  }

  // ═════════════════════════════════════════════════════════════════════
  // ② 궁합 상세 리포트 (무료 궁합 결과 아래)
  // ═════════════════════════════════════════════════════════════════════
  const NEED_WORDS = {
    wood: { word: '"네 생각 좋다, 한번 해 봐."', why: '목(木) 일간은 뻗어 나가고 싶은 나무다. 인정받고 응원받을 때 가장 크게 자란다.' },
    fire: { word: '"고마워, 네 덕분이야."', why: '화(火) 일간은 비추고 싶은 불이다. 마음을 말로 표현해 줄 때 더 뜨겁게 타오른다.' },
    earth: { word: '"괜찮아, 내가 여기 있을게."', why: '토(土) 일간은 기댈 곳을 지키는 땅이다. 변하지 않는다는 믿음을 줄 때 마음을 연다.' },
    metal: { word: '"약속한 건 꼭 지킬게."', why: '금(金) 일간은 선이 분명한 쇠다. 말과 행동이 같을 때 깊이 신뢰한다.' },
    water: { word: '"천천히 생각해도 돼."', why: '수(水) 일간은 깊이 흐르는 물이다. 재촉하지 않고 기다려 줄 때 속을 보여 준다.' }
  };
  const FIGHT = {
    same: (A, B) => `${esc(A)}${josa(A, '과')} ${esc(B)}${josa(B, '은')} 같은 기운을 타고났다. 생각이 비슷해 편하지만, 부딪칠 때는 둘 다 물러서지 않아 작은 일이 자존심 싸움으로 번진다. 싸움이 길어진다 싶으면 먼저 "누가 옳은지 말고 뭘 원하는지"를 묻거라.`,
    generates: (A, B) => `${esc(X.subj(A))} 기운을 내주고 ${esc(X.subj(B))} 받는 사이다. 평소엔 따뜻하지만, 내주는 쪽이 지치면 "나만 애쓴다"는 서운함이 터진다. 다툼의 뿌리는 대개 서운함이니, 받는 쪽이 먼저 고마움을 말로 꺼내거라.`,
    controls: (A, B) => `${esc(X.subj(A))} 기운으로 ${esc(B)}${josa(B, '을')} 누르는 사이다. ${esc(A)}의 바른말이 ${esc(B)}에게는 잔소리로 들리기 쉽다. 다툼은 대개 말투에서 시작되니, 고칠 점 하나를 말하기 전에 좋은 점 하나를 먼저 말하거라.`
  };
  const DATE_PLACE = { wood: '숲길·공원·식물원', fire: '공연장·햇볕 드는 테라스', earth: '시장 구경·도자기 공방', metal: '전시관·조용한 카페', water: '바닷가·강변 야경' };

  function compatDetailData(A, B, r, nameA, nameB) {
    const rel = SajuCore.elementRelation(A.ps.dmEl, B.ps.dmEl);
    let fight;
    if (rel === 'same') fight = FIGHT.same(nameA, nameB);
    else if (rel === 'generates') fight = FIGHT.generates(nameA, nameB);
    else if (rel === 'generatedBy') fight = FIGHT.generates(nameB, nameA);
    else if (rel === 'controls') fight = FIGHT.controls(nameA, nameB);
    else fight = FIGHT.controls(nameB, nameA);
    if (r.dayRelation && r.dayRelation.chung) fight += ` 게다가 두 사람의 일지(생활의 자리)가 부딪친다. 생활 습관·연락 빈도 같은 일상의 차이가 싸움거리가 되기 쉬우니, 서로의 리듬을 미리 말로 정해 두거라.`;
    const years = [];
    for (let y = NOW_Y; y < NOW_Y + 6; y++) {
      const yb = ((y - 4) % 12 + 12) % 12;
      const ra = SajuCore.branchRelation(A.pillars.dBranchIdx, yb), rb = SajuCore.branchRelation(B.pillars.dBranchIdx, yb);
      const good = (ra.yukhap || ra.samhap || rb.yukhap || rb.samhap) && !ra.chung && !rb.chung;
      const bad = ra.chung || rb.chung;
      years.push({ y, good, bad, who: ra.chung && rb.chung ? '두 사람 모두' : ra.chung ? nameA : rb.chung ? nameB : '' });
    }
    const weakA = A.ps.weakKey, weakB = B.ps.weakKey;
    const fills = r.parts.filter(p => p.key === 'fillA' || p.key === 'fillB');
    let last;
    if (fills.length) last = `두 사람은 서로에게 모자란 기운을 채워 준다. ${fills.map(p => p.key === 'fillA' ? `${esc(X.subj(nameB))} ${esc(nameA)}에게 ${p.detail.els.map(k => EL_KO[k]).join('·')}` : `${esc(X.subj(nameA))} ${esc(nameB)}에게 ${p.detail.els.map(k => EL_KO[k]).join('·')}`).join(', ')} 기운을 준다. 함께 있을 때 편한 이유가 바로 이것이니, 힘들 때일수록 곁에 있어 주거라.`;
    else if (weakA === weakB) last = `두 사람 다 ${EL_KO[weakA]} 기운이 모자라다. 둘이 함께 ${REMEDY(weakA).color} 계열의 물건을 나눠 갖거나 ${REMEDY(weakA).dir}으로 나들이를 가면 빈자리가 같이 채워진다.`;
    else last = `${esc(nameA)}에게는 ${EL_KO[weakA]}, ${esc(nameB)}에게는 ${EL_KO[weakB]} 기운이 모자라다. 서로의 빈자리를 알아 두면 다툴 일이 줄어든다. 상대가 지쳐 보일 때 그 기운을 채워 주는 것(${REMEDY(weakA).food.split(',')[0]} / ${REMEDY(weakB).food.split(',')[0]})을 챙겨 주거라.`;
    return { fight, years, last, needA: NEED_WORDS[A.ps.dmEl], needB: NEED_WORDS[B.ps.dmEl], placeA: DATE_PLACE[weakA], placeB: DATE_PLACE[weakB], colorA: REMEDY(weakA).color.split(',')[0], colorB: REMEDY(weakB).color.split(',')[0] };
  }

  function compatKey(a, b) { return hash(`${a.y}-${a.m}-${a.d}-${a.hour}-${a.gender}|${b.y}-${b.m}-${b.d}-${b.hour}-${b.gender}`).toString(36); }

  function afterCompat(a, b, nameA, nameB, A, B, r) {
    const host = document.createElement('div');
    host.id = 'compatDetail';
    host.className = 'feature-result';
    $('compatResult').appendChild(host);
    const key = compatKey(a, b);
    const D = compatDetailData(A, B, r, nameA, nameB);
    if (!isPaidFor('compat', key) && !hasBundle(a) && !hasBundle(b)) {
      const firstSentence = D.fight.split('. ')[0] + '.';
      host.innerHTML = sealCard({
        productId: 'compat', btnId: 'compatBuy',
        title: '두 사람의 상세 궁합',
        hook: `점수는 숫자일 뿐이다. ${firstSentence} 이 다툼이 어떻게 풀리는지, 언제 함께 움직여야 하는지는 따로 적어 두었다.`,
        items: ['두 사람이 <strong>싸우는 패턴</strong>과 푸는 법', `${esc(nameA)}에게, ${esc(nameB)}에게 <strong>꼭 필요한 한마디</strong>`, `앞으로 6년 중 <strong>함께하면 좋은 해</strong>와 조심할 해`, '오래 가는 비결 · 두 사람에게 맞는 <strong>데이트 비방</strong>'],
        buttonLabel: '💞 상세 궁합 봉인 풀기', bundleFrom: 'compat'
      });
      bindBundle(host, a, 'compat', { a, b, nameA, nameB });
      $('compatBuy').onclick = () => openProductModal('compat', {
        title: '💞 두 사람의 상세 궁합',
        desc: `${esc(nameA)} · ${esc(nameB)} 두 사람의 다툼 패턴, 필요한 한마디, 함께하면 좋은 해와 비방이 열린다.`,
        provide: '결제 즉시 이 화면에서 열람 · PDF로 저장 가능',
        again: '같은 기기·같은 두 생년월일로 보면 다시 열림 (이름은 저장하지 않음)',
        subjectKey: key, data: { a, b, nameA, nameB }
      });
      renderCouponLines();
      return;
    }
    const yearLi = D.years.map(y => `<li class="${y.good ? 'good' : y.bad ? 'bad' : ''}"><strong>${y.y}년</strong> ${yearGanji(y.y)}년 — ${y.good ? '두 사람의 기운이 손을 잡는 해. 여행·동거·큰 약속 같은 함께하는 결정에 좋다.' : y.bad ? `${esc(y.who)}의 생활 자리가 흔들리는 해. 서로의 변화를 다그치지 말고 기다려 주거라.` : '크게 흔들리지도 붙지도 않는 해. 둘이 정한 대로 꾸준히 가면 된다.'}</li>`).join('');
    host.innerHTML = `
      <div class="feature-card compat-detail">
        <h3 class="feature-card-title">💞 두 사람의 상세 궁합</h3>
        <h4 class="cd-h">싸우는 패턴과 푸는 법</h4>
        <p class="feature-text">${D.fight}</p>
        <h4 class="cd-h">서로에게 필요한 한마디</h4>
        <p class="feature-text"><strong>${esc(nameA)}에게</strong> ${D.needA.word} ${D.needA.why}</p>
        <p class="feature-text"><strong>${esc(nameB)}에게</strong> ${D.needB.word} ${D.needB.why}</p>
        <h4 class="cd-h">함께하면 좋은 해 · 조심할 해</h4>
        <ul class="cd-years">${yearLi}</ul>
        <h4 class="cd-h">오래 가는 비결</h4>
        <p class="feature-text">${D.last}</p>
        <h4 class="cd-h">데이트 비방</h4>
        <p class="feature-text">${esc(nameA)}에게는 <strong>${D.placeA}</strong>, ${esc(nameB)}에게는 <strong>${D.placeB}</strong>이 기운을 채우는 곳이다. 번갈아 가 보고, 그날은 <strong>${D.colorA}</strong>과 <strong>${D.colorB}</strong>을 하나씩 걸쳐 보거라.</p>
        <p class="ny-say">"궁합은 정해진 답이 아니라 서로를 읽는 지도다. 지도를 봤으면 이제 같이 걷거라."</p>
        <p class="feature-note">전통 명리 해석을 바탕으로 한 재미 풀이이며, 두 사람의 관계를 정해 주지 않는다.</p>
      </div>`;
  }

  // ═════════════════════════════════════════════════════════════════════
  // ③ 소원 부적 (금테)
  // ═════════════════════════════════════════════════════════════════════
  const WISHES = {
    money: { ko: '재물', seal: '財', chars: '招財', desc: '들어온 돈이 머물고 새는 구멍이 막히길' },
    love: { ko: '연애', seal: '緣', chars: '和合', desc: '좋은 인연이 닿고 맺힌 마음이 풀리길' },
    pass: { ko: '합격', seal: '及', chars: '登科', desc: '시험·면접·승진, 이름이 오르길' },
    health: { ko: '건강', seal: '康', chars: '安康', desc: '몸과 마음이 편안하고 기운이 고르길' },
    guard: { ko: '액막이', seal: '厄', chars: '除厄', desc: '등 뒤의 액운과 나쁜 인연이 물러나길' }
  };

  /** 소원별로 사주에서 보는 자리와 그 세기 */
  function wishReading(sj, wishId) {
    const g = sipsinGroupCounts(sj.ps.dmEl, sj.oheng.counts);
    const missing = EL_KEYS.filter(k => !sj.oheng.counts[k]).length;
    const dB = sj.pillars.dBranchIdx;
    const chungCount = [sj.pillars.yBranchIdx, sj.pillars.mBranchIdx, sj.pillars.hBranchIdx].filter(b => b !== null && b !== undefined && (b - dB + 12) % 12 === 6).length;
    const T = {
      money: { n: g.jae, label: `재물을 뜻하는 재성(財星) ${g.jae}글자`, tiers: [
        '네 원국에는 재성이 드러나 있지 않다. 돈이 제 발로 찾아오는 팔자가 아니라 네 손으로 그릇을 빚는 팔자다. 이 부적은 "들어온 돈이 머무는 자리"를 만들어 주는 부적이다. 월급날마다 일정 금액을 따로 떼어 두는 습관과 함께 써야 힘을 쓴다.',
        '네 원국에서 재성은 한 글자뿐이다. 물줄기는 있으나 가늘어, 한 번 새면 금세 마른다. 이 부적은 그 가는 물줄기를 지키는 둑이다. 이번 달 안에 안 쓰는 구독과 자동결제부터 끊어 내거라.',
        '네 원국에는 재성이 넉넉하다. 돈이 오가는 길은 넓은데 그만큼 새는 길도 넓다. 이 부적은 들어오는 문보다 나가는 문을 지키는 부적이다. 큰 지출은 사흘 묵혀 두고 결정하거라.'] },
      love: { n: g.jae + g.gwan, label: `인연을 뜻하는 재성·관성 ${g.jae + g.gwan}글자`, tiers: [
        '네 원국에는 인연을 뜻하는 글자가 드러나 있지 않다. 인연이 없다는 뜻이 아니라, 기다려서는 오지 않는다는 뜻이다. 이 부적은 네가 먼저 내미는 손에 힘을 실어 주는 부적이다. 이번 달 새 모임 하나에 나가 보거라.',
        '네 원국에는 인연의 글자가 알맞게 있다. 오는 인연은 있으나 맺고 끊는 데 망설임이 많다. 이 부적은 닿은 인연을 매듭짓게 돕는 부적이다. 마음에 둔 사람이 있다면 이번 달 안에 한 번은 먼저 연락하거라.',
        '네 원국에는 인연의 글자가 많다. 사람이 끊이지 않지만 그만큼 엉키기도 쉽다. 이 부적은 좋은 인연만 남기고 엉킨 실을 끊어 주는 부적이다. 나를 지치게 하는 관계 하나를 정리하는 데서 시작하거라.'] },
      pass: { n: g.in + g.gwan, label: `배움·자리를 뜻하는 인성·관성 ${g.in + g.gwan}글자`, tiers: [
        '네 원국에는 배움과 자리를 뜻하는 글자가 드러나 있지 않다. 남이 깔아 준 길보다 스스로 만든 길에서 빛나는 팔자다. 이 부적은 혼자 버티는 공부에 힘을 보태는 부적이다. 계획을 날짜까지 적어 책상 앞에 붙여 두거라.',
        '네 원국에는 배움과 자리의 글자가 알맞게 있다. 실력은 쌓여 있으니 마지막 한 걸음의 긴장을 이기는 게 관건이다. 이 부적은 시험장과 면접장의 떨림을 누르는 부적이다. 시험 전날은 새것을 보지 말고 아는 것을 다지거라.',
        '네 원국에는 배움과 자리의 글자가 넉넉하다. 자격과 인정이 따라오는 팔자인데, 욕심이 많아 한꺼번에 여러 개를 붙들기 쉽다. 이 부적은 하나에 집중하게 돕는 부적이다. 이번에 붙을 목표 하나만 정하거라.'] },
      health: { n: missing, label: `원국에 빠진 오행 ${missing}가지`, tiers: [
        '네 원국에는 오행 다섯 가지가 모두 들어 있다. 기운이 고른 편이라 몸도 크게 한쪽으로 치우치지 않는다. 이 부적은 지금의 균형을 지키는 부적이다. 잠과 끼니의 시간을 일정하게 지키거라.',
        `네 원국에는 ${EL_KO[sj.ps.weakKey]} 기운이 비어 있다. 그 기운이 맡은 쪽이 먼저 지치기 쉽다. 이 부적은 그 빈자리를 채우는 부적이다. ${REMEDY(sj.ps.weakKey).food}${josa(REMEDY(sj.ps.weakKey).food, '을')} 가까이하거라.`,
        `네 원국에는 빠진 기운이 여럿이고, 그중 ${EL_KO[sj.ps.weakKey]} 기운이 가장 아쉽다. 무리하면 한꺼번에 무너지기 쉬운 팔자다. 이 부적은 기운이 새지 않게 막는 부적이다. 바쁠수록 쉬는 날을 먼저 달력에 박아 두거라.`] },
      guard: { n: chungCount + (g.gwan >= 2 ? 1 : 0), label: `일지와 부딪치는 기둥 ${chungCount}개 · 관성 ${g.gwan}글자`, tiers: [
        '네 원국은 크게 부딪치는 기둥이 없다. 액운이 들이닥치는 팔자는 아니나, 남의 시비에 휘말리기 쉬운 때가 있다. 이 부적은 바깥의 나쁜 기운을 대문 밖에서 돌려보내는 부적이다. 불편한 자리에는 처음부터 발을 들이지 마라.',
        '네 원국에는 생활의 자리를 흔드는 기운이 하나 있다. 이사·이직·이별 같은 변화가 갑자기 몰려오기 쉽다. 이 부적은 그 흔들림 속에서 중심을 잡게 돕는 부적이다. 큰 결정은 한 번 더 자고 내리거라.',
        '네 원국에는 부딪치고 누르는 기운이 여럿이다. 남의 짐까지 떠안기 쉬운 팔자다. 이 부적은 네 것이 아닌 짐을 내려놓게 돕는 부적이다. 거절할 일은 오늘 거절하거라.'] }
    }[wishId];
    const tier = T.n === 0 ? 0 : (wishId === 'love' || wishId === 'pass') ? (T.n <= 2 ? 1 : 2) : (T.n === 1 ? 1 : 2);
    // 앞으로 12달 중 이 소원에 기운이 붙는 달
    const months = next12(sj);
    const want = { money: ['정재', '편재'], love: null, pass: ['정인', '편인', '정관'], health: null, guard: null }[wishId];
    let goodMonths;
    if (wishId === 'love') goodMonths = months.filter(m => m.rel.yukhap || m.rel.samhap);
    else if (wishId === 'health') goodMonths = months.filter(m => m.fill);
    else if (wishId === 'guard') goodMonths = months.filter(m => !m.rel.chung && m.sipsin !== '편관' && m.sipsin !== '겁재');
    else goodMonths = months.filter(m => want.includes(m.sipsin));
    goodMonths = goodMonths.sort((a, b) => b.score - a.score).slice(0, 3);
    if (!goodMonths.length) goodMonths = [...months].sort((a, b) => b.score - a.score).slice(0, 3);
    const watch = months.filter(m => m.rel.chung).slice(0, 2);
    return { label: T.label, text: T.tiers[tier], tier, goodMonths: goodMonths.sort((a, b) => (a.y * 12 + a.m) - (b.y * 12 + b.m)), watch };
  }

  const WISH_SAY = {
    money: '돈은 쫓으면 달아나고, 그릇을 만들면 고인다. 부적은 그릇이고, 그릇을 채우는 건 네 손이다.',
    love: '인연은 기다리는 자보다 대문을 열어 둔 자에게 먼저 닿는다. 문은 내가 지켜 줄 테니 너는 열어 두기만 하거라.',
    pass: '네가 쌓은 만큼만 나온다. 부적은 그 쌓은 것을 떨지 않고 꺼내게 해 줄 뿐이다.',
    health: '몸이 먼저다. 오래 아프면 부적보다 병원이 먼저라는 것도 잊지 마라.',
    guard: '나쁜 기운은 대문 밖에서 내가 짖어 쫓으마. 너는 안에서 마음만 단단히 걸어 잠그거라.'
  };

  // ── 금테 부적 그리기 (900×1500) ──
  const WISH_FONT = '"Song Myung", "Noto Serif KR", "Noto Serif CJK KR", serif';
  async function drawWishTalisman(canvas, sj, wishId) {
    const W = WISHES[wishId], ctx = canvas.getContext('2d');
    try { await document.fonts.load(`200px "Song Myung"`); } catch (e) { /* 기본 글꼴 */ }
    const w = 900, h = 1500; canvas.width = w; canvas.height = h;
    let seed = hash(`${sj.ilju}|${wishId}`);
    const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const ink = '#A3221A', inkDeep = '#7E140E';

    // 1) 괴황지 바탕: 결·얼룩·그을린 가장자리
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#EFD47C'); bg.addColorStop(0.5, '#E5BC52'); bg.addColorStop(1, '#D6A33A');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 3200; i++) { ctx.fillStyle = `rgba(120,80,20,${rnd() * 0.06})`; ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2.5, 2 + rnd() * 16); }
    for (let i = 0; i < 7; i++) {   // 물 얼룩
      const x = rnd() * w, y = rnd() * h, r = 40 + rnd() * 110;
      const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
      g.addColorStop(0, 'rgba(150,100,30,0)'); g.addColorStop(0.85, 'rgba(150,100,30,0.10)'); g.addColorStop(1, 'rgba(150,100,30,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.22, w / 2, h / 2, h * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(0.8, 'rgba(90,45,10,0.22)'); vg.addColorStop(1, 'rgba(50,20,5,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);

    // 2) 금테 두 겹 + 안쪽 붉은 실선 + 귀퉁이 금박 구름무늬
    const gold = ctx.createLinearGradient(0, 0, w, h);
    gold.addColorStop(0, '#8A6414'); gold.addColorStop(0.22, '#F6E39A'); gold.addColorStop(0.45, '#B98A26'); gold.addColorStop(0.7, '#F8E7A8'); gold.addColorStop(1, '#7E5A10');
    ctx.strokeStyle = gold; ctx.lineWidth = 22; ctx.strokeRect(30, 30, w - 60, h - 60);
    ctx.lineWidth = 5; ctx.strokeRect(62, 62, w - 124, h - 124);
    ctx.strokeStyle = 'rgba(163,34,26,0.75)'; ctx.lineWidth = 2; ctx.strokeRect(80, 80, w - 160, h - 160);
    const cloud = (x, y, sx, sy) => {   // 귀퉁이 구름무늬(운문)
      ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy);
      ctx.strokeStyle = gold; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(34, 34, 22, Math.PI, Math.PI * 2.6); ctx.stroke();
      ctx.beginPath(); ctx.arc(34, 34, 10, Math.PI * 0.2, Math.PI * 1.8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(56, 34); ctx.quadraticCurveTo(90, 30, 110, 12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(34, 56); ctx.quadraticCurveTo(30, 90, 12, 110); ctx.stroke();
      ctx.restore();
    };
    cloud(66, 66, 1, 1); cloud(w - 66, 66, -1, 1); cloud(66, h - 66, 1, -1); cloud(w - 66, h - 66, -1, -1);

    ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // 3) 부두(符頭): 북두칠성 + 삼청 획
    const stars = [[300, 150], [360, 128], [420, 138], [470, 168], [520, 200], [590, 196], [632, 150]];
    ctx.lineWidth = 3; ctx.beginPath(); stars.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    stars.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill(); });
    ctx.lineWidth = 8; ctx.lineCap = 'round';
    [[w / 2 - 60, 235], [w / 2, 228], [w / 2 + 60, 235]].forEach(([x, y]) => { ctx.beginPath(); ctx.moveTo(x - 18, y); ctx.lineTo(x + 18, y - 4); ctx.stroke(); });
    ctx.font = `86px ${WISH_FONT}`; ctx.fillText('敕令', w / 2, 310);

    // 4) 소원 글자 (세로 두 자) — 붓 번짐 + 갈필
    const brushChar = (c, x, y, size) => {
      ctx.save(); ctx.font = `${size}px ${WISH_FONT}`;
      ctx.shadowColor = 'rgba(120,10,0,0.4)'; ctx.shadowBlur = 8; ctx.fillStyle = ink; ctx.fillText(c, x, y);
      ctx.shadowBlur = 0; ctx.globalAlpha = 0.35; ctx.fillStyle = inkDeep; ctx.fillText(c, x + 3, y + 2);
      ctx.restore();
    };
    brushChar(W.chars[0], w / 2, 590, 290);
    brushChar(W.chars[1], w / 2, 900, 290);
    // 먹 튐
    for (let i = 0; i < 26; i++) {
      const ang = rnd() * Math.PI * 2, dist = 150 + rnd() * 120, cx = w / 2 + Math.cos(ang) * dist, cy = 740 + Math.sin(ang) * dist * 1.4;
      ctx.globalAlpha = 0.25 + rnd() * 0.5; ctx.beginPath(); ctx.arc(cx, cy, 1.5 + rnd() * 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 5) 양옆 세로 글씨: 왼쪽 辟邪神犬 急急如律令 / 오른쪽 일주 + 보충 오행
    ctx.font = `44px ${WISH_FONT}`;
    const col = (txt, x, y0, gap) => [...txt].forEach((c, i) => ctx.fillText(c, x, y0 + i * gap));
    col('辟邪神犬', 150, 420, 56);
    ctx.font = `34px ${WISH_FONT}`; col('急急如律令', 150, 690, 46);
    ctx.font = `44px ${WISH_FONT}`; col(`${sj.iljuHanja}補${EL_HANJA[sj.ps.weakKey]}`, w - 150, 420, 56);
    ctx.font = `34px ${WISH_FONT}`; col('萬邪不侵', w - 150, 720, 46);
    // 세로 붉은 보조선
    ctx.lineWidth = 2; ctx.globalAlpha = 0.6;
    [[110, 400, 960], [w - 110, 400, 960]].forEach(([x, y0, y1]) => { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); });
    ctx.globalAlpha = 1;

    // 6) 아래 갈고리 획 + 소용돌이(나선)
    ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(w / 2, 1050); ctx.lineTo(w / 2, 1150); ctx.quadraticCurveTo(w / 2, 1180, w / 2 - 28, 1172); ctx.stroke();
    ctx.lineWidth = 4; ctx.beginPath();
    for (let t = 0; t < Math.PI * 5; t += 0.08) { const r = 4 + t * 4.2, x = w / 2 + 120 + Math.cos(t) * r, y = 1110 + Math.sin(t) * r; t === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
    ctx.beginPath();
    for (let t = 0; t < Math.PI * 5; t += 0.08) { const r = 4 + t * 4.2, x = w / 2 - 120 - Math.cos(t) * r, y = 1110 + Math.sin(t) * r; t === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();

    // 7) 날짜 + 낡은 도장
    const now = new Date();
    ctx.font = `40px ${WISH_FONT}`; const HN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
    ctx.fillText(`${yearGanji(now.getFullYear(), true)}年 ${HN[now.getMonth() + 1]}月 吉日`, w / 2, 1255);
    ctx.save(); ctx.translate(w / 2, 1360); ctx.rotate(-0.05);
    ctx.fillStyle = '#B3271D'; ctx.fillRect(-72, -72, 144, 144);
    ctx.strokeStyle = '#F6DFA4'; ctx.lineWidth = 4; ctx.strokeRect(-62, -62, 124, 124);
    ctx.fillStyle = '#F6DFA4'; ctx.font = `50px ${WISH_FONT}`;
    ctx.fillText('辟', -27, -25); ctx.fillText('邪', 27, -25); ctx.fillText('神', -27, 30); ctx.fillText('犬', 27, 30);
    ctx.globalCompositeOperation = 'destination-out';   // 인주가 덜 묻은 자국
    for (let i = 0; i < 60; i++) { ctx.globalAlpha = 0.25 + rnd() * 0.4; ctx.beginPath(); ctx.arc(-72 + rnd() * 144, -72 + rnd() * 144, 1 + rnd() * 4, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

    // 8) 금박 반짝임 띠
    const sheen = ctx.createLinearGradient(0, 0, w, h);
    sheen.addColorStop(0.42, 'rgba(255,255,255,0)'); sheen.addColorStop(0.5, 'rgba(255,248,210,0.18)'); sheen.addColorStop(0.58, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen; ctx.fillRect(0, 0, w, h);
  }

  async function saveWishWallpaper(sj, wishId) {
    const src = document.createElement('canvas');
    await drawWishTalisman(src, sj, wishId);
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
    const ctx = c.getContext('2d');
    const bg = ctx.createLinearGradient(0, 0, 0, 1920); bg.addColorStop(0, '#1A1C2E'); bg.addColorStop(1, '#0F1020');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 1080, 1920);
    ctx.save(); ctx.shadowColor = 'rgba(227,179,65,0.45)'; ctx.shadowBlur = 60;
    ctx.drawImage(src, 1080 / 2 - 405, 230, 810, 1350); ctx.restore();
    ctx.fillStyle = '#E3B341'; ctx.textAlign = 'center'; ctx.font = `44px ${WISH_FONT}`;
    ctx.fillText(`${WISHES[wishId].ko} 소원 부적 · ${sj.ilju}일주`, 540, 1690);
    ctx.fillStyle = 'rgba(244,238,226,0.6)'; ctx.font = `30px ${WISH_FONT}`; ctx.fillText('벽사신견이 물어다 준 부적', 540, 1750);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const fileName = `벽사신견_소원부적_${WISHES[wishId].ko}.png`;
    if (navigator.canShare && blob) {
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: '벽사신견 소원 부적' }); return; } catch (e) { /* 취소 시 내려받기 */ } }
    }
    const a = document.createElement('a'); a.download = fileName; a.href = URL.createObjectURL(blob); a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    showToast('🧧 소원 부적을 저장했다. 휴대폰 배경화면으로 걸어 두거라.');
  }

  let wishPicked = null;
  function renderWish() {
    const body = $('wishBody');
    X.withProfile(body, '소원 부적을 쓰려면 생년월일이 필요하다', p => drawWishPicker(p));
  }

  function drawWishPicker(p) {
    const body = $('wishBody');
    const sj = X.readSaju(p);
    const cards = Object.entries(WISHES).map(([id, W]) => `
      <button class="wish-card ${wishPicked === id ? 'is-on' : ''}" data-wish="${id}" aria-pressed="${wishPicked === id}">
        <span class="wish-seal" aria-hidden="true">${W.seal}</span>
        <span class="wish-name">${W.ko}</span>
        <span class="wish-desc">${W.desc}</span>
        ${isPaidFor('wish', personKeyOf(p) + '.' + id) ? '<span class="wish-owned">받음</span>' : ''}
      </button>`).join('');
    body.innerHTML = `
      ${X.profileLine(p, sj)}
      <div class="feature-card">
        <h3 class="feature-card-title">어떤 소원을 물어다 줄까</h3>
        <div class="wish-grid">${cards}</div>
      </div>
      <div id="wishStage"></div>`;
    body.querySelectorAll('.wish-card').forEach(b => { b.onclick = () => { wishPicked = b.dataset.wish; drawWishPicker(p); drawWishStage(p, wishPicked, true); }; });
    X.bindProfileLinks(body, renderWish);
    if (wishPicked) drawWishStage(p, wishPicked, false);
  }

  async function drawWishStage(p, wishId, scroll) {
    const stage = $('wishStage'); if (!stage) return;
    const sj = X.readSaju(p), W = WISHES[wishId], R = wishReading(sj, wishId);
    const key = personKeyOf(p) + '.' + wishId;
    const paid = isPaidFor('wish', key);
    stage.innerHTML = `
      <div class="feature-card wish-stage ${paid ? 'is-open' : 'is-sealed'}">
        <div class="wish-throw" aria-hidden="true"><img src="mung.jpg" alt=""></div>
        <div class="wish-talisman-wrap">
          <canvas class="wish-talisman" id="wishCanvas" width="900" height="1500" aria-label="${W.ko} 소원 부적"></canvas>
          ${paid ? '' : '<span class="wish-seal-band">封</span>'}
        </div>
        <p class="wish-caption">${paid ? `백구가 물어 온 <strong>${W.ko}</strong> 소원 부적` : `금테를 두른 건 소원 부적뿐이다. 백구가 <strong>${W.ko}</strong> 부적을 물고 대문 앞에 앉아 있다.`}</p>
      </div>
      <div id="wishText"></div>`;
    await drawWishTalisman($('wishCanvas'), sj, wishId);
    if (!paid) {
      $('wishText').innerHTML = sealCard({
        productId: 'wish', btnId: 'wishBuy',
        title: `${W.ko} 소원 부적 받기`,
        hook: `네 사주에서 ${W.ko}의 자리는 <strong>${R.label}</strong>로 드러난다. 이 숫자가 네 ${W.ko}에 무슨 뜻인지, 앞으로 열두 달 중 이 부적이 가장 힘을 쓰는 달이 언제인지는 봉인 안에 적어 두었다.`,
        items: ['금테 두른 <strong>소원 부적 원본</strong> + 휴대폰 <strong>배경화면</strong>(1080×1920) 저장', `네 사주로 본 <strong>${W.ko}의 자리</strong> 풀이`, `앞으로 12달 중 <strong>부적이 힘을 쓰는 달</strong> 3개`, '부적 쓰는 법 (방위 · 색 · 숫자)과 백구 한마디'],
        buttonLabel: `🧧 ${W.ko} 부적 받기`, bundleFrom: 'wish'
      });
      bindBundle($('wishText'), p, 'wish', { wishId });
      $('wishBuy').onclick = () => openProductModal('wish', {
        title: `🧧 ${W.ko} 소원 부적`,
        desc: `${esc(sj.ilju)}일주에 맞춘 금테 ${W.ko} 부적과 풀이가 열린다.`,
        provide: '결제 즉시 이 화면에서 열람 · 부적 이미지·배경화면 저장',
        again: '같은 기기·같은 생년월일·같은 소원이면 다시 열림',
        subjectKey: key, data: { p, wishId }
      });
      renderCouponLines();
    } else {
      const r = REMEDY(sj.ps.weakKey);
      $('wishText').innerHTML = `
        <div class="feature-card">
          <h3 class="feature-card-title">${W.ko}의 자리 · ${esc(R.label)}</h3>
          <p class="feature-text">${R.text}</p>
          <h4 class="cd-h">부적이 힘을 쓰는 달</h4>
          <p class="feature-text"><strong>${R.goodMonths.map(m => `${m.y !== new Date().getFullYear() ? m.y + '년 ' : ''}${m.m}월`).join(' · ')}</strong> — 이 달에 ${W.ko}에 관한 일을 시작하거나 결정하거라.${R.watch.length ? ` ${R.watch.map(m => `${m.m}월`).join(' · ')}에는 생활의 자리가 흔들리니 서두르지 마라.` : ''}</p>
          <h4 class="cd-h">부적 쓰는 법</h4>
          <ul class="ny-fields">
            <li>휴대폰 배경화면으로 걸어 두고, 아침에 한 번 눈을 맞추거라.</li>
            <li>중요한 일을 할 때는 <strong>${r.dir}</strong>을 바라보거라. 네게 모자란 ${EL_KO[sj.ps.weakKey]} 기운의 방위다.</li>
            <li><strong>${r.color}</strong> 계열을 몸에 지니면 좋다. 행운의 숫자는 <strong>${r.num}</strong>이다.</li>
          </ul>
          <p class="ny-say">"${WISH_SAY[wishId]}"</p>
          <button class="btn-talisman-download" id="wishSave">🧧 부적 배경화면 저장하기</button>
          <p class="feature-note">부적은 마음을 다잡는 전통 소품이며, 소원의 성취를 보장하지 않는다.</p>
        </div>`;
      $('wishSave').onclick = () => saveWishWallpaper(sj, wishId);
    }
    if (scroll) stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ═════════════════════════════════════════════════════════════════════
  // ④ 전부 묶음 보따리 (10,900원): 한 사람 기준 리포트·신년운세·소원 부적 5종·궁합 상세
  // ═════════════════════════════════════════════════════════════════════
  function bindBundle(root, p, from, extra) {
    if (!root) return;
    root.querySelectorAll('[data-bundle-from]').forEach(b => {
      if (hasBundle(p)) { b.remove(); return; }
      b.onclick = () => { closePaymentModal(); openBundle(p, from, extra); };
    });
  }

  function openBundle(p, from = 'shelf', extra = null) {
    if (!p) return;
    if (hasBundle(p)) { showToast('이 생년월일은 이미 보따리를 다 풀었다.'); return; }
    const sj = X.readSaju(p);
    const rows = BUNDLE_ITEMS.map(it => `<li><span>${it.text}</span><span class="bundle-each">${won(it.price)}원</span></li>`).join('');
    openProductModal('bundle', {
      title: '📦 백구의 전부 묶음 보따리',
      desc: `<strong>${esc(sj.ilju)}일주</strong>(${p.y}년 ${p.m}월 ${p.d}일) 한 사람 몫의 유료 풀이가 한 번에 모두 열린다.
        <ul class="bundle-list">${rows}</ul>
        <p class="bundle-sum">따로 사면 <s>${won(BUNDLE_LIST_TOTAL)}원</s> → 묶음 <strong>${won(PRODUCTS.bundle.price)}원</strong></p>
        <p class="feature-note">이미 따로 산 풀이가 있어도 묶음 가격은 같다. 다른 생년월일에는 열리지 않는다.</p>`,
      provide: '결제 즉시 리포트·신년운세·소원 부적 5종·궁합 상세가 이 화면에서 열림 · PDF·이미지 저장 가능',
      again: '같은 기기·같은 생년월일로 들어오면 모두 다시 열림',
      subjectKey: personKeyOf(p), data: { p, from, extra }
    });
  }

  /** 대문 진열의 '전부 묶음' */
  function openBundleFromShelf() {
    const p = loadProfile();
    if (!p) { showToast('보따리를 묶으려면 먼저 네 생년월일부터 알려 주거라.'); openMySaju(); return; }
    openBundle(p, 'shelf');
  }

  /** 묶음 결제 뒤: 보던 화면을 그대로 다시 그려 열린 모습을 보여 준다 */
  function afterBundle(d) {
    saveProfile(d.p);
    const vis = id => { const v = $(id); return !!v && v.style.display !== 'none'; };
    const msg = '📦 보따리가 풀렸다! 리포트·신년운세·소원 부적 5종·궁합 상세가 모두 열렸다.';
    if (d.from === 'report' && typeof currentSajuData !== 'undefined' && currentSajuData) { unlockContent(); showToast(msg); return; }
    if (d.from === 'compat' && d.extra) { openFeature('compat'); X.showCompatResult(d.extra.a, d.extra.b, d.extra.nameA, d.extra.nameB); }
    else if (d.from === 'wish') { if (d.extra) wishPicked = d.extra.wishId; openFeature('wish'); }
    else if (d.from === 'newyear' || vis('viewNewYear')) openFeature('newyear');
    else renderShopShelf();
    showToast(msg);
  }

  /** 휴대폰 결제 페이지에서 돌아왔을 때 보던 화면부터 다시 그린다 */
  function resumeBundle(d) {
    saveProfile(d.p);
    if (d.from === 'report' && d.extra) {
      const sj = d.extra;
      const set = (id, v) => { const el = $(id); if (el && v !== undefined && v !== null) el.value = v; };
      set('year', sj.y); set('month', sj.m); set('day', sj.d); set('hourSelect', String(sj.hourVal)); set('gender', sj.genderVal);
      set('userJob', sj.userJob); set('userMajor', sj.userMajor); set('userHobby', sj.userHobby); set('userDream', sj.userDream);
      submitAndGoToResult();
    } else if (d.from === 'compat' && d.extra) { openFeature('compat'); X.showCompatResult(d.extra.a, d.extra.b, d.extra.nameA, d.extra.nameB); }
    else if (d.from === 'wish') { if (d.extra) wishPicked = d.extra.wishId; openFeature('wish'); }
    else if (d.from === 'newyear') openFeature('newyear');
  }
  registerProduct('bundle', { onPaid: afterBundle, resume: resumeBundle });

  // ═════════════════════════════════════════════════════════════════════
  // 결제 연결 · 진입점
  // ═════════════════════════════════════════════════════════════════════
  registerProduct('newyear', {
    onPaid: p => { saveProfile(p); openFeature('newyear'); showToast('📜 봉인이 풀렸다. 열두 달을 차례로 읽어 내려가거라.'); },
    resume: p => { saveProfile(p); openFeature('newyear'); }
  });
  registerProduct('compat', {
    onPaid: d => { openFeature('compat'); X.showCompatResult(d.a, d.b, d.nameA, d.nameB); showToast('💞 두 사람의 상세 궁합이 열렸다.'); },
    resume: d => { openFeature('compat'); X.showCompatResult(d.a, d.b, d.nameA, d.nameB); }
  });
  registerProduct('wish', {
    onPaid: d => { saveProfile(d.p); wishPicked = d.wishId; openFeature('wish'); showToast('🧧 백구가 부적을 물어다 던졌다!'); },
    resume: d => { saveProfile(d.p); wishPicked = d.wishId; openFeature('wish'); }
  });

  X.registerFeature('newyear', 'viewNewYear', renderNewYear);
  X.registerFeature('wish', 'viewWish', () => { renderWish(); });

  /** 대문 '백구의 비방 보따리' 가격 표시 */
  function renderShopShelf() {
    document.querySelectorAll('[data-shop-price]').forEach(el => {
      const pr = priceFor(el.dataset.shopPrice);
      el.innerHTML = pr.coupon ? `<s>${won(pr.list)}원</s> ${won(pr.final)}원` : `${won(pr.list)}원`;
    });
    const ty = $('shopNewYearYear'); if (ty) ty.textContent = targetYear();
    const bl = $('shopBundleList'); if (bl) bl.textContent = `${won(BUNDLE_LIST_TOTAL)}원`;
    const bp = document.querySelector('[data-shop-price="bundle"]');
    if (bp && hasBundle(loadProfile())) { bp.textContent = '다 풀었다'; if (bl) bl.hidden = true; }
  }
  document.addEventListener('DOMContentLoaded', renderShopShelf);

  window.openBundleFromShelf = openBundleFromShelf;
  window.BYEOKSA_SHOP = { openBundle, openBundleFromShelf, afterCompat, renderShopShelf, newYearData, compatDetailData, wishReading, WISHES, NY, drawWishTalisman, targetYear };
})();

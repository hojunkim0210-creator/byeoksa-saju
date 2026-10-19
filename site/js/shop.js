/**
 * 벽사신견 유료 상품: 신년운세 · 궁합 상세 리포트 (+ 대문 '백구의 비방 보따리' 진열). 소원 부적은 2026-10-19 카드사 심사(부적 상품 불가)로 판매 중단
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
    const bundleLine = bundleFrom ? `<button class="btn-bundle" data-bundle-from="${bundleFrom}">📦 <span>이것까지 리포트·신년운세·궁합 상세 <strong>전부 ${won(PRODUCTS.bundle.price)}원</strong></span></button>` : '';
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
      <label class="pay-agree"><input type="checkbox" class="pay-agree-box" id="productPayAgree"> <span>위 상품 내용·가격·환불 규정을 확인했으며, 결제에 동의합니다. <strong>(필수)</strong></span></label>
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
  // 같은 십신이 한 해에 두 번 나오면 두 번째 문장을 쓴다 (한 화면 안에서 같은 말 반복 방지)
  // 같은 십신이 한 해에 세 번째로 나올 때 쓰는 할 일·조심 문장
  const NY_THIRD = {
    '비견': ['오래 연락 못 한 친구를 다시 찾기 좋은 달이다.', '경쟁 상대와 비교하며 조급해지기 쉽다. 네 속도를 지켜라.'],
    '겁재': ['정면 승부가 통하는 달이다. 기회가 오면 머뭇거리지 마라.', '주변의 부탁으로 지갑이 열리기 쉽다. 정한 금액만 쓰거라.'],
    '식신': ['배우던 것을 결과물로 묶어 내기 좋은 달이다.', '즐거운 약속이 많아 일이 밀리기 쉽다. 마감부터 챙겨라.'],
    '상관': ['기획과 제안이 통하는 달이다. 생각을 문서로 남겨 내밀어라.', '감정이 앞선 말이 오해를 부르기 쉽다. 글로 쓸 땐 한 번 더 읽어라.'],
    '편재': ['흩어진 돈을 한곳으로 모으기 좋은 달이다.', '남의 말만 믿고 움직이면 손해 보기 쉽다. 직접 확인하거라.'],
    '정재': ['미뤄 둔 정리를 끝내면 숨은 돈이 보이는 달이다.', '너무 아끼다 사람을 잃기 쉽다. 쓸 땐 시원하게 써라.'],
    '편관': ['큰 시험이나 평가를 치르기에 나쁘지 않은 달이다. 준비한 만큼 나온다.', '몸이 보내는 신호를 무시하기 쉽다. 쉬는 날을 꼭 정해 두거라.'],
    '정관': ['맡은 자리에서 인정받기 좋은 달이다. 한 걸음 더 책임을 져 보거라.', '규칙에 얽매여 기회를 놓치기 쉽다. 융통성을 조금 허락하거라.'],
    '편인': ['낯선 분야를 맛보기 좋은 달이다. 짧은 강의 하나로 시작하거라.', '혼자 있는 시간이 길어지기 쉽다. 일주일에 한 번은 사람을 만나라.'],
    '정인': ['선배나 스승의 조언이 길을 열어 주는 달이다.', '서류의 작은 실수가 일을 늦추기 쉽다. 제출 전에 다시 보거라.']
  };
  const NY_SAY2 = {
    '비견': '같은 길을 걷는 사람이 이번 달의 등불이다. 손을 내밀어 보거라.',
    '겁재': '네 몫을 노리는 손이 가깝다. 웃으며 거절하는 법을 익혀라.',
    '식신': '꾸준히 차린 밥상은 언젠가 손님을 부른다. 오늘도 한 숟갈 더 차려라.',
    '상관': '번뜩이는 생각은 적어 두고, 내뱉는 말은 한 번 걸러라.',
    '편재': '큰물이 들어올 때일수록 둑부터 살펴라.',
    '정재': '쌓는 사람은 흔들리지 않는다. 이번 달도 한 칸 더 쌓아라.',
    '편관': '버거운 달은 지나간다. 버틴 만큼 네 이름이 남는다.',
    '정관': '반듯하게 한 일은 누군가 반드시 본다. 서두르지 마라.',
    '편인': '혼자 파고드는 시간이 곧 네 무기를 벼리는 시간이다.',
    '정인': '배운 것은 도망가지 않는다. 오늘 한 줄이라도 읽어라.'
  };
  const NY_REL = {
    yukhap: ['네 일지와 합을 맺는 달이라 사람과 인연이 부드럽게 이어진다. 만남·화해·협업에 좋다.', '마음 맞는 사람과 손을 잡기 좋은 달이다. 미뤄 둔 연락을 먼저 해 보거라.', '틀어졌던 관계가 풀리기 쉬운 달이다. 사과든 고백이든 이때 꺼내거라.'],
    samhap: ['네 일지와 한 무리를 이루는 달이라 모임과 단체 일에서 힘을 얻는다.', '여럿이 함께하는 일에 운이 붙는 달이다. 혼자보다 팀으로 움직여라.', '새 모임이나 동호회에 발을 들이기 좋은 달이다. 귀한 얼굴이 섞여 있다.'],
    chung: ['네 일지와 부딪치는 달이라 집·연애·생활 리듬이 흔들리기 쉽다. 이사·큰 계약·이별 같은 결정은 서두르지 마라.', '생활의 자리가 다시 한번 흔들리는 달이다. 가까운 사람과 말다툼이 잦으니 말끝을 부드럽게 하거라.', '몸과 집안일이 동시에 바빠지기 쉬운 달이다. 일정을 비워 두고 무리한 약속은 미뤄라.']
  };
  const NY_FILL = [
    el => `네 사주에 모자란 <strong>${el}</strong> 기운이 채워지는 달이다. 미뤄 둔 결심을 이때 실행하거라.`,
    el => `빈자리였던 <strong>${el}</strong> 기운이 들어와 몸과 마음이 가벼워진다. 새 습관을 들이기 좋다.`,
    el => `<strong>${el}</strong> 기운이 보태져 막혔던 일이 풀리기 쉽다. 멈춰 둔 계획을 다시 꺼내거라.`,
    el => `모자란 <strong>${el}</strong> 기운이 차오르는 때다. 중요한 시작은 이 달에 맞추거라.`,
    el => `<strong>${el}</strong> 기운이 곁을 지키는 달이다. 지친 몸을 추스르고 힘을 모아 두거라.`,
    el => `한동안 비어 있던 <strong>${el}</strong> 기운이 다시 들어온다. 사람을 만나고 판을 넓혀도 좋은 때다.`,
    el => `<strong>${el}</strong> 기운이 밀려와 균형이 맞춰지는 달이다. 큰 결정을 내려도 흔들림이 적다.`,
    el => `<strong>${el}</strong> 기운이 한 번 더 보태지는 달이다. 앞서 시작한 일을 마무리 짓기 좋다.`,
    el => `부족했던 <strong>${el}</strong> 기운이 넉넉히 들어온다. 미뤄 둔 건강 검진이나 정리를 해 두거라.`,
    el => `<strong>${el}</strong> 기운이 도는 달이라 마음이 차분해진다. 공부와 계획 세우기에 좋다.`
  ];
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
    const occ = {}, relOcc = { yukhap: 0, samhap: 0, chung: 0 };
    let fillOcc = 0;
    const cards = D.months.map(m => {
      const t = NY[m.sipsin];
      const k = occ[m.sipsin] = (occ[m.sipsin] || 0) + 1;   // 이 십신이 올해 몇 번째로 나오는지
      const relKey = m.rel.chung ? 'chung' : m.rel.yukhap ? 'yukhap' : m.rel.samhap ? 'samhap' : '';
      const extra = relKey ? NY_REL[relKey][relOcc[relKey]++ % NY_REL[relKey].length] : '';
      const fillTxt = m.fill ? NY_FILL[fillOcc++ % NY_FILL.length](EL_KO[sj.ps.weakKey]) : '';
      const base = hash(`${sj.ilju}|${m.sipsin}`) % 2;   // 사람마다 첫 문장은 다르게, 두 번째 등장엔 반드시 다른 문장
      const good = k >= 3 ? NY_THIRD[m.sipsin][0] : t.good[(base + k - 1) % 2];
      const caution = k >= 3 ? NY_THIRD[m.sipsin][1] : t.caution[(base + k) % 2];
      const say = k % 2 === 1 ? t.say : NY_SAY2[m.sipsin];
      return `
        <article class="ny-month">
          <header><span class="ny-month-m">${mLabel(m)}</span><span class="ny-month-g">${m.ganji}(${m.ganjiHanja})월 · ${m.sipsin}</span><span class="ny-month-s">${m.score}점 · ${bandOf(m.score)}</span></header>
          <p><span class="ny-tag do">할 일</span>${good}</p>
          <p><span class="ny-tag avoid">조심</span>${caution}</p>
          ${extra ? `<p><span class="ny-tag rel">인연</span>${extra}</p>` : ''}
          ${fillTxt ? `<p><span class="ny-tag fill">보충</span>${fillTxt}</p>` : ''}
          <p class="ny-say">"${say}"</p>
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
    const YT = {
      good: ['두 사람의 기운이 손을 잡는 해. 여행·동거·큰 약속 같은 함께하는 결정에 좋다.', '함께 벌인 일이 순하게 굴러가는 해. 둘이 같이 모으는 돈이나 계획을 시작하거라.', '서로의 편이 되어 주기 쉬운 해. 가족·친구에게 두 사람을 소개하기 좋다.', '마음이 한곳으로 모이는 해. 오래 미뤄 둔 이야기를 꺼내 보거라.', '둘의 운이 서로를 끌어올리는 해. 한 사람의 좋은 일이 다른 사람에게도 번진다.', '손발이 척척 맞는 해. 같이 배우거나 같이 만드는 일을 하나 시작해 보거라.'],
      bad: [w => `${w}의 생활 자리가 흔들리는 해. 서로의 변화를 다그치지 말고 기다려 주거라.`, w => `${w}에게 이사·이직 같은 변화가 몰리는 해. 결정은 함께 상의하고 천천히 하거라.`, w => `${w}의 마음이 예민해지기 쉬운 해. 사소한 말에 서운함이 쌓이지 않게 자주 묻거라.`, w => `${w}에게 바깥일이 몰려 둘의 시간이 줄어드는 해. 짧아도 매일 연락하는 약속을 지키거라.`, w => `${w}의 기운이 들쑥날쑥한 해. 큰 다툼은 하룻밤 자고 나서 이야기하거라.`, w => `${w}에게 피로가 쌓이는 해. 서운함을 따지기 전에 먼저 쉬게 해 주거라.`],
      flat: ['크게 흔들리지도 붙지도 않는 해. 둘이 정한 대로 꾸준히 가면 된다.', '조용히 쌓이는 해. 작은 기념일을 챙기는 것만으로 충분하다.', '무난하게 흘러가는 해. 함께하는 습관 하나를 만들어 두거라.', '잔잔한 물처럼 고요한 해. 이럴 때 둘만의 계획을 차분히 세워 두거라.', '별일 없이 지나가는 해. 그 평범함을 지루함으로 오해하지 말거라.', '숨 고르기 좋은 해. 서로에게 고마웠던 일을 한 번씩 말로 꺼내 보거라.']
    };
    const yc = { good: 0, bad: 0, flat: 0 };
    const yearLi = D.years.map(y => {
      const kind = y.good ? 'good' : y.bad ? 'bad' : 'flat';
      const arr = YT[kind], txt = arr[yc[kind]++ % arr.length];
      return `<li class="${y.good ? 'good' : y.bad ? 'bad' : ''}"><strong>${y.y}년</strong> ${yearGanji(y.y)}년 — ${typeof txt === 'function' ? txt(esc(y.who)) : txt}</li>`;
    }).join('');
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
        <p class="feature-text">${D.placeA === D.placeB
          ? `두 사람 모두 <strong>${D.placeA}</strong>${josa(D.placeA, '이')} 기운을 채우는 곳이다. 둘이 같이 가 보고, 그날은 <strong>${D.colorA}</strong> 옷이나 소품을 맞춰 걸쳐 보거라.`
          : `${esc(nameA)}에게는 <strong>${D.placeA}</strong>, ${esc(nameB)}에게는 <strong>${D.placeB}</strong>${josa(D.placeB, '이')} 기운을 채우는 곳이다. 번갈아 가 보고, 그날은 <strong>${D.colorA}</strong>${josa(D.colorA, '과')} <strong>${D.colorB}</strong>${josa(D.colorB, '을')} 하나씩 걸쳐 보거라.`}</p>
        <p class="ny-say">"궁합은 정해진 답이 아니라 서로를 읽는 지도다. 지도를 봤으면 이제 같이 걷거라."</p>
        <p class="feature-note">전통 명리 해석을 바탕으로 한 재미 풀이이며, 두 사람의 관계를 정해 주지 않는다.</p>
      </div>`;
  }

  // ═════════════════════════════════════════════════════════════════════
  // ④ 전부 묶음 보따리 (10,900원): 한 사람 기준 리포트·신년운세·궁합 상세
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
      provide: '결제 즉시 리포트·신년운세·궁합 상세가 이 화면에서 열림 · PDF 저장 가능',
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
    const msg = '📦 보따리가 풀렸다! 리포트·신년운세·궁합 상세가 모두 열렸다.';
    if (d.from === 'report' && typeof currentSajuData !== 'undefined' && currentSajuData) { unlockContent(); showToast(msg); return; }
    if (d.from === 'compat' && d.extra) { openFeature('compat'); X.showCompatResult(d.extra.a, d.extra.b, d.extra.nameA, d.extra.nameB); }
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

  X.registerFeature('newyear', 'viewNewYear', renderNewYear);

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
  window.BYEOKSA_SHOP = { openBundle, openBundleFromShelf, afterCompat, renderShopShelf, newYearData, compatDetailData, NY, targetYear };
})();

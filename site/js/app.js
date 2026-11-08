// Saju App UI & Event Handler
const {
  STEMS, BRANCHES, NOBLE_PEOPLE, ELEMENT_REMEDIES, UNSUNG_NAMES,
  isValidDate, getManAge, getUnsung, getSipsin, getSinsal,
  calculateMonthPillar, calculateFourPillars, calculateOheng, calculateDaeun, calculateKpi
} = (typeof SajuCore !== 'undefined' ? SajuCore : (typeof window !== 'undefined' ? window.SajuCore : {}));

  // 🗓️ 현재 연도 기준 동적 연도 (하드코딩 제거)
  const NOW_Y = new Date().getFullYear();
  const Y_PAST1 = NOW_Y - 2, Y_PAST2 = NOW_Y - 1;          // "불과 1~2년 전"
  const Y_R0 = NOW_Y, Y_R1 = NOW_Y + 1, Y_R2 = NOW_Y + 2;  // 3개년 로드맵
  let CUR_AGE = 30;
  const isYoung = () => CUR_AGE < 19;
  function yearGanji(y, useHanja) {
    const s = ((y - 4) % 10 + 10) % 10, b = ((y - 4) % 12 + 12) % 12;
    return useHanja ? STEMS[s].hanja + BRANCHES[b].hanja : STEMS[s].char + BRANCHES[b].char;
  }
  // ─────────────────────────────────────────────────────────────────────────
  // 💰 판매 설정 — 가격과 이벤트 문구는 여기 한 곳에서만 바꾼다.
  //   화면의 가격·이벤트 표시는 모두 이 값에서 나오므로, 표시가 실제 판매 조건과 어긋나지 않는다.
  //   (기준 정가에 취소선을 긋는 표시나 '오늘 자정까지' 같은 반복 마감 문구는 쓰지 않는다)
  // ─────────────────────────────────────────────────────────────────────────
  const SALE = {
    price: 4900,                  // 원
    eventName: '',  // 이벤트가 없으면 '' (배지 숨김). 2026-11-09 업데이트 44: 실제 혜택·기간이 없던 '오픈 기념 이벤트' 띠를 내림(더블체크 3-3, 대표님 OK)
    eventEndsOn: null             // 종료일이 정해지면 'YYYY-MM-DD'. 지나면 이벤트 표시가 자동으로 꺼진다
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 💳 결제 설정 — 결제대행사(PG) 계약 후 포트원(PortOne) 관리자 콘솔에서 값을 받아 여기만 채운다
  //   mode: 'test'    = 지금처럼 "테스트로 봉인 해제" 버튼 (실제 돈이 나가지 않음)
  //         'portone' = 실제 결제창 (storeId·channelKey 필수)
  //   verifyUrl: 결제 확인 서버 주소. Cloudflare Pages로 옮기면 '/api/payment/complete' (functions/ 폴더)
  //              비워 두면 결제창의 성공 응답만 보고 연다 (서버가 생기기 전 임시)
  // ─────────────────────────────────────────────────────────────────────────
  const PAYMENT = {
    mode: 'portone',
    storeId: 'store-67ebf046-cd7c-4e32-972a-458803ee77e0',
    channelKey: 'channel-key-5ab4bb46-ee2f-4c04-852e-c7f3688834df',   // NHN KCP 실연동 채널 (사이트코드 IPD5B, V2)
    payMethod: 'CARD',
    kakaoPay: { enabled: false, channelKey: '' },   // 카카오페이(KCP 간편결제 허브형, 2026-11-01 준비만). KCP 승인 뒤 enabled: true 로 켠다. KCP가 별도 사이트코드를 내주면 포트원 콘솔에 그 채널을 추가하고 채널 키를 channelKey 에 적는다(비우면 위 KCP 채널 그대로)
    orderName: '벽사신견 천명 리포트',
    verifyUrl: '/api/payment/complete'   // Cloudflare Pages 결제 확인 서버 (포트원 비밀 값은 Cloudflare 환경 변수에만)
  };
  const CONTACT_EMAIL = 'pathlogue.help@gmail.com';

  function renderSale() {
    const priceText = SALE.price.toLocaleString('ko-KR');
    document.querySelectorAll('.sale-price').forEach(el => { el.textContent = priceText; });
    let ends = null;
    if (SALE.eventEndsOn) { const [y, m, d] = SALE.eventEndsOn.split('-').map(Number); ends = new Date(y, m - 1, d, 23, 59, 59); }
    const active = !!SALE.eventName && (!ends || new Date() <= ends);
    document.querySelectorAll('.sale-event-name').forEach(el => { el.textContent = SALE.eventName; el.style.display = active ? '' : 'none'; });
    document.querySelectorAll('.sale-event-badge').forEach(el => { el.style.display = active ? '' : 'none'; });
    const sub = document.getElementById('saleSub');
    if (sub) {
      const keep = '결제 후 열리는 리포트는 PDF로 저장해 소장할 수 있습니다';
      sub.textContent = (active && ends) ? `이벤트 기간 ~ ${ends.getMonth() + 1}월 ${ends.getDate()}일 · ${keep}` : keep;
    }
  }
  document.addEventListener('DOMContentLoaded', renderSale);

  /** 카카오페이 버튼을 보일지: 실결제 모드이고, KCP 승인 뒤 PAYMENT.kakaoPay.enabled 를 켠 때만 (shop.js의 상품 결제창도 이걸 본다) */
  function kakaoPayOn() { return PAYMENT.mode === 'portone' && !!(PAYMENT.kakaoPay && PAYMENT.kakaoPay.enabled); }

  /** 결제창 버튼·안내를 결제 모드에 맞춘다 */
  function renderPaymentMode() {
    const live = PAYMENT.mode === 'portone';
    const btn = document.getElementById('payButton');
    if (btn) { btn.textContent = live ? `💳 ${won(priceFor('report').final)}원 결제하고 봉인 풀기` : '테스트로 봉인 해제해보기'; tidyTitles(btn.parentElement); }
    const kb = document.getElementById('payKakaoButton');   // 스위치가 꺼져 있으면 숨긴 채로 둔다 (index.html의 style="display:none")
    if (kb) { kb.style.display = kakaoPayOn() ? '' : 'none'; kb.textContent = `카카오페이로 ${won(priceFor('report').final)}원 결제하기`; }
    const note = document.getElementById('paymentTestNote');
    if (note) note.hidden = live;
  }
  document.addEventListener('DOMContentLoaded', renderPaymentMode);

  // ─────────────────────────────────────────────────────────────────────────
  // 🐾 사주 맞춤 문장 데이터 — 같은 판정이 모든 사람에게 나오지 않도록
  //   키: 일간 오행(dmEl) / 가장 모자란 오행(weakKey) / 재성 개수 / 그해 간지와의 십신·충
  //   원칙: 기존 문장은 지우지 않고 한 유형으로 남기며, 나머지 유형을 같은 말투로 추가한다.
  // ─────────────────────────────────────────────────────────────────────────
  const EL_KEYS = ['wood', 'fire', 'earth', 'metal', 'water'];
  const EL_KO = { wood: '목(木)', fire: '화(火)', earth: '토(土)', metal: '금(金)', water: '수(水)' };
  const EL_NAME = { wood: '나무', fire: '불', earth: '흙', metal: '쇠', water: '물' };
  // 십신 이름 → 손님용 쉬운 말 (2026-11-02 쉬운 말 3단계): sipsinPlain('정관') = '책임과 자리가 무거워지는 운(정관)'
  const SIPSIN_PLAIN = { '비견': '내 편이자 경쟁자가 느는 운', '겁재': '내 몫을 노리는 손이 느는 운', '식신': '재주와 먹을 복이 열리는 운', '상관': '말과 재주가 밖으로 튀는 운', '편재': '큰돈이 오가는 운', '정재': '꾸준한 돈이 쌓이는 운', '편관': '압박과 시험이 닥치는 운', '정관': '책임과 자리가 무거워지는 운', '편인': '남다른 공부와 촉이 깨는 운', '정인': '배움과 보호를 받는 운' };
  const sipsinPlain = n => (SIPSIN_PLAIN[n] ? `${SIPSIN_PLAIN[n]}(${n})` : n);
  // 대운 칸처럼 좁은 자리용 짧은 쉬운 말 (업데이트 39, 검수 7번): 칸에는 '책임 운(정관)'처럼
  const SIPSIN_SHORT = { '비견': '동료 운', '겁재': '경쟁 운', '식신': '재주 운', '상관': '말재주 운', '편재': '큰돈 운', '정재': '꾸준한 돈 운', '편관': '시험 운', '정관': '책임 운', '편인': '촉 운', '정인': '배움 운' };
  // 귀인 띠 고르기 (2026-11-03 대표님 점검 "띠가 같게 나온다"): 천을귀인 두 띠 중 첫째만 늘 나오던 것을, 태어난 날의 글자와 합이 되는 띠를 앞세우고(없으면 글자 홀짝으로) 사람마다 다르게
  function noblesFor(dayStemIdx, dayBranchIdx) {
    const pair = (NOBLE_PEOPLE[dayStemIdx] || ['소띠(축)', '양띠(미)']).slice();
    if (dayBranchIdx == null || dayBranchIdx < 0 || !SajuCore.branchRelation) return pair;
    const idxOf = s => BRANCHES.findIndex(b => s.includes('(' + b.char + ')'));
    const score = s => { const i = idxOf(s); if (i < 0) return 0; const r = SajuCore.branchRelation(dayBranchIdx, i); return (r.yukhap ? 3 : 0) + (r.samhap ? 2 : 0) - (r.chung ? 3 : 0); };
    const sa = score(pair[0]), sb = score(pair[1]);
    if (sa === sb) return dayBranchIdx % 2 ? [pair[1], pair[0]] : pair;
    return sa > sb ? pair : [pair[1], pair[0]];
  }
  // 멀리할 사람의 냄새 제목 (2026-11-03): 음간(을·정·신·계)은 phrases.js RUIN_YIN의 제목으로 — 같은 오행이라고 다섯 명 중 셋이 같은 제목을 받지 않게
  function ruinTitleFor(ps, c) { const PH = window.BYEOKSA_PHRASES; const y = c && c.yin === 1 && PH && PH.RUIN_YIN && PH.RUIN_YIN[c.stemChar]; return (y && y.title) || RUIN_LOVERS[ps.dmEl].title; }   // 손님용 쉬운 이름 (2026-11-02 쉬운 말)
  // 원래 문장 보관함 — 각 화면이 그릴 때 채우고, phrases.js가 '한 갈래'로 그대로 쓴다
  const ORIG = {};

  // 즉시 손절해야 할 3대 악연 — 일간 오행별 (수(水) 유형 = 원래 문장)
  const ENEMY_TYPES = {
    wood: [
      `<strong>"같이 하자"</strong>며 판을 벌여 놓고, 정작 결실이 나면 그대 이름을 슬쩍 지우고 제 공으로 가로채는 자.`,
      `그대 아이디어를 듣자마자 "그거 나도 생각했던 건데"라며 먼저 떠벌리고 다니는 자.`,
      `그대가 뻗어나가려 할 때마다 "아직 때가 아니다"라며 발목을 잡아 제자리에 묶어두려는 자.`
    ],
    fire: [
      `힘들 때만 <strong>"너밖에 없다"</strong>며 매달리다가, 제 살길을 찾으면 연락을 뚝 끊어버리는 자.`,
      `그대 열정과 호의를 당연한 듯 받아먹고, 고맙다는 말 한마디 없이 더 큰 것을 요구하는 자.`,
      `그대가 지쳐 쓰러지면 "원래 네가 오지랖 부린 거잖아"라며 뒤에서 험담을 퍼뜨리는 자.`
    ],
    earth: [
      `그대가 묵묵히 받아주는 걸 알고 온갖 하소연과 짜증을 쏟아붓는, 그대를 <strong>'감정 쓰레기통'</strong> 취급하는 자.`,
      `일이 잘되면 제 덕, 일이 틀어지면 슬그머니 그대에게 책임과 누명을 떠넘기는 자.`,
      `빌려 간 돈과 시간은 기억하지 못하면서, 그대가 거절한 단 한 번은 끝까지 물고 늘어지는 자.`
    ],
    metal: [
      `그대가 마음을 열고 털어놓은 치부를 쥐고 있다가 <strong>결정적인 순간에 칼날처럼 휘두르는</strong> 자.`,
      `겉으로는 그대 완벽함을 치켜세우면서, 뒤에서는 작은 실수 하나를 부풀려 퍼뜨리는 자.`,
      `"너 그거 감당할 수 있겠어?"라며 그대 결단의 순간마다 의심의 독을 한 방울씩 떨어뜨리는 자.`
    ],
    water: [
      `<strong>"다 너 잘되라고 하는 말인데"</strong>라며 그대 자신감을 깎아내리고 가스라이팅하는 자.`,
      `밥 한 끼, 커피 한 잔도 은근슬쩍 그대에게 계산을 미루며 그대 재물운의 기운을 갉아먹는 자.`,
      `그대 약점이나 실수를 기억해 두었다가 남들 앞에서 장난처럼 터뜨려 그대 위신을 깎는 자.`
    ]
  };

  // 피해야 할 파멸의 연인 — 일간을 극(剋)하는 기운의 체취 (목(木) 일간 = 원래 문장: 금(金)의 쇠비린내)
  const RUIN_LOVERS = {
    wood: {
      title: '피비린내와 눅눅한 곰팡이 냄새',
      scent: '겉으로는 비싼 향수나 매력적인 언변으로 포장하지만, 조금만 깊이 교류해보면 바닥에 고인 썩은 물과 쇠비린내가 진동하는 자라오.',
      trait: `그대 자존감을 은근히 갉아먹으며 '너는 나 없으면 아무것도 아니야'라는 불안을 주입하오. 그대가 잘나갈 땐 질투로 눈빛이 싸늘해지고, 그대가 주저앉을 때만 우월감을 느끼며 동정하는 척하오.`
    },
    fire: {
      title: '차갑게 고인 물비린내와 꺼진 촛농 냄새',
      scent: '처음엔 서늘하고 신비로운 분위기로 끌어당기지만, 가까이 갈수록 축축한 냉기가 스며들어 그대 안의 불씨를 하나씩 꺼뜨리는 자라오.',
      trait: `그대 들뜬 열정에 '현실을 봐'라며 찬물을 끼얹고, 그대가 웃을수록 무심한 침묵으로 벌을 주오. 결국 그대는 그 사람의 기분을 살피느라 그대 빛을 스스로 끄게 되오.`
    },
    earth: {
      title: '풋내 뒤에 숨은 썩은 나무뿌리 냄새',
      scent: '싱그럽고 활기찬 첫인상으로 다가오지만, 뿌리를 내리는 순간 그대 땅의 양분을 빨아올리며 제 키만 키우는 자라오.',
      trait: `그대 시간과 돈, 인맥을 제 성장의 거름으로 쓰면서 '우리 둘을 위한 것'이라 포장하오. 그대가 지쳐 메말라 갈 때쯤 더 기름진 땅을 찾아 떠나오.`
    },
    metal: {
      title: '달콤한 향 뒤에 숨은 매캐한 탄내',
      scent: '뜨겁고 강렬한 매력으로 단숨에 마음을 녹이지만, 곁에 오래 있을수록 옷깃에 그을음이 배듯 그대 원칙과 자존심이 녹아내리는 자라오.',
      trait: `불같이 사랑하다가도 제 뜻대로 안 되면 화염처럼 분노를 쏟아내 그대를 길들이오. 그대가 지켜온 기준과 선을 '사랑이면 이 정도는'이라며 하나씩 태워 없애오.`
    },
    water: {
      title: '흙탕물처럼 텁텁한 진흙 비린내',
      scent: '듬직하고 안정적인 척 다가오지만, 함께할수록 맑던 그대 생각이 흙탕물처럼 탁해지고 발이 진창에 빠진 듯 무거워지는 자라오.',
      trait: `'다 너를 지켜주려고'라며 그대 선택과 동선을 하나하나 막아세우오. 그대 흐름을 둑처럼 가로막아, 결국 그대는 어디로도 흘러가지 못한 채 고여 썩어가오.`
    }
  };

  // 너를 살려낼 천생연분 — 네게 가장 모자란 오행을 채워주는 체취 (목(木) 보충 = 원래 문장)
  const SOULMATE_SCENTS = {
    wood: {
      short: '맑은 솔잎 흙내',
      title: '비 온 뒤 솔숲의 맑은 흙 냄새',
      scent: '화려한 말재주는 없어도, 그 사람 곁에 가만히 앉아 있기만 해도 목덜미의 서늘한 긴장감이 봄눈 녹듯 스르륵 풀리는 사람이오. 깊은 산속 젖은 흙내와 청량한 솔잎 향을 풍기오.'
    },
    fire: {
      short: '따스한 장작불 내음',
      title: '겨울밤 아궁이의 따스한 장작불 냄새',
      scent: '말수는 적어도 그 사람이 곁에 있으면 꽁꽁 언 손끝부터 서서히 데워지는 사람이오. 마른 장작이 타닥거리며 타는 포근한 불 냄새와 갓 지은 밥 냄새를 풍기오.'
    },
    earth: {
      short: '구수한 볏짚 내음',
      title: '햇볕에 잘 말린 볏짚과 구수한 누룩 냄새',
      scent: '요란하게 다가오지 않지만, 흔들리는 그대를 넓은 들판처럼 받아주는 사람이오. 가을 햇살에 말린 볏짚과 장독대의 구수한 냄새를 풍기오.'
    },
    metal: {
      short: '서늘한 놋그릇 향',
      title: '새벽 서리 머금은 놋그릇의 서늘한 쇠 향',
      scent: '흐트러진 그대 하루에 선을 그어주고, 망설일 때 단호하게 길을 짚어주는 사람이오. 새벽 서리와 깨끗이 닦인 놋그릇의 맑고 서늘한 향을 풍기오.'
    },
    water: {
      short: '맑은 물안개 향',
      title: '새벽 계곡물에 씻긴 이끼와 물안개 냄새',
      scent: '조용히 그대 말을 끝까지 들어주며, 달아오른 머리를 차분히 식혀주는 사람이오. 깊은 계곡의 맑은 물소리와 촉촉한 물안개 향을 풍기오.'
    }
  };

  // 밤마다 숨통을 조이는 함정 — 가장 모자란 오행이 만드는 마음의 구멍
  const NIGHT_TRAP_BY_WEAK = {
    wood: '그대 원국에는 위로 뻗어 오르는 목(木)의 기운이 모자라오. 그래서 결심은 수십 번 해도 첫 삽을 뜨는 순간마다 망설이며 내일로, 또 내일로 미뤄왔소. 그 미룬 날들이 밤마다 빚쟁이처럼 찾아와 그대 숨통을 조인 것이오.',
    fire: '그대 원국에는 활활 타오르는 화(火)의 기운이 모자라오. 그래서 남들 앞에선 웃어도 혼자가 되면 불씨가 꺼진 아궁이처럼 의욕이 싸늘하게 식어 버리오. 그 냉기가 밤마다 이불 속까지 스며든 것이오.',
    earth: '그대 원국에는 중심을 잡아주는 토(土)의 기운이 모자라오. 그래서 작은 말 한마디에도 발밑이 꺼지는 것처럼 흔들리고, 기댈 곳을 찾아 밤새 마음이 떠돌았소. 그 허공이 그대 잠을 갉아먹은 것이오.',
    metal: '그대 원국에는 맺고 끊는 금(金)의 기운이 모자라오. 그래서 끊어내야 할 사람과 미련을 단칼에 베지 못하고, 밤마다 그 얼굴들을 다시 불러내 곱씹어왔소. 그 무딘 칼날이 그대 마음을 베어온 것이오.',
    water: '그대 원국에는 열기를 식혀주는 수(水)의 기운이 모자라오. 그래서 머릿속이 과열된 엔진처럼 꺼지지 않고, 누워서도 생각이 생각을 낳으며 새벽까지 달려왔소. 그 열기가 그대 잠을 태워버린 것이오.'
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 🧭 사람 정보 묶음(CUR) — 문장을 고를 때 쓰는 모든 열쇠를 한 번에 계산한다 (phrases.js가 이것을 받는다)
  //   일간 10 · 음양 · 일지 12 · 삼합 그룹 · 역마/도화/화개 · 12운성 세기 · 월지 · 가장 짙은 십신 · 모자란 오행 · 재성 수 ·
  //   꿈의 자리 · 지난 두 해와 앞으로 세 해의 십신 · 생년월일 해시
  // ─────────────────────────────────────────────────────────────────────────
  let CUR = null;
  function buildProfile(pillars, oheng, u) {
    const PH = window.BYEOKSA_PHRASES;
    const ps = getPersona(pillars.dStemIdx, pillars.dBranchIdx, oheng);
    const counts = (oheng && oheng.counts) || {};
    const grp = sipsinGroupCounts(ps.dmEl, counts);
    const domGroup = ['bi', 'sik', 'jae', 'gwan', 'in'].reduce((a, k) => (grp[k] > grp[a] ? k : a), 'bi');
    const leakKey = ['bi', 'sik', 'gwan', 'in'].reduce((a, k) => (grp[k] > grp[a] ? k : a), 'bi');
    const unsung = getUnsung(pillars.dStemIdx, pillars.dBranchIdx);
    const yStemOf = y => ((y - 4) % 10 + 10) % 10;
    const sip = y => getSipsin(pillars.dStemIdx, yStemOf(y));
    const dream = u.dream || '이루고픈 천명';
    const fit = calculateDreamFit(pillars.dStem, pillars.dBranch, oheng, dream);
    // 해시 뒷자리가 같은 꼬리글자에 끌려 겹치지 않도록 한 번 더 섞는다 (murmur3 마무리)
    const mix = h => { h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16; return h >>> 0; };
    const seed = mix(SajuCore.hashSeed(`${pillars.dStemIdx}${pillars.dBranchIdx}|${u.y}-${u.m}-${u.d}-${u.hour}-${u.gender}`));
    const nobles = noblesFor(pillars.dStemIdx, pillars.dBranchIdx);
    return {
      stemIdx: pillars.dStemIdx, stemChar: pillars.dStem.char, stemEl: ps.dmEl, yin: pillars.dStemIdx % 2,
      stemImage: ({ '갑': '큰 나무(甲木)', '을': '담쟁이(乙木)', '병': '태양(丙火)', '정': '촛불(丁火)', '무': '큰 산(戊土)', '기': '기름진 땅(己土)', '경': '무쇠(庚金)', '신': '보석(辛金)', '임': '큰물(壬水)', '계': '안개비(癸水)' })[pillars.dStem.char],
      branchIdx: pillars.dBranchIdx, branchChar: pillars.dBranch.char, branchEl: pillars.dBranch.el,
      branchGroup: PH.branchGroup(pillars.dBranchIdx), branchKind: PH.branchKind(pillars.dBranchIdx),
      ilju: `${pillars.dStem.char}${pillars.dBranch.char}`,
      monthBranchIdx: pillars.mBranchIdx, yearBranchIdx: BRANCHES.indexOf(pillars.yBranch),
      unsung, unsungPlain: UNSUNG_PLAIN[unsung] || '', strength: PH.unsungStrength(unsung),
      weakKey: ps.weakKey, weakCount: counts[ps.weakKey] || 0, wealthEl: ps.wealthEl, wealthCount: ps.wealthCount,
      counts, groups: grp, domGroup, leakKey, gwanCount: grp.gwan,
      dreamRel: fit.rel, dream, job: u.job || '현재의 신분', major: u.major || '갈고닦는 무기', hobby: u.hobby || '숨 쉬는 구멍',
      // 적지 않은 칸은 대괄호 자리 표시 대신 자연스러운 말로
      jobLabel: (u.job && u.job !== '현재의 신분') ? `[${u.job}]` : '지금 그대 자리', majorLabel: (u.major && u.major !== '갈고닦는 무기') ? `[${u.major}]` : '그대가 갈고닦는 것',
      hobbyLabel: (u.hobby && u.hobby !== '숨 쉬는 구멍') ? `[${u.hobby}]` : '그대가 틈틈이 하는 그 일',
      gender: u.gender, age: NOW_Y - (+u.y || NOW_Y), young: isYoung(), hourKnown: u.hour >= 0,
      // 시주(태어난 시의 기둥): 시간을 알 때만. 글이 시간에도 반응하게 (2026-10-24)
      hourSipsin: (pillars.hStemIdx !== null && pillars.hStemIdx !== undefined) ? getSipsin(pillars.dStemIdx, pillars.hStemIdx) : null,
      hourGanji: pillars.hStem && pillars.hBranch ? `${pillars.hStem.char}${pillars.hBranch.char}` : '',
      hourBranchIdx: (pillars.hBranchIdx !== null && pillars.hBranchIdx !== undefined) ? pillars.hBranchIdx : -1,
      seed, noble: nobles[0], nobles,
      remedy: ELEMENT_REMEDIES[ps.weakKey] || ELEMENT_REMEDIES.water,
      loveScent: SOULMATE_SCENTS[ps.weakKey].short,
      Y: { P1: Y_PAST1, P2: Y_PAST2, R0: Y_R0, R1: Y_R1, R2: Y_R2 },
      yearSipsin: { P1: sip(Y_PAST1), P2: sip(Y_PAST2), R0: sip(Y_R0), R1: sip(Y_R1), R2: sip(Y_R2) },
      josa, ganji: y => yearGanji(y), EL_KO, EL_NAME, orig: ORIG,
      sipsinGroup: name => SIPSIN_GROUP[name],
      get daeunSipsin() { return lastDaeun && lastDaeun.item ? lastDaeun.item.sipsin : null; },
      get daeunGroup() { return lastDaeun && lastDaeun.item ? SIPSIN_GROUP[lastDaeun.item.sipsin] : null; }
    };
  }
  /** 문장 고르기: 표(배열이면 해시, 객체면 열쇠)에서 이 사람 것을 꺼내 글로 만든다 */
  function ph(table, key, c, salt) {
    const PH = window.BYEOKSA_PHRASES;
    let v = Array.isArray(table) ? PH.pick(table, c.seed, salt || 0) : table[key];
    if (Array.isArray(v)) v = PH.pick(v, c.seed, (salt || 0) + 1);
    return typeof v === 'function' ? v(c) : v;
  }

  /** 한국어 조사: 마지막 한글 글자의 받침에 따라 고른다. josa('정재','으로') → '로'
   *  끝의 괄호 풀이는 건너뛰고 괄호 앞 낱말에 맞춘다: josa('운(정재)','으로') → '으로', josa('소띠(축)','을') → '를' (업데이트 39, 검수 12번) */
  function josa(word, kind) {
    const base = String(word).replace(/(\s*\([^()]*\))+\s*$/, '');
    const m = (/[가-힣]/.test(base) ? base : String(word)).replace(/[^가-힣]+$/g, '').match(/[가-힣](?=[^가-힣]*$)/);
    const ch = m ? m[0].charCodeAt(0) - 0xAC00 : -1;
    const jong = ch >= 0 ? ch % 28 : 0;          // 0 = 받침 없음, 8 = ㄹ
    const has = jong !== 0;
    switch (kind) {
      case '으로': return (has && jong !== 8) ? '으로' : '로';
      case '을': return has ? '을' : '를';
      case '이': return has ? '이' : '가';
      case '은': return has ? '은' : '는';
      case '과': return has ? '과' : '와';
      default: return '';
    }
  }

  // 그해 천간이 일간에게 들어오는 십신 10가지별 해설 (같은 계열이 연달아 와도 문장이 겹치지 않게)
  const YEAR_SIPSIN_TEXT_10 = {
    '비견': '어깨를 나란히 할 동료와 경쟁자가 한꺼번에 몰려드는 해라오. 손잡을 자와 경계할 자를 칼같이 가리시오.',
    '겁재': '그대 몫을 노리는 손이 가까이 다가오는 해라오. 동업과 보증, 돈거래만은 두 번 세 번 따져보시오.',
    '식신': '타고난 재주가 자연스럽게 밥이 되는 해라오. 즐겨 하던 일을 꾸준히 쌓으면 그것이 곧 그대 밥그릇이 되오.',
    '상관': '말과 재능이 밖으로 터져 나오는 해라오. 만들고 드러내되, 윗사람과의 말다툼과 규칙 어김만은 삼가시오.',
    '편재': '뜻밖의 큰돈이 움직이는 해라오. 들어오는 판은 크지만 나가는 길도 넓으니 계약서와 통장을 그대 손으로 직접 챙기시오.',
    '정재': '꼬박꼬박 쌓이는 재물의 해라오. 한 방을 노리기보다 월급과 고정 수입의 그릇을 키우는 데 힘을 쏟으시오.',
    '편관': '거센 압박과 시험이 몰아치는 해라오. 그 무게를 버텨내면 감투와 권한이 따라오니 피하지 말고 맞서시오.',
    '정관': '자리와 명예가 바로 서는 해라오. 승진·합격·계약처럼 공식적인 인정을 받을 일에 정면으로 도전하시오.',
    '편인': '남다른 감각과 촉이 깨어나는 해라오. 낯선 공부와 기술에 파고들되, 생각만 많아져 실행을 미루지는 마시오.',
    '정인': '배움과 귀인의 도움이 깃드는 해라오. 자격과 공부, 문서로 기반을 다져두면 다음 도약의 발판이 되오.'
  };

  // 그해 천간이 일간에게 어떤 십신으로 들어오는지에 따른 해설 (계열별 요약 — 직장운 한 줄 등에 사용)
  const YEAR_SIPSIN_TEXT = {
    bi: '경쟁자와 동료가 한꺼번에 몰려드는 해라오. 손잡을 자와 경계할 자를 칼같이 가리시오.',
    sik: '그대 재능과 말이 밖으로 터져 나오는 해라오. 만들고 드러내되, 윗사람과의 말다툼만은 삼가시오.',
    jae: '재물의 기운이 크게 움직이는 해라오. 들어오는 돈은 크지만 나가는 길도 넓으니 계약서와 통장을 그대 손으로 직접 챙기시오.',
    gwan: '책임과 압박이 어깨를 짓누르는 해라오. 그 무게를 버텨내면 직함과 명예가 따라오니 피하지 말고 맞서시오.',
    in: '배움과 귀인의 도움이 깃드는 해라오. 자격과 공부, 문서로 기반을 다져두면 다음 도약의 발판이 되오.'
  };
  // 결과 화면 '일의 냄새'용 짧은 한마디 (리포트 로드맵의 연도 해설과 겹치지 않게)
  const CAREER_SIPSIN_HINT = {
    '비견': '혼자보다 함께 뛸 동료를 찾을 때 판이 커지오.',
    '겁재': '경쟁자가 바짝 붙소. 그대 몫의 성과는 기록으로 남겨 두시오.',
    '식신': '손에 익은 재주가 그대로 일감이 되오.',
    '상관': '말과 아이디어로 판을 흔들 때요. 다만 윗선과의 충돌은 피하시오.',
    '편재': '바깥에서 큰 기회가 굴러드오. 발 넓게 움직이시오.',
    '정재': '성실하게 쌓은 실적이 연봉과 자리로 돌아오오.',
    '편관': '무거운 일이 몰리지만, 버티면 직함이 따라오오.',
    '정관': '공식적인 인정이 오오. 승진·합격 같은 문을 두드리시오.',
    '편인': '남다른 기술 하나를 파고들면 대체 불가능한 사람이 되오.',
    '정인': '자격과 배움이 다음 자리를 열어 주오.'
  };
  const SIPSIN_GROUP = { '비견': 'bi', '겁재': 'bi', '식신': 'sik', '상관': 'sik', '편재': 'jae', '정재': 'jae', '편관': 'gwan', '정관': 'gwan', '편인': 'in', '정인': 'in' };

  // ── 누재살 방어 비방: 사주에 따라 고르는 문장 (원래 문장은 각각 한 유형으로 보존) ──
  // ① 재성 글자 수별 (0 / 1 / 2개 이상 = 원래 문장)
  const WEALTH_GUARD_BY_COUNT = [
    `1. <strong>돈 그릇 빚기 작전</strong>: 재성이 드러나지 않은 명식은 돈이 머물 자리부터 만들어야 하오. 월급이나 용돈이 들어온 그날, 쓰기 전에 30%를 '절대 손대지 않는 통장'으로 자동 이체해 그릇의 바닥부터 채우시오.`,
    `1. <strong>실금 메우기 작전</strong>: 가는 물줄기는 작은 구멍 하나에도 금세 마르오. 이번 주 안에 자동결제·구독·배달 내역을 전부 뽑아, 한 달 동안 한 번도 안 쓴 것부터 끊어 내시오.`,
    `1. <strong>현금 봉쇄 작전</strong>: 통장에 자유입출금 잔고를 200만 원 이상 두지 마시오. 들어오는 즉시 묶이는 청약, 펀드, 채권 등 빼기 힘든 구조로 강제 이체하시오.`
  ];
  // ② 원국에서 가장 짙은 기운(재성 제외)별 — 돈이 새는 길
  const WEALTH_LEAK_BY_GROUP = {
    bi: `2. <strong>불필요한 동정심 차단</strong>: 주변의 금전 거래 요구나 빌려달라는 부탁은 무조건 "지금 전세금(또는 투자금)으로 다 묶여 있다"고 단칼에 거절하시오.`,
    sik: `2. <strong>기분 지출 차단</strong>: 그대 명식은 재주와 흥이 넘쳐 기분이 좋을 때 지갑이 먼저 열리오. 장바구니에 담은 물건은 24시간 묵혀 두고, 다음 날에도 꼭 필요할 때만 결제하시오.`,
    gwan: `2. <strong>체면 지출 차단</strong>: 그대 명식은 자리와 체면의 기운이 짙어, '사람 도리' 때문에 나가는 밥값·경조사비·선물값이 통장을 뚫소. 한 달 체면비 상한을 미리 정해 두고, 넘으면 마음만 정중히 전하시오.`,
    in: `2. <strong>배움 지출 차단</strong>: 그대 명식은 배움과 문서의 기운이 짙어, 강의·책·자격증 결제가 끝없이 이어지오. 지금 붙든 공부 하나를 끝내기 전에는 새 강의를 결제하지 마시오.`
  };
  const GROUP_KO = { bi: '비겁(比劫)', sik: '식상(食傷)', gwan: '관성(官星)', in: '인성(印星)' };
  const GROUP_PLAIN = { bi: '내 편과 경쟁자(비겁)', sik: '재주와 표현(식상)', jae: '돈(재성)', gwan: '책임과 체면(관성)', in: '배움(인성)' };   // 손님용 쉬운 말 (2026-11-02 쉬운 말 4단계: 리포트)

  // ── 천명 100일 작전: 세 수칙을 각각 다른 기준으로 고른다 (원래 문장은 각각 한 유형으로 보존) ──
  // ① 기상 의식 — 가장 모자란 오행 (수(水) 보충 = 원래 문장)
  const MORNING_RITUAL_BY_WEAK = {
    wood: `1. <strong>기상 직후 창문 열기 & 축문</strong>: 눈뜨자마자 스마트폰을 보지 말고, 창문부터 활짝 열어 아침 공기를 들이며 두 팔을 하늘로 뻗고 "내 안의 흉살은 물러가고 천명이 일어선다" 세 번 읊조리시오.`,
    fire: `1. <strong>기상 직후 햇볕 5분 & 축문</strong>: 눈뜨자마자 스마트폰을 보지 말고, 창가나 문밖에서 아침 햇볕을 5분 쬐며 "내 안의 흉살은 물러가고 천명이 일어선다" 세 번 읊조리시오.`,
    earth: `1. <strong>기상 직후 맨발 딛기 & 축문</strong>: 눈뜨자마자 스마트폰을 보지 말고, 맨발로 바닥을 단단히 딛고 서서 따뜻한 물 한 잔을 천천히 마시며 "내 안의 흉살은 물러가고 천명이 일어선다" 세 번 읊조리시오.`,
    metal: `1. <strong>기상 직후 이부자리 각 잡기 & 축문</strong>: 눈뜨자마자 스마트폰을 보지 말고, 이불을 반듯하게 개어 각을 세운 뒤 "내 안의 흉살은 물러가고 천명이 일어선다" 세 번 읊조리시오.`,
    water: `1. <strong>기상 직후 찬물 한 잔 & 축문</strong>: 눈뜨자마자 스마트폰을 보지 말고, 찬물 한 잔을 마시며 "내 안의 흉살은 물러가고 천명이 일어선다" 세 번 읊조리시오.`
  };
  // ② 몰입 시간대 — 일간 오행 (토(土) 일간 = 원래 문장)
  const FOCUS_RULE_BY_DM = {
    wood: d => `2. <strong>아침 1시간 몰입 결계</strong>: 목(木) 일간은 해 뜨는 아침에 기운이 가장 맑게 뻗소. 하루 일과를 시작하기 전 1시간을 떼어 오직 [<strong class="impact-gold">${d}</strong>]에만 몰두하시오.`,
    fire: d => `2. <strong>오전 1시간 몰입 결계</strong>: 화(火) 일간은 해가 높이 오를수록 기세가 살아나오. 오전 중 1시간을 떼어 알림을 모두 끄고 오직 [<strong class="impact-gold">${d}</strong>]에만 불을 지피시오.`,
    earth: d => `2. <strong>매일 1시간 몰입 결계</strong>: 어떤 방해도 받지 않고 오직 [<strong class="impact-gold">${d}</strong>]에만 몰두하는 불가침의 1시간을 반드시 사수하시오.`,
    metal: d => `2. <strong>저녁 1시간 몰입 결계</strong>: 금(金) 일간은 해 지는 저녁에 칼날이 가장 날카롭소. 저녁을 먹은 뒤 1시간, 오직 [<strong class="impact-gold">${d}</strong>]에만 칼끝을 겨누시오.`,
    water: d => `2. <strong>밤 1시간 몰입 결계</strong>: 수(水) 일간은 고요한 밤에 생각이 가장 깊어지오. 잠들기 전 1시간을 [<strong class="impact-gold">${d}</strong>]에 바치되, 자정은 넘기지 마시오.`
  };
  // ③ 정화할 자리 — 일지(배우자·생활 자리) 오행 (수(水) 일지 = 원래 문장)
  const CLEANSE_RULE_BY_DAY_BRANCH = {
    wood: `3. <strong>현관 정화</strong>: 현관에 쌓인 신발과 택배 상자를 즉시 치우시오. 기운이 드나드는 문이 막히면 찾아오던 귀인도 발길을 돌리오.`,
    fire: `3. <strong>부엌 정화</strong>: 싱크대에 쌓인 설거지와 상한 음식을 즉시 치우시오. 불을 다루는 자리가 더러우면 재물의 불씨가 꺼지오.`,
    earth: `3. <strong>책상 정화</strong>: 책상 위에 쌓인 종이와 잡동사니를 즉시 치우시오. 일을 펼치는 땅이 어지러우면 무엇을 심어도 뿌리를 내리지 못하오.`,
    metal: `3. <strong>지갑·가방 정화</strong>: 지갑 속 묵은 영수증과 가방 바닥의 쓰레기를 즉시 비우시오. 돈이 드나드는 주머니가 지저분하면 들어온 돈도 금세 빠져나가오.`,
    water: `3. <strong>침실 정화</strong>: 침대 머리맡에 널브러진 불필요한 옷가지와 쓰레기를 즉시 치우시오. 죽은 물건이 침실에 있으면 자는 동안 악귀가 기를 빨아먹소.`
  };

  // ── 꿈 ↔ 오행: 꿈에 적힌 낱말이 어느 기운의 일인지 (영적 조화율 계산용) ──
  const DREAM_EL_KEYWORDS = {
    wood: ['교육', '교사', '선생', '강사', '디자인', '기획', '출판', '작가', '글', '상담', '복지', '간호', '농', '패션', '뷰티', '건축', '창작', '공부'],
    fire: ['방송', '영상', '유튜브', '연예', '배우', '가수', '아이돌', '마케팅', '광고', '강연', '요리', '셰프', '게임', '콘텐츠', '인플루언서', '스타', '유명', '개발', '앱', '웹'],
    earth: ['부동산', '건물', '건설', '공무원', '중개', '컨설팅', '유통', '관리', '행정', '보험', '안정', '집', '자산', '땅', '카페', '가게', '장사'],
    metal: ['금융', '투자', '주식', '코인', '법', '변호사', '판사', '검사', '회계', '세무', '엔지니어', '기계', '반도체', '군인', '경찰', '의사', '치과', '약사', '분석', '데이터', '자동차', '부자', '돈', '억만장자', '백만장자', '재벌', '갑부', '부유', '재산', '자산가', '연봉', '월급', '수익', '매출', '경제적 자유', '로또'],
    water: ['무역', '여행', '물류', '연구', '박사', '철학', '심리', '해외', '유학', '이민', '음악', '작곡', '예술', '프리랜서', '코딩', '프로그래', '사업', '창업', '1인', '사장', '대표', 'CEO', '내 회사']
  };
  // ── 쉬운 말 표 (2026-11-02, 손님 평 "뭔 소린지 모르겠다"): 풀이 문장 앞에 사실을 평어로 한 줄 먼저 말할 때 쓴다 ──
  const EL_PLAIN = { wood: '나무 기운(뻗어 나가는 힘)', fire: '불 기운(의욕과 열기)', earth: '흙 기운(중심과 안정)', metal: '쇠 기운(맺고 끊는 힘)', water: '물 기운(쉬어 가는 힘)' };
  const REL_PLAIN = ['그대 성격과 같은 결이라 남이 시키지 않아도 혼자 밀고 가오', '그대 재주를 밖으로 꺼내 보이는 일이라 잘 맞소', '손댄 만큼 돈으로 돌아오는 일이라 결과가 바로 드러나오', '그대 어깨를 누르는 일이라 버겁지만, 해내면 이름이 서오', '배울수록 힘이 붙는 일이라 서두르지 않으면 되오'];
  const UNSUNG_PLAIN = { '장생': '힘이 돋아나는 자리', '목욕': '멋을 알고 흔들리기 쉬운 자리', '관대': '어깨에 힘이 들어가는 자리', '건록': '제 힘으로 서는 자리', '제왕': '힘이 가장 센 자리', '쇠': '힘이 조금 꺾이는 자리', '병': '지치기 쉬운 자리', '사': '멈춰 서는 자리', '묘': '안으로 갈무리하는 자리', '절': '끊겼다 다시 잇는 자리', '태': '새로 품는 자리', '양': '길러지는 자리' };
  // 대운 칸처럼 좁은 자리용 짧은 쉬운 말 (업데이트 39, 검수 7번): 칸에는 '힘 돋는 때(장생)'처럼
  const UNSUNG_SHORT = { '장생': '힘 돋는 때', '목욕': '흔들리는 때', '관대': '힘 붙는 때', '건록': '홀로 서는 때', '제왕': '가장 센 때', '쇠': '꺾이는 때', '병': '지치는 때', '사': '멈추는 때', '묘': '거두는 때', '절': '끊고 잇는 때', '태': '새로 품는 때', '양': '길러지는 때' };
  /** 꿈 문장에서 가장 많이 걸리는 오행 (없으면 null) */
  function dreamElement(dream) {
    const t = String(dream || '');
    let best = null, bestN = 0;
    EL_KEYS.forEach(k => { const n = DREAM_EL_KEYWORDS[k].filter(w => t.includes(w)).length; if (n > bestN) { best = k; bestN = n; } });
    return best;
  }
  /** 원국 오행 개수로 일간 기준 5계열(비겁·식상·재성·관성·인성) 글자 수 */
  function sipsinGroupCounts(dmEl, counts) {
    const i = EL_KEYS.indexOf(dmEl), at = n => counts[EL_KEYS[(i + n) % 5]] || 0;
    return { bi: at(0), sik: at(1), jae: at(2), gwan: at(3), in: at(4) };
  }

  /** 사주에서 맞춤 문장에 쓸 핵심 값을 뽑는다 */
  function getPersona(dayStemIdx, dayBranchIdx, oheng) {
    const dmEl = EL_KEYS[Math.floor(dayStemIdx / 2)];
    const counts = (oheng && oheng.counts) || { wood: 1, fire: 1, earth: 1, metal: 1, water: 1 };
    // 가장 모자란 오행: 0개인 것이 우선, 없으면 개수가 가장 적은 것
    let weakKey = (oheng && oheng.weak && oheng.weak.length) ? oheng.weak[0] : null;
    if (!weakKey) {
      const min = Math.min(...EL_KEYS.map(k => counts[k]));
      const cands = EL_KEYS.filter(k => counts[k] === min);
      weakKey = cands.find(k => k !== dmEl) || cands[0];   // 동률이면 자기 일간 오행은 '결핍'에서 제외
    }
    const wealthEl = EL_KEYS[(EL_KEYS.indexOf(dmEl) + 2) % 5];   // 내가 극하는 오행 = 재성
    return { dmEl, weakKey, wealthEl, wealthCount: counts[wealthEl] || 0, dayStemIdx, dayBranchIdx };
  }

  /** 재성 개수에 따른 재물 진단 한 단락 */
  function wealthDiagnosis(ps, where) {
    // 쉬운 말 3단계 (2026-11-02): '돈 기운(재성)인 [물]' — 조사는 기운 이름의 받침에 맞게
    const el = EL_NAME[ps.wealthEl]; const label = `<strong class="impact-gold">돈 기운(재성)인 [${el}]</strong>`; const i = josa(el, '이'), eun = josa(el, '은');
    // 같은 사람이 결과 화면·리포트·묻기에서 같은 문단을 두 번 읽지 않게, 자리마다 다른 문장
    if (where === 'teaser') {
      if (ps.wealthCount === 0) return `그대 사주에는 ${label}${i} 보이지 않소. 벌어도 머물 자리가 없으니 돈이 손가락 사이로 빠지오.`;
      if (ps.wealthCount === 1) return `그대 사주의 ${label}${eun} 단 한 줄기요. 가는 물줄기라 작은 구멍 하나에도 금세 마르오.`;
      return `그대 사주에는 ${label}${i} ${ps.wealthCount}글자나 되오. 물은 넘치는데 담을 독이 작소.`;
    }
    if (where === 'chat') {
      if (ps.wealthCount === 0) return `재물 글자인 ${label}${i} 원국에 없소. 그래서 그대는 "모으는 법"부터 배워야 돈이 붙는 사람이오.`;
      if (ps.wealthCount === 1) return `재물 글자인 ${label}${i} 하나뿐이라, 큰돈보다 꾸준한 돈이 그대 편이오.`;
      return `재물 글자인 ${label}${i} 넉넉하오. 버는 재주는 있으니, 지키는 재주만 붙이면 되오.`;
    }
    if (ps.wealthCount === 0) return `특히 그대 사주에는 재물을 뜻하는 ${label}${i} 한 글자도 드러나 있지 않소. 돈이 제 발로 찾아오는 팔자가 아니니, 그대 손으로 그릇을 빚고 길목을 지켜야만 고이오.`;
    if (ps.wealthCount === 1) return `그대 사주에서 재물을 뜻하는 ${label}${eun} 단 한 글자뿐이오. 들어오는 물줄기가 가늘어 한 번 새기 시작하면 바닥이 금세 드러나니, 작은 지출 구멍부터 틀어막으시오.`;
    return `그대 사주에는 재물을 뜻하는 ${label}${i} ${ps.wealthCount}글자나 깔려 있소. 돈이 들어오는 길은 넓지만 감당할 그릇보다 물이 많아 넘쳐흐르는 형국이니, 들어오는 족족 묶어두지 않으면 남의 주머니로 흘러가오.`;
  }

  /** 로드맵 연도별: 그해 간지가 일간·일지와 맺는 관계 */
  function yearRelationText(year, ps) {
    const ys = ((year - 4) % 10 + 10) % 10, yb = ((year - 4) % 12 + 12) % 12;
    const sipsin = getSipsin(ps.dayStemIdx, ys);
    let t = `🔎 <strong>그대 사주와 대조</strong>: ${yearGanji(year)}년의 기운이 그대에게 <strong class="impact-gold">[${sipsinPlain(sipsin)}]</strong>${josa(sipsinPlain(sipsin), '으로')} 들어오오. ${YEAR_SIPSIN_TEXT_10[sipsin]}`;
    if ((yb - ps.dayBranchIdx + 12) % 12 === 6) {
      t += ` 또한 이 해의 글자(${BRANCHES[yb].char})가 그대가 태어난 날의 글자(${BRANCHES[ps.dayBranchIdx].char})와 정면으로 부딪히는 <strong class="impact-red">충돌(충)</strong>이 걸려 있으니, 이사·이직·관계의 큰 변동에 대비하시오.`;
    } else if (SajuCore.branchRelation) {
      const rel = SajuCore.branchRelation(ps.dayBranchIdx, yb), H = window.BYEOKSA_PHRASES.YEAR_HAP;
      if (rel.yukhap) t += H.yukhap(year, BRANCHES[yb].char);
      else if (rel.samhap) t += H.samhap(year, BRANCHES[yb].char);
    }
    return t;
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.yr-roadmap').forEach(el => { el.textContent = `${Y_R0}~${Y_R2}년`; });
    document.querySelectorAll('.yr-peak').forEach(el => { el.textContent = `${Y_R1}년`; });
  });

// Saju App UI & Event Handler
let currentSajuData = null;

  
  // 🗂️ 다단계 화면(스텝) 전환 핸들러
  
  // 📜 한지 두루마리(족자) 모달 핸들러
  function openHanjiScroll() {
    const modal = document.getElementById('hanjiScrollModal');
    // 버튼은 하나만: 대문에서 열면 입력 화면으로 이어 주고, 다른 화면에서 열면 그냥 닫는다
    const onHome = document.getElementById('viewLanding').style.display !== 'none';
    const btn = document.getElementById('scrollActionBtn');
    if (btn) btn.textContent = onHome ? '사주 풀이 보기 ➔' : '두루마리 말기';
    modal.dataset.fromHome = onHome ? '1' : '';
    if (!modal.dataset.bound) {   // 두루마리 바깥(어두운 곳)을 누르면 닫기
      modal.addEventListener('click', e => { if (e.target === modal) closeHanjiScroll(); });
      modal.dataset.bound = '1';
    }
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    
    // 리셋 애니메이션 (다시 열 때도 돌돌 펼쳐지는 효과)
    const paper = document.getElementById('scrollPaperBody');
    paper.style.animation = 'none';
    paper.offsetHeight; // reflow
    paper.style.animation = 'unfurlScroll 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards';
  }

  function closeHanjiScroll() {
    const modal = document.getElementById('hanjiScrollModal');
    modal.style.opacity = '0';
    setTimeout(() => { modal.style.display = 'none'; }, 300);
  }

  function proceedFromScroll() {
    closeHanjiScroll();
    goToStep(2);
  }

  function scrollPrimaryAction() {
    if (document.getElementById('hanjiScrollModal').dataset.fromHome) proceedFromScroll();
    else closeHanjiScroll();
  }

  /** 화면 하나만 보이게 한다 (홈·입력·결과·궁합·오늘의 운세·벽사 패·묻기) */
  // 제목 맨 앞의 이모지는 화면에서만 감춘다(글자는 남겨 문구 보존) — 책 제목처럼 명조 글씨만 보이게
  const TITLE_ICO_RE = /^(?:\s*(?:\p{Extended_Pictographic}|[\u2600-\u27BF\u2B00-\u2BFF])\uFE0F?\s*)+/u;
  // 2026-10-27 (대표님: "AI가 만든 것처럼 보인다"): 제목뿐 아니라 글 어디에 있든 그림 이모지(🕯️ 📜 ⚠️ 🔒 …)와 장식 화살표(➔)를 화면에서 감춘다.
  //   글자는 지우지 않고(문구 보존·복사·공유에는 그대로 남음) 보이지 않는 span(.title-ico)으로만 감싼다.
  //   ↔·→·★·☯ 같은 기호는 글의 뜻이라 두고, 그림 이모지와 ➔만 고른다. (option·textarea·script 안은 건드리지 않는다)
  const EMOJI_RE = /(?:(?![©®™←-⇿])\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}️?|[\u{1F3FB}-\u{1F3FF}])*|➔)/gu;
  const EMOJI_SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'OPTION', 'NOSCRIPT']);
  function hideEmoji(root) {
    const base = root || document.body;
    if (!base || !document.createTreeWalker) return;
    const walker = document.createTreeWalker(base, NodeFilter.SHOW_TEXT, { acceptNode: n => {
      const p = n.parentNode;
      if (!p || EMOJI_SKIP.has(p.nodeName) || (p.classList && p.classList.contains('title-ico'))) return NodeFilter.FILTER_REJECT;
      EMOJI_RE.lastIndex = 0;
      return EMOJI_RE.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    } });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
      const text = n.nodeValue, frag = document.createDocumentFragment();
      let last = 0, m;
      EMOJI_RE.lastIndex = 0;
      while ((m = EMOJI_RE.exec(text)) !== null) {
        if (!m[0]) { EMOJI_RE.lastIndex++; continue; }
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const ico = document.createElement('span'); ico.className = 'title-ico'; ico.setAttribute('aria-hidden', 'true'); ico.textContent = m[0];
        frag.appendChild(ico);
        last = m.index + m[0].length;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      n.parentNode.replaceChild(frag, n);
    });
  }
  function tidyTitles(root) {
    (root || document).querySelectorAll('h1, h2, h3, h4, .section-title, .feature-card-title, .portfolio-section-title, .glance-title, .kpi-title strong, .timeline-title, .paywall-hook-title, .plan-row-name, .talisman-info-item > strong, .talisman-mine > strong, .mind-item > strong, button:not(.tab-item)').forEach(el => {
      const first = el.firstChild;
      if (!first || first.nodeType !== 3) return;
      const m = first.nodeValue.match(TITLE_ICO_RE);
      if (!m || !m[0].trim()) return;
      const ico = document.createElement('span'); ico.className = 'title-ico'; ico.setAttribute('aria-hidden', 'true'); ico.textContent = m[0];
      first.nodeValue = first.nodeValue.slice(m[0].length);
      el.insertBefore(ico, first);
    });
    hideEmoji(root && root.nodeType === 1 ? root : document.body);
  }
  document.addEventListener('DOMContentLoaded', () => tidyTitles(document.body));
  // 나중에 그려지는 화면(기능·결제창·리포트)도 같은 규칙 — 화면이 바뀔 때마다 한 번 훑는다
  if (window.MutationObserver && document.body) {
    let _tidyTimer = null;
    new MutationObserver(() => { clearTimeout(_tidyTimer); _tidyTimer = setTimeout(() => tidyTitles(document.body), 40); }).observe(document.body, { childList: true, subtree: true });
  }
  /** 결과 화면 하단 고정 구매 바 (2026-11-01 벤치마킹): 리포트가 잠긴 결과 화면에서만 보이고, 가격은 할인까지 반영 */
  function updateBuyBar(viewId) {
    const bar = document.getElementById('buyBar'); if (!bar) return;
    const id = viewId || (([...document.querySelectorAll('.app-container > .view-step')].find(v => v.style.display !== 'none') || {}).id);
    const on = id === 'viewResult' && !!currentSajuData && !reportUnlocked;
    bar.hidden = !on;
    document.body.classList.toggle('buy-bar-on', on);
    const p = document.getElementById('buyBarPrice'); if (p && on) p.textContent = `${won(priceFor('report').final)}원`;
  }
  // ── 긴 단락 '더 보기' 접기 (2026-11-01 벤치마킹: 포스텔러 '… 더 보기'): data-fold="줄 수" 요소를 그 줄 수까지만 보이고, 넘치면 '더 보기' 단추를 단다.
  //    글은 지우지 않는다(문구 보존 테스트·인쇄는 전부). 요소가 화면에 그려진 뒤에 재야 하므로 보이는 화면에만 건다 ──
  let _resultFoldsDirty = false;   // 새로 푼 풀이는 결과 화면이 보일 때 다시 접는다
  function applyFolds(root) {
    (root || document).querySelectorAll('[data-fold]').forEach((el, i) => {
      const old = el.nextElementSibling; if (old && old.classList.contains('fold-more')) old.remove();
      el.classList.remove('fold-clamp', 'is-open');
      el.style.setProperty('--fold-lines', parseInt(el.dataset.fold, 10) || 5);
      el.classList.add('fold-clamp');
      if (el.scrollHeight <= el.clientHeight + 8) { el.classList.remove('fold-clamp'); return; }   // 짧은 글은 접지 않는다
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fold-more' + (el.dataset.foldTone === 'dark' ? ' fold-more--dark' : '');
      btn.textContent = '더 보기';
      btn.setAttribute('aria-expanded', 'false');
      if (!el.id) el.id = 'fold-' + i;
      btn.setAttribute('aria-controls', el.id);
      btn.onclick = () => {   // 펼친 뒤에도 단추를 남겨 '접기'로 (업데이트 28: 키보드 초점이 빠지지 않고, 화면 읽어 주는 기기에도 펼침/접힘이 전해지게)
        const open = !el.classList.contains('is-open');
        el.classList.toggle('is-open', open);
        btn.textContent = open ? '접기' : '더 보기';
        btn.setAttribute('aria-expanded', String(open));
        if (!open) el.scrollIntoView({ block: 'nearest' });   // 접으면 접힌 글의 머리가 보이게
      };
      el.after(btn);
    });
  }
  function showView(id) {
    document.querySelectorAll('.app-container > .view-step').forEach(v => { v.style.display = (v.id === id) ? 'flex' : 'none'; });
    tidyTitles(document.getElementById(id));
    updateBuyBar(id);
    if (id === 'viewResult' && _resultFoldsDirty) { _resultFoldsDirty = false; applyFolds(document.getElementById('viewResult')); }
    // 하단 메뉴: 지금 화면에 해당하는 칸을 표시
    document.querySelectorAll('#tabBar .tab-item').forEach(t => {
      const on = (t.dataset.views || '').split(' ').includes(id);
      t.classList.toggle('active', on);
      if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** 하단 메뉴 '내 사주': 이미 본 풀이가 있으면 그 화면, 리포트를 열었으면 리포트, 아니면 입력 화면(저장된 생년월일은 미리 채움) */
  function openMySaju() {
    if (currentSajuData) { showView(reportUnlocked ? 'viewReport' : 'viewResult'); return; }
    const p = loadProfile();
    if (p) {
      fillBirthInput(p, p.lunar, p.late, p.hour);   // 음력·밤 자시로 넣었으면 그대로 (업데이트 44)
      if (p.gender) document.getElementById('gender').value = p.gender;
    }
    goToStep(2);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 📊 이용 횟수 세기 (업데이트 38): 단계 이름 하나만 서버(/api/count)에 보낸다. 생년월일·이름·IP·쿠키 저장 없음.
  //   브라우저에서 JS가 돌 때만 보내므로 로봇은 거의 빠진다. 내 컴퓨터(localhost)·자동 테스트·파일로 열기는 세지 않는다.
  //   '방문'은 탭 하나(세션)에 한 번만. 결제 흐름·PAYMENT와는 상관없다.
  // ─────────────────────────────────────────────────────────────────────────
  const BOT_UA = /bot|crawl|spider|slurp|yeti|daumoa|headless|lighthouse|facebookexternalhit|kakaotalk-scrap/i;   // 검색 로봇·미리보기 수집기 (카카오톡 안 브라우저는 'KAKAOTALK'이라 걸리지 않는다)
  function track(name) {
    try {
      if (window.__BYEOKSA_TEST__) { (window.__trackLog = window.__trackLog || []).push(name); return; }   // 자동 테스트: 보내지 않고 기록만
      if (location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\]|.*\.localhost)?$/.test(location.hostname)) return;
      if (navigator.webdriver || BOT_UA.test(navigator.userAgent || '')) return;
      const body = JSON.stringify({ e: name });   // 글자 그대로 보낸다(text/plain) — 어느 브라우저에서도 sendBeacon이 받아 준다
      if (navigator.sendBeacon && navigator.sendBeacon('/api/count', body)) return;
      fetch('/api/count', { method: 'POST', body, keepalive: true }).catch(() => {});
    } catch (e) { /* 숫자 세기 때문에 화면이 멈추면 안 된다 */ }
  }
  window.track = track;
  // 궁합 링크에 붙는 보낸 사람 별명: 한글·영문·숫자·띄어쓰기·_.- 만, 10자까지 (보내는 쪽 extras.js 와 받는 쪽이 같은 규칙)
  const NICK_RE = /^[0-9A-Za-z가-힣 _.\-]{1,10}$/;
  function trackVisitOnce() {
    try { if (sessionStorage.getItem('byeoksa.t.visit')) return; sessionStorage.setItem('byeoksa.t.visit', '1'); } catch (e) { /* 저장 못 하면 그냥 센다 */ }
    track('visit');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 💬 사이트 공유: 개인정보 없이 첫 화면 주소만 보낸다 (휴대폰은 공유 창 → 카카오톡, 안 되면 문구 복사)
  // ─────────────────────────────────────────────────────────────────────────
  const SHARE_TITLE = '벽사신견 사주';
  const SHARE_TEXT = '귀신을 보고 짖는 개, 대문 앞 벽사견이 그대 사주를 냄새로 읽어 주오 🐾\n오늘의 운세·궁합·벽사 패 뽑기는 돈을 받지 않소.';
  function siteHomeUrl() {
    const u = new URL(window.location.href);
    u.search = ''; u.hash = '';
    u.pathname = u.pathname.replace(/index\.html$/, '');
    return u.href;
  }
  async function shareSite() {
    const url = siteHomeUrl() + '?from=share';   // 받은 친구도 할인을 받는다 (개인정보는 담지 않음)
    const reward = () => { if (grantCoupon('share')) setTimeout(() => showToast(`🎁 공유 고맙소. 유료 풀이 1건 ${won(SHARE_DISCOUNT.amount)}원 할인을 ${SHARE_DISCOUNT.days}일 동안 걸어 두었소.`), 2700); };
    if (navigator.share) {
      try { await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url }); reward(); return; }
      catch (e) { if (e && e.name === 'AbortError') return; /* 그 밖의 실패는 복사로 */ }
    }
    // 공유 창이 없는 환경(주로 PC): 복사만으로는 실제로 보냈는지 알 수 없어 할인을 걸지 않는다 (2026-10-25).
    // 할인은 휴대폰 공유 창에서 앱을 골라 보내기를 마쳤을 때(navigator.share가 끝났을 때)만 건다.
    copyText(`${SHARE_TEXT}\n${url}`, '💬 소개 문구와 주소를 복사했소. 휴대폰에서 공유 버튼으로 보내면 할인이 걸리오.');
  }

  function goToStep(step) {
    showView({ 1: 'viewLanding', 2: 'viewInput', 3: 'viewResult' }[step] || 'viewLanding');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 🔐 내 생년월일: 이 기기 브라우저에만 저장 (서버로 보내지 않음). 다른 기능에서 다시 묻지 않으려고 쓴다.
  // ─────────────────────────────────────────────────────────────────────────
  const PROFILE_KEY = 'byeoksa.profile.v1';
  function saveProfile(p) { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch (e) { /* 사생활 보호 모드 등 */ } }
  function loadProfile() {
    try {
      const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
      return (p && p.y && p.m && p.d) ? p : null;
    } catch (e) { return null; }
  }
  function clearProfile() { try { localStorage.removeItem(PROFILE_KEY); } catch (e) { /* 무시 */ } }

  // ─────────────────────────────────────────────────────────────────────────
  // 🌙 음력 생일 (업데이트 44): 입력 화면과 궁합·운세 입력 조각(extras.js)이 같이 쓴다.
  //   양력·음력 칸(select[data-cal])에서 음력을 고르면 '윤달' 표시칸이 보인다. 바꾼 양력 날짜로 계산·저장하므로 결제 표시도 그대로 맞는다.
  // ─────────────────────────────────────────────────────────────────────────
  const LATE_ZI = 12;   // 시간 칸의 '밤 자시'(23:30~24:00) — 다음 날 자시로 셈한다 (업데이트 44, 더블체크 2-1)
  const FUTURE_TEXT = '아직 오지 않은 날이오. 태어난 날을 다시 확인하시오.';   // 오늘 뒤의 날짜 (업데이트 44, 더블체크 1-4)
  /** 양력 날짜에 n일 더하기 (달·해 넘김 포함) */
  function addDaysYmd(s, n) { const t = new Date(Date.UTC(s.y, s.m - 1, s.d) + n * 86400000); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; }
  /** 이 기기의 오늘보다 뒤의 날짜인가 */
  function isFutureDate(s) { const n = new Date(); return Date.UTC(s.y, s.m - 1, s.d) > Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); }
  /** 손님이 확인할 한 줄 — info = { lunar: 음력 { y, m, d, leap }, late: 밤 자시 }, s = 계산에 쓴 양력 날짜. 둘 다 없으면 '' */
  function birthNoteText(info, s) {
    const l = info && info.lunar, late = !!(info && info.late);
    const base = late ? addDaysYmd(s, -1) : s;   // 손님이 적은 날(양력)
    const lunarPart = l ? `음력 ${l.y}년 ${l.leap ? '윤' : ''}${l.m}월 ${l.d}일을 양력 ${base.y}년 ${base.m}월 ${base.d}일로 보았` : '';
    if (!late) return l ? lunarPart + '소.' : '';
    const day = l ? `${s.y !== base.y ? `${s.y}년 ` : ''}${s.m}월 ${s.d}일` : `양력 ${s.y}년 ${s.m}월 ${s.d}일`;
    const latePart = `밤 11시 30분 넘어 태어나 다음 날(${day}) 자시로 셈하였소.`;
    return l ? `${lunarPart}고, ${latePart}` : latePart;
  }
  /** 음력 날짜가 맞지 않을 때 안내 (SajuCore.lunarToSolar의 error) */
  function lunarErrorText(r, y, m, leap) {
    if (r.error === 'range') return `음력 생년은 ${SajuCore.LUNAR_FIRST_YEAR}년부터 ${SajuCore.LUNAR_LAST_YEAR}년 사이로 고하시오.`;
    if (r.error === 'month') return '음력 생월은 1월부터 12월 사이로 고하시오.';
    if (r.error === 'leap') return r.leapMonth
      ? `음력 ${y}년에는 윤${m}월이 없소. 그해 윤달은 ${r.leapMonth}월이오. '윤달' 표시를 다시 확인하시오.`
      : `음력 ${y}년에는 윤달이 없소. '윤달' 표시를 빼고 다시 고하시오.`;
    return `음력 ${y}년 ${leap ? '윤' : ''}${m}월은 ${r.days}일까지만 있소. 날짜를 다시 확인하시오.`;
  }
  /** 양력·음력 칸에 맞춰 '윤달' 표시칸을 보이거나 감춘다 (감추면 표시도 지운다) */
  function syncLeapBox(sel) {
    const box = sel && sel.dataset && document.getElementById(sel.dataset.cal);
    if (!box) return;
    box.hidden = sel.value !== 'lunar';
    if (box.hidden) { const c = box.querySelector('input[type="checkbox"]'); if (c) c.checked = false; }
  }
  document.addEventListener('change', e => { if (e.target && e.target.matches && e.target.matches('select[data-cal]')) syncLeapBox(e.target); });
  /** 입력 화면의 양력·음력·윤달 칸 맞추기 — l(음력 { leap })이 있으면 음력, 없으면 양력 */
  function setCalendarInput(l) {
    const sel = document.getElementById('calendarType'), leap = document.getElementById('leapMonth');
    if (sel) sel.value = l ? 'lunar' : 'solar';
    if (leap) leap.checked = !!(l && l.leap);
    syncLeapBox(sel);
  }
  /** 입력 화면에 생년월일·시간을 다시 채운다 — 음력으로 넣었던 손님(l)은 음력 그대로, 밤 자시(late)는 적은 날짜와 '밤 자시' 그대로 */
  function fillBirthInput(s, l, late, hour) {
    const set = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined && v !== null) el.value = v; };
    const typed = l || (late ? addDaysYmd(s, -1) : s);
    set('year', typed.y); set('month', typed.m); set('day', typed.d);
    setCalendarInput(l);
    if (hour !== undefined && hour !== null) set('hourSelect', String(late ? LATE_ZI : hour));
  }

  function submitAndGoToResult() {
    const yVal = document.getElementById('year').value.trim();
    const mVal = document.getElementById('month').value.trim();
    const dVal = document.getElementById('day').value.trim();
    const calType = document.getElementById('calendarType').value;

    if (!yVal || !mVal || !dVal) {
      alert('생년월일을 온전히 대지 않으면 등 뒤의 그림자를 벗겨낼 수 없소!');
      return;
    }

    const y = parseInt(yVal);
    const m = parseInt(mVal);
    const d = parseInt(dVal);

    if (isNaN(y) || isNaN(m) || isNaN(d) || y < 1920 || y > 2030) {
      alert('생년은 1920년부터 2030년 사이로 바르게 고하시오!');
      return;
    }

    if (m < 1 || m > 12 || d < 1 || d > 31) {
      alert('올바른 생월과 생일을 고하시오!');
      return;
    }

    // 음력 생일은 한국천문연구원 음력 표로 양력으로 바꿔 그대로 계산한다 (업데이트 44, 2026-11-09).
    //   전에는 막았다 — 원래 알림: '⚠️ 음력 생일 변환은 아직 준비 중이오. 양력 생년월일로 다시 고하시오!'
    let sy = y, sm = m, sd = d, lunar = null;
    if (calType === 'lunar') {
      const leap = document.getElementById('leapMonth').checked;
      const r = SajuCore.lunarToSolar(y, m, d, leap);
      if (r.error) { alert(lunarErrorText(r, y, m, leap)); return; }
      ({ y: sy, m: sm, d: sd } = r);
      lunar = { y, m, d, leap };
    } else {
      // 날짜 유효성 검증 (2월 30일 등 날짜 롤오버 방지)
      const testDate = new Date(Date.UTC(y, m - 1, d));
      if (testDate.getUTCFullYear() !== y || (testDate.getUTCMonth() + 1) !== m || testDate.getUTCDate() !== d) {
        alert('존재하지 않는 날짜(예: 2월 30일 등)요. 올바른 생년월일을 확인하고 다시 적으시오!');
        return;
      }
    }

    if (isFutureDate({ y: sy, m: sm, d: sd })) { alert(FUTURE_TEXT); return; }   // 업데이트 44 (더블체크 1-4)
    const late = parseInt(document.getElementById('hourSelect').value, 10) === LATE_ZI;   // 밤 자시 → 다음 날 자시 (더블체크 2-1)
    if (late) ({ y: sy, m: sm, d: sd } = addDaysYmd({ y: sy, m: sm, d: sd }, 1));

    playRitual();          // 막을 먼저 내리고 (결과가 뒤로 비치지 않게)
    calculateSaju(sy, sm, sd, { lunar, late });
    _resultFoldsDirty = true;   // 새 풀이: 긴 단락을 다시 접는다 (showView에서)
    goToStep(3);
    track('free');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 🌑 분위기 연출: 첫 진입(어둠 속 한 줄씩) · 풀이 의식(냄새 맡는 중)
  //   테스트(window.__BYEOKSA_TEST__)와 '움직임 줄이기' 설정에서는 건너뛰거나 짧게
  // ─────────────────────────────────────────────────────────────────────────
  const QUIET = () => !!window.__BYEOKSA_TEST__;
  const REDUCED = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const SEEN_KEY = 'byeoksa.seen.v1';   // 값 = 序를 마지막으로 본 날짜(YYYY-MM-DD). 같은 날 다시 오면 序 없이 바로 대문, 다음 날엔 다시 序 (2026-11-01 대표님: 하루 한 번)
  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const seenOpening = () => { try { return localStorage.getItem(SEEN_KEY) === todayStr(); } catch (e) { return false; } };
  function hideGate() { const m = document.getElementById('introGateModal'); if (m) m.style.display = 'none'; }

  // 관문은 한 겹 (2026-11-01 벤치마킹: 다른 운세 서비스 9곳 모두 첫 화면에 바로 내용):
  //   그날 처음 온 손님은 序만 — 줄을 다 읽으면 序 안에 현판 버튼 '문을 두드린다'가 나오고, 누르면 序가 걷히며 대문이 열리고 접견실로.
  //   대문 안내창(introGateModal)의 글·버튼은 序에 합쳐져(is-merged) 사진만 문 여는 장면으로 쓴다. 건너뛰기는 관문 없이 대문(홈).
  //   같은 날 다시 오면 序도 안내창도 없이 바로 대문(홈), 다음 날엔 다시 序(하루 한 번). 자동 테스트(QUIET)는 예전처럼 序 없이 대문 안내창만 본다.
  function playOpening() {
    const veil = document.getElementById('openingVeil');
    if (!veil || QUIET()) return;
    if (seenOpening()) { hideGate(); return; }
    try { localStorage.setItem(SEEN_KEY, todayStr()); } catch (e) { /* 무시 */ }
    const gate = document.getElementById('introGateModal'); if (gate) gate.classList.add('is-merged');
    const lines = [...veil.querySelectorAll('.opening-lines p')];
    const hint = document.getElementById('openingHint');
    const skipBtn = document.getElementById('openingSkip');
    const enterBtn = document.getElementById('openingEnter');
    let shown = 0, done = false;
    const reveal = () => {   // 누를 때마다 한 줄(세로 한 단): 새 줄은 오른쪽에서 먹이 번지듯 떠오르고, 앞 줄은 옅어지고, 오래된 줄은 책장 넘기듯 사라진다
      if (shown >= lines.length) return;
      const keep = window.innerWidth < 360 ? 1 : 2;   // 좁은 화면은 앞 줄을 하나만 남긴다 (세로 단이 넘치지 않게)
      lines.forEach((p, i) => { p.classList.toggle('is-dim', i < shown); p.classList.toggle('is-gone', i < shown - keep); });
      lines[shown].classList.add('is-on');
      shown++;
      if (shown === lines.length) {   // 다 읽었다: 안내 글·건너뛰기 대신 현판 버튼
        if (hint) hint.hidden = true;
        if (skipBtn) skipBtn.hidden = true;
        if (enterBtn) enterBtn.hidden = false;
      }
    };
    const finish = () => {
      if (done) return; done = true;
      veil.classList.add('is-leaving');
      document.body.classList.remove('veil-on');
      setTimeout(() => {
        veil.hidden = true; veil.classList.remove('is-leaving');
        if (_toastAfterOpening) { const t = _toastAfterOpening; _toastAfterOpening = null; setTimeout(() => showToast(t), 300); }   // 序 뒤로 미뤄 둔 알림
      }, 900);
    };
    const enterGate = () => { if (done) return; finish(); acceptDestiny(); };   // 序가 걷히는 동안 대문이 열리고 접견실로
    const skip = () => { if (done) return; finish(); hideGate(); };             // 건너뛰기: 관문 없이 대문(홈)으로
    veil.hidden = false;
    document.body.classList.add('veil-on');
    veil.addEventListener('click', e => { if (e.target.closest('#openingSkip, #openingEnter')) return; if (shown >= lines.length) { enterGate(); return; } reveal(); });
    if (skipBtn) skipBtn.onclick = skip;
    if (enterBtn) enterBtn.onclick = enterGate;
    setTimeout(reveal, REDUCED() ? 0 : 500);   // 첫 줄은 저절로
  }

  // 마지막 줄의 '명식'은 쉬운 말로 (업데이트 39, 검수 7번). 원래 줄: '명식이 드러난다.'
  const RITUAL_LINES = ['대문 밖 바람이 멎었소…', '벽사견이 그대 냄새를 맡고 있소…', '그대 등 뒤에서 무언가 움찔했소…', '그대 사주가 드러나오.'];
  let _ritualTimer = null;
  function playRitual() {
    const veil = document.getElementById('ritualVeil');
    if (!veil || QUIET()) return;
    const line = document.getElementById('ritualLine');
    const gap = REDUCED() ? 350 : 700;
    let i = 0;
    clearInterval(_ritualTimer);
    line.textContent = RITUAL_LINES[0];
    veil.hidden = false; veil.classList.remove('is-leaving');
    _ritualTimer = setInterval(() => {
      i++;
      if (i < RITUAL_LINES.length) { line.textContent = RITUAL_LINES[i]; line.classList.remove('flick'); void line.offsetWidth; line.classList.add('flick'); return; }
      clearInterval(_ritualTimer);
      veil.classList.add('is-leaving');
      setTimeout(() => { veil.hidden = true; }, 600);
    }, gap);
  }

  function acceptDestiny() {
    const modal = document.getElementById('introGateModal');
    const scene = document.getElementById('gateScene');
    const btn = document.getElementById('gateEnterBtn');
    if (btn) btn.disabled = true;
    const quick = !scene || QUIET() || REDUCED();
    const finish = () => {
      modal.style.opacity = '0';
      modal.style.visibility = 'hidden';
      setTimeout(() => { modal.style.display = 'none'; }, 350);
      goToStep(2);
      const v = document.getElementById('viewInput');
      if (v && !quick) { v.classList.add('view-rise'); setTimeout(() => v.classList.remove('view-rise'), 1200); }
      setTimeout(() => showToast('🕯️ 운명의 문턱을 넘었소.'), quick ? 0 : 500);
    };
    if (quick) { finish(); return; }
    // 눈 깜빡이듯: 글·버튼이 가라앉고 → 잠깐 어두워지는 사이 열린 문으로 바뀌고 → 눈을 뜨면 열린 문과 벽사견 → 잠시 머문 뒤 어둠 → 접견실 (2026-10-25, 안개 연출 제거)
    const at = (ms, fn) => setTimeout(fn, ms);
    scene.classList.add('is-arming');                       // 0.0s 버튼·글이 가라앉음
    at(400, () => scene.classList.add('is-blink'));         // 0.4s 눈을 감듯 어두워짐(0.25초)
    at(750, () => scene.classList.add('is-open'));          // 0.75s 어둠 속에서 열린 문으로 교체
    at(900, () => scene.classList.remove('is-blink'));      // 0.9s 눈을 뜨면 열린 문과 벽사견(0.7초에 걸쳐)
    at(3300, () => scene.classList.add('is-leaving'));      // 3.3s 어둠으로
    at(4000, finish);
  }

  function calculateSaju(y, m, d, info) {   // info = { lunar: 음력으로 받았을 때 { y, m, d, leap }, late: 밤 자시 } (업데이트 44). y·m·d는 늘 계산에 쓰는 양력
    const lunar = (info && info.lunar) || null, late = !!(info && info.late);
    let hourVal = parseInt(document.getElementById('hourSelect').value);
    if (hourVal === LATE_ZI) hourVal = 0;   // 밤 자시는 (하루 넘긴 날의) 자시
    const genderVal = document.getElementById('gender').value;

    const userJob = document.getElementById('userJob').value.trim() || '현재의 신분';
    const userMajor = document.getElementById('userMajor').value.trim() || '갈고닦는 무기';
    const userHobby = document.getElementById('userHobby').value.trim() || '숨 쉬는 구멍';
    const userDream = document.getElementById('userDream').value.trim() || '이루고픈 천명';

    // 🌟 만세력 원국: 계산은 전부 SajuCore가 담당 (입춘·절입 '시각' 기준, 서울 역사 표준시 반영)
    const pillars = calculateFourPillars(y, m, d, hourVal >= 0 ? hourVal : null);
    const {
      yStem, yBranch, yStemIdx,
      mStem, mBranch, mStemIdx, mBranchIdx,
      dStem, dBranch, dStemIdx, dBranchIdx,
      hStem, hBranch
    } = pillars;

    // 렌더링 파이프라인
    const lunarNote = document.getElementById('lunarNote');   // 음력으로 받았으면 바꾼 양력 날짜를 첫 카드 위에 한 줄로 (업데이트 44)
    if (lunarNote) { lunarNote.textContent = birthNoteText({ lunar, late }, { y, m, d }); lunarNote.hidden = !(lunar || late); }
    const childNote = document.getElementById('childNote');   // 만 10세 미만이면 한 줄 (업데이트 44, 더블체크 3-1)
    if (childNote) childNote.hidden = getManAge(y, m, d) >= 10;
    CUR_AGE = NOW_Y - y;   // 만 19세 미만이면 연애 문장을 '앞으로 올 인연' 쪽으로 순하게
    const uInfo = { y, m, d, hour: hourVal, gender: genderVal, job: userJob, major: userMajor, hobby: userHobby, dream: userDream };
    CUR = buildProfile(pillars, null, uInfo);
    updateAnimalCard(dStem, dBranch);
    renderPillars({ yStem, yBranch, mStem, mBranch, dStem, dBranch, hStem, hBranch, dStemIdx });
    const ohengResult = renderOheng({ yStem, yBranch, mStem, mBranch, dStem, dBranch, hStem, hBranch });
    CUR = buildProfile(pillars, ohengResult, uInfo);   // 오행 개수까지 들어간 완성본
    updateDreamFitCard(dStem, dBranch, ohengResult, userJob, userMajor, userHobby, userDream);
    renderDaeun(y, m, d, genderVal, yStemIdx, mStemIdx, mBranchIdx, dStemIdx, pillars);
    renderTermBoundaryNote(pillars.termBoundary, hourVal >= 0);

    // 🔮 살을 대폭 붙인 심리 투시 및 악연 경고
    updateMindScanCard(dStem, dBranch, ohengResult, userJob, userDream);
    updateGhostWarningCard(dStem, dBranch, ohengResult, dStemIdx);

    // 🕯️ 연애/재물 한 줄 후각 감별 티저 갱신
    updateSniffTeaser(dStem, dBranch, dStemIdx, userDream, ohengResult);
    const kpiNow = updateKpiDashboard(dStemIdx, dBranchIdx, ohengResult, y, m, d);
    renderGlance(dStem, dBranch, dStemIdx, dBranchIdx, ohengResult, userDream, kpiNow);

    // 🔒 6단계 대외비 포트폴리오 사전 준비
    updatePaywallContent(dStem, dBranch, ohengResult, dStemIdx, dBranchIdx, userDream, userJob, y, m, d);

    currentSajuData = {
      y, m, d, hourVal, genderVal,
      userJob, userMajor, userHobby, userDream,
      dStem, dBranch, yStem, yBranch, mStem, mBranch, hStem, hBranch,
      dStemIdx, dBranchIdx, ohengResult, pillars,
      lunar, late
    };
    saveProfile({ y, m, d, hour: hourVal, gender: genderVal, ...(lunar ? { lunar } : {}), ...(late ? { late: true } : {}) });
    applyPaidState();
    tidyTitles(document.getElementById('viewResult'));
  }

  function updateAnimalCard(dStem, dBranch) {
    const animalEmojis = {
      '자': '🐭', '축': '🐮', '인': '🐯', '묘': '🐰',
      '진': '🐲', '사': '🐍', '오': '🐴', '미': '🐑',
      '신': '🐵', '유': '🐔', '술': '🐶', '해': '🐷'
    };
    const elColors = { 'wood': '푸른', 'fire': '붉은', 'earth': '황금빛', 'metal': '서늘한 백색', 'water': '검은 심해의' };
    
    document.getElementById('animalTag').innerText = `태어난 날 ${dStem.char}${dBranch.char}(${dStem.hanja}${dBranch.hanja}) · 타고난 본성`;   // '일주' 대신 쉬운 말 (2026-11-02)
    // 큰 이모지 대신 일지 한자를 붉은 도장처럼 (이모지 표는 공유 카드 등에서 계속 쓴다)
    const ae = document.getElementById('animalEmoji');
    ae.textContent = dBranch.hanja; ae.classList.add('animal-seal'); ae.setAttribute('data-emoji', animalEmojis[dBranch.char] || '✨');
    document.getElementById('animalTitle').innerText = `${elColors[dStem.el]} ${dBranch.animal}의 살기(殺氣)가 보이고 있소.`;   // 업데이트 44 (대표님 2026-11-09 '보이오 보다는 보이고 있소'): 원래 '…살기(殺氣)가 보이오.'
    // 일지 특성이 '~하는'처럼 꾸미는 말로 끝나면 '쥐의 기질'을 붙여 명사로 맺고, 조사는 받침에 맞춘다 ('맹수으로', '신뢰과' 방지)
    //   토끼(卯)의 '~매력을 지닌'도 꾸미는 말 — '닌'이 빠져 '지닌으로 빚어졌다'로 깨지던 것 (업데이트 39, 검수 3번)
    const bTrait = /[는은진닌]$/.test(dBranch.trait) ? `${dBranch.trait} ${dBranch.animal}의 기질` : dBranch.trait;
    // 둘째 문장(뼈대)은 12운성 세기×음양으로 갈리고, 시간을 알면 시주 한 줄이 붙는다 (원래 문장은 ORIG.boneLine)
    ORIG.boneLine = `기운의 날이 시퍼렇지만, 그만큼 사방에서 쏘아대는 시기와 질투의 화살을 정면으로 맞는 고독한 팔자요.`;
    const PHb = window.BYEOKSA_PHRASES;
    const boneLine = CUR ? (PHb.BONE_LINE[`${CUR.strength}${CUR.yin}`] || PHb.BONE_LINE.strong0)(CUR) : ORIG.boneLine;
    const hourLine = CUR ? ' ' + (CUR.hourKnown && CUR.hourSipsin && PHb.HOUR_LINE[CUR.hourSipsin] ? PHb.HOUR_LINE[CUR.hourSipsin](CUR) : PHb.HOUR_LINE.none(CUR)) : '';
    // 화면의 거친 말 '네놈'은 '그대'로 (업데이트 40, 대표님 2026-11-08 정중한 말투 결정). 원래: '네놈의 뼈대는 …'
    document.getElementById('animalDesc').innerText = 
      `그대의 뼈대는 ${dStem.trait}${josa(dStem.trait, '과')} ${bTrait}${josa(bTrait, '으로')} 빚어졌소. ${boneLine}` +
      (CUR ? ' ' + PHb.SEASON[CUR.monthBranchIdx] + ' ' + (PHb.UNSUNG_LINE[CUR.unsung] || '') + hourLine : '');
  }


  // ─────────────────────────────────────────────────────────────────────────
  // 📌 핵심 한 줄 — 긴 글 앞에 '이 칸에서 볼 것'을 한 줄로 (가독성)
  // ─────────────────────────────────────────────────────────────────────────
  function keyLineHtml(text, tone) {
    return `<p class="key-line${tone ? ' key-line--' + tone : ''}"><span class="key-line-mark">핵심</span><span class="key-line-text">${text}</span></p>`;
  }
  /** 카드 안 제목 요소 바로 뒤(없으면 맨 앞)에 핵심 한 줄을 넣는다. 다시 풀이하면 이전 줄은 지운다 */
  function setKeyLine(cardId, text, afterSelector, tone) {
    const card = document.getElementById(cardId);
    if (!card) return;
    card.querySelectorAll(':scope > .key-line, :scope > .key-line-wrap').forEach(e => e.remove());
    const wrap = document.createElement('div'); wrap.className = 'key-line-wrap'; wrap.innerHTML = keyLineHtml(text, tone);
    const anchor = afterSelector ? card.querySelector(afterSelector) : null;
    // 제목 아래 쉬운 말 한 줄(.section-sub)이 있으면 그 뒤에 (2026-11-02 쉬운 말 2단계: 제목 → 쉬운 말 → 핵심 순서)
    const after = (anchor && anchor.nextElementSibling && anchor.nextElementSibling.classList.contains('section-sub')) ? anchor.nextElementSibling : anchor;
    if (after && after.parentNode === card) after.insertAdjacentElement('afterend', wrap);
    else card.insertAdjacentElement('afterbegin', wrap);
  }
  function updateDreamFitCard(dStem, dBranch, oheng, job, major, hobby, dream) {
    // 예전엔 일주 글자 코드로만 정해져 88~96% 사이에서 거의 같은 값이 나왔다 → 원국·꿈에 따라 계산
    const fit = calculateDreamFit(dStem, dBranch, oheng, dream);
    const baseScore = fit.score;
    document.getElementById('fitScore').innerText = `영적 조화율 ${baseScore}%`;

    const PH = window.BYEOKSA_PHRASES, c = CUR;
    // 원래 문장(기토·토 결핍·꿈 자리 모름일 때 그대로 나온다)
    ORIG.fitOpen = `<strong>"[${dream}]${josa(dream, '을')} 품은 그대 가슴속 불길이 내 털끝을 태우는구려."</strong>`;
    ORIG.fitWeapon = `지금 뒹굴고 있는 [${job}]${josa(job, '과')} [${major}]... 네놈의 무기인 [${dStem.name}]의 기운을 담금질하는 모진 연단이다. 피하지 말고 칼날을 갈아라.`;   // 조사는 받침에 맞게 (2026-11-02)
    ORIG.fitHobby = `가볍게 즐기는 [${hobby}]... 단순한 노름이 아니라 네 메마른 명줄에 음기를 채워주는 은밀한 영약이다.`;
    ORIG.fitShout = `주변의 잡것들이 '그게 되겠냐' 짓껄여도 귓등으로도 흘려듣지 마시오. 이 문턱을 지키며 숱한 사람을 보았으나, 제 고집대로 밀어붙인 자만이 살아서 성채를 세웠소.`;
    const openLine = c ? (c.dreamRel >= 0 ? `<strong>${ph(PH.FIT_OPEN, String(c.dreamRel), c)}</strong>` : ph(PH.FIT_OPEN_UNKNOWN, null, c, 41)) : ORIG.fitOpen;
    const weapon = c ? ph(PH.FIT_WEAPON, null, { ...c, seed: c.stemIdx }) + ph(PH.FIT_STAMINA, c.strength, c) : ORIG.fitWeapon;
    const hobbyLine = c ? PH.FIT_HOBBY[c.weakKey][c.yin](c) : ORIG.fitHobby;
    const shout = c ? ph(PH.FIT_SHOUT, String(c.dreamRel), c, 3) : ORIG.fitShout;
    // 쉬운 말 (2026-11-02, 손님 평 "뭔 소린지 모르겠다" → 대표님 "더 쉽게"): 명리 용어 없이 항목마다 사실을 평어로. 벽사견 비유 문장(phrases.js FIT_*)도 쉬운 말로 다시 씀.
    //   원래 문장(ORIG.*)은 phrases.js가 없을 때의 대비로만 남는다. 점수 근거는 calculateDreamFit의 reason 대신 아래 쉬운 문장으로.
    const spreadPlain = fit.present >= 5 ? '다섯 기운(나무·불·흙·쇠·물)이 다 있어 바탕이 고르오'
      : fit.present === 4 ? '다섯 기운(나무·불·흙·쇠·물) 중 4가지가 있어 바탕이 고른 편이오'
      : fit.present === 3 ? '다섯 기운(나무·불·흙·쇠·물) 중 3가지만 있어 바탕이 보통이오'
      : `다섯 기운(나무·불·흙·쇠·물) 중 ${fit.present}가지뿐이라 한쪽으로 쏠렸소`;
    const reasonPlain = fit.rel >= 0
      ? `그대 사주에 ${spreadPlain}. 꿈 '${dream}'${josa(dream, '은')} ${EL_PLAIN[fit.dreamEl]}의 일인데, ${REL_PLAIN[fit.rel]}. 둘을 합쳐 ${baseScore}%로 보았소.`
      : `꿈 '${dream}'${josa(dream, '이')} 어떤 종류의 일인지는 사주로 가늠하기 어렵소. 그래서 점수는 타고난 기운이 고른 정도로만 매겼소. 그대 사주에 ${spreadPlain}. ${c ? ph(PH.FIT_REASON_UNKNOWN, null, c, 42) : '꿈을 구체적으로 적어 내면 더 정확히 맡아 주겠소.'}`;
    let html = `그대가 적은 꿈이 타고난 사주와 얼마나 맞는지 본 것이오. 100%에 가까울수록 잘 맞소.<br><br>${openLine}<br><br>`;
    html += `• <strong>지금 하는 일과 공부</strong>: ${weapon}<br>`;
    html += `• <strong>틈틈이 하는 일</strong>: ${hobbyLine}<br>`;
    html += `• <strong>벽사견의 한마디</strong>: ${shout}<br>`;
    html += `• <strong>왜 이 점수인가</strong>: ${reasonPlain}`;

    document.getElementById('fitContent').innerHTML = html;
    const relName = ['그대 성격과 같은 결의 일', '그대 재주를 밖으로 꺼내 보이는 일', '손댄 만큼 돈으로 돌아오는 일', '버거운 만큼 이름이 서는 일', '배울수록 힘이 붙는 일'][fit.rel];
    setKeyLine('dreamFitCard', `[${String(dream).replace(/[<>&]/g, '')}]${josa(dream, '은')} <strong>${fit.rel >= 0 ? relName : '어떤 종류의 일인지 아직 흐린 꿈'}</strong> · 조화율 <strong>${baseScore}%</strong> — 타고난 다섯 기운 중 ${fit.present}가지를 갖췄소.`, '.fit-header');
  }

  /** 영적 조화율: 원국 오행이 고른 정도 + 꿈이 일간에게 어떤 자리의 일인지 (60~98) */
  function calculateDreamFit(dStem, dBranch, oheng, dream) {
    const counts = (oheng && oheng.counts) || {};
    const present = EL_KEYS.filter(k => counts[k] > 0).length;          // 드러난 오행 가짓수 1~5
    const dmEl = dStem.el, dEl = dreamElement(dream);
    const rel = dEl ? (EL_KEYS.indexOf(dEl) - EL_KEYS.indexOf(dmEl) + 5) % 5 : -1;   // 0 비겁 1 식상 2 재성 3 관성 4 인성
    const REL = [
      { pts: 7, text: '그대 일간과 같은 기운의 일이라, 남이 시키지 않아도 스스로 밀고 나가오' },
      { pts: 12, text: '그대 일간이 낳는 식상(食傷)의 일이라, 타고난 재주가 그대로 밖으로 뻗는 자리요' },
      { pts: 10, text: '그대 일간이 다스리는 재성(財星)의 일이라, 손을 대는 만큼 결과가 돈으로 잡히오' },
      { pts: 4, text: '그대 일간을 누르는 관성(官星)의 일이라, 버거운 만큼 해냈을 때 이름이 서오' },
      { pts: 8, text: '그대 일간을 키워 주는 인성(印星)의 일이라, 배우고 쌓을수록 힘이 붙소' }
    ];
    const jitter = SajuCore.hashSeed(`${dream}|${dStem.char}${dBranch.char}`) % 7;
    const score = Math.max(60, Math.min(98, 60 + present * 4 + (rel >= 0 ? REL[rel].pts : 3) + jitter));
    const spread = `원국에 오행 다섯 가지 중 <strong>${present}가지</strong>가 드러나 있고`;
    const reason = (rel >= 0)
      ? `${spread}, 그대 꿈은 <strong>${EL_KO[dEl]}</strong> 기운의 일이오. ${REL[rel].text}.`
      : `${spread}, 그대가 적은 꿈에서는 뚜렷한 오행의 냄새를 맡지 못했소. 꿈을 구체적으로 적어 내면 더 정확히 맡아 주겠소.`;
    return { score, reason, present, dreamEl: dEl, rel };
  }

  /** 심리 투시 강도: 일간 기운의 세기와 결핍 오행이 뚜렷할수록 속이 잘 보인다 (81~99) */
  function calculateMindClarity(dStem, dBranch, oheng) {
    const counts = (oheng && oheng.counts) || {};
    const dmCount = counts[dStem.el] || 1;
    const missing = EL_KEYS.filter(k => !counts[k]).length;
    const v = 81 + Math.min(dmCount, 4) * 2 + missing * 3 + (SajuCore.hashSeed(`mind|${dStem.char}${dBranch.char}`) % 5);
    return Math.min(99, v);
  }

  // 🔮 영적 심리 투시: 팩트 폭격
    // 🔮 사주(일간/일주/오행/세운)에 따라 100% 실시간 맞춤 렌더링되는 소름 돋는 콜드 리딩
  function getDynamicColdReading(dStem, dBranch, userDream) {
    const iljuName = `${dStem.char}${dBranch.char}`;
    const el = dStem.el; // wood, fire, earth, metal, water
    const stemChar = dStem.char;

    const elementBetrayals = {
      wood: {
        badge: `[${iljuName} 태생의 나쁜 인연(흉살): 결실과 아이디어를 도둑맞은 배신]`,
        hook: `그대, <strong>불과 1~2년 전쯤(${Y_PAST1}~${Y_PAST2}년, ${yearGanji(Y_PAST1)}·${yearGanji(Y_PAST2)}년)에 그대에게 내 몫을 노리는 손이 느는 운(겁재)과 경쟁자가 느는 운(비견)이 치솟을 때</strong>, '너랑 나랑 손잡고 함께 가자'며 달콤한 말로 부추기던 동업자나 선배·친구 하나 있었소?`,
        details: `그대 우직하고 순수한 ${stemChar === '갑' ? '갑목(甲木, 큰 나무)' : '을목(乙木, 담쟁이)'}의 심성을 이용해, 그대가 밤잠 안 자고 뼈를 깎아 만든 핵심 아이디어와 기획, 인맥의 알맹이는 쏙 빼먹고, 결정적인 순간에 성과와 계약에서 그대 이름을 지워버린 그 파렴치한 인간!<br><br>` +
                 `'내가 왜 사람 보는 눈이 이리 없었을까', '내가 너무 순진해서 당했나' 혼자 자책하며 방구석에서 피눈물을 삼켰겠지만, 똑똑히 알아 두시오. 그대 탓이 아니오. 그대 나무 기운(木)의 우직한 성장을 시기해 달라붙은 비열한 흡기귀(吸氣鬼, 기운을 빨아먹는 귀신)였소.`,
        innerSoul: `그대는 겉으로는 온화하고 남들에게 싫은 소리 한마디 못 하는 착한 사람처럼 보이지만, 속으로는 그대 기준과 선이 칼날보다 날카롭소. 한번 마음에 금이 간 인간은 두 번 다시 안 보지만, 정작 속마음을 100% 털어놓을 영혼의 동반자가 없어 밤마다 뼈마디가 시린 고독을 혼자 씹어 삼켜왔을 것이오.`
      },
      fire: {
        badge: `[${iljuName} 태생의 나쁜 인연(흉살): 온기만 빼앗기고 버려진 배신]`,
        hook: `그대, <strong>불과 1~2년 전쯤(${Y_PAST1}~${Y_PAST2}년, ${yearGanji(Y_PAST1)}·${yearGanji(Y_PAST2)}년)에 그대에게 압박의 운(관살)과 말이 앞서는 운(상관)의 칼바람이 불어닥칠 때</strong>, '나 지금 너무 힘들어, 너밖에 의지할 데 없어'라며 매달리던 인간에게 온 마음과 지갑을 다 털어준 적 있소?`,
        details: `그대 타고난 ${stemChar === '병' ? '병화(丙火, 뜨거운 태양)' : '정화(丁火, 촛불)'}의 측은지심 때문에 밥 사주고, 일 도와주고, 마음 다 챙겨주며 살려놓았더니 돌아온 게 뭐였소?<br><br>` +
                 `단물만 쏙 빨아먹고 제 살길 찾자마자 싸늘하게 안면을 바꾸고, 뒤에서는 '걔가 지 멋대로 오지랖 부린 거지'라며 그대 험담까지 퍼뜨리고 다닌 그 배은망덕한 인간!<br><br>` +
                 `그대는 온몸을 불살라 길을 밝혀주었건만, 그대만 잿더미가 되어 멍하니 가슴을 쥐어뜯었소? 자책하지 마시오. 그대 불꽃 같은 열정을 갉아먹은 가증스러운 흡기귀였소.`,
        innerSoul: `그대는 남들 앞에선 세상에서 제일 밝고 열정적인 사람인 척 연기하지만, 속은 이미 시커멓게 다 타버린 잿더미요. 거절을 단호하게 못 해서 온갖 궂은일 다 떠맡고 속으로 피눈물 흘리다가, 결국 한계에 달해 혼자 잠수 타거나 자폭해버린 적이 한두 번이 아니오.`
      },
      earth: {
        badge: `[${iljuName} 태생의 나쁜 인연(흉살): 호구 취급과 누명의 배신]`,
        hook: `그대, <strong>불과 1~2년 전쯤(${Y_PAST1}~${Y_PAST2}년, ${yearGanji(Y_PAST1)}·${yearGanji(Y_PAST2)}년)에 그대 사주에 재관(財官)의 무거운 짐이 쏟아져 내릴 때</strong>, 그대가 묵묵히 다 받아주고 양보해주니까 그대를 만만한 호구이자 '감정 쓰레기통'으로 취급한 인간이 분명히 있었을 것이오.`,
        details: `그대 ${stemChar === '무' ? '무토(戊土, 거대한 산)' : '기토(己土, 비옥한 대지)'}의 넓은 도량을 믿고 호의를 권리인 양 착취하더니, 정작 공동의 문제나 금전적 손실이 터졌을 땐 제 책임은 쏙 빼고 그대에게 모든 책임과 누명을 덤터기 씌우려 했던 그 뻔뻔한 인간!<br><br>` +
                 `"내가 저 인간한테 어떻게 해줬는데 나한테 이럴 수가 있어?"라는 억울함이 가슴에 맺혀 목구멍까지 피가 거꾸로 솟았을 것이오. 똑똑히 알아 두시오. 그대 탓이 아니오. 그대 넓은 품에 기생해 피를 빤 파렴치한 흡기귀였소.`,
        innerSoul: `그대는 넓은 마음으로 다 이해하고 품어주는 척하지만, 실은 속으로 배신감과 서운함을 뼛속 깊이 새겨두는 타입이오. 참고 참다가 한번 둑이 터지면 뒤도 안 돌아보고 손절하지만, 혼자 남겨졌을 때 엄습하는 지독한 회의감에 가슴을 뜯어왔을 것이오.`
      },
      metal: {
        badge: `[${iljuName} 태생의 나쁜 인연(흉살): 가장 아픈 약점을 찔린 비수]`,
        hook: `그대, <strong>불과 1~2년 전쯤(${Y_PAST1}~${Y_PAST2}년, ${yearGanji(Y_PAST1)}·${yearGanji(Y_PAST2)}년)에 그대에게 재주를 밖으로 내는 운(식상)과 돈 기운(재성)이 소용돌이칠 때</strong>, 웬만해선 마음을 안 여는 그대가 드물게 마음의 벽을 허물고 치부와 나약한 속내까지 털어놓았던 자에게 등에 칼을 맞은 적이 있소?`,
        details: `그대 서늘한 ${stemChar === '경' ? '경금(庚金, 무쇠 검)' : '신금(辛金, 예리한 단도)'}의 칼날을 거두고 믿어준 대가가, 그대가 건넨 약점을 결정적 순간에 쥐고 흔들며 가스라이팅하고 그대 자존심을 짓밟은 처참한 뒤통수였소!<br><br>` +
                 `겉으로는 그대 완벽함을 부러워하는 척 알랑방귀를 뀌더니, 그대가 조금 흔들리자마자 가장 잔인한 곳을 후벼판 그 교활한 인간!<br><br>` +
                 `'내가 왜 방심해서 그 칼자루를 쥐어줬을까' 자학하며 며칠 밤을 피를 말렸겠지만 자책하지 마시오. 그대 날카로운 기운을 시기해 꺾으려 든 사악한 흡기귀였소.`,
        innerSoul: `그대는 겉으로는 냉철하고 야무진 완벽주의자처럼 굴지만, 실은 거절당하거나 실패자로 낙인찍힐까 봐 덜덜 떠는 극단적 유리 멘탈이오. 남들이 무심코 던진 비수 같은 말 한마디를 며칠 밤 동안 곱씹으며 스스로를 난도질하는 자학(自虐)의 칼날을 품고 있소.`
      },
      water: {
        badge: `[${iljuName} 태생의 나쁜 인연(흉살): 영혼과 통장을 갉아먹힌 가스라이팅]`,
        hook: `그대, <strong>불과 1~2년 전쯤(${Y_PAST1}~${Y_PAST2}년, ${yearGanji(Y_PAST1)}·${yearGanji(Y_PAST2)}년)에 그대에게 경쟁자의 운(비겁)과 압박의 운(관살)이 얽혀들 때</strong>, '너를 진정으로 이해하는 건 나뿐이야'라며 영혼의 구원자인 척 다가와 그대 멘탈과 통장을 쥐고 흔든 인간이 분명히 있었을 것이오.`,
        details: `그대 깊은 ${stemChar === '임' ? '임수(壬水, 검은 심해)' : '계수(癸水, 스며드는 안개)'}의 외로움과 감성을 교묘하게 자극하며, 그대 판단력을 흐려놓고 시간과 에너지를 갉아먹으며 끝없는 자책의 늪으로 끌고 들어간 그 음습한 인간!<br><br>` +
                 `그대 피 같은 돈과 감정을 밑 빠진 독처럼 뜯어먹고서야 겨우 빠져나왔지만, '내가 왜 귀신에 홀린 듯 끌려다녔을까' 혼자 멍하니 가슴을 쥐어뜯었소?<br><br>` +
                 `그대 탓이 아니오. 그대 사주의 지혜와 촉을 시기해 눈을 멀게 만든 물귀신 같은 악연이었소.`,
        innerSoul: `그대는 머릿속에 잡생각과 망상이 너무 많아 정작 실행해야 할 순간에 얼어붙소. 머릿속으로는 이미 수백 번 부자가 되고 성공했지만, 침대에서 스마트폰만 멍하니 보며 인생을 갉아먹는 무기력의 악귀가 그대 발목을 밧줄로 칭칭 감아놓고 있소.`
      }
    };

    const branchWounds = {
      '자': `그대가 태어난 날에 깔린 영리한 쥐(子)의 기운 때문에 어둠 속에서도 위기를 본능적으로 감지했으나, 눈치를 보느라 타이밍을 놓쳐 속병을 키웠소.`,
      '축': `그대가 태어난 날의 우직한 소(丑)의 기운 때문에 묵묵히 뼈를 깎으며 버텼지만, 돌아온 건 당연하다는 듯한 냉대와 억울함뿐이었소.`,
      '인': `그대가 태어난 날의 용맹한 호랑이(寅)의 기운 때문에 남들 앞에서는 결코 무릎 꿇지 않았으나, 등 뒤에서 혼자 피를 흘리며 이를 갈았소.`,
      '묘': `그대가 태어난 날의 여린 토끼(卯)의 기운 때문에 상대방의 차가운 눈빛과 비수 같은 말 한마디에도 심장에 피멍이 들었소.`,
      '진': `그대가 태어난 날의 비상하는 용(辰)의 스케일 때문에 남다른 야망을 품었으나, 발목을 잡는 주변 인간들의 잔머리에 날개가 꺾였소.`,
      '사': `그대가 태어난 날의 직관적인 뱀(巳)의 기운으로 싸한 냄새를 맡았으면서도, 정에 이끌려 단호히 끊어내지 못해 화를 자초했소.`,
      '오': `그대가 태어난 날의 불타는 말(午)의 기운으로 거침없이 돌진하다가, 믿었던 자가 파놓은 함정에 빠져 큰 상처를 입었소.`,
      '미': `그대가 태어난 날의 인내심 깊은 양(未)의 기운으로 겉은 온화한 척 웃어넘겼으나, 속은 새카맣게 타들어간 숯덩이가 되었소.`,
      '신': `그대가 태어난 날의 재주 많은 원숭이(申)의 기운으로 임기응변을 발휘했으나, 가장 가까운 자의 배신 앞에서는 속수무책이었소.`,
      '유': `그대가 태어난 날의 예리한 닭(酉)의 결벽증 때문에, 배신당한 기억을 수백 번 되새김질하며 제 가슴을 스스로 찔렀소.`,
      '술': `그대가 태어난 날의 충직한 개(戌)의 순정 때문에, 은혜를 모르는 인간에게 간과 쓸개까지 다 빼주고 토사구팽을 당했소.`,
      '해': `그대 일지의 도량 넓은 돼지(亥)의 기운으로 다 품어주려다, 오히려 삿된 인간들의 오물까지 다 뒤집어썼소.`
    };

    // 세 사람에 한 명은 원래 오행별 이야기를 그대로 받는다 (2026-10-25 대표님 요청: "함께 가자" 이야기도 몇 명에게는 나오게)
    const keepOrig = CUR && ((CUR.seed >>> 19) % 3 === 0);
    const yin = CUR && !keepOrig && window.BYEOKSA_PHRASES.MIND_YIN[stemChar];
    // 양간: 가장 센 십신 무리가 두 글자 이상 앞서면(뚜렷한 편중) 그 무리에 맞춘 이야기, 아니면 원래 오행별 이야기
    const g = CUR && CUR.groups;
    const sorted = g ? Object.values(g).sort((a, b) => b - a) : [];
    const yang = (CUR && !keepOrig && !yin && sorted.length && sorted[0] - (sorted[1] || 0) >= 2) ? window.BYEOKSA_PHRASES.MIND_YANG[CUR.domGroup] : null;
    const betrayal = yin ? yin(CUR) : yang ? yang(CUR) : (elementBetrayals[el] || elementBetrayals['wood']);
    const branchDesc = branchWounds[dBranch.char] || `뼈마디가 시린 고독을 씹어 삼켰소.`;

    return {
      iljuName,
      badge: betrayal.badge,
      hook: betrayal.hook,
      details: betrayal.details,
      innerSoul: betrayal.innerSoul,
      branchDesc
    };
  }

  function updateMindScanCard(dStem, dBranch, arg3, arg4, arg5) {
    const dream = (typeof arg5 === 'string' && arg5) ? arg5 : ((typeof arg3 === 'string' && arg3) ? arg3 : '천명');
    const ps = getPersona(STEMS.indexOf(dStem), BRANCHES.indexOf(dBranch), (arg3 && typeof arg3 === 'object') ? arg3 : null);
    const data = getDynamicColdReading(dStem, dBranch, dream);
    const badge = document.getElementById('mindBadge');
    if (badge && arg3 && typeof arg3 === 'object') badge.textContent = `심리 투시 ${calculateMindClarity(dStem, dBranch, arg3)}%`;
    const PH = window.BYEOKSA_PHRASES, c = CUR;
    ORIG.mindOpen = `"그대 골수까지 시린 서늘함을 내가 모를 줄 알았소? 딴청 피우지 마시오.`;
    ORIG.nightOpen = `그대, <strong>밤에 불 끄고 침대에 누우면 낮에 있었던 사소한 말 한마디, 상대방의 싸늘한 눈빛이 머릿속에서 수십 번 되감기되며 숨이 턱 막힌 밤들</strong>이 분명히 있었을 것이오.`;
    ORIG.nightMask = `겉으로는 '난 쿨해, 다 괜찮아' 센 척하지만, 실은 속으로 온갖 최악의 시나리오를 그리며 뼈마디가 타들어갈 만큼 혼자 피를 말렸소.`;
    ORIG.nightFear = `남들 앞에서는 '나 꼭 해낼 거야' 당당하게 큰소리치면서도, 정작 혼자 있을 땐 <em>"과연 내가 진짜 이걸 해낼 수 있을까? 이미 너무 늦은 건 아닐까? 남들은 앞서가는데 나만 이 자리에서 영원히 도태되는 건 아닐까?"</em> 하는 공포에 심장이 덜컥 내려앉았을 것이오.`;
    ORIG.nightSilence = `'이러다 나 진짜 아무것도 못 해보고 비참하게 끝나는 거 아니야?' 하는 그 서늘한 침묵...`;
    ORIG.nightClose = `내 말이 틀렸소? 이 나쁜 인연(흉살)의 사슬을 지금 끊어내지 못하면 ${Y_R0}~${Y_R1}년에 터질 인생 일대의 큰 운마저 그대 발로 걷어차게 되오.`;
    const mindOpen = c ? ph(PH.MIND_OPEN, null, c, 5) : ORIG.mindOpen;
    const nightOpen = c ? PH.NIGHT_OPEN[c.branchIdx](c) : ORIG.nightOpen;
    const nightMask = c ? ph(PH.NIGHT_MASK, c.domGroup, c) : ORIG.nightMask;
    const nightFear = c ? (c.dreamRel >= 0 ? ph(PH.NIGHT_FEAR, String(c.dreamRel), c) : ph(PH.NIGHT_FEAR_UNKNOWN, null, c, 43)) : ORIG.nightFear;
    const nightSilence = c ? ph(PH.NIGHT_SILENCE, null, c, 7) : ORIG.nightSilence;
    const trapRoot = ((c && c.weakCount === 0) ? PH.NIGHT_TRAP_ZERO[ps.weakKey] : NIGHT_TRAP_BY_WEAK[ps.weakKey]) + (c ? PH.NIGHT_TRAP_KIND[c.branchKind](c) : '');
    const nightClose = c ? ph(PH.NIGHT_CLOSE, null, c, 9) : ORIG.nightClose;

    document.getElementById('mindItem1').innerHTML = 
      `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">` +
      `  <strong class="impact-red" style="font-size:15.5px; font-weight:800;">👀 속마음 투시 (골수까지 도려내는 소름 돋는 팩폭)</strong>` +
      `  <span style="font-size:12px; font-family:var(--font-display); color:var(--cinnabar-deep); border:1px solid rgba(168,42,32,0.5); padding:2px 8px; border-radius:2px; white-space:nowrap;">${data.iljuName}(태어난 날) 맞춤</span>` +
      `</div>` +
      `<p style="margin:8px 0; font-size:15.5px; line-height:2.0;">` +
      `${mindOpen}<br><br>` +
      `<strong class="impact-red" style="font-size:15.5px; font-weight:800;">${data.badge}</strong><br>` +
      `${data.hook}<br>` +
      `${data.details}<br><br>` +
      `💡 <strong style="color:var(--gold); font-weight:800;">[벽사견이 꿰뚫은 그대 타고난 본성]</strong>: ${data.branchDesc}<br>` +
      `${data.innerSoul}${c ? ph(PH.SOUL_TAIL, c.strength, c, 29) : ''}</p>`;

    document.getElementById('mindItem2').innerHTML = 
      `<div style="margin-bottom:8px;">` +
      `  <strong class="impact-red" style="font-size:15.5px; font-weight:800;">⚠️ 밤마다 그대 숨통을 조이는 지독한 함정</strong>` +
      `</div>` +
      `<p style="margin:8px 0; font-size:15.5px; line-height:2.0;">` +
      `${nightOpen}<br>` +
      `${nightMask}<br><br>` +
      `그리고 그대가 적어낸 꿈... <strong class="impact-gold" style="font-size:16px;">[${dream}]</strong>.<br>` +
      `${nightFear}<br>` +
      `<strong class="impact-red" style="font-size:16px;">${nightSilence}</strong><br>` +
      `<br>🐾 <strong style="color:var(--gold);">[그 함정의 뿌리]</strong>: ${trapRoot}<br><br>` +
      `${nightClose}</p>`;
    setKeyLine('mindScanCard', `그대 속을 갉는 함정의 뿌리는 <strong>${EL_NAME[ps.weakKey]} 기운 부족</strong>이오 — 아래 글은 그 부족이 밤에 어떻게 드러나는지를 짚소.`, '.mind-scan-header');
  }

  

  /** 📌 한눈에 보는 핵심 다섯 줄 — 긴 풀이에서 꼭 볼 것 */
  function renderGlance(dStem, dBranch, dStemIdx, dBranchIdx, oheng, dream, kpi) {
    const ul = document.getElementById('glanceList');
    if (!ul) return;
    const ps = getPersona(dStemIdx, BRANCHES.indexOf(dBranch), oheng);
    const nobles = noblesFor(dStemIdx, BRANCHES.indexOf(dBranch));
    const ghost = ghostFor(ps.weakKey);
    const dn = lastDaeun && lastDaeun.item;
    const safe = String(dream || '').replace(/[<>&]/g, '');
    const rows = [
      ['타고난 결', `<strong>${EL_NAME[ps.dmEl]} 기운 사람</strong>(태어난 날 ${dStem.char}${dBranch.char}) — 가장 모자란 기운은 <strong>${EL_NAME[ps.weakKey]}</strong>`],   // 쉬운 말 (2026-11-02): 일주·일간·오행 이름 대신
      ['지금 운', lastDaeun && lastDaeun.before   // 첫 10년 운 전인 어린이 (업데이트 44, 더블체크 1-3)
        ? `첫 10년 운은 <strong>${lastDaeun.first.ageStart}세</strong>에 열리오(지금은 그 전) · <strong>${Y_R1}년</strong>이 가장 좋은 때(${kpi.timScore}점)`
        : dn ? `<strong>${dn.ageStart}세부터의 10년 운(${dn.stemObj.char}${dn.branchObj.char})</strong> 한복판 · <strong>${Y_R1}년</strong>이 가장 좋은 때(${kpi.timScore}점)` : `<strong>${Y_R1}년</strong>이 가장 좋은 때(${kpi.timScore}점)`],
      ['사람', `멀리할 자: <strong>${ruinTitleFor(ps, CUR)}</strong>를 풍기는 자 · 곁에 둘 귀인: <strong>${nobles[0]}</strong>`],
      ['돈', `재물 방어력 <strong>${kpi.wScore}점</strong> · 돈이 붙는 기운 <strong>${EL_NAME[ps.wealthEl]}</strong> · 방위 ${(ELEMENT_REMEDIES[ps.wealthEl] || {}).dir || ''}`],
      ['등 뒤', `벽사견이 본 것은 <strong>${ghost.name}(${ghost.hanja})</strong> — ${EL_NAME[ps.weakKey]} 기운이 모자란 틈으로 들어왔소`]
    ];
    if (safe) rows.splice(1, 0, ['그대 꿈', `[<strong>${safe}</strong>] — 조화율 <strong>${(document.getElementById('fitScore') || {}).innerText || ''}</strong>`.replace('영적 조화율 ', '')]);
    ul.innerHTML = rows.map(([k, v]) => `<li><span class="glance-key">${k}</span><span class="glance-val">${v}</span></li>`).join('');
    // 안내 글의 줄 수는 실제 개수로 (꿈을 적으면 여섯 줄), '핵심' 표시는 한지 카드에선 노란색이 아니라 붉은 꼬리표 (업데이트 39, 검수 8번)
    const note = document.querySelector('#glanceCard .glance-note');
    if (note) note.textContent = `아래 풀이는 이 ${({ 4: '네', 5: '다섯', 6: '여섯', 7: '일곱' })[rows.length] || rows.length} 줄을 길게 푼 것이오. '핵심' 표시가 붙은 줄만 따라 읽어도 되오.`;
  }
  function updateKpiDashboard(dStemIdx, dBranchIdx, ohengResult, yVal, mVal, dVal) {
    const yNum = parseInt(yVal) || 2000;
    const mNum = parseInt(mVal) || 1;
    const dNum = parseInt(dVal) || 1;
    const bIdx = (dBranchIdx !== undefined && dBranchIdx !== null) ? dBranchIdx : 0;
    const seed = (yNum * 365 + mNum * 31 + dNum + dStemIdx * 7 + bIdx * 13) % 1000;
    const dmEl = ["wood","wood","fire","fire","earth","earth","metal","metal","water","water"][dStemIdx] || "wood";
    const ohengCounts = (ohengResult && ohengResult.counts) ? ohengResult.counts : (ohengResult || {});
    const dmCount = ohengCounts[dmEl] || 1;   // 일간 오행 글자 수 (예전엔 counts를 거치지 않아 늘 1)

    // 1. 잠재 역량 (천명 그릇): 75 ~ 98
    const potScore = 75 + ((seed * 7 + dmCount * 5) % 24);
    let potGrade = "[중상 · 잠재력 충만]";
    let potColor = "#9A6A12";   // 2026-10-27: 지표 색은 웹 기본색(초록·파랑·빨강·주황) 대신 사이트 색(금·옥·주사·황) — docs/DESIGN.md
    if (potScore >= 90) {
      potGrade = "[극상 · 제왕지기]";
      potColor = "#2F6B45";
    } else if (potScore >= 82) {
      potGrade = "[상 · 건록지기]";
      potColor = "#2F6B45";
    }

    // 2. 2027 대운 폭발 지수 (골든타임): 70 ~ 99
    const timScore = 70 + ((seed * 11 + mNum * 3) % 30);
    let timGrade = "[도약 준비 태세]";
    let timColor = "#4D6F94";
    if (timScore >= 90) {
      timGrade = "[임계점 도달 · 폭발적 상승]";
      timColor = "#9A6A12";
    } else if (timScore >= 80) {
      timGrade = "[상승 기류 탑승]";
      timColor = "#9A6A12";
    }

    // 3. 재물 방어력 (누재살 漏財煞): 28 ~ 85
    const wScore = 28 + ((seed * 13 + dNum * 7) % 58);
    let wGrade = "[⚠️ 위험: 돈 샐 틈 많음]";
    let wColor = "#A82A20";
    if (wScore >= 65) {
      wGrade = "[양호: 재물 곳간 든든함]";
      wColor = "#2F6B45";
    } else if (wScore >= 48) {
      wGrade = "[⚠️ 주의: 지출 누수 경계]";
      wColor = "#9A6A12";
    }

    // 4. 주변 인연 정화도 (악연 감별): 32 ~ 88
    const kScore = 32 + ((seed * 17 + dStemIdx * 9) % 57);
    let kGrade = "[⚠️ 위험: 흡기귀 1~2명 근접]";
    let kColor = "#A82A20";
    if (kScore >= 70) {
      kGrade = "[청정: 귀인 인연 동행]";
      kColor = "#2F6B45";
    } else if (kScore >= 50) {
      kGrade = "[⚠️ 주의: 기 빨림 경계]";
      kColor = "#9A6A12";
    }

    let alerts = 0;
    if (wScore < 48) alerts++;
    if (kScore < 50) alerts++;
    const alertHtml = alerts > 0 
      ? `<span class="impact-red" style="font-size:12px; font-weight:800;">위험 경보 ${alerts}건</span>` 
      : `<span style="font-size:12px; font-weight:800; color:#9A6A12;">주의 경보 1건</span>`;

    const alertEl = document.getElementById('kpiAlertBadge');
    if (alertEl) alertEl.innerHTML = alertHtml;

    const potScoreEl = document.getElementById('kpiPotentialScore');
    const potBarEl = document.getElementById('kpiPotentialBar');
    if (potScoreEl) { potScoreEl.innerHTML = `${potScore}점 ${potGrade}`; potScoreEl.style.color = potColor; }
    if (potBarEl) { potBarEl.style.width = `${potScore}%`; potBarEl.style.background = potColor; }

    const timScoreEl = document.getElementById('kpiTimingScore');
    const timBarEl = document.getElementById('kpiTimingBar');
    if (timScoreEl) { timScoreEl.innerHTML = `${timScore}점 ${timGrade}`; timScoreEl.style.color = timColor; }
    if (timBarEl) { timBarEl.style.width = `${timScore}%`; timBarEl.style.background = timColor; }

    const wScoreEl = document.getElementById('kpiWealthScore');
    const wBarEl = document.getElementById('kpiWealthBar');
    if (wScoreEl) { wScoreEl.innerHTML = `${wScore}점 ${wGrade}`; wScoreEl.style.color = wColor; }
    if (wBarEl) { wBarEl.style.width = `${wScore}%`; wBarEl.style.background = wColor; }

    const kScoreEl = document.getElementById('kpiKarmaScore');
    const kBarEl = document.getElementById('kpiKarmaBar');
    if (kScoreEl) { kScoreEl.innerHTML = `${kScore}점 ${kGrade}`; kScoreEl.style.color = kColor; }
    if (kBarEl) { kBarEl.style.width = `${kScore}%`; kBarEl.style.background = kColor; }

    return { potScore, potGrade, potColor, timScore, timGrade, timColor, wScore, wGrade, wColor, kScore, kGrade, kColor, alertHtml };
  }

  // ─────────────────────────────────────────────────────────────────────
  // 👹 벽사견이 등 뒤에서 본 것 — 가장 모자란 오행(weakKey)의 틈으로 들어온 귀신 5종 (직접 그린 SVG)
  // ─────────────────────────────────────────────────────────────────────
  const GHOST_SVG_HEAD = `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" role="img" focusable="false">
    <defs>
      <radialGradient id="gpBg" cx="50%" cy="42%" r="70%"><stop offset="0" stop-color="#2a1712"/><stop offset=".6" stop-color="#120a08"/><stop offset="1" stop-color="#050302"/></radialGradient>
      <filter id="gpRough" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="7"/></filter>
      <filter id="gpGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="gpSmoke"><feGaussianBlur stdDeviation="5"/></filter>
    </defs>
    <rect width="240" height="240" fill="url(#gpBg)"/>`;
  const GHOST_SVG_FOOT = `<ellipse class="gp-fog" cx="120" cy="232" rx="150" ry="26" fill="#d9cfc0" opacity=".10" filter="url(#gpSmoke)"/></svg>`;
  const rep = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join('');

  const GHOSTS = {
    // 목(木) 결핍 → 고목귀: 속 빈 고목, 가지 뿔, 구멍 눈
    wood: {
      name: '고목귀', hanja: '枯木鬼',
      lore: '속이 텅 빈 고목에 깃들어 사는 귀신이오. 그대 사주에 나무 기운이 모자란 틈으로 들어와, 그대가 무언가 시작하려 할 때마다 마른 가지 같은 손가락으로 발목을 감소. 결심이 자꾸 내일로 밀렸다면 이것이 붙어 있었던 탓이오.',
      svg: () => `<g filter="url(#gpRough)">
        <path d="M86 70 C70 40 52 34 40 14 M78 66 C66 52 60 30 66 8 M154 70 C170 40 190 34 202 12 M162 66 C176 50 178 30 172 6 M60 40 L44 44 M184 38 L200 46" stroke="#2b1d12" stroke-width="7" fill="none" stroke-linecap="round"/>
        <path d="M72 78 C70 52 170 52 168 78 L176 160 C178 196 150 226 120 228 C90 226 62 196 64 160 Z" fill="#3a2a1b"/>
        <path d="M92 70 L88 120 L96 170 M120 60 L118 100 M148 72 L152 118 L144 176 M104 190 L110 222 M136 192 L130 224" stroke="#1d130b" stroke-width="2.4" fill="none"/>
        <ellipse cx="96" cy="118" rx="17" ry="22" fill="#050302"/><ellipse cx="146" cy="116" rx="15" ry="24" fill="#050302"/>
        <path d="M104 160 C112 150 128 150 136 160 L134 206 C126 214 114 214 106 206 Z" fill="#050302"/>
        <path d="M106 160 L111 172 L116 158 L121 174 L126 158 L131 172 L135 160 M107 206 L112 196 L118 208 L124 194 L130 207" stroke="#8a7a5c" stroke-width="2" fill="none"/>
        <path d="M70 150 C66 170 74 182 70 198 M170 148 C176 168 166 186 172 204" stroke="#3f5a2a" stroke-width="4" fill="none" opacity=".7"/>
      </g>
      <g class="gp-eyes" filter="url(#gpGlow)"><circle cx="98" cy="122" r="3.2" fill="#c9f7a6"/><circle cx="144" cy="120" r="3.2" fill="#c9f7a6"/></g>`
    },
    // 화(火) 결핍 → 그을음귀: 꺼진 아궁이의 연기 덩어리, 숯불 눈
    fire: {
      name: '그을음귀', hanja: '煤煙鬼',
      lore: '꺼진 아궁이의 그을음 속에 사는 귀신이오. 그대 사주에 불 기운이 모자란 틈으로 들어와, 그대 안의 불씨를 하나씩 불어 끄오. 남들 앞에선 웃다가도 혼자 있으면 싸늘하게 식어 버렸다면, 이것이 그대 어깨에 앉아 있었던 것이오.',
      svg: () => `<g filter="url(#gpSmoke)" opacity=".9">${rep(9, i => `<circle cx="${70 + (i * 37) % 100}" cy="${210 - i * 20}" r="${44 - i * 2}" fill="${i % 2 ? '#1c1714' : '#2a2420'}"/>`)}</g>
      <g filter="url(#gpRough)">
        <path d="M60 120 C56 64 96 40 122 42 C152 44 186 70 180 124 C176 168 150 196 120 198 C88 196 64 170 60 120 Z" fill="#141110"/>
        <ellipse cx="94" cy="114" rx="18" ry="11" fill="#050403" transform="rotate(18 94 114)"/><ellipse cx="146" cy="110" rx="11" ry="13" fill="#050403"/>
        <path d="M76 156 C94 144 108 172 122 158 C136 146 150 170 166 150 C160 178 92 184 76 156 Z" fill="#050403"/>
      </g>
      <g class="gp-eyes" filter="url(#gpGlow)">
        <ellipse cx="94" cy="114" rx="9" ry="4" fill="#ff6a1a" transform="rotate(18 94 114)"/><circle cx="146" cy="110" r="3.2" fill="#ffb35a"/>
        <path d="M82 158 C96 150 108 166 122 156 C134 148 146 166 160 152" stroke="#ff7a24" stroke-width="2.2" fill="none"/>
        <path d="M100 160 C101 172 98 182 100 194 M128 156 C129 168 131 176 129 186" stroke="#ff5a14" stroke-width="1.8" fill="none" opacity=".8"/>
      </g>
      ${rep(14, i => `<circle class="gp-ash" cx="${20 + (i * 53) % 200}" cy="${30 + (i * 71) % 170}" r="${1 + (i % 3) * .6}" fill="#ff7b2e" opacity="${.35 + (i % 4) * .15}"/>`)}`
    },
    // 토(土) 결핍 → 흙아귀: 바늘 목에 끝없이 벌어진 입, 긴 손가락
    earth: {
      name: '흙아귀', hanja: '土餓鬼',
      lore: '목구멍은 바늘구멍만 한데 배는 끝없이 고픈 굶주린 귀신이오. 그대 사주에 흙 기운이 모자란 틈으로 들어와, 그대가 쌓아 둔 것을 밤마다 갉아 먹소. 모아도 모아도 바닥이 드러났다면, 이것이 그대 그릇에 입을 대고 있었던 것이오.',
      svg: () => `<g filter="url(#gpRough)">
        <path d="M112 186 L108 240 M128 186 L132 240" stroke="#4e3520" stroke-width="9"/>
        <path d="M50 108 C44 50 196 50 190 108 C188 160 160 192 120 192 C80 192 52 160 50 108 Z" fill="#6b4a2a"/>
        <path d="M70 80 L84 96 L78 112 M168 78 L156 98 L164 110 M120 56 L116 74 M100 176 L94 190 M144 178 L150 190" stroke="#3a2614" stroke-width="2.4" fill="none"/>
        <path d="M72 120 C80 100 160 100 168 120 C170 160 148 184 120 186 C92 184 70 160 72 120 Z" fill="#0a0503"/>
        <path d="M74 120 ${rep(12, i => `L${80 + i * 8} ${i % 2 ? 120 : 132}`)} L166 120" stroke="#d8cdb0" stroke-width="2" fill="#d8cdb0"/>
        <path d="M84 176 ${rep(10, i => `L${88 + i * 7} ${i % 2 ? 178 : 166}`)} L156 176" stroke="#c9bd9e" stroke-width="2" fill="#c9bd9e"/>
        <path d="M150 140 C146 160 152 170 150 184" stroke="#6b1010" stroke-width="3" fill="none" opacity=".8"/>
        <ellipse cx="94" cy="86" rx="10" ry="7" fill="#0a0503"/><ellipse cx="146" cy="86" rx="10" ry="7" fill="#0a0503"/>
        <path d="M20 240 C26 210 30 196 40 186 M40 186 L30 170 M40 186 L44 166 M40 186 L54 172 M220 240 C214 210 210 196 200 186 M200 186 L210 170 M200 186 L196 166 M200 186 L186 172" stroke="#5a3d22" stroke-width="5" fill="none" stroke-linecap="round"/>
      </g>
      <g class="gp-eyes" filter="url(#gpGlow)"><circle cx="95" cy="86" r="2.4" fill="#f5efe0"/><circle cx="145" cy="86" r="2.4" fill="#f5efe0"/></g>`
    },
    // 금(金) 결핍 → 외뿔도깨비: 녹슨 쇠뿔 하나, 툭 불거진 눈, 위로 솟은 엄니
    metal: {
      name: '외뿔도깨비', hanja: '獨角鬼',
      lore: '녹슨 쇠뿔 하나를 단 도깨비요. 그대 사주에 쇠 기운이 모자란 틈으로 들어와, 끊어야 할 인연 앞에서 그대 칼날을 무디게 만드오. 아니다 싶은 사람을 끝내 놓지 못했다면, 이 도깨비가 그대 손목을 붙들고 있었던 것이오.',
      svg: () => `<g filter="url(#gpRough)">
        ${rep(11, i => `<path d="M${58 + i * 12} 74 L${50 + i * 13} ${30 + (i % 3) * 10} L${66 + i * 12} 70" fill="#120d0b"/>`)}
        <path d="M116 58 C108 30 118 12 138 2 C128 22 132 40 128 58 Z" fill="#cbbfa0"/>
        <path d="M118 46 L130 44 M120 34 L132 30" stroke="#7a6a4c" stroke-width="2"/>
        <path d="M52 110 C48 66 192 66 188 110 L182 168 C176 204 150 222 120 222 C90 222 64 204 58 168 Z" fill="#4a5150"/>
        <path d="M64 96 C80 120 70 150 86 168 M176 104 C166 130 178 150 160 178 M110 200 C120 190 132 196 140 206" stroke="#7a3a1a" stroke-width="9" fill="none" opacity=".55"/>
        <path d="M66 98 L108 112 M174 98 L132 112" stroke="#120d0b" stroke-width="10" stroke-linecap="round"/>
        <circle cx="92" cy="126" r="17" fill="#d9c34a"/><circle cx="148" cy="126" r="17" fill="#d9c34a"/>
        <path d="M110 140 L120 160 L130 140" fill="#2c3130"/>
        <path d="M72 172 C92 200 148 200 168 172 C150 182 90 182 72 172 Z" fill="#0a0605"/>
        <path d="M84 178 L90 150 L98 182 Z M156 178 L150 150 L142 182 Z" fill="#e8dfc4"/>
        <path d="M100 184 L104 192 L110 185 L116 194 L122 185 L128 193 L134 185 L140 191" stroke="#e8dfc4" stroke-width="2" fill="none"/>
      </g>
      <g class="gp-eyes" filter="url(#gpGlow)"><circle cx="94" cy="128" r="6" fill="#b3120b"/><circle cx="146" cy="128" r="6" fill="#b3120b"/><circle cx="94" cy="128" r="2" fill="#050302"/><circle cx="146" cy="128" r="2" fill="#050302"/></g>`
    },
    // 수(水) 결핍 → 물귀신: 젖은 머리칼 사이로 한쪽 눈, 물방울
    water: {
      name: '물귀신', hanja: '水鬼',
      lore: '젖은 머리칼을 늘어뜨린 채 물가에서 사람을 기다리는 귀신이오. 그대 사주에 물 기운이 모자란 틈으로 들어와, 그대 생각을 흙탕물처럼 흐리오. 밤마다 머리가 달아올라 잠들지 못했다면, 이것이 그대 베갯머리에 앉아 있었던 것이오.',
      svg: () => `<g filter="url(#gpRough)">
        <path d="M70 108 C66 60 174 60 170 108 L168 170 C164 200 142 216 120 216 C98 216 76 200 72 170 Z" fill="#a9bcbf"/>
        <path d="M84 150 C88 170 96 196 100 214 M154 140 C150 170 146 196 140 214" stroke="#7d9396" stroke-width="2" fill="none"/>
        <ellipse cx="138" cy="128" rx="14" ry="10" fill="#f4f6f2"/><circle cx="140" cy="129" r="3.6" fill="#050302"/>
        <path d="M108 186 C114 182 126 182 132 186 C126 192 114 192 108 186 Z" fill="#2a1414"/>
        <path d="M138 140 C140 160 136 176 138 198" stroke="#5b2a2a" stroke-width="1.6" fill="none" opacity=".7"/>
      </g>
      <g fill="none" stroke-linecap="round">${rep(26, i => { const x = 56 + i * 5.2; const skip = x > 124 && x < 152; const top = 46 + Math.round((x - 120) * (x - 120) / 160); return skip ? `<path d="M${x} ${top} C${x - 8} 90 ${x + 6} 100 ${x - 2} 110" stroke="#050403" stroke-width="5"/>` : `<path d="M${x} ${top} C${x - 10 + (i % 4) * 5} 110 ${x + 8 - (i % 3) * 6} 170 ${x - 4 + (i % 5) * 2} ${226 + (i % 4) * 6}" stroke="${i % 3 ? '#070606' : '#151414'}" stroke-width="${5 + (i % 3)}"/>`; })}</g>
      ${rep(7, i => `<path class="gp-drip" d="M${64 + i * 19} ${222 + (i % 3) * 6} q3 6 0 9 q-3 -3 0 -9 Z" fill="#7fa3b0" opacity=".75"/>`)}
      <g class="gp-eyes" filter="url(#gpGlow)"><circle cx="140" cy="129" r="1.4" fill="#e8f6ff"/></g>`
    }
  };

  function ghostFor(weakKey) { return GHOSTS[weakKey] || GHOSTS.water; }
  function ghostPortraitHtml(weakKey) {
    const g = ghostFor(weakKey);
    return `<figure class="ghost-portrait" data-ghost="${weakKey}">
        <p class="ghost-mirror-title">벽사견이 그대 등 뒤를 비춰 본 거울</p>
        <p class="ghost-warn">⚠️ 아래 그림은 무섭거나 불쾌할 수 있습니다. 어린이·노약자·임산부, 공포 그림을 힘들어하는 분은 보지 않는 것을 권합니다.</p>
        <div class="ghost-portrait-frame">${GHOST_SVG_HEAD}${g.svg()}${GHOST_SVG_FOOT}<img class="ghost-img" src="img/ghosts/${weakKey}.jpg" width="640" height="640" alt="${g.name}(${g.hanja}) 그림" decoding="async" onload="this.parentNode.classList.add('has-img')" onerror="this.remove()">
          <svg class="ghost-mirror-crack" viewBox="0 0 100 125" preserveAspectRatio="none" aria-hidden="true"><path d="M71 8 L64 30 L70 41 L58 62 M64 30 L80 36 M70 41 L86 52 M58 62 L49 70 M58 62 L66 80" fill="none" stroke="rgba(235,230,220,.45)" stroke-width=".45"/><path d="M12 96 L22 88 L27 94 L36 86" fill="none" stroke="rgba(235,230,220,.3)" stroke-width=".4"/></svg>
          <button type="button" class="ghost-gate">👁 거울을 들여다보겠소?<small>눌러서 그대 등 뒤 보기</small></button>
        </div>
        <figcaption><span class="ghost-portrait-name">${g.name}</span> <span class="ghost-portrait-hanja">${g.hanja}</span></figcaption>
        <p class="ghost-ai-note">위 그림은 AI로 생성한 이미지입니다.</p>
      </figure>`;
  }
  // 경고를 읽고 직접 눌러야 그림이 드러난다
  function revealGhost(el) {
    if (!el) return;
    const gate = el.querySelector('.ghost-gate');
    if (!gate) { el.classList.add('is-seen'); return; }
    gate.onclick = () => { el.classList.add('is-seen'); gate.remove(); };
  }

  /** 즉시 손절할 3대 악연 — 일간 10개로 가르고(양간 = app.js 원래 목록, 음간 = phrases.js), 순서는 사람마다 섞는다 */
  function enemiesFor(c) {
    if (!c) return ENEMY_TYPES.water;
    const PH = window.BYEOKSA_PHRASES;
    const base = ((c.yin === 1 && PH.ENEMY_YIN[c.stemChar]) ? PH.ENEMY_YIN[c.stemChar] : ENEMY_TYPES[c.stemEl]).concat(PH.ENEMY_EXTRA[c.stemChar] || []);
    // 5개 중 3개: 어느 3개를 어떤 순서로 보여 줄지 사람마다 다르게 (10가지 조합 × 순서)
    const combos = [[0, 1, 2], [0, 1, 3], [0, 1, 4], [0, 2, 3], [0, 2, 4], [0, 3, 4], [1, 2, 3], [1, 2, 4], [1, 3, 4], [2, 3, 4]];
    const pickC = combos[(c.seed >>> 3) % combos.length].slice();
    if ((c.seed >>> 8) & 1) pickC.reverse();
    return pickC.map(i => base[i]);
  }
  function updateGhostWarningCard(dStem, dBranch, oheng, dayStemIdx) {
    const dayBranchIdxG = BRANCHES.findIndex(b => b.char === dBranch.char);
    const nobles = noblesFor(dayStemIdx, dayBranchIdxG);
    const ps = getPersona(dayStemIdx, BRANCHES.indexOf(dBranch), oheng);
    const ghost = ghostFor(ps.weakKey);
    const PH = window.BYEOKSA_PHRASES, c = CUR;
    ORIG.ghostIntro = `당장 그대 등 뒤를 돌아보시오. 끈적한 악취가 진동하오.`;
    ORIG.parasite = `그대 주변에 분명히 있소. <strong>평소엔 살갑게 굴다가도, 그대가 조금만 좋은 일이 생기면 눈빛이 묘하게 차가워지며 '그게 잘될까?' 하고 초를 치는 인간!</strong><br>` +
      `그대가 피땀 흘려 쌓아 올린 아이디어와 노력을 은근슬쩍 가로채려 드는 <strong class="impact-red">[흡기귀(吸氣鬼, 기운을 빨아먹는 귀신) 같은 악연]</strong>이 그대 등 뒤에 시커멓게 찰싹 달라붙어 있소!`;
    const ghostIntro = c ? ph(PH.GHOST_INTRO, null, c, 11) : ORIG.ghostIntro;
    const parasite = c ? ph(PH.PARASITE, c.domGroup, c) : ORIG.parasite;
    const enemyList = enemiesFor(c);
    const enemyFace = enemyList[c ? c.seed % 3 : 0];
    const whereLine = c ? ` 내가 냄새를 맡은 자리는 <strong>${PH.GHOST_WHERE[c.branchIdx]}</strong>${josa(PH.GHOST_WHERE[c.branchIdx], '이') === '이' ? '이오' : '요'}. 그 자리부터 치우시오.` : '';
    ORIG.ghostWarn = `이 악연의 싹을 지금 잘라내지 않으면, 그대가 애써 모은 돈과 운기가 밑 빠진 독처럼 줄줄 새어나가오. 하늘이 보낸 귀인(천을귀인)인 <strong class="impact-gold">${nobles[0]}</strong>${josa(nobles[0], '을')} 곁에 두고 악연을 칼같이 베어낼 비방이 시급하오!`;
    const ghostWarn = c ? ph(PH.GHOST_WARN, null, c, 19) : ORIG.ghostWarn;
    const gp = document.getElementById('ghostPortrait');
    if (gp) {
      gp.innerHTML = ghostPortraitHtml(ps.weakKey);
      revealGhost(gp.querySelector('.ghost-portrait'));
    }
    const gl = document.getElementById('ghostLore');
    if (gl) {
      ORIG.ghostSeen = `벽사견이 그대 등 뒤에서 똑똑히 봤소.`;
      ORIG.ghostRetreat = `내가 이빨을 드러내자 한 걸음 물러섰지만, 그림자 끝은 아직 그대 뒤꿈치에 걸려 있소.`;
      const seen = c ? ph(PH.GHOST_SEEN, null, c, 44) : ORIG.ghostSeen;
      const stemLine = c ? ' ' + PH.GHOST_STEM[c.stemIdx](c) : '';
      const retreat = c ? ph(PH.GHOST_RETREAT, c.branchKind, c, 45) : ORIG.ghostRetreat;
      gl.innerHTML = `<p class="ghost-lore">🐾 <strong>${seen} <span class="impact-red">${ghost.name}(${ghost.hanja})</span>.</strong> ${ghost.lore}${stemLine} ${retreat}${whereLine}</p>`;
    }
    document.getElementById('ghostDesc').innerHTML = 
      `${ghostIntro}<br><br>` +
      `${parasite}<br><br>` +
      `🩸 <strong class="impact-red">벽사견의 서늘한 경고</strong>: ${ghostWarn}` +
      `<br><br>🐾 <strong>${EL_NAME[ps.dmEl]} 기운 사람인 그대에게 붙는 흡기귀의 얼굴</strong>: ${enemyFace}`;
    setKeyLine('ghostWarningCard', `등 뒤에 붙은 것은 <strong>${ghost.name}(${ghost.hanja})</strong> · 곁에 둘 사람은 <strong>${nobles[0]}</strong> · 멀리할 사람은 아래 '흡기귀(기운을 빨아먹는 귀신)의 얼굴'.`, '.ghost-header', 'dark');
  }

  function updateSniffTeaser(dStem, dBranch, dayStemIdx, dream, oheng) {
    const nobles = noblesFor(dayStemIdx, BRANCHES.indexOf(dBranch));
    const ps = getPersona(dayStemIdx, BRANCHES.indexOf(dBranch), oheng);
    const careerSipsin = getSipsin(dayStemIdx, ((Y_R1 - 4) % 10 + 10) % 10);
    const loveScent = SOULMATE_SCENTS[ps.weakKey].short;
    const PH = window.BYEOKSA_PHRASES, c = CUR;
    const youngLove = `"아직 여물지 않은 인연의 냄새가 잡히오. 앞으로 그대 곁을 스쳐 갈 사람들 가운데에는 그대 마음을 갉아먹으려 드는 <strong class="impact-red">악연</strong>도 섞여 있을 것이오. 달콤한 말 뒤에 숨은 곰팡이 냄새를 가려낼 줄 알아야 하오. 하지만 그대를 평생 지켜줄 ${loveScent}${josa(loveScent, '을')} 풍기는 [<strong class="impact-green">${nobles[0]}</strong>] <strong class="impact-green">천생연분</strong>이 운명선 뒤편에서 다가오고 있으니..."`;
    ORIG.sniffLove = `"코끝을 찌르는 지독한 사랑의 체취가 잡히오. 그대를 거쳐간 인연들을 돌아보시오. 10명 중 8명은 그대 영혼을 갉아먹고 떠난 <strong class="impact-red">핏빛 악연</strong>이었을 것이오. 달콤한 향수 뒤에 숨겨진 곰팡이 냄새... 하지만 그대를 평생 지켜줄 ${loveScent}${josa(loveScent, '을')} 풍기는 [<strong class="impact-green">${nobles[0]}</strong>] <strong class="impact-green">천생연분</strong>이 운명선 뒤편에서 다가오고 있으니..."`;
    ORIG.sniffWealth = `"아무리 열심히 일하고 아껴 써도 밑 빠진 독처럼 통장이 텅 비어버리는 <strong class="impact-red">돈 새는 구멍(누재살)의 비린내</strong>가 나오. 통장에 돈이 모일 만하면 꼭 예상치 못한 사건사고로 돈이 털려나갔소? 그 구멍을 땜질할 재물의 비방이 포착되었소."`;
    ORIG.sniffCareer = `"[<strong class="impact-gold">${dream}</strong>]${josa(dream, '을')} 향해 갈 때 그대 성과를 낚아채고 혓바닥으로 그대 칼을 갈던 인간들의 썩은 내가 보이고 있소. 그대 칼날을 갈아 판을 뒤엎을 <strong class="impact-gold">${Y_R0}~${Y_R1}년 이직·독립에 가장 좋은 때</strong>의 냄새가 짙게 풍기오..."`;
    // 사랑: 미성년은 순한 문장 하나, 성인은 일지 삼합 그룹별(세 번째 변형마다 원래 문장)
    const loveMain = isYoung() ? youngLove
      : (c ? ((c.seed >>> 5) % 5 === 0 ? ORIG.sniffLove : ((c.seed >>> 6) & 1 ? PH.SNIFF_LOVE2 : PH.SNIFF_LOVE)[c.branchGroup](c)) : ORIG.sniffLove);
    const wealthMain = c ? ph(PH.SNIFF_WEALTH, c.leakKey, c) : ORIG.sniffWealth;
    const careerMain = c ? ph(PH.SNIFF_CAREER, String(c.dreamRel), c, 47) : ORIG.sniffCareer;
    document.getElementById('sniffLoveText').innerHTML = 
      loveMain + `<br><span class="sniff-personal">🐾 특히 ${EL_NAME[ps.dmEl]} 기운 사람인 그대에게 가장 해로운 건 <strong class="impact-red">[${ruinTitleFor(ps, c)}]</strong>를 풍기는 자라오.</span>`;

    document.getElementById('sniffWealthText').innerHTML = 
      wealthMain + `<br><span class="sniff-personal">🐾 ${wealthDiagnosis(ps, 'teaser')}</span>`;

    document.getElementById('sniffCareerText').innerHTML = 
      careerMain + `<br><span class="sniff-personal">🐾 ${Y_R1}년 ${yearGanji(Y_R1)}의 기운이 그대에게 <strong class="impact-gold">[${sipsinPlain(careerSipsin)}]</strong>${josa(sipsinPlain(careerSipsin), '으로')} 들어오오. ${CAREER_SIPSIN_HINT[careerSipsin]}</span>`;
    // 🔒 자물쇠 줄도 사람별로 (귀인 띠·재성 오행·골든타임 십신) — 2026-10-25, 모두에게 똑같던 세 줄
    const locks = document.querySelectorAll('#sniffTeaserCard .sniff-lock-badge');
    if (locks.length === 3) {
      locks[0].textContent = `🔒 ${nobles[0]} 귀인과 파멸의 악연 띠 프로파일은 복채 결제 후 개봉`;
      locks[1].innerHTML = `🔒 <span class="yr-roadmap">${Y_R0}~${Y_R2}년</span> ${EL_KO[ps.wealthEl]} 재물이 터지는 달(月) & 재물 풍수는 복채 결제 후 개봉`;
      locks[2].textContent = `🔒 ${Y_R1}년 성과 도둑 퇴치법 및 이직·독립에 가장 좋은 때는 복채 결제 후 개봉`;
    }
    setKeyLine('sniffTeaserCard', `연애는 <strong>${ruinTitleFor(ps, c)}</strong>를 풍기는 사람을 피하고 · 돈은 <strong>새는 구멍(누재살)</strong>을 막고 · 일은 <strong>${Y_R0}~${Y_R1}년</strong>이 가장 좋은 때요.`, '.section-title');
  }

  function renderTileHtml(item) {
    if (!item) return `<div class="ganji-tile unknown" title="태어난 시간을 넣으면 시주까지 풀어 주오"><span class="main-char">時</span><span class="sub-char">모름</span></div>`;
    return `<div class="ganji-tile ${item.el}"><span class="main-char">${item.char}</span><span class="sub-char">${item.name}</span></div>`;
  }

  function renderJijangHtml(branch, dayStemIdx) {
    if (!branch) return `-`;
    return `<div class="jijanggan-box">` + branch.jijang.map(idx => {
      const s = STEMS[idx];
      return `<span class="badge ${s.el}">${s.char} ${getSipsin(dayStemIdx, idx)}</span>`;
    }).join('') + `</div>`;
  }

  function renderPillars(p) {
    document.getElementById('yearStem').innerHTML = renderTileHtml(p.yStem);
    document.getElementById('monthStem').innerHTML = renderTileHtml(p.mStem);
    document.getElementById('dayStem').innerHTML = renderTileHtml(p.dStem);
    document.getElementById('hourStem').innerHTML = renderTileHtml(p.hStem);

    document.getElementById('yearBranch').innerHTML = renderTileHtml(p.yBranch);
    document.getElementById('monthBranch').innerHTML = renderTileHtml(p.mBranch);
    document.getElementById('dayBranch').innerHTML = renderTileHtml(p.dBranch);
    document.getElementById('hourBranch').innerHTML = renderTileHtml(p.hBranch);

    document.getElementById('yearJijang').innerHTML = renderJijangHtml(p.yBranch, p.dStemIdx);
    document.getElementById('monthJijang').innerHTML = renderJijangHtml(p.mBranch, p.dStemIdx);
    document.getElementById('dayJijang').innerHTML = renderJijangHtml(p.dBranch, p.dStemIdx);
    document.getElementById('hourJijang').innerHTML = p.hBranch ? renderJijangHtml(p.hBranch, p.dStemIdx) : '<span class="cell-unknown">시간 모름</span>';
    const hourNote = document.getElementById('hourUnknownNote');
    if (hourNote) hourNote.hidden = !!p.hBranch;
    // 시간을 모르면 시(時) 칸 여섯 줄을 세로 한 칸으로 합쳐 '태어난 시간 모름'을 또렷이 (두 번 나오던 '時 모름' 상자·'·' 제거)
    const hourCells = ['hourStem', 'hourBranch', 'hourJijang', 'hourSipsin', 'hourUnsung', 'hourSinsal'].map(id => document.getElementById(id));
    if (!p.hBranch) {
      hourCells[0].rowSpan = 6; hourCells[0].className = 'hour-unknown-cell';
      hourCells[0].innerHTML = '<div class="hour-unknown-wrap"><span class="hour-unknown-char">時</span><span class="hour-unknown-text">시간 모름<br>세 기둥으로<br>풀이</span></div>';
      hourCells.slice(1).forEach(td => { td.hidden = true; });
    } else {
      hourCells[0].rowSpan = 1; hourCells[0].className = '';
      hourCells.slice(1).forEach(td => { td.hidden = false; });
    }

    document.getElementById('yearSipsin').innerText = getSipsin(p.dStemIdx, STEMS.indexOf(p.yStem));
    document.getElementById('monthSipsin').innerText = getSipsin(p.dStemIdx, STEMS.indexOf(p.mStem));
    document.getElementById('hourSipsin').innerText = p.hStem ? getSipsin(p.dStemIdx, STEMS.indexOf(p.hStem)) : '·';

    document.getElementById('yearUnsung').innerText = getUnsung(p.dStemIdx, BRANCHES.indexOf(p.yBranch));
    document.getElementById('monthUnsung').innerText = getUnsung(p.dStemIdx, BRANCHES.indexOf(p.mBranch));
    document.getElementById('dayUnsung').innerText = getUnsung(p.dStemIdx, BRANCHES.indexOf(p.dBranch));
    document.getElementById('hourUnsung').innerText = p.hBranch ? getUnsung(p.dStemIdx, BRANCHES.indexOf(p.hBranch)) : '·';

    const ybIdx = BRANCHES.indexOf(p.yBranch);
    const dbIdx = BRANCHES.indexOf(p.dBranch);
    const fmt = arr => (!arr || arr.length === 0) ? '-' : arr.map(s => `<span class="sinsal-tag">${s}</span>`).join('<br>');

    document.getElementById('yearSinsal').innerHTML = fmt(getSinsal(ybIdx, dbIdx, ybIdx, p.dStemIdx));
    document.getElementById('monthSinsal').innerHTML = fmt(getSinsal(ybIdx, dbIdx, BRANCHES.indexOf(p.mBranch), p.dStemIdx));
    document.getElementById('daySinsal').innerHTML = fmt(getSinsal(ybIdx, dbIdx, dbIdx, p.dStemIdx));
    document.getElementById('hourSinsal').innerHTML = p.hBranch ? fmt(getSinsal(ybIdx, dbIdx, BRANCHES.indexOf(p.hBranch), p.dStemIdx)) : '·';
  }

  // 🕯️ 출생 시진(또는 시간 모를 때 그날 하루) 안에 절입 시각이 걸치면 안내한다
  function renderTermBoundaryNote(boundary, hourKnown) {
    const el = document.getElementById('termBoundaryNote');
    if (!el) return;
    if (!boundary) { el.style.display = 'none'; el.innerHTML = ''; return; }
    const what = boundary.idx === 1 ? '해(年)와 달(月)' : '달(月)';
    const range = hourKnown ? '그대가 고한 시진' : '시진을 모르는 그날 하루';
    el.innerHTML =
      `🕯️ <strong>절입(節入) 경계 경고</strong>: ${range} 안에 <strong>[${boundary.name}]</strong> 절입 시각(${boundary.label})이 걸쳐 있소. ` +
      `태어난 시각이 이보다 앞서느냐 뒤서느냐에 따라 ${what}의 기둥이 바뀌오. 지금 풀이는 ${hourKnown ? '시진의 한가운데' : '그날 정오'}를 기준으로 했으니, 정확한 출생 시각(분)을 확인하시오.`;
    el.style.display = 'block';
  }

  let lastDaeun = null;
  function renderDaeun(birthYear, birthMonth, birthDay, gender, yStemIdx, mStemIdx, mBranchIdx, dStemIdx, pillars) {
    // 대운 계산은 SajuCore.calculateDaeun 하나로 통일 (절기 시각 기반 대운수)
    const { isForward, daeunNum, currentAge, daeunItems, curActiveIndex } =
      calculateDaeun(birthYear, birthMonth, birthDay, gender, yStemIdx, mStemIdx, mBranchIdx, dStemIdx, pillars);

    document.getElementById('daeunBadge').innerText = `${daeunNum}세부터 10년마다 바뀜`;   // 쉬운 말 (2026-11-02): '여성 순행 · 4세 대운 주기' 대신

    const scrollContainer = document.getElementById('daeunScroll');
    scrollContainer.innerHTML = daeunItems.map((item) => `
      <div class="daeun-item ${item.isCurrent ? 'current-daeun' : ''}">
        ${item.isCurrent ? '<span class="daeun-current-tag">현재</span>' : ''}
        <span class="daeun-age">${item.ageStart}세</span>
        <div class="daeun-tiles">
          <span class="badge ${item.stemObj.el}" style="font-size:12px; font-weight:800;">${item.stemObj.char}</span>
          <span class="badge ${item.branchObj.el}" style="font-size:12px; font-weight:800;">${item.branchObj.char}</span>
        </div>
        <div class="daeun-sub">
          <div>${SIPSIN_SHORT[item.sipsin] || item.sipsin}<span class="daeun-term">(${item.sipsin})</span></div>
          <div style="color:#64748b;">${UNSUNG_SHORT[item.unsung] || item.unsung}<span class="daeun-term">(${item.unsung})</span></div>
        </div>
      </div>
    `).join('');

    // 지금 나이가 첫 10년 운 전(어린이)이면 '지금' 칸이 없다 → 따로 쓴다. 전엔 3번째 칸을 '지금'으로 썼다 (업데이트 44, 더블체크 1-3)
    const first = daeunItems[0];
    const before = curActiveIndex < 0 && currentAge < first.ageStart;
    const activeItem = curActiveIndex >= 0 ? daeunItems[curActiveIndex] : (before ? null : daeunItems[daeunItems.length - 1]);
    lastDaeun = { item: activeItem, age: currentAge, first, before };   // 한눈에·리포트 요약용 (item이 없으면 '지금 10년 운'을 견주는 문장은 빠진다)
    if (before) {
      const fg = `${first.stemObj.char}${first.branchObj.char}`;
      document.getElementById('daeunComment').innerHTML =
        `🕯️ <strong>"지금 그대의 명줄(만 ${currentAge}세)은 아직 첫 10년 운이 열리기 전이오."</strong><br>` +
        `첫 10년 운(${fg})은 ${first.ageStart}세에 열리고, 그 전까지는 태어난 달의 기운이 그 몫을 하오.`;
      setKeyLine('daeunCard', `지금은 첫 10년 운이 열리기 전, 만 ${currentAge}세 · <strong>${first.ageStart}세</strong>에 첫 10년 운(${fg})이 열리오.`, '.daeun-header');
      return;
    }
    document.getElementById('daeunComment').innerHTML = 
      // '네놈' → '그대' (업데이트 40, 대표님 2026-11-08). 원래: '지금 네놈의 명줄(만 …세)은'
      `🕯️ <strong>"지금 그대의 명줄(만 ${currentAge}세)은 [${activeItem.ageStart}세부터의 10년 운 ${activeItem.stemObj.char}${activeItem.branchObj.char}]의 격랑 한복판에 서 있소."</strong><br>` +
      `이 시기는 <strong>${sipsinPlain(activeItem.sipsin)}</strong>과 <strong>${UNSUNG_PLAIN[activeItem.unsung] || activeItem.unsung}(${activeItem.unsung})</strong>의 기운이 엇갈리며 인생의 판을 통째로 엎어버리는 때요. 머뭇거리다간 기회를 통째로 뜯어먹히니, 이를 악물고 그대 칼을 쥐시오.` +
      (window.BYEOKSA_PHRASES.DAEUN_NOW[activeItem.sipsin] ? '<br>' + window.BYEOKSA_PHRASES.DAEUN_NOW[activeItem.sipsin](CUR || {}) : '');
    const nextItem = daeunItems[daeunItems.indexOf(activeItem) + 1];
    setKeyLine('daeunCard', `지금은 <strong>${activeItem.ageStart}세부터의 10년 운(${activeItem.stemObj.char}${activeItem.branchObj.char})</strong> 한복판, 만 ${currentAge}세${nextItem ? ` · <strong>${nextItem.ageStart}세</strong>에 다음 10년 운(${nextItem.stemObj.char}${nextItem.branchObj.char})으로 바뀌오` : ''}.`, '.daeun-header');   // 제목이 .daeun-header 안에 있어 그 뒤에 (업데이트 39, 검수 11번 — 전엔 카드 맨 위에 붙었다)
  }

  function renderOheng(p) {
    const counts = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
    const items = [p.yStem, p.yBranch, p.mStem, p.mBranch, p.dStem, p.dBranch];
    if (p.hStem && p.hBranch) items.push(p.hStem, p.hBranch);

    items.forEach(it => { if (it) counts[it.el]++; });
    const total = items.length;

    document.getElementById('stackedBar').innerHTML = `
      <div class="stacked-segment wood" style="width:${(counts.wood/total)*100}%;">${counts.wood > 0 ? '목' : ''}</div>
      <div class="stacked-segment fire" style="width:${(counts.fire/total)*100}%;">${counts.fire > 0 ? '화' : ''}</div>
      <div class="stacked-segment earth" style="width:${(counts.earth/total)*100}%;">${counts.earth > 0 ? '토' : ''}</div>
      <div class="stacked-segment metal" style="width:${(counts.metal/total)*100}%;">${counts.metal > 0 ? '금' : ''}</div>
      <div class="stacked-segment water" style="width:${(counts.water/total)*100}%;">${counts.water > 0 ? '수' : ''}</div>
    `;

    const elNames = [
      { key: 'wood', label: '목(木)', color: '#14532d' },
      { key: 'fire', label: '화(火)', color: '#991b1b' },
      { key: 'earth', label: '토(土)', color: '#78350f' },
      { key: 'metal', label: '금(金)', color: '#334155' },
      { key: 'water', label: '수(水)', color: '#0c4a6e' }
    ];

    document.getElementById('ohengList').innerHTML = elNames.map(e => `
      <div class="oheng-item">
        <div class="oheng-item-name" style="color:${e.color}">${e.label}</div>
        <div class="oheng-item-val">${counts[e.key]}자</div>
        <div style="font-size:10px; color:#888;">${Math.round((counts[e.key]/total)*100)}%</div>
      </div>
    `).join('');

    let strong = [], weak = [];
    elNames.forEach(e => {
      if (counts[e.key] >= 2) strong.push(EL_NAME[e.key]);   // 쉬운 이름 (2026-11-02)
      if (counts[e.key] === 0) weak.push(e.key);
    });

    let comment = `그대 사주 ${total}글자를 훑어보니, `;
    if (strong.length > 0) comment += `<strong>${strong.join(', ')}</strong>의 기운이 지나치게 치솟아 나쁜 기운(살)으로 변할 조짐이오. `;   // 조사는 괄호 앞 '기운'에 맞춘다 (업데이트 39, 검수 12번)
    if (weak.length > 0) {
      const weakLabels = weak.map(k => {
        const found = elNames.find(x => x.key === k);
        return (EL_NAME[k] || k) + ' 기운';   // 쉬운 이름 (2026-11-02)
      });
      comment += `반대로 <strong>${weakLabels.join(', ')}</strong>의 맥이 끊겨 밑 빠진 독처럼 생기가 새어나가고 있소!`;
    } else {
      comment += `다섯 기운이 서로 잘 돕고 있으나 자만하는 순간 나쁜 기운이 덮칠 것이오.`;
    }
    document.getElementById('ohengComment').innerHTML = comment;

    return { strong, weak, counts, total };
  }

  // 📜 결제 후 대외비 영적 전략 포트폴리오 생성
      function updatePaywallContent(dStem, dBranch, oheng, dayStemIdx, dayBranchIdx, dream, job, birthYear, birthMonth, birthDay) {
    const iljuName = `${dStem.char}${dBranch.char}`;
    const nobles = noblesFor(dayStemIdx, dayBranchIdx);
    const ps = getPersona(dayStemIdx, dayBranchIdx, oheng);
    const weakKey = ps.weakKey;   // 오행이 모두 있으면 가장 적은 오행 (예전엔 무조건 water)
    const remedy = ELEMENT_REMEDIES[weakKey] || ELEMENT_REMEDIES['water'];
    const ruin = RUIN_LOVERS[ps.dmEl];
    const soulmate = SOULMATE_SCENTS[weakKey];
    const _t = new Date();   // 기기 현지 날짜 (toISOString은 UTC라 한국 오전 9시 전엔 어제 날짜가 찍혔다)
    const todayStr = `${_t.getFullYear()}. ${String(_t.getMonth() + 1).padStart(2, '0')}. ${String(_t.getDate()).padStart(2, '0')}`;

    const kpi = updateKpiDashboard(dayStemIdx, dayBranchIdx, oheng, birthYear, birthMonth, birthDay);

    // 누재살 비방·100일 작전을 사주에 맞게 고른다 (예전엔 모두에게 같은 세 줄)
    const grp = sipsinGroupCounts(ps.dmEl, (oheng && oheng.counts) || {});
    const leakKey = ['bi', 'sik', 'gwan', 'in'].reduce((a, k) => (grp[k] > grp[a] ? k : a), 'bi');
    const wealthRemedy = ELEMENT_REMEDIES[ps.wealthEl] || remedy;
    const dayBranchEl = (BRANCHES[dayBranchIdx] && BRANCHES[dayBranchIdx].el) || 'water';
    // ── 사람마다 갈리는 문장 (phrases.js) — 원래 문장은 ORIG에 담아 한 갈래로 남긴다 ──
    const PH = window.BYEOKSA_PHRASES, c = CUR;
    ORIG.ch1Intro = `그대가 지금까지 [<strong class="impact-gold">${dream}</strong>]${josa(dream, '을')} 향해 달리면서 유독 피로하고 지쳤던 이유는 능력이 부족해서가 아니오.<br><br>
          그대를 둘러싼 인간관계 중에 그대 에너지와 통장을 갉아먹는 <strong class="impact-red">[기생형 흡기귀]</strong>가 붙어 있었기 때문이오.<br>
          이 자들은 그대가 힘들 땐 곁에 없다가, 그대에게 뭔가 이득이 생기거나 성과가 보이면 귀신같이 냄새를 맡고 나타나오.`;
    ORIG.cut = `변명할 기회를 주지 마시오. 서서히 연락 빈도를 줄이고 카톡 답장을 3시간 이상 늦추며 영적 연결고리를 완전히 끊어 내시오.`;
    ORIG.ch2Lookback = `그대를 스쳐 지나간 인연들을 돌아보시오. <strong>처음엔 눈이 멀 것처럼 설레었지만 결국 그대 가슴에 지독한 생채기를 남기고 떠난 자들...</strong> 그들의 냄새를 복기해 보시오.`;
    ORIG.ruinWarn = `이 자를 깊은 연인으로 들이면, 그대 사주의 명예운과 금전운이 3년간 송두리째 잿더미가 되오. 지금 그런 냄새가 나는 자가 주변에 있다면 뒤도 돌아보지 말고 뛰어 도망치시오!`;
    ORIG.meetWhere = `<strong class="impact-gold">${Y_R0}년 하반기~${Y_R1}년 상반기</strong>, 일이나 학업으로 얽힌 공적인 자리 또는 조용한 이동 중에 우연처럼 마주치게 되오.`;
    ORIG.ch3Intro = `그대 사주에는 돈을 버는 재능은 있으나, 담아두는 그릇의 밑바닥에 실금이 가 있어 물이 줄줄 새어나가는 <strong class="impact-red">돈 새는 구멍(누재살)</strong>의 기운이 감돌고 있소.<br><br>
          "돈이 좀 모였다 싶으면 꼭 엉뚱한 곳에서 목돈이 깨지는 상황", 기억나지 않소? 병원비, 가족이나 친구의 부탁, 충동적인 지출 등으로 공든 탑이 무너지는 패턴이오.`;
    ORIG.guard1 = WEALTH_GUARD_BY_COUNT;
    ORIG.guard2 = WEALTH_LEAK_BY_GROUP;
    ORIG.roadIntro = `인생의 모든 성공은 실력 30%와 타이밍 70%로 결정되오. 그대 사주에서 ${Y_R0}년부터 ${Y_R2}년까지는 10년에 한 번 올까 말까 한 격변의 파도가 밀려오는 시기요.`;
    ORIG.road = {
      R0: `그대를 옭아매던 구시대의 썩은 인연과 미련을 태워 없애는 해라오. [<strong class="impact-gold">${dream}</strong>]${josa(dream, '을')} 향한 핵심 기술과 역량을 칼처럼 벼려 내시오. 상반기엔 조용히 내실을 다지고 하반기부터 판을 벌이시오.`,
      R1: `그대 인생의 10년 운이 정점에 달하는 시기요. 그대가 준비한 결과물이 세상의 인정을 받고, 귀인의 조력으로 통장에 목돈이 꽂히며 신분이 급상승하오. 이때 주저하지 말고 인생의 승부수를 던지시오!`,
      R2: `폭발적인 성공을 바탕으로 단단한 성벽을 쌓는 해라오. 흔들리지 않는 자산 파이프라인을 구축하고, 그대를 따르는 세력을 형성하여 평생의 부(富)를 안정화하시오.`
    };
    ORIG.ch5Intro = `운명은 가만히 앉아 있는 자에게 찾아오지 않소. 벽사견의 기운을 받아 내일부터 당장 실천할 3가지 행동 수칙이오:`;
    ORIG.ch2Intro = `벽사신견의 코는 거짓말을 하지 않소. 사람이 입으로는 온갖 달콤한 사랑을 맹세해도, 그 영혼에서 뿜어져 나오는 냄새는 숨길 수 없는 법이오.`;
    ORIG.soulTrait = `그대에게 모자란 ${EL_NAME[weakKey]} 기운을 자신의 온기로 묵묵히 채워주는 [<strong class="impact-green">${nobles[0]}</strong>]의 인연이오. 그대가 인생의 벼랑 끝에 몰려도 손가락질하지 않고 묵묵히 그대 등을 받쳐줄 사람이며, 이 사람을 맞이하는 순간 막혀 있던 그대 재물의 수문이 함께 터지오.`;
    const ch2Intro = (c ? ph(PH.CH2_INTRO, null, c, 23) : ORIG.ch2Intro) + (c && c.hourKnown && c.hourSipsin && PH.LOVE_HOUR[c.hourSipsin] ? ' ' + PH.LOVE_HOUR[c.hourSipsin](c) : '');
    const soulTrait = c ? ph(PH.SOUL_TRAIT, c.strength, c) : ORIG.soulTrait;
    const soulKeep = c ? ph(PH.SOUL_KEEP, c.branchKind, c) : '';
    const kpiComment = c ? (() => { const m = { pot: kpi.potScore, tim: kpi.timScore, w: kpi.wScore, k: kpi.kScore }; const low = Object.keys(m).reduce((a, k) => m[k] < m[a] ? k : a, 'pot'); return PH.KPI_COMMENT[low](c); })() : '';
    const ch1Intro = c ? ph(PH.CH1_INTRO, c.domGroup, c) : ORIG.ch1Intro;
    const enemyList = enemiesFor(c);
    const cutLine = c ? ph(PH.CUT, c.strength, { ...c, seed: (c.seed >>> 9) }) : ORIG.cut;
    const lookback = isYoung() ? null : (c ? ((c.seed >>> 7) % 5 === 0 ? ORIG.ch2Lookback : PH.CH2_LOOKBACK[c.branchGroup](c)) : ORIG.ch2Lookback);
    const ruinYin = c && c.yin === 1 && PH.RUIN_YIN[c.stemChar];
    const ruinAlt = c && !ruinYin && ((c.seed >>> 15) & 1) ? PH.RUIN_ALT[ps.dmEl] : null;   // 양간: 원래 문장과 두 번째 문장을 번갈아
    const ruinScent = ruinYin ? ruinYin.scent : ruinAlt ? ruinAlt.scent : ruin.scent;
    const ruinTrait = ruinYin ? ruinYin.trait : ruinAlt ? ruinAlt.trait : ruin.trait;
    const soulScent = c && ((c.seed >>> 16) & 1) ? PH.SOUL_ALT[weakKey] : soulmate.scent;
    const ruinWarn = c ? ph(PH.RUIN_WARN, String(Math.min(c.gwanCount, 2)), c) : ORIG.ruinWarn;
    const meetWhere = c ? ph(PH.MEET_WHERE, c.branchKind, c) : ORIG.meetWhere;
    const ch3Intro = c ? ph(PH.CH3_INTRO, c.domGroup, c, 48) : ORIG.ch3Intro;
    const guard1 = c ? PH.GUARD1[String(Math.min(ps.wealthCount, 3))][(c.seed >>> 11) & 1](c) : WEALTH_GUARD_BY_COUNT[Math.min(ps.wealthCount, 2)];
    const guard2 = c ? PH.GUARD2[c.domGroup][(c.seed >>> 12) & 1](c) : WEALTH_LEAK_BY_GROUP[leakKey];
    const guard3Tail = c ? ph(PH.GUARD3_TAIL, c.branchGroup, c) : '';
    const roadIntro = c ? ph(PH.ROAD_INTRO, null, c, 13) : ORIG.roadIntro;
    const roadText = key => c ? ph(PH.ROAD[key], SIPSIN_GROUP[c.yearSipsin[key]] || 'in', c) + PH.ROAD_DAEUN(c, key) : ORIG.road[key];
    const ch5Month = c ? PH.CH5_MONTH(c) : '';
    const ch5Intro = c ? ph(PH.CH5_INTRO, null, c, 17) : ORIG.ch5Intro;
    // 기상 의식은 세 갈래(원래·음·추가)를 씨앗으로, 몰입 결계는 음간·양간 각각의 갈래와 원래 문장을 번갈아, 시간을 알면 시진 한 줄을 덧붙인다
    const ritualPick = c ? ((c.seed >>> 13) % 3) : 0;
    const rule1 = ritualPick === 1 ? PH.RITUAL_YIN[weakKey] : ritualPick === 2 ? PH.RITUAL_ALT2[weakKey] : (MORNING_RITUAL_BY_WEAK[weakKey] || MORNING_RITUAL_BY_WEAK.water);
    const focusAlt = c ? (c.yin === 1 ? PH.FOCUS_YIN[c.stemChar] : PH.FOCUS_YANG[c.stemChar]) : null;
    const rule2 = (focusAlt && ((c.seed >>> 17) % 3 !== 0)) ? focusAlt(dream) : (FOCUS_RULE_BY_DM[ps.dmEl] || FOCUS_RULE_BY_DM.earth)(dream);
    const hourFocus = (c && c.hourKnown && c.hourBranchIdx >= 0) ? ` 🕰️ <strong>시주로 본 때</strong>: ${PH.HOUR_FOCUS[c.hourBranchIdx]}` : '';
    const dayBranchChar = BRANCHES[dayBranchIdx] ? BRANCHES[dayBranchIdx].char : '자';
    const rule3 = PH.CLEANSE_BY_BRANCH[dayBranchChar] || CLEANSE_RULE_BY_DAY_BRANCH[dayBranchEl] || CLEANSE_RULE_BY_DAY_BRANCH.water;
    const talismanMine = c ? PH.TALISMAN_MINE(c) : '';
    // 6장 효능·사용법: 원래 문장은 ORIG에 두고, 사람별(짙은 십신·재성 글자 수·골든타임 십신·일간 오행)로 고른다 (2026-10-24)
    // 업데이트 44 (2026-11-09 더블체크 1-1·2-7, 대표님 OK): 효과를 단정하던 말을 '~하자는 뜻을 담았소'로 낮추고 6장도 하오체로. 원래 문장:
    //   '내 기를 빨아먹고 성과를 가로채려는 자들의 살기를 튕겨냅니다.' / '피 같은 돈이 줄줄 새어나가지 않도록 재물의 문을 단단히 걸어 잠급니다.'
    //   '…가장 좋은 때에 폭발적 기회를 온전히 틀어쥐도록 기운을 틔웁니다.' / '…배경화면으로 설정해 두면 매일 첫 순간 액살을 털어냅니다.'
    //   '…넣어두셔도 좋습니다.' / '…축문을 나지막이 읊으십시오.' / 사주 맞춤 끝 '…넣어 지니십시오. 효험이 배가됩니다.' / 제목 '3대 영적 수호 효능'
    ORIG.talismanEffect1 = `내 기를 빨아먹고 성과를 가로채려는 자들의 살기를 튕겨내자는 뜻을 담았소.`;
    ORIG.talismanEffect2 = `피 같은 돈이 줄줄 새어나가지 않도록 재물의 문을 단단히 걸어 잠그자는 뜻을 담았소.`;
    ORIG.talismanEffect3 = `${Y_R0}~${Y_R2}년 가장 좋은 때에 폭발적 기회를 온전히 틀어쥐도록 기운을 틔우자는 뜻을 담았소.`;
    ORIG.talismanUse = [
      `• 다운로드한 부적 이미지를 <strong>스마트폰 잠금화면이나 배경화면</strong>으로 두시오. 매일 첫 순간 액살을 털어 내자는 뜻이오.`,
      `• 출력하여 지갑 속이나 작업 공간(모니터 뒤편, 책상 서랍)에 넣어 두어도 좋소.`,
      `• 마음이 흔들리거나 중요한 결정을 내릴 때 꺼내보며 벽사견의 축문을 나지막이 읊으시오.`
    ];
    const talismanEffect1 = c ? PH.TALISMAN_EFFECT1[c.domGroup](c) : ORIG.talismanEffect1;
    const talismanEffect2 = c ? PH.TALISMAN_EFFECT2[String(Math.min(c.wealthCount, 2))](c) : ORIG.talismanEffect2;
    const talismanEffect3 = c ? PH.TALISMAN_EFFECT3[SIPSIN_GROUP[c.yearSipsin.R1] || 'gwan'](c) : ORIG.talismanEffect3;
    const talismanUse = c ? PH.TALISMAN_USE[c.stemEl](c) : ORIG.talismanUse;

    const unlockedHtml = `
      <!-- 🏛️ 대외비 1급 전문 기밀 보고서 헤더 (사주단자 고서 스타일) -->
      <div class="classified-dossier-box">
        <div class="dossier-top-bar">
          <span class="dossier-badge-secret">極秘 (대외비 1급 기밀)</span>
          <span class="dossier-doc-id">문서 식별 번호: 辟邪-${Y_R0}-天命-8821號</span>
        </div>
        <div class="dossier-title-group">
          <div class="dossier-org-title">壁 邪 神 犬 · 終 身 天 命 戰 略 報 告 書</div>
          <div class="dossier-sub-title">밤의 대문 앞을 지키는 벽사견이 그대 사주만 맡아 쓴 인생 돌파 비방록</div>
        </div>
        <div class="dossier-info-table">
          <div class="dossier-info-cell">
            <span class="dossier-label">수신 (受信)</span>
            <span class="dossier-val">${iljuName} (${dStem.hanja}${dBranch.hanja}) · 태어난 날의 글자</span>
          </div>
          <div class="dossier-info-cell">
            <span class="dossier-label">발신 (發信)</span>
            <span class="dossier-val">대문 앞 벽사견 · 벽사신견 (辟邪神犬)</span>
          </div>
          <div class="dossier-info-cell">
            <span class="dossier-label">천명 목표</span>
            <span class="dossier-val impact-gold">${dream}</span>
          </div>
          <div class="dossier-info-cell">
            <span class="dossier-label">인가 등급</span>
            <span class="dossier-val impact-red">1급 개운 비방 (전체 6개 챕터 열람 허가)</span>
          </div>
        </div>
      </div>

      <!-- 포트폴리오 핵심 지표 KPI 대시보드 (동적 연산 반영) -->
      <div class="kpi-dashboard" id="kpiDashboard">
        <div class="kpi-title">
          <strong class="kpi-heading">📊 영적 역량 & 위험 지표 진단</strong>
          <span id="kpiAlertBadge" style="font-size:12px; font-weight:800;">${kpi.alertHtml}</span>
        </div>
        <div class="kpi-grid">
          <div class="kpi-row">
            <div class="kpi-label-bar"><span style="font-size:14px; font-weight:700;">타고난 천명 그릇 (잠재 역량)</span><span id="kpiPotentialScore" style="font-size:14px; font-weight:800; color:${kpi.potColor};">${kpi.potScore}점 ${kpi.potGrade}</span></div>
            <div class="kpi-bar-bg"><div class="kpi-bar-fill" id="kpiPotentialBar" data-w="${kpi.potScore}" style="width:${kpi.potScore}%; background:${kpi.potColor};"></div></div>
          </div>
          <div class="kpi-row">
            <div class="kpi-label-bar"><span style="font-size:14px; font-weight:700;">${Y_R1} 운 폭발 지수 (가장 좋은 때)</span><span id="kpiTimingScore" style="font-size:14px; font-weight:800; color:${kpi.timColor};">${kpi.timScore}점 ${kpi.timGrade}</span></div>
            <div class="kpi-bar-bg"><div class="kpi-bar-fill" id="kpiTimingBar" data-w="${kpi.timScore}" style="width:${kpi.timScore}%; background:${kpi.timColor};"></div></div>
          </div>
          <div class="kpi-row">
            <div class="kpi-label-bar"><span style="font-size:14px; font-weight:700;">재물 방어력 (돈 새는 구멍)</span><span id="kpiWealthScore" style="font-size:14px; font-weight:800; color:${kpi.wColor};">${kpi.wScore}점 ${kpi.wGrade}</span></div>
            <div class="kpi-bar-bg"><div class="kpi-bar-fill" id="kpiWealthBar" data-w="${kpi.wScore}" style="width:${kpi.wScore}%; background:${kpi.wColor};"></div></div>
          </div>
          <div class="kpi-row">
            <div class="kpi-label-bar"><span style="font-size:14px; font-weight:700;">주변 인연 정화도 (악연 감별)</span><span id="kpiKarmaScore" style="font-size:14px; font-weight:800; color:${kpi.kColor};">${kpi.kScore}점 ${kpi.kGrade}</span></div>
            <div class="kpi-bar-bg"><div class="kpi-bar-fill" id="kpiKarmaBar" data-w="${kpi.kScore}" style="width:${kpi.kScore}%; background:${kpi.kColor};"></div></div>
          </div>
        </div>
        ${kpiComment ? `<p class="kpi-comment">🐾 ${kpiComment}</p>` : ''}
      </div>

      <!-- CHAPTER 01:<!-- CHAPTER 01: 영적 악연 차단 & 방어 매뉴얼 -->
      <div class="portfolio-section-card">
        <img class="chapter-photo" src="img/report/ch1.jpg" alt="" loading="lazy" decoding="async">
        <span class="portfolio-section-badge">第一章 · 대외비 1급</span>
        <div class="portfolio-section-title">🗡️ 기(氣) 빨아먹는 악연 색출 및 즉각 처단 매뉴얼</div>
        ${keyLineHtml(`지금 손절할 <strong>${EL_NAME[ps.dmEl]} 기운 사람용 악연 3유형</strong>이 아래 1·2·3번이오 — 연락 빈도를 줄이는 처단 비방까지 읽으시오.`)}
        <div class="portfolio-text">
          ${ch1Intro}
        </div>
        <div class="portfolio-highlight">
          <strong class="impact-red" style="font-size:15.5px; display:block; margin-bottom:8px;">⚠️ 즉시 손절해야 할 3대 악연 유형:</strong>
          <span style="font-size:13px; color:var(--ink-soft); display:block; margin-bottom:4px;">— ${EL_NAME[ps.dmEl]} 기운 사람인 그대에게 유독 들러붙는 유형</span>
          1. ${enemyList[0]}<br>
          2. ${enemyList[1]}<br>
          3. ${enemyList[2]}<br><br>
          💡 <strong class="impact-red">처단 비방</strong>: ${cutLine}
        </div>
      </div>

      <!-- CHAPTER 02: 인연과 사랑의 체취 감별 (사랑의 냄새 대폭 확대) -->
      <div class="portfolio-section-card">
        <img class="chapter-photo" src="img/report/ch2.jpg" alt="" loading="lazy" decoding="async">
        <span class="portfolio-section-badge">第二章 · 후각 투시록</span>
        <div class="portfolio-section-title">🕯️ 인연과 사랑의 체취 감별 (벽사신견 후각 투시록)</div>
        ${keyLineHtml(`피할 연인은 <strong>${(ruinYin && ruinYin.title) || ruin.title}</strong>, 만날 사람은 <strong>${soulmate.title}</strong>${josa(soulmate.title, '을')} 풍기는 <strong>${nobles[0]}</strong> — 시기는 ${Y_R0}년 하반기~${Y_R1}년 상반기.`)}
        <div class="portfolio-text">
          ${ch2Intro}<br><br>
          ${isYoung() ? `그대 앞에 다가올 인연들의 냄새를 미리 맡아 두시오. <strong>처음엔 눈이 멀 것처럼 설레지만 결국 그대 가슴에 생채기를 남기고 떠날 자들...</strong> 그 냄새를 알아 두면 비켜 갈 수 있소.` : lookback}
        </div>

        <div class="portfolio-highlight" style="border-left: 4.5px solid var(--cinnabar); background: rgba(168, 42, 32, 0.06);">
          <strong class="impact-red" style="font-size:15.5px; display:block; margin-bottom:6px;">🩸 1. 피해야 할 파멸의 연인: ${(ruinYin && ruinYin.title) || ruin.title}</strong>
          • <strong>영적 체취</strong>: ${ruinScent}<br>
          • <strong>소름 돋는 특징</strong>: ${ruinTrait}<br>
          • <strong>경고</strong>: ${ruinWarn}
        </div>

        <div class="portfolio-highlight" style="border-left: 4.5px solid var(--jade); background: rgba(47, 107, 69, 0.08); margin-top:12px;">
          <strong class="impact-green" style="font-size:15.5px; display:block; margin-bottom:6px;">🌿 2. 그대를 살려낼 천생연분: ${soulmate.title}</strong>
          • <strong>영적 체취</strong>: ${soulScent}<br>
          • <strong>소름 돋는 특징</strong>: ${soulTrait}<br>
          ${soulKeep}<br>
          • <strong>도래 시기</strong>: ${meetWhere}
        </div>
      </div>

      <!-- CHAPTER 03: 누재살 방어 및 재물 축적 비방 -->
      <div class="portfolio-section-card">
        <img class="chapter-photo" src="img/report/ch3.jpg" alt="" loading="lazy" decoding="async">
        <span class="portfolio-section-badge">第三章 · 재물 결속 비기</span>
        <div class="portfolio-section-title">💰 피 같은 돈이 줄줄 새는 구멍(누재살) 봉인법</div>
        ${keyLineHtml(`그대 돈이 새는 길은 <strong>${GROUP_PLAIN[leakKey]}</strong> 쪽 · 돈이 붙는 기운은 <strong>${EL_NAME[ps.wealthEl]}</strong>, 방위는 ${wealthRemedy.dir} — 아래 3대 비방이 그 구멍을 막소.`)}
        <div class="portfolio-text">
          ${ch3Intro}<br><br>
          ${wealthDiagnosis(ps)}
        </div>
        <div class="portfolio-highlight">
          <strong class="impact-gold" style="font-size:15.5px; display:block; margin-bottom:8px;">🔒 돈 새는 구멍 막는 3대 황금 비방:</strong>
          <span class="guard-basis">— 돈 기운(재성) ${ps.wealthCount}글자 · 가장 짙은 기운 ${GROUP_PLAIN[leakKey]} · 돈이 붙는 기운 ${EL_NAME[ps.wealthEl]} · 모자란 기운 ${EL_NAME[weakKey]}</span>
          ${guard1}<br>
          ${guard2}<br>
          3. <strong>재물 방위 풍수</strong>: 잠잘 때 머리를 돈이 붙는 기운(${EL_NAME[ps.wealthEl]})의 방위인 [<strong class="impact-gold">${wealthRemedy.dir}</strong>] 방향으로 두고, 작업 책상 위에 모자란 기운을 채우는 [<strong class="impact-gold">${remedy.item}</strong>]${josa(remedy.item, '을')} 두어 재물의 살을 튕겨 내시오.${guard3Tail}
        </div>
      </div>

      <!-- CHAPTER 04: 2026~2028년 대운 3개년 로드맵 -->
      <div class="portfolio-section-card">
        <img class="chapter-photo" src="img/report/ch4.jpg" alt="" loading="lazy" decoding="async">
        <span class="portfolio-section-badge">第四章 · 시기 포획</span>
        <div class="portfolio-section-title">🌊 ${Y_R0}~${Y_R2}년 인생 역전 3개년 로드맵</div>   <!-- 업데이트 44 (더블체크 2-4): 원래 '인생 역전 대운 3개년 로드맵' -->
        ${keyLineHtml(`<strong>${Y_R1}년이 가장 좋은 때</strong> — 그해의 기운이 그대에게 <strong>${sipsinPlain(getSipsin(ps.dayStemIdx, ((Y_R1 - 4) % 10 + 10) % 10))}</strong>${josa(sipsinPlain(getSipsin(ps.dayStemIdx, ((Y_R1 - 4) % 10 + 10) % 10)), '으로')} 들어오오${((((Y_R1 - 4) % 12 + 12) % 12) - ps.dayBranchIdx + 12) % 12 === 6 ? ' (단, 일지와 <strong>충</strong>이라 큰 변동을 각오할 것)' : ''}. ${c ? ph(PH.ROAD_PHASE, null, c, 46) : `${Y_R0}년은 준비, ${Y_R1}년은 승부, ${Y_R2}년은 지키기.`}`)}
        <div class="portfolio-text">
          ${roadIntro}
        </div>
        <div class="timeline-box">
          <div class="timeline-step">
            <div class="timeline-dot"></div>
            <div class="timeline-title">${Y_R0}년 (${yearGanji(Y_R0)}년 ${yearGanji(Y_R0,true)}) · 불의 정화와 준비기</div>
            <div class="timeline-desc">${roadText('R0')}</div>
            <div class="timeline-desc timeline-relation">${yearRelationText(Y_R0, ps)}</div>
          </div>
          <div class="timeline-step">
            <div class="timeline-dot"></div>
            <div class="timeline-title">${Y_R1}년 (${yearGanji(Y_R1)}년 ${yearGanji(Y_R1,true)}) · 인생 최고의 폭발적 상승기 🎯</div>
            <div class="timeline-desc">${roadText('R1')}</div>
            <div class="timeline-desc timeline-relation">${yearRelationText(Y_R1, ps)}</div>
          </div>
          <div class="timeline-step">
            <div class="timeline-dot"></div>
            <div class="timeline-title">${Y_R2}년 (${yearGanji(Y_R2)}년 ${yearGanji(Y_R2,true)}) · 결실 수확 및 시스템 안착</div>
            <div class="timeline-desc">${roadText('R2')}</div>
            <div class="timeline-desc timeline-relation">${yearRelationText(Y_R2, ps)}</div>
          </div>
        </div>
      </div>

      <!-- CHAPTER 05: 100일 작전 행동 수칙 -->
      <div class="portfolio-section-card">
        <img class="chapter-photo" src="img/report/ch5.jpg" alt="" loading="lazy" decoding="async">
        <span class="portfolio-section-badge">第五章 · 실전 결행</span>
        <div class="portfolio-section-title">⚡ 내일부터 당장 결행할 [천명 100일 작전]</div>
        ${keyLineHtml(`내일부터 할 일은 딱 셋 — <strong>아침 의식 · 몰입 결계 · 정화 수칙</strong>, 그리고 <strong>${EL_KO[weakKey]}</strong> 기운을 채우는 소품 하나.`)}
        <div class="portfolio-text">
          ${ch5Intro}
        </div>
        <div class="portfolio-highlight">
          ${rule1}<br>
          ${rule2}${hourFocus}<br>
          ${rule3}<br><br>
          ➕ <strong class="impact-gold">그대 사주에만 내리는 맞춤 수칙 · ${EL_NAME[weakKey]} 기운 보충</strong>: ${c ? ph(PH.REMEDY_FRAME, null, c, 49) : `그대 사주에 가장 모자란 기운이오. <strong>${remedy.color}</strong> 계열의 소지품을 몸에 지니고, <strong>${remedy.food}</strong>${josa(remedy.food, '을')} 가까이하며, 중요한 결정은 <strong>${remedy.dir}</strong>을 바라보고 내리시오. 행운의 숫자는 <strong>${remedy.num}</strong>이오.`}${ch5Month}
        </div>
      </div>

      <!-- SECTION 06: 궁서체 정통 괴황지 수호부적 쇼케이스 & 원형 다운로드 -->
      <div class="talisman-section-card">
        <img class="chapter-photo" src="img/report/ch6.jpg" alt="" loading="lazy" decoding="async">
        <span class="portfolio-section-badge">第六章 · 종신 수호 비기</span>
        <div class="portfolio-section-title">🧧 《벽사신견 액막이 개운부 (辟邪神犬 開運符)》</div>
        
        <!-- 부적 해설 및 소장 비방 박스 (다운로드 전 상세 설명) -->
        <div class="talisman-info-box">
          <div class="talisman-info-item">
            <strong>📜 부적의 유래와 원리</strong>
            <p>
              동양 오행에서 삿된 음기(陰氣)와 잡귀를 누르는 <strong>괴황지(槐黃紙, 황금 한지)</strong>에 
              강력한 양기(陽氣)를 뿜어내는 <strong>경면주사(鏡面朱砂)</strong>의 붉은 붓글씨로 새겨진 정통 벽사부(辟邪符)요. 
              대문 앞에서 귀신을 보고 짖는 벽사견의 기운이 깃들어 있소.
            </p>
          </div>

          <div class="talisman-info-item">
            <strong>🛡️ 3대 수호의 뜻</strong>
            <ul>
              <li><strong>1. 흡기귀(吸氣鬼, 기운을 빨아먹는 귀신) 및 악연 차단</strong>: ${talismanEffect1}</li>
              <li><strong>2. 돈 새는 구멍(누재살) 방어</strong>: ${talismanEffect2}</li>
              <li><strong>3. 천명([${dream}]) 개운</strong>: ${talismanEffect3}</li>
            </ul>
          </div>${talismanMine}

          <div class="talisman-info-item">
            <strong>📱 소장 및 사용 비방</strong>
            <p>
              ${talismanUse.join('<br>\n              ')}<br>
              • <strong>그대 사주 맞춤</strong>: 그대 사주에 모자란 <strong>${EL_NAME[weakKey]}</strong> 기운을 채우려면, 출력한 부적을 <strong>${remedy.dir}</strong> 벽에 붙이거나 <strong>${remedy.color}</strong> 계열 지갑에 넣어 지니시오.
            </p>
          </div>
        </div>

        <!-- 부적 실물 미리보기 프레임 -->
        <div class="talisman-preview-frame">
          <canvas class="talisman-canvas" id="talismanCanvas" width="900" height="1500" role="img" aria-label="${iljuName}일주 수호 부적"></canvas>
        </div>

        <button class="btn-talisman-download" onclick="downloadTalismanImage()">
          🧧 궁서체 정통 수호부적 원형 다운로드 (갤러리 저장)
        </button>
      </div>
    `;

    document.getElementById('unlockedReportContainer').innerHTML = unlockedHtml;
    renderTalismanPreview(`${dStem.hanja}${dBranch.hanja}`);
  }

    function openPaymentModal() {
      const m = document.getElementById('paymentModal');
      const slot = document.getElementById('reportPromo'); if (slot && !slot.innerHTML) slot.innerHTML = promoRowHtml();
      if (!m.dataset.promoBound) { m.addEventListener('promo', () => { renderPaymentMode(); renderCouponLines(); }); m.dataset.promoBound = '1'; }
      renderPaymentMode(); renderCouponLines(); m.style.display = 'flex';
      track('payopen');
    }
  function closePaymentModal() { ['paymentModal', 'productModal'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; }); }

    function showToast(text) {
    const t = document.getElementById('toastMsg');
    if (t) {
      t.innerText = text;
      hideEmoji(t);   // 알림의 이모지도 화면에서만 감춘다 (2026-10-27)
      t.style.display = 'block';
      setTimeout(() => { t.style.display = 'none'; }, 2500);
    }
  }

  function copyShareUrl() {
    if (!currentSajuData) return;
    const { y, m, d, hourVal, genderVal, userJob, userMajor, userHobby, userDream } = currentSajuData;
    const url = new URL(window.location.href);
    url.searchParams.set('y', y);
    url.searchParams.set('m', m);
    url.searchParams.set('d', d);
    url.searchParams.set('h', hourVal);
    url.searchParams.set('g', genderVal);
    // 직업·전공·취미·꿈은 개인적인 내용이라 링크에 싣지 않는다 (받는 사람은 생년월일 풀이만 본다)
    ['job', 'major', 'hobby', 'dream'].forEach(k => url.searchParams.delete(k));
    copyText(url.href, '결과 링크를 복사했소.');   // 업데이트 44: 원래 '🔗 사주 명식 공유 링크가 복사되었습니다!' (존댓말·'명식'이 남아 있었다)
  }

  /** 클립보드 복사. 안 되는 환경이면 직접 복사할 수 있게 보여준다 */
  function copyText(text, okMessage) {
    const fallback = () => { window.prompt('아래 내용을 길게 눌러 복사하시오', text); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => showToast(okMessage), fallback);
    } else {
      fallback();
    }
  }

  function copySummaryText() {
    if (!currentSajuData) {
      showToast('사주를 먼저 분석해야 요약문을 복사할 수 있소.');
      return;
    }
    // 쉬운 말 (2026-11-03 대표님 점검): 카톡·메모장에 붙이는 글이라 이모지·명리 용어 없이, '한눈에' 카드의 줄을 그대로 담는다. 원래 문구는 git 기록(커밋 d92ff34)에.
    const { y, m, d, genderVal, dStem, dBranch, hBranch, userDream, userJob } = currentSajuData;
    const timeText = hBranch ? `${hBranch.char}시(${hBranch.hanja}時)` : '시간 모름';
    const rows = [...document.querySelectorAll('#glanceList li')].map(li => {
      const k = li.firstElementChild; const label = k ? k.innerText.trim() : '';
      const value = li.innerText.replace(label, '').replace(/\s+/g, ' ').trim();
      return label ? `- ${label}: ${value}` : `- ${value}`;
    });
    const summaryText = `[벽사신견 사주 요약]\n` +
      `생년월일: ${y}년 ${m}월 ${d}일 (${genderVal === 'M' ? '남성' : '여성'}) · 태어난 시간: ${timeText} · 태어난 날: ${dStem.char}${dBranch.char}\n` +
      `꿈: ${userDream || '-'} · 지금 하는 일: ${userJob || '-'}\n\n` +
      `벽사견이 맡은 냄새, 한눈에\n${rows.join('\n')}\n\n` +
      `풀이 전체 보기: https://byeoksa.com\n` +
      `밤의 대문 앞을 지키는 벽사견 · 벽사신견`;

    copyText(summaryText, '요약문을 복사했소. 카톡이나 메모장에 붙여 넣으시오.');
  }

  function printReport() {
    window.print();
  }

  

  let reportUnlocked = false;

  // ─────────────────────────────────────────────────────────────────────────
  // 🛒 유료 상품 · 공유 할인 · 결제 (모든 상품 공통)
  //   상품을 추가하면 functions/api/payment/complete.js 의 CATALOG 에도 같은 이름·가격을 넣는다
  // ─────────────────────────────────────────────────────────────────────────
  const PRODUCTS = {
    report:  { name: '벽사신견 천명 리포트',     price: SALE.price, label: '천명 리포트' },
    newyear: { name: '벽사신견 신년운세',         price: 4900,       label: '신년운세' },
    compat:  { name: '벽사신견 궁합 상세 리포트', price: 3900,       label: '궁합 상세 리포트' },
    bundle:  { name: '벽사신견 전부 묶음 보따리',  price: 10900,      label: '전부 묶음 보따리' }
  };
  // 전부 묶음: 한 사람(생년월일) 기준으로 아래가 모두 열린다. 따로 사면 합계(BUNDLE_LIST_TOTAL)를 그대로 보여 준다 (실제 가격 합)
  // (소원 부적은 2026-10-19 카드사 심사 반송 — 부적 상품 불가 — 로 판매 목록·묶음에서 뺌)
  const BUNDLE_ITEMS = [
    { id: 'report',  text: '천명 리포트 (6개 장)',             price: SALE.price },
    { id: 'newyear', text: '신년운세 (열두 달 풀이)',            price: 4900 },
    { id: 'compat',  text: '궁합 상세 리포트 (내가 들어간 궁합이면 상대 제한 없음)', price: 3900 }
  ];
  const BUNDLE_LIST_TOTAL = BUNDLE_ITEMS.reduce((n, it) => n + it.price, 0);
  // 공유 할인: 사이트를 공유한 사람·공유 링크로 들어온 사람에게 유료 풀이 1건 1,000원 할인 (이 기기, 7일)
  const SHARE_DISCOUNT = { amount: 1000, days: 7 };
  const COUPON_KEY = 'byeoksa.coupon.v1';
  // 할인 코드: 인스타·카톡 홍보용. 코드를 넣으면 공유 할인과 같은 1,000원 할인 1건 (서버 확인도 같은 금액만 인정)
  //   새 코드는 여기 대문자로 추가한다. 예) 'OPEN2026': '오픈 기념 코드'
  //   BYEOKSA = SNS 홍보용(2026-10-27 오픈). BAEKGU = 옛 설정(백구) 때 코드라 홍보하지 않지만, 이미 받은 사람을 위해 남겨 둔다.
  const PROMO_CODES = { 'BYEOKSA': '벽사신견 할인 코드', 'BAEKGU': '벽사견 할인 코드' };
  function applyPromoCode(raw) {
    const code = String(raw || '').trim().toUpperCase();
    if (!code) return;
    if (!PROMO_CODES[code]) { showToast('그런 코드는 냄새가 안 나오. 다시 확인하시오.'); return; }
    if (activeCoupon()) { showToast('이미 할인이 걸려 있소. 할인은 한 번에 한 건이오.'); return; }
    if (grantCoupon('code:' + code)) { showToast(`🎁 ${PROMO_CODES[code]} 적용! 유료 풀이 1건 ${won(SHARE_DISCOUNT.amount)}원 할인.`); renderPaymentMode(); }
    else showToast('이 기기에서는 할인을 이미 한 번 썼소.');
  }
  /** 결제창 안의 할인 코드 칸 */
  function promoRowHtml() {
    // 코드 칸은 접어 두어 결제창이 길어지지 않게 (코드가 있는 사람만 연다)
    return `<details class="promo-fold"><summary>할인 코드가 있으면 여기를 누르세요</summary><div class="promo-row"><input type="text" class="promo-input" maxlength="20" placeholder="할인 코드" aria-label="할인 코드" autocapitalize="characters"><button type="button" class="promo-apply" onclick="applyPromoCode(this.previousElementSibling.value); this.closest('.modal-overlay').dispatchEvent(new CustomEvent('promo'))">적용</button></div></details>`;
  }
  const won = n => n.toLocaleString('ko-KR');

  function activeCoupon() {
    try {
      const c = JSON.parse(localStorage.getItem(COUPON_KEY) || 'null');
      return (c && !c.used && c.until > Date.now()) ? c : null;
    } catch (e) { return null; }
  }
  function grantCoupon(source) {
    if (activeCoupon()) return false;
    try {
      const old = JSON.parse(localStorage.getItem(COUPON_KEY) || 'null');
      if (old && old.used) return false;   // 한 기기에서 한 번만
      localStorage.setItem(COUPON_KEY, JSON.stringify({ source, until: Date.now() + SHARE_DISCOUNT.days * 86400000, used: false }));
      renderCouponLines();
      return true;
    } catch (e) { return false; }
  }
  function consumeCoupon() {
    const c = activeCoupon(); if (!c) return;
    try { localStorage.setItem(COUPON_KEY, JSON.stringify({ ...c, used: true })); } catch (e) { /* 무시 */ }
    renderCouponLines();
  }
  /** 상품 가격 (할인이 있으면 할인가) */
  function priceFor(productId) {
    const list = PRODUCTS[productId].price, c = activeCoupon();
    const final = c ? Math.max(0, list - SHARE_DISCOUNT.amount) : list;
    return { list, final, coupon: c };
  }
  function couponUntilText(c) { const d = new Date(c.until); return `${d.getMonth() + 1}월 ${d.getDate()}일`; }
  /** 가격 옆 할인 안내 줄: 할인 중이면 할인가, 아니면 공유 권유 */
  function couponLineHtml(productId) {
    const pr = priceFor(productId);
    if (pr.coupon) return `🎁 할인 적용 중 · <s>${won(pr.list)}원</s> <strong>${won(pr.final)}원</strong> (${couponUntilText(pr.coupon)}까지, 1회)`;
    let used = false; try { used = !!(JSON.parse(localStorage.getItem(COUPON_KEY) || 'null') || {}).used; } catch (e) { /* 무시 */ }
    if (used) return '';
    return `💬 친구에게 사이트를 공유하면 유료 풀이 1건 <strong>${won(SHARE_DISCOUNT.amount)}원 할인</strong> <button class="link-btn" onclick="shareSite()">공유하기</button>`;
  }
  function renderCouponLines() {
    document.querySelectorAll('[data-coupon-line]').forEach(el => { el.innerHTML = couponLineHtml(el.dataset.couponLine); el.hidden = !el.innerHTML; });
    if (window.BYEOKSA_SHOP) window.BYEOKSA_SHOP.renderShopShelf();
    renderPlanBox();
  }
  document.addEventListener('DOMContentLoaded', renderCouponLines);

  // ── 결제 기억: 상품마다, 대상(생년월일·소원 등)마다 같은 기기에서 다시 열린다 ──
  const PAID_PREFIX = 'byeoksa.paid.';
  const PENDING_KEY = 'byeoksa.pending.v1';   // 휴대폰 결제 페이지에 다녀오는 동안만 잠깐 보관
  function sajuKey(sd) { return SajuCore.hashSeed(`${sd.y}-${sd.m}-${sd.d}-${sd.hourVal}-${sd.genderVal}`).toString(36); }
  function paidKeyOf(productId, subjectKey) { return `${PAID_PREFIX}${productId}.${subjectKey}`; }
  function markPaidFor(productId, subjectKey, paymentId) { try { localStorage.setItem(paidKeyOf(productId, subjectKey), JSON.stringify({ paymentId, at: Date.now() })); } catch (e) { /* 저장 불가 환경 */ } }
  function rawPaid(productId, subjectKey) { try { return !!localStorage.getItem(paidKeyOf(productId, subjectKey)); } catch (e) { return false; } }
  /** 결제했는지: 그 상품을 직접 샀거나, 같은 사람(생년월일)의 전부 묶음을 샀으면 열린다
   *  대상 키 모양 — 리포트: 사람키 / 신년운세: 사람키.해 / 묶음: 사람키 */
  function isPaidFor(productId, subjectKey) {
    if (rawPaid(productId, subjectKey)) return true;
    if (productId === 'report' || productId === 'newyear') return rawPaid('bundle', String(subjectKey).split('.')[0]);
    return false;
  }
  /** 이 사람(생년월일 프로필 {y,m,d,hour,gender})이 전부 묶음을 샀는지 */
  function personKey(p) { return SajuCore.hashSeed(`${p.y}-${p.m}-${p.d}-${p.hour}-${p.gender}`).toString(36); }
  function hasBundle(p) { return !!p && rawPaid('bundle', personKey(p)); }
  function markPaid(sd, paymentId) { markPaidFor('report', sajuKey(sd), paymentId); }
  function isPaid(sd) { return isPaidFor('report', sajuKey(sd)); }
  function savePending(obj) { try { localStorage.setItem(PENDING_KEY, JSON.stringify({ ...obj, at: Date.now() })); } catch (e) { /* 무시 */ } }
  function loadPending() { try { return JSON.parse(localStorage.getItem(PENDING_KEY) || 'null'); } catch (e) { return null; } }
  function clearPending() { try { localStorage.removeItem(PENDING_KEY); } catch (e) { /* 무시 */ } }

  /** 상품별: 결제 뒤 화면 열기(onPaid), 휴대폰 결제 복귀 때 화면 다시 그리기(resume) */
  const PRODUCT_HOOKS = {};
  function registerProduct(productId, hooks) { PRODUCT_HOOKS[productId] = hooks; }

  /** 지금 풀이가 결제된 사주인지에 따라 결제 안내·리포트를 맞춘다 (다른 생년월일로 바꾸면 다시 잠긴다) */
  function renderPlanBox() {
    const set = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
    set('planBundleList', `${won(BUNDLE_LIST_TOTAL)}원`);
    set('planBundlePrice', won(priceFor('bundle').final));
    const d = new Date(), ty = d.getMonth() + 1 >= 9 ? d.getFullYear() + 1 : d.getFullYear();
    document.querySelectorAll('.plan-ny-year').forEach(el => { el.textContent = ty; });
    document.querySelectorAll('[data-plan-price]').forEach(el => { el.textContent = `${won(priceFor(el.dataset.planPrice).final)}원 ›`; });
  }
  document.addEventListener('DOMContentLoaded', renderPlanBox);

  function applyPaidState() {
    renderPlanBox();
    reportUnlocked = !!currentSajuData && isPaid(currentSajuData);
    document.getElementById('paywallOverlay').style.display = reportUnlocked ? 'none' : '';
    document.getElementById('reportReopen').hidden = !reportUnlocked;
    document.getElementById('unlockedReportContainer').style.display = reportUnlocked ? 'flex' : 'none';
    updateBuyBar();
  }

  // ── 결제 다시 확인 (2026-10-27): 취소(환불)된 결제는 열림 표시를 지우고 다시 잠근다 ──
  //   열림 표시는 결제가 성공한 순간 이 기기에만 저장되고 그 뒤로는 묻지 않았다 → 나중에 결제를 취소해도 리포트가 계속 열렸다.
  //   사이트를 열 때마다 저장된 결제 번호를 결제 확인 서버에 다시 물어, 서버가 "결제 상태가 PAID가 아니다"(취소·환불)
  //   또는 "그런 결제가 없다"고 분명히 답할 때만 지운다. 서버가 꺼져 있거나 통신이 안 되면 손님에게 불이익이 없게 그대로 둔다.
  async function verifyStoredPayments() {
    if (PAYMENT.mode !== 'portone' || !PAYMENT.verifyUrl) return 0;
    let keys = [];
    try { keys = Object.keys(localStorage).filter(k => k.startsWith(PAID_PREFIX)); } catch (e) { return 0; }
    let relocked = 0;
    for (const k of keys) {
      let rec = null;
      try { rec = JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { /* 깨진 기록은 건드리지 않는다 */ }
      const pid = rec && rec.paymentId;
      if (typeof pid !== 'string' || !/^byeoksa-/.test(pid)) continue;   // 서버에 물을 수 없는 기록(테스트 모드의 'test')은 그대로
      try {
        const r = await fetch(PAYMENT.verifyUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentId: pid }) });
        if (r.ok) continue;   // 아직 결제 완료 상태
        let j = null;
        try { j = await r.json(); } catch (e) { /* 본문 없음 */ }
        const cancelled = r.status === 400 && !!j && j.status === 'INVALID' && /^status:/.test(String(j.reason || ''));
        const missing = r.status === 404 && !!j && j.status === 'NOT_FOUND';
        if (!cancelled && !missing) continue;   // 설정 오류·서버 장애·가격 변경 같은 것은 손님 탓이 아니다
        try { localStorage.removeItem(k); } catch (e) { /* 무시 */ }
        relocked++;
      } catch (e) { /* 통신 오류: 그대로 둔다 */ }
    }
    if (!relocked) return 0;
    if (currentSajuData) applyPaidState();
    const report = document.getElementById('viewReport');
    if (report && report.style.display !== 'none' && !reportUnlocked) goToStep(3);   // 리포트를 보고 있었다면 잠긴 무료 풀이로
    if (window.BYEOKSA_SHOP && typeof BYEOKSA_SHOP.renderShopShelf === 'function') BYEOKSA_SHOP.renderShopShelf();
    showToastAfterOpening('취소된 결제가 있어 그 풀이는 다시 잠갔소.');
    return relocked;
  }
  // 첫 진입 연출(설화록 序, z-index 300)이 알림(200)을 덮어 재잠금 알림이 안 보였다 → 序가 끝난 뒤에 보여 준다 (2026-10-27 대표님 테스트)
  let _toastAfterOpening = null;
  function showToastAfterOpening(text) {
    const veil = document.getElementById('openingVeil');
    if (veil && !veil.hidden) { _toastAfterOpening = text; return; }
    showToast(text);
  }
  document.addEventListener('DOMContentLoaded', () => { verifyStoredPayments(); });
  // 새로고침 없이 다른 탭(포트원 콘솔 등)에서 취소하고 돌아온 경우도 잡는다: 탭이 다시 보일 때, 뒤로 가기로 되살아날 때 (2026-10-27)
  let _lastVerify = 0;
  function verifyStoredPaymentsThrottled() { const now = Date.now(); if (now - _lastVerify < 5000) return; _lastVerify = now; verifyStoredPayments(); }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') verifyStoredPaymentsThrottled(); });
  window.addEventListener('pageshow', e => { if (e.persisted) verifyStoredPaymentsThrottled(); });

  let _portOneLoading = null;
  function loadPortOne() {
    if (window.PortOne) return Promise.resolve();
    if (!_portOneLoading) {
      _portOneLoading = new Promise((resolve, reject) => {
        const sc = document.createElement('script');
        sc.src = 'https://cdn.portone.io/v2/browser-sdk.js';
        sc.onload = () => resolve(); sc.onerror = () => { _portOneLoading = null; reject(new Error('sdk')); };
        document.head.appendChild(sc);
      });
    }
    return _portOneLoading;
  }

  /**
   * 결제 한 건. 성공하면 결제 기억 + 할인 사용 처리 후 hooks.onPaid(data) 실행.
   * data: 상품 화면을 다시 그리는 데 필요한 값 (휴대폰 결제 복귀 때 hooks.resume(data)로 다시 그린다)
   */
  /** 카드사 심사 조건: 결제 전 '구매 조건 확인·결제 동의'에 직접 체크해야 결제창이 열린다 */
  function payAgreed(btn) {
    const box = btn && btn.closest('.modal-box') && btn.closest('.modal-box').querySelector('.pay-agree-box');
    if (!box || box.checked || window.__BYEOKSA_TEST__) return true;   // 자동 테스트는 동의 검사만 따로 한다
    const lab = box.closest('.pay-agree');
    if (lab) { lab.classList.remove('is-missing'); void lab.offsetWidth; lab.classList.add('is-missing'); }
    box.focus();
    showToast('구매 조건 확인 및 결제 동의에 체크해 주세요.');
    return false;
  }
  async function purchase(productId, subjectKey, data, btn, method) {
    const hooks = PRODUCT_HOOKS[productId] || {};
    const pr = priceFor(productId);
    const kakao = method === 'kakaopay';   // 카카오페이 버튼 (KCP 간편결제 허브형) — 같은 KCP 채널에 간편결제로 요청한다
    if (kakao && !kakaoPayOn()) { showToast('카카오페이 결제는 아직 열리지 않았소.'); return false; }
    if (!payAgreed(btn)) return false;
    if (PAYMENT.mode !== 'portone') {
      markPaidFor(productId, subjectKey, 'test');
      if (pr.coupon) consumeCoupon();
      closePaymentModal();
      if (hooks.onPaid) hooks.onPaid(data);
      return true;
    }
    if (!PAYMENT.storeId || !PAYMENT.channelKey) { showToast('결제 설정(상점 아이디·채널 키)이 비어 있소.'); return false; }
    if (btn) btn.disabled = true;
    try {
      await loadPortOne();
      const paymentId = `byeoksa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      savePending({ paymentId, productId, subjectKey, data });
      const res = await window.PortOne.requestPayment({
        storeId: PAYMENT.storeId,
        channelKey: (kakao && PAYMENT.kakaoPay.channelKey) || PAYMENT.channelKey,   // 카카오페이 전용 채널 키를 적어 두지 않았으면 KCP 채널 그대로
        paymentId,
        orderName: PRODUCTS[productId].name,
        totalAmount: pr.final,
        currency: 'KRW',
        payMethod: kakao ? 'EASY_PAY' : PAYMENT.payMethod,
        ...(kakao ? { easyPay: { easyPayProvider: 'KAKAOPAY' } } : {}),   // 포트원 V2 KCP: 간편결제 허브형 카카오페이
        customData: JSON.stringify({ product: productId, coupon: !!pr.coupon }),
        redirectUrl: siteHomeUrl() + '?pay=return'   // 휴대폰은 결제 페이지에 다녀온 뒤 이 주소로 돌아온다
      });
      if (!res) return false;   // 결제 페이지로 넘어감 → 돌아오면 resumePaymentFromRedirect에서 마무리
      return await finishPayment(res.paymentId || paymentId, res.code, res.message);
    } catch (e) {
      showToast('결제창을 열지 못했소. 잠시 후 다시 시도하시오.');
      return false;
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  /** 결제 결과 마무리: 실패면 안내, 성공이면 (서버가 있으면 확인 후) 상품을 연다 */
  async function finishPayment(paymentId, code, message) {
    const pending = loadPending();
    if (code) {
      clearPending();
      showToast(`결제가 완료되지 않았소. ${message || ''}`.trim());
      return false;
    }
    if (!pending || pending.paymentId !== paymentId) { showToast('결제 정보를 찾지 못했소. 결제가 됐다면 문의해 주시오.'); return false; }
    if (PAYMENT.verifyUrl) {
      let ok = false;
      try {
        const r = await fetch(PAYMENT.verifyUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentId }) });
        ok = r.ok && (await r.json()).status === 'PAID';
      } catch (e) { ok = false; }
      if (!ok) { showToast(`결제 확인에 실패했소. 결제가 됐다면 ${CONTACT_EMAIL}로 결제 번호 ${paymentId}를 보내 주시오.`); return false; }
    }
    markPaidFor(pending.productId, pending.subjectKey, paymentId);
    if (activeCoupon() && priceFor(pending.productId).final < PRODUCTS[pending.productId].price) consumeCoupon();
    clearPending();
    closePaymentModal();
    const hooks = PRODUCT_HOOKS[pending.productId] || {};
    if (hooks.onPaid) hooks.onPaid(pending.data);
    return true;
  }

  /** 휴대폰 결제 페이지에서 돌아왔을 때: 상품 화면을 다시 그리고 결제를 마무리한다 */
  function resumePaymentFromRedirect(params) {
    const pid = params.get('paymentId');
    if (!pid) return false;
    try { history.replaceState(null, '', window.location.pathname); } catch (e) { /* 주소 정리는 못 해도 진행 */ }   // 결제 번호가 담긴 주소를 지운다
    const pending = loadPending();
    if (!pending || pending.paymentId !== pid) { showToast('결제 정보를 찾지 못했소. 결제가 됐다면 문의해 주시오.'); return true; }
    const intro = document.getElementById('introGateModal'); if (intro) intro.style.display = 'none';
    const hooks = PRODUCT_HOOKS[pending.productId] || {};
    if (hooks.resume) hooks.resume(pending.data);
    finishPayment(pid, params.get('code'), params.get('message'));
    return true;
  }

  /** 천명 리포트 결제창 버튼 (method 'kakaopay' = 카카오페이 버튼) */
  function startPayment(method) {
    if (!currentSajuData) return;
    const pick = ({ y, m, d, hourVal, genderVal, userJob, userMajor, userHobby, userDream, lunar, late }) => ({ y, m, d, hourVal, genderVal, userJob, userMajor, userHobby, userDream, lunar, late });
    const btn = document.getElementById(method === 'kakaopay' ? 'payKakaoButton' : 'payButton');
    return purchase('report', sajuKey(currentSajuData), pick(currentSajuData), btn, method);
  }
  registerProduct('report', {
    onPaid: () => unlockContent(),
    resume: sj => {
      const set = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined && v !== null) el.value = v; };
      fillBirthInput(sj, sj.lunar, sj.late, sj.hourVal); set('gender', sj.genderVal);   // 음력·밤 자시로 넣었으면 그대로 (업데이트 44)
      set('userJob', sj.userJob); set('userMajor', sj.userMajor); set('userHobby', sj.userHobby); set('userDream', sj.userDream);
      submitAndGoToResult();
    }
  });

  /** 결제(현재는 테스트) 완료 → 리포트 전용 화면으로 */
  function unlockContent() {
    if (PAYMENT.mode !== 'portone' && currentSajuData && !isPaid(currentSajuData)) markPaid(currentSajuData, 'test');
    reportUnlocked = true;
    document.getElementById('paywallOverlay').style.display = 'none';
    document.getElementById('reportReopen').hidden = false;
    const unlocked = document.getElementById('unlockedReportContainer');
    unlocked.style.display = 'flex';
    closePaymentModal();
    openReport();
    // 카드사 관점(액막이를 파는 것처럼 읽히지 않게)·외래어 없이 (업데이트 39, 대표님 OK). 원래 알림: '🕯️ 액막이 복채 정성 접수 완료! 6단계 퇴마 포트폴리오 전체 해제'
    showToast('복채 잘 받았소. 천명 리포트 6개 장의 봉인이 모두 풀렸소.');
  }

  function openReport() {
    renderReportSummary();
    showView('viewReport');
    setupReportBook();
    tidyTitles(document.getElementById('viewReport'));
    if (window.BYEOKSA_SHOP && BYEOKSA_SHOP.renderReviewAsk) BYEOKSA_SHOP.renderReviewAsk();   // 리포트 끝 '후기 남기기' (shop.js, 폼 주소가 있을 때만)
    verifyStoredPaymentsThrottled();   // 리포트를 열 때마다 취소된 결제인지 한 번 더 확인 (취소면 잠긴 무료 풀이로 돌아간다)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 📖 리포트 책 넘김: 요약 → 기밀 표지 → 1~5장 → 개운부, 한 번에 한 장씩.
  //   넘길 때마다 그 장의 첫머리가 화면 맨 위에 딱 맞춰진다. 인쇄(PDF)는 모든 장이 다 나온다.
  // ─────────────────────────────────────────────────────────────────────────
  const BOOK = { pages: [], idx: 0, busy: false };
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function bookPagesNow() {
    const box = document.getElementById('unlockedReportContainer');
    const kids = [...box.children];
    const isChapter = el => el.matches('.portfolio-section-card, .talisman-section-card');
    const pages = [{ name: '먼저 맡은 냄새', els: [document.getElementById('reportSummary')] }];
    const cover = kids.filter(el => !isChapter(el));
    if (cover.length) pages.push({ name: '기밀 문서 표지', els: cover });
    kids.filter(isChapter).forEach(el => {
      const t = el.querySelector('.portfolio-section-title');
      const name = t ? t.textContent.replace(/^[^가-힣0-9《\[(]+/, '').replace(/\s+/g, ' ').trim() : '';
      pages.push({ name: name.length > 22 ? name.slice(0, 21) + '…' : name, els: [el] });
    });
    return pages;
  }

  function setupReportBook() {
    BOOK.pages = bookPagesNow();
    BOOK.idx = 0;
    const dots = document.getElementById('bookDots');
    dots.innerHTML = BOOK.pages.map((pg, i) => `<button class="book-dot" role="tab" aria-label="${i + 1}장 ${pg.name}" onclick="bookGo(${i})"></button>`).join('');
    document.getElementById('bookBar').hidden = false;
    document.getElementById('bookNav').hidden = false;
    document.getElementById('viewReport').classList.add('is-book');
    showBookPage(0);
    fitBookNav();
    bindBookSwipe();
    snapBookTop();
  }

  function showBookPage(i) {
    BOOK.idx = i;
    BOOK.pages.forEach((pg, n) => pg.els.forEach(el => el.classList.toggle('book-off', n !== i)));
    const last = BOOK.pages.length - 1;
    document.getElementById('bookCount').textContent = `${i + 1} / ${BOOK.pages.length}`;
    document.getElementById('bookName').textContent = BOOK.pages[i].name;
    document.querySelectorAll('#bookDots .book-dot').forEach((d, n) => { d.classList.toggle('is-on', n === i); d.classList.toggle('is-read', n < i); d.setAttribute('aria-selected', n === i); });
    const prev = document.getElementById('bookPrev'), next = document.getElementById('bookNext');
    prev.disabled = i === 0;
    next.textContent = i === last ? '↺ 첫 장으로' : '다음 장 ›';
    document.getElementById('bookHint').textContent = i === last ? '마지막 장이오' : '옆으로 밀어도 넘어가오';
    // 지표 막대: 표지가 펼쳐질 때 0에서 제 값까지 자란다 (한 번만)
    BOOK.pages[i].els.forEach(el => el.querySelectorAll('.kpi-bar-fill[data-w]:not(.is-grown)').forEach(bar => {
      bar.classList.add('is-grown');
      if (reduceMotion()) return;
      bar.style.width = '0%';
      requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = bar.dataset.w + '%'; }));
    }));
    // 개운부 캔버스는 숨어 있을 때 그려졌을 수 있으니 보일 때 한 번 더 그린다
    if (BOOK.pages[i].els.some(el => el.classList.contains('talisman-section-card')) && currentSajuData) {
      try { renderTalismanPreview(`${currentSajuData.dStem.hanja}${currentSajuData.dBranch.hanja}`); } catch (e) { /* 미리보기 실패는 무시 */ }
    }
  }

  /** 책 맨 위(쪽 표시줄)가 화면 맨 위에 오도록 */
  /** 아래 메뉴(탭바)가 떠 있으면 넘김 버튼을 그 바로 위에 붙인다 */
  function fitBookNav() {
    const tb = document.getElementById('tabBar');
    const h = tb && getComputedStyle(tb).display !== 'none' ? tb.getBoundingClientRect().height : 0;
    document.getElementById('viewReport').style.setProperty('--book-nav-bottom', `${Math.round(h)}px`);
  }
  window.addEventListener('resize', () => { if (BOOK.pages.length) fitBookNav(); });

  function snapBookTop() {
    // 쪽 표시줄은 화면 위에 붙어 있으므로(sticky) 책 본문 위치에서 표시줄 높이만큼 뺀다
    const bar = document.getElementById('bookBar'), book = document.getElementById('reportBook');
    const go = () => {
      const y = book.getBoundingClientRect().top + window.scrollY - bar.offsetHeight - 14;
      try { window.scrollTo({ top: Math.max(0, y), behavior: 'auto' }); } catch (e) { window.scrollTo(0, Math.max(0, y)); }
    };
    go();
    // 아이폰: 글꼴·주소창 높이가 늦게 바뀌면 위치가 밀리므로 한 번 더 맞춘다
    requestAnimationFrame(() => requestAnimationFrame(go));
  }

  function bookGo(i) {
    if (BOOK.busy || !BOOK.pages.length) return;
    const n = Math.max(0, Math.min(BOOK.pages.length - 1, i));
    if (n === BOOK.idx) { snapBookTop(); return; }
    const dir = n > BOOK.idx ? 1 : -1;
    const book = document.getElementById('reportBook');
    if (reduceMotion() || window.__BYEOKSA_TEST__) { showBookPage(n); snapBookTop(); return; }
    BOOK.busy = true;
    book.classList.add(dir > 0 ? 'turn-out-next' : 'turn-out-prev');
    setTimeout(() => {
      book.classList.remove('turn-out-next', 'turn-out-prev');
      showBookPage(n);
      snapBookTop();
      book.classList.add(dir > 0 ? 'turn-in-next' : 'turn-in-prev');
      setTimeout(() => { book.classList.remove('turn-in-next', 'turn-in-prev'); BOOK.busy = false; }, 380);
    }, 260);
  }

  function bookTurn(d) {
    const last = BOOK.pages.length - 1;
    if (d > 0 && BOOK.idx === last) { bookGo(0); return; }
    bookGo(BOOK.idx + d);
  }

  let _bookSwipeBound = false;
  function bindBookSwipe() {
    if (_bookSwipeBound) return; _bookSwipeBound = true;
    const book = document.getElementById('reportBook');
    let sx = 0, sy = 0, st = 0;
    book.addEventListener('touchstart', e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); }, { passive: true });
    book.addEventListener('touchend', e => {
      const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - st < 700) bookTurn(dx < 0 ? 1 : -1);
    }, { passive: true });
    document.addEventListener('keydown', e => {
      const v = document.getElementById('viewReport');
      if (!v || v.style.display === 'none' || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName)) return;
      if (e.key === 'ArrowRight') bookTurn(1);
      else if (e.key === 'ArrowLeft') bookTurn(-1);
    });
  }

  // PDF·인쇄에는 모든 장이 나오게: 인쇄 직전에 펼쳤다가 끝나면 보던 장으로
  window.addEventListener('beforeprint', () => {
    document.querySelectorAll('.book-off').forEach(el => el.classList.remove('book-off'));
    document.querySelectorAll('details.saju-fold:not([open])').forEach(d => { d.open = true; d.dataset.printOpened = '1'; });   // 접어 둔 사주 표도 인쇄에는 (업데이트 39)
  });
  window.addEventListener('afterprint', () => {
    if (BOOK.pages.length) showBookPage(BOOK.idx);
    document.querySelectorAll('details.saju-fold[data-print-opened]').forEach(d => { d.open = false; delete d.dataset.printOpened; });
  });

  /** 리포트 결제창의 '전부 묶음' 버튼 */
  function openBundleForReport() {
    if (!currentSajuData || !window.BYEOKSA_SHOP) return;
    const sd = currentSajuData;
    const pick = ({ y, m, d, hourVal, genderVal, userJob, userMajor, userHobby, userDream, lunar, late }) => ({ y, m, d, hourVal, genderVal, userJob, userMajor, userHobby, userDream, lunar, late });
    closePaymentModal();
    window.BYEOKSA_SHOP.openBundle({ y: sd.y, m: sd.m, d: sd.d, hour: sd.hourVal, gender: sd.genderVal, ...(sd.lunar ? { lunar: sd.lunar } : {}), ...(sd.late ? { late: true } : {}) }, 'report', pick(sd));
  }

  /** 리포트 첫머리: 무료 풀이에서 본 내용을 한눈에 정리 */
  function renderReportSummary() {
    const box = document.getElementById('reportSummary');
    if (!box || !currentSajuData) return;
    const sd = currentSajuData;
    const txt = id => { const el = document.getElementById(id); return el ? el.innerText.trim() : ''; };
    const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    // 첫 문장만: 앞머리 따옴표(와 혹시 남은 짧은 추임새)는 걷어낸다
    const firstSentence = t => {
      const clean = String(t).replace(/\s+/g, ' ').replace(/^["“]/, '').replace(/^([가-힣]{1,4}\.{2,}\s*)+/, '').trim();
      const m = clean.match(/^.*?[^.][.!?](?=\s|$|["”])/);
      return (m ? m[0] : clean).replace(/["”]$/, '').trim();
    };
    const cell = (stem, branch, label) => (stem && branch) ? `
      <div class="rs-pillar">
        <span class="rs-pillar-label">${label}</span>
        <span class="rs-char ${stem.el}">${stem.hanja}</span>
        <span class="rs-char ${branch.el}">${branch.hanja}</span>
        <span class="rs-pillar-ko">${stem.char + branch.char}</span>
      </div>` : `
      <div class="rs-pillar rs-pillar-unknown">
        <span class="rs-pillar-label">${label}</span>
        <span class="rs-char">時</span>
        <span class="rs-pillar-ko">모름</span>
      </div>`;
    const counts = (sd.ohengResult && sd.ohengResult.counts) || {};
    const ps = getPersona(sd.dStemIdx, sd.dBranchIdx, sd.ohengResult);
    const dn = lastDaeun && lastDaeun.item;
    const fd = lastDaeun && lastDaeun.before ? lastDaeun.first : null;   // 첫 10년 운 전인 어린이 (업데이트 44)
    const daeunLine = fd
      ? `첫 10년 운 ${fd.stemObj.char}${fd.branchObj.char} · ${fd.ageStart}세에 열림 (지금 만 ${lastDaeun.age}세)`
      : dn
      ? `${dn.ageStart}세부터의 10년 운 ${dn.stemObj.char}${dn.branchObj.char} · ${sipsinPlain(dn.sipsin)} · ${UNSUNG_PLAIN[dn.unsung] || dn.unsung}(${dn.unsung}) (지금 만 ${lastDaeun.age}세)`
      : txt('daeunBadge');
    box.innerHTML = `
      <div class="feature-card rs-card">
        <h3 class="feature-card-title">먼저 맡은 냄새 · 무료 풀이 요약</h3>
        <p class="rs-meta">${sd.y}년 ${sd.m}월 ${sd.d}일 ${sd.hBranch ? sd.hBranch.char + '시' : '(시간 모름)'} · ${sd.genderVal === 'M' ? '남성' : '여성'} · 태어난 날 <strong>${sd.dStem.char}${sd.dBranch.char}</strong></p>
        <div class="rs-pillars">
          ${cell(sd.hStem, sd.hBranch, '시')}${cell(sd.dStem, sd.dBranch, '일')}${cell(sd.mStem, sd.mBranch, '월')}${cell(sd.yStem, sd.yBranch, '년')}
        </div>
        <ul class="rs-oheng" aria-label="오행 분포">
          ${EL_KEYS.map(k => `<li class="rs-el ${k}${k === ps.weakKey ? ' is-weak' : ''}"><span>${EL_KO[k]}</span><strong>${counts[k] || 0}</strong></li>`).join('')}
        </ul>
        <dl class="rs-list">
          <dt>타고난 본성</dt><dd>${esc(txt('animalTitle'))}</dd>
          <dt>꿈과 팔자</dt><dd>${esc(txt('fitScore'))} · ${esc(sd.userDream)}</dd>
          <dt>모자란 기운</dt><dd>${EL_KO[ps.weakKey]} — 이 리포트의 맞춤 비방은 이 기운을 채우는 쪽으로 짜였소</dd>
          <dt>지금 10년 운</dt><dd>${esc(daeunLine || '10년 운 정보 없음')}</dd>
          <dt>심리 투시</dt><dd>${esc(txt('mindBadge'))} · ${esc(firstSentence(txt('mindItem2').replace(/^⚠️[^\n]*\n?/, '')))}</dd>
          <dt>연애의 냄새</dt><dd>${esc(firstSentence(txt('sniffLoveText').replace(/^"/, '')))}</dd>
          <dt>재물의 냄새</dt><dd>${esc(firstSentence(txt('sniffWealthText').replace(/^"/, '')))}</dd>
          <dt>일의 냄새</dt><dd>${esc(firstSentence(txt('sniffCareerText').replace(/^"/, '')))}</dd>
        </dl>
      </div>`;
  }

  function saveTalismanNotice() {
    showToast('📸 스마트폰 화면 캡처로 저장하여 배경화면으로 지니시오');
  }

  
  // 🧧 HTML5 Canvas 기반 고해상도 수호 부적 이미지 생성 및 자동 다운로드
    // 🧧 궁서체 정통 괴황지(槐黃紙) 경면주사(鏡面朱砂) 수호부적 생성 및 다운로드
  // ─────────────────────────────────────────────────────────────────────────
  // 🧧 액막이 개운부: 바탕 그림(tools/make_talisman.py로 생성) 위에 사용자 일주를 붉은 먹으로 덧쓴다
  // ─────────────────────────────────────────────────────────────────────────
  const TALISMAN = { src: 'img/talisman.webp', w: 900, h: 1500, slot: { x: 788, y: 1020, size: 50, step: 58 } };
  const TALISMAN_FONT = '"Song Myung", "Noto Serif KR", "Noto Serif CJK TC", serif';
  let _talismanImg = null;

  function loadTalismanBase() {
    if (_talismanImg) return _talismanImg;
    _talismanImg = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = TALISMAN.src;
    });
    return _talismanImg;
  }

  /** 900×1500 캔버스에 부적을 그린다. iljuHanja 예: '乙巳' */
  async function drawTalisman(ctx, iljuHanja) {
    const img = await loadTalismanBase();
    try { await document.fonts.load(`${TALISMAN.slot.size}px ${TALISMAN_FONT}`); } catch (e) { /* 글꼴을 못 받아도 대체 글꼴로 그린다 */ }
    ctx.clearRect(0, 0, TALISMAN.w, TALISMAN.h);
    ctx.drawImage(img, 0, 0, TALISMAN.w, TALISMAN.h);
    const chars = (iljuHanja + '日柱守護').split('');
    const { x, y, size, step } = TALISMAN.slot;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(176, 34, 22, 0.92)';
    ctx.font = `${size}px ${TALISMAN_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    chars.forEach((ch, i) => {
      const seed = (ch.charCodeAt(0) * 9301 + i * 49297) % 233280 / 233280; // 글자마다 일정한 작은 흔들림
      ctx.save();
      ctx.translate(x + (seed - 0.5) * 6, y + i * step);
      ctx.rotate((seed - 0.5) * 0.07);
      // 붓 획 굵기와 먹 번짐을 바탕 글씨에 맞춘다
      ctx.shadowColor = 'rgba(150, 24, 14, 0.55)';
      ctx.shadowBlur = 3;
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = 'rgba(176, 34, 22, 0.92)';
      ctx.strokeText(ch, 0, 0);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });
    ctx.restore();
  }

  function renderTalismanPreview(iljuHanja) {
    const canvas = document.getElementById('talismanCanvas');
    if (!canvas) return;
    drawTalisman(canvas.getContext('2d'), iljuHanja).catch(() => { canvas.style.display = 'none'; });
  }

  async function downloadTalismanImage() {
    if (!currentSajuData) {
      showToast('사주를 먼저 분석해야 맞춤 부적을 내릴 수 있소.');
      return;
    }
    const { dStem, dBranch } = currentSajuData;
    const iljuName = `${dStem.char}${dBranch.char}`;
    const iljuHanja = `${dStem.hanja}${dBranch.hanja}`;

    // 휴대폰 배경화면 크기(1080×1920): 밤 바탕 위에 부적
    const talisman = document.createElement('canvas');
    talisman.width = TALISMAN.w; talisman.height = TALISMAN.h;
    const wall = document.createElement('canvas');
    wall.width = 1080; wall.height = 1920;
    const ctx = wall.getContext('2d');
    try {
      await drawTalisman(talisman.getContext('2d'), iljuHanja);
      const bg = ctx.createRadialGradient(540, 760, 80, 540, 900, 1200);
      bg.addColorStop(0, '#2B2E49');
      bg.addColorStop(1, '#14151F');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 1080, 1920);
      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
      ctx.shadowBlur = 50;
      ctx.shadowOffsetY = 24;
      ctx.drawImage(talisman, 135, 230, 810, 1350);
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = 'rgba(244, 238, 226, 0.85)';
      ctx.textAlign = 'center';
      ctx.font = `34px ${TALISMAN_FONT}`;
      ctx.fillText(`辟邪神犬 開運符 · ${iljuHanja}日柱 守護`, 540, 1690);
    } catch (e) {
      showToast('부적 그림을 불러오지 못했소. 잠시 뒤 다시 눌러 보시오.');
      return;
    }

    const fileName = `벽사신견_궁서체_개운부_${iljuName}.png`;
    let blob = null;
    try {
      blob = await new Promise(res => wall.toBlob(res, 'image/png'));
    } catch (e) { blob = null; }
    if (!blob) { showToast('이 브라우저에서는 저장이 막혔소. 부적 그림을 길게 눌러 저장하시오.'); return; }

    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: '벽사신견 개운부' }); return; } catch (e) { /* 공유 취소 시 내려받기로 */ }
    }
    const link = document.createElement('a');
    link.download = fileName;
    link.href = URL.createObjectURL(blob);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    showToast('🎉 궁서체 정통 괴황지 수호부적이 갤러리에 저장되었습니다!');
  }


  function _oldAcceptDestiny() {
    const modal = document.getElementById('introGateModal');
    modal.style.opacity = '0';
    modal.style.visibility = 'hidden';
    setTimeout(() => { modal.style.display = 'none'; }, 350);
    showToast('🕯️ 운명의 문턱을 넘었소. 생년월일을 대시오.');
    
    // 생년월일 입력란으로 스크롤 및 포커스
    const yearInput = document.getElementById('year');
    if (yearInput) {
      yearInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => { yearInput.focus(); }, 400);
    }
  }

  function refuseDestiny() {   // 예전 '아니오' 버튼 — 지금은 '들어가겠습니다' 하나뿐이라 쓰지 않음 (호환용)
    acceptDestiny();
  }

  window.addEventListener('DOMContentLoaded', () => {
    applyFolds(document.getElementById('viewLanding'));   // 대문 설화 단락 '더 보기' 접기 (2026-11-01)
    syncLeapBox(document.getElementById('calendarType'));   // 뒤로 가기 등으로 '음력'이 되살아난 경우 윤달 칸도 맞춘다 (업데이트 44)
    const params = new URLSearchParams(window.location.search);
    trackVisitOnce();
    if (resumePaymentFromRedirect(params)) return;
    const toHelp = window.location.hash === '#help';   // 약관 페이지 등에서 고객센터로 바로 들어옴
    const compatInvite = params.get('compat') === '1' && !params.get('y');   // 친구가 보낸 궁합 링크 (업데이트 38)
    if (!params.get('y') && !toHelp && !compatInvite) playOpening();
    if (compatInvite) {   // 序·대문 없이 바로 궁합 입력으로. 링크에는 생일이 없고, 보낸 사람 별명만 선택으로 온다
      const nick = (params.get('n') || '').trim();
      window.__compatInviteFrom = NICK_RE.test(nick) ? nick : '';
      try { history.replaceState(null, '', window.location.pathname); } catch (e) { /* 무시 */ }
      track('invited');
      hideGate();
      if (typeof openFeature === 'function') openFeature('compat');
    }
    if (params.get('from') === 'share') {   // 친구가 공유한 링크로 들어옴 → 할인 1건
      try { history.replaceState(null, '', window.location.pathname); } catch (e) { /* 무시 */ }
      if (grantCoupon('invite')) setTimeout(() => showToast(`🎁 친구가 보낸 문으로 들어왔구려. 유료 풀이 1건 ${won(SHARE_DISCOUNT.amount)}원 할인을 걸어 두었소.`), 600);
    }
    if (params.get('y') && params.get('m') && params.get('d')) {
      hideGate();   // 결과 링크로 들어온 손님: 대문 안내창이 결과를 덮지 않게 (2026-11-01, 전엔 덮였다)
      document.getElementById('year').value = params.get('y');
      document.getElementById('month').value = params.get('m');
      document.getElementById('day').value = params.get('d');
      if (params.get('h')) document.getElementById('hourSelect').value = params.get('h');
      if (params.get('g')) document.getElementById('gender').value = params.get('g');
      if (params.get('job')) document.getElementById('userJob').value = params.get('job');
      if (params.get('major')) document.getElementById('userMajor').value = params.get('major');
      if (params.get('hobby')) document.getElementById('userHobby').value = params.get('hobby');
      if (params.get('dream')) document.getElementById('userDream').value = params.get('dream');
      setCalendarInput(null);   // 결과 링크의 날짜는 늘 양력 (업데이트 44)
      submitAndGoToResult();
    }
    if (toHelp && typeof openFeature === 'function') {
      const intro = document.getElementById('introGateModal'); if (intro) intro.style.display = 'none';
      openFeature('help');
    }
  });


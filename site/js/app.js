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
    eventName: '오픈 기념 이벤트',  // 이벤트가 없으면 '' (배지 숨김)
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
    mode: 'test',
    storeId: '',        // 예: 'store-00000000-0000-0000-0000-000000000000'
    channelKey: '',     // 예: 'channel-key-00000000-0000-0000-0000-000000000000'
    payMethod: 'CARD',
    orderName: '벽사신견 천명 리포트',
    verifyUrl: ''
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

  /** 결제창 버튼·안내를 결제 모드에 맞춘다 */
  function renderPaymentMode() {
    const live = PAYMENT.mode === 'portone';
    const btn = document.getElementById('payButton');
    if (btn) btn.textContent = live ? `💳 ${won(priceFor('report').final)}원 결제하고 봉인 풀기` : '테스트로 봉인 해제해보기 🐾';
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

  // 즉시 손절해야 할 3대 악연 — 일간 오행별 (수(水) 유형 = 원래 문장)
  const ENEMY_TYPES = {
    wood: [
      `<strong>"같이 하자"</strong>며 판을 벌여 놓고, 정작 결실이 나면 네 이름을 슬쩍 지우고 제 공으로 가로채는 자.`,
      `네 아이디어를 듣자마자 "그거 나도 생각했던 건데"라며 먼저 떠벌리고 다니는 자.`,
      `네가 뻗어나가려 할 때마다 "아직 때가 아니다"라며 발목을 잡아 제자리에 묶어두려는 자.`
    ],
    fire: [
      `힘들 때만 <strong>"너밖에 없다"</strong>며 매달리다가, 제 살길을 찾으면 연락을 뚝 끊어버리는 자.`,
      `네 열정과 호의를 당연한 듯 받아먹고, 고맙다는 말 한마디 없이 더 큰 것을 요구하는 자.`,
      `네가 지쳐 쓰러지면 "원래 네가 오지랖 부린 거잖아"라며 뒤에서 험담을 퍼뜨리는 자.`
    ],
    earth: [
      `네가 묵묵히 받아주는 걸 알고 온갖 하소연과 짜증을 쏟아붓는, 너를 <strong>'감정 쓰레기통'</strong> 취급하는 자.`,
      `일이 잘되면 제 덕, 일이 틀어지면 슬그머니 네게 책임과 누명을 떠넘기는 자.`,
      `빌려 간 돈과 시간은 기억하지 못하면서, 네가 거절한 단 한 번은 끝까지 물고 늘어지는 자.`
    ],
    metal: [
      `네가 마음을 열고 털어놓은 치부를 쥐고 있다가 <strong>결정적인 순간에 칼날처럼 휘두르는</strong> 자.`,
      `겉으로는 네 완벽함을 치켜세우면서, 뒤에서는 작은 실수 하나를 부풀려 퍼뜨리는 자.`,
      `"너 그거 감당할 수 있겠어?"라며 네 결단의 순간마다 의심의 독을 한 방울씩 떨어뜨리는 자.`
    ],
    water: [
      `<strong>"다 너 잘되라고 하는 말인데"</strong>라며 네 자신감을 깎아내리고 가스라이팅하는 자.`,
      `밥 한 끼, 커피 한 잔도 은근슬쩍 네게 계산을 미루며 네 재물운의 기운을 갉아먹는 자.`,
      `네 약점이나 실수를 기억해 두었다가 남들 앞에서 장난처럼 터뜨려 네 위신을 깎는 자.`
    ]
  };

  // 피해야 할 파멸의 연인 — 일간을 극(剋)하는 기운의 체취 (목(木) 일간 = 원래 문장: 금(金)의 쇠비린내)
  const RUIN_LOVERS = {
    wood: {
      title: '피비린내와 눅눅한 곰팡이 냄새',
      scent: '겉으로는 비싼 향수나 매력적인 언변으로 포장하지만, 조금만 깊이 교류해보면 바닥에 고인 썩은 물과 쇠비린내가 진동하는 자다.',
      trait: `네 자존감을 은근히 갉아먹으며 '너는 나 없으면 아무것도 아니야'라는 불안을 주입한다. 네가 잘나갈 땐 질투로 눈빛이 싸늘해지고, 네가 주저앉을 때만 우월감을 느끼며 동정하는 척한다.`
    },
    fire: {
      title: '차갑게 고인 물비린내와 꺼진 촛농 냄새',
      scent: '처음엔 서늘하고 신비로운 분위기로 끌어당기지만, 가까이 갈수록 축축한 냉기가 스며들어 네 안의 불씨를 하나씩 꺼뜨리는 자다.',
      trait: `네 들뜬 열정에 '현실을 봐'라며 찬물을 끼얹고, 네가 웃을수록 무심한 침묵으로 벌을 준다. 결국 너는 그 사람의 기분을 살피느라 네 빛을 스스로 끄게 된다.`
    },
    earth: {
      title: '풋내 뒤에 숨은 썩은 나무뿌리 냄새',
      scent: '싱그럽고 활기찬 첫인상으로 다가오지만, 뿌리를 내리는 순간 네 땅의 양분을 빨아올리며 제 키만 키우는 자다.',
      trait: `네 시간과 돈, 인맥을 제 성장의 거름으로 쓰면서 '우리 둘을 위한 것'이라 포장한다. 네가 지쳐 메말라 갈 때쯤 더 기름진 땅을 찾아 떠난다.`
    },
    metal: {
      title: '달콤한 향 뒤에 숨은 매캐한 탄내',
      scent: '뜨겁고 강렬한 매력으로 단숨에 마음을 녹이지만, 곁에 오래 있을수록 옷깃에 그을음이 배듯 네 원칙과 자존심이 녹아내리는 자다.',
      trait: `불같이 사랑하다가도 제 뜻대로 안 되면 화염처럼 분노를 쏟아내 너를 길들인다. 네가 지켜온 기준과 선을 '사랑이면 이 정도는'이라며 하나씩 태워 없앤다.`
    },
    water: {
      title: '흙탕물처럼 텁텁한 진흙 비린내',
      scent: '듬직하고 안정적인 척 다가오지만, 함께할수록 맑던 네 생각이 흙탕물처럼 탁해지고 발이 진창에 빠진 듯 무거워지는 자다.',
      trait: `'다 너를 지켜주려고'라며 네 선택과 동선을 하나하나 막아세운다. 네 흐름을 둑처럼 가로막아, 결국 너는 어디로도 흘러가지 못한 채 고여 썩어간다.`
    }
  };

  // 너를 살려낼 천생연분 — 네게 가장 모자란 오행을 채워주는 체취 (목(木) 보충 = 원래 문장)
  const SOULMATE_SCENTS = {
    wood: {
      short: '맑은 솔잎 흙내',
      title: '비 온 뒤 솔숲의 맑은 흙 냄새',
      scent: '화려한 말재주는 없어도, 그 사람 곁에 가만히 앉아 있기만 해도 목덜미의 서늘한 긴장감이 봄눈 녹듯 스르륵 풀리는 사람이다. 깊은 산속 젖은 흙내와 청량한 솔잎 향을 풍긴다.'
    },
    fire: {
      short: '따스한 장작불 내음',
      title: '겨울밤 아궁이의 따스한 장작불 냄새',
      scent: '말수는 적어도 그 사람이 곁에 있으면 꽁꽁 언 손끝부터 서서히 데워지는 사람이다. 마른 장작이 타닥거리며 타는 포근한 불 냄새와 갓 지은 밥 냄새를 풍긴다.'
    },
    earth: {
      short: '구수한 볏짚 내음',
      title: '햇볕에 잘 말린 볏짚과 구수한 누룩 냄새',
      scent: '요란하게 다가오지 않지만, 흔들리는 너를 넓은 들판처럼 받아주는 사람이다. 가을 햇살에 말린 볏짚과 장독대의 구수한 냄새를 풍긴다.'
    },
    metal: {
      short: '서늘한 놋그릇 향',
      title: '새벽 서리 머금은 놋그릇의 서늘한 쇠 향',
      scent: '흐트러진 네 하루에 선을 그어주고, 망설일 때 단호하게 길을 짚어주는 사람이다. 새벽 서리와 깨끗이 닦인 놋그릇의 맑고 서늘한 향을 풍긴다.'
    },
    water: {
      short: '맑은 물안개 향',
      title: '새벽 계곡물에 씻긴 이끼와 물안개 냄새',
      scent: '조용히 네 말을 끝까지 들어주며, 달아오른 머리를 차분히 식혀주는 사람이다. 깊은 계곡의 맑은 물소리와 촉촉한 물안개 향을 풍긴다.'
    }
  };

  // 밤마다 숨통을 조이는 함정 — 가장 모자란 오행이 만드는 마음의 구멍
  const NIGHT_TRAP_BY_WEAK = {
    wood: '네 원국에는 위로 뻗어 오르는 목(木)의 기운이 모자라다. 그래서 결심은 수십 번 해도 첫 삽을 뜨는 순간마다 망설이며 내일로, 또 내일로 미뤄왔지. 그 미룬 날들이 밤마다 빚쟁이처럼 찾아와 네 숨통을 조인 것이다.',
    fire: '네 원국에는 활활 타오르는 화(火)의 기운이 모자라다. 그래서 남들 앞에선 웃어도 혼자가 되면 불씨가 꺼진 아궁이처럼 의욕이 싸늘하게 식어버리지. 그 냉기가 밤마다 이불 속까지 스며든 것이다.',
    earth: '네 원국에는 중심을 잡아주는 토(土)의 기운이 모자라다. 그래서 작은 말 한마디에도 발밑이 꺼지는 것처럼 흔들리고, 기댈 곳을 찾아 밤새 마음이 떠돌았지. 그 허공이 네 잠을 갉아먹은 것이다.',
    metal: '네 원국에는 맺고 끊는 금(金)의 기운이 모자라다. 그래서 끊어내야 할 사람과 미련을 단칼에 베지 못하고, 밤마다 그 얼굴들을 다시 불러내 곱씹어왔지. 그 무딘 칼날이 네 마음을 베어온 것이다.',
    water: '네 원국에는 열기를 식혀주는 수(水)의 기운이 모자라다. 그래서 머릿속이 과열된 엔진처럼 꺼지지 않고, 누워서도 생각이 생각을 낳으며 새벽까지 달려왔지. 그 열기가 네 잠을 태워버린 것이다.'
  };

  /** 한국어 조사: 마지막 한글 글자의 받침에 따라 고른다. josa('정재','으로') → '로' */
  function josa(word, kind) {
    const m = String(word).replace(/[^가-힣]+$/g, '').match(/[가-힣](?=[^가-힣]*$)/);
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
    '비견': '어깨를 나란히 할 동료와 경쟁자가 한꺼번에 몰려드는 해다. 손잡을 자와 경계할 자를 칼같이 가려라.',
    '겁재': '네 몫을 노리는 손이 가까이 다가오는 해다. 동업과 보증, 돈거래만은 두 번 세 번 따져보거라.',
    '식신': '타고난 재주가 자연스럽게 밥이 되는 해다. 즐겨 하던 일을 꾸준히 쌓으면 그것이 곧 네 밥그릇이 된다.',
    '상관': '말과 재능이 밖으로 터져 나오는 해다. 만들고 드러내되, 윗사람과의 말다툼과 규칙 어김만은 삼가거라.',
    '편재': '뜻밖의 큰돈이 움직이는 해다. 들어오는 판은 크지만 나가는 길도 넓으니 계약서와 통장을 네 손으로 직접 챙겨라.',
    '정재': '꼬박꼬박 쌓이는 재물의 해다. 한 방을 노리기보다 월급과 고정 수입의 그릇을 키우는 데 힘을 쏟거라.',
    '편관': '거센 압박과 시험이 몰아치는 해다. 그 무게를 버텨내면 감투와 권한이 따라오니 피하지 말고 맞서라.',
    '정관': '자리와 명예가 바로 서는 해다. 승진·합격·계약처럼 공식적인 인정을 받을 일에 정면으로 도전하거라.',
    '편인': '남다른 감각과 촉이 깨어나는 해다. 낯선 공부와 기술에 파고들되, 생각만 많아져 실행을 미루지는 마라.',
    '정인': '배움과 귀인의 도움이 깃드는 해다. 자격과 공부, 문서로 기반을 다져두면 다음 도약의 발판이 된다.'
  };

  // 그해 천간이 일간에게 어떤 십신으로 들어오는지에 따른 해설 (계열별 요약 — 직장운 한 줄 등에 사용)
  const YEAR_SIPSIN_TEXT = {
    bi: '경쟁자와 동료가 한꺼번에 몰려드는 해다. 손잡을 자와 경계할 자를 칼같이 가려라.',
    sik: '네 재능과 말이 밖으로 터져 나오는 해다. 만들고 드러내되, 윗사람과의 말다툼만은 삼가거라.',
    jae: '재물의 기운이 크게 움직이는 해다. 들어오는 돈은 크지만 나가는 길도 넓으니 계약서와 통장을 네 손으로 직접 챙겨라.',
    gwan: '책임과 압박이 어깨를 짓누르는 해다. 그 무게를 버텨내면 직함과 명예가 따라오니 피하지 말고 맞서라.',
    in: '배움과 귀인의 도움이 깃드는 해다. 자격과 공부, 문서로 기반을 다져두면 다음 도약의 발판이 된다.'
  };
  // 결과 화면 '일의 냄새'용 짧은 한마디 (리포트 로드맵의 연도 해설과 겹치지 않게)
  const CAREER_SIPSIN_HINT = {
    '비견': '혼자보다 함께 뛸 동료를 찾을 때 판이 커진다.',
    '겁재': '경쟁자가 바짝 붙는다. 네 몫의 성과는 기록으로 남겨 두거라.',
    '식신': '손에 익은 재주가 그대로 일감이 된다.',
    '상관': '말과 아이디어로 판을 흔들 때다. 다만 윗선과의 충돌은 피하거라.',
    '편재': '바깥에서 큰 기회가 굴러든다. 발 넓게 움직여라.',
    '정재': '성실하게 쌓은 실적이 연봉과 자리로 돌아온다.',
    '편관': '무거운 일이 몰리지만, 버티면 직함이 따라온다.',
    '정관': '공식적인 인정이 온다. 승진·합격 같은 문을 두드려라.',
    '편인': '남다른 기술 하나를 파고들면 대체 불가능한 사람이 된다.',
    '정인': '자격과 배움이 다음 자리를 열어 준다.'
  };
  const SIPSIN_GROUP = { '비견': 'bi', '겁재': 'bi', '식신': 'sik', '상관': 'sik', '편재': 'jae', '정재': 'jae', '편관': 'gwan', '정관': 'gwan', '편인': 'in', '정인': 'in' };

  // ── 누재살 방어 비방: 사주에 따라 고르는 문장 (원래 문장은 각각 한 유형으로 보존) ──
  // ① 재성 글자 수별 (0 / 1 / 2개 이상 = 원래 문장)
  const WEALTH_GUARD_BY_COUNT = [
    `1. <strong>돈 그릇 빚기 작전</strong>: 재성이 드러나지 않은 명식은 돈이 머물 자리부터 만들어야 한다. 월급이나 용돈이 들어온 그날, 쓰기 전에 30%를 '절대 손대지 않는 통장'으로 자동 이체해 그릇의 바닥부터 채워라.`,
    `1. <strong>실금 메우기 작전</strong>: 가는 물줄기는 작은 구멍 하나에도 금세 마른다. 이번 주 안에 자동결제·구독·배달 내역을 전부 뽑아, 한 달 동안 한 번도 안 쓴 것부터 끊어내라.`,
    `1. <strong>현금 봉쇄 작전</strong>: 통장에 자유입출금 잔고를 200만 원 이상 두지 마라. 들어오는 즉시 묶이는 청약, 펀드, 채권 등 빼기 힘든 구조로 강제 이체하라.`
  ];
  // ② 원국에서 가장 짙은 기운(재성 제외)별 — 돈이 새는 길
  const WEALTH_LEAK_BY_GROUP = {
    bi: `2. <strong>불필요한 동정심 차단</strong>: 주변의 금전 거래 요구나 빌려달라는 부탁은 무조건 "지금 전세금(또는 투자금)으로 다 묶여 있다"고 단칼에 거절하라.`,
    sik: `2. <strong>기분 지출 차단</strong>: 네 명식은 재주와 흥이 넘쳐 기분이 좋을 때 지갑이 먼저 열린다. 장바구니에 담은 물건은 24시간 묵혀 두고, 다음 날에도 꼭 필요할 때만 결제하라.`,
    gwan: `2. <strong>체면 지출 차단</strong>: 네 명식은 자리와 체면의 기운이 짙어, '사람 도리' 때문에 나가는 밥값·경조사비·선물값이 통장을 뚫는다. 한 달 체면비 상한을 미리 정해 두고, 넘으면 마음만 정중히 전하라.`,
    in: `2. <strong>배움 지출 차단</strong>: 네 명식은 배움과 문서의 기운이 짙어, 강의·책·자격증 결제가 끝없이 이어진다. 지금 붙든 공부 하나를 끝내기 전에는 새 강의를 결제하지 마라.`
  };
  const GROUP_KO = { bi: '비겁(比劫)', sik: '식상(食傷)', gwan: '관성(官星)', in: '인성(印星)' };

  // ── 천명 100일 작전: 세 수칙을 각각 다른 기준으로 고른다 (원래 문장은 각각 한 유형으로 보존) ──
  // ① 기상 의식 — 가장 모자란 오행 (수(水) 보충 = 원래 문장)
  const MORNING_RITUAL_BY_WEAK = {
    wood: `1. <strong>기상 직후 창문 열기 & 축문</strong>: 눈뜨자마자 스마트폰을 보지 말고, 창문부터 활짝 열어 아침 공기를 들이며 두 팔을 하늘로 뻗고 "내 안의 흉살은 물러가고 천명이 일어선다" 세 번 읊조려라.`,
    fire: `1. <strong>기상 직후 햇볕 5분 & 축문</strong>: 눈뜨자마자 스마트폰을 보지 말고, 창가나 문밖에서 아침 햇볕을 5분 쬐며 "내 안의 흉살은 물러가고 천명이 일어선다" 세 번 읊조려라.`,
    earth: `1. <strong>기상 직후 맨발 딛기 & 축문</strong>: 눈뜨자마자 스마트폰을 보지 말고, 맨발로 바닥을 단단히 딛고 서서 따뜻한 물 한 잔을 천천히 마시며 "내 안의 흉살은 물러가고 천명이 일어선다" 세 번 읊조려라.`,
    metal: `1. <strong>기상 직후 이부자리 각 잡기 & 축문</strong>: 눈뜨자마자 스마트폰을 보지 말고, 이불을 반듯하게 개어 각을 세운 뒤 "내 안의 흉살은 물러가고 천명이 일어선다" 세 번 읊조려라.`,
    water: `1. <strong>기상 직후 찬물 한 잔 & 축문</strong>: 눈뜨자마자 스마트폰을 보지 말고, 찬물 한 잔을 마시며 "내 안의 흉살은 물러가고 천명이 일어선다" 세 번 읊조려라.`
  };
  // ② 몰입 시간대 — 일간 오행 (토(土) 일간 = 원래 문장)
  const FOCUS_RULE_BY_DM = {
    wood: d => `2. <strong>아침 1시간 몰입 결계</strong>: 목(木) 일간은 해 뜨는 아침에 기운이 가장 맑게 뻗는다. 하루 일과를 시작하기 전 1시간을 떼어 오직 [<strong class="impact-gold">${d}</strong>]에만 몰두하라.`,
    fire: d => `2. <strong>오전 1시간 몰입 결계</strong>: 화(火) 일간은 해가 높이 오를수록 기세가 산다. 오전 중 1시간을 떼어 알림을 모두 끄고 오직 [<strong class="impact-gold">${d}</strong>]에만 불을 지펴라.`,
    earth: d => `2. <strong>매일 1시간 몰입 결계</strong>: 어떤 방해도 받지 않고 오직 [<strong class="impact-gold">${d}</strong>]에만 몰두하는 불가침의 1시간을 반드시 사수하라.`,
    metal: d => `2. <strong>저녁 1시간 몰입 결계</strong>: 금(金) 일간은 해 지는 저녁에 칼날이 가장 날카롭다. 저녁을 먹은 뒤 1시간, 오직 [<strong class="impact-gold">${d}</strong>]에만 칼끝을 겨누어라.`,
    water: d => `2. <strong>밤 1시간 몰입 결계</strong>: 수(水) 일간은 고요한 밤에 생각이 가장 깊어진다. 잠들기 전 1시간을 [<strong class="impact-gold">${d}</strong>]에 바치되, 자정은 넘기지 마라.`
  };
  // ③ 정화할 자리 — 일지(배우자·생활 자리) 오행 (수(水) 일지 = 원래 문장)
  const CLEANSE_RULE_BY_DAY_BRANCH = {
    wood: `3. <strong>현관 정화</strong>: 현관에 쌓인 신발과 택배 상자를 즉시 치워라. 기운이 드나드는 문이 막히면 찾아오던 귀인도 발길을 돌린다.`,
    fire: `3. <strong>부엌 정화</strong>: 싱크대에 쌓인 설거지와 상한 음식을 즉시 치워라. 불을 다루는 자리가 더러우면 재물의 불씨가 꺼진다.`,
    earth: `3. <strong>책상 정화</strong>: 책상 위에 쌓인 종이와 잡동사니를 즉시 치워라. 일을 펼치는 땅이 어지러우면 무엇을 심어도 뿌리를 내리지 못한다.`,
    metal: `3. <strong>지갑·가방 정화</strong>: 지갑 속 묵은 영수증과 가방 바닥의 쓰레기를 즉시 비워라. 돈이 드나드는 주머니가 지저분하면 들어온 돈도 금세 빠져나간다.`,
    water: `3. <strong>침실 정화</strong>: 침대 머리맡에 널브러진 불필요한 옷가지와 쓰레기를 즉시 치워라. 죽은 물건이 침실에 있으면 자는 동안 악귀가 기를 빨아먹는다.`
  };

  // ── 꿈 ↔ 오행: 꿈에 적힌 낱말이 어느 기운의 일인지 (영적 조화율 계산용) ──
  const DREAM_EL_KEYWORDS = {
    wood: ['교육', '교사', '선생', '강사', '디자인', '기획', '출판', '작가', '글', '상담', '복지', '간호', '농', '패션', '뷰티', '건축', '창작', '공부'],
    fire: ['방송', '영상', '유튜브', '연예', '배우', '가수', '아이돌', '마케팅', '광고', '강연', '요리', '셰프', '게임', '콘텐츠', '인플루언서', '스타', '유명', '개발', '앱', '웹'],
    earth: ['부동산', '건물', '건설', '공무원', '중개', '컨설팅', '유통', '관리', '행정', '보험', '안정', '집', '자산', '땅', '카페', '가게', '장사'],
    metal: ['금융', '투자', '주식', '코인', '법', '변호사', '판사', '검사', '회계', '세무', '엔지니어', '기계', '반도체', '군인', '경찰', '의사', '치과', '약사', '분석', '데이터', '자동차', '부자', '돈'],
    water: ['무역', '여행', '물류', '연구', '박사', '철학', '심리', '해외', '유학', '이민', '음악', '작곡', '예술', '프리랜서', '코딩', '프로그래', '사업', '창업', '1인']
  };
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
    const label = `<strong class="impact-gold">[${EL_KO[ps.wealthEl]}] 재성(財星)</strong>`;
    // 같은 사람이 결과 화면·리포트·묻기에서 같은 문단을 두 번 읽지 않게, 자리마다 다른 문장
    if (where === 'teaser') {
      if (ps.wealthCount === 0) return `네 원국에는 ${label}이 보이지 않는다. 벌어도 머물 자리가 없으니 돈이 손가락 사이로 빠진다.`;
      if (ps.wealthCount === 1) return `네 원국의 ${label}은 단 한 줄기다. 가는 물줄기라 작은 구멍 하나에도 금세 마른다.`;
      return `네 원국에는 ${label}이 ${ps.wealthCount}글자나 된다. 물은 넘치는데 담을 독이 작다.`;
    }
    if (where === 'chat') {
      if (ps.wealthCount === 0) return `재물 글자인 ${label}이 원국에 없다. 그래서 너는 "모으는 법"부터 배워야 돈이 붙는 사람이다.`;
      if (ps.wealthCount === 1) return `재물 글자인 ${label}이 하나뿐이라, 큰돈보다 꾸준한 돈이 네 편이다.`;
      return `재물 글자인 ${label}이 넉넉하다. 버는 재주는 있으니, 지키는 재주만 붙이면 된다.`;
    }
    if (ps.wealthCount === 0) return `특히 네 원국에는 재물을 뜻하는 ${label}이 한 글자도 드러나 있지 않다. 돈이 제 발로 찾아오는 팔자가 아니니, 네 손으로 그릇을 빚고 길목을 지켜야만 고인다.`;
    if (ps.wealthCount === 1) return `네 원국에서 재물을 뜻하는 ${label}은 단 한 글자뿐이다. 들어오는 물줄기가 가늘어 한 번 새기 시작하면 바닥이 금세 드러나니, 작은 지출 구멍부터 틀어막아라.`;
    return `네 원국에는 재물을 뜻하는 ${label}이 ${ps.wealthCount}글자나 깔려 있다. 돈이 들어오는 길은 넓지만 감당할 그릇보다 물이 많아 넘쳐흐르는 형국이니, 들어오는 족족 묶어두지 않으면 남의 주머니로 흘러간다.`;
  }

  /** 로드맵 연도별: 그해 간지가 일간·일지와 맺는 관계 */
  function yearRelationText(year, ps) {
    const ys = ((year - 4) % 10 + 10) % 10, yb = ((year - 4) % 12 + 12) % 12;
    const sipsin = getSipsin(ps.dayStemIdx, ys);
    let t = `🔎 <strong>명식 대조</strong>: ${yearGanji(year)}년의 천간이 네게 <strong class="impact-gold">[${sipsin}]</strong>${josa(sipsin, '으로')} 들어온다. ${YEAR_SIPSIN_TEXT_10[sipsin]}`;
    if ((yb - ps.dayBranchIdx + 12) % 12 === 6) {
      t += ` 또한 이 해의 지지(${BRANCHES[yb].char})가 네 일지(${BRANCHES[ps.dayBranchIdx].char})와 정면으로 부딪히는 <strong class="impact-red">충(沖)</strong>이 걸려 있으니, 이사·이직·관계의 큰 변동에 대비하거라.`;
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
  function showView(id) {
    document.querySelectorAll('.app-container > .view-step').forEach(v => { v.style.display = (v.id === id) ? 'flex' : 'none'; });
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
      document.getElementById('year').value = p.y;
      document.getElementById('month').value = p.m;
      document.getElementById('day').value = p.d;
      if (p.hour !== undefined) document.getElementById('hourSelect').value = String(p.hour);
      if (p.gender) document.getElementById('gender').value = p.gender;
    }
    goToStep(2);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 💬 사이트 공유: 개인정보 없이 첫 화면 주소만 보낸다 (휴대폰은 공유 창 → 카카오톡, 안 되면 문구 복사)
  // ─────────────────────────────────────────────────────────────────────────
  const SHARE_TITLE = '벽사신견 사주';
  const SHARE_TEXT = '1998년 겨울, 영월 산자락 흙집 대문을 지키던 백구 지박령이 네 사주를 냄새로 읽어준다 🐾\n오늘의 운세·궁합·벽사 패 뽑기는 무료다.';
  function siteHomeUrl() {
    const u = new URL(window.location.href);
    u.search = ''; u.hash = '';
    u.pathname = u.pathname.replace(/index\.html$/, '');
    return u.href;
  }
  async function shareSite() {
    const url = siteHomeUrl() + '?from=share';   // 받은 친구도 할인을 받는다 (개인정보는 담지 않음)
    const reward = () => { if (grantCoupon('share')) setTimeout(() => showToast(`🎁 공유 고맙다. 유료 풀이 1건 ${won(SHARE_DISCOUNT.amount)}원 할인을 ${SHARE_DISCOUNT.days}일 동안 걸어 두었다.`), 2700); };
    if (navigator.share) {
      try { await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url }); reward(); return; }
      catch (e) { if (e && e.name === 'AbortError') return; /* 그 밖의 실패는 복사로 */ }
    }
    copyText(`${SHARE_TEXT}\n${url}`, '💬 소개 문구와 주소를 복사했다. 카톡 대화창에 붙여 넣거라.');
    reward();
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

  function submitAndGoToResult() {
    const yVal = document.getElementById('year').value.trim();
    const mVal = document.getElementById('month').value.trim();
    const dVal = document.getElementById('day').value.trim();
    const calType = document.getElementById('calendarType').value;

    if (!yVal || !mVal || !dVal) {
      alert('생년월일을 온전히 대지 않으면 등 뒤의 그림자를 벗겨낼 수 없다!');
      return;
    }

    const y = parseInt(yVal);
    const m = parseInt(mVal);
    const d = parseInt(dVal);

    if (isNaN(y) || isNaN(m) || isNaN(d) || y < 1920 || y > 2030) {
      alert('생년은 1920년부터 2030년 사이로 바르게 고하거라!');
      return;
    }

    if (m < 1 || m > 12 || d < 1 || d > 31) {
      alert('올바른 생월과 생일을 고하거라!');
      return;
    }

    // 날짜 유효성 검증 (2월 30일 등 날짜 롤오버 방지)
    const testDate = new Date(Date.UTC(y, m - 1, d));
    if (testDate.getUTCFullYear() !== y || (testDate.getUTCMonth() + 1) !== m || testDate.getUTCDate() !== d) {
      alert('존재하지 않는 날짜(예: 2월 30일 등)다. 올바른 생년월일을 확인하고 다시 적거라!');
      return;
    }

    if (calType === 'lunar') {
      alert('⚠️ 음력 생일 변환은 아직 준비 중이다. 양력 생년월일로 다시 고하거라!');
      return;
    }

    calculateSaju(y, m, d);
    goToStep(3);
    playRitual();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 🌑 분위기 연출: 첫 진입(어둠 속 한 줄씩) · 풀이 의식(냄새 맡는 중)
  //   테스트(window.__BYEOKSA_TEST__)와 '움직임 줄이기' 설정에서는 건너뛰거나 짧게
  // ─────────────────────────────────────────────────────────────────────────
  const QUIET = () => !!window.__BYEOKSA_TEST__;
  const REDUCED = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const SEEN_KEY = 'byeoksa.seen.v1';

  function playOpening() {
    const veil = document.getElementById('openingVeil');
    if (!veil || QUIET()) return;
    let seen = false; try { seen = !!localStorage.getItem(SEEN_KEY); localStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* 무시 */ }
    const lines = [...veil.querySelectorAll('.opening-lines p')];
    const step = REDUCED() ? 0 : 1500;
    veil.classList.toggle('is-short', seen);
    lines.forEach((p, i) => { p.style.animationDelay = seen ? '0.2s' : `${i * step / 1000 + 0.4}s`; });
    veil.hidden = false;
    document.body.classList.add('veil-on');
    const total = seen ? 2200 : (REDUCED() ? 4000 : lines.length * step + 2600);
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      veil.classList.add('is-leaving');
      document.body.classList.remove('veil-on');
      setTimeout(() => { veil.hidden = true; veil.classList.remove('is-leaving'); }, 900);
    };
    document.getElementById('openingSkip').onclick = finish;
    setTimeout(finish, total);
  }

  const RITUAL_LINES = ['대문 밖 바람이 멎었다…', '백구가 네 냄새를 맡고 있다…', '네 등 뒤에서 무언가 움찔했다…', '명식이 드러난다.'];
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
    modal.style.opacity = '0';
    modal.style.visibility = 'hidden';
    setTimeout(() => { modal.style.display = 'none'; }, 350);
    showToast('🕯️ 운명의 문턱을 넘었다.');
    // 넘어가면 접견실(입력창)로 직행
    goToStep(2);
  }

  function calculateSaju(y, m, d) {
    const hourVal = parseInt(document.getElementById('hourSelect').value);
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
    CUR_AGE = NOW_Y - y;   // 만 19세 미만이면 연애 문장을 '앞으로 올 인연' 쪽으로 순하게
    updateAnimalCard(dStem, dBranch);
    renderPillars({ yStem, yBranch, mStem, mBranch, dStem, dBranch, hStem, hBranch, dStemIdx });
    const ohengResult = renderOheng({ yStem, yBranch, mStem, mBranch, dStem, dBranch, hStem, hBranch });
    updateDreamFitCard(dStem, dBranch, ohengResult, userJob, userMajor, userHobby, userDream);
    renderDaeun(y, m, d, genderVal, yStemIdx, mStemIdx, mBranchIdx, dStemIdx, pillars);
    renderTermBoundaryNote(pillars.termBoundary, hourVal >= 0);

    // 🔮 살을 대폭 붙인 심리 투시 및 악연 경고
    updateMindScanCard(dStem, dBranch, ohengResult, userJob, userDream);
    updateGhostWarningCard(dStem, dBranch, ohengResult, dStemIdx);

    // 🕯️ 연애/재물 한 줄 후각 감별 티저 갱신
    updateSniffTeaser(dStem, dBranch, dStemIdx, userDream, ohengResult);
    updateKpiDashboard(dStemIdx, dBranchIdx, ohengResult, y, m, d);

    // 🔒 6단계 대외비 포트폴리오 사전 준비
    updatePaywallContent(dStem, dBranch, ohengResult, dStemIdx, dBranchIdx, userDream, userJob, y, m, d);

    currentSajuData = {
      y, m, d, hourVal, genderVal,
      userJob, userMajor, userHobby, userDream,
      dStem, dBranch, yStem, yBranch, mStem, mBranch, hStem, hBranch,
      dStemIdx, dBranchIdx, ohengResult, pillars
    };
    saveProfile({ y, m, d, hour: hourVal, gender: genderVal });
    applyPaidState();
  }

  function updateAnimalCard(dStem, dBranch) {
    const animalEmojis = {
      '자': '🐭', '축': '🐮', '인': '🐯', '묘': '🐰',
      '진': '🐲', '사': '🐍', '오': '🐴', '미': '🐑',
      '신': '🐵', '유': '🐔', '술': '🐶', '해': '🐷'
    };
    const elColors = { 'wood': '푸른', 'fire': '붉은', 'earth': '황금빛', 'metal': '서늘한 백색', 'water': '검은 심해의' };
    
    document.getElementById('animalTag').innerText = `${dStem.char}${dBranch.char} (${dStem.hanja}${dBranch.hanja}) 일주 본성`;
    document.getElementById('animalEmoji').innerText = animalEmojis[dBranch.char] || '✨';
    document.getElementById('animalTitle').innerText = `${elColors[dStem.el]} ${dBranch.animal}의 살기(殺氣)가 보인다.`;
    document.getElementById('animalDesc').innerText = 
      `네놈의 뼈대는 ${dStem.trait}과 ${dBranch.trait}으로 빚어졌다. 기운의 날이 시퍼렇지만, 그만큼 사방에서 쏘아대는 시기와 질투의 화살을 정면으로 맞는 고독한 팔자다.`;
  }

  function updateDreamFitCard(dStem, dBranch, oheng, job, major, hobby, dream) {
    // 예전엔 일주 글자 코드로만 정해져 88~96% 사이에서 거의 같은 값이 나왔다 → 원국·꿈에 따라 계산
    const fit = calculateDreamFit(dStem, dBranch, oheng, dream);
    const baseScore = fit.score;
    document.getElementById('fitScore').innerText = `영적 조화율 ${baseScore}%`;

    let html = `<strong>"[${dream}]${josa(dream, '을')} 품은 네 가슴속 불길이 내 털끝을 태우는구나."</strong><br><br>`;
    html += `• <strong>현세의 신분과 무기</strong>: 지금 뒹굴고 있는 [${job}]과 [${major}]... 네놈의 무기인 [${dStem.name}]의 기운을 담금질하는 모진 연단이다. 피하지 말고 칼날을 갈아라.<br>`;
    html += `• <strong>정신의 숨구멍([${hobby}])</strong>: 가볍게 즐기는 [${hobby}]... 단순한 노름이 아니라 네 메마른 명줄에 음기를 채워주는 은밀한 영약이다.<br>`;
    html += `• <strong>지박령의 일갈</strong>: 주변의 잡것들이 '그게 되겠냐' 짓껄여도 귓등으로도 흘려듣지 마라. 1998년 겨울부터 이 문턱을 지키며 숱한 사람을 보았으나, 제 고집대로 밀어붙인 자만이 살아서 성채를 세웠다.<br>`;
    html += `• <strong>조화율을 맡은 근거</strong>: ${fit.reason}`;

    document.getElementById('fitContent').innerHTML = html;
  }

  /** 영적 조화율: 원국 오행이 고른 정도 + 꿈이 일간에게 어떤 자리의 일인지 (60~98) */
  function calculateDreamFit(dStem, dBranch, oheng, dream) {
    const counts = (oheng && oheng.counts) || {};
    const present = EL_KEYS.filter(k => counts[k] > 0).length;          // 드러난 오행 가짓수 1~5
    const dmEl = dStem.el, dEl = dreamElement(dream);
    const rel = dEl ? (EL_KEYS.indexOf(dEl) - EL_KEYS.indexOf(dmEl) + 5) % 5 : -1;   // 0 비겁 1 식상 2 재성 3 관성 4 인성
    const REL = [
      { pts: 7, text: '네 일간과 같은 기운의 일이라, 남이 시키지 않아도 스스로 밀고 나간다' },
      { pts: 12, text: '네 일간이 낳는 식상(食傷)의 일이라, 타고난 재주가 그대로 밖으로 뻗는 자리다' },
      { pts: 10, text: '네 일간이 다스리는 재성(財星)의 일이라, 손을 대는 만큼 결과가 돈으로 잡힌다' },
      { pts: 4, text: '네 일간을 누르는 관성(官星)의 일이라, 버거운 만큼 해냈을 때 이름이 선다' },
      { pts: 8, text: '네 일간을 키워 주는 인성(印星)의 일이라, 배우고 쌓을수록 힘이 붙는다' }
    ];
    const jitter = SajuCore.hashSeed(`${dream}|${dStem.char}${dBranch.char}`) % 7;
    const score = Math.max(60, Math.min(98, 60 + present * 4 + (rel >= 0 ? REL[rel].pts : 3) + jitter));
    const spread = `원국에 오행 다섯 가지 중 <strong>${present}가지</strong>가 드러나 있고`;
    const reason = (rel >= 0)
      ? `${spread}, 네 꿈은 <strong>${EL_KO[dEl]}</strong> 기운의 일이다. ${REL[rel].text}.`
      : `${spread}, 네가 적은 꿈에서는 뚜렷한 오행의 냄새를 맡지 못했다. 꿈을 구체적으로 적어 내면 더 정확히 맡아주마.`;
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
        badge: `[${iljuName}日柱 목(木)의 흉살: 결실과 아이디어를 도둑맞은 배신]`,
        hook: `너, <strong>불과 1~2년 전쯤(${Y_PAST1}~${Y_PAST2}년, ${yearGanji(Y_PAST1)}·${yearGanji(Y_PAST2)}년)에 네 사주에 겁재(劫財)와 비견의 흉살이 치솟을 때</strong>, '너랑 나랑 손잡고 함께 가자'며 달콤한 말로 부추기던 동업자나 선배·친구 하나 있었지?`,
        details: `네 우직하고 순수한 ${stemChar === '갑' ? '갑목(甲木, 큰 나무)' : '을목(乙木, 담쟁이)'}의 심성을 이용해, 네가 밤잠 안 자고 뼈를 깎아 만든 핵심 아이디어와 기획, 인맥의 알맹이는 쏙 빼먹고, 결정적인 순간에 성과와 계약에서 네 이름을 지워버린 그 파렴치한 인간!<br><br>` +
                 `'내가 왜 사람 보는 눈이 이리 없었을까', '내가 너무 순진해서 당했나' 혼자 자책하며 방구석에서 피눈물을 삼켰겠지만, 똑똑히 알아둬라. 네 탓이 아니다. 네 목(木) 기운의 우직한 성장을 시기해 달라붙은 비열한 흡기귀(吸氣鬼)였다.`,
        innerSoul: `너는 겉으로는 온화하고 남들에게 싫은 소리 한마디 못 하는 착한 사람처럼 보이지만, 속으로는 네 기준과 선이 칼날보다 날카롭다. 한번 마음에 금이 간 인간은 두 번 다시 안 보지만, 정작 속마음을 100% 털어놓을 영혼의 동반자가 없어 밤마다 뼈마디가 시린 고독을 혼자 씹어 삼켜왔을 것이다.`
      },
      fire: {
        badge: `[${iljuName}日柱 화(火)의 흉살: 온기만 빼앗기고 버려진 배신]`,
        hook: `너, <strong>불과 1~2년 전쯤(${Y_PAST1}~${Y_PAST2}년, ${yearGanji(Y_PAST1)}·${yearGanji(Y_PAST2)}년)에 네 사주에 관살(官煞)과 상관의 칼바람이 불어닥칠 때</strong>, '나 지금 너무 힘들어, 너밖에 의지할 데 없어'라며 매달리던 인간에게 온 마음과 지갑을 다 털어준 적 있지?`,
        details: `네 타고난 ${stemChar === '병' ? '병화(丙火, 뜨거운 태양)' : '정화(丁火, 촛불)'}의 측은지심 때문에 밥 사주고, 일 도와주고, 마음 다 챙겨주며 살려놓았더니 돌아온 게 뭐였느냐?<br><br>` +
                 `단물만 쏙 빨아먹고 제 살길 찾자마자 싸늘하게 안면을 바꾸고, 뒤에서는 '걔가 지 멋대로 오지랖 부린 거지'라며 네 험담까지 퍼뜨리고 다닌 그 배은망덕한 인간!<br><br>` +
                 `너는 온몸을 불살라 길을 밝혀주었건만, 너만 잿더미가 되어 멍하니 가슴을 쥐어뜯었지? 자책하지 마라. 네 불꽃 같은 열정을 갉아먹은 가증스러운 흡기귀였다.`,
        innerSoul: `너는 남들 앞에선 세상에서 제일 밝고 열정적인 사람인 척 연기하지만, 속은 이미 시커멓게 다 타버린 잿더미다. 거절을 단호하게 못 해서 온갖 궂은일 다 떠맡고 속으로 피눈물 흘리다가, 결국 한계에 달해 혼자 잠수 타거나 자폭해버린 적이 한두 번이 아니지.`
      },
      earth: {
        badge: `[${iljuName}日柱 토(土)의 흉살: 호구 취급과 누명의 배신]`,
        hook: `너, <strong>불과 1~2년 전쯤(${Y_PAST1}~${Y_PAST2}년, ${yearGanji(Y_PAST1)}·${yearGanji(Y_PAST2)}년)에 네 사주에 재관(財官)의 무거운 짐이 쏟아져 내릴 때</strong>, 네가 묵묵히 다 받아주고 양보해주니까 널 만만한 호구이자 '감정 쓰레기통'으로 취급한 인간이 분명히 있었을 게다.`,
        details: `네 ${stemChar === '무' ? '무토(戊土, 거대한 산)' : '기토(己土, 비옥한 대지)'}의 넓은 도량을 믿고 호의를 권리인 양 착취하더니, 정작 공동의 문제나 금전적 손실이 터졌을 땐 제 책임은 쏙 빼고 네게 모든 책임과 누명을 덤터기 씌우려 했던 그 뻔뻔한 인간!<br><br>` +
                 `"내가 저 인간한테 어떻게 해줬는데 나한테 이럴 수가 있어?"라는 억울함이 가슴에 맺혀 목구멍까지 피가 거꾸로 솟았을 것이다. 똑똑히 알아둬라. 네 탓이 아니다. 네 넓은 품에 기생해 피를 빤 파렴치한 흡기귀였다.`,
        innerSoul: `너는 넓은 마음으로 다 이해하고 품어주는 척하지만, 실은 속으로 배신감과 서운함을 뼛속 깊이 새겨두는 타입이다. 참고 참다가 한번 둑이 터지면 뒤도 안 돌아보고 손절하지만, 혼자 남겨졌을 때 엄습하는 지독한 회의감에 가슴을 뜯어왔을 것이다.`
      },
      metal: {
        badge: `[${iljuName}日柱 금(金)의 흉살: 가장 아픈 약점을 찔린 비수]`,
        hook: `너, <strong>불과 1~2년 전쯤(${Y_PAST1}~${Y_PAST2}년, ${yearGanji(Y_PAST1)}·${yearGanji(Y_PAST2)}년)에 네 사주에 식상과 재성이 소용돌이칠 때</strong>, 웬만해선 마음을 안 여는 네가 드물게 마음의 벽을 허물고 치부와 나약한 속내까지 털어놓았던 자에게 등에 칼을 맞은 적이 있지?`,
        details: `네 서늘한 ${stemChar === '경' ? '경금(庚金, 무쇠 검)' : '신금(辛金, 예리한 단도)'}의 칼날을 거두고 믿어준 대가가, 네가 건넨 약점을 결정적 순간에 쥐고 흔들며 가스라이팅하고 네 자존심을 짓밟은 처참한 뒤통수였지!<br><br>` +
                 `겉으로는 네 완벽함을 부러워하는 척 알랑방귀를 뀌더니, 네가 조금 흔들리자마자 가장 잔인한 곳을 후벼판 그 교활한 인간!<br><br>` +
                 `'내가 왜 방심해서 그 칼자루를 쥐어줬을까' 자학하며 며칠 밤을 피를 말렸겠지만 자책하지 마라. 네 날카로운 기운을 시기해 꺾으려 든 사악한 흡기귀였다.`,
        innerSoul: `너는 겉으로는 냉철하고 야무진 완벽주의자처럼 굴지만, 실은 거절당하거나 실패자로 낙인찍힐까 봐 덜덜 떠는 극단적 유리 멘탈이다. 남들이 무심코 던진 비수 같은 말 한마디를 며칠 밤 동안 곱씹으며 스스로를 난도질하는 자학(自虐)의 칼날을 품고 있다.`
      },
      water: {
        badge: `[${iljuName}日柱 수(水)의 흉살: 영혼과 통장을 갉아먹힌 가스라이팅]`,
        hook: `너, <strong>불과 1~2년 전쯤(${Y_PAST1}~${Y_PAST2}년, ${yearGanji(Y_PAST1)}·${yearGanji(Y_PAST2)}년)에 네 사주에 비겁과 관살이 얽혀들 때</strong>, '너를 진정으로 이해하는 건 나뿐이야'라며 영혼의 구원자인 척 다가와 네 멘탈과 통장을 쥐고 흔든 인간이 분명히 있었을 게다.`,
        details: `네 깊은 ${stemChar === '임' ? '임수(壬水, 검은 심해)' : '계수(癸水, 스며드는 안개)'}의 외로움과 감성을 교묘하게 자극하며, 네 판단력을 흐려놓고 시간과 에너지를 갉아먹으며 끝없는 자책의 늪으로 끌고 들어간 그 음습한 인간!<br><br>` +
                 `네 피 같은 돈과 감정을 밑 빠진 독처럼 뜯어먹고서야 겨우 빠져나왔지만, '내가 왜 귀신에 홀린 듯 끌려다녔을까' 혼자 멍하니 가슴을 쥐어뜯었지?<br><br>` +
                 `네 탓이 아니다. 네 사주의 지혜와 촉을 시기해 눈을 멀게 만든 물귀신 같은 악연이었다.`,
        innerSoul: `너는 머릿속에 잡생각과 망상이 너무 많아 정작 실행해야 할 순간에 얼어붙는다. 머릿속으로는 이미 수백 번 부자가 되고 성공했지만, 침대에서 스마트폰만 멍하니 보며 인생을 갉아먹는 무기력의 악귀가 네 발목을 밧줄로 칭칭 감아놓고 있다.`
      }
    };

    const branchWounds = {
      '자': `네 일지에 깔린 영리한 쥐(子)의 기운 때문에 어둠 속에서도 위기를 본능적으로 감지했으나, 눈치를 보느라 타이밍을 놓쳐 속병을 키웠다.`,
      '축': `네 일지의 우직한 소(丑)의 기운 때문에 묵묵히 뼈를 깎으며 버텼지만, 돌아온 건 당연하다는 듯한 냉대와 억울함뿐이었다.`,
      '인': `네 일지의 용맹한 호랑이(寅)의 기운 때문에 남들 앞에서는 결코 무릎 꿇지 않았으나, 등 뒤에서 혼자 피를 흘리며 이를 갈았다.`,
      '묘': `네 일지의 여린 토끼(卯)의 기운 때문에 상대방의 차가운 눈빛과 비수 같은 말 한마디에도 심장에 피멍이 들었다.`,
      '진': `네 일지의 비상하는 용(辰)의 스케일 때문에 남다른 야망을 품었으나, 발목을 잡는 주변 인간들의 잔머리에 날개가 꺾였다.`,
      '사': `네 일지의 직관적인 뱀(巳)의 기운으로 싸한 냄새를 맡았으면서도, 정에 이끌려 단호히 끊어내지 못해 화를 자초했다.`,
      '오': `네 일지의 불타는 말(午)의 기운으로 거침없이 돌진하다가, 믿었던 자가 파놓은 함정에 빠져 큰 상처를 입었다.`,
      '미': `네 일지의 인내심 깊은 양(未)의 기운으로 겉은 온화한 척 웃어넘겼으나, 속은 새카맣게 타들어간 숯덩이가 되었다.`,
      '신': `네 일지의 재주 많은 원숭이(申)의 기운으로 임기응변을 발휘했으나, 가장 가까운 자의 배신 앞에서는 속수무책이었다.`,
      '유': `네 일지의 예리한 닭(酉)의 결벽증 때문에, 배신당한 기억을 수백 번 되새김질하며 제 가슴을 스스로 찔렀다.`,
      '술': `네 일지의 충직한 개(戌)의 순정 때문에, 은혜를 모르는 인간에게 간과 쓸개까지 다 빼주고 토사구팽을 당했다.`,
      '해': `네 일지의 도량 넓은 돼지(亥)의 기운으로 다 품어주려다, 오히려 삿된 인간들의 오물까지 다 뒤집어썼다.`
    };

    const betrayal = elementBetrayals[el] || elementBetrayals['wood'];
    const branchDesc = branchWounds[dBranch.char] || `뼈마디가 시린 고독을 씹어 삼켰다.`;

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

    document.getElementById('mindItem1').innerHTML = 
      `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">` +
      `  <strong class="impact-red" style="font-size:15.5px; font-weight:800;">👀 속마음 투시 (골수까지 도려내는 소름 돋는 팩폭)</strong>` +
      `  <span style="font-size:12px; color:#991b1b; background:#fef2f2; border:1px solid #b91c1c; padding:2px 8px; border-radius:4px; font-weight:700;">${data.iljuName}日柱 맞춤</span>` +
      `</div>` +
      `<p style="margin:8px 0; font-size:15.5px; line-height:2.0; color:#111827; font-weight:500;">` +
      `"네 골수까지 시린 서늘함을 내가 모를 줄 알았더냐? 딴청 피우지 마라.<br><br>` +
      `<strong class="impact-red" style="font-size:15.5px; font-weight:800;">${data.badge}</strong><br>` +
      `${data.hook}<br>` +
      `${data.details}<br><br>` +
      `💡 <strong style="color:#b45309; font-weight:800;">[지박령의 일주 본성 꿰뚫음]</strong>: ${data.branchDesc}<br>` +
      `${data.innerSoul}</p>`;

    document.getElementById('mindItem2').innerHTML = 
      `<div style="margin-bottom:8px;">` +
      `  <strong class="impact-red" style="font-size:15.5px; font-weight:800;">⚠️ 밤마다 네 숨통을 조이는 지독한 함정</strong>` +
      `</div>` +
      `<p style="margin:8px 0; font-size:15.5px; line-height:2.0; color:#111827; font-weight:500;">` +
      `너, <strong>밤에 불 끄고 침대에 누우면 낮에 있었던 사소한 말 한마디, 상대방의 싸늘한 눈빛이 머릿속에서 수십 번 되감기되며 숨이 턱 막힌 밤들</strong>이 분명히 있었을 게다.<br>` +
      `겉으로는 '난 쿨해, 다 괜찮아' 센 척하지만, 실은 속으로 온갖 최악의 시나리오를 그리며 뼈마디가 타들어갈 만큼 혼자 피를 말렸지.<br><br>` +
      `그리고 네가 적어낸 천명... <strong class="impact-gold" style="font-size:16px;">[${dream}]</strong>.<br>` +
      `남들 앞에서는 '나 꼭 해낼 거야' 당당하게 큰소리치면서도, 정작 혼자 있을 땐 <em>"과연 내가 진짜 이걸 해낼 수 있을까? 이미 너무 늦은 건 아닐까? 남들은 앞서가는데 나만 이 자리에서 영원히 도태되는 건 아닐까?"</em> 하는 공포에 심장이 덜컥 내려앉았을 게다.<br>` +
      `<strong class="impact-red" style="font-size:16px;">'이러다 나 진짜 아무것도 못 해보고 비참하게 끝나는 거 아니야?'</strong> 하는 그 서늘한 침묵...<br>` +
      `<br>🐾 <strong style="color:#b45309;">[그 함정의 뿌리]</strong>: ${NIGHT_TRAP_BY_WEAK[ps.weakKey]}<br><br>` +
      `내 말이 틀렸느냐? 이 흉살의 사슬을 지금 끊어내지 못하면 ${Y_R0}~${Y_R1}년에 터질 인생 일대의 천금 대운마저 네 발로 걷어차게 된다.</p>`;
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
    let potColor = "#d97706";
    if (potScore >= 90) {
      potGrade = "[극상 · 제왕지기]";
      potColor = "#16a34a";
    } else if (potScore >= 82) {
      potGrade = "[상 · 건록지기]";
      potColor = "#16a34a";
    }

    // 2. 2027 대운 폭발 지수 (골든타임): 70 ~ 99
    const timScore = 70 + ((seed * 11 + mNum * 3) % 30);
    let timGrade = "[도약 준비 태세]";
    let timColor = "#2563eb";
    if (timScore >= 90) {
      timGrade = "[임계점 도달 · 폭발적 상승]";
      timColor = "#d97706";
    } else if (timScore >= 80) {
      timGrade = "[상승 기류 탑승]";
      timColor = "#d97706";
    }

    // 3. 재물 방어력 (누재살 漏財煞): 28 ~ 85
    const wScore = 28 + ((seed * 13 + dNum * 7) % 58);
    let wGrade = "[⚠️ 위험: 돈 샐 틈 많음]";
    let wColor = "#dc2626";
    if (wScore >= 65) {
      wGrade = "[양호: 재물 곳간 든든함]";
      wColor = "#16a34a";
    } else if (wScore >= 48) {
      wGrade = "[⚠️ 주의: 지출 누수 경계]";
      wColor = "#d97706";
    }

    // 4. 주변 인연 정화도 (악연 감별): 32 ~ 88
    const kScore = 32 + ((seed * 17 + dStemIdx * 9) % 57);
    let kGrade = "[⚠️ 위험: 흡기귀 1~2명 근접]";
    let kColor = "#ef4444";
    if (kScore >= 70) {
      kGrade = "[청정: 귀인 인연 동행]";
      kColor = "#16a34a";
    } else if (kScore >= 50) {
      kGrade = "[⚠️ 주의: 기 빨림 경계]";
      kColor = "#d97706";
    }

    let alerts = 0;
    if (wScore < 48) alerts++;
    if (kScore < 50) alerts++;
    const alertHtml = alerts > 0 
      ? `<span class="impact-red" style="font-size:12px; font-weight:800;">위험 경보 ${alerts}건</span>` 
      : `<span style="font-size:12px; font-weight:800; color:#d97706;">주의 경보 1건</span>`;

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
  // 👹 백구가 등 뒤에서 본 것 — 가장 모자란 오행(weakKey)의 틈으로 들어온 귀신 5종 (직접 그린 SVG)
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
      lore: '속이 텅 빈 고목에 깃들어 사는 귀신이다. 네 원국에 목(木)이 모자란 틈으로 들어와, 네가 무언가 시작하려 할 때마다 마른 가지 같은 손가락으로 발목을 감는다. 결심이 자꾸 내일로 밀렸다면 이것이 붙어 있었던 탓이다.',
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
      lore: '꺼진 아궁이의 그을음 속에 사는 귀신이다. 네 원국에 화(火)가 모자란 틈으로 들어와, 네 안의 불씨를 하나씩 불어 끈다. 남들 앞에선 웃다가도 혼자 있으면 싸늘하게 식어 버렸다면, 이것이 네 어깨에 앉아 있었던 것이다.',
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
      lore: '목구멍은 바늘구멍만 한데 배는 끝없이 고픈 굶주린 귀신이다. 네 원국에 토(土)가 모자란 틈으로 들어와, 네가 쌓아 둔 것을 밤마다 갉아 먹는다. 모아도 모아도 바닥이 드러났다면, 이것이 네 그릇에 입을 대고 있었던 것이다.',
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
      lore: '녹슨 쇠뿔 하나를 단 도깨비다. 네 원국에 금(金)이 모자란 틈으로 들어와, 끊어야 할 인연 앞에서 네 칼날을 무디게 만든다. 아니다 싶은 사람을 끝내 놓지 못했다면, 이 도깨비가 네 손목을 붙들고 있었던 것이다.',
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
      lore: '젖은 머리칼을 늘어뜨린 채 물가에서 사람을 기다리는 귀신이다. 네 원국에 수(水)가 모자란 틈으로 들어와, 네 생각을 흙탕물처럼 흐린다. 밤마다 머리가 달아올라 잠들지 못했다면, 이것이 네 베갯머리에 앉아 있었던 것이다.',
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
        <p class="ghost-mirror-title">백구가 네 등 뒤를 비춰 본 거울</p>
        <p class="ghost-warn">⚠️ 아래 그림은 무섭거나 불쾌할 수 있습니다. 어린이·노약자·임산부, 공포 그림을 힘들어하는 분은 보지 않는 것을 권합니다.</p>
        <div class="ghost-portrait-frame">${GHOST_SVG_HEAD}${g.svg()}${GHOST_SVG_FOOT}<img class="ghost-img" src="img/ghosts/${weakKey}.jpg" width="640" height="640" alt="${g.name}(${g.hanja}) 그림" decoding="async" onload="this.parentNode.classList.add('has-img')" onerror="this.remove()">
          <svg class="ghost-mirror-crack" viewBox="0 0 100 125" preserveAspectRatio="none" aria-hidden="true"><path d="M71 8 L64 30 L70 41 L58 62 M64 30 L80 36 M70 41 L86 52 M58 62 L49 70 M58 62 L66 80" fill="none" stroke="rgba(235,230,220,.45)" stroke-width=".45"/><path d="M12 96 L22 88 L27 94 L36 86" fill="none" stroke="rgba(235,230,220,.3)" stroke-width=".4"/></svg>
          <button type="button" class="ghost-gate">👁 거울을 들여다보겠느냐<small>눌러서 네 등 뒤 보기</small></button>
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

  function updateGhostWarningCard(dStem, dBranch, oheng, dayStemIdx) {
    const nobles = NOBLE_PEOPLE[dayStemIdx] || ['소띠', '양띠'];
    const ps = getPersona(dayStemIdx, BRANCHES.indexOf(dBranch), oheng);
    const ghost = ghostFor(ps.weakKey);
    const gp = document.getElementById('ghostPortrait');
    if (gp) {
      gp.innerHTML = ghostPortraitHtml(ps.weakKey);
      revealGhost(gp.querySelector('.ghost-portrait'));
    }
    const gl = document.getElementById('ghostLore');
    if (gl) {
      gl.innerHTML = `<p class="ghost-lore">🐾 <strong>백구가 네 등 뒤에서 똑똑히 봤다. <span class="impact-red">${ghost.name}(${ghost.hanja})</span>.</strong> ${ghost.lore} 내가 이빨을 드러내자 한 걸음 물러섰지만, 그림자 끝은 아직 네 뒤꿈치에 걸려 있다.</p>`;
    }
    document.getElementById('ghostDesc').innerHTML = 
      `당장 네 등 뒤를 돌아보아라. 끈적한 악취가 진동한다.<br><br>` +
      `네 주변에 분명히 있다. <strong>평소엔 살갑게 굴다가도, 네가 조금만 좋은 일이 생기면 눈빛이 묘하게 차가워지며 '그게 잘될까?' 하고 초를 치는 인간!</strong><br>` +
      `네가 피땀 흘려 쌓아 올린 아이디어와 노력을 은근슬쩍 가로채려 드는 <strong class="impact-red">[흡기귀(吸氣鬼) 같은 악연]</strong>이 네 등 뒤에 시커멓게 찰싹 달라붙어 있다!<br><br>` +
      `🩸 <strong class="impact-red">지박령의 서늘한 경고</strong>: 이 악연의 싹을 지금 잘라내지 않으면, 네가 애써 모은 돈과 운기가 밑 빠진 독처럼 줄줄 새어나간다. 천을귀인(<strong class="impact-gold">${nobles[0]}</strong>)을 곁에 두고 악연을 칼같이 베어낼 비방이 시급하다!` +
      `<br><br>🐾 <strong>네 ${EL_KO[ps.dmEl]} 일간에 붙는 흡기귀의 얼굴</strong>: ${ENEMY_TYPES[ps.dmEl][0]}`;
  }

  function updateSniffTeaser(dStem, dBranch, dayStemIdx, dream, oheng) {
    const nobles = NOBLE_PEOPLE[dayStemIdx] || ['소띠', '양띠'];
    const ps = getPersona(dayStemIdx, BRANCHES.indexOf(dBranch), oheng);
    const careerSipsin = getSipsin(dayStemIdx, ((Y_R1 - 4) % 10 + 10) % 10);
    const loveScent = SOULMATE_SCENTS[ps.weakKey].short;
    document.getElementById('sniffLoveText').innerHTML = 
      (isYoung()
        ? `"아직 여물지 않은 인연의 냄새가 잡힌다. 앞으로 네 곁을 스쳐 갈 사람들 가운데에는 네 마음을 갉아먹으려 드는 <strong class="impact-red">악연</strong>도 섞여 있을 것이다. 달콤한 말 뒤에 숨은 곰팡이 냄새를 가려낼 줄 알아야 한다. 하지만`
        : `"코끝을 찌르는 지독한 사랑의 체취가 잡힌다. 너를 거쳐간 인연들을 돌아보아라. 10명 중 8명은 네 영혼을 갉아먹고 떠난 <strong class="impact-red">핏빛 악연</strong>이었을 것이다. 달콤한 향수 뒤에 숨겨진 곰팡이 냄새... 하지만`) + ` 너를 평생 지켜줄 ${loveScent}${josa(loveScent, '을')} 풍기는 [<strong class="impact-green">${nobles[0]}</strong>] <strong class="impact-green">천생연분</strong>이 운명선 뒤편에서 다가오고 있으니..."` + `<br><span class="sniff-personal">🐾 특히 네 ${EL_KO[ps.dmEl]} 일간에게 가장 해로운 건 <strong class="impact-red">[${RUIN_LOVERS[ps.dmEl].title}]</strong>를 풍기는 자다.</span>`;

    document.getElementById('sniffWealthText').innerHTML = 
      `"아무리 열심히 일하고 아껴 써도 밑 빠진 독처럼 통장이 텅 비어버리는 <strong class="impact-red">누재살(漏財煞)의 비린내</strong>가 난다. 통장에 돈이 모일 만하면 꼭 예상치 못한 사건사고로 돈이 털려나갔지? 그 구멍을 땜질할 재물의 비방이 포착되었다."` + `<br><span class="sniff-personal">🐾 ${wealthDiagnosis(ps, 'teaser')}</span>`;

    document.getElementById('sniffCareerText').innerHTML = 
      `"[<strong class="impact-gold">${dream}</strong>]${josa(dream, '을')} 향해 갈 때 네 성과를 낚아채고 혓바닥으로 네 칼을 갈던 인간들의 썩은 내가 보인다. 네 칼날을 갈아 판을 뒤엎을 <strong class="impact-gold">${Y_R0}~${Y_R1}년 이직·독립 골든타임</strong>의 냄새가 짙게 풍긴다..."` + `<br><span class="sniff-personal">🐾 ${Y_R1}년 ${yearGanji(Y_R1)}의 천간이 네게 <strong class="impact-gold">[${careerSipsin}]</strong>${josa(careerSipsin, '으로')} 들어온다. ${CAREER_SIPSIN_HINT[careerSipsin]}</span>`;
  }

  function renderTileHtml(item) {
    if (!item) return `<span style="color:#555;">-</span>`;
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
    document.getElementById('hourJijang').innerHTML = p.hBranch ? renderJijangHtml(p.hBranch, p.dStemIdx) : '-';

    document.getElementById('yearSipsin').innerText = getSipsin(p.dStemIdx, STEMS.indexOf(p.yStem));
    document.getElementById('monthSipsin').innerText = getSipsin(p.dStemIdx, STEMS.indexOf(p.mStem));
    document.getElementById('hourSipsin').innerText = p.hStem ? getSipsin(p.dStemIdx, STEMS.indexOf(p.hStem)) : '-';

    document.getElementById('yearUnsung').innerText = getUnsung(p.dStemIdx, BRANCHES.indexOf(p.yBranch));
    document.getElementById('monthUnsung').innerText = getUnsung(p.dStemIdx, BRANCHES.indexOf(p.mBranch));
    document.getElementById('dayUnsung').innerText = getUnsung(p.dStemIdx, BRANCHES.indexOf(p.dBranch));
    document.getElementById('hourUnsung').innerText = p.hBranch ? getUnsung(p.dStemIdx, BRANCHES.indexOf(p.hBranch)) : '-';

    const ybIdx = BRANCHES.indexOf(p.yBranch);
    const dbIdx = BRANCHES.indexOf(p.dBranch);
    const fmt = arr => (!arr || arr.length === 0) ? '-' : arr.map(s => `<span class="sinsal-tag">${s}</span>`).join('<br>');

    document.getElementById('yearSinsal').innerHTML = fmt(getSinsal(ybIdx, dbIdx, ybIdx, p.dStemIdx));
    document.getElementById('monthSinsal').innerHTML = fmt(getSinsal(ybIdx, dbIdx, BRANCHES.indexOf(p.mBranch), p.dStemIdx));
    document.getElementById('daySinsal').innerHTML = fmt(getSinsal(ybIdx, dbIdx, dbIdx, p.dStemIdx));
    document.getElementById('hourSinsal').innerHTML = p.hBranch ? fmt(getSinsal(ybIdx, dbIdx, BRANCHES.indexOf(p.hBranch), p.dStemIdx)) : '-';
  }

  // 🕯️ 출생 시진(또는 시간 모를 때 그날 하루) 안에 절입 시각이 걸치면 안내한다
  function renderTermBoundaryNote(boundary, hourKnown) {
    const el = document.getElementById('termBoundaryNote');
    if (!el) return;
    if (!boundary) { el.style.display = 'none'; el.innerHTML = ''; return; }
    const what = boundary.idx === 1 ? '해(年)와 달(月)' : '달(月)';
    const range = hourKnown ? '네가 고한 시진' : '시진을 모르는 그날 하루';
    el.innerHTML =
      `🕯️ <strong>절입(節入) 경계 경고</strong>: ${range} 안에 <strong>[${boundary.name}]</strong> 절입 시각(${boundary.label})이 걸쳐 있다. ` +
      `태어난 시각이 이보다 앞서느냐 뒤서느냐에 따라 ${what}의 기둥이 바뀐다. 지금 풀이는 ${hourKnown ? '시진의 한가운데' : '그날 정오'}를 기준으로 했으니, 정확한 출생 시각(분)을 확인하거라.`;
    el.style.display = 'block';
  }

  let lastDaeun = null;
  function renderDaeun(birthYear, birthMonth, birthDay, gender, yStemIdx, mStemIdx, mBranchIdx, dStemIdx, pillars) {
    // 대운 계산은 SajuCore.calculateDaeun 하나로 통일 (절기 시각 기반 대운수)
    const { isForward, daeunNum, currentAge, daeunItems, curActiveIndex } =
      calculateDaeun(birthYear, birthMonth, birthDay, gender, yStemIdx, mStemIdx, mBranchIdx, dStemIdx, pillars);

    const dirText = isForward ? "순행(順行)" : "역행(逆行)";
    document.getElementById('daeunBadge').innerText = `${gender === 'M' ? '남성' : '여성'} ${dirText} · ${daeunNum}세 대운 주기`;

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
          <div>${item.sipsin}</div>
          <div style="color:#64748b;">${item.unsung}</div>
        </div>
      </div>
    `).join('');

    const activeItem = (curActiveIndex >= 0) ? daeunItems[curActiveIndex] : daeunItems[2];
    lastDaeun = { item: activeItem, age: currentAge };   // 리포트 요약용
    document.getElementById('daeunComment').innerHTML = 
      `🕯️ <strong>"지금 네놈의 명줄(만 ${currentAge}세)은 [${activeItem.ageStart}세 ${activeItem.stemObj.char}${activeItem.branchObj.char} 대운]의 격랑 한복판에 서 있다."</strong><br>` +
      `이 시기는 <strong>${activeItem.stemObj.name}(${activeItem.sipsin})</strong>과 <strong>${activeItem.branchObj.name}(${activeItem.unsung})</strong>의 기운이 엇갈리며 인생의 판을 통째로 엎어버리는 때다. 머뭇거리다간 기회를 통째로 뜯어먹히니, 이를 악물고 네 칼을 쥐어라.`;
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
      if (counts[e.key] >= 2) strong.push(e.label);
      if (counts[e.key] === 0) weak.push(e.key);
    });

    let comment = `전체 ${total}글자의 명조를 훑어보니, `;
    if (strong.length > 0) comment += `<strong>${strong.join(', ')}</strong>의 기운이 지나치게 치솟아 살(煞)로 변할 조짐이다. `;
    if (weak.length > 0) {
      const weakLabels = weak.map(k => {
        const found = elNames.find(x => x.key === k);
        return found ? found.label : k;
      });
      comment += `반대로 <strong>${weakLabels.join(', ')}</strong>의 맥이 끊겨 밑 빠진 독처럼 생기가 새어나가고 있다!`;
    } else {
      comment += `오행이 상생하고 있으나 자만하는 순간 액살이 덮칠 것이다.`;
    }
    document.getElementById('ohengComment').innerHTML = comment;

    return { strong, weak, counts, total };
  }

  // 📜 결제 후 대외비 영적 전략 포트폴리오 생성
      function updatePaywallContent(dStem, dBranch, oheng, dayStemIdx, dayBranchIdx, dream, job, birthYear, birthMonth, birthDay) {
    const iljuName = `${dStem.char}${dBranch.char}`;
    const nobles = NOBLE_PEOPLE[dayStemIdx] || ['소띠', '양띠'];
    const ps = getPersona(dayStemIdx, dayBranchIdx, oheng);
    const weakKey = ps.weakKey;   // 오행이 모두 있으면 가장 적은 오행 (예전엔 무조건 water)
    const remedy = ELEMENT_REMEDIES[weakKey] || ELEMENT_REMEDIES['water'];
    const enemies = ENEMY_TYPES[ps.dmEl];
    const ruin = RUIN_LOVERS[ps.dmEl];
    const soulmate = SOULMATE_SCENTS[weakKey];
    const _t = new Date();   // 기기 현지 날짜 (toISOString은 UTC라 한국 오전 9시 전엔 어제 날짜가 찍혔다)
    const todayStr = `${_t.getFullYear()}. ${String(_t.getMonth() + 1).padStart(2, '0')}. ${String(_t.getDate()).padStart(2, '0')}`;

    const kpi = updateKpiDashboard(dayStemIdx, dayBranchIdx, oheng, birthYear, birthMonth, birthDay);

    // 누재살 비방·100일 작전을 사주에 맞게 고른다 (예전엔 모두에게 같은 세 줄)
    const grp = sipsinGroupCounts(ps.dmEl, (oheng && oheng.counts) || {});
    const leakKey = ['bi', 'sik', 'gwan', 'in'].reduce((a, k) => (grp[k] > grp[a] ? k : a), 'bi');
    const wealthRemedy = ELEMENT_REMEDIES[ps.wealthEl] || remedy;
    const guard1 = WEALTH_GUARD_BY_COUNT[Math.min(ps.wealthCount, 2)];
    const guard2 = WEALTH_LEAK_BY_GROUP[leakKey];
    const dayBranchEl = (BRANCHES[dayBranchIdx] && BRANCHES[dayBranchIdx].el) || 'water';
    const rule1 = MORNING_RITUAL_BY_WEAK[weakKey] || MORNING_RITUAL_BY_WEAK.water;
    const rule2 = (FOCUS_RULE_BY_DM[ps.dmEl] || FOCUS_RULE_BY_DM.earth)(dream);
    const rule3 = CLEANSE_RULE_BY_DAY_BRANCH[dayBranchEl] || CLEANSE_RULE_BY_DAY_BRANCH.water;

    const unlockedHtml = `
      <!-- 🏛️ 대외비 1급 전문 기밀 보고서 헤더 (사주단자 고서 스타일) -->
      <div class="classified-dossier-box">
        <div class="dossier-top-bar">
          <span class="dossier-badge-secret">極秘 (대외비 1급 기밀)</span>
          <span class="dossier-doc-id">문서 식별 번호: 辟邪-${Y_R0}-天命-8821號</span>
        </div>
        <div class="dossier-title-group">
          <div class="dossier-org-title">壁 邪 神 犬 · 終 身 天 命 戰 略 報 告 書</div>
          <div class="dossier-sub-title">1998년 겨울 강원도 영월 산자락 외딴 흙집 지박령이 네 사주만 맡아 쓴 인생 돌파 비방록</div>
        </div>
        <div class="dossier-info-table">
          <div class="dossier-info-cell">
            <span class="dossier-label">수신 (受信)</span>
            <span class="dossier-val">${iljuName}日柱 (${dStem.hanja}${dBranch.hanja}) 本元</span>
          </div>
          <div class="dossier-info-cell">
            <span class="dossier-label">발신 (發信)</span>
            <span class="dossier-val">영월 지박령 벽사신견 (辟邪神犬)</span>
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
          <span style="font-size:15px; font-weight:800; color:#111827;">📊 영적 역량 & 위험 지표 진단 (KPI Analysis)</span>
          <span id="kpiAlertBadge" style="font-size:12px; font-weight:800;">${kpi.alertHtml}</span>
        </div>
        <div class="kpi-grid">
          <div class="kpi-row">
            <div class="kpi-label-bar"><span style="font-size:14px; font-weight:700; color:#111827;">타고난 천명 그릇 (잠재 역량)</span><span id="kpiPotentialScore" style="font-size:14px; font-weight:800; color:${kpi.potColor};">${kpi.potScore}점 ${kpi.potGrade}</span></div>
            <div class="kpi-bar-bg"><div class="kpi-bar-fill" id="kpiPotentialBar" style="width:${kpi.potScore}%; background:${kpi.potColor};"></div></div>
          </div>
          <div class="kpi-row">
            <div class="kpi-label-bar"><span style="font-size:14px; font-weight:700; color:#111827;">${Y_R1} 대운 폭발 지수 (골든타임)</span><span id="kpiTimingScore" style="font-size:14px; font-weight:800; color:${kpi.timColor};">${kpi.timScore}점 ${kpi.timGrade}</span></div>
            <div class="kpi-bar-bg"><div class="kpi-bar-fill" id="kpiTimingBar" style="width:${kpi.timScore}%; background:${kpi.timColor};"></div></div>
          </div>
          <div class="kpi-row">
            <div class="kpi-label-bar"><span style="font-size:14px; font-weight:700; color:#111827;">재물 방어력 (누재살 漏財煞)</span><span id="kpiWealthScore" style="font-size:14px; font-weight:800; color:${kpi.wColor};">${kpi.wScore}점 ${kpi.wGrade}</span></div>
            <div class="kpi-bar-bg"><div class="kpi-bar-fill" id="kpiWealthBar" style="width:${kpi.wScore}%; background:${kpi.wColor};"></div></div>
          </div>
          <div class="kpi-row">
            <div class="kpi-label-bar"><span style="font-size:14px; font-weight:700; color:#111827;">주변 인연 정화도 (악연 감별)</span><span id="kpiKarmaScore" style="font-size:14px; font-weight:800; color:${kpi.kColor};">${kpi.kScore}점 ${kpi.kGrade}</span></div>
            <div class="kpi-bar-bg"><div class="kpi-bar-fill" id="kpiKarmaBar" style="width:${kpi.kScore}%; background:${kpi.kColor};"></div></div>
          </div>
        </div>
      </div>

      <!-- CHAPTER 01:<!-- CHAPTER 01: 영적 악연 차단 & 방어 매뉴얼 -->
      <div class="portfolio-section-card">
        <span class="portfolio-section-badge">CHAPTER 01 · 대외비 1급</span>
        <div class="portfolio-section-title">🗡️ 기(氣) 빨아먹는 악연 색출 및 즉각 처단 매뉴얼</div>
        <div class="portfolio-text">
          네가 지금까지 [<strong class="impact-gold">${dream}</strong>]${josa(dream, '을')} 향해 달리면서 유독 피로하고 지쳤던 이유는 능력이 부족해서가 아니다.<br><br>
          너를 둘러싼 인간관계 중에 네 에너지와 통장을 갉아먹는 <strong class="impact-red">[기생형 흡기귀]</strong>가 붙어 있었기 때문이다.<br>
          이 자들은 네가 힘들 땐 곁에 없다가, 네게 뭔가 이득이 생기거나 성과가 보이면 귀신같이 냄새를 맡고 나타난다.
        </div>
        <div class="portfolio-highlight">
          <strong class="impact-red" style="font-size:15.5px; display:block; margin-bottom:8px;">⚠️ 즉시 손절해야 할 3대 악연 유형:</strong>
          <span style="font-size:13px; color:#6b7280; display:block; margin-bottom:4px;">— ${dStem.char}${EL_KO[ps.dmEl]} 일간인 네게 유독 들러붙는 유형</span>
          1. ${enemies[0]}<br>
          2. ${enemies[1]}<br>
          3. ${enemies[2]}<br><br>
          💡 <strong class="impact-red">처단 비방</strong>: 변명할 기회를 주지 마라. 서서히 연락 빈도를 줄이고 카톡 답장을 3시간 이상 늦추며 영적 연결고리를 완전히 끊어내라.
        </div>
      </div>

      <!-- CHAPTER 02: 인연과 사랑의 체취 감별 (사랑의 냄새 대폭 확대) -->
      <div class="portfolio-section-card">
        <span class="portfolio-section-badge">CHAPTER 02 · 후각 투시록</span>
        <div class="portfolio-section-title">🕯️ 인연과 사랑의 체취 감별 (벽사신견 후각 투시록)</div>
        <div class="portfolio-text">
          벽사신견의 코는 거짓말을 하지 않는다. 사람이 입으로는 온갖 달콤한 사랑을 맹세해도, 그 영혼에서 뿜어져 나오는 냄새는 숨길 수 없는 법이다.<br><br>
          ${isYoung() ? `네 앞에 다가올 인연들의 냄새를 미리 맡아 두어라. <strong>처음엔 눈이 멀 것처럼 설레지만 결국 네 가슴에 생채기를 남기고 떠날 자들...</strong> 그 냄새를 알아 두면 비켜 갈 수 있다.` : `너를 스쳐 지나간 인연들을 돌아보아라. <strong>처음엔 눈이 멀 것처럼 설레었지만 결국 네 가슴에 지독한 생채기를 남기고 떠난 자들...</strong> 그들의 냄새를 복기해보아라.`}
        </div>

        <div class="portfolio-highlight" style="border-left: 4.5px solid #b91c1c; background: #fff8f8;">
          <strong class="impact-red" style="font-size:15.5px; display:block; margin-bottom:6px;">🩸 1. 피해야 할 파멸의 연인: ${ruin.title}</strong>
          • <strong>영적 체취</strong>: ${ruin.scent}<br>
          • <strong>소름 돋는 특징</strong>: ${ruin.trait}<br>
          • <strong>경고</strong>: 이 자를 깊은 연인으로 들이면, 네 사주 원국의 명예운과 금전운이 3년간 송두리째 잿더미가 된다. 지금 그런 냄새가 나는 자가 주변에 있다면 뒤도 돌아보지 말고 뛰어 도망쳐라!
        </div>

        <div class="portfolio-highlight" style="border-left: 4.5px solid #15803d; background: #f6fdf7; margin-top:12px;">
          <strong class="impact-green" style="font-size:15.5px; display:block; margin-bottom:6px;">🌿 2. 너를 살려낼 천생연분: ${soulmate.title}</strong>
          • <strong>영적 체취</strong>: ${soulmate.scent}<br>
          • <strong>소름 돋는 특징</strong>: 네 결핍된 오행(${EL_KO[weakKey]})을 자신의 온기로 묵묵히 채워주는 [<strong class="impact-green">${nobles[0]}</strong>]의 인연이다. 네가 인생의 벼랑 끝에 몰려도 손가락질하지 않고 묵묵히 네 등을 받쳐줄 사람이며, 이 사람을 맞이하는 순간 막혀 있던 네 재물의 수문이 함께 터진다.<br>
          • <strong>도래 시기</strong>: <strong class="impact-gold">${Y_R0}년 하반기~${Y_R1}년 상반기</strong>, 일이나 학업으로 얽힌 공적인 자리 또는 조용한 이동 중에 우연처럼 마주치게 된다.
        </div>
      </div>

      <!-- CHAPTER 03: 누재살 방어 및 재물 축적 비방 -->
      <div class="portfolio-section-card">
        <span class="portfolio-section-badge">CHAPTER 03 · 재물 결속 비기</span>
        <div class="portfolio-section-title">💰 피 같은 돈이 줄줄 새는 누재살(漏財煞) 봉인법</div>
        <div class="portfolio-text">
          네 명식에는 돈을 버는 재능은 있으나, 담아두는 그릇의 밑바닥에 실금이 가 있어 물이 줄줄 새어나가는 <strong class="impact-red">누재살(漏財煞)</strong>의 기운이 감돌고 있다.<br><br>
          "돈이 좀 모였다 싶으면 꼭 엉뚱한 곳에서 목돈이 깨지는 상황", 기억나지 않느냐? 병원비, 가족이나 친구의 부탁, 충동적인 지출 등으로 공든 탑이 무너지는 패턴이다.<br><br>
          ${wealthDiagnosis(ps)}
        </div>
        <div class="portfolio-highlight">
          <strong class="impact-gold" style="font-size:15.5px; display:block; margin-bottom:8px;">🔒 누재살 방어 3대 황금 비방:</strong>
          <span class="guard-basis">— 재성 ${ps.wealthCount}글자 · 가장 짙은 기운 ${GROUP_KO[leakKey]} · 재물 오행 ${EL_KO[ps.wealthEl]} · 모자란 오행 ${EL_KO[weakKey]}</span>
          ${guard1}<br>
          ${guard2}<br>
          3. <strong>재물 방위 풍수</strong>: 잠잘 때 머리를 재물 오행(${EL_KO[ps.wealthEl]})의 방위인 [<strong class="impact-gold">${wealthRemedy.dir}</strong>] 방향으로 두고, 작업 책상 위에 모자란 기운을 채우는 [<strong class="impact-gold">${remedy.item}</strong>]${josa(remedy.item, '을')} 두어 재물의 살을 튕겨내라.
        </div>
      </div>

      <!-- CHAPTER 04: 2026~2028년 대운 3개년 로드맵 -->
      <div class="portfolio-section-card">
        <span class="portfolio-section-badge">CHAPTER 04 · 시기 포획</span>
        <div class="portfolio-section-title">🌊 ${Y_R0}~${Y_R2}년 인생 역전 대운 3개년 로드맵</div>
        <div class="portfolio-text">
          인생의 모든 성공은 실력 30%와 타이밍 70%로 결정된다. 네 사주에서 ${Y_R0}년부터 ${Y_R2}년까지는 10년에 한 번 올까 말까 한 격변의 파도가 밀려오는 시기다.
        </div>
        <div class="timeline-box">
          <div class="timeline-step">
            <div class="timeline-dot"></div>
            <div class="timeline-title">${Y_R0}년 (${yearGanji(Y_R0)}년 ${yearGanji(Y_R0,true)}) · 불의 정화와 준비기</div>
            <div class="timeline-desc">너를 옭아매던 구시대의 썩은 인연과 미련을 태워 없애는 해다. [<strong class="impact-gold">${dream}</strong>]${josa(dream, '을')} 향한 핵심 기술과 역량을 칼처럼 벼려내라. 상반기엔 조용히 내실을 다지고 하반기부터 판을 벌려라.</div>
            <div class="timeline-desc timeline-relation">${yearRelationText(Y_R0, ps)}</div>
          </div>
          <div class="timeline-step">
            <div class="timeline-dot"></div>
            <div class="timeline-title">${Y_R1}년 (${yearGanji(Y_R1)}년 ${yearGanji(Y_R1,true)}) · 인생 최고의 폭발적 골든타임 🎯</div>
            <div class="timeline-desc">네 인생의 대운이 정점에 달하는 시기다. 네가 준비한 결과물이 세상의 인정을 받고, 귀인의 조력으로 통장에 목돈이 꽂히며 신분이 급상승한다. 이때 주저하지 말고 인생의 승부수를 던져라!</div>
            <div class="timeline-desc timeline-relation">${yearRelationText(Y_R1, ps)}</div>
          </div>
          <div class="timeline-step">
            <div class="timeline-dot"></div>
            <div class="timeline-title">${Y_R2}년 (${yearGanji(Y_R2)}년 ${yearGanji(Y_R2,true)}) · 결실 수확 및 시스템 안착</div>
            <div class="timeline-desc">폭발적인 성공을 바탕으로 단단한 성벽을 쌓는 해다. 흔들리지 않는 자산 파이프라인을 구축하고, 너를 따르는 세력을 형성하여 평생의 부(富)를 안정화하라.</div>
            <div class="timeline-desc timeline-relation">${yearRelationText(Y_R2, ps)}</div>
          </div>
        </div>
      </div>

      <!-- CHAPTER 05: 100일 작전 행동 수칙 -->
      <div class="portfolio-section-card">
        <span class="portfolio-section-badge">CHAPTER 05 · 실전 결행</span>
        <div class="portfolio-section-title">⚡ 내일부터 당장 결행할 [천명 100일 작전]</div>
        <div class="portfolio-text">
          운명은 가만히 앉아 있는 자에게 찾아오지 않는다. 지박령의 기운을 받아 내일부터 당장 실천할 3가지 행동 수칙이다:
        </div>
        <div class="portfolio-highlight">
          ${rule1}<br>
          ${rule2}<br>
          ${rule3}<br><br>
          ➕ <strong class="impact-gold">네 명식에만 내리는 맞춤 수칙 · ${EL_KO[weakKey]} 기운 보충</strong>: 네 원국에 가장 모자란 기운이다. <strong>${remedy.color}</strong> 계열의 소지품을 몸에 지니고, <strong>${remedy.food}</strong>${josa(remedy.food, '을')} 가까이하며, 중요한 결정은 <strong>${remedy.dir}</strong>을 바라보고 내리거라. 행운의 숫자는 <strong>${remedy.num}</strong>이다.
        </div>
      </div>

      <!-- SECTION 06: 궁서체 정통 괴황지 수호부적 쇼케이스 & 원형 다운로드 -->
      <div class="talisman-section-card">
        <span class="portfolio-section-badge">SECTION 06 · 종신 수호 비기</span>
        <div class="portfolio-section-title">🧧 《벽사신견 액막이 개운부 (辟邪神犬 開運符)》</div>
        
        <!-- 부적 해설 및 소장 비방 박스 (다운로드 전 상세 설명) -->
        <div class="talisman-info-box">
          <div class="talisman-info-item">
            <strong>📜 부적의 유래와 원리</strong>
            <p>
              동양 오행에서 삿된 음기(陰氣)와 잡귀를 누르는 <strong>괴황지(槐黃紙, 황금 한지)</strong>에 
              강력한 양기(陽氣)를 뿜어내는 <strong>경면주사(鏡面朱砂)</strong>의 붉은 붓글씨로 새겨진 정통 벽사부(辟邪符)입니다. 
              1998년 겨울부터 대문을 지킨 충견의 영험한 원념이 깃들어 있습니다.
            </p>
          </div>

          <div class="talisman-info-item">
            <strong>🛡️ 3대 영적 수호 효능</strong>
            <ul>
              <li><strong>1. 흡기귀(吸氣鬼) 및 악연 차단</strong>: 내 기를 빨아먹고 성과를 가로채려는 자들의 살기를 튕겨냅니다.</li>
              <li><strong>2. 누재살(漏財煞) 방어</strong>: 피 같은 돈이 줄줄 새어나가지 않도록 재물의 문을 단단히 걸어 잠급니다.</li>
              <li><strong>3. 천명([${dream}]) 개운</strong>: ${Y_R0}~${Y_R2}년 대운 골든타임에 폭발적 기회를 온전히 틀어쥐도록 기운을 틔웁니다.</li>
            </ul>
          </div>

          <div class="talisman-info-item">
            <strong>📱 소장 및 사용 비방</strong>
            <p>
              • 다운로드한 부적 이미지를 <strong>스마트폰 잠금화면이나 배경화면</strong>으로 설정해 두면 매일 첫 순간 액살을 털어냅니다.<br>
              • 출력하여 지갑 속이나 작업 공간(모니터 뒤편, 책상 서랍)에 넣어두셔도 좋습니다.<br>
              • 마음이 흔들리거나 중요한 결정을 내릴 때 꺼내보며 지박령의 축문을 나지막이 읊으십시오.<br>
              • <strong>네 명식 맞춤</strong>: 네 원국에 모자란 <strong>${EL_KO[weakKey]}</strong> 기운을 채우려면, 출력한 부적을 <strong>${remedy.dir}</strong> 벽에 붙이거나 <strong>${remedy.color}</strong> 계열 지갑에 넣어 지니십시오. 효험이 배가됩니다.
            </p>
          </div>
        </div>

        <!-- 부적 실물 미리보기 프레임 -->
        <div class="talisman-preview-frame">
          <canvas class="talisman-canvas" id="talismanCanvas" width="900" height="1500" role="img" aria-label="${iljuName}일주 수호 부적"></canvas>
        </div>

        <button class="btn-talisman-download" onclick="downloadTalismanImage()">
          🧧 궁서체 정통 수호부적 원형 다운로드 (갤러리 저장) 🐾
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
    }
  function closePaymentModal() { ['paymentModal', 'productModal'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; }); }

    function showToast(text) {
    const t = document.getElementById('toastMsg');
    if (t) {
      t.innerText = text;
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
    copyText(url.href, '🔗 사주 명식 공유 링크가 복사되었습니다!');
  }

  /** 클립보드 복사. 안 되는 환경이면 직접 복사할 수 있게 보여준다 */
  function copyText(text, okMessage) {
    const fallback = () => { window.prompt('아래 내용을 길게 눌러 복사하거라', text); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => showToast(okMessage), fallback);
    } else {
      fallback();
    }
  }

  function copySummaryText() {
    if (!currentSajuData) {
      showToast('사주를 먼저 분석해야 요약문을 복사할 수 있다.');
      return;
    }
    const { y, m, d, hourVal, genderVal, dStem, dBranch, yStem, yBranch, mStem, mBranch, hStem, hBranch, userDream, userJob } = currentSajuData;
    const iljuName = `${dStem.char}${dBranch.char}`;
    const timeText = hBranch ? `${hBranch.char}시(${hBranch.hanja}時)` : '시간 미선택';
    const summaryText = `[벽사신견(辟邪神犬) 사주 요약 리포트]\n` +
      `------------------------------------\n` +
      `🐾 의뢰인 명식:\n` +
      `• 생년월일: ${y}년 ${m}월 ${d}일 (${genderVal === 'M' ? '남성' : '여성'})\n` +
      `• 출생시: ${timeText}\n` +
      `• 사주 본원: ${iljuName}日柱 (${dStem.name}${dBranch.name})\n` +
      `• 천명 목표: ${userDream}\n` +
      `• 현재 신분: ${userJob}\n\n` +
      `🔮 지박령의 3대 핵심 액막이 비방:\n` +
      `1. 내 기(氣)를 갉아먹는 흡기귀 악연 즉각 차단\n` +
      `2. 밑 빠진 독 같은 누재살(漏財煞) 재물 방어\n` +
      `3. ${Y_R0}~${Y_R2}년 대운 골든타임 도약\n` +
      `------------------------------------\n` +
      `강원도 영월 산자락 외딴 흙집 지박령 벽사신견`;

    copyText(summaryText, '📋 사주 핵심 요약문이 클립보드에 복사되었습니다! (카톡/메모장 공유 가능) 🐾');
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
    wish:    { name: '벽사신견 소원 부적',         price: 1900,       label: '소원 부적' },
    bundle:  { name: '벽사신견 전부 묶음 보따리',  price: 10900,      label: '전부 묶음 보따리' }
  };
  // 전부 묶음: 한 사람(생년월일) 기준으로 아래가 모두 열린다. 따로 사면 합계(BUNDLE_LIST_TOTAL)를 그대로 보여 준다 (실제 가격 합)
  const WISH_KINDS = 5;
  const BUNDLE_ITEMS = [
    { id: 'report',  text: '천명 리포트 (6개 장 + 맞춤 개운부)', price: SALE.price },
    { id: 'newyear', text: '신년운세 (열두 달 풀이)',            price: 4900 },
    { id: 'wish',    text: `소원 부적 ${WISH_KINDS}종 전부 (재물·연애·합격·건강·액막이)`, price: 1900 * WISH_KINDS },
    { id: 'compat',  text: '궁합 상세 리포트 (내가 들어간 궁합이면 상대 제한 없음)', price: 3900 }
  ];
  const BUNDLE_LIST_TOTAL = BUNDLE_ITEMS.reduce((n, it) => n + it.price, 0);
  // 공유 할인: 사이트를 공유한 사람·공유 링크로 들어온 사람에게 유료 풀이 1건 1,000원 할인 (이 기기, 7일)
  const SHARE_DISCOUNT = { amount: 1000, days: 7 };
  const COUPON_KEY = 'byeoksa.coupon.v1';
  // 할인 코드: 인스타·카톡 홍보용. 코드를 넣으면 공유 할인과 같은 1,000원 할인 1건 (서버 확인도 같은 금액만 인정)
  //   새 코드는 여기 대문자로 추가한다. 예) 'OPEN2026': '오픈 기념 코드'
  const PROMO_CODES = { 'BAEKGU': '백구 할인 코드' };
  function applyPromoCode(raw) {
    const code = String(raw || '').trim().toUpperCase();
    if (!code) return;
    if (!PROMO_CODES[code]) { showToast('그런 코드는 냄새가 안 난다. 다시 확인하거라.'); return; }
    if (activeCoupon()) { showToast('이미 할인이 걸려 있다. 할인은 한 번에 한 건이다.'); return; }
    if (grantCoupon('code:' + code)) { showToast(`🎁 ${PROMO_CODES[code]} 적용! 유료 풀이 1건 ${won(SHARE_DISCOUNT.amount)}원 할인.`); renderPaymentMode(); }
    else showToast('이 기기에서는 할인을 이미 한 번 썼다.');
  }
  /** 결제창 안의 할인 코드 칸 */
  function promoRowHtml() {
    return `<div class="promo-row"><input type="text" class="promo-input" maxlength="20" placeholder="할인 코드 (있으면)" aria-label="할인 코드" autocapitalize="characters"><button type="button" class="promo-apply" onclick="applyPromoCode(this.previousElementSibling.value); this.closest('.modal-overlay').dispatchEvent(new CustomEvent('promo'))">적용</button></div>`;
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
   *  대상 키 모양 — 리포트: 사람키 / 신년운세: 사람키.해 / 소원 부적: 사람키.소원 / 묶음: 사람키 */
  function isPaidFor(productId, subjectKey) {
    if (rawPaid(productId, subjectKey)) return true;
    if (productId === 'report' || productId === 'newyear' || productId === 'wish') return rawPaid('bundle', String(subjectKey).split('.')[0]);
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
  }

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
  async function purchase(productId, subjectKey, data, btn) {
    const hooks = PRODUCT_HOOKS[productId] || {};
    const pr = priceFor(productId);
    if (PAYMENT.mode !== 'portone') {
      markPaidFor(productId, subjectKey, 'test');
      if (pr.coupon) consumeCoupon();
      closePaymentModal();
      if (hooks.onPaid) hooks.onPaid(data);
      return true;
    }
    if (!PAYMENT.storeId || !PAYMENT.channelKey) { showToast('결제 설정(상점 아이디·채널 키)이 비어 있다.'); return false; }
    if (btn) btn.disabled = true;
    try {
      await loadPortOne();
      const paymentId = `byeoksa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      savePending({ paymentId, productId, subjectKey, data });
      const res = await window.PortOne.requestPayment({
        storeId: PAYMENT.storeId,
        channelKey: PAYMENT.channelKey,
        paymentId,
        orderName: PRODUCTS[productId].name,
        totalAmount: pr.final,
        currency: 'KRW',
        payMethod: PAYMENT.payMethod,
        customData: JSON.stringify({ product: productId, coupon: !!pr.coupon }),
        redirectUrl: siteHomeUrl() + '?pay=return'   // 휴대폰은 결제 페이지에 다녀온 뒤 이 주소로 돌아온다
      });
      if (!res) return false;   // 결제 페이지로 넘어감 → 돌아오면 resumePaymentFromRedirect에서 마무리
      return await finishPayment(res.paymentId || paymentId, res.code, res.message);
    } catch (e) {
      showToast('결제창을 열지 못했다. 잠시 후 다시 시도하거라.');
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
      showToast(`결제가 완료되지 않았다. ${message || ''}`.trim());
      return false;
    }
    if (!pending || pending.paymentId !== paymentId) { showToast('결제 정보를 찾지 못했다. 결제가 됐다면 문의해 주거라.'); return false; }
    if (PAYMENT.verifyUrl) {
      let ok = false;
      try {
        const r = await fetch(PAYMENT.verifyUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentId }) });
        ok = r.ok && (await r.json()).status === 'PAID';
      } catch (e) { ok = false; }
      if (!ok) { showToast(`결제 확인에 실패했다. 결제가 됐다면 ${CONTACT_EMAIL}로 결제 번호 ${paymentId}를 보내 주거라.`); return false; }
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
    if (!pending || pending.paymentId !== pid) { showToast('결제 정보를 찾지 못했다. 결제가 됐다면 문의해 주거라.'); return true; }
    const intro = document.getElementById('introGateModal'); if (intro) intro.style.display = 'none';
    const hooks = PRODUCT_HOOKS[pending.productId] || {};
    if (hooks.resume) hooks.resume(pending.data);
    finishPayment(pid, params.get('code'), params.get('message'));
    return true;
  }

  /** 천명 리포트 결제창 버튼 */
  function startPayment() {
    if (!currentSajuData) return;
    const pick = ({ y, m, d, hourVal, genderVal, userJob, userMajor, userHobby, userDream }) => ({ y, m, d, hourVal, genderVal, userJob, userMajor, userHobby, userDream });
    return purchase('report', sajuKey(currentSajuData), pick(currentSajuData), document.getElementById('payButton'));
  }
  registerProduct('report', {
    onPaid: () => unlockContent(),
    resume: sj => {
      const set = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined && v !== null) el.value = v; };
      set('year', sj.y); set('month', sj.m); set('day', sj.d); set('hourSelect', String(sj.hourVal)); set('gender', sj.genderVal);
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
    showToast('🕯️ 액막이 복채 정성 접수 완료! 6단계 퇴마 포트폴리오 전체 해제 🐾');
  }

  function openReport() {
    renderReportSummary();
    showView('viewReport');
    setupReportBook();
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
    document.getElementById('bookHint').textContent = i === last ? '마지막 장이다' : '옆으로 밀어도 넘어간다';
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
    const y = book.getBoundingClientRect().top + window.scrollY - bar.offsetHeight - 14;
    window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
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
  window.addEventListener('beforeprint', () => { document.querySelectorAll('.book-off').forEach(el => el.classList.remove('book-off')); });
  window.addEventListener('afterprint', () => { if (BOOK.pages.length) showBookPage(BOOK.idx); });

  /** 리포트 결제창의 '전부 묶음' 버튼 */
  function openBundleForReport() {
    if (!currentSajuData || !window.BYEOKSA_SHOP) return;
    const sd = currentSajuData;
    const pick = ({ y, m, d, hourVal, genderVal, userJob, userMajor, userHobby, userDream }) => ({ y, m, d, hourVal, genderVal, userJob, userMajor, userHobby, userDream });
    closePaymentModal();
    window.BYEOKSA_SHOP.openBundle({ y: sd.y, m: sd.m, d: sd.d, hour: sd.hourVal, gender: sd.genderVal }, 'report', pick(sd));
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
    const cell = (stem, branch, label) => `
      <div class="rs-pillar">
        <span class="rs-pillar-label">${label}</span>
        <span class="rs-char ${stem ? stem.el : ''}">${stem ? stem.hanja : '?'}</span>
        <span class="rs-char ${branch ? branch.el : ''}">${branch ? branch.hanja : '?'}</span>
        <span class="rs-pillar-ko">${stem && branch ? stem.char + branch.char : '모름'}</span>
      </div>`;
    const counts = (sd.ohengResult && sd.ohengResult.counts) || {};
    const ps = getPersona(sd.dStemIdx, sd.dBranchIdx, sd.ohengResult);
    const dn = lastDaeun && lastDaeun.item;
    const daeunLine = dn
      ? `${dn.ageStart}세부터 ${dn.stemObj.char}${dn.branchObj.char} 대운 (만 ${lastDaeun.age}세) · ${dn.sipsin} · ${dn.unsung}`
      : txt('daeunBadge');
    box.innerHTML = `
      <div class="feature-card rs-card">
        <h3 class="feature-card-title">먼저 맡은 냄새 · 무료 풀이 요약</h3>
        <p class="rs-meta">${sd.y}년 ${sd.m}월 ${sd.d}일 ${sd.hBranch ? sd.hBranch.char + '시' : '(시간 모름)'} · ${sd.genderVal === 'M' ? '남성' : '여성'} · <strong>${sd.dStem.char}${sd.dBranch.char}일주</strong></p>
        <div class="rs-pillars">
          ${cell(sd.hStem, sd.hBranch, '시')}${cell(sd.dStem, sd.dBranch, '일')}${cell(sd.mStem, sd.mBranch, '월')}${cell(sd.yStem, sd.yBranch, '년')}
        </div>
        <ul class="rs-oheng" aria-label="오행 분포">
          ${EL_KEYS.map(k => `<li class="rs-el ${k}${k === ps.weakKey ? ' is-weak' : ''}"><span>${EL_KO[k]}</span><strong>${counts[k] || 0}</strong></li>`).join('')}
        </ul>
        <dl class="rs-list">
          <dt>일주 본성</dt><dd>${esc(txt('animalTitle'))}</dd>
          <dt>꿈과 팔자</dt><dd>${esc(txt('fitScore'))} · ${esc(sd.userDream)}</dd>
          <dt>모자란 기운</dt><dd>${EL_KO[ps.weakKey]} — 이 리포트의 맞춤 비방은 이 기운을 채우는 쪽으로 짜였다</dd>
          <dt>지금 대운</dt><dd>${esc(daeunLine || '대운 정보 없음')}</dd>
          <dt>심리 투시</dt><dd>${esc(txt('mindBadge'))} · ${esc(firstSentence(txt('mindItem2').replace(/^⚠️[^\n]*\n?/, '')))}</dd>
          <dt>연애의 냄새</dt><dd>${esc(firstSentence(txt('sniffLoveText').replace(/^"/, '')))}</dd>
          <dt>재물의 냄새</dt><dd>${esc(firstSentence(txt('sniffWealthText').replace(/^"/, '')))}</dd>
          <dt>일의 냄새</dt><dd>${esc(firstSentence(txt('sniffCareerText').replace(/^"/, '')))}</dd>
        </dl>
      </div>`;
  }

  function saveTalismanNotice() {
    showToast('📸 스마트폰 화면 캡처로 저장하여 배경화면으로 지녀라 🐾');
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
      showToast('사주를 먼저 분석해야 맞춤 부적을 내릴 수 있다.');
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
      showToast('부적 그림을 불러오지 못했다. 잠시 뒤 다시 눌러 보거라.');
      return;
    }

    const fileName = `벽사신견_궁서체_개운부_${iljuName}.png`;
    let blob = null;
    try {
      blob = await new Promise(res => wall.toBlob(res, 'image/png'));
    } catch (e) { blob = null; }
    if (!blob) { showToast('이 브라우저에서는 저장이 막혔다. 부적 그림을 길게 눌러 저장하거라.'); return; }

    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: '벽사신견 개운부' }); return; } catch (e) { /* 공유 취소 시 내려받기로 */ }
    }
    const link = document.createElement('a');
    link.download = fileName;
    link.href = URL.createObjectURL(blob);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    showToast('🎉 궁서체 정통 괴황지 수호부적이 갤러리에 저장되었습니다! 🐾');
  }


  function _oldAcceptDestiny() {
    const modal = document.getElementById('introGateModal');
    modal.style.opacity = '0';
    modal.style.visibility = 'hidden';
    setTimeout(() => { modal.style.display = 'none'; }, 350);
    showToast('🕯️ 운명의 문턱을 넘었다. 생년월일을 대거라.');
    
    // 생년월일 입력란으로 스크롤 및 포커스
    const yearInput = document.getElementById('year');
    if (yearInput) {
      yearInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => { yearInput.focus(); }, 400);
    }
  }

  function refuseDestiny() {
    document.getElementById('introBtnRow').style.display = 'none';
    document.getElementById('introRefusalBox').style.display = 'flex';
  }

  window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    if (resumePaymentFromRedirect(params)) return;
    const toHelp = window.location.hash === '#help';   // 약관 페이지 등에서 고객센터로 바로 들어옴
    if (!params.get('y') && !toHelp) playOpening();
    if (params.get('from') === 'share') {   // 친구가 공유한 링크로 들어옴 → 할인 1건
      try { history.replaceState(null, '', window.location.pathname); } catch (e) { /* 무시 */ }
      if (grantCoupon('invite')) setTimeout(() => showToast(`🎁 친구가 보낸 문으로 들어왔구나. 유료 풀이 1건 ${won(SHARE_DISCOUNT.amount)}원 할인을 걸어 두었다.`), 600);
    }
    if (params.get('y') && params.get('m') && params.get('d')) {
      document.getElementById('year').value = params.get('y');
      document.getElementById('month').value = params.get('m');
      document.getElementById('day').value = params.get('d');
      if (params.get('h')) document.getElementById('hourSelect').value = params.get('h');
      if (params.get('g')) document.getElementById('gender').value = params.get('g');
      if (params.get('job')) document.getElementById('userJob').value = params.get('job');
      if (params.get('major')) document.getElementById('userMajor').value = params.get('major');
      if (params.get('hobby')) document.getElementById('userHobby').value = params.get('hobby');
      if (params.get('dream')) document.getElementById('userDream').value = params.get('dream');
      submitAndGoToResult();
    }
    if (toHelp && typeof openFeature === 'function') {
      const intro = document.getElementById('introGateModal'); if (intro) intro.style.display = 'none';
      openFeature('help');
    }
  });


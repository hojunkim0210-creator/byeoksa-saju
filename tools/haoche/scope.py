# -*- coding: utf-8 -*-
"""업데이트 41(첫인상 화면) 하오체 바꾸기 — 범위 정의와 문장 끝 후보 뽑기.
쓰는 법: python3 -I scope.py <저장소> list   → 문장 끝 낱말 목록(자동 제안 포함)을 tokens.tsv 로
"""
import re, sys, os, collections, json

REPO = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))

FREE_TABLES = ['BONE_LINE', 'ENEMY_EXTRA', 'ENEMY_YIN', 'FIT_HOBBY', 'FIT_OPEN', 'FIT_OPEN_UNKNOWN', 'FIT_REASON_UNKNOWN', 'FIT_SHOUT',
               'FIT_STAMINA', 'FIT_WEAPON', 'GHOST_INTRO', 'GHOST_RETREAT', 'GHOST_SEEN', 'GHOST_STEM', 'GHOST_WARN', 'GHOST_WHERE', 'HOUR_LINE',
               'MIND_OPEN', 'MIND_YIN', 'MIND_YANG', 'NIGHT_CLOSE', 'NIGHT_FEAR', 'NIGHT_FEAR_UNKNOWN', 'NIGHT_MASK', 'NIGHT_OPEN', 'NIGHT_SILENCE',
               'NIGHT_TRAP_KIND', 'NIGHT_TRAP_ZERO', 'PARASITE', 'SEASON', 'SNIFF_CAREER', 'SNIFF_LOVE', 'SNIFF_LOVE2', 'SNIFF_WEALTH', 'SOUL_TAIL',
               'UNSUNG_LINE', 'DAEUN_NOW', 'RUIN_YIN']


def read(rel):
    return open(os.path.join(REPO, rel), encoding='utf-8').read().split('\n')


def phrases_ranges(lines):
    """phrases.js 의 표 시작 줄(P.NAME = ...)을 찾아 무료 결과용 표의 줄 범위를 돌려준다"""
    starts = []
    for i, l in enumerate(lines):
        m = re.match(r'\s*P\.([A-Z_][A-Z0-9_]*)\s*=', l)
        if m: starts.append((i, m.group(1)))
    ranges = []
    for k, (i, name) in enumerate(starts):
        end = starts[k + 1][0] - 1 if k + 1 < len(starts) else len(lines) - 1
        # 표 사이에 낀 주석·도우미는 다음 표 시작 전까지 — 주석 줄은 아래에서 건너뛴다
        if name in FREE_TABLES: ranges.append((i, end, name))
    return ranges


STAGE = os.environ.get('HAOCHE_STAGE', '43')   # 41 = 첫인상 화면, 42 = 궁합·운세·패·묻기·공유 카드·유료 상품 맛보기


def _between(lines, start_pat, end_pat):
    """start_pat 이 든 줄부터 end_pat 이 든 줄 바로 앞까지 (0부터 센 번호)"""
    a = next(i for i, l in enumerate(lines) if start_pat in l)
    b = next(i for i, l in enumerate(lines) if i > a and end_pat in l)
    return set(range(a, b))


def in_scope():
    """(파일, 줄 번호(0부터)) → 범위 안인지. 주석 줄·보관 문장(ORIG)·옛이야기 서술은 skip_line 에서 뺀다"""
    scope = {}
    if STAGE == '41':
        app = read('site/js/app.js')
        # 1~1135(도우미·결과 카드), 1241~1326(등 뒤 귀신 설명표), 1327~1592(악연·후각·표·대운·오행), 1906~2444(알림·결제 화면 문구), 2590~끝(첫 화면 진입 알림) — 41 때 줄 번호
        keep = set()
        for a, b in [(1, 1135), (1241, 1326), (1327, 1592), (1906, 2444), (2590, len(app))]:
            keep.update(range(a - 1, b))
        scope['site/js/app.js'] = keep
        ph = read('site/js/phrases.js')
        s = set()
        for a, b, name in phrases_ranges(ph): s.update(range(a, b + 1))
        for i, l in enumerate(ph):                      # 무료 결과 표가 쓰는 도우미 문장(past: '불과 1~2년 전쯤…에 네게')
            if re.match(r'\s*const past = ', l): s.add(i)
        scope['site/js/phrases.js'] = s
        s = set()
        for a, b in [(135, 135), (139, 166), (167, 302), (303, 379), (380, 611)]:
            s.update(range(a - 1, b))
        scope['site/index.html'] = s
        return scope
    if STAGE == '42':
        ex = read('site/js/extras.js')
        scope['site/js/extras.js'] = _between(ex, '(function () {', 'const HELP_EMAIL')          # 고객센터(존댓말)는 뺀다
        sh = read('site/js/shop.js')
        s = set()
        s |= _between(sh, 'function sealCard(', '// ① 신년운세')                               # 봉인 카드 틀·상품 결제창
        s |= _between(sh, 'function renderNewYear(', 'function newYearFull(')                    # 신년운세 무료 맛보기 (열두 달 풀이는 43)
        s |= _between(sh, 'const FIGHT = {', 'const MONEY_PAIR = ')                             # 궁합 상세 맛보기에 첫 문장이 보이는 표
        s |= _between(sh, 'function afterCompat(', 'const YT = {')                              # 궁합 상세 맛보기 (상세 본문은 43)
        s |= _between(sh, 'function bindBundle(', "가격 표시 */")                                # 묶음 결제창·결제 뒤 알림
        s |= _between(sh, 'const STATS_MIN_SHOW', 'function paidIdFor(')                         # 대문 후기·결제 수 줄
        scope['site/js/shop.js'] = s
        idx = read('site/index.html')
        scope['site/index.html'] = _between(idx, 'id="viewCompat"', 'id="viewHelp"')            # 궁합·운세·패·묻기·신년운세 화면 틀
        return scope
    if STAGE == '43':
        # 남은 전부: 유료 리포트(updatePaywallContent·KPI·리포트 요약·부적), 리포트 전용 문장 표, 신년운세 열두 달·궁합 상세 본문, 후기 남기기.
        # 파일 전체를 범위로 잡되(이미 바꾼 줄은 그대로 지나간다), 序·설화록(옛이야기)과 고객센터(존댓말)는 뺀다
        scope['site/js/app.js'] = set(range(len(read('site/js/app.js'))))
        scope['site/js/phrases.js'] = set(range(len(read('site/js/phrases.js'))))
        scope['site/js/shop.js'] = set(range(len(read('site/js/shop.js'))))
        ex = read('site/js/extras.js')
        scope['site/js/extras.js'] = _between(ex, '(function () {', 'const HELP_EMAIL')
        idx = read('site/index.html')
        scope['site/index.html'] = _between(idx, 'id="viewReport"', 'id="viewCompat"') | _between(idx, 'id="tabBar"', '</body>')
        return scope
    raise SystemExit('HAOCHE_STAGE 는 41, 42, 43')


def skip_line(rel, line):
    t = line.strip()
    if t.startswith('//') or t.startswith('/*') or t.startswith('*') or t.startswith('<!--'): return True
    if rel == 'site/js/app.js' and re.search(r'\bORIG\.(fitWeapon|fitHobby)\s*=', line): return True   # 화면에 안 나오는 보관 문장만 그대로 (나머지 ORIG 는 사람에 따라 화면에 나온다)
    if rel == 'site/index.html' and ('class="lore-line"' in line or 'class="lore-sub"' in line): return True   # 옛이야기 서술은 그대로
    return False


def strip_comment(line):
    """줄 끝의 // 주석과 <!-- --> 주석은 건드리지 않게 떼어 둔다 (문자열 안의 // 는 드물다 — URL 은 https:// 라 예외 처리)"""
    m = re.search(r'(?<![:"\'])\s//\s', line)
    cut = m.start() if m else len(line)
    m2 = line.find('<!--')
    if m2 != -1: cut = min(cut, m2)
    return line[:cut], line[cut:]


END = r'(?=(…|\.\.\.|[.!?"\'`<)\]]|\$\{|\s*$|\s+[\u2600-\u27BF\U0001F300-\U0001FAFF]|:(?=[\s`\'"<]|$)|\s+[—–](?=\s)))'   # 43에서 쌍점·줄표 앞도 문장 끝으로
TOKEN = re.compile(r'([가-힣]+)' + END)


def candidates(word):
    """반말 문장 끝으로 보이는 낱말만"""
    if word.endswith('습니다') or (word.endswith('니다') and len(word) >= 3 and (ord(word[-3]) - 0xAC00) % 28 == 17): return False   # 존댓말(~습니다·~ㅂ니다). '아니다'는 반말
    if re.search(r'(시오|하오|이오|구려|겠소|었소|았소|였소|했소|있소|없소)$', word): return False
    return bool(re.search(r'(다|라|냐|구나|마|자|지|니|네|리라|거든|렴|려무나|는가|은가|던가|ㄴ가|다고|냐고|잖아|어|아|야|여|래|게)$', word))


if __name__ == '__main__' and sys.argv[2] == 'list':
    scope = in_scope()
    counter = collections.Counter(); where = collections.defaultdict(list)
    for rel, idxs in scope.items():
        lines = read(rel)
        for i in sorted(idxs):
            if i >= len(lines): continue
            line = lines[i]
            if skip_line(rel, line): continue
            body, _ = strip_comment(line)
            for m in TOKEN.finditer(body):
                w = m.group(1)
                if candidates(w):
                    counter[w] += 1
                    if len(where[w]) < 2: where[w].append(f'{rel.split("/")[-1]}:{i + 1}')
    with open(os.path.join(HERE, 'tokens.json'), 'w', encoding='utf-8') as f:
        json.dump({w: {'n': n, 'at': where[w]} for w, n in counter.most_common()}, f, ensure_ascii=False, indent=0)
    print(f'문장 끝 후보 낱말 {len(counter)}가지, 모두 {sum(counter.values())}곳')

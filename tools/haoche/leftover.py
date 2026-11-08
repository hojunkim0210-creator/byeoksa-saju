# -*- coding: utf-8 -*-
"""바꾼 뒤(메모리 안에서) 따옴표 밖에 남은 반말 말끝 — 무엇이 덜 바뀌었는지"""
import re, sys, os, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
REPO = sys.argv[1]
sys.argv = [sys.argv[0], REPO, 'none']
import importlib.util
spec = importlib.util.spec_from_file_location('ap', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'apply.py'))
src = open(spec.origin, encoding='utf-8').read().replace('\nrun()\n', '\n')
ns = {'__file__': spec.origin}; exec(compile(src, spec.origin, 'exec'), ns)
scope = ns['scope']; c = collections.Counter(); ex = {}
for rel, idxs in scope.in_scope().items():
    lines = scope.read(rel)
    for i in sorted(idxs):
        if i >= len(lines) or scope.skip_line(rel, lines[i]): continue
        body, _ = scope.strip_comment(lines[i])
        nb = ns['convert_endings'](body, ns['other_quote_spans'](body) + ns['protected_spans'](body))
        nb = ns['convert_pronouns'](nb, ns['other_quote_spans'](nb) + ns['protected_spans'](nb))
        spans = ns['other_quote_spans'](nb) + ns['protected_spans'](nb)
        for m in scope.TOKEN.finditer(nb):
            w = m.group(1)
            if scope.candidates(w) and not ns['inside'](m.start(), spans) and ns['MANUAL'].get(w, 1) is not None:
                c[w] += 1; ex.setdefault(w, f'{rel.split("/")[-1]}:{i+1} …{nb[max(0, m.start()-30):m.end()+8]}')
        for m in re.finditer(r'(?<![가-힣])(네가|너는|너를|네게|너의|널)(?![가-힣])|(?<![가-힣])네 (?!기둥|가지 지표)[가-힣]', nb):
            if not ns['inside'](m.start(), spans): c['[부르는 말] ' + m.group(0)] += 1; ex.setdefault('[부르는 말] ' + m.group(0), f'{rel.split("/")[-1]}:{i+1} …{nb[max(0, m.start()-30):m.end()+20]}')
for w, n in c.most_common(): print(f'{w}({n}) | {ex[w]}')
print('남은 것', sum(c.values()), '곳')

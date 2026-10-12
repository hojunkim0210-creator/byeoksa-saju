#!/usr/bin/env python3
"""HTML/JS/CSS 파일들에서 한글이 포함된 문구 조각을 모두 뽑아낸다 (텍스트 보존 검사용).

태그·템플릿 변수(${...})·공백 차이는 무시하고, 한글이 들어간 연속 구간만 비교한다.
"""
import re, sys, json

def fragments(text):
    text = re.sub(r'data:[a-z]+/[a-z+.-]+;base64,[A-Za-z0-9+/=]+', '', text)
    # 동적 연도 처리 흔적은 '연도/간지 자리'로 되돌려서 원문과 같은 문장으로 비교되게 한다
    text = re.sub(r'<span class="yr-(?:roadmap|peak)">([^<]*)</span>', r'\1', text)
    text = re.sub(r'\$\{Y_(?:R0|R1|R2|PAST1|PAST2)\}', '2000', text)
    text = re.sub(r'\$\{yearGanji\([^()]*,\s*true\)\}', '甲子', text)
    text = re.sub(r'\$\{yearGanji\([^()]*\)\}', '갑자', text)
    text = re.sub(r'\$\{[^{}]*\}', '\x00', text)        # 그 밖의 템플릿 변수 → 구분자
    text = re.sub(r'<[^>]+>', '\x00', text)               # 태그 → 구분자
    text = text.replace('\\n', '\x00').replace('&nbsp;', ' ')
    out = set()
    for part in re.split(r'[\x00`"\'\n]|\+\s*$', text):
        part = re.sub(r'\s+', ' ', part).strip(' ;,+')
        if re.search(r'[가-힣]', part) and len(re.sub(r'[^가-힣]', '', part)) >= 2:
            out.add(part)
    return out

if __name__ == '__main__':
    allf = set()
    for p in sys.argv[1:]:
        allf |= fragments(open(p, encoding='utf-8').read())
    json.dump(sorted(allf), sys.stdout, ensure_ascii=False, indent=0)

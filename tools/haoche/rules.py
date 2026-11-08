# -*- coding: utf-8 -*-
"""반말 문장 끝 → 하오체 자동 제안 (확실한 모양만). 나머지는 사람(손)이 정한 표 MANUAL 로."""
import re

def jong(ch):
    return (ord(ch) - 0xAC00) % 28 if '가' <= ch <= '힣' else -1

def drop_jong(ch):
    c = ord(ch) - 0xAC00
    return chr(0xAC00 + c - c % 28)

def add_jong(ch, j):
    c = ord(ch) - 0xAC00
    return chr(0xAC00 + c - c % 28 + j)

# 모음으로 끝나는 그림씨(형용사) 줄기 — '~다'를 '~오'로 (나머지 모음 끝 낱말은 이름씨+이다 줄임으로 보고 '~요')
ADJ_VOWEL = set('크 빠르 다르 아프 기쁘 바쁘 예쁘 나쁘 느리 흐리 어리 이르 그르 슬프 고프 쓰 세 짜 싸 비싸 차 아니 가 서 보 오 주 두 되 지 치 피 이 바 하'.split())

def propose(w):
    """확실한 규칙으로만 제안. 모르면 None"""
    if len(w) < 2: return None
    last2 = w[-2]
    if w.endswith('마라'): return w[:-2] + '마시오'
    if w.endswith('구나'): return w[:-2] + '구려'
    if w.endswith('거라'):
        stem = w[:-2]
        if not stem: return None
        j = jong(stem[-1])
        if j == 0: return stem + '시오'
        if j == 8: return stem[:-1] + drop_jong(stem[-1]) + '시오'     # ㄹ 받침: 알거라 → 아시오
        return stem + '으시오'
    if not w.endswith('다'): return None
    j = jong(last2)
    if j == 20: return w[:-1] + '소'                                     # ㅆ: 했다·있다·겠다 → 했소·있소·겠소
    if w.endswith('는다') and len(w) >= 3: return w[:-2] + '소'          # 먹는다 → 먹소
    if w.endswith('이다'): return w[:-2] + '이오'                        # 사람이다 → 사람이오
    if j == 4: return w[:-2] + drop_jong(last2) + '오'                   # 한다 → 하오, 만든다 → 만드오
    if j == 18: return w[:-1] + '소'                                     # ㅄ(없다) → 없소
    if j not in (0, 8): return w[:-1] + '소'                             # 같다·좋다·쉽다·않다 → 같소…
    if j == 0:
        if last2 == '하': return w[:-1] + '오'                           # 필요하다 → 필요하오
        return None                                                      # 빠르다(오) / 팔자다(요) — 손으로
    return None                                                          # ㄹ 받침 그림씨(길다 → 기오) — 손으로

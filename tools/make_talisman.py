#!/usr/bin/env python3
"""벽사신견 액막이 개운부(부적) 바탕 이미지 생성기.

괴황지(노란 한지) 위에 경면주사(붉은 먹)로 쓴 부적을 계산으로 그린다.
- 종이: 얼룩·섬유 결·그을린 가장자리·찢긴 테두리(투명)
- 글씨: Noto Serif CJK(OFL)로 획을 잡고, 붓 떨림·마른 붓 자국·먹 번짐을 입힌다
- 부적 획: 소용돌이·사다리·별점 같은 부적 특유의 선을 붓 압력으로 그린다
- 도장: 辟邪神犬 양각 낙관

출력: site/img/talisman.webp (투명 배경) — 사용자별 일주 글씨는 화면에서 덧쓴다(PERSONAL_SLOT).
실행: python3 tools/make_talisman.py
"""
import json
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'site', 'img', 'talisman.webp')
FONT = '/usr/share/fonts/opentype/noto/NotoSerifCJK-Black.ttc'
FONT_INDEX = 3  # TC (번체 한자 자형)

W, H = 900, 1500
rng = np.random.default_rng(1998)  # 1998년 겨울


def noise(shape, sigma, seed=None):
    r = np.random.default_rng(seed) if seed is not None else rng
    n = ndi.gaussian_filter(r.standard_normal(shape), sigma)
    n -= n.min()
    return n / (n.max() + 1e-9)


# ── 1. 괴황지 ─────────────────────────────────────────────────────────────
def make_paper():
    base_a = np.array([232, 184, 72], float)    # 밝은 괴황
    base_b = np.array([204, 146, 40], float)    # 짙은 괴황
    t = noise((H, W), 60) * 0.65 + noise((H, W), 14) * 0.35
    img = base_a * (1 - t[..., None]) + base_b * t[..., None]

    # 섬유 결: 여러 방향으로 흩어진 짧은 섬유 + 구름 같은 뭉침 (한지 특유의 결)
    fib = np.zeros((H, W))
    for k, ang in enumerate([12, 57, 103, 148]):
        f = ndi.gaussian_filter(np.random.default_rng(100 + k).standard_normal((H, W)), (5, 0.7))
        f = ndi.rotate(f, ang, reshape=False, mode='reflect')
        fib += np.clip(f / (f.std() + 1e-9) - 1.6, 0, None)
    img += (fib * 7.5)[..., None]
    cloud = ndi.gaussian_filter(rng.standard_normal((H, W)), 3.2)
    img += (cloud / (cloud.std() + 1e-9) * 4.2)[..., None]
    img += (rng.standard_normal((H, W)) * 2.2)[..., None]

    # 얼룩
    stains = noise((H, W), 90, seed=7)
    img -= (np.clip(stains - 0.62, 0, 1) * 70)[..., None] * np.array([0.6, 0.75, 1.0])

    # 그을린 가장자리
    yy, xx = np.mgrid[0:H, 0:W]
    d = np.minimum.reduce([xx, W - 1 - xx, yy, H - 1 - yy]).astype(float)
    burn = np.clip(1 - d / 70, 0, 1) ** 1.6 * (0.6 + 0.4 * noise((H, W), 10, seed=3))
    img = img * (1 - burn[..., None] * 0.42) + np.array([110, 62, 18]) * (burn[..., None] * 0.18)

    # 찢긴 테두리: 가장자리를 1차원 잡음으로 들쭉날쭉하게
    def edge(n, amp, sig, seed):
        e = ndi.gaussian_filter(np.random.default_rng(seed).standard_normal(n), sig)
        e = (e - e.min()) / (e.max() - e.min() + 1e-9)
        return 10 + e * amp
    top, bot = edge(W, 16, 6, 11), edge(W, 16, 6, 12)
    lef, rig = edge(H, 12, 9, 13), edge(H, 12, 9, 14)
    alpha = ((yy > top[xx]) & (yy < H - 1 - bot[xx]) & (xx > lef[yy]) & (xx < W - 1 - rig[yy])).astype(float)
    alpha = ndi.gaussian_filter(alpha, 0.9)
    # 가장자리 보풀
    fuzz = (rng.random((H, W)) < 0.25) & (ndi.gaussian_filter(alpha, 2.2) > 0.25) & (alpha < 0.5)
    alpha = np.maximum(alpha, fuzz * 0.6)
    return np.clip(img, 0, 255), np.clip(alpha, 0, 1)


# ── 2. 붓 효과 ───────────────────────────────────────────────────────────
def brushify(mask, wobble=4.2, dry=0.5, seed=0):
    """흑백 글씨 마스크(0~1)에 붓 떨림·마른 붓·거친 가장자리·번짐을 준다."""
    r = np.random.default_rng(seed)
    h, w = mask.shape
    dy = ndi.gaussian_filter(r.standard_normal((h, w)), 10)
    dx = ndi.gaussian_filter(r.standard_normal((h, w)), 10)
    dy *= wobble / (np.abs(dy).max() + 1e-9)
    dx *= wobble / (np.abs(dx).max() + 1e-9)
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    m = ndi.map_coordinates(mask, [yy + dy, xx + dx], order=1)

    # 거친 가장자리: 살짝 흐리게 한 뒤 들쭉날쭉한 문턱값
    soft = ndi.gaussian_filter(m, 1.4)
    thr = 0.5 + (ndi.gaussian_filter(r.standard_normal((h, w)), 1.2) * 0.22)
    rough = np.clip((soft - thr) * 6 + 0.5, 0, 1)

    # 마른 붓 자국: 결 방향으로 늘인 잡음이 획 안을 군데군데 비운다
    streak_v = ndi.gaussian_filter(r.standard_normal((h, w)), (9, 0.8))
    streak_h = ndi.gaussian_filter(r.standard_normal((h, w)), (0.8, 9))
    streak = (streak_v / (streak_v.std() + 1e-9) + streak_h / (streak_h.std() + 1e-9)) / 2
    dryness = np.clip(1 - dry * np.clip(streak - 0.6, 0, 3), 0.2, 1)
    ink = rough * dryness

    # 먹 번짐: 획 둘레로 엷게 퍼짐
    bleed = ndi.gaussian_filter(ink, 2.6) * 0.28
    return np.clip(ink + bleed, 0, 1)


def text_mask(chars, size, center, vertical=True, spacing=1.0, index=FONT_INDEX, jitter=1.0, thicken=0, seed=0):
    r = np.random.default_rng(seed + 500)
    m = Image.new('L', (W, H), 0)
    cx, cy = center
    n = len(chars)
    step = size * spacing
    for i, ch in enumerate(chars):
        sz = int(size * (1 + r.uniform(-0.06, 0.06) * jitter))
        font = ImageFont.truetype(FONT, sz, index=index)
        tile = Image.new('L', (int(sz * 1.6), int(sz * 1.6)), 0)
        ImageDraw.Draw(tile).text((tile.width / 2, tile.height / 2), ch, font=font, fill=255, anchor='mm')
        tile = tile.rotate(r.uniform(-4, 4) * jitter, resample=Image.BICUBIC)
        if vertical:
            x, y = cx + r.uniform(-7, 7) * jitter, cy + (i - (n - 1) / 2) * step
        else:
            x, y = cx + (i - (n - 1) / 2) * step, cy + r.uniform(-7, 7) * jitter
        m.paste(255, (int(x - tile.width / 2), int(y - tile.height / 2)), tile)
    a = np.asarray(m, float) / 255
    if thicken:
        a = ndi.grey_dilation(a, size=(thicken, thicken))
    return a


def stroke_mask(points, width, taper=True, ss=2):
    """점 목록을 따라 붓 압력(가운데 굵고 양끝 가늘게)으로 획을 그린다."""
    m = Image.new('L', (W * ss, H * ss), 0)
    d = ImageDraw.Draw(m)
    pts = np.array(points, float)
    # 촘촘하게 보간
    seg = np.cumsum(np.r_[0, np.hypot(*np.diff(pts, axis=0).T)])
    t = np.linspace(0, seg[-1], max(2, int(seg[-1] / 1.5)))
    xs, ys = np.interp(t, seg, pts[:, 0]), np.interp(t, seg, pts[:, 1])
    n = len(t)
    for i in range(n):
        u = i / (n - 1)
        p = math.sin(math.pi * min(1, u * 1.15)) ** 0.55 if taper else 1
        r = max(1.2, width * (0.35 + 0.65 * p)) * ss / 2
        x, y = xs[i] * ss, ys[i] * ss
        d.ellipse([x - r, y - r, x + r, y + r], fill=255)
    m = m.resize((W, H), Image.LANCZOS)
    return np.asarray(m, float) / 255


def spiral(cx, cy, r0, turns, direction=1, squash=1.0):
    pts = []
    for i in range(int(turns * 90)):
        a = i / 90 * 2 * math.pi * direction
        r = r0 * (1 - i / (turns * 90) * 0.85)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a) * squash))
    return pts


# ── 3. 구성 ──────────────────────────────────────────────────────────────
def compose():
    paper, alpha = make_paper()
    ink = np.zeros((H, W))

    def add(mask, seed, **kw):
        nonlocal ink
        ink = np.maximum(ink, brushify(mask, seed=seed, **kw))

    cx = W / 2
    # 머리: 삼태성(별점 셋) + 가로 획 + 敕令
    for i, x in enumerate([cx - 78, cx, cx + 78]):
        add(stroke_mask(spiral(x, 86, 17, 1.25, 1 if i % 2 else -1), 11), seed=20 + i, wobble=2)
    add(stroke_mask([(cx - 175, 140), (cx - 60, 126), (cx + 50, 134), (cx + 180, 120)], 22), seed=30)
    add(text_mask('敕令', 104, (cx, 262), spacing=1.0, seed=31, thicken=3), seed=31)

    # 몸통: 辟邪 + 양옆 소용돌이와 팔 획
    add(text_mask('辟邪', 186, (cx, 612), spacing=1.04, seed=40, thicken=5), seed=40, wobble=5)
    add(stroke_mask(spiral(cx - 222, 470, 52, 2.4, 1, 1.15), 16), seed=41)
    add(stroke_mask(spiral(cx + 222, 715, 52, 2.4, -1, 1.15), 16), seed=42)
    add(stroke_mask([(cx - 222, 522), (cx - 212, 600), (cx - 178, 668), (cx - 128, 700)], 19), seed=43)
    add(stroke_mask([(cx + 222, 663), (cx + 212, 585), (cx + 178, 517), (cx + 128, 485)], 19), seed=44)

    # 鎭煞 + 아래로 뻗는 등뼈
    add(text_mask('鎭煞', 116, (cx, 942), spacing=1.04, seed=50, thicken=3), seed=50)
    add(stroke_mask([(cx, 1012), (cx + 8, 1070), (cx - 6, 1140), (cx + 4, 1205)], 22), seed=51)

    # 발: 사다리 획(罡) + 갈고리 + 소용돌이
    for k, y in enumerate([1072, 1122, 1172]):
        half = 128 - k * 24
        add(stroke_mask([(cx - half, y), (cx - half / 3, y - 6), (cx + half / 3, y + 5), (cx + half, y - 4)], 17), seed=60 + k)
    add(stroke_mask([(cx + 4, 1205), (cx - 32, 1255), (cx - 98, 1280), (cx - 150, 1258), (cx - 140, 1218)], 19), seed=64)
    add(stroke_mask(spiral(cx + 78, 1255, 30, 1.8, -1), 12), seed=65)

    # 양옆 기둥 글씨
    add(text_mask('急急如律令', 60, (112, 700), spacing=1.14, seed=70, jitter=0.6), seed=70, wobble=1.8, dry=0.3)
    add(text_mask('萬事亨通', 60, (W - 112, 590), spacing=1.14, seed=71, jitter=0.6), seed=71, wobble=1.8, dry=0.3)

    # 먹 색: 짙은 곳은 검붉게, 엷은 곳은 주홍
    tone = noise((H, W), 18, seed=80)
    ink_rgb = np.array([196, 46, 26], float) * (1 - tone[..., None]) + np.array([140, 22, 14], float) * tone[..., None]
    a = (ink * 0.94)[..., None]
    out = paper * (1 - a) + (paper * ink_rgb / 255) * a  # 곱하기 혼합: 종이 결이 먹 아래로 비친다

    # 낙관: 辟邪神犬 양각 (붉은 바탕에 글자가 종이색으로 빠진다)
    seal_size = 150
    seal = Image.new('L', (seal_size, seal_size), 0)
    sd = ImageDraw.Draw(seal)
    sd.rounded_rectangle([4, 4, seal_size - 5, seal_size - 5], radius=10, fill=255)
    sfont = ImageFont.truetype(FONT, 54, index=FONT_INDEX)
    for ch, (x, y) in zip('辟邪神犬', [(108, 42), (108, 108), (42, 42), (42, 108)]):  # 오른쪽 위부터 세로로 읽는다
        sd.text((x, y), ch, font=sfont, fill=0, anchor='mm')
    sd.rounded_rectangle([10, 10, seal_size - 11, seal_size - 11], radius=7, outline=0, width=3)
    seal = seal.rotate(-4, resample=Image.BICUBIC, expand=True)
    s = np.asarray(seal, float) / 255
    s *= np.clip(0.75 + 0.5 * np.random.default_rng(90).random(s.shape), 0, 1)  # 인주가 덜 묻은 자리
    s = ndi.gaussian_filter(s, 0.6)
    sy, sx = 1250, 70
    hh, ww = s.shape
    reg = out[sy:sy + hh, sx:sx + ww]
    seal_rgb = np.array([200, 42, 30], float)
    reg[:] = reg * (1 - s[..., None] * 0.9) + (reg * seal_rgb / 255) * (s[..., None] * 0.9)

    rgba = np.dstack([np.clip(out, 0, 255), alpha * 255]).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA')


if __name__ == '__main__':
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    img = compose()
    img.save(OUT, 'WEBP', quality=88, method=6)
    # 화면에서 사용자 일주를 덧쓸 자리 (오른쪽 기둥 아래, 세로쓰기)
    slot = {'x': W - 112, 'y': 1020, 'size': 50, 'step': 58, 'width': W, 'height': H}
    print(json.dumps({'out': os.path.relpath(OUT, ROOT), 'bytes': os.path.getsize(OUT), 'personalSlot': slot}, ensure_ascii=False))

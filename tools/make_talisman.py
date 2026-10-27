#!/usr/bin/env python3
"""벽사신견 부적 바탕 이미지 생성기 (개운부 1장 + 소원 부적 5장).

괴황지(노란 한지) 위에 경면주사(붉은 먹)로 쓴 부적을 계산으로 그린다. 사진처럼 보이도록:
- 종이: 섬유 결·얼룩·그을린 가장자리·찢긴 테두리(투명) + 접었다 편 자국(가로 두 번, 세로 한 번)
- 글씨: Noto Serif CJK(OFL) 번체 자형으로 획을 잡고, 붓 떨림·마른 붓 자국·획 끝의 먹 고임·번짐을 입힌다
- 부적 획: 삼태성·소용돌이·사다리(罡)·갈고리 같은 부적 특유의 선을 붓 압력으로 그린다
- 도장: 辟邪神犬 양각 낙관 (인주가 덜 묻은 자리)
- 소원 부적은 금테 두 겹(닳은 금박) + 귀퉁이 운문

출력: site/img/talisman.webp, site/img/wish-{money,love,pass,health,guard}.webp (모두 900×1500, 투명 배경)
사용자별 글씨(일주·날짜)는 화면에서 덧쓴다 — 자리(slot)는 아래 SLOTS 참고. 실행: python3 tools/make_talisman.py
"""
import json
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'site', 'img')
FONT = '/usr/share/fonts/opentype/noto/NotoSerifCJK-Black.ttc'
FONT_INDEX = 3  # TC (번체 한자 자형)

W, H = 900, 1500


def noise(shape, sigma, rng):
    n = ndi.gaussian_filter(rng.standard_normal(shape), sigma)
    n -= n.min()
    return n / (n.max() + 1e-9)


# ── 1. 괴황지 ─────────────────────────────────────────────────────────────
def make_paper(seed, folds=True):
    rng = np.random.default_rng(seed)
    base_a = np.array([233, 187, 78], float)    # 밝은 괴황
    base_b = np.array([203, 146, 42], float)    # 짙은 괴황
    t = noise((H, W), 60, rng) * 0.65 + noise((H, W), 14, rng) * 0.35
    img = base_a * (1 - t[..., None]) + base_b * t[..., None]

    # 섬유 결: 여러 방향의 짧은 섬유 + 구름 같은 뭉침
    fib = np.zeros((H, W))
    for k, ang in enumerate([12, 57, 103, 148]):
        f = ndi.gaussian_filter(np.random.default_rng(seed * 10 + k).standard_normal((H, W)), (5, 0.7))
        f = ndi.rotate(f, ang, reshape=False, mode='reflect')
        fib += np.clip(f / (f.std() + 1e-9) - 1.6, 0, None)
    img += (fib * 7.5)[..., None]
    cloud = ndi.gaussian_filter(rng.standard_normal((H, W)), 3.2)
    img += (cloud / (cloud.std() + 1e-9) * 4.2)[..., None]
    img += (rng.standard_normal((H, W)) * 2.4)[..., None]

    # 얼룩
    stains = noise((H, W), 90, np.random.default_rng(seed + 7))
    img -= (np.clip(stains - 0.62, 0, 1) * 70)[..., None] * np.array([0.6, 0.75, 1.0])

    # 접었다 편 자국: 가로 두 줄(삼등분) + 세로 한 줄 — 접힌 산은 밝고, 골은 어둡게
    if folds:
        yy, xx = np.mgrid[0:H, 0:W].astype(float)
        crease = np.zeros((H, W))
        for fy in (H / 3, 2 * H / 3):
            wob = ndi.gaussian_filter(rng.standard_normal(W), 40) * 6
            d = yy - (fy + wob[None, :])
            crease += np.exp(-(d / 2.2) ** 2) * 1.0 - np.exp(-((d - 4) / 5) ** 2) * 0.55
        wob = ndi.gaussian_filter(rng.standard_normal(H), 40) * 6
        d = xx - (W / 2 + wob[:, None])
        crease += np.exp(-(d / 2.0) ** 2) * 0.8 - np.exp(-((d + 4) / 5) ** 2) * 0.45
        img += (crease * 16)[..., None]

    # 그을린 가장자리
    yy, xx = np.mgrid[0:H, 0:W]
    d = np.minimum.reduce([xx, W - 1 - xx, yy, H - 1 - yy]).astype(float)
    burn = np.clip(1 - d / 70, 0, 1) ** 1.6 * (0.6 + 0.4 * noise((H, W), 10, np.random.default_rng(seed + 3)))
    img = img * (1 - burn[..., None] * 0.42) + np.array([110, 62, 18]) * (burn[..., None] * 0.18)

    # 찢긴 테두리
    def edge(n, amp, sig, s):
        e = ndi.gaussian_filter(np.random.default_rng(s).standard_normal(n), sig)
        e = (e - e.min()) / (e.max() - e.min() + 1e-9)
        return 10 + e * amp
    top, bot = edge(W, 16, 6, seed + 11), edge(W, 16, 6, seed + 12)
    lef, rig = edge(H, 12, 9, seed + 13), edge(H, 12, 9, seed + 14)
    alpha = ((yy > top[xx]) & (yy < H - 1 - bot[xx]) & (xx > lef[yy]) & (xx < W - 1 - rig[yy])).astype(float)
    alpha = ndi.gaussian_filter(alpha, 0.9)
    fuzz = (rng.random((H, W)) < 0.25) & (ndi.gaussian_filter(alpha, 2.2) > 0.25) & (alpha < 0.5)
    alpha = np.maximum(alpha, fuzz * 0.6)
    return np.clip(img, 0, 255), np.clip(alpha, 0, 1)


# ── 2. 붓 효과 ───────────────────────────────────────────────────────────
def brushify(mask, wobble=4.2, dry=0.5, seed=0):
    """흑백 글씨 마스크(0~1)에 붓 떨림·마른 붓·거친 가장자리·먹 고임·번짐을 준다."""
    r = np.random.default_rng(seed)
    h, w = mask.shape
    dy = ndi.gaussian_filter(r.standard_normal((h, w)), 10)
    dx = ndi.gaussian_filter(r.standard_normal((h, w)), 10)
    dy *= wobble / (np.abs(dy).max() + 1e-9)
    dx *= wobble / (np.abs(dx).max() + 1e-9)
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    m = ndi.map_coordinates(mask, [yy + dy, xx + dx], order=1)

    soft = ndi.gaussian_filter(m, 1.4)
    thr = 0.5 + (ndi.gaussian_filter(r.standard_normal((h, w)), 1.2) * 0.22)
    rough = np.clip((soft - thr) * 6 + 0.5, 0, 1)

    # 마른 붓 자국
    streak_v = ndi.gaussian_filter(r.standard_normal((h, w)), (9, 0.8))
    streak_h = ndi.gaussian_filter(r.standard_normal((h, w)), (0.8, 9))
    streak = (streak_v / (streak_v.std() + 1e-9) + streak_h / (streak_h.std() + 1e-9)) / 2
    dryness = np.clip(1 - dry * np.clip(streak - 0.6, 0, 3), 0.2, 1)
    ink = rough * dryness

    # 먹 고임: 획 안쪽에서 두께가 두꺼운 자리(거리 변환이 큰 곳)는 더 짙게
    dist = ndi.distance_transform_edt(rough > 0.5)
    pool = np.clip(dist / 9, 0, 1) * 0.35
    ink = np.clip(ink + pool * rough, 0, 1)

    # 먹 번짐
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


# ── 3. 공통 부품 ─────────────────────────────────────────────────────────
def ink_to_paper(paper, ink, seed):
    """붉은 먹을 종이에 곱하기 혼합. 짙은 곳은 검붉게, 엷은 곳은 주홍."""
    tone = noise((H, W), 18, np.random.default_rng(seed + 80))
    ink_rgb = np.array([196, 46, 26], float) * (1 - tone[..., None]) + np.array([140, 22, 14], float) * tone[..., None]
    a = (ink * 0.94)[..., None]
    return paper * (1 - a) + (paper * ink_rgb / 255) * a


def stamp_seal(out, sy, sx, seed, size=150):
    """辟邪神犬 양각 낙관 (붉은 바탕에 글자가 종이색으로 빠진다, 인주 덜 묻은 자리)."""
    seal = Image.new('L', (size, size), 0)
    sd = ImageDraw.Draw(seal)
    sd.rounded_rectangle([4, 4, size - 5, size - 5], radius=10, fill=255)
    sfont = ImageFont.truetype(FONT, int(size * 0.36), index=FONT_INDEX)
    q = size * 0.28
    for ch, (x, y) in zip('辟邪神犬', [(size - q, q), (size - q, size - q), (q, q), (q, size - q)]):
        sd.text((x, y), ch, font=sfont, fill=0, anchor='mm')
    sd.rounded_rectangle([10, 10, size - 11, size - 11], radius=7, outline=0, width=3)
    seal = seal.rotate(-4, resample=Image.BICUBIC, expand=True)
    s = np.asarray(seal, float) / 255
    s *= np.clip(0.72 + 0.5 * np.random.default_rng(seed + 90).random(s.shape), 0, 1)
    s = ndi.gaussian_filter(s, 0.6)
    hh, ww = s.shape
    reg = out[sy:sy + hh, sx:sx + ww]
    seal_rgb = np.array([200, 42, 30], float)
    reg[:] = reg * (1 - s[..., None] * 0.9) + (reg * seal_rgb / 255) * (s[..., None] * 0.9)


def gold_border(out, seed):
    """금테 두 겹 + 안쪽 붉은 실선 + 귀퉁이 운문. 금박은 결이 있고 군데군데 닳았다."""
    rng = np.random.default_rng(seed + 300)
    m = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(m)
    d.rectangle([30, 30, W - 30, H - 30], outline=255, width=20)
    d.rectangle([64, 64, W - 64, H - 64], outline=255, width=5)
    # 귀퉁이 운문
    for (x, y, sx, sy) in [(66, 66, 1, 1), (W - 66, 66, -1, 1), (66, H - 66, 1, -1), (W - 66, H - 66, -1, -1)]:
        for r in (22, 10):
            d.arc([x + sx * 34 - r, y + sy * 34 - r, x + sx * 34 + r, y + sy * 34 + r], 0, 360, fill=255, width=6)
        d.line([(x + sx * 56, y + sy * 34), (x + sx * 110, y + sy * 12)], fill=255, width=6)
        d.line([(x + sx * 34, y + sy * 56), (x + sx * 12, y + sy * 110)], fill=255, width=6)
    g = np.asarray(m, float) / 255
    # 닳음: 금박이 벗겨진 자리
    wear = noise((H, W), 9, rng)
    g *= np.clip(1.2 - np.clip(wear - 0.62, 0, 1) * 2.0, 0.25, 1)
    # 금박 색: 부드러운 결 + 군데군데 밝은 반사
    sheen = noise((H, W), (5, 26), rng) * 0.7 + noise((H, W), 40, rng) * 0.3
    gold = np.array([246, 227, 154], float) * sheen[..., None] + np.array([138, 100, 20], float) * (1 - sheen[..., None])
    out[:] = out * (1 - g[..., None]) + gold * g[..., None]
    # 안쪽 붉은 실선
    m2 = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m2).rectangle([82, 82, W - 82, H - 82], outline=255, width=2)
    r2 = ndi.gaussian_filter(np.asarray(m2, float) / 255, 0.5) * 0.7
    out[:] = out * (1 - r2[..., None]) + (out * np.array([163, 34, 26]) / 255) * r2[..., None]


def palgwae_ring(add, cx, cy, r, seed, width=9):
    """팔괘 고리: 둥근 테 두 겹 + 여덟 방위에 괘(효 셋). 부적 한가운데 희미하게 깔린다."""
    ring = [(cx + r * math.cos(a), cy + r * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 180)]
    add(stroke_mask(ring, width, taper=False), seed + 1, wobble=1.5, dry=0.25)
    ring2 = [(cx + (r - 26) * math.cos(a), cy + (r - 26) * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 180)]
    add(stroke_mask(ring2, 4, taper=False), seed + 2, wobble=1.2, dry=0.25)
    # 괘: 乾☰ 兌☱ 離☲ 震☳ 巽☴ 坎☵ 艮☶ 坤☷ (1 = 이어진 효, 0 = 끊긴 효), 바깥쪽 효부터
    gwae = [[1, 1, 1], [0, 1, 1], [1, 0, 1], [0, 0, 1], [1, 1, 0], [0, 1, 0], [1, 0, 0], [0, 0, 0]]
    for k, g in enumerate(gwae):
        ang = -math.pi / 2 + k * math.pi / 4
        for j, yao in enumerate(g):
            rr = r + 46 + j * 16   # 고리 바깥에 세 효
            cxk, cyk = cx + rr * math.cos(ang), cy + rr * math.sin(ang)
            tx, ty = -math.sin(ang), math.cos(ang)   # 접선 방향
            half = 24
            if yao:
                add(stroke_mask([(cxk - tx * half, cyk - ty * half), (cxk + tx * half, cyk + ty * half)], 7, taper=False), seed + 10 + k * 3 + j, wobble=1, dry=0.2)
            else:
                add(stroke_mask([(cxk - tx * half, cyk - ty * half), (cxk - tx * 6, cyk - ty * 6)], 7, taper=False), seed + 10 + k * 3 + j, wobble=1, dry=0.2)
                add(stroke_mask([(cxk + tx * 6, cyk + ty * 6), (cxk + tx * half, cyk + ty * half)], 7, taper=False), seed + 40 + k * 3 + j, wobble=1, dry=0.2)


def big_dipper(add, pts, seed):
    add(stroke_mask(pts, 4, taper=False), seed, wobble=1.2)
    for i, (x, y) in enumerate(pts):
        add(stroke_mask(spiral(x, y, 11, 1.0, 1 if i % 2 else -1), 8), seed + 1 + i, wobble=1.0)


def lattice_ghost(add, cx, cy, size, seed):
    """井 격자 안의 鬼 — 잡귀를 가둔다는 부적 도상"""
    s3 = size / 3
    for k in (1, 2):
        add(stroke_mask([(cx - size / 2 - 14, cy - size / 2 + s3 * k), (cx + size / 2 + 14, cy - size / 2 + s3 * k)], 6, taper=False), seed + k, wobble=1.2)
        add(stroke_mask([(cx - size / 2 + s3 * k, cy - size / 2 - 14), (cx - size / 2 + s3 * k, cy + size / 2 + 14)], 6, taper=False), seed + 2 + k, wobble=1.2)
    add(text_mask('鬼', int(size * 0.5), (cx, cy), seed=seed + 9, thicken=2), seed + 9, wobble=2)


# ── 4. 구성 ──────────────────────────────────────────────────────────────
def compose_guard(seed=1998):
    """액막이 개운부 (리포트 6장) — 三清·勅令 / 雷雷雷 / 팔괘 고리 위 辟邪 / 日·月 / 鎭煞 / 井 속 鬼 / 罡·갈고리 / 양옆 기둥 / 북두칠성"""
    paper, alpha = make_paper(seed)
    ink = np.zeros((H, W))

    def add(mask, s, **kw):
        nonlocal ink
        ink = np.maximum(ink, brushify(mask, seed=s, **kw))

    cx = W / 2
    # 머리: 삼청 획 셋 + 勅令
    for i, x in enumerate([cx - 70, cx, cx + 70]):
        add(stroke_mask([(x - 22, 96 + (i % 2) * 4), (x + 22, 90 + (i % 2) * 4)], 12), seed + 20 + i, wobble=1.5)
    add(text_mask('勅令', 96, (cx, 190), spacing=1.0, seed=seed + 31, thicken=3), seed + 31)
    # 雷雷雷
    add(text_mask('雷雷雷', 52, (cx, 300), vertical=False, spacing=1.25, seed=seed + 33, jitter=0.7), seed + 33, wobble=2, dry=0.3)
    # 북두칠성 (왼쪽 위)
    big_dipper(add, [(96, 330), (138, 300), (186, 296), (226, 322), (252, 372), (300, 388), (334, 352)], seed + 36)
    # 몸통: 팔괘 고리 위에 辟邪, 양옆 日·月
    palgwae_ring(add, cx, 610, 150, seed + 100, width=8)
    add(text_mask('辟邪', 176, (cx, 610), spacing=1.02, seed=seed + 40, thicken=5), seed + 40, wobble=4)
    add(text_mask('日', 54, (cx - 262, 540), seed=seed + 44, thicken=1), seed + 44, wobble=1.5)
    add(text_mask('月', 54, (cx + 262, 680), seed=seed + 45, thicken=1), seed + 45, wobble=1.5)
    # 鎭煞 + 井 속 鬼 + 등뼈
    add(text_mask('鎭煞', 104, (cx, 898), spacing=1.04, seed=seed + 50, thicken=3), seed + 50)
    lattice_ghost(add, cx, 1072, 120, seed + 55)
    add(stroke_mask([(cx, 1150), (cx + 6, 1190), (cx - 5, 1230), (cx + 3, 1262)], 20), seed + 51)
    # 罡 사다리 + 갈고리 + 소용돌이
    for k, y in enumerate([1176, 1216]):
        half = 120 - k * 26
        add(stroke_mask([(cx - half, y), (cx - half / 3, y - 5), (cx + half / 3, y + 4), (cx + half, y - 3)], 15), seed + 60 + k)
    add(stroke_mask([(cx + 3, 1262), (cx - 30, 1300), (cx - 92, 1322), (cx - 140, 1300), (cx - 130, 1266)], 17), seed + 64)
    add(stroke_mask(spiral(cx + 86, 1300, 28, 1.8, -1), 11), seed + 65)
    add(stroke_mask(spiral(cx - 262, 860, 40, 2.2, 1, 1.1), 13), seed + 66)
    add(stroke_mask(spiral(cx + 262, 420, 40, 2.2, -1, 1.1), 13), seed + 67)
    # 양옆 기둥 글씨 (오른쪽 아래는 화면에서 일주를 덧쓰는 자리 → 비워 둠)
    add(text_mask('急急如律令', 56, (108, 700), spacing=1.14, seed=seed + 70, jitter=0.6), seed + 70, wobble=1.8, dry=0.3)
    add(text_mask('萬事亨通', 56, (W - 108, 560), spacing=1.14, seed=seed + 71, jitter=0.6), seed + 71, wobble=1.8, dry=0.3)
    add(text_mask('災厄消滅', 44, (W - 108, 850), spacing=1.14, seed=seed + 72, jitter=0.6), seed + 72, wobble=1.6, dry=0.3)
    add(text_mask('卍令神', 40, (108, 1060), spacing=1.2, seed=seed + 73, jitter=0.6), seed + 73, wobble=1.6, dry=0.3)

    out = ink_to_paper(paper, ink, seed)
    stamp_seal(out, 1250, 70, seed)
    return Image.fromarray(np.dstack([np.clip(out, 0, 255), alpha * 255]).astype(np.uint8), 'RGBA')


WISH_SPEC = {
    #            큰 글자   오른쪽 기둥(소원 문구)   왼쪽 기둥
    'money':  ('招財', '金玉滿堂', '急急如律令'),
    'love':   ('和合', '天生緣分', '急急如律令'),
    'pass':   ('登科', '一擧及第', '急急如律令'),
    'health': ('安康', '無病長壽', '急急如律令'),
    'guard':  ('除厄', '萬邪不侵', '急急如律令'),
}


def compose_wish(wish, seed):
    """소원 부적 — 금테 + 북두칠성 + 敕令 + 큰 글자 두 자 + 양옆 기둥 + 罡 + 낙관.
    화면에서 덧쓰는 자리: 오른쪽 기둥 아래(일주·補오행, SLOTS['wish'].person), 아래 가운데(날짜, SLOTS['wish'].date)"""
    big, right, left = WISH_SPEC[wish]
    paper, alpha = make_paper(seed)
    ink = np.zeros((H, W))

    def add(mask, s, **kw):
        nonlocal ink
        ink = np.maximum(ink, brushify(mask, seed=s, **kw))

    cx = W / 2
    # 북두칠성 + 삼청 획 + 敕令
    stars = [(300, 150), (360, 128), (420, 138), (470, 168), (520, 200), (590, 196), (632, 150)]
    add(stroke_mask(stars, 5, taper=False), seed + 10, wobble=1.5)
    for i, (x, y) in enumerate(stars):
        add(stroke_mask(spiral(x, y, 12, 1.0, 1 if i % 2 else -1), 9), seed + 11 + i, wobble=1.2)
    for i, x in enumerate([cx - 60, cx, cx + 60]):
        add(stroke_mask([(x - 20, 238), (x + 20, 232)], 10), seed + 20 + i, wobble=1.5)
    add(text_mask('敕令', 92, (cx, 318), spacing=1.0, seed=seed + 31, thicken=3), seed + 31)
    add(text_mask('雷雷雷', 44, (cx, 420), vertical=False, spacing=1.25, seed=seed + 33, jitter=0.7), seed + 33, wobble=2, dry=0.3)
    # 팔괘 고리 위에 큰 글자 두 자
    palgwae_ring(add, cx, 745, 150, seed + 100, width=7)
    add(text_mask(big, 250, (cx, 745), spacing=1.1, seed=seed + 40, thicken=6), seed + 40, wobble=5)
    # 양옆 소용돌이·팔 획
    add(stroke_mask(spiral(cx - 250, 520, 46, 2.2, 1, 1.1), 14), seed + 41)
    add(stroke_mask(spiral(cx + 250, 980, 46, 2.2, -1, 1.1), 14), seed + 42)
    add(stroke_mask([(cx - 250, 566), (cx - 240, 640), (cx - 205, 705), (cx - 160, 735)], 17), seed + 43)
    add(stroke_mask([(cx + 250, 934), (cx + 240, 860), (cx + 205, 795), (cx + 160, 765)], 17), seed + 44)
    # 井 속 鬼 + 등뼈 + 罡 + 갈고리
    lattice_ghost(add, cx, 1040, 96, seed + 55)
    add(stroke_mask([(cx, 1100), (cx + 6, 1130), (cx - 5, 1155), (cx + 3, 1175)], 20), seed + 51)
    for k, y in enumerate([1120, 1156]):
        half = 118 - k * 22
        add(stroke_mask([(cx - half, y), (cx - half / 3, y - 5), (cx + half / 3, y + 4), (cx + half, y - 3)], 15), seed + 60 + k)
    add(stroke_mask([(cx + 3, 1175), (cx - 30, 1222), (cx - 92, 1245), (cx - 140, 1224), (cx - 130, 1188)], 17), seed + 64)
    add(stroke_mask(spiral(cx + 74, 1222, 27, 1.8, -1), 11), seed + 65)
    # 양옆 기둥 글씨 (위쪽만 — 아래는 화면에서 덧쓰는 자리)
    add(text_mask(left, 54, (150, 560), spacing=1.14, seed=seed + 70, jitter=0.6), seed + 70, wobble=1.8, dry=0.3)
    add(text_mask(right, 54, (W - 150, 540), spacing=1.14, seed=seed + 71, jitter=0.6), seed + 71, wobble=1.8, dry=0.3)

    out = ink_to_paper(paper, ink, seed)
    gold_border(out, seed)
    stamp_seal(out, 1300, W // 2 - 66, seed, size=132)
    return Image.fromarray(np.dstack([np.clip(out, 0, 255), alpha * 255]).astype(np.uint8), 'RGBA')


SLOTS = {
    # 화면(app.js drawTalisman)에서 사용자 일주를 세로로 덧쓰는 자리
    'guard': {'x': W - 112, 'y': 1020, 'size': 50, 'step': 58},
    # 화면(shop.js drawWishTalisman)에서 덧쓰는 자리: 일주+補오행(세로), 날짜(가로)
    'wish': {'person': {'x': W - 150, 'y': 800, 'size': 46, 'step': 54}, 'date': {'x': W // 2, 'y': 1262, 'size': 38}},
}


if __name__ == '__main__':
    os.makedirs(IMG, exist_ok=True)
    report = {}
    img = compose_guard()
    p = os.path.join(IMG, 'talisman.webp')
    img.save(p, 'WEBP', quality=88, method=6)
    report['talisman.webp'] = os.path.getsize(p)
    for i, wish in enumerate(WISH_SPEC):
        img = compose_wish(wish, 2026 + i * 17)
        p = os.path.join(IMG, f'wish-{wish}.webp')
        img.save(p, 'WEBP', quality=88, method=6)
        report[f'wish-{wish}.webp'] = os.path.getsize(p)
    print(json.dumps({'files': report, 'slots': SLOTS}, ensure_ascii=False))

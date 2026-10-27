"""카카오톡·SNS 링크 미리보기 이미지(1200×630) 만들기 → site/img/og-image.jpg

사용: python tools/make_og_image.py
- 왼쪽: 밤 바탕 위 제목과 소개 / 오른쪽: 벽사견 사진(mung.jpg)을 아치 모양으로
- 글꼴: Noto Serif CJK (SIL Open Font License 1.1)
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / 'site'
FONT_BLACK = '/usr/share/fonts/opentype/noto/NotoSerifCJK-Black.ttc'
FONT_REG = '/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc'
KR = 1  # .ttc 안의 한국어(KR) 글꼴 번호: JP=0, KR=1, SC=2, TC=3

W, H = 1200, 630
NIGHT = (26, 28, 46)
MOON = (244, 238, 226)
MOON_SOFT = (201, 194, 180)
YELLOW = (227, 179, 65)
CINNABAR = (168, 42, 32)


def font(path, size):
    return ImageFont.truetype(path, size, index=KR)


def main():
    img = Image.new('RGB', (W, H), NIGHT)
    # 은은한 달빛 번짐
    glow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(glow).ellipse((620, -260, 1320, 440), fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    img = Image.composite(Image.new('RGB', (W, H), (70, 62, 52)), img, glow)

    # 오른쪽: 아치형 벽사견 사진
    dog = Image.open(SITE / 'mung.jpg').convert('RGB')
    aw, ah = 400, 520
    dog = dog.resize((aw, aw)).crop((0, 0, aw, aw))
    dog = dog.resize((ah, ah)).crop(((ah - aw) // 2, 0, (ah - aw) // 2 + aw, ah))
    mask = Image.new('L', (aw, ah), 0)
    md = ImageDraw.Draw(mask)
    md.ellipse((0, 0, aw, aw), fill=255)
    md.rectangle((0, aw // 2, aw, ah), fill=255)
    ax, ay = W - aw - 70, H - ah - 40
    img.paste(dog, (ax, ay), mask)
    d = ImageDraw.Draw(img)
    # 아치 테두리 (노란 선)
    d.arc((ax - 6, ay - 6, ax + aw + 6, ay + aw + 6), 180, 360, fill=YELLOW, width=3)
    d.line((ax - 6, ay + aw // 2, ax - 6, ay + ah + 6), fill=YELLOW, width=3)
    d.line((ax + aw + 6, ay + aw // 2, ax + aw + 6, ay + ah + 6), fill=YELLOW, width=3)

    # 왼쪽: 도장 + 제목 + 소개
    x = 72
    d.rounded_rectangle((x, 70, x + 76, 146), radius=6, fill=CINNABAR)
    seal = font(FONT_BLACK, 30)
    d.text((x + 38, 92), '辟', font=seal, fill=(247, 227, 176), anchor='mm')
    d.text((x + 38, 124), '邪', font=seal, fill=(247, 227, 176), anchor='mm')

    d.text((x, 178), '귀신을 보고 짖는 개, 대문 앞 벽사견', font=font(FONT_REG, 28), fill=YELLOW)
    d.text((x, 222), '벽사신견', font=font(FONT_BLACK, 104), fill=MOON)
    d.text((x, 350), '사주', font=font(FONT_BLACK, 104), fill=YELLOW)
    body = font(FONT_REG, 30)
    d.text((x, 492), '대문을 지키는 개가 냄새로 읽어 주는 사주', font=body, fill=MOON_SOFT)
    d.text((x, 538), '오늘의 운세 · 궁합 · 벽사 패 무료', font=body, fill=MOON_SOFT)

    out = SITE / 'img' / 'og-image.jpg'
    img.save(out, quality=86, optimize=True, progressive=True)
    print(out, out.stat().st_size, 'bytes')


if __name__ == '__main__':
    main()

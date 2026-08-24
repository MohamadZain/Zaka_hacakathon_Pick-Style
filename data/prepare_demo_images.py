"""
Normalizes the supplied demo product photos (6 shirts + 6 pants) into a
consistent product-card presentation: same canvas size, centered product,
no stretching, clean neutral background.

Run once from the ai-shop/ directory: python data/prepare_demo_images.py
Reads source photos from SRC_DIR, writes normalized JPEGs to
static/images/products/.
"""
import os

from PIL import Image, ImageOps

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(BASE_DIR, "data", "source_photos")
OUT_DIR = os.path.join(BASE_DIR, "static", "images", "products")

# Consistent card canvas: 4:5 portrait, matches how the rest of the catalog
# (Unsplash 600x750 crops) already presents on the results/product cards.
CANVAS_W, CANVAS_H = 900, 1125
BG = (247, 246, 243)  # neutral off-white matching the site's card background
PAD_RATIO = 0.04  # small breathing room around the fitted image

# source filename -> output filename
FILES = {
    "white_shirt_6.jpg": "shirt-101.jpg",
    "white_shirt_5.webp": "shirt-102.jpg",
    "white_shirt4.jfif": "shirt-103.jpg",
    "white_shirt3.webp": "shirt-104.jpg",
    "white_shirt_2_hnm.webp": "shirt-105.jpg",
    "white_shirt_1_next.webp": "shirt-106.jpg",
    "black_pant6.webp": "pants-101.jpg",
    "blank_pant3.webp": "pants-102.jpg",
    "black_pant5.jfif": "pants-103.jpg",
    "black_pant4.webp": "pants-104.jpg",
    "Black_Regular_Fit_Stretch_Smart_Trousers.webp": "pants-105.jpg",
    "simon-jersey-mens-flat-front-straight-leg-trousers-black-p3059-236882_zoom.jpg": "pants-106.jpg",
}


def normalize(src_path, out_path):
    im = Image.open(src_path)
    im = ImageOps.exif_transpose(im)
    im = im.convert("RGB")

    pad_w = int(CANVAS_W * PAD_RATIO)
    pad_h = int(CANVAS_H * PAD_RATIO)
    target_w = CANVAS_W - 2 * pad_w
    target_h = CANVAS_H - 2 * pad_h

    # Scale to fit inside target box, preserving aspect ratio (no stretch/crop).
    fitted = ImageOps.contain(im, (target_w, target_h), method=Image.LANCZOS)

    canvas = Image.new("RGB", (CANVAS_W, CANVAS_H), BG)
    x = (CANVAS_W - fitted.width) // 2
    y = (CANVAS_H - fitted.height) // 2
    canvas.paste(fitted, (x, y))

    canvas.save(out_path, "JPEG", quality=90)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for src_name, out_name in FILES.items():
        src_path = os.path.join(SRC_DIR, src_name)
        out_path = os.path.join(OUT_DIR, out_name)
        normalize(src_path, out_path)
        print(f"{src_name} -> static/images/products/{out_name}")


if __name__ == "__main__":
    main()

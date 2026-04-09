"""
Build feature graphic options:
1. Crop generated v2 and v3 to exact 1024x500
2. Build a programmatic version using the actual og-preview as a base
"""
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
import os

BRAIN = r"C:\Users\aksha\.gemini\antigravity\brain\d0119d77-59e7-4fd9-bf9b-ab93f5afdf7f"
STORE = r"D:\Projects\Qook-Android\QookCommander-main\QookCommander-main\store_assets"
SRC = r"D:\Projects\Cook Commander\Cook-Commander\public"

def crop_exact(img, tw, th):
    w, h = img.size
    tr = tw / th
    ir = w / h
    if ir > tr:
        nw = int(h * tr)
        left = (w - nw) // 2
        img = img.crop((left, 0, left + nw, h))
    else:
        nh = int(w / tr)
        top = (h - nh) // 2
        img = img.crop((0, top, w, top + nh))
    return img.resize((tw, th), Image.LANCZOS)

TW, TH = 1024, 500

# --- Option 1: Crop generated v2 (warm/light) ---
v2 = Image.open(os.path.join(BRAIN, "feature_graphic_v2_1773297398871.png"))
v2_cropped = crop_exact(v2, TW, TH)
v2_cropped.save(os.path.join(BRAIN, "fg_option_light.png"), "PNG")
print(f"OK fg_option_light: {v2.size} -> {v2_cropped.size}")

# --- Option 2: Crop generated v3 (dark/premium) ---
v3 = Image.open(os.path.join(BRAIN, "feature_graphic_v3_1773297418648.png"))
v3_cropped = crop_exact(v3, TW, TH)
v3_cropped.save(os.path.join(BRAIN, "fg_option_dark.png"), "PNG")
print(f"OK fg_option_dark: {v3.size} -> {v3_cropped.size}")

# --- Option 3: Use the og-preview directly (it's already a great banner) ---
og = Image.open(os.path.join(SRC, "og-preview.png"))
og_cropped = crop_exact(og, TW, TH)
og_cropped.save(os.path.join(BRAIN, "fg_option_og.png"), "PNG")
print(f"OK fg_option_og: {og.size} -> {og_cropped.size}")

# --- Option 4: Dark enhanced version of og-preview ---
# Create a dark version with enhanced contrast
dark_bg = Image.new('RGB', (TW, TH), (22, 33, 62))
draw = ImageDraw.Draw(dark_bg)
# Gradient from dark navy to slightly lighter
for y in range(TH):
    ratio = y / TH
    r = int(22 + (30 - 22) * ratio)
    g = int(33 + (45 - 33) * ratio)
    b = int(62 + (80 - 62) * ratio)
    draw.line([(0, y), (TW, y)], fill=(r, g, b))

# Place the logo on the dark background
logo = Image.open(os.path.join(SRC, "QookCommander-home-cook-management-app-logo.png"))
logo = logo.convert("RGBA")
# Scale logo to fit nicely (about 40% of width)
logo_w = int(TW * 0.45)
logo_h = int(logo.height * (logo_w / logo.width))
logo = logo.resize((logo_w, logo_h), Image.LANCZOS)
# Center vertically, place left of center
logo_x = int(TW * 0.03)
logo_y = (TH - logo_h) // 2
dark_bg.paste(logo, (logo_x, logo_y), logo)

dark_bg.save(os.path.join(BRAIN, "fg_option_dark_logo.png"), "PNG")
print(f"OK fg_option_dark_logo: {TW}x{TH}")

print("\nAll feature graphic options created!")

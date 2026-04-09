"""
Build 2 additional Play Store screenshots:
1. Combined Hindi + English menu (side-by-side) with header
2. Shareable Grocery List with header
"""
from PIL import Image, ImageDraw, ImageFont
import os

STORE = r"D:\Projects\Qook-Android\QookCommander-main\QookCommander-main\store_assets"
BRAIN = r"C:\Users\aksha\.gemini\antigravity\brain\d0119d77-59e7-4fd9-bf9b-ab93f5afdf7f"
PUB = r"D:\Projects\Qook-Android\QookCommander-main\QookCommander-main\public"

TW, TH = 1080, 1920
HEADER_H = int(TH * 0.18)  # ~345px
CONTENT_H = TH - HEADER_H

def create_gradient(w, h, c_top, c_bot):
    img = Image.new('RGB', (w, h))
    draw = ImageDraw.Draw(img)
    for y in range(h):
        r = y / h
        cr = int(c_top[0] + (c_bot[0] - c_top[0]) * r)
        cg = int(c_top[1] + (c_bot[1] - c_top[1]) * r)
        cb = int(c_top[2] + (c_bot[2] - c_top[2]) * r)
        draw.line([(0, y), (w, y)], fill=(cr, cg, cb))
    return img

def get_bold(size):
    for p in [r"C:\Windows\Fonts\segoeuib.ttf", r"C:\Windows\Fonts\arialbd.ttf"]:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def get_regular(size):
    for p in [r"C:\Windows\Fonts\segoeui.ttf", r"C:\Windows\Fonts\arial.ttf"]:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def draw_centered(draw, text, y, font, fill=(255,255,255), w=TW):
    bb = draw.textbbox((0,0), text, font=font)
    tw_ = bb[2] - bb[0]
    x = (w - tw_) // 2
    draw.text((x+2, y+2), text, font=font, fill=(0,0,0,60))
    draw.text((x, y), text, font=font, fill=fill)

def make_header(headline, subtitle, c_top, c_bot):
    hdr = create_gradient(TW, HEADER_H, c_top, c_bot)
    draw = ImageDraw.Draw(hdr)
    hf = get_bold(52)
    sf = get_regular(28)
    hbb = draw.textbbox((0,0), headline, font=hf)
    sbb = draw.textbbox((0,0), subtitle, font=sf)
    total = (hbb[3]-hbb[1]) + 16 + (sbb[3]-sbb[1])
    sy = (HEADER_H - total) // 2
    draw_centered(draw, headline, sy, hf)
    draw_centered(draw, subtitle, sy + (hbb[3]-hbb[1]) + 16, sf, (230,230,230))
    return hdr

# ===== Screenshot 6: Combined Hindi + English Menu =====
print("Building screenshot 6: Hindi + English Menu...")

hindi = Image.open(os.path.join(PUB, "Hindi Menu.png"))
english = Image.open(os.path.join(PUB, "Weekly Menu.png"))

# Create header 
hdr = make_header("Shareable Weekly Menu", "Hindi & English — share with family via WhatsApp",
                   (136, 14, 79), (173, 20, 87))  # Deep pink/maroon gradient

# We need to fit both images side by side in the content area
# Each image gets half the width minus some padding
pad = 16
half_w = (TW - pad * 3) // 2  # 16px on each side and middle

# Scale both images to same height to fit content area
# Take top portion of each menu since they're very tall
for img_src in [hindi, english]:
    print(f"  Source: {img_src.size}")

# Scale each to half_w width, then crop to CONTENT_H height
def fit_image(img, target_w, target_h):
    w, h = img.size
    scale = target_w / w
    new_h = int(h * scale)
    img = img.resize((target_w, new_h), Image.LANCZOS)
    # Crop from top
    if new_h > target_h:
        img = img.crop((0, 0, target_w, target_h))
    return img

hindi_fit = fit_image(hindi, half_w, CONTENT_H)
english_fit = fit_image(english, half_w, CONTENT_H)

# Composite
final6 = Image.new('RGB', (TW, TH), (245, 240, 235))
final6.paste(hdr, (0, 0))
final6.paste(hindi_fit, (pad, HEADER_H))
final6.paste(english_fit, (pad * 2 + half_w, HEADER_H))

# Draw a thin separator line between them
draw6 = ImageDraw.Draw(final6)
sep_x = pad + half_w + pad // 2
draw6.line([(sep_x, HEADER_H + 10), (sep_x, TH - 10)], fill=(200, 180, 170), width=2)

s6_store = os.path.join(STORE, "screenshot_6_menus.png")
s6_brain = os.path.join(BRAIN, "ss6_menus.png")
final6.save(s6_store, "PNG")
final6.save(s6_brain, "PNG")
print(f"OK screenshot_6_menus.png: {TW}x{TH}")

# ===== Screenshot 7: Shareable Grocery List =====
print("Building screenshot 7: Grocery List...")

grocery = Image.open(os.path.join(PUB, "qookcommander-grocery-Feb-1---Feb-7,-2026.png"))

hdr2 = make_header("Shareable Grocery List", "Auto-generated & ready to share",
                    (27, 94, 32), (56, 142, 60))  # Green gradient

# Scale grocery to fill content width with small padding
gpad = 24
g_target_w = TW - gpad * 2
gw, gh = grocery.size
g_scale = g_target_w / gw
g_new_h = int(gh * g_scale)
grocery_resized = grocery.resize((g_target_w, g_new_h), Image.LANCZOS)

# Crop if too tall
if g_new_h > CONTENT_H:
    grocery_resized = grocery_resized.crop((0, 0, g_target_w, CONTENT_H))

final7 = Image.new('RGB', (TW, TH), (250, 245, 240))
final7.paste(hdr2, (0, 0))
final7.paste(grocery_resized, (gpad, HEADER_H))

s7_store = os.path.join(STORE, "screenshot_7_grocery_share.png")
s7_brain = os.path.join(BRAIN, "ss7_grocery_share.png")
final7.save(s7_store, "PNG")
final7.save(s7_brain, "PNG")
print(f"OK screenshot_7_grocery_share.png: {TW}x{TH}")

print(f"\nBoth new screenshots created at {TW}x{TH}!")

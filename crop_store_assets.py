"""
Build Play Store screenshots properly:
- Take original raw app screenshots (already correct phone aspect ratio)
- Add a gradient header with promotional text on top
- Output final 1080x1920 images
"""
from PIL import Image, ImageDraw, ImageFont
import os

SCREENSHOTS_DIR = r"D:\Projects\Cook Commander\Cook-Commander\public\App Screenshots"
STORE_DIR = r"D:\Projects\Qook-Android\QookCommander-main\QookCommander-main\store_assets"
BRAIN_DIR = r"C:\Users\aksha\.gemini\antigravity\brain\d0119d77-59e7-4fd9-bf9b-ab93f5afdf7f"

TARGET_W = 1080
TARGET_H = 1920

# Header takes top 20% of image
HEADER_H = int(TARGET_H * 0.20)  # 384px
SCREENSHOT_H = TARGET_H - HEADER_H  # 1536px

def create_gradient(width, height, color_top, color_bottom):
    """Create a vertical gradient image."""
    img = Image.new('RGB', (width, height))
    draw = ImageDraw.Draw(img)
    for y in range(height):
        ratio = y / height
        r = int(color_top[0] + (color_bottom[0] - color_top[0]) * ratio)
        g = int(color_top[1] + (color_bottom[1] - color_top[1]) * ratio)
        b = int(color_top[2] + (color_bottom[2] - color_top[2]) * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b))
    return img

def get_font(size):
    """Try to get a nice font, fall back to default."""
    font_paths = [
        r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\segoeuib.ttf",
        r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\arialbd.ttf",
    ]
    for fp in font_paths:
        if os.path.exists(fp):
            return ImageFont.truetype(fp, size)
    return ImageFont.load_default()

def get_bold_font(size):
    """Try to get a bold font."""
    bold_paths = [
        r"C:\Windows\Fonts\segoeuib.ttf",
        r"C:\Windows\Fonts\arialbd.ttf",
        r"C:\Windows\Fonts\calibrib.ttf",
    ]
    for fp in bold_paths:
        if os.path.exists(fp):
            return ImageFont.truetype(fp, size)
    return get_font(size)

def draw_centered_text(draw, text, y, font, fill=(255, 255, 255), width=TARGET_W):
    """Draw text centered horizontally."""
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    x = (width - text_w) // 2
    # Draw shadow
    draw.text((x+2, y+2), text, font=font, fill=(0, 0, 0, 80))
    # Draw text
    draw.text((x, y), text, font=font, fill=fill)

def build_screenshot(src_file, out_name, gradient_top, gradient_bottom, headline, subtitle):
    """Build a complete store screenshot."""
    # Create header gradient
    header = create_gradient(TARGET_W, HEADER_H, gradient_top, gradient_bottom)
    draw = ImageDraw.Draw(header)
    
    # Draw headline text
    headline_font = get_bold_font(56)
    subtitle_font = get_font(32)
    
    # Center headline vertically in header
    headline_bbox = draw.textbbox((0, 0), headline, font=headline_font)
    subtitle_bbox = draw.textbbox((0, 0), subtitle, font=subtitle_font)
    total_text_h = (headline_bbox[3] - headline_bbox[1]) + 20 + (subtitle_bbox[3] - subtitle_bbox[1])
    start_y = (HEADER_H - total_text_h) // 2
    
    draw_centered_text(draw, headline, start_y, headline_font)
    draw_centered_text(draw, subtitle, start_y + (headline_bbox[3] - headline_bbox[1]) + 20, subtitle_font, fill=(255, 255, 255, 220))
    
    # Load and resize the original screenshot
    screenshot = Image.open(os.path.join(SCREENSHOTS_DIR, src_file))
    # Resize screenshot to fit: width = TARGET_W, height = SCREENSHOT_H
    # Maintain aspect ratio, center crop if needed
    sw, sh = screenshot.size
    scale = max(TARGET_W / sw, SCREENSHOT_H / sh)
    new_sw = int(sw * scale)
    new_sh = int(sh * scale)
    screenshot = screenshot.resize((new_sw, new_sh), Image.LANCZOS)
    
    # Center crop
    left = (new_sw - TARGET_W) // 2
    top = (new_sh - SCREENSHOT_H) // 2
    screenshot = screenshot.crop((left, top, left + TARGET_W, top + SCREENSHOT_H))
    
    # Composite
    final = Image.new('RGB', (TARGET_W, TARGET_H))
    final.paste(header, (0, 0))
    final.paste(screenshot, (0, HEADER_H))
    
    # Save
    store_path = os.path.join(STORE_DIR, out_name)
    brain_name = out_name.replace("screenshot_", "ss").replace("_meal_planner", "1_meal_planner").replace("_calendar", "2_calendar").replace("_grocery", "3_grocery").replace("_swaps", "4_swaps").replace("_pantry", "5_pantry")
    brain_path = os.path.join(BRAIN_DIR, brain_name)
    
    final.save(store_path, "PNG")
    final.save(brain_path, "PNG")
    print(f"OK {out_name}: {TARGET_W}x{TARGET_H}")
    return final

# Build all 5 screenshots
configs = [
    ("Main.jpeg", "screenshot_1_meal_planner.png",
     (230, 81, 0), (255, 143, 0),  # Orange gradient
     "AI-Powered Weekly Meals", "Personalized for your family"),
    
    ("Calendar.jpeg", "screenshot_2_calendar.png",
     (0, 105, 92), (0, 77, 64),  # Teal gradient
     "Schedule & Track Your Meals", "Calendar view with daily meal planning"),
    
    ("Grocery.jpeg", "screenshot_3_grocery.png",
     (46, 125, 50), (27, 94, 32),  # Green gradient
     "Smart Grocery Lists", "Auto-generated from your meal plan"),
    
    ("Swaps.jpeg", "screenshot_4_swaps.png",
     (216, 67, 21), (191, 54, 12),  # Red-orange gradient
     "Quick Swaps & AI Ideas", "Fresh alternatives at your fingertips"),
    
    ("Pantry.jpeg", "screenshot_5_pantry.png",
     (69, 39, 160), (49, 27, 146),  # Purple gradient
     "Snap Your Fridge", "AI scans your ingredients & suggests meals"),
]

for src, out, top_c, bot_c, headline, subtitle in configs:
    build_screenshot(src, out, top_c, bot_c, headline, subtitle)

print(f"\nAll 5 screenshots built at {TARGET_W}x{TARGET_H}!")
print(f"Output: {STORE_DIR}")

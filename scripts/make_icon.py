"""
Erstellt das MeinFinanzblick App-Icon (.icns) aus Python/Pillow.
Design: 4 aufsteigende Balken (gold) auf dunklem Hintergrund, Baseline unten.
"""
from PIL import Image, ImageDraw
import os, subprocess, shutil
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
ICONSET = PROJECT / "scripts" / "MeinFinanzblick.iconset"
ICONSET.mkdir(exist_ok=True)


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = size

    # Abgerundetes Hintergrund-Quadrat
    pad = round(s * 0.0)
    radius = round(s * 0.22)
    d.rounded_rectangle([pad, pad, s - pad - 1, s - pad - 1],
                         radius=radius, fill=(17, 17, 17, 255))

    # Balken-Parameter
    bar_w   = round(s * 0.138)
    gap     = round(s * 0.038)
    margin  = round(s * 0.175)
    bottom  = round(s * 0.795)
    heights = [0.20, 0.32, 0.50, 0.68]
    alphas  = [60,   128,  191,  255]

    total_w = 4 * bar_w + 3 * gap
    x_start = (s - total_w) // 2

    gold = (201, 168, 76)

    for i, (h_pct, alpha) in enumerate(zip(heights, alphas)):
        bar_h = round(s * h_pct)
        x0 = x_start + i * (bar_w + gap)
        y0 = bottom - bar_h
        x1 = x0 + bar_w
        y1 = bottom
        r  = max(2, round(bar_w * 0.28))
        fill = (*gold, alpha)
        d.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=fill)

    # Baseline
    bl_y = bottom + round(s * 0.028)
    bl_x0 = x_start - round(s * 0.02)
    bl_x1 = x_start + total_w + round(s * 0.02)
    bl_w  = max(1, round(s * 0.014))
    d.rounded_rectangle([bl_x0, bl_y, bl_x1, bl_y + bl_w],
                         radius=bl_w // 2, fill=(*gold, 55))

    return img


# macOS iconset Größen
SIZES = [
    ("icon_16x16.png",       16),
    ("icon_16x16@2x.png",    32),
    ("icon_32x32.png",       32),
    ("icon_32x32@2x.png",    64),
    ("icon_128x128.png",    128),
    ("icon_128x128@2x.png", 256),
    ("icon_256x256.png",    256),
    ("icon_256x256@2x.png", 512),
    ("icon_512x512.png",    512),
    ("icon_512x512@2x.png",1024),
]

print("Erstelle Icon-Größen...")
for filename, px in SIZES:
    img = draw_icon(px)
    img.save(ICONSET / filename, "PNG")
    print(f"  ✓ {filename} ({px}px)")

# .icns erstellen
icns_out = PROJECT / "scripts" / "MeinFinanzblick.icns"
result = subprocess.run(
    ["iconutil", "-c", "icns", str(ICONSET), "-o", str(icns_out)],
    capture_output=True, text=True
)
if result.returncode != 0:
    print("Fehler:", result.stderr)
    exit(1)

print(f"\n✓ Icon erstellt: {icns_out}")

# In App-Bundle kopieren
app_resources = PROJECT / "MeinFinanzblick.app" / "Contents" / "Resources"
app_resources.mkdir(exist_ok=True)
shutil.copy(icns_out, app_resources / "AppIcon.icns")
print(f"✓ In App-Bundle installiert")

# Iconset aufräumen
shutil.rmtree(ICONSET)
print("✓ Fertig")

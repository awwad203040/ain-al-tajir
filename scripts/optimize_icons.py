from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
TARGETS = {
    "assets/images/icon.png": (1024, 1024),
    "assets/images/splash-icon.png": (1024, 1024),
    "assets/images/favicon.png": (256, 256),
    "assets/images/android-icon-foreground.png": (1024, 1024),
}


for relative_path, size in TARGETS.items():
    path = ROOT / relative_path
    with Image.open(path) as source:
        image = source.convert("RGBA")
        if image.size != size:
            image = image.resize(size, Image.Resampling.LANCZOS)
        optimized = image.quantize(colors=128, method=Image.Quantize.FASTOCTREE)
        optimized.save(path, format="PNG", optimize=True)
    print(f"optimized {relative_path}: {path.stat().st_size} bytes")

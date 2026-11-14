"""Fail if any screenshot is blank or too small."""
import glob
import os
import sys

from PIL import Image, ImageStat

folder = sys.argv[1]
bad = []
for path in sorted(glob.glob(os.path.join(folder, "*.png"))):
    im = Image.open(path).convert("L")
    stat = ImageStat.Stat(im)
    w, h = im.size
    std = stat.stddev[0]
    ok = std > 5 and w >= 300 and h >= 300
    print(f"{os.path.basename(path):14s} {w}x{h} std={std:.1f} {'ok' if ok else 'BLANK/SMALL'}")
    if not ok:
        bad.append(path)

if bad:
    print("FAILED:", bad)
    sys.exit(1)

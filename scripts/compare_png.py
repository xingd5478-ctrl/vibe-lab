"""Compare screenshots against baselines; fail if changed pixels exceed threshold."""
import glob
import os
import sys

from PIL import Image, ImageChops

baseline_dir, actual_dir = sys.argv[1], sys.argv[2]
threshold = float(sys.argv[3]) if len(sys.argv) > 3 else 0.003
pixel_tol = 12

bad = []
actuals = sorted(glob.glob(os.path.join(actual_dir, "*.png")))
if not actuals:
    print("no screenshots found")
    sys.exit(1)

for actual in actuals:
    name = os.path.basename(actual)
    base = os.path.join(baseline_dir, name)
    if not os.path.exists(base):
        print(f"{name:16s} MISSING BASELINE")
        bad.append(name)
        continue
    a = Image.open(base).convert("RGB")
    b = Image.open(actual).convert("RGB")
    if a.size != b.size:
        print(f"{name:16s} SIZE {a.size} -> {b.size}")
        bad.append(name)
        continue
    diff = ImageChops.difference(a, b).convert("L")
    hist = diff.histogram()
    changed = sum(hist[pixel_tol + 1:])
    total = a.size[0] * a.size[1]
    ratio = changed / total
    status = "ok" if ratio <= threshold else "CHANGED"
    print(f"{name:16s} {ratio * 100:.3f}% {status}")
    if ratio > threshold:
        bad.append(name)

if bad:
    print("FAILED:", ", ".join(bad))
    print("If the change is intentional, run: npm run visual:update")
    sys.exit(1)

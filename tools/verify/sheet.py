# Contact sheet of rendered frames, each labelled with its story position (from the file name u<u>-<tag>.jpg) and its
# Watch time (from the film's own clock, score.js).
# Usage: python3 tools/verify/sheet.py OUT.jpg COLS SCALE frame1.jpg frame2.jpg ...
import sys, re, json, subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
REPO = Path(__file__).resolve().parents[2]
out, cols, scale = sys.argv[1], int(sys.argv[2]), float(sys.argv[3])
files = sys.argv[4:]
us = [float(re.search(r'u([0-9.]+)-', f.split('/')[-1]).group(1)) for f in files]
js = "const { watchT } = await import('%s'); console.log(JSON.stringify(%s.map(u => watchT(u))));" % ((REPO / 'assets/cinderfall/score.js').as_uri(), json.dumps(us))
ts = json.loads(subprocess.run(['node', '--input-type=module', '-e', js], capture_output=True, text=True, cwd=str(REPO)).stdout)
ims = [Image.open(f).convert('RGB') for f in files]
w, h = int(ims[0].width * scale), int(ims[0].height * scale)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w, rows * (h + 18)), (18, 18, 18))
d = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
except Exception: font = ImageFont.load_default()
for i, (im, u, t) in enumerate(zip(ims, us, ts)):
    x, y = (i % cols) * w, (i // cols) * (h + 18)
    sheet.paste(im.resize((w, h)), (x, y + 18))
    d.text((x + 4, y + 2), f"u {u:.3f}  t {int(t // 60)}:{t % 60:05.2f}", fill=(235, 235, 235), font=font)
sheet.save(out, quality=85)
print(out, sheet.size)

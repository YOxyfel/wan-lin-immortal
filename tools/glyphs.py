# Extract CJK glyph outlines (Noto Serif CJK, SIL Open Font License) as SVG path data for in-page calligraphy.
from fontTools.ttLib import TTCollection
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import json, sys
chars = sys.argv[1]  # e.g. python tools/glyphs.py "玄烬落村..." assets/cinderfall/glyphs.js
out = sys.argv[2]
col = TTCollection('/usr/share/fonts/opentype/noto/NotoSerifCJK-Black.ttc')
font = None
for f in col.fonts:
    name = f['name'].getDebugName(1)
    if 'TC' in name:
        font = f; break
gs = font.getGlyphSet(); cmap = font.getBestCmap(); upm = font['head'].unitsPerEm
asc = 880
res = {}
for ch in chars:
    g = cmap.get(ord(ch))
    if not g:
        print('missing', ch); continue
    pen = SVGPathPen(gs)
    # flip y so the path is in a 1000-unit, y-down em box (top = 0)
    tp = TransformPen(pen, (1000 / upm, 0, 0, -1000 / upm, 0, asc * 1000 / upm))
    gs[g].draw(tp)
    res[ch] = {'d': pen.getCommands(), 'w': round(gs[g].width * 1000 / upm)}
with open(out, 'w') as f:
    f.write('// Glyph outlines from Noto Serif CJK TC Black (SIL Open Font License 1.1). 1000-unit em, y down.\n')
    f.write('export const GLYPHS = ' + json.dumps(res, ensure_ascii=False) + ';\n')
print(len(res), 'glyphs', sum(len(v['d']) for v in res.values()), 'chars of path')

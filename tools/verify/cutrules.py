# The film's cut rules, checked on every frame of Watch (cutscan.cjs output). Prints each shot, then every rule
# broken (FAIL) or close to it (WARN). Exit code 1 if anything fails.
#   python3 cutrules.py frames.json [--allow U0:U1 ...] [--quiet]
# Rules:
#   SHORT     no shot under 0.75 s (designed flashes are allowed with --allow)
#   TELEPORT  he never jumps along the road at a cut, unless the cut is inside a whiteout (page white >= 0.85)
#   JUMP      a cut between two shots of him turns the lens 30 deg or more, or changes his size by half again
#   LENS      the lens never comes within 0.5 m of him (0.35 m: inside him)
#   FACE      his face is never turned to the lens (head on screen, the lens in front of his face)
#   TURN      he turns no faster than a person does (body 180 deg/s, head 250 deg/s); WARN from 120 / 160
#   ELDER     the old man's head likewise
#   CAMERA    within a shot the lens never whips (turn rate jumping by more than 90 deg/s within a tenth of a second)
#   DOG       the dog never jumps within a shot, never appears in the middle of the frame
#   DIR       screen direction flips at a cut (WARN)
import json, sys, math
args = sys.argv[1:]
F = json.load(open(args[0]))
allow = [tuple(map(float, a.split(':'))) for i, a in enumerate(args) if i > 0 and args[i - 1] == '--allow']
quiet = '--quiet' in args
def sub(a, b): return [a[i] - b[i] for i in range(3)]
def norm(a): return math.sqrt(sum(x * x for x in a))
def dot(a, b): return sum(a[i] * b[i] for i in range(3))
def ang(a, b):
    c = dot(a, b) / (norm(a) * norm(b) + 1e-12)
    return math.degrees(math.acos(max(-1, min(1, c))))
def allowed(u): return any(a <= u <= b for a, b in allow)
n = len(F)
dc = [0] + [norm(sub(F[i]['cam'], F[i - 1]['cam'])) for i in range(1, n)]
da = [0] + [ang(F[i]['dir'], F[i - 1]['dir']) for i in range(1, n)]
dp = [0] + [norm(sub(F[i]['P'], F[i - 1]['P'])) if F[i]['P'] and F[i - 1]['P'] else 0 for i in range(1, n)]
cuts = []
for i in range(1, n):
    nb_c = max(dc[i - 1] if i > 1 else 0, dc[i + 1] if i + 1 < n else 0)
    nb_a = max(da[i - 1] if i > 1 else 0, da[i + 1] if i + 1 < n else 0)
    if (dc[i] > 0.5 and dc[i] > 3 * nb_c + 0.2) or (da[i] > 6 and da[i] > 3 * nb_a + 2) or dp[i] > 0.8:
        cuts.append(i)
cutset = set(cuts)
out = []
def report(level, i, rule, msg):
    out.append((level, F[i]['t'], F[i]['u'], rule, msg))
def onscreen(f, key='head'):
    h = f.get(key)
    return bool(h) and h[2] < 1 and abs(h[0]) < 1.05 and abs(h[1]) < 1.05
def size(f):
    if not f['vis'] or not f['head'] or not f['feet'] or f['head'][2] > 1 or f['feet'][2] > 1: return None
    return abs(f['head'][1] - f['feet'][1])
def wht(i): return max(F[j]['white'] for j in range(max(0, i - 1), min(n, i + 1)))
bounds = [0] + cuts + [n]
shots = [(bounds[k], bounds[k + 1]) for k in range(len(bounds) - 1)]
# ---- shots and cuts
for k, (a, b) in enumerate(shots):
    dur = F[b - 1]['t'] - F[a]['t'] + (1 / 30)
    first = a > 0 and k + 1 < len(shots)
    if dur < 0.75 and 0 < a and b < n and not allowed(F[a]['u']): report('FAIL', a, 'SHORT', f'shot of {dur:.2f} s')
for i in cuts:
    A, B = F[i - 1], F[i]
    w = wht(i)
    if dp[i] > 0.8 and w < 0.85 and not allowed(B['u']): report('FAIL', i, 'TELEPORT', f'he jumps {dp[i]:.1f} m at the cut (page white {w:.2f})')
    sa, sb = size(A), size(B)
    if A['vis'] and B['vis'] and onscreen(A) and onscreen(B) and sa and sb:
        ratio = sb / sa
        if da[i] < 30 and 0.67 < ratio < 1.5 and not allowed(B['u']):
            report('WARN' if w >= 0.85 else 'FAIL', i, 'JUMP', f'lens turns {da[i]:.0f} deg, his size x{ratio:.2f}')
    def mot(i0, i1):
        a, b = F[i0], F[i1]
        if not a['feet'] or not b['feet'] or b['t'] == a['t'] or a['feet'][2] > 1 or b['feet'][2] > 1: return None
        return (b['feet'][0] - a['feet'][0]) / (b['t'] - a['t'])
    ma, mb = mot(max(0, i - 5), i - 1), mot(i, min(n - 1, i + 4))
    if ma is not None and mb is not None and ma * mb < 0 and abs(ma) > 0.08 and abs(mb) > 0.08: report('WARN', i, 'DIR', f'screen direction {ma:+.2f} -> {mb:+.2f}')
# ---- every frame
prev_rate = None
for i in range(n):
    f = F[i]
    if f['vis'] and f['near'] is not None and f['near'] < 0.5 and not allowed(f['u']):
        report('FAIL', i, 'LENS', f"lens {f['near']:.2f} m from him")
    if f['vis'] and f['hf'] and f['hp'] and onscreen(f):
        to_cam = sub(f['cam'], f['hp'])
        dist = norm(to_cam)
        a = ang(f['hf'], to_cam)
        if dist < 25 and not allowed(f['u']):
            if a < 80: report('FAIL', i, 'FACE', f'lens {a:.0f} deg off his face, {dist:.1f} m')
            elif a < 100: report('WARN', i, 'FACE', f'profile: lens {a:.0f} deg off his face, {dist:.1f} m')
    if i == 0 or i in cutset: continue
    g = F[i - 1]
    dt = f['t'] - g['t']
    if dt <= 0: continue
    if f['yaw'] is not None and g['yaw'] is not None and f['vis']:
        dy = abs(math.degrees(math.atan2(math.sin(f['yaw'] - g['yaw']), math.cos(f['yaw'] - g['yaw'])))) / dt
        if dy > 180: report('FAIL', i, 'TURN', f'his body turns {dy:.0f} deg/s')
        elif dy > 120: report('WARN', i, 'TURN', f'his body turns {dy:.0f} deg/s')
    if f['hf'] and g['hf'] and f['vis']:
        dh = ang(f['hf'], g['hf']) / dt
        if dh > 250: report('FAIL', i, 'TURN', f'his head turns {dh:.0f} deg/s')
        elif dh > 160: report('WARN', i, 'TURN', f'his head turns {dh:.0f} deg/s')
    if f['ef'] and g['ef'] and f['ev'] and onscreen(f, 'ehead'):
        dh = ang(f['ef'], g['ef']) / dt
        if dh > 200: report('FAIL', i, 'ELDER', f'his uncle\'s head turns {dh:.0f} deg/s')
        elif dh > 120: report('WARN', i, 'ELDER', f'his uncle\'s head turns {dh:.0f} deg/s')
    rate = da[i] / dt
    if prev_rate is not None and i - 1 not in cutset and not allowed(f['u']):
        if abs(rate - prev_rate) > 90 * dt / 0.1 and max(rate, prev_rate) > 30: report('WARN', i, 'CAMERA', f'lens turn rate {prev_rate:.0f} -> {rate:.0f} deg/s')
        if rate > 120: report('FAIL', i, 'CAMERA', f'lens whips at {rate:.0f} deg/s')
    prev_rate = rate
    if f['dv'] and g['dv'] and f['dp'] and g['dp']:
        jd = norm(sub(f['dp'], g['dp']))
        if jd > 0.5: report('FAIL', i, 'DOG', f'the dog jumps {jd:.2f} m')
    if f['dv'] and onscreen(f, 'dndc') and (not g['dv'] or not onscreen(g, 'dndc')):
        x, y = f['dndc'][0], f['dndc'][1]
        if abs(x) < 0.8 and abs(y) < 0.8: report('FAIL', i, 'DOG', f'the dog appears mid-frame at ({x:.2f}, {y:.2f})')
# ---- the report: shots, then the rules broken (runs of the same rule merged)
print(f"{n} frames, {F[0]['t']:.2f}-{F[-1]['t']:.2f} s of Watch (u {F[0]['u']:.2f}-{F[-1]['u']:.2f}); {len(shots)} shots, {len(cuts)} cuts")
for k, (a, b) in enumerate(shots):
    dur = F[b - 1]['t'] - F[a]['t'] + (1 / 30)
    s0 = size(F[a])
    print(f"  shot {k + 1:2d}: t {F[a]['t']:7.2f}-{F[b - 1]['t']:7.2f} ({dur:5.2f} s)  u {F[a]['u']:.3f}-{F[b - 1]['u']:.3f}" + (f"  in: turn {da[a]:5.1f} deg, lens {dc[a]:5.1f} m, he {dp[a]:4.1f} m, white {wht(a):.2f}" if a > 0 else ''))
merged = []
for o in sorted(out, key=lambda o: (o[3], o[1])):
    if merged and merged[-1][3] == o[3] and merged[-1][0] == o[0] and o[1] - merged[-1][6] < 0.2:
        m = merged[-1]; merged[-1] = (m[0], m[1], m[2], m[3], m[4], m[5] + 1, o[1], o[2], m[8] if m[8][0] >= 0 else m[8])
        continue
    merged.append((o[0], o[1], o[2], o[3], o[4], 1, o[1], o[2], (0,)))
fails = [m for m in merged if m[0] == 'FAIL']
warns = [m for m in merged if m[0] == 'WARN']
for m in sorted(merged, key=lambda m: m[1]):
    if quiet and m[0] == 'WARN': continue
    span = f" .. {m[6]:.2f}s (u {m[7]:.3f}), {m[5]} frames" if m[5] > 1 else ''
    print(f"{m[0]} {m[3]:8s} t {m[1]:7.2f}s u {m[2]:.3f}{span}: {m[4]}")
print(f"{len(fails)} FAIL, {len(warns)} WARN")
sys.exit(1 if fails else 0)

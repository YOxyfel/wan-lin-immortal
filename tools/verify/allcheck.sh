#!/bin/bash
# Every cut rule over the passages the film has been cut-checked in: the morning, the walk and the road to the pines;
# the fight above the clouds; the run home. Scans every frame of Watch (30 a second, low quality: positions only)
# and runs cutrules.py on each. Takes a while in the cloud container (software GL): run it in the background.
# Usage: tools/verify/allcheck.sh TAG [PORT]   (scans go to $CF_OUT, default /tmp/cinderfall-verify/cuts)
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${CF_OUT:-/tmp/cinderfall-verify}/cuts"
TAG=${1:?usage: allcheck.sh TAG [PORT]}
PORT=${2:-8007}
mkdir -p "$OUT"
URL="http://127.0.0.1:$PORT/index.html?debug&warm=0&q=low"
node "$HERE/serve.cjs" "$PORT" bash -c "
  node '$HERE/cutscan.cjs' 9.6 46.6 '$OUT/walk-$TAG.json' 30 '$URL' > '$OUT/scan-walk-$TAG.log' 2>&1 &
  node '$HERE/cutscan.cjs' 46.5 56 '$OUT/war-$TAG.json' 30 '$URL' > '$OUT/scan-war-$TAG.log' 2>&1 &
  wait
  node '$HERE/cutscan.cjs' 63.6 81.4 '$OUT/home-$TAG.json' 30 '$URL' > '$OUT/scan-home-$TAG.log' 2>&1
" > /dev/null
grep -h "pageerror" "$OUT"/scan-*-"$TAG".log
echo "=== the morning, the walk, the road to the pines"
python3 "$HERE/cutrules.py" "$OUT/walk-$TAG.json" --quiet
echo "=== the fight above the clouds"
# (the launch's own fast moves, up through the crown and the well, and the dive's chase of the gold one's light down
# through the storm, are designed: allowed)
python3 "$HERE/cutrules.py" "$OUT/war-$TAG.json" --quiet --allow 47.42:48.5 --allow 52.47:54.45
echo "=== the run home"
# (the memory of the morning is a designed flash; in the room he is drawn black against the door: allowed)
python3 "$HERE/cutrules.py" "$OUT/home-$TAG.json" --quiet --allow 64.77:64.91 --allow 80.97:83.5

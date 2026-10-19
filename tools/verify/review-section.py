# Put a round's notes into cinderfall-review.md: replace everything from the round's heading to the end of the file
# with the notes (the newest round is always the last section). Usage: python3 tools/verify/review-section.py NOTES.md
# (the notes start with their own heading, e.g. "## Round 15: ...")
import sys
from pathlib import Path
doc = Path(__file__).resolve().parents[2] / 'cinderfall-review.md'
r = open(sys.argv[1]).read().strip('\n') + '\n'
head = r.splitlines()[0].split(':')[0]
s = doc.read_text()
i = s.find(head + ':')
s = (s[:i] if i >= 0 else s.rstrip('\n') + '\n\n') + r
doc.write_text(s)
print(head, 'section:', len(r.splitlines()), 'lines; doc', len(s.splitlines()), 'lines')

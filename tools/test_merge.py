#!/usr/bin/env python3
# SPDX-License-Identifier: CC0-1.0
"""Self-test for tools/merge.py:  python3 tools/test_merge.py"""
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
base = "# header\n# share: https://relay.example/submit\nGala\tFreed From Desire\tEmile & Image\tLes Demons De Minuit\t1\n"
subs = [
    {"key": "sub:1", "tsv": "GALA\tFreed From Desire (Extended Mix)\tEmile & Image\tLes Demons De Minuit (Original Mix)\t1\n"
                            "New A\tSong 1\tNew B\tSong 2\t1\nbad\tline\n"},
    {"key": "sub:2", "tsv": "New A\tSong 1\tNew B\tSong 2\t1\nNew A\tSong 1 (Original Mix)\tNew B\tSong 2\t1\n"
                            "Same\tTrack\tSame\tTrack\t1\n"},
]
with tempfile.TemporaryDirectory() as d:
    p, pend, ack = (os.path.join(d, n) for n in ("p.tsv", "pending.json", "acked.json"))
    open(p, "w").write(base)
    json.dump(subs, open(pend, "w"))
    subprocess.run([sys.executable, os.path.join(HERE, "merge.py"), pend, p, ack], check=True)
    lines = open(p).read().splitlines()
    fails = []
    if lines[:2] != base.splitlines()[:2]: fails.append("header changed")
    if lines[2] != "Gala\tFreed From Desire\tEmile & Image\tLes Demons De Minuit\t2": fails.append("count not raised: " + lines[2])
    if "New A\tSong 1\tNew B\tSong 2\t2" not in lines: fails.append("new transition not added once and raised once")
    if any(l.startswith("Same\t") for l in lines) or any(l.startswith("bad") for l in lines): fails.append("bad lines kept")
    if json.load(open(ack)) != ["sub:1", "sub:2"]: fails.append("acked keys")
    if subprocess.run([sys.executable, os.path.join(HERE, "check.py"), p], capture_output=True).returncode:
        fails.append("result does not pass check.py")
for f in fails: print("FAIL", f)
print("merge test:", "FAILED" if fails else "ok")
sys.exit(1 if fails else 0)

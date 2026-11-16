#!/usr/bin/env python3
# SPDX-License-Identifier: CC0-1.0
"""Merges the transitions decks shared through the relay into pairings.tsv.

    python3 tools/merge.py pending.json pairings.tsv acked.json

pending.json is the relay's /pending answer: [{"key": ..., "tsv": ...}, ...]. Each submission
adds 1 to a transition's count (capped at 50), or appends it with count 1. Lines that would
not pass tools/check.py are skipped. The keys of every submission read go to acked.json, so the
workflow can tell the relay to drop them once the result is committed.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from check import norm  # noqa: E402  the same title matching as the checker and Mix Pilot

MAX_COUNT = 50


def valid(f):
    return (len(f) >= 4 and all(x.strip() and len(x) <= 200 for x in f[:4])
            and (norm(f[0]), norm(f[1])) != (norm(f[2]), norm(f[3])))


def main(pending_path, pairings_path, acked_path):
    pending = json.load(open(pending_path, encoding="utf-8")) if os.path.exists(pending_path) else []
    lines = open(pairings_path, encoding="utf-8").read().split("\n")
    if lines and lines[-1] == "":
        lines.pop()
    index = {}                                    # normalized transition -> line number
    for i, line in enumerate(lines):
        if not line.strip() or line.startswith("#"):
            continue
        f = line.split("\t")
        if len(f) >= 4:
            index[tuple(norm(x) for x in f[:4])] = i

    added = bumped = skipped = 0
    acked = []
    for sub in pending:
        if not isinstance(sub, dict) or not isinstance(sub.get("tsv"), str):
            continue
        acked.append(sub.get("key"))
        seen = set()
        for raw in sub["tsv"].split("\n"):
            f = [x.strip() for x in raw.split("\t")]
            if not valid(f):
                skipped += raw.strip() != ""
                continue
            key = tuple(norm(x) for x in f[:4])
            if key in seen:
                continue
            seen.add(key)
            if key in index:
                g = lines[index[key]].split("\t")
                while len(g) < 5:
                    g.append("1")
                count = int(g[4]) if g[4].strip().isdigit() else 1
                g[4] = str(min(MAX_COUNT, count + 1))
                lines[index[key]] = "\t".join(g)
                bumped += 1
            else:
                lines.append("\t".join(f[:4] + ["1"]))
                index[key] = len(lines) - 1
                added += 1

    open(pairings_path, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    json.dump([k for k in acked if isinstance(k, str)], open(acked_path, "w"))
    print(f"{len(pending)} submissions: {added} new transitions, {bumped} counts raised, {skipped} lines skipped")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    sys.exit(main(*sys.argv[1:]))

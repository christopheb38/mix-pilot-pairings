#!/usr/bin/env python3
# SPDX-License-Identifier: CC0-1.0
"""Checks pairings.tsv: the format Mix Pilot reads, nothing it would skip or misread.

    python3 tools/check.py [pairings.tsv]

Every non-comment line: From artist, From title, To artist, To title, then optionally a count
(a whole number from 1 to 50) and a date, separated by single tabs. No empty names, no line
twice (add the counts instead), no transition from a track to itself, plain UTF-8.
"""
import re
import sys
import unicodedata

# Version notes Mix Pilot ignores when it matches titles (a named remix is kept).
NOISE = ("original", "extended", "radio", "club mix", "main mix", "clean", "explicit", "dirty",
         "remaster", "feat", "ft.", "featuring", "album version", "intro", "outro")


def drop_noise(s):
    def keep(m):
        inner = m.group(0).lower()
        noisy = any(w in inner for w in NOISE)
        named_remix = ("remix" in inner or " rework" in inner or " vip" in inner) and "feat" not in inner
        return "" if noisy and not named_remix else m.group(0)
    s = re.sub(r"[(\[][^)\]]*[)\]]", keep, s)
    return re.split(r"\s(?:feat\.?|ft\.?|featuring)\s", s, flags=re.I)[0]


def norm(s):
    s = unicodedata.normalize("NFKD", drop_noise(s).lower())
    return " ".join("".join(c for c in s if c.isalnum() or c == " ").split())


def main(path):
    problems, seen, n = [], {}, 0
    try:
        data = open(path, "rb").read().decode("utf-8")
    except UnicodeDecodeError as e:
        print(f"{path}: not UTF-8 ({e})")
        return 1
    for no, line in enumerate(data.split("\n"), 1):
        line = line.rstrip("\r")
        if not line.strip() or line.startswith("#"):
            continue
        f = line.split("\t")
        where = f"line {no}"
        if len(f) < 4 or len(f) > 6:
            problems.append(f"{where}: {len(f)} fields, want 4 to 6 separated by tabs")
            continue
        if any(not x.strip() for x in f[:4]):
            problems.append(f"{where}: an artist or title is empty")
            continue
        if len(f) >= 5 and f[4].strip():
            if not f[4].strip().isdigit() or not 1 <= int(f[4]) <= 50:
                problems.append(f"{where}: count '{f[4]}' is not a whole number from 1 to 50")
        key = (norm(f[0]), norm(f[1]), norm(f[2]), norm(f[3]))
        if key[:2] == key[2:]:
            problems.append(f"{where}: a track to itself")
        if key in seen:
            problems.append(f"{where}: same transition as line {seen[key]}: add to its count instead")
        seen.setdefault(key, no)
        n += 1
    for p in problems:
        print(f"{path}: {p}")
    print(f"{path}: {n} transitions, {len(problems)} problems")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "pairings.tsv"))

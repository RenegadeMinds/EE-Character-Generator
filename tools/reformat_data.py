#!/usr/bin/env python3
# =============================================================================
# tools/reformat_data.py — Phase 2: lay the game catalogs out one record per line
# =============================================================================
#
# WHAT THIS SCRIPT DOES
#   The catalogs in js/data/ (spells, magic items, weapons, ...) are JSON
#   tables wrapped in a JavaScript const, each between a pair of marker
#   comments (JSON:NAME before it, END:NAME after it). Before Phase 2 they
#   came in two awkward shapes:
#     - one enormous line (SPELLS_DB was a single 1.2 MB line, so changing
#       one spell showed up in Git as "this 1.2 MB line changed"), or
#     - one FIELD per line (MAGIC_ITEMS_DB ran to 8,386 lines), so a single
#       item was smeared across dozens of lines.
#   This script rewrites every table so that each RECORD (one spell, one
#   weapon, one magic item) sits on its own line:
#
#       const SPELLS_DB = <marker> [
#         {"name": "Acid Arrow", "school_raw": ..., ...},
#         {"name": "Acid Fog", ...},
#         ...
#       ] <marker>;
#
#   Tables that are objects rather than lists (DAMAGE_TYPES, MUTATION_RULES,
#   ...) get one top-level key per line, and any list of records inside
#   them gets one record per line too.
#
# THE ONE PROMISE IT KEEPS
#   Only line breaks and spaces change. Before writing a file, the script
#   parses the new text back and checks that every table holds exactly the
#   same values, keys in exactly the same order, as before. It also checks
#   that everything outside the tables (the code, the comments, the
#   markers) is untouched apart from the file header note it adds. If any
#   check fails, nothing is written.
#
# HOW TO RUN IT
#     python tools/reformat_data.py            reformat (safe to re-run:
#                                              an already-reformatted file
#                                              comes out the same)
#     python tools/reformat_data.py --check    report only; exit 1 if any
#                                              table is not in this layout
#
# WHY JSON VALUES ARE SAFE TO RE-SPACE
#   The tables are plain JSON inside JavaScript. JSON and JavaScript read
#   the same text into the same values no matter how it is spaced, so
#   re-spacing cannot change what the app sees. (The headless battery's
#   _probe_split_parity.mjs confirms it in a real browser: every table's
#   value after start-up is compared between the old and new builds.)
# =============================================================================

import argparse
import glob
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATA_GLOB = "js/data/*.js"

# A table starts with:   = /*<<JSON:NAME>>*/ <json value>
MARKER = re.compile(r"= /\*<<JSON:(\w+)>>\*/ ")

# The note added to each reformatted file's header, just above the sentinel.
NOTE = [
    "// PHASE 2 LAYOUT (tools/reformat_data.py)",
    "//   The data tables below were re-laid-out ONE RECORD PER LINE, so a change",
    "//   to one entry shows up in Git as a one-line change. Only line breaks and",
    "//   spaces changed: every value, and the order of every key, is identical",
    "//   (the tool checks this before writing). Everything else in this file,",
    "//   including the marker comments around each table, is unchanged.",
]
NOTE_TITLE = NOTE[0]
OLD_SENTINEL = re.compile(r"^// ---- verbatim from index\.html (v[\d.]+), lines (\d+-\d+); unchanged below this line ----$", re.M)
NEW_SENTINEL = r"// ---- from index.html \1, lines \2; data tables re-laid-out one record per line (values unchanged) ----"


def compact(value):
    """One value as a single line of JSON, spaced like the original data."""
    s = json.dumps(value, ensure_ascii=False, separators=(", ", ": "))
    # U+2028/U+2029 are legal in JSON strings and in modern JavaScript, but
    # some older tools treat them as line breaks. Escaping them is free.
    return s.replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")


def is_record_list(v):
    return isinstance(v, list) and len(v) >= 2 and all(isinstance(x, dict) for x in v)


def is_record_map(v):
    return isinstance(v, dict) and len(v) >= 2 and all(isinstance(x, dict) for x in v.values())


def layout(value):
    """The table in its Phase 2 layout (no trailing newline)."""
    if isinstance(value, list):
        if not value:
            return "[]"
        return "[\n" + ",\n".join("  " + compact(x) for x in value) + "\n]"
    if isinstance(value, dict):
        lines = []
        for k, v in value.items():
            key = compact(k)
            if is_record_list(v):
                inner = ",\n".join("    " + compact(x) for x in v)
                lines.append(f"  {key}: [\n{inner}\n  ]")
            elif is_record_map(v):
                inner = ",\n".join(f"    {compact(k2)}: {compact(v2)}" for k2, v2 in v.items())
                lines.append(f"  {key}: {{\n{inner}\n  }}")
            else:
                lines.append(f"  {key}: {compact(v)}")
        return "{\n" + ",\n".join(lines) + "\n}"
    return compact(value)


def tables(text):
    """[(name, value, start, end)] for every table in `text`."""
    dec = json.JSONDecoder()
    out = []
    for m in MARKER.finditer(text):
        value, end = dec.raw_decode(text, m.end())
        out.append((m.group(1), value, m.end(), end))
    return out


def fingerprint(value):
    """Exact identity of a value INCLUDING key order (dict == ignores order)."""
    return json.dumps(value, ensure_ascii=False)


def reformat_text(text):
    """Return the reformatted file text (or the same text if nothing to do)."""
    found = tables(text)
    if not found:
        return text, []
    pieces, pos = [], 0
    for name, value, start, end in found:
        pieces.append(text[pos:start])
        pieces.append(layout(value))
        pos = end
    pieces.append(text[pos:])
    new = "".join(pieces)

    # Header: add the note once, refresh the sentinel, drop stale sentences.
    if NOTE_TITLE not in new:
        new, n = OLD_SENTINEL.subn(lambda m: "\n".join(NOTE) + "\n" +
                                   m.expand(NEW_SENTINEL), new, count=1)
        if n != 1:
            raise SystemExit("ERROR: could not find the Phase 1 header sentinel")
    return new, [n for n, *_ in found]


def verify(old, new):
    """The promise: same tables, same values, same order; same code around them."""
    a, b = tables(old), tables(new)
    if [x[0] for x in a] != [x[0] for x in b]:
        return "table names/order changed"
    for (na, va, *_), (nb, vb, *_) in zip(a, b):
        if fingerprint(va) != fingerprint(vb):
            return f"{na}: values differ"
    # Everything after the header, with each table's text cut out, must match.
    def outside(text, tabs):
        body = text[text.index("// ---- ", text.index("WHERE IT CAME FROM")):]
        body = body[body.index("\n") + 1:]
        off = len(text) - len(body)
        parts, pos = [], 0
        for *_, s, e in tabs:
            parts.append(body[pos:s - off])
            pos = e - off
        parts.append(body[pos:])
        return "\u0000".join(parts)
    if outside(old, a) != outside(new, b):
        return "code outside the tables changed"
    return None


def main():
    ap = argparse.ArgumentParser(description="Lay js/data tables out one record per line.")
    ap.add_argument("--check", action="store_true", help="report only; exit 1 if any table needs reformatting")
    args = ap.parse_args()

    files = sorted(glob.glob(str(REPO / DATA_GLOB)))
    pending, total_tables = 0, 0
    for f in files:
        path = Path(f)
        old = path.read_text(encoding="utf-8")
        new, names = reformat_text(old)
        if not names:
            continue
        total_tables += len(names)
        rel = path.relative_to(REPO).as_posix()
        if new == old:
            print(f"  ok      {rel} ({', '.join(names)})")
            continue
        problem = verify(old, new)
        if problem:
            print(f"ERROR   {rel}: {problem}. Nothing written.", file=sys.stderr)
            sys.exit(2)
        if args.check:
            pending += 1
            print(f"  NEEDS   {rel} ({', '.join(names)})")
            continue
        with open(path, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(new)
        print(f"  wrote   {rel}: {old.count(chr(10)):,} -> {new.count(chr(10)):,} lines "
              f"({', '.join(names)}; values verified identical)")
    print(f"{total_tables} tables in {DATA_GLOB}" +
          (f"; {pending} file(s) need reformatting" if args.check else ""))
    sys.exit(1 if pending else 0)


if __name__ == "__main__":
    main()

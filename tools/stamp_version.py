#!/usr/bin/env python3
# =============================================================================
# tools/stamp_version.py — stamp the release version onto every file link
# =============================================================================
#
# WHY THIS EXISTS
#   Browsers keep copies of the files a page loads (the "cache") so the page
#   opens faster next time. Since the Phase 1 split the generator is ~70
#   files instead of one. Without a version tag, a player could load a NEW
#   index.html alongside OLD cached copies of some js/ files after a
#   release, and the app could break in confusing ways until the cache
#   expires.
#
#   The fix is a version tag on every link:
#       <script src="js/ui/sheet/sheet.js?v=9.19.0"></script>
#   When the version changes, every link changes, so every browser fetches
#   fresh copies. The server ignores the ?v= part; it only matters to the
#   browser's cache.
#
# WHERE THE VERSION COMES FROM
#   One place: CG_VERSION in js/core/state.js (the number the app
#   shows in bug reports). This tool copies it onto every <script src> and
#   stylesheet <link> in index.html, and checks that the subtitle under the
#   title banner ("... · v9.19.0") shows the same number.
#
# THE RELEASE CHECKLIST (what to do when bumping the version)
#   1. Change CG_VERSION in js/core/state.js.
#   2. Change the version at the end of the subtitle in index.html
#      (search for "site-subtitle").
#   3. Run:  python tools/stamp_version.py
#   Step 3 also catches a forgotten step 2.
#
# HOW TO RUN IT
#     python tools/stamp_version.py           stamp index.html
#     python tools/stamp_version.py --check   report only; exit 1 if anything
#                                             is missing or out of date
# =============================================================================

import argparse
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
VERSION_FILE = REPO / "js/core/state.js"
INDEX = REPO / "index.html"

VERSION_RE = re.compile(r"^const CG_VERSION = 'v(\d+\.\d+\.\d+)';", re.M)
# Local script and stylesheet links (not http(s) links, not images or fonts:
# those almost never change, and the logo probe checks the logo's exact path).
LINK_RE = re.compile(r'(<script src="|<link rel="stylesheet" href=")((?:js|css)/[^"?]+)(?:\?v=[^"]*)?(")')
SUBTITLE_RE = re.compile(r'<div class="site-subtitle">[^<]*· v(\d+\.\d+\.\d+)</div>')


def main():
    ap = argparse.ArgumentParser(description="Stamp ?v=<CG_VERSION> onto index.html's script/stylesheet links.")
    ap.add_argument("--check", action="store_true", help="report only; exit 1 if anything needs fixing")
    args = ap.parse_args()

    m = VERSION_RE.search(VERSION_FILE.read_text(encoding="utf-8"))
    if not m:
        sys.exit(f"ERROR: no CG_VERSION line found in {VERSION_FILE.relative_to(REPO)}")
    version = m.group(1)

    html = INDEX.read_text(encoding="utf-8")
    problems = []

    sub = SUBTITLE_RE.search(html)
    if not sub:
        problems.append("could not find the version in the site-subtitle line of index.html")
    elif sub.group(1) != version:
        problems.append(f"the subtitle shows v{sub.group(1)} but CG_VERSION is v{version}: "
                        "update the subtitle in index.html (this tool does not change visible text)")

    links = LINK_RE.findall(html)
    stale = [p for _, p, _ in links if f'{p}?v={version}"' not in html]
    new = LINK_RE.sub(lambda m: f"{m.group(1)}{m.group(2)}?v={version}{m.group(3)}", html)

    if args.check:
        if stale:
            problems.append(f"{len(stale)} of {len(links)} links lack ?v={version} (run without --check to fix)")
        for p in problems:
            print("  PROBLEM: " + p)
        print(f"v{version}: {len(links)} links checked" + ("" if problems else ", all stamped"))
        sys.exit(1 if problems else 0)

    if new != html:
        with open(INDEX, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(new)
    print(f"v{version}: stamped {len(links)} links in index.html ({len(stale)} changed)")
    for p in problems:
        print("  PROBLEM: " + p)
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()

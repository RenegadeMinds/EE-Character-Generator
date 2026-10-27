#!/usr/bin/env python3
# =============================================================================
# tools/build_standalone.py — rebuild ONE self-contained HTML file
# =============================================================================
#
# WHY THIS EXISTS
#   Since the Phase 1 split the generator is index.html plus css/, js/ and
#   assets/ folders. That is what the website serves, and it is what people
#   should edit. But a single file is still handy: it can be emailed,
#   dropped on a USB stick, or opened offline with a double-click, with no
#   folders to keep together.
#
#   This tool glues everything back into one file, the same shape as the
#   pre-split generator:
#     - each <link rel="stylesheet"> becomes a <style> block,
#     - the font and the logo become base64 data: URLs again,
#     - each <script src> becomes an inline <script> block, in the same order.
#   Nothing in the code is changed; it is only copied inline.
#
#   The output is a BUILD PRODUCT, not something to edit: change the files
#   in css/ and js/, then rebuild. dist/ is listed in .gitignore.
#
# HOW TO RUN IT
#     python tools/build_standalone.py
#   writes dist/EpicsAndEpochs_Character_Generator_v<version>.html
#   (the version comes from CG_VERSION, as in tools/stamp_version.py).
#
# CHECKING IT
#   The standalone file should behave exactly like the folder version:
#     OLD=index.html NEW=dist/EpicsAndEpochs_Character_Generator_v<version>.html \
#       node battery/_probe_split_parity.mjs
# =============================================================================

import base64
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
INDEX = REPO / "index.html"
VERSION_FILE = REPO / "js/app/42-player-tools.js"
OUT_DIR = REPO / "dist"

MIME = {".ttf": "font/ttf", ".woff": "font/woff", ".woff2": "font/woff2",
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
        ".svg": "image/svg+xml"}


def fail(msg):
    sys.exit("ERROR: " + msg)


def local(path_with_query):
    """Repository file for a link like 'js/app/49-sheet.js?v=9.19.0'."""
    p = REPO / path_with_query.split("?")[0]
    if not p.is_file():
        fail(f"index.html links to {path_with_query}, which does not exist")
    return p


def data_url(path):
    mime = MIME.get(path.suffix.lower())
    if not mime:
        fail(f"don't know the file type of {path.name}")
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}"


def inline_css(m):
    css_path = local(m.group(1))
    css = css_path.read_text(encoding="utf-8")

    # url('...') inside a stylesheet is relative to the stylesheet's folder.
    def embed(u):
        target = (css_path.parent / u.group(2)).resolve()
        if not target.is_file():
            fail(f"{css_path.name} refers to {u.group(2)}, which does not exist")
        return f"url({data_url(target)})"
    css = re.sub(r"""url\((['"]?)(?!data:|https?:)([^'")]+)\1\)""", embed, css)
    if re.search(r"</style", css, re.I):
        fail(f"{css_path.name} contains '</style', which would end the inline block early")
    return f"<style>\n{css}</style>"


def inline_js(m):
    js_path = local(m.group(1))
    js = js_path.read_text(encoding="utf-8")
    # Inside an inline <script>, the text '</script' ends the block no matter
    # where it appears (even inside a string). '<!--' is harmless on its own
    # (the print sheet's HTML template has a few), but '<!--' followed later
    # by '<script' switches the browser into a mode that can swallow the
    # rest of the page. The pre-split file was valid, so neither should
    # ever appear; this guards future edits.
    if re.search(r"</script", js, re.I) or re.search(r"<!--[\s\S]*<script", js, re.I):
        fail(f"{js_path.name} contains '</script' (or '<!--' then '<script'), which is unsafe inline")
    return f"<script>\n{js}</script>"


def main():
    m = re.search(r"^const CG_VERSION = 'v(\d+\.\d+\.\d+)';", VERSION_FILE.read_text(encoding="utf-8"), re.M)
    if not m:
        fail("no CG_VERSION in " + str(VERSION_FILE))
    version = m.group(1)

    html = INDEX.read_text(encoding="utf-8")
    html, n_css = re.subn(r'<link rel="stylesheet" href="((?:css)/[^"]+)">', inline_css, html)
    html, n_js = re.subn(r'<script src="(js/[^"]+)"></script>', inline_js, html)
    html, n_img = re.subn(r'(<img\b[^>]*\bsrc=")(assets/[^"]+)(")',
                          lambda g: g.group(1) + data_url(local(g.group(2))) + g.group(3), html)
    leftovers = re.findall(r'(?:src|href)="((?:js|css|assets)/[^"]+)"', html)
    if leftovers:
        fail(f"still linked after inlining: {leftovers[:3]}")

    OUT_DIR.mkdir(exist_ok=True)
    out = OUT_DIR / f"EpicsAndEpochs_Character_Generator_v{version}.html"
    with open(out, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(html)
    print(f"wrote {out.relative_to(REPO).as_posix()} ({out.stat().st_size / 1e6:.1f} MB): "
          f"{n_js} scripts, {n_css} stylesheets, {n_img} images inlined")


if __name__ == "__main__":
    main()

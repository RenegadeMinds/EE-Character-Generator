// _serve.mjs — shared helpers for serving the Character Generator to the
// headless test scripts.
//
// WHY THIS FILE EXISTS
//   Until v9.19.0 the generator was one self-contained index.html, so every
//   probe started a tiny web server that answered EVERY request with that one
//   file. Since the Phase 1 split (tools/split_index.py) the page pulls in
//   css/, js/ and assets/ files beside it. A server that answers every request
//   with index.html would hand the browser HTML where it asked for JavaScript,
//   and the app would fail to start.
//
//   appRequestHandler() fixes that in one place: "/" (and "/index.html") still
//   serves the page the probe read, possibly modified by the probe, while
//   every other path is served from the folder that page lives in. It works
//   for both the split layout and an old single-file build.
//
//   readAppSource() exists for the probes that search the SOURCE TEXT for
//   things (for example "no hard-coded violet colour remains"). It returns
//   index.html plus every stylesheet and script it references, joined in
//   page order, so those searches see all the code, as they did when it was
//   one file.

import { readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Returns a request handler for node:http createServer().
//   html      the page to serve at "/" (Buffer or string), already read by
//             the probe (and possibly modified by it)
//   pagePath  the path of the page FILE that `html` came from; every other
//             request is served from the folder that file sits in
export function appRequestHandler(html, pagePath) {
  const base = dirname(resolve(pagePath));
  return (req, res) => {
    const path = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
    if (path === '/' || path === '/index.html') {
      res.writeHead(200, { 'content-type': TYPES['.html'] });
      res.end(html);
      return;
    }
    // The browser asks for /favicon.ico by itself. The app has none, and a 404
    // would show up as a console error that the probes' "console clean"
    // checks count. Answer "No Content", as battery.mjs always did.
    if (path === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    // Resolve inside `base` only; refuse anything that climbs out of it.
    const file = normalize(join(base, path));
    if (file !== base && !file.startsWith(base + sep)) { res.writeHead(403); res.end(); return; }
    try {
      if (!statSync(file).isFile()) throw new Error('not a file');
      res.writeHead(200, { 'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(readFileSync(file));
    } catch {
      // A genuinely missing file: 404, which the browser reports as a console
      // error. That is deliberate: a missing css/js/asset file should fail
      // the probes' console checks.
      res.writeHead(404);
      res.end();
    }
  };
}

// The page's full source text: index.html, then each <link rel="stylesheet">
// and <script src> it references (local files only), in the order they appear.
export function readAppSource(htmlPath) {
  const html = readFileSync(htmlPath, 'utf8');
  const root = dirname(resolve(htmlPath));
  const refs = [...html.matchAll(/<(?:script[^>]*\ssrc|link[^>]*\shref)="([^"]+)"/g)]
    .map(m => m[1])
    .filter(u => !/^[a-z]+:/i.test(u) && /\.(js|css)(\?|$)/.test(u));
  return [html, ...refs.map(u => readFileSync(join(root, u.split('?')[0]), 'utf8'))].join('\n');
}

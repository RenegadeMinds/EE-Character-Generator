// _check_load_order.mjs — proves the js/ files can't trip over each other at load.
//
// WHY THIS EXISTS
//   index.html loads ~120 plain <script> files that share one global scope.
//   A function in any file may call a function in any other file AFTER the
//   page has loaded. The only danger is code that runs WHILE the page loads
//   and uses something from a file that hasn't loaded yet. The layout is
//   designed so that danger is confined to two places, and this script checks
//   every file against those rules without running the app:
//
//     js/core/, js/rules/, js/ui/   declarations ONLY: functions, tables,
//                                   state. Nothing in them may use another
//                                   app name while loading.
//     js/data/ (incl. catalogs/)    tables, plus a few table fix-ups that run
//                                   at load. Anything they use (and anything
//                                   the functions they call use) must already
//                                   be declared: in an earlier file, or
//                                   earlier in the same file.
//     js/main.js                    start-up. Must be the last script.
//
//   It also checks that no global name is declared twice (in one script that
//   is an error; across scripts the later one silently wins), and that every
//   file index.html loads exists and parses.
//
// USAGE
//   node _check_load_order.mjs            (checks ../index.html)
//   CG_FILE=path/to/index.html node _check_load_order.mjs
// Exit 0 = all rules hold.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';

const __dir = dirname(fileURLToPath(import.meta.url));
const INDEX = process.env.CG_FILE || resolve(__dir, '../index.html');
const ROOT = dirname(INDEX);
const html = readFileSync(INDEX, 'utf8');
const files = [...html.matchAll(/<script src="(js\/[^"?]+)(?:\?[^"]*)?"><\/script>/g)].map(m => m[1]).filter(f => f !== 'js/boot.js');

const problems = [];
const bad = (msg) => problems.push(msg);

const isFn = n => n && (n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression' || n.type === 'FunctionDeclaration');
function refs(node, loadOnly) {
  const out = new Set();
  const visit = (n, parent, key) => {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'Identifier') {
      if (parent && parent.type === 'MemberExpression' && key === 'property' && !parent.computed) return;
      if (parent && (parent.type === 'Property' || parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition') && key === 'key' && !parent.computed) return;
      if (parent && /Labeled|Break|Continue/.test(parent.type)) return;
      out.add(n.name); return;
    }
    if (loadOnly && isFn(n) && !(parent && parent.type === 'CallExpression' && key === 'callee')) return;
    for (const k of Object.keys(n)) {
      if (k === 'type' || k === 'start' || k === 'end') continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach(c => visit(c, n, k));
      else if (v && typeof v.type === 'string') visit(v, n, k);
    }
  };
  if (loadOnly && node.type === 'FunctionDeclaration') return out;
  visit(node, null, null);
  return out;
}
function declared(n) {
  if (n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') return [n.id.name];
  if (n.type !== 'VariableDeclaration') return [];
  const names = [];
  const pat = p => { if (!p) return; if (p.type === 'Identifier') names.push(p.name); else if (p.type === 'ObjectPattern') p.properties.forEach(q => pat(q.value || q.argument)); else if (p.type === 'ArrayPattern') p.elements.forEach(pat); else if (p.type === 'AssignmentPattern') pat(p.left); else if (p.type === 'RestElement') pat(p.argument); };
  n.declarations.forEach(d => pat(d.id));
  return names;
}

// ---- parse everything -----------------------------------------------------
const items = [];                 // {file, fi, k, node, names, isDecl}
const where = new Map();          // name -> {fi, k, isFunction}
files.forEach((f, fi) => {
  const p = join(ROOT, f);
  if (!existsSync(p)) { bad(`${f}: listed in index.html but missing`); return; }
  let ast;
  try { ast = acorn.parse(readFileSync(p, 'utf8'), { ecmaVersion: 'latest', sourceType: 'script' }); }
  catch (e) { bad(`${f}: does not parse: ${e.message}`); return; }
  ast.body.forEach((node, k) => {
    const names = declared(node);
    const isDecl = /Declaration$/.test(node.type);
    items.push({ file: f, fi, k, node, names, isDecl });
    for (const n of names) {
      if (where.has(n)) bad(`"${n}" is declared twice: ${files[where.get(n).fi]} and ${f}`);
      else where.set(n, { fi, k, isFunction: node.type === 'FunctionDeclaration' || (node.type === 'VariableDeclaration' && node.declarations.length === 1 && isFn(node.declarations[0].init)), node });
    }
  });
});
if (files[files.length - 1] !== 'js/main.js') bad(`js/main.js must be the last script (last is ${files[files.length - 1]})`);

// Everything a load-time use pulls in: if it calls an app function, that
// function's body runs too, so its references count (transitively).
function closure(names) {
  const seen = new Set(), stack = [...names];
  while (stack.length) {
    const n = stack.pop();
    if (seen.has(n) || !where.has(n)) continue;
    seen.add(n);
    const w = where.get(n);
    if (w.isFunction) for (const r of refs(w.node, false)) if (where.has(r)) stack.push(r);
  }
  return seen;
}

let loadTimeItems = 0;
for (const it of items) {
  const area = it.file.startsWith('js/data/') ? 'data' : it.file === 'js/main.js' ? 'main' : 'decl';
  const uses = [...refs(it.node, true)].filter(r => where.has(r) && !it.names.includes(r));
  if (area === 'decl') {
    if (!it.isDecl) bad(`${it.file}: a top-level statement (${it.node.type}) runs while the page loads; move it to js/main.js`);
    if (uses.length) bad(`${it.file}: ${it.names.join(',') || it.node.type} uses ${uses.join(', ')} while the page loads`);
    continue;
  }
  if (!uses.length) continue;
  loadTimeItems++;
  if (area === 'main') continue;            // last file: everything exists
  for (const n of closure(uses)) {
    const w = where.get(n);
    const ok = w.fi < it.fi || (w.fi === it.fi && (w.k < it.k || w.isFunction));
    if (!ok) bad(`${it.file}: ${it.names.join(',') || it.node.type} needs "${n}" at load, but it is declared later (${files[w.fi]})`);
  }
}

console.log(`== LOAD-ORDER CHECK == ${files.length} scripts · ${where.size} global names · ${loadTimeItems} items that run at load (data fix-ups + main.js)`);
for (const p of problems) console.log('  ✗ ' + p);
console.log(problems.length ? `RED — ${problems.length} problem(s)` : 'GREEN — every rule holds');
process.exit(problems.length ? 1 : 0);

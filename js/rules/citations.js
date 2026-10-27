// =============================================================================
// js/rules/citations.js
// CITATIONS — GAME RULES
// =============================================================================
//
// WHAT'S IN HERE
//   Game rules: calculations and changes to a character record. Drawing
//   pages lives in js/ui/; a few rules functions ask it to refresh after a
//   change. Book page citations: looking them up and formatting them.
//
// KEY NAMES (so you can search for them)
//   functions (4): citationDomainCounts, getCitation, formatCitation,
//   citeHTML
//
// WHERE IT CAME FROM
//   Gathered from js/rules/25-citation-helpers-feats-talents-db.js when the
//   code was regrouped by topic and page. Each function and table moved
//   whole and unchanged, with the comments above it, including the original
//   version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// v8.3.14: Citation domain counts for diagnostics. Useful for verifying
// the derived view is built correctly at load time and for surfacing in
// future "show me all citations to page N" tooling.
function citationDomainCounts() {
  const out = {};
  for (const domain in CITATIONS) {
    out[domain] = Object.keys(CITATIONS[domain] || {}).length;
  }
  return out;
}

// Lookup helper. Returns null if no citation exists. Domain is one of
// "races","classes","feats","skills","talents","occupations","classFeatures","synergies".
// For approximate citations the caller can decide whether to display them
// differently (e.g. "~p.XX").
function getCitation(domain, name) {
  return (CITATIONS[domain] || {})[name] || null;
}

// Format a citation as a short label like "HH 145" or "GG ~p.187".
function formatCitation(cit, opts) {
  if (!cit) return "";
  opts = opts || {};
  const prefix = cit.approx ? "~" : "";
  if (opts.long) {
    const bookFull = {HH:"Hero's Handbook", GG:"GM's Guide", FF:"Foe Folio"}[cit.book] || cit.book;
    return bookFull + ", p. " + prefix + cit.page;
  }
  return cit.book + " " + prefix + cit.page;
}

// citeHTML — render a citation as an inline color-keyed superscript element.
// Returns "" if no citation found. The title attribute carries the full
// long-form citation for hover-to-confirm.
function citeHTML(domain, name) {
  const cit = getCitation(domain, name);
  if (!cit) return "";
  const approxCls = cit.approx ? " cite-approx" : "";
  const long = formatCitation(cit, {long:true});
  const short = formatCitation(cit);
  return `<span class="cite cite-${cit.book}${approxCls}" title="${long}${cit.approx?' (approximate — book chapter)':''}">${short}</span>`;
}

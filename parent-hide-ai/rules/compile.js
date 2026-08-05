// ---------------------------------------------------------------------------
// compile.js — turns config.js into declarativeNetRequest rules.
// You should not need to edit this.
// ---------------------------------------------------------------------------

// Chrome caps a single regexFilter at 2KB of *compiled* RE2 program — in
// practice only ~100-150 characters of case-insensitive pattern. So: hosts are
// matched with the requestDomains condition (not regex), and each term gets
// its own small rule instead of sharing one big alternation.

const RE_META = /[.*+?^${}()|[\]\\]/g;

// A space between words can appear as " ", "+", "%20", "%2B", "-", "_", "."
// or nothing at all once URL-encoded. Any 0-3 characters covers all of them.
// It must be ".", not a character class: Chrome's 2KB compiled-regex budget
// fits only ~10 classes per rule (measured empirically — each class costs
// ~150-200 bytes compiled), while "." and literals are nearly free.
const SPACE = ".{0,3}";

/**
 * Convert one config term into a regex fragment.
 * "/diet/" -> whole-word match. Anything else -> substring match.
 */
export function termToPattern(term) {
  const wholeWord = term.length > 2 && term.startsWith("/") && term.endsWith("/");
  const body = wholeWord ? term.slice(1, -1) : term;

  const escaped = body
    .trim()
    .toLowerCase()
    .replace(RE_META, "\\$&")
    .replace(/\s+/g, SPACE);

  return wholeWord ? `\\b${escaped}\\b` : escaped;
}

/**
 * Build the regexFilter for one term.
 *
 * Anatomy:
 *   ^[^#]*        scheme, host and path (host is enforced by requestDomains);
 *                 also lets {param} sit anywhere in the query string
 *   [?&]{param}=  the parameter carrying the search terms, at a real boundary
 *   ([^&#]*term)  capture group 1: the query up to and including the hit
 *
 * The regex must match from ^ because regexSubstitution replaces the matched
 * span — an unanchored match would leave the original URL prefix in front of
 * the block-page URL.
 */
function termRegex(param, term) {
  return `^[^#]*[?&]${param}=([^&#]*(?:${termToPattern(term)}))`;
}

/**
 * @param {object} cfg    the module namespace from config.js
 * @param {string} target extension URL of the block page
 * @returns {chrome.declarativeNetRequest.Rule[]}
 */
export function buildRules(cfg, target) {
  const rules = [];
  let id = 1;

  // Engines sharing a query param share one requestDomains list.
  const domainsByParam = new Map();
  for (const engine of cfg.SEARCH_ENGINES) {
    const list = domainsByParam.get(engine.param) || [];
    for (const d of engine.domains) if (!list.includes(d)) list.push(d);
    domainsByParam.set(engine.param, list);
  }

  for (const [param, requestDomains] of domainsByParam) {
    for (const term of cfg.BLOCKED_TERMS.filter(Boolean)) {
      rules.push({
        id: id++,
        priority: 2,
        condition: {
          regexFilter: termRegex(param, term),
          isUrlFilterCaseSensitive: false,
          requestDomains,
          resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest"],
        },
        action: {
          type: "redirect",
          // \1 is the captured query, already URL-encoded.
          redirect: { regexSubstitution: `${target}?reason=term&q=\\1` },
        },
      });
    }
  }

  for (const domain of cfg.BLOCKED_DOMAINS.filter(Boolean)) {
    rules.push({
      id: id++,
      priority: 1,
      condition: {
        urlFilter: `||${domain}^`,
        resourceTypes: ["main_frame"],
      },
      action: {
        type: "redirect",
        redirect: {
          url: `${target}?reason=site&host=${encodeURIComponent(domain)}`,
        },
      },
    });
  }

  return rules;
}

// ---------------------------------------------------------------------------
// compile.js — turns config.js into declarativeNetRequest rules.
// You should not need to edit this.
// ---------------------------------------------------------------------------

// Chrome caps the compiled size of a single regexFilter, so terms are split
// across several rules rather than jammed into one giant alternation.
const TERMS_PER_RULE = 20;

const RE_META = /[.*+?^${}()|[\]\\]/g;

// Separators a space can turn into once a query is URL-encoded.
const SPACE = "(?:\\+|%20|%2[bB]|[-_.])";

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

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Build the regexFilter for one engine + one batch of terms.
 *
 * Anatomy:
 *   ^https?://          scheme
 *   (?:[a-z0-9-]+\.)*   any subdomains
 *   {host}              the engine
 *   {path}[^?#]*        the search path, plus anything before the query
 *   \?(?:[^#]*&)?       the query string, {param} need not come first
 *   {param}=            the parameter carrying the search terms
 *   ([^&#]*(?:terms))   capture group 1: the query up to and including a hit
 */
function engineRegex(engine, terms) {
  const path = engine.path === "/" ? "" : engine.path.replace(/\/$/, "");
  const alternation = terms.map(termToPattern).join("|");
  return (
    `^https?://(?:[a-z0-9-]+\\.)*${engine.host}${path}[^?#]*` +
    `\\?(?:[^#]*&)?${engine.param}=([^&#]*(?:${alternation}))`
  );
}

/**
 * @param {object} cfg    the module namespace from config.js
 * @param {string} target extension URL of the block page
 * @returns {chrome.declarativeNetRequest.Rule[]}
 */
export function buildRules(cfg, target) {
  const rules = [];
  let id = 1;

  const batches = chunk(cfg.BLOCKED_TERMS.filter(Boolean), TERMS_PER_RULE);

  for (const engine of cfg.SEARCH_ENGINES) {
    for (const terms of batches) {
      rules.push({
        id: id++,
        priority: 2,
        condition: {
          regexFilter: engineRegex(engine, terms),
          isUrlFilterCaseSensitive: false,
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

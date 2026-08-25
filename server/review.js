// ---------------------------------------------------------------------------
// review.js — pure logic for the nightly AI blocklist review.
//
// No network, no KV, no Anthropic calls — everything here is unit-tested
// offline by tests/review.test.mjs. worker.js wires these functions to the
// cron trigger and the Claude API.
// ---------------------------------------------------------------------------

// Same pattern semantics as the extension's DNR rules: substring by default,
// "/word/" for whole-word, spaces match up to 3 arbitrary characters.
import { termToPattern } from "../parent-hide-ai/rules/compile.js";

// How many terms one review run may add. A nightly cap bounds the blast
// radius of a bad model day: at worst 15 over-broad terms, visible in the
// audit record and removable with one PUT /config.
export const MAX_NEW_TERMS_PER_RUN = 15;

// Proposed terms must be plain words the DNR compiler can take verbatim:
// lowercase letters/digits with spaces, hyphens or apostrophes inside, 3-40
// chars, optionally wrapped in slashes for whole-word. Anything regex-ish is
// rejected — Chrome's 2KB compiled-regex cap punishes fancy patterns.
const TERM_RE = /^\/?[a-z0-9][a-z0-9' -]{1,38}[a-z0-9]\/?$/;

/**
 * Compile a term list into a single predicate over decoded query strings,
 * mirroring what the installed rules would block.
 */
export function termMatcher(terms) {
  const regexes = (terms || [])
    .filter(Boolean)
    .map((t) => {
      try {
        return new RegExp(termToPattern(t), "i");
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  return (query) => regexes.some((re) => re.test(query));
}

/**
 * Pull the unique queries that got THROUGH the filter out of one day's
 * uploads (wire format of POST /log: {machine, blocked[], searches[]}).
 * Entries with blocked:true were already caught; they are not review input.
 */
export function unblockedQueries(uploads) {
  const seen = new Set();
  const out = [];
  for (const u of uploads || []) {
    const searches = Array.isArray(u?.searches) ? u.searches : [];
    for (const s of searches) {
      if (s?.blocked) continue;
      const q = String(s?.q || "").trim().toLowerCase().slice(0, 200);
      if (!q || seen.has(q)) continue;
      seen.add(q);
      out.push({ q, host: String(s?.host || "").slice(0, 100) });
    }
  }
  return out;
}

const bare = (t) => t.replace(/^\//, "").replace(/\/$/, "");

/**
 * Vet the model's proposals before they touch the blocklist. Model output is
 * never trusted verbatim: bad syntax, duplicates, and terms an existing rule
 * already covers are dropped, and the batch is capped.
 *
 * @returns {{accepted: {term, reason}[], rejected: {term, why}[]}}
 */
export function vetProposals(proposals, existingTerms, limit = MAX_NEW_TERMS_PER_RUN) {
  const covered = termMatcher(existingTerms);
  const existingBare = new Set((existingTerms || []).map((t) => bare(t.toLowerCase())));
  const accepted = [];
  const rejected = [];

  for (const p of proposals || []) {
    const term = String(p?.term || "").trim().toLowerCase();
    const reason = String(p?.reason || "").slice(0, 300);
    if (!TERM_RE.test(term)) {
      rejected.push({ term, why: "bad syntax" });
      continue;
    }
    if (term.startsWith("/") !== term.endsWith("/")) {
      rejected.push({ term, why: "unbalanced slashes" });
      continue;
    }
    if (existingBare.has(bare(term))) {
      rejected.push({ term, why: "already listed" });
      continue;
    }
    if (covered(bare(term))) {
      rejected.push({ term, why: "already covered by an existing term" });
      continue;
    }
    if (accepted.some((a) => bare(a.term) === bare(term))) continue;
    if (accepted.length >= limit) {
      rejected.push({ term, why: "over nightly cap" });
      continue;
    }
    accepted.push({ term, reason });
  }
  return { accepted, rejected };
}

/**
 * Render the parent-notification email for a review that added terms.
 * Plain text on purpose — it reads fine anywhere and can't mangle terms.
 */
export function formatReviewEmail(audit) {
  const added = audit?.added || [];
  const n = added.length;
  const subject = `Search Guard: ${n} term${n === 1 ? "" : "s"} added after reviewing ${audit.date}`;

  const lines = [
    `The nightly review of ${audit.date} added ${n} term${n === 1 ? "" : "s"} to the blocklist:`,
    "",
    ...added.map((a) => `  - "${a.term}"${a.reason ? ` — ${a.reason}` : ""}`),
    "",
  ];
  if (audit.notes) lines.push(`Reviewer notes: ${audit.notes}`, "");
  lines.push(
    `Reviewed ${audit.reviewed} got-through search${audit.reviewed === 1 ? "" : "es"}` +
      (audit.truncated ? ` (${audit.truncated} more not reviewed — over the nightly cap)` : "") +
      `. Blocklist version is now ${audit.configVersion}.`,
    "",
    "The device picks these up within 30 minutes. Full audit record:",
    `  curl <worker-url>/reviews?date=${audit.date} -H "Authorization: Bearer $ADMIN_KEY"`,
    "",
    "To undo a term: GET /config, remove it, and PUT /config back."
  );
  return { subject, text: lines.join("\n") };
}

/**
 * Merge accepted terms into the remote config additively. Domains are never
 * touched and terms are never removed — the review can only tighten, same
 * invariant as the extension's own remote merge.
 */
export function mergeConfig(config, newTerms) {
  const cur =
    config && Array.isArray(config.terms)
      ? config
      : { version: 0, terms: [], domains: [] };
  const terms = [...cur.terms];
  for (const t of newTerms || []) if (!terms.includes(t)) terms.push(t);
  return {
    version: Number.isFinite(cur.version) ? cur.version + 1 : 1,
    updatedAt: new Date().toISOString(),
    terms,
    domains: Array.isArray(cur.domains) ? cur.domains : [],
  };
}

// ---------------------------------------------------------------------------
// review.test.mjs — offline checks for the nightly-AI-review logic in
// server/review.js. No network, no KV, no Anthropic.
//
// Run with: npm run test:review
//
// The properties that matter: the matcher agrees with the extension's DNR
// semantics (a query the rules would block is never re-reviewed), model
// proposals are never trusted verbatim, and the merge is strictly additive.
// ---------------------------------------------------------------------------
import {
  termMatcher,
  unblockedQueries,
  vetProposals,
  mergeConfig,
  MAX_NEW_TERMS_PER_RUN,
} from "../server/review.js";

let failures = 0;
function check(name, cond, detail = "") {
  if (!cond) {
    failures++;
    console.log(`FAIL  ${name}${detail ? `\n      ${detail}` : ""}`);
  } else {
    console.log(`PASS  ${name}`);
  }
}

// --- termMatcher: same semantics as the compiled rules -----------------------

{
  const m = termMatcher(["calorie", "/diet/", "lose weight"]);
  check("substring term matches inside a query", m("how many calories in an apple"));
  check("substring term is case-insensitive", m("CALORIE counter"));
  check("whole-word term matches the bare word", m("keto diet plan"));
  check("whole-word term does not match inside a longer word", !m("dietary fiber study"));
  check("spaced term matches with a space", m("how to lose weight fast"));
  check("spaced term matches with no separator", m("loseweight tips"));
  check("unrelated query does not match", !m("civil war homework help"));
  check("empty term list matches nothing", !termMatcher([])("anything"));
}

// --- unblockedQueries: extraction from the /log wire format ------------------

{
  const uploads = [
    {
      machine: "chromebook",
      blocked: [{ at: 1, q: "thinspo" }],
      searches: [
        { at: 2, q: "Body Checking", host: "www.google.com", blocked: false },
        { at: 3, q: "thinspo", host: "www.google.com", blocked: true },
        { at: 4, q: "body checking", host: "www.tiktok.com", blocked: false },
        { at: 5, q: "  ", host: "www.google.com", blocked: false },
      ],
    },
    { machine: "chromebook", searches: [{ at: 6, q: "science fair ideas", blocked: false }] },
    { machine: "chromebook" }, // no searches key at all
  ];
  const qs = unblockedQueries(uploads);
  check(
    "blocked entries, blanks and duplicates are dropped",
    qs.length === 2,
    JSON.stringify(qs)
  );
  check("queries are lowercased", qs[0].q === "body checking");
  check("first-seen host is kept", qs[0].host === "www.google.com");
  check("empty upload list is fine", unblockedQueries([]).length === 0);
}

// --- vetProposals: model output is never trusted verbatim --------------------

{
  const existing = ["calorie", "/diet/", "thinspo"];
  const { accepted, rejected } = vetProposals(
    [
      { term: "body checking", reason: "body-image compulsion" },
      { term: "Calorie Counting", reason: "covered by calorie already" },
      { term: "thinspo", reason: "already listed" },
      { term: "/ana/", reason: "whole-word slang" },
      { term: "a.*b", reason: "regex smuggling" },
      { term: "/broken", reason: "unbalanced slashes" },
      { term: "x", reason: "too short" },
      { term: "body checking", reason: "duplicate within batch" },
    ],
    existing
  );
  const terms = accepted.map((a) => a.term);
  check(
    "good proposals survive",
    terms.length === 2 && terms.includes("body checking") && terms.includes("/ana/"),
    JSON.stringify(terms)
  );
  const why = Object.fromEntries(rejected.map((r) => [r.term, r.why]));
  check("term covered by an existing substring term is rejected",
    why["calorie counting"] === "already covered by an existing term");
  check("already-listed term is rejected", why["thinspo"] === "already listed");
  check("regex syntax is rejected", why["a.*b"] === "bad syntax");
  check("unbalanced slashes are rejected", "/broken" in why);
  check("too-short term is rejected", why["x"] === "bad syntax");

  const many = Array.from({ length: MAX_NEW_TERMS_PER_RUN + 5 }, (_, i) => ({
    term: `unique term number ${i}`,
    reason: "cap test",
  }));
  const capped = vetProposals(many, []);
  check(
    `nightly cap holds at ${MAX_NEW_TERMS_PER_RUN}`,
    capped.accepted.length === MAX_NEW_TERMS_PER_RUN &&
      capped.rejected.filter((r) => r.why === "over nightly cap").length === 5
  );
}

// --- mergeConfig: strictly additive ------------------------------------------

{
  const cur = { version: 7, updatedAt: "x", terms: ["old term"], domains: ["site.com"] };
  const merged = mergeConfig(cur, ["new term", "old term"]);
  check("existing terms are kept", merged.terms.includes("old term"));
  check("new terms are appended once", merged.terms.length === 2);
  check("domains are untouched", merged.domains.length === 1 && merged.domains[0] === "site.com");
  check("version is bumped", merged.version === 8);
  check("input object is not mutated", cur.terms.length === 1 && cur.version === 7);

  const fromEmpty = mergeConfig(null, ["a term"]);
  check(
    "missing config starts from the empty baseline",
    fromEmpty.version === 1 && fromEmpty.terms.length === 1 && fromEmpty.domains.length === 0
  );
}

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll review checks passed.");

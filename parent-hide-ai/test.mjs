// Run with: node test.mjs
import * as cfg from "./config.js";
import { buildRules } from "./rules/compile.js";

const rules = buildRules(cfg, "chrome-extension://test/blocked.html");
const regexRules = rules.filter((r) => r.condition.regexFilter);
const compiled = regexRules.map((r) => ({
  re: new RegExp(r.condition.regexFilter, "i"),
  domains: r.condition.requestDomains || null,
}));

// Mirror Chrome: requestDomains matches the domain itself or any subdomain.
function domainMatches(domains, url) {
  if (!domains) return true;
  const host = new URL(url).hostname;
  return domains.some((d) => host === d || host.endsWith("." + d));
}

const blocks = (url) =>
  compiled.some(({ re, domains }) => domainMatches(domains, url) && re.test(url));

// [url, shouldBlock] — add your own, especially "allow" cases.
const tests = [
  ["https://www.google.com/search?q=bmi+calculator", true],
  ["https://www.google.com/search?q=body+mass+index", true],
  ["https://www.google.com/search?client=fx&q=how+many+calories+in+an+apple", true],
  ["https://www.google.com/search?q=thinspo", true],
  ["https://www.google.co.uk/search?q=intermittent+fasting", true],
  ["https://duckduckgo.com/?q=goal%20weight", true],
  ["https://www.youtube.com/results?search_query=lose+weight+fast", true],
  ["https://www.bing.com/search?q=TDEE", true],
  ["https://www.reddit.com/search/?q=edtwt", true],
  ["https://www.pinterest.com/search/pins/?q=bonespo", true],
  ["https://www.youtube.com/results?search_query=how+much+should+i+weigh", true],
  ["https://www.tiktok.com/search?q=pro%20ana", true],
  ["https://search.yahoo.com/search?p=thinspo", true],

  ["https://www.google.com/search?q=diethyl+ether", false],
  ["https://www.google.com/search?q=banana+bread+recipe", false],
  ["https://www.google.com/search?q=weather+tomorrow", false],
  ["https://www.google.com/search?q=dietitian+near+me", false],
  ["https://www.google.com/search?q=history+of+rome", false],
  ["https://www.google.com/search?q=photosynthesis+diagram", false],
  ["https://www.google.com/search?q=calorimeter+chemistry", false],
];

let pass = 0, fail = 0;
for (const [url, want] of tests) {
  const got = blocks(url);
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`${ok ? "ok  " : "FAIL"}  expected ${want ? "block" : "allow"}  ${url}`);
}

// --- Remote-config merge: terms redirect, remote domains block --------------
// Mirrors what background.js mergedConfig() produces when remote config adds
// a term and a domain not present in config.js.
const merged = {
  ...cfg,
  BLOCKED_TERMS: [...cfg.BLOCKED_TERMS, "zzznewslang"],
  REMOTE_BLOCKED_DOMAINS: ["remote-example.com"],
};
const mergedRules = buildRules(merged, "chrome-extension://test/blocked.html");
const mergedRegex = mergedRules
  .filter((r) => r.condition.regexFilter)
  .map((r) => ({
    re: new RegExp(r.condition.regexFilter, "i"),
    domains: r.condition.requestDomains || null,
  }));

function check(name, got) {
  got ? pass++ : fail++;
  console.log(`${got ? "ok  " : "FAIL"}  ${name}`);
}

check(
  "remote term blocks on google",
  mergedRegex.some(
    ({ re, domains }) =>
      domainMatches(domains, "https://www.google.com/search?q=zzznewslang") &&
      re.test("https://www.google.com/search?q=zzznewslang")
  )
);
check(
  "remote domain gets a block rule (no host permission needed)",
  mergedRules.some(
    (r) =>
      r.condition.urlFilter === "||remote-example.com^" &&
      r.action.type === "block"
  )
);
check(
  "baked-in domains still redirect to the block page",
  mergedRules.some(
    (r) =>
      r.condition.urlFilter === "||myfitnesspal.com^" &&
      r.action.type === "redirect"
  )
);
check(
  "rule ids stay unique after merge",
  new Set(mergedRules.map((r) => r.id)).size === mergedRules.length
);

console.log(`\n${rules.length} rules (${regexRules.length} regex, max ${Math.max(...regexRules.map(r => r.condition.regexFilter.length))} chars)`);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

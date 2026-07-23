// Run with: node test.mjs
import * as cfg from "./config.js";
import { buildRules } from "./rules/compile.js";

const rules = buildRules(cfg, "chrome-extension://test/blocked.html");
const regexRules = rules.filter((r) => r.condition.regexFilter);
const compiled = regexRules.map((r) => new RegExp(r.condition.regexFilter, "i"));
const blocks = (url) => compiled.some((re) => re.test(url));

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

  ["https://www.google.com/search?q=diethyl+ether", false],
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

console.log(`\n${rules.length} rules (${regexRules.length} regex, max ${Math.max(...regexRules.map(r => r.condition.regexFilter.length))} chars)`);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

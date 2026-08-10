// ---------------------------------------------------------------------------
// smoke.mjs — loads the real extension in headless Chromium and verifies:
//   1. the service worker registers and installs its dynamic DNR rules
//   2. keyword/domain blocking actually redirects to blocked.html
//   3. the AI Mode URL transforms fire
//
// Run with: npm run test:smoke
// Needs no login and survives Google's CAPTCHA wall — blocked URLs redirect
// before any network request, and the udm checks only inspect the URL.
// ---------------------------------------------------------------------------
import { chromium } from "playwright";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const EXT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../parent-hide-ai");
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "phai-smoke-"));

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: true,
  channel: "chromium", // the default headless shell can't load extensions
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-search-engine-choice-screen",
    "--lang=en-US",
  ],
});

let sw = null;
for (let i = 0; i < 40 && !sw; i++) {
  sw = context.serviceWorkers()[0] || null;
  if (!sw) await new Promise((r) => setTimeout(r, 250));
}
if (!sw) {
  console.log("FAIL: service worker never registered — extension not loading");
  await context.close();
  process.exit(1);
}

await new Promise((r) => setTimeout(r, 1500));
const state = await sw.evaluate(async () => {
  const dynamic = await chrome.declarativeNetRequest.getDynamicRules();
  const storage = await chrome.storage.local.get([
    "sg_ruleCount",
    "sg_error",
    "sg_remote",
    "sg_remoteError",
  ]);
  return { dynamicCount: dynamic.length, ...storage };
});
console.log("state:", JSON.stringify(state));

let failures = 0;
if (state.sg_error) {
  failures++;
  console.log(`FAIL  rule install reported an error: ${state.sg_error}`);
}
if (state.dynamicCount === 0) {
  failures++;
  console.log("FAIL  no dynamic rules installed — Search Guard is inert");
}
// Only meaningful when config.js has a REMOTE_CONFIG_URL set: proves real
// Chrome fetched and cached the live remote blocklist.
const { REMOTE_CONFIG_URL } = await import(path.join(EXT, "config.js"));
if (REMOTE_CONFIG_URL) {
  if (!state.sg_remote) {
    failures++;
    console.log(
      `FAIL  remote config never landed (${state.sg_remoteError || "no error recorded"})`
    );
  } else {
    console.log(
      `PASS  remote config fetched: version ${state.sg_remote.version}, ` +
        `${state.sg_remote.terms.length} terms, ${state.sg_remote.domains.length} domains`
    );
  }
}

const page = await context.newPage();
async function nav(url, waitMs = 2500) {
  try {
    await page.goto(url, { waitUntil: "commit", timeout: 20000 });
  } catch {
    // navigation can be interrupted by the chrome.tabs.update backstop — fine
  }
  await new Promise((r) => setTimeout(r, waitMs));
  return page.url();
}

const cases = [
  ["keyword block (google)", "https://www.google.com/search?q=thinspo", (u) => u.includes("blocked.html")],
  ["keyword block (bing)", "https://www.bing.com/search?q=thinspo", (u) => u.includes("blocked.html")],
  ["keyword block multiword+case (youtube)", "https://www.youtube.com/results?search_query=How+MUCH+should+i+weigh", (u) => u.includes("blocked.html")],
  ["keyword block %20 (duckduckgo)", "https://duckduckgo.com/?q=goal%20weight", (u) => u.includes("blocked.html")],
  ["keyword block p-param (yahoo)", "https://search.yahoo.com/search?p=thinspo", (u) => u.includes("blocked.html")],
  ["allow innocent search", "https://www.bing.com/search?q=banana+bread+recipe", (u) => !u.includes("blocked.html")],
  ["domain block", "https://www.myfitnesspal.com/", (u) => u.includes("blocked.html")],
  ["domain block subdomain", "https://blog.noom.com/", (u) => u.includes("blocked.html")],
  ["udm=50 strip (q first)", "https://www.google.com/search?q=zebra&udm=50", (u) => !u.includes("udm=50")],
  ["udm=50 strip (udm first)", "https://www.google.com/search?udm=50&q=zebra", (u) => !u.includes("udm=50")],
  ["aimode redirect", "https://www.google.com/aimode?q=zebra", (u) => !u.includes("aimode")],
];

for (const [name, url, ok] of cases) {
  const final = await nav(url);
  const pass = ok(final);
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}\n      ${url}\n      -> ${final}`);
}

await context.close();
fs.rmSync(userDataDir, { recursive: true, force: true });
console.log(failures ? `\n${failures} failure(s)` : "\nall cases passed");
process.exit(failures ? 1 : 0);

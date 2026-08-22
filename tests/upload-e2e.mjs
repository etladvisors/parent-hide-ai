// ---------------------------------------------------------------------------
// upload-e2e.mjs — proves the uploader actually works in real Chrome.
//
// Runs the real extension against a LOCAL stub server (never the live Worker),
// with a throwaway upload key. Verifies:
//   1. a blocked search produces a log entry, and the extension POSTs it
//   2. the payload matches what tools/digest/ sends, so GET /logs stays uniform
//   3. the cursor holds — a second run does not re-send what already went up
//   4. a failing server does NOT advance the cursor (entries retry, not vanish)
//
// Run with: npm run test:upload:e2e
// ---------------------------------------------------------------------------
import { chromium } from "playwright";
import http from "http";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../parent-hide-ai");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "phai-upload-"));
const EXT = path.join(tmp, "ext");
const userDataDir = path.join(tmp, "profile");

let failures = 0;
const check = (name, cond, detail = "") => {
  if (!cond) {
    failures++;
    console.log(`FAIL  ${name}${detail ? `\n      ${detail}` : ""}`);
  } else console.log(`PASS  ${name}`);
};

// --- stub server ------------------------------------------------------------
const received = [];
let mode = "ok"; // flip to "fail" to test the retry path
const server = http.createServer((req, res) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  if (req.method === "OPTIONS") return res.writeHead(204, cors).end();
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    if (mode === "fail") return res.writeHead(500, cors).end("{}");
    received.push({ auth: req.headers.authorization, body: JSON.parse(body || "{}") });
    res.writeHead(200, { "content-type": "application/json", ...cors }).end('{"ok":true}');
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const endpoint = `http://127.0.0.1:${server.address().port}/log`;

// --- throwaway copy of the extension pointed at the stub --------------------
fs.cpSync(SRC, EXT, { recursive: true });
const cfgPath = path.join(EXT, "config.js");
fs.writeFileSync(
  cfgPath,
  fs
    .readFileSync(cfgPath, "utf8")
    .replace(/export const LOG_UPLOAD_URL =\s*[^;]+;/, `export const LOG_UPLOAD_URL = "${endpoint}";`)
    // don't hit the live blocklist server from a test
    .replace(/export const REMOTE_CONFIG_URL =\s*[^;]+;/, "export const REMOTE_CONFIG_URL = null;")
);
fs.writeFileSync(path.join(EXT, "upload-key.json"), JSON.stringify({ key: "test-key" }));

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: true,
  channel: "chromium",
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-search-engine-choice-screen",
  ],
});

let sw = null;
for (let i = 0; i < 40 && !sw; i++) {
  sw = context.serviceWorkers()[0] || null;
  if (!sw) await new Promise((r) => setTimeout(r, 250));
}
if (!sw) {
  console.log("FAIL: service worker never registered");
  process.exit(1);
}
const extId = new URL(sw.url()).host;
await new Promise((r) => setTimeout(r, 1500));

// The refresh alarm is 30 minutes away, so drive the cycle explicitly — same
// message the options page's refresh button sends.
const optionsPage = await context.newPage();
await optionsPage.goto(`chrome-extension://${extId}/options.html`);
const kick = () =>
  optionsPage.evaluate(() => chrome.runtime.sendMessage({ type: "sg:reinstall" }));

// --- 1. a blocked search gets uploaded --------------------------------------
const page = await context.newPage();
await page.goto("https://www.google.com/search?q=thinspo", { waitUntil: "commit" }).catch(() => {});
await new Promise((r) => setTimeout(r, 1500));
check("blocked search landed on the block page", page.url().includes("blocked.html"), page.url());

await kick();
await new Promise((r) => setTimeout(r, 1000));

check("extension POSTed a digest", received.length === 1, `got ${received.length} uploads`);
const first = received[0];
if (first) {
  check("sends the bearer token", first.auth === "Bearer test-key", first.auth);
  check(
    "payload shape matches tools/digest",
    ["date", "machine", "profile", "blocked", "searches"].every((k) => k in first.body),
    JSON.stringify(Object.keys(first.body))
  );
  check("device label carried through", first.body.machine === "chromebook", first.body.machine);
  check(
    "the blocked term is in the payload",
    JSON.stringify(first.body.blocked).includes("thinspo"),
    JSON.stringify(first.body.blocked)
  );
}

// --- 2. the cursor holds: nothing re-sent ------------------------------------
await kick();
await new Promise((r) => setTimeout(r, 1000));
check("second run sends nothing new", received.length === 1, `got ${received.length} uploads`);

// --- 3. a failing upload must not advance the cursor -------------------------
mode = "fail";
await page.goto("https://www.bing.com/search?q=goal+weight", { waitUntil: "commit" }).catch(() => {});
await new Promise((r) => setTimeout(r, 1200));
await kick();
await new Promise((r) => setTimeout(r, 1000));

const errState = await sw.evaluate(() =>
  chrome.storage.local.get(["sg_uploadError", "sg_uploadCursor"])
);
check("a failed upload is recorded", Boolean(errState.sg_uploadError), JSON.stringify(errState));

mode = "ok";
await kick();
await new Promise((r) => setTimeout(r, 1000));
check(
  "entries from the failed run are retried, not lost",
  received.length === 2 && JSON.stringify(received[1].body).includes("goal weight"),
  JSON.stringify(received.map((r) => r.body.blocked))
);

const okState = await sw.evaluate(() => chrome.storage.local.get(["sg_uploadError", "sg_uploadedAt"]));
check("error clears after a success", !okState.sg_uploadError && Boolean(okState.sg_uploadedAt),
  JSON.stringify(okState));

await context.close();
server.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures ? `\n${failures} failure(s)` : "\nall cases passed");
process.exit(failures ? 1 : 0);

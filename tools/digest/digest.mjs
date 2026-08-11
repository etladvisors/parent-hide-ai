// ---------------------------------------------------------------------------
// digest.mjs — nightly launchd job for the child's Mac.
//
// Reads Search Guard's local logs (blocked attempts + observed searches)
// straight from Chrome's extension-storage LevelDB on disk, and uploads
// anything new to the parent's Worker at POST /log.
//
// The extension itself never transmits anything — this parent-installed
// script on a parent-administered machine does the uploading, which is why
// the extension's store listing can truthfully say "local-only logging".
//
// Setup: see README.md next to this file.
// ---------------------------------------------------------------------------

import { ClassicLevel } from "classic-level";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(HERE, "config.json");
const STATE_PATH = path.join(HERE, "state.json");

// Storage keys written by the extension (see background.js / blocked.js).
const KEYS = ["sg_log", "sg_searchLog", "sg_ruleCount"];

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

const config = readJson(CONFIG_PATH, null);
if (!config?.endpoint || !config?.logKey) {
  console.error(`Missing or incomplete ${CONFIG_PATH} — need {"endpoint": "...", "logKey": "..."}`);
  process.exit(1);
}
const state = readJson(STATE_PATH, { lastSyncMs: 0 });

// --- Locate the extension's LevelDB in every Chrome profile -----------------

const chromeRoot =
  config.chromeDir ||
  path.join(os.homedir(), "Library/Application Support/Google/Chrome");

function candidateDbs() {
  const out = [];
  if (!fs.existsSync(chromeRoot)) return out;
  for (const profile of fs.readdirSync(chromeRoot)) {
    const settingsDir = path.join(chromeRoot, profile, "Local Extension Settings");
    if (!fs.existsSync(settingsDir)) continue;
    for (const extId of fs.readdirSync(settingsDir)) {
      if (config.extensionId && extId !== config.extensionId) continue;
      const dbDir = path.join(settingsDir, extId);
      if (fs.statSync(dbDir).isDirectory()) out.push({ profile, extId, dbDir });
    }
  }
  return out;
}

// Chrome holds the live DB open, so work on a copy. LevelDB recovers cleanly
// from a mid-write snapshot via its own write-ahead log.
async function readDb(dbDir) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sg-digest-"));
  try {
    fs.cpSync(dbDir, tmp, { recursive: true });
    // Remove the copied lock file so classic-level can open the snapshot.
    fs.rmSync(path.join(tmp, "LOCK"), { force: true });
    const db = new ClassicLevel(tmp, { createIfMissing: false });
    try {
      const values = {};
      for (const key of KEYS) {
        try {
          const raw = await db.get(key);
          if (raw != null) values[key] = JSON.parse(raw);
        } catch {
          // Key absent or unparsable — skip it.
        }
      }
      return values;
    } finally {
      await db.close();
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// --- Collect, filter, upload ------------------------------------------------

const since = state.lastSyncMs || 0;
let newestSeen = since;
let uploaded = 0;

for (const { profile, extId, dbDir } of candidateDbs()) {
  let values;
  try {
    values = await readDb(dbDir);
  } catch (e) {
    console.error(`skip ${profile}/${extId}: ${e.message}`);
    continue;
  }
  // Only this extension's DB has sg_ruleCount; other extensions won't.
  if (values.sg_ruleCount === undefined) continue;

  const blocked = (values.sg_log || []).filter((e) => e.at > since);
  const searches = (values.sg_searchLog || []).filter((e) => e.at > since);
  for (const e of [...blocked, ...searches]) {
    if (e.at > newestSeen) newestSeen = e.at;
  }
  if (!blocked.length && !searches.length) {
    console.log(`${profile}: nothing new`);
    continue;
  }

  const body = {
    date: new Date().toISOString().slice(0, 10),
    machine: os.hostname(),
    profile,
    blocked,
    searches,
  };

  const res = await fetch(`${config.endpoint.replace(/\/$/, "")}/log`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.logKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`upload failed for ${profile}: HTTP ${res.status}`);
    process.exitCode = 1;
    continue;
  }
  uploaded += blocked.length + searches.length;
  console.log(`${profile}: uploaded ${blocked.length} blocked + ${searches.length} searches`);
}

// Advance the cursor only if every upload succeeded, so failures retry
// tomorrow instead of dropping entries.
if (process.exitCode !== 1 && newestSeen > since) {
  fs.writeFileSync(STATE_PATH, JSON.stringify({ lastSyncMs: newestSeen }));
}
console.log(`done — ${uploaded} new entries uploaded`);

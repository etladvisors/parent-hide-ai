// ---------------------------------------------------------------------------
// background.js — two jobs:
//
// 1. AI Mode backstop: DNR rules in rules.json handle most cases, but
//    webNavigation catches same-document updates (Google uses pushState a
//    lot on search results).
//
// 2. Search Guard: compiles config.js into dynamic declarativeNetRequest
//    rules that redirect blocked searches and sites to blocked.html.
// ---------------------------------------------------------------------------

import * as cfg from "./config.js";
import { buildRules, termToPattern } from "./rules/compile.js";
import { planUpload } from "./upload.js";

// --- AI Mode backstop -------------------------------------------------------

const AI_MODE_HOSTS = ["www.google.com", "google.com"];

function shouldStrip(url) {
  try {
    const u = new URL(url);
    if (!AI_MODE_HOSTS.includes(u.hostname)) return null;

    // Strip udm=50 (AI Mode) from any google.com URL
    if (u.searchParams.get("udm") === "50") {
      u.searchParams.delete("udm");
      return u.toString();
    }

    // Redirect /aimode to /search
    if (u.pathname === "/aimode" || u.pathname === "/async/aimode") {
      const q = u.searchParams.get("q") || "";
      return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
    }

    return null;
  } catch {
    return null;
  }
}

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  const newUrl = shouldStrip(details.url);
  if (newUrl) {
    chrome.tabs.update(details.tabId, { url: newUrl });
  }
});

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0) return;
  const newUrl = shouldStrip(details.url);
  if (newUrl) {
    chrome.tabs.update(details.tabId, { url: newUrl });
  }
});

// --- Search Guard: remote blocklist -----------------------------------------
//
// Remote config is DATA ONLY (never code) and strictly additive: it can add
// terms and domains on top of config.js, never remove them. A failed or
// malformed fetch degrades to the last good copy, and with no copy at all the
// baked-in lists still apply.

const REFRESH_ALARM = "sg-refresh";

function sanitizeRemote(data) {
  const MAX_TERMS = 1000;
  const MAX_TERM_LEN = 80;
  const MAX_DOMAINS = 500;

  const terms = (Array.isArray(data?.terms) ? data.terms : [])
    .filter((t) => typeof t === "string")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t && t.length <= MAX_TERM_LEN)
    .slice(0, MAX_TERMS);

  const domains = (Array.isArray(data?.domains) ? data.domains : [])
    .filter((d) => typeof d === "string")
    .map((d) =>
      d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")
    )
    .filter((d) => /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(d))
    .slice(0, MAX_DOMAINS);

  return { version: data?.version ?? null, terms, domains };
}

async function refreshRemote() {
  if (!cfg.REMOTE_CONFIG_URL) return;
  try {
    const res = await fetch(cfg.REMOTE_CONFIG_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const remote = sanitizeRemote(await res.json());
    await chrome.storage.local.set({
      sg_remote: remote,
      sg_remoteAt: Date.now(),
      sg_remoteError: null,
    });
  } catch (e) {
    // Keep the last good sg_remote; just record why the refresh failed.
    await chrome.storage.local.set({
      sg_remoteError: String(e?.message || e),
    });
  }
}

// Baked-in config plus whatever remote additions are cached in storage.
async function mergedConfig() {
  const { sg_remote } = await chrome.storage.local.get("sg_remote");
  const terms = [...cfg.BLOCKED_TERMS];
  const remoteDomains = [];
  if (sg_remote) {
    for (const t of sg_remote.terms) if (!terms.includes(t)) terms.push(t);
    for (const d of sg_remote.domains) {
      if (!cfg.BLOCKED_DOMAINS.includes(d) && !remoteDomains.includes(d)) {
        remoteDomains.push(d);
      }
    }
  }
  return {
    ...cfg,
    BLOCKED_TERMS: terms,
    REMOTE_BLOCKED_DOMAINS: remoteDomains,
  };
}

// --- Search Guard: log upload -----------------------------------------------
//
// ChromeOS has no launchd and no reachable path to Chrome's on-disk extension
// storage, so tools/digest/ cannot run there. Instead the service worker
// pushes new log entries to the same Worker endpoint (POST /log) that the Mac
// digest job uses, in the same wire format, on the blocklist-refresh alarm.
//
// The Worker answers OPTIONS with permissive CORS, so this needs no extra
// host permission — which matters: adding one would land the update DISABLED
// until someone re-accepts it on the device.

// The key lives in its own file so it can be gitignored (this repo is public).
// It is read with fetch() rather than import(): dynamic import is disallowed
// inside a service worker, and a static import of a gitignored file would kill
// the whole worker whenever the file is absent. A missing file is not an
// error here — uploading is simply off.
async function uploadKey() {
  try {
    const res = await fetch(chrome.runtime.getURL("upload-key.json"));
    if (!res.ok) return null;
    const { key } = await res.json();
    return typeof key === "string" && key.trim() ? key.trim() : null;
  } catch {
    return null;
  }
}

async function uploadLogs() {
  if (!cfg.LOG_UPLOAD_URL) return;

  const key = await uploadKey();
  if (!key) {
    await chrome.storage.local.set({
      sg_uploadError: "no upload key bundled (see upload-key.example.json)",
    });
    return;
  }

  const {
    sg_log = [],
    sg_searchLog = [],
    sg_uploadCursor = 0,
  } = await chrome.storage.local.get(["sg_log", "sg_searchLog", "sg_uploadCursor"]);

  const batch = planUpload({
    blocked: sg_log,
    searches: sg_searchLog,
    since: sg_uploadCursor,
  });
  if (!batch.blocked.length && !batch.searches.length) {
    await chrome.storage.local.set({ sg_uploadError: null });
    return;
  }

  try {
    const res = await fetch(cfg.LOG_UPLOAD_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        date: new Date().toISOString().slice(0, 10),
        machine: cfg.DEVICE_LABEL || "chromebook",
        profile: "extension",
        blocked: batch.blocked,
        searches: batch.searches,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // Advance only on success, so a failed batch is retried whole rather than
    // silently skipped. Entries stay in local storage either way.
    await chrome.storage.local.set({
      sg_uploadCursor: batch.cursor,
      sg_uploadedAt: Date.now(),
      sg_uploadError: null,
    });
    if (batch.remaining) {
      console.info(`[Search Guard] ${batch.remaining} entries left for the next run.`);
    }
  } catch (e) {
    await chrome.storage.local.set({ sg_uploadError: String(e?.message || e) });
  }
}

// --- Search Guard: keyword and domain blocking ------------------------------

const BLOCK_PAGE = chrome.runtime.getURL("blocked.html");

async function install() {
  const merged = await mergedConfig();
  const rules = buildRules(merged, BLOCK_PAGE);

  // updateDynamicRules is all-or-nothing: one bad rule and NOTHING installs.
  // If the bulk call fails, fall back to one-at-a-time so a single oversized
  // rule (Chrome's 2KB compiled-regex cap) only costs itself, and record the
  // failure in storage so it can't go unnoticed.
  let error = null;
  let installed = rules.length;
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existing.map((r) => r.id),
      addRules: rules,
    });
  } catch (e) {
    error = String(e?.message || e);
    console.error(`[Search Guard] bulk rule install failed: ${error}`);
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existing.map((r) => r.id),
    });
    installed = 0;
    for (const rule of rules) {
      try {
        await chrome.declarativeNetRequest.updateDynamicRules({ addRules: [rule] });
        installed++;
      } catch (e2) {
        console.error(`[Search Guard] rule ${rule.id} rejected: ${e2?.message || e2}`);
      }
    }
  }

  // Content scripts can't import modules, so hand them what they need here.
  // Written even if DNR install failed — query-guard still works from this.
  await chrome.storage.local.set({
    sg_pattern: merged.BLOCKED_TERMS.filter(Boolean).map(termToPattern).join("|"),
    sg_engines: cfg.SEARCH_ENGINES.map((e) => e.param),
    sg_logging: cfg.LOG_ATTEMPTS,
    sg_logSearches: cfg.LOG_SEARCHES,
    sg_logLimit: cfg.LOG_LIMIT,
    sg_support: cfg.SUPPORT_LINE,
    sg_ruleCount: installed,
    sg_error: error,
  });

  if (!error) console.info(`[Search Guard] ${rules.length} rules installed.`);
}

async function refreshAndInstall() {
  await refreshRemote();
  await install();
  await uploadLogs();
}

function scheduleRefresh() {
  if (!cfg.REMOTE_CONFIG_URL && !cfg.LOG_UPLOAD_URL) return;
  chrome.alarms.create(REFRESH_ALARM, {
    periodInMinutes: Math.max(5, cfg.REMOTE_REFRESH_MINUTES || 30),
  });
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleRefresh();
  refreshAndInstall();
});
chrome.runtime.onStartup.addListener(() => {
  scheduleRefresh();
  refreshAndInstall();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) refreshAndInstall();
});

// Observed-search log. Appends are funneled through the service worker and
// chained so two tabs logging at once can't clobber each other's writes.
let logChain = Promise.resolve();
function appendSearchLog(entry) {
  logChain = logChain
    .then(async () => {
      const { sg_searchLog = [] } = await chrome.storage.local.get("sg_searchLog");
      sg_searchLog.push(entry);
      const limit = cfg.SEARCH_LOG_LIMIT || 2000;
      await chrome.storage.local.set({ sg_searchLog: sg_searchLog.slice(-limit) });
    })
    .catch(() => {});
  return logChain;
}

// The service worker sleeps; messages wake it.
chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg?.type === "sg:reinstall") {
    refreshAndInstall().then(() => respond({ ok: true }));
    return true;
  }
  if (msg?.type === "sg:query" && cfg.LOG_SEARCHES) {
    appendSearchLog({
      at: Date.now(),
      host: String(msg.host || "").slice(0, 100),
      q: String(msg.q || "").slice(0, 200),
      blocked: Boolean(msg.blocked),
    });
  }
});

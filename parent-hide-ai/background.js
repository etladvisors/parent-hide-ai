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

// --- Search Guard: keyword and domain blocking ------------------------------

const BLOCK_PAGE = chrome.runtime.getURL("blocked.html");

async function install() {
  const rules = buildRules(cfg, BLOCK_PAGE);

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
    sg_pattern: cfg.BLOCKED_TERMS.filter(Boolean).map(termToPattern).join("|"),
    sg_engines: cfg.SEARCH_ENGINES.map((e) => e.param),
    sg_logging: cfg.LOG_ATTEMPTS,
    sg_logLimit: cfg.LOG_LIMIT,
    sg_support: cfg.SUPPORT_LINE,
    sg_ruleCount: installed,
    sg_error: error,
  });

  if (!error) console.info(`[Search Guard] ${rules.length} rules installed.`);
}

chrome.runtime.onInstalled.addListener(install);
chrome.runtime.onStartup.addListener(install);

// The service worker sleeps; this wakes it if the block page needs anything.
chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg?.type === "sg:reinstall") {
    install().then(() => respond({ ok: true }));
    return true;
  }
});

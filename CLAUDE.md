# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome extension (Manifest V3) with two parental-control features:

1. **AI hiding** — blocks Google AI Mode and hides AI Overviews from search results.
2. **Search Guard** — blocks searches matching a configurable keyword list (and a list of whole domains) across major search/social sites, redirecting to a block page. Built for a supervised child account (Family Link).

## Architecture

### AI hiding (three layers)

1. **Static Declarative Net Request (`rules.json`)** - Network-level URL rewriting:
   - Strips `udm=50` parameter (AI Mode) from search URLs
   - Redirects `/aimode` and `/async/aimode` to regular `/search`

2. **Service Worker (`background.js`)** - Catches SPA navigations:
   - Handles `pushState` navigation that bypasses network rules
   - Uses `webNavigation.onHistoryStateUpdated` and `onBeforeNavigate`

3. **Content Script (`hide-ai.js` + `hide.css`)** - DOM-level hiding (google.com only):
   - CSS selectors hide known AI UI elements
   - MutationObserver catches lazy-loaded AI content
   - Text-pattern matching for elements with dynamic class names

### Search Guard (two layers + remote config + log upload)

1. **Dynamic Declarative Net Request rules** - `background.js` compiles `config.js`
   (terms, domains, engines) into dynamic DNR redirect rules via
   `rules/compile.js` on install/startup. Blocked requests redirect to
   `blocked.html`, which shows a support line and appends to a local-only log
   (`chrome.storage.local`, viewable via `options.html`).

2. **Content Script (`query-guard.js`)** - pushState backstop for SPA sites
   (YouTube, Reddit, Pinterest, TikTok) where the visible page doesn't reload.
   Reads the compiled term pattern from `chrome.storage.local` (set by the
   service worker — content scripts can't import modules). Also reports every
   observed query to the service worker, which appends it to a local-only
   `sg_searchLog` (capped) for parental review.

3. **Remote blocklist (v3)** - if `REMOTE_CONFIG_URL` is set in `config.js`,
   `background.js` fetches `{version, terms[], domains[]}` JSON on a
   `chrome.alarms` schedule and merges it ADDITIVELY over the baked-in lists
   (remote can tighten, never loosen). Remote-added domains use DNR `block`
   actions, not redirects — redirect rules silently don't fire on hosts
   missing from `host_permissions`, block rules work everywhere. Backend is
   `server/worker.js` (Cloudflare Worker + KV; see `server/README.md`).
4. **Log upload (v3.1)** - the service worker POSTs new log entries to
   `LOG_UPLOAD_URL` (the Worker's `/log`) on the same alarm as the blocklist
   refresh. Batching/cursor logic is in `upload.js` (`planUpload`, unit-tested
   by `tests/upload.test.mjs`); the bearer token is read at runtime from
   `upload-key.json` (fetch, not import — dynamic import is illegal in a service
   worker), which is **gitignored**; a missing file means uploading is off, not
   an error.
   Reaches the Worker via CORS, deliberately **not** a host permission, so
   updates install silently. `tools/digest/` is the older launchd job for a
   **Mac**; it cannot run on ChromeOS (no launchd, and the Chrome profile sits
   in an encrypted partition), which is why the upload moved in-extension.
   **The extension now transmits data** — `PRIVACY_POLICY.md` and the CWS
   Privacy Practices tab must stay consistent with `LOG_UPLOAD_URL`.

Static and dynamic DNR rules live in separate namespaces; no ID coordination is needed between `rules.json` and the compiled rules.

## Key Files

- `manifest.json` - MV3 manifest; module service worker; two content-script groups
- `rules.json` - Static DNR rules (AI Mode URL transforms)
- `background.js` - Service worker: AI SPA-navigation backstop + Search Guard rule installer
- `config.js` - **The file to edit for Search Guard**: `BLOCKED_TERMS`, `BLOCKED_DOMAINS`, `SEARCH_ENGINES`, `LOG_ATTEMPTS`, `SUPPORT_LINE`
- `rules/compile.js` - Compiles config into DNR rules (`termToPattern`, `buildRules`)
- `hide-ai.js` - DOM observer with `AI_TEXT_PATTERNS` array for text-based detection
- `hide.css` - CSS selectors for known AI elements
- `query-guard.js` - Search Guard SPA backstop
- `blocked.html` / `blocked.js` - Block page + local logging
- `options.html` / `options.js` - Parent-facing log viewer (blocked attempts + recent searches) with remote-list status and manual refresh
- `upload.js` - Log-upload batching (`planUpload`); pure, no chrome.* or network
- `upload-key.json` - **Gitignored.** Holds the Worker LOG_KEY; template in `upload-key.example.json`
- `test.mjs` - Offline harness for compiled Search Guard rules
- `server/` - Cloudflare Worker: serves the remote blocklist (`GET/PUT /config`), receives nightly digests (`POST /log`, `GET /logs`)
- `tools/digest/` - launchd job for the child's Mac: uploads the local logs to the Worker nightly

## Development

Load as unpacked extension:
1. Open `chrome://extensions`
2. Enable Developer mode
3. Click "Load unpacked" and select the `parent-hide-ai/` folder

Test URLs:
- `https://www.google.com/search?q=test&udm=50` - should redirect to remove `udm=50`
- `https://www.google.com/aimode?q=test` - should redirect to `/search`
- `https://www.google.com/search?q=thinspo` - should redirect to the block page

Run `npm run test:upload` after touching `upload.js` — the cursor is a single
watermark across both logs, and getting it wrong silently drops entries.

Run `npm run test:rules` after any `config.js` change — it checks both block and allow cases (false positives matter as much as misses).

Then run `npm run test:smoke` — it loads the extension in headless Chromium (`channel: "chromium"`; the default headless shell can't load extensions) and verifies Chrome actually *accepts* the compiled rules and that blocking redirects fire end-to-end. This matters because `test:rules` cannot catch rules Chrome rejects at install time.

## Maintenance

### AI hiding
Google frequently changes DOM structure. When AI content leaks through:
1. Open DevTools on a SERP showing the leaked element
2. Find a stable selector or text pattern
3. Add CSS selectors to `hide.css` or text patterns to `AI_TEXT_PATTERNS` in `hide-ai.js`

### Search Guard
- Day-to-day term/domain updates go through the remote blocklist: `PUT /config` on the Worker (see `server/README.md`). The extension picks changes up within `REMOTE_REFRESH_MINUTES` (default 30) — no republish, no reload.
- Baked-in edits (engines, defaults, `REMOTE_CONFIG_URL` itself) still go in `config.js` and require a reload/republish.
- Remote terms are validated by `sanitizeRemote()` in `background.js` (length caps, domain syntax) but still hit the 2KB regex cap below — keep remote terms short and simple, and prefer plain words over anything regex-ish.
- **Chrome caps each `regexFilter` at 2KB of compiled RE2 program — in practice only ~10 character classes per rule** (each class costs ~150–200 bytes compiled; `.` and literals are nearly free, which is why `compile.js` uses `.{0,3}` as the word separator). `updateDynamicRules` is all-or-nothing, so `background.js` falls back to per-rule install and records failures in `sg_error` (`chrome.storage.local`). If blocking stops working wholesale, check `sg_error` first, then run `npm run test:smoke`.
- **If a search engine or blocked domain is added to `config.js`, a matching entry must be added to `host_permissions` in `manifest.json`** (and to the `query-guard.js` `content_scripts` matches for engines) — DNR rules silently don't fire on hosts without permission.
- Adding new permissions in an update disables the extension until the user re-accepts it.
- The keyword list is sensitive (eating-disorder related, for a specific child). Keep the block page and docs non-judgmental in tone; `PRIVACY_POLICY.md` and `CHROME_WEB_STORE_LISTING.md` must stay accurate about the local-only logging.

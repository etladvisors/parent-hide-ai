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

### Search Guard (two layers)

1. **Dynamic Declarative Net Request rules** - `background.js` compiles `config.js`
   (terms, domains, engines) into dynamic DNR redirect rules via
   `rules/compile.js` on install/startup. Blocked requests redirect to
   `blocked.html`, which shows a support line and appends to a local-only log
   (`chrome.storage.local`, viewable via `options.html`).

2. **Content Script (`query-guard.js`)** - pushState backstop for SPA sites
   (YouTube, Reddit, Pinterest, TikTok) where the visible page doesn't reload.
   Reads the compiled term pattern from `chrome.storage.local` (set by the
   service worker — content scripts can't import modules).

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
- `options.html` / `options.js` - Parent-facing blocked-attempts log
- `test.mjs` - Offline harness for compiled Search Guard rules

## Development

Load as unpacked extension:
1. Open `chrome://extensions`
2. Enable Developer mode
3. Click "Load unpacked" and select the `parent-hide-ai/` folder

Test URLs:
- `https://www.google.com/search?q=test&udm=50` - should redirect to remove `udm=50`
- `https://www.google.com/aimode?q=test` - should redirect to `/search`
- `https://www.google.com/search?q=thinspo` - should redirect to the block page

Run `npm run test:rules` after any `config.js` change — it checks both block and allow cases (false positives matter as much as misses).

## Maintenance

### AI hiding
Google frequently changes DOM structure. When AI content leaks through:
1. Open DevTools on a SERP showing the leaked element
2. Find a stable selector or text pattern
3. Add CSS selectors to `hide.css` or text patterns to `AI_TEXT_PATTERNS` in `hide-ai.js`

### Search Guard
- Term/domain edits go in `config.js` only; reload the extension afterward.
- **If a search engine or blocked domain is added to `config.js`, a matching entry must be added to `host_permissions` in `manifest.json`** (and to the `query-guard.js` `content_scripts` matches for engines) — DNR rules silently don't fire on hosts without permission.
- Adding new permissions in an update disables the extension until the user re-accepts it.
- The keyword list is sensitive (eating-disorder related, for a specific child). Keep the block page and docs non-judgmental in tone; `PRIVACY_POLICY.md` and `CHROME_WEB_STORE_LISTING.md` must stay accurate about the local-only logging.

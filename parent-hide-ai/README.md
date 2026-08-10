# Parent Hide AI

Chrome extension (MV3) with two parental-control features:

1. **AI hiding** — blocks Google's AI Mode and hides AI Overviews on search results.
2. **Search Guard** — blocks searches matching a keyword list (and a list of whole domains) across major search and social sites, redirecting to a gentle block page.

## AI hiding

1. **Strips `udm=50`** from any `google.com/search` URL (this is the AI Mode parameter). If someone clicks an AI Mode link, they get normal results instead.
2. **Redirects `/aimode` and `/async/aimode`** endpoints to regular `/search`.
3. **Hides AI Overview blocks** (the auto-generated summary at the top of SERPs) via CSS + a MutationObserver that catches lazy-loaded content.
4. **Hides the "AI Mode" tab** in the search-type toolbar (All / Images / Videos / AI Mode).
5. **Hides the AI Mode button** on the google.com homepage.

## Search Guard

**Day-to-day term/domain updates don't touch this folder anymore.** Since
v3.0.0 the extension fetches a remote blocklist from a parent-managed
Cloudflare Worker every 30 minutes and merges it *on top of* the baked-in
lists — so you add a term with one `curl` (see `server/README.md` in the repo
root) and her browser picks it up within the half hour, no republish, no
reload. Remote config is additive only: it can tighten blocking, never
loosen it, and if the fetch fails the extension keeps its last good list.

One asymmetry to know about: remotely-added **domains** are blocked with
Chrome's plain network-error page instead of the friendly block page
(redirects only work on hosts baked into the manifest). If a remotely-added
domain proves permanent, fold it into `config.js` + `host_permissions` at the
next store release to upgrade it to the nice block page.

The baked-in defaults, and everything structural, still live in `config.js`:

- `BLOCKED_TERMS` — keywords matched against search queries. Two forms:

  ```js
  "calorie"     // substring — also catches "calories", "calorie-counter"
  "/diet/"      // whole word — catches "diet", not "dietary" or "dietitian"
  ```

  Spaces are flexible: `"body mass index"` matches `body+mass+index`, `body%20mass%20index` and `body-mass-index`.

- `BLOCKED_DOMAINS` — whole sites blocked outright (calorie trackers, BMI calculators).
- `SEARCH_ENGINES` — which sites and query parameters are watched.
- `LOG_ATTEMPTS` / `LOG_LIMIT` — record blocked attempts locally, reviewable at `chrome://extensions` → Parent Hide AI → Extension options. Nothing leaves the device via the extension. See "The logging trade-off" below.
- `LOG_SEARCHES` / `SEARCH_LOG_LIMIT` — also record every search seen on the watched engines (blocked or not), same local-only storage, same options page. This is the "what got through" signal that tells you which terms to add next.
- `SUPPORT_LINE` — optional support line shown on the block page.
- `REMOTE_CONFIG_URL` / `REMOTE_REFRESH_MINUTES` — where and how often to fetch the remote blocklist.

Reload the extension (`chrome://extensions` → reload) after changing `config.js`. `background.js` compiles it into dynamic declarativeNetRequest rules on install/startup; `query-guard.js` is the content-script backstop for sites (YouTube, Reddit, Pinterest, TikTok) that run searches through `pushState` without a page load.

**If you add a search engine or blocked domain to `config.js`, add a matching entry to `host_permissions` (and, for engines, the `query-guard.js` `content_scripts` matches) in `manifest.json`** — DNR rules only fire on hosts the extension has permission for.

After edits, run the test harness so you don't ship a rule that blocks chemistry homework:

```bash
npm run test:rules      # or: node parent-hide-ai/test.mjs
```

Add your own cases to the `tests` array in `test.mjs` — especially *allow* cases. False positives are the thing that gets an extension quietly resented and worked around.

### On the pro-ED vocabulary

The community terms in `config.js` were current when this was written. That vocabulary rotates deliberately and fast, precisely because platforms block it. Treat the list as something you revisit, not something you set once.

### The logging trade-off

`LOG_ATTEMPTS` records blocked searches locally — real signal for a treatment team and for finding new terms to add. But covert monitoring, once discovered, does specific damage to a therapeutic relationship. The middle path most clinicians land on: keep the log, and tell her it exists. Worth putting to whoever is treating her rather than deciding solo.

## Install (unpacked, for testing)

1. Open `chrome://extensions`, toggle **Developer mode** on.
2. Click **Load unpacked** and select this folder.
3. Test: `https://www.google.com/search?q=test&udm=50` should land on regular results; `https://www.google.com/search?q=thinspo` should land on the block page.

For the supervised Chromebook, publish unlisted on the Chrome Web Store (supervised profiles can't sideload) — see `CHROME_WEB_STORE_LISTING.md` in the repo root. After install, in Family Link turn the **Extensions** toggle off under Controls → Google Chrome & Web → Advanced settings, so new installs need your approval.

## Where this leaks

- **She can uninstall it.** Family Link gates installing extensions, not removing them. Check periodically.
- **Other devices and non-Chrome traffic.** This covers one browser. Pair with Family Link SafeSearch and a DNS filter (NextDNS, Cloudflare for Families) on the router and in ChromeOS secure-DNS settings.
- **Rephrasing.** Keyword lists lose to a motivated human; revisit the list.
- **Guest mode.** Disable it on the Chromebook or all of this is skippable.
- You may also want to add `gemini.google.com` as a blocked site in Family Link for the standalone Gemini product.

## Tuning the AI hiding

Google changes their DOM frequently. If an AI Overview starts leaking through:

- Open DevTools on a SERP showing the leaked element.
- Find a stable selector or text pattern.
- Add it to `hide.css` (static selectors) or the `AI_TEXT_PATTERNS` array in `hide-ai.js` (text-based detection).

## Files

- `manifest.json` — MV3 manifest, permissions, declarative net request config
- `rules.json` — static DNR rules for AI Mode URL rewriting
- `background.js` — service worker: AI-Mode SPA-navigation backstop + compiles `config.js` into dynamic DNR rules
- `config.js` — **the file you edit**: blocked terms, blocked domains, engines, logging
- `rules/compile.js` — turns `config.js` into DNR rules
- `hide-ai.js` — DOM observer for lazy-loaded AI elements + URL cleanup (google.com only)
- `hide.css` — static selectors for known AI UI elements
- `query-guard.js` — pushState backstop for blocked searches on SPA sites
- `blocked.html` / `blocked.js` — the block page (also writes the local log)
- `options.html` / `options.js` — parent-facing log viewer (blocked attempts + recent searches, remote-list status, manual refresh)
- `test.mjs` — offline test harness for the compiled rules
- `icons/` — extension icons

Two companion pieces live in the repo root, outside the extension:

- `server/` — the Cloudflare Worker that serves the remote blocklist and receives nightly search digests (`server/README.md`: deploy, daily blocklist edits, reading logs)
- `tools/digest/` — a launchd job for the child's Mac that uploads the local search log to the Worker nightly (`tools/digest/README.md`: install and management)

## The part the code doesn't do

Filtering buys time and lowers the temperature; it doesn't treat anything. Restriction without treatment tends to move the behavior rather than reduce it. If she isn't already working with someone who specializes in eating disorders, that's the higher-leverage move by a wide margin (National Alliance for Eating Disorders helpline: 1-866-662-1235, weekdays). And consider building this *with* her rather than around her — a filter she consented to is both more effective and far less costly to the relationship than one she discovers.

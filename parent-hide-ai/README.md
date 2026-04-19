# Parent Hide AI

Chrome extension that blocks Google's AI Mode and hides AI Overviews on search results.

## What it does

1. **Strips `udm=50`** from any `google.com/search` URL (this is the AI Mode parameter). If someone clicks an AI Mode link, they get normal results instead.
2. **Redirects `/aimode` and `/async/aimode`** endpoints to regular `/search`.
3. **Hides AI Overview blocks** (the auto-generated summary at the top of SERPs) via CSS + a MutationObserver that catches lazy-loaded content.
4. **Hides the "AI Mode" tab** in the search-type toolbar (All / Images / Videos / AI Mode).
5. **Hides the AI Mode button** on the google.com homepage.

## Install (unpacked, on your kid's Chromebook)

1. Copy this entire folder to the Chromebook.
2. Open `chrome://extensions` in the kid's profile.
3. Toggle **Developer mode** on (top-right).
4. Click **Load unpacked** and select this folder.
5. The extension is now active. Test by going to google.com — the AI Mode tab should be gone. Try searching and visiting `https://www.google.com/search?q=test&udm=50` — you should land on regular results.

## Caveats for Family Link–only setups

- **The extension can be disabled** from `chrome://extensions` by anyone with access to the profile. Family Link doesn't offer force-install.
- If you want true lock-down, consider enrolling the Chromebook in **Chrome Enterprise Core** (free) and pushing the extension via `ExtensionInstallForcelist` policy. That requires building a `.crx`, hosting it, and adding the extension to the force-install list. Worth it only if your kid starts poking at `chrome://extensions`.
- You may also want to add `gemini.google.com` as a blocked site in Family Link for the standalone Gemini product.

## Tuning

Google changes their DOM frequently. If an AI Overview starts leaking through:

- Open DevTools on a SERP showing the leaked element.
- Find a stable selector or text pattern.
- Add it to `hide.css` (static selectors) or the `AI_TEXT_PATTERNS` array in `content.js` (text-based detection).

## Files

- `manifest.json` — MV3 manifest, permissions, declarative net request config
- `rules.json` — declarativeNetRequest rules for URL rewriting
- `background.js` — service worker for SPA-style navigation events
- `content.js` — DOM observer for lazy-loaded AI elements + URL cleanup
- `hide.css` — static selectors for known AI UI elements
- `icons/` — extension icons

## Packing as .crx (optional, for enterprise force-install)

```
# From chrome://extensions, click "Pack extension" and point at this folder.
# Keep the generated .pem safe — you'll need it for future updates.
```

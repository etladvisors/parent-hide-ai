# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome extension (Manifest V3) that blocks Google AI Mode and hides AI Overviews from search results. Designed for parental control use cases (e.g., kid's Chromebook).

## Architecture

The extension uses three layers to block AI features:

1. **Declarative Net Request (`rules.json`)** - Network-level URL rewriting:
   - Strips `udm=50` parameter (AI Mode) from search URLs
   - Redirects `/aimode` and `/async/aimode` to regular `/search`

2. **Service Worker (`background.js`)** - Catches SPA navigations:
   - Handles `pushState` navigation that bypasses network rules
   - Uses `webNavigation.onHistoryStateUpdated` and `onBeforeNavigate`

3. **Content Script (`content.js` + `hide.css`)** - DOM-level hiding:
   - CSS selectors hide known AI UI elements
   - MutationObserver catches lazy-loaded AI content
   - Text-pattern matching for elements with dynamic class names

## Key Files

- `manifest.json` - MV3 manifest with `declarativeNetRequest` and `webNavigation` permissions
- `rules.json` - Declarative net request rules (regex-based URL transforms)
- `background.js` - Service worker for SPA navigation handling
- `content.js` - DOM observer with `AI_TEXT_PATTERNS` array for text-based detection
- `hide.css` - CSS selectors for known AI elements

## Development

Load as unpacked extension:
1. Open `chrome://extensions`
2. Enable Developer mode
3. Click "Load unpacked" and select the `parent-hide-ai/` folder

Test URLs:
- `https://www.google.com/search?q=test&udm=50` - should redirect to remove `udm=50`
- `https://www.google.com/aimode?q=test` - should redirect to `/search`

## Maintenance

Google frequently changes DOM structure. When AI content leaks through:
1. Open DevTools on a SERP showing the leaked element
2. Find a stable selector or text pattern
3. Add CSS selectors to `hide.css` or text patterns to `AI_TEXT_PATTERNS` in `content.js`

# Publishing an update to the Chrome Web Store

How to ship a new version of Parent Hide AI to the (unlisted) Web Store listing.

## 1. Pre-flight

- [ ] Bump `"version"` in `parent-hide-ai/manifest.json` (must be higher than the
      version currently in the store, e.g. `2.0.0` → `2.0.1`).
- [ ] `npm run test:rules` — offline regex logic, block AND allow cases.
- [ ] `npm run test:smoke` — real Chromium: rules actually install
      (`sg_error: null`, 142 rules) and redirects fire end-to-end.
- [ ] Check whether `host_permissions` changed in this release. **If any host was
      added, the update will arrive disabled until the user re-accepts it** — plan
      to touch the kid's machine after it rolls out. (No change = silent update.)

## 2. Build the package

```sh
cd parent-hide-ai
zip -r ../parent-hide-ai-<version>.zip . -x "README.md" -x "test.mjs" \
    -x ".DS_Store" -x "*/.DS_Store" -x "_metadata/*"
```

`manifest.json` must sit at the **root** of the zip (it does with the command
above — do not zip the folder itself). Zips are gitignored; they are upload
artifacts, not source.

## 3. Upload

1. Go to the [developer dashboard](https://chrome.google.com/webstore/devconsole)
   and open the **Parent Hide AI** item.
2. Left sidebar → **Package** → **Upload new package** → select the new zip.
   The dashboard reads the version from the manifest and shows any manifest
   errors immediately.
3. If the store listing text needs changes, edit **Store listing** now so it
   goes out in the same review. ⚠️ **Do not enumerate brand names** (Bing,
   YouTube, TikTok, …) anywhere in the listing — a previous submission was
   rejected for keyword spam (ref "Yellow Argon", Jul 2026). Say "supported
   search engines and social platforms"; the manifest's `host_permissions` is
   the authoritative list. See `CHROME_WEB_STORE_LISTING.md` for approved copy.
4. **Save draft**, then **Submit for review**.
   - Keep visibility **Unlisted** — resubmitting does not change visibility.
   - If asked for review notes, reuse the permissions justifications in
     `CHROME_WEB_STORE_LISTING.md`.

## 4. After approval

- Review typically takes a few hours to a few days (host permissions on social
  sites can add scrutiny). Status shows in the dashboard; rejections arrive by
  email — check against the "review flags" table in `CHROME_WEB_STORE_LISTING.md`.
- Installed copies auto-update within a few hours of approval. To force it on
  the kid's machine: `chrome://extensions` → Developer mode → **Update**.
- Verify on the target machine: the version number on `chrome://extensions`,
  then try `google.com/search?q=thinspo` (block page) and
  `google.com/search?q=test&udm=50` (udm stripped).
- Dev-mode "Load unpacked" installs are separate from the store copy — remove
  the unpacked one on machines that switch to the store version.

## Version history

- **2.0.1** — Search Guard actually works: v2.0.0 shipped with every keyword
  rule rejected by Chrome's 2KB compiled-regex cap (zero dynamic rules
  installed, silently). Rules recompiled to fit (requestDomains + per-term
  regex), install failures now recorded in `sg_error`, SPA backstop matches
  decoded multi-word queries, `udm=50`-first URLs handled.
- **2.0.0** — Merged Search Guard keyword/site blocking into Parent Hide AI.

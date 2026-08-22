# Chrome Web Store Listing — Parent Hide AI

> Publish as **Unlisted** (not visible in store search; only accessible via direct link).

---

## Store Listing Fields

### Name

```
Parent Hide AI
```

### Short Description (132 characters max)

```
Parental search filter: removes Google AI Mode and AI Overviews, and blocks searches matching a parent-managed keyword list.
```

### Detailed Description (16,000 characters max)

```
Parent Hide AI is a parental control extension that filters search for a supervised child's browser.

What it does:
- Hides the "AI Overview" summary block that appears at the top of Google Search results
- Removes the "AI Mode" tab from the Google Search toolbar and the AI Mode button from the Google homepage
- Redirects AI Mode URLs back to standard Google Search results
- Blocks searches whose query matches a parent-configured keyword list on supported search engines and social platforms, showing a supportive block page instead
- Blocks a parent-configured list of websites

Why it exists:
This extension was built for parents who want their children to use search as a traditional search engine — seeing real web results rather than AI-generated summaries — and who need to restrict a specific, parent-chosen set of search topics for their child's wellbeing. It is designed for use on a child's Chromebook managed through Google Family Link.

How it works:
- Uses CSS rules and a MutationObserver content script to hide Google AI interface elements
- Uses Chrome's declarativeNetRequest API to redirect AI Mode URLs back to standard search, and to redirect searches matching the parent's keyword list to a local block page
- Uses the webNavigation API to handle in-page navigation events that bypass network-level rules

Privacy:
- It does not use analytics or tracking, and shares nothing with third parties
- It periodically downloads the parent's current blocklist (configuration data only, never code) from a parent-managed server, so the parent can update the filter without republishing; this request carries no user data
- Blocked search attempts, and searches on the supported sites, are recorded so a parent can review them from the options page; this can be disabled and cleared
- Those records are also sent, on a schedule, to a server operated by the installing parent, so a parent can review activity without physical access to the device; nothing else is transmitted, and nothing goes to any other party
- The extension only runs on the specific sites listed in its permissions
```

---

## Category

```
Productivity
```

> Alternatively: "Accessibility" — but Productivity is the most common fit for search-modifying extensions and is less likely to trigger extra scrutiny.

---

## Language

```
English
```

---

## Privacy Practices Tab

### Single Purpose Description

> This field is required. Reviewers reject vague or multi-purpose descriptions. Be specific about exactly one thing.

```
This extension is a parental control filter for search. It removes Google AI Mode and AI Overview elements from Google Search results, and blocks searches that match a parent-configured keyword list (and a parent-configured list of sites) on supported search engines, redirecting them to a local block page.
```

### Permission Justifications

> Reviewers check that each permission is justified and narrowly scoped. Provide these in the "Permission justifications" section.

#### `declarativeNetRequest`

```
Used for two things: (1) redirecting Google Search URLs that contain the AI Mode parameter (udm=50) or AI Mode paths (/aimode, /async/aimode) back to standard Google Search results, via static rules in rules.json; and (2) redirecting searches whose query matches the parent-configured keyword list, and navigations to parent-blocked sites, to the extension's local block page, via dynamic rules compiled from the parent's configuration. All matching happens inside the browser.
```

#### `webNavigation`

```
Used to detect in-page (single-page application) navigations that do not trigger traditional network requests. Google Search uses pushState-based navigation, so some AI Mode transitions happen without a full page load. The webNavigation.onHistoryStateUpdated and onBeforeNavigate events allow the extension to catch these transitions and redirect them to standard search.
```

#### `storage`

```
Used to pass the compiled keyword pattern from the service worker to the content script, to cache the parent's downloaded blocklist configuration, and to record blocked search attempts and searches on the supported sites so a parent can review them from the options page. The logs are capped and can be disabled or cleared. They are also uploaded on a schedule to the installing parent's own server so the parent can review them remotely — the extension is a parental supervision tool installed on a device the parent administers, and on ChromeOS there is no other way for a parent to read these records.
```

#### `alarms`

```
Used to periodically re-download the parent-managed blocklist configuration (a small JSON file of keywords and sites — data only, never code) so the parent can update the filter without republishing the extension, and on the same schedule to upload the extension's blocked-attempt and search records to the installing parent's own server for parental review.
```

#### Host permissions (explicit list of search/social sites and blocked sites)

```
Required so that the extension's content scripts and declarativeNetRequest rules can operate on the pages they filter: google.com pages for AI-element hiding, and the search engines and social platforms enumerated in the manifest's host_permissions (plus the parent-blocked sites) for search keyword and site blocking. The list is explicit rather than <all_urls>; the extension does not access any other websites.
```

### Data Use Disclosures

> In the Privacy Practices tab, you must certify data use. **As of v3.1.0 the extension transmits search records to the installing parent's server, so this MUST be disclosed as collected and transferred.** Declaring "no data collected" would be false and is grounds for takedown.

- **Web history / User activity:** disclosed as **collected AND transferred**. Scope: blocked search queries and searches observed on the supported sites, with the site and a timestamp. Destination: a private server operated by the parent who installed the extension, configured by that parent; retained 90 days. Purpose: the extension's single purpose — parental supervision of a minor's search activity on a device the parent administers. Not sold, not shared with any third party, not used for advertising, creditworthiness, or any unrelated purpose.
- Nothing else is transmitted: no page content, no cookies or credentials, no form data, no browsing outside the supported search sites, no account identifiers.
- Certify compliance with the Chrome Web Store Developer Program Policies
- Certify: data is not sold to third parties, not used or transferred for purposes unrelated to the single purpose, and not used or transferred to determine creditworthiness or for lending

---

## Privacy Policy

> Required if you declare any permissions. For an unlisted personal-use extension, a simple inline policy is fine. You can host this as a GitHub Gist or paste it into a simple web page.

> The current policy text lives in `PRIVACY_POLICY.md` in the repo root — keep the hosted copy in sync with it. It covers the AI hiding, the logging of blocked attempts and searches, and the upload of those records to the parent's server. **If you change `LOG_UPLOAD_URL` in `config.js`, the policy and the Privacy Practices tab must change with it.**

> **Privacy policy URL for the store listing:**
> ```
> https://github.com/etladvisors/parent-hide-ai/blob/main/PRIVACY_POLICY.md
> ```

---

## Store Listing Assets

### Icon

- **128x128 PNG** — required for the store listing (you already have `icons/icon128.png`)

### Screenshots

> At least 1 screenshot required (1280x800 or 640x400). Recommended: 2-3 screenshots.

Suggested screenshots:

1. **Google Search results with extension active** — show a normal SERP with no AI Overview visible. Caption: "Google Search results with AI content removed"
2. **Google Search toolbar** — show the search type tabs (All / Images / Videos / etc.) with no AI Mode tab. Caption: "AI Mode tab hidden from search toolbar"
3. **Google homepage** — show google.com with no AI Mode button. Caption: "AI Mode button removed from Google homepage"

> Take these on a clean Chrome profile with the extension loaded. Use a generic query like "weather today" or "best hiking trails."

### Promotional tile (optional)

- 440x280 PNG — not required for unlisted, but if you want one, a simple branded tile works.

---

## Distribution Settings

### Visibility

```
Unlisted
```

> This means the extension will not appear in Chrome Web Store search results. Only people with the direct link can find and install it.

### Regions

```
All regions
```

---

## Review Checklist

Before submitting, verify:

- [ ] Privacy policy is hosted at a public URL and linked in the listing
- [ ] Single purpose description is filled in and matches what the extension actually does
- [ ] All permission justifications are filled in
- [ ] Data use disclosure is completed (answer: **web history / user activity, collected AND transferred** — see below; "no data collected" is no longer true)
- [ ] At least 1 screenshot (1280x800 or 640x400) is uploaded
- [ ] 128x128 icon is uploaded as the store icon
- [ ] Description does not reference "blocking" or "removing" other companies' features in a way that implies malice — use neutral language like "hides," "removes from view," "redirects"
- [ ] No mention of circumventing or bypassing security/safety features (this is a content preference tool, not a circumvention tool)
- [ ] `manifest.json` version field is set (currently `3.1.0`)
- [ ] Data use disclosure reflects the upload (blocked attempts + observed searches leave the device as of v3.1.0)
- [ ] **Before zipping v3.1:** `parent-hide-ai/upload-key.json` exists and holds the Worker's LOG_KEY — it is gitignored, so a fresh clone will not have it, and without it the extension silently never uploads
- [ ] Hosted privacy policy re-published from the updated `PRIVACY_POLICY.md`
- [ ] **Before zipping v3:** deploy `server/worker.js` and set `REMOTE_CONFIG_URL` in `config.js` to its `/config` URL — publishing with `null` means remote updates stay off until the next store review
- [ ] Note: v3 adds only the `alarms` permission, which generates no warning — existing installs are NOT disabled by this update and no re-approval on the child's device is needed
- [ ] Note: v3.1 adds **no** new permissions. The upload endpoint is reached via CORS rather than a host permission, deliberately, so the update installs silently — verified by `npm run test:smoke`
- [ ] If asked about the remote fetch in review: it downloads configuration data (a JSON keyword/site list) only, never code, and sends no user data — this is permitted under the remotely-hosted-code policy

---

## Common Rejection Reasons and How This Listing Avoids Them

| Rejection reason | How we address it |
|---|---|
| Missing or vague single-purpose description | Single purpose is specific: "removes AI Mode and AI Overview elements from Google Search" |
| Unjustified permissions | Each permission has a detailed justification tied to specific functionality |
| Missing privacy policy | Privacy policy provided and hosted at a public URL |
| "Broad host permissions" flag | Host permissions are an explicit list of the filtered sites, not `<all_urls>` |
| Data use disclosure missing | Completed; the search-record upload to the parent's own server is disclosed as collected and transferred, with scope, destination, retention, and purpose stated |
| Undisclosed data collection | The upload is declared in the listing copy, the permission justifications, the Privacy Practices tab, and the hosted privacy policy — all four must agree |
| Extension modifies search results | Clearly framed as a parental control / content filtering tool, not an ad blocker or SEO manipulation tool |
| Keyword spam (rejected once, ref "Yellow Argon", Jul 2026) | Do NOT enumerate brand names (Bing, YouTube, TikTok, …) anywhere in the listing text — say "supported search engines and social platforms" and let the manifest's host_permissions be the authoritative list |
| No screenshots | Screenshots provided showing the extension's effect |

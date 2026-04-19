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
Parental control tool that removes Google AI Mode and AI Overview elements from Google Search results for a distraction-free experience.
```

> 136 chars — trim if needed:

```
Parental control that removes Google AI Mode and AI Overview elements from Google Search for a distraction-free experience.
```

### Detailed Description (16,000 characters max)

```
Parent Hide AI is a lightweight parental control extension that removes AI-generated content from Google Search results.

What it does:
- Hides the "AI Overview" summary block that appears at the top of Google Search results
- Removes the "AI Mode" tab from the Google Search toolbar
- Removes the "AI Mode" button from the Google homepage
- Redirects AI Mode URLs back to standard Google Search results

Why it exists:
This extension was built for parents who want their children to use Google Search as a traditional search engine — seeing real web results from real sources rather than AI-generated summaries. It is designed for use on a child's Chromebook managed through Google Family Link.

How it works:
- Uses CSS rules to hide known Google AI interface elements on search result pages
- Uses a content script with a MutationObserver to detect and hide AI elements that load dynamically after the initial page render
- Uses Chrome's declarativeNetRequest API to redirect AI Mode URLs (containing the udm=50 parameter or /aimode path) back to standard search
- Uses the webNavigation API to handle in-page navigation events that bypass network-level rules

Privacy:
- This extension does not collect, store, or transmit any user data
- This extension does not use analytics, tracking, or remote servers
- All processing happens locally in the browser
- The extension only runs on google.com domains
- No data leaves the browser
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
This extension removes Google AI Mode and AI Overview elements from Google Search results pages, redirecting AI Mode URLs to standard search results. It is a parental control tool for providing children with a traditional, non-AI search experience.
```

### Permission Justifications

> Reviewers check that each permission is justified and narrowly scoped. Provide these in the "Permission justifications" section.

#### `declarativeNetRequest`

```
Used to redirect Google Search URLs that contain the AI Mode parameter (udm=50) or AI Mode paths (/aimode, /async/aimode) back to standard Google Search results. This ensures that if a child clicks an AI Mode link or is redirected to AI Mode, they are sent to regular search results instead. The rules are defined statically in rules.json and only match google.com URLs.
```

#### `webNavigation`

```
Used to detect in-page (single-page application) navigations on google.com that do not trigger traditional network requests. Google Search uses pushState-based navigation, so some AI Mode transitions happen without a full page load. The webNavigation.onHistoryStateUpdated and onBeforeNavigate events allow the extension to catch these transitions and redirect them to standard search. This permission is only used on google.com.
```

#### Host permission: `*://*.google.com/*`

```
Required so that the extension's content script (which hides AI Overview elements in the page) and declarativeNetRequest rules (which redirect AI Mode URLs) can operate on Google Search pages. The extension only modifies google.com pages and does not access any other websites.
```

### Data Use Disclosures

> In the Privacy Practices tab, you must certify data use. Select the following:

- **Does your extension collect or use any user data?** No
- Certify compliance with the Chrome Web Store Developer Program Policies

---

## Privacy Policy

> Required if you declare any permissions. For an unlisted personal-use extension, a simple inline policy is fine. You can host this as a GitHub Gist or paste it into a simple web page.

```
Privacy Policy for Parent Hide AI

Last updated: April 2026

Parent Hide AI does not collect, store, or transmit any personal data or browsing information. The extension operates entirely within the local browser. It does not communicate with any external servers. It does not use cookies, analytics, or tracking of any kind. No data is shared with third parties.

The extension modifies the appearance of Google Search result pages by hiding AI-generated content elements. It also redirects certain Google URLs (AI Mode) to standard search results. All processing occurs locally on the user's device.

Contact: irvin.matt@gmail.com
```

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
- [ ] Data use disclosure is completed (answer: no data collected)
- [ ] At least 1 screenshot (1280x800 or 640x400) is uploaded
- [ ] 128x128 icon is uploaded as the store icon
- [ ] Description does not reference "blocking" or "removing" other companies' features in a way that implies malice — use neutral language like "hides," "removes from view," "redirects"
- [ ] No mention of circumventing or bypassing security/safety features (this is a content preference tool, not a circumvention tool)
- [ ] `manifest.json` version field is set (currently `1.0.0`)

---

## Common Rejection Reasons and How This Listing Avoids Them

| Rejection reason | How we address it |
|---|---|
| Missing or vague single-purpose description | Single purpose is specific: "removes AI Mode and AI Overview elements from Google Search" |
| Unjustified permissions | Each permission has a detailed justification tied to specific functionality |
| Missing privacy policy | Privacy policy provided and hosted at a public URL |
| "Broad host permissions" flag | Host permission is limited to `*.google.com` only, not `<all_urls>` |
| Data use disclosure missing | Completed with "no data collected" |
| Extension modifies search results | Clearly framed as a parental control / content filtering tool, not an ad blocker or SEO manipulation tool |
| No screenshots | Screenshots provided showing the extension's effect |

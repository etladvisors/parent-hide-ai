# Privacy Policy for Parent Hide AI

**Last updated:** August 2026

Parent Hide AI is a parental control extension, installed and configured by a
parent on a device they administer. It does not use cookies, analytics, or
tracking of any kind. No data is sold, and no data is shared with third
parties except as described in section 3 below (service providers that
process data on the parent's behalf).

The extension does three things:

1. **AI content filtering.** It modifies the appearance of Google Search
   result pages by hiding AI-generated content elements, and redirects certain
   Google URLs (AI Mode) to standard search results.

2. **Search keyword filtering.** It blocks searches on supported search and
   social sites when the search query matches a keyword list configured by a
   parent, and blocks a parent-configured list of websites. When a search or
   site is blocked, the extension records the blocked query or domain in the
   browser's extension storage so a parent can review it. It also records
   searches performed on the supported sites, for the same parental-review
   purpose. These logs are capped at a fixed number of entries, can be cleared
   at any time from the extension's options page, and can be disabled entirely
   in the extension's configuration.

3. **Upload to the parent's server.** *(Enabled in this build.)* On a periodic
   schedule, the extension sends the log entries described above — blocked
   queries and observed search queries, with the site they occurred on and a
   timestamp — to a server operated by the parent who installed the extension.
   This exists so a parent can review activity without needing physical access
   to the device, which is the only option on ChromeOS. The destination server
   is set by the parent in the extension's configuration; in this build it is
   a private Cloudflare Worker under the parent's control. Uploaded entries are
   retained there for 90 days and then deleted automatically. Nothing is sent
   to any other party. If the upload fails, entries stay on the device and are
   retried later.

   The extension transmits **only** those log entries. It does not transmit
   page contents, cookies, credentials, form data, browsing history outside the
   supported search sites, or any account identifier.

   On the parent's server, uploaded search queries may be processed
   automatically to help the parent keep the keyword list current: once a day
   the server sends the previous day's queries (query text and the site they
   occurred on — no identifiers) to Anthropic's Claude API, acting as a
   processor for the parent, to identify queries related to the categories the
   parent filters. The result is a suggested update to the parent's own
   keyword list, recorded in an audit log the parent can review. Under
   Anthropic's commercial API terms this data is not used to train models.
   This processing happens on the parent's server, not on the device, and is
   optional — it is off unless the parent configures an API key.

   This behaviour can be turned off by setting `LOG_UPLOAD_URL` to null in the
   extension's configuration, in which case the logs remain on the device only.

**Blocklist updates.** The extension periodically downloads its keyword and
site blocklist (configuration data only — never code) from the same
parent-managed server, so a parent can update the filter without reinstalling
the extension. This request sends no personal data, no browsing data, and no
search queries — it is a plain download of the parent's current blocklist. If
the download fails, the extension keeps using its last known list.

**Who this is for.** This extension is intended for installation by a parent or
guardian on a device used by a minor in their care, as a supervision tool.
Parents installing it are encouraged to tell the person using the device that
it is there and what it records.

All filtering and matching occurs locally on the device. The only outbound
requests are the blocklist download and the log upload described above.

**Contact:** irvin.matt@gmail.com

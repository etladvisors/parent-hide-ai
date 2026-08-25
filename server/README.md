# Search Guard config server

A single Cloudflare Worker (free tier) that serves the remote blocklist to the
extension, receives search digests — from the extension itself (every refresh cycle,
on any platform) and, on a Mac, optionally from the `tools/digest/` launchd job —
and runs a **nightly AI review** that turns the digests back into blocklist updates.

## One-time deploy

```sh
npm install -g wrangler
cd server
npm install                            # Anthropic SDK for the nightly review
wrangler login
wrangler kv namespace create SG_KV     # paste the returned id into wrangler.toml
wrangler secret put ADMIN_KEY          # invent a long random string, e.g. `openssl rand -hex 24`
wrangler secret put LOG_KEY            # a DIFFERENT long random string
wrangler secret put ANTHROPIC_API_KEY  # from console.anthropic.com — powers the nightly review
wrangler deploy                        # prints the worker URL
```

Then:

1. Put `https://<worker-url>/config` into `REMOTE_CONFIG_URL` in
   `parent-hide-ai/config.js` **before** zipping the extension for the store.
2. Put `https://<worker-url>/log` into `LOG_UPLOAD_URL` in
   `parent-hide-ai/config.js`, and the `LOG_KEY` into
   `parent-hide-ai/upload-key.json` (copy `upload-key.example.json`; it is
   gitignored because this repo is public). Without that file the shipped
   extension never uploads.
3. Only if you are also using the Mac digest job: put the same base URL and
   `LOG_KEY` into `tools/digest/config.json` on that machine.

## Updating the blocklist (your daily edit)

```sh
curl -X PUT https://<worker-url>/config \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"version": 2, "terms": ["new slang term"], "domains": ["some-site.com"]}'
```

The body **replaces** the remote list wholesale, so keep a `blocklist.json`
file locally (or in a private repo), edit it, and push the whole file:

```sh
curl -X PUT https://<worker-url>/config \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @blocklist.json
```

Remote terms/domains are **additive** on top of the extension's baked-in
`config.js` — an empty remote list means baseline protection, never less.
The extension re-fetches every 30 minutes (and on browser startup, and via the
"Refresh block list now" button on its options page).

Remote **terms** use the same term syntax as `config.js` (substring by
default, `/word/` for whole-word). Remote **domains** are blocked with
Chrome's plain network-error page rather than the friendly block page — only
domains baked into the manifest get the redirect treatment.

Entries carry a `machine` field (`DEVICE_LABEL` from the extension's config,
the hostname from the Mac job), so uploads from several devices stay
distinguishable.

## Reading the digest

```sh
curl https://<worker-url>/logs?date=2026-08-10 \
  -H "Authorization: Bearer $ADMIN_KEY"
```

Logs expire automatically after 90 days.

## Nightly AI review

Every night (09:00 UTC — edit `[triggers]` in `wrangler.toml` to change it,
times are always UTC) the Worker reviews the previous day's **got-through**
searches: it collects the `blocked: false` entries from that day's digests,
drops anything the current blocklist (baked-in + remote) already covers, and
asks Claude to flag queries related to eating disorders. Vetted proposals are
merged **additively** into the remote blocklist — the same list the extension
polls every 30 minutes, so a term the review adds tonight is blocking on the
Chromebook by morning, with no republish.

Guardrails, because the model's output is never trusted verbatim:

- Proposals must be plain lowercase words/phrases (optionally `/slashed/` for
  whole-word) — regex syntax, duplicates, and terms an existing rule already
  covers are rejected before they touch the list.
- At most 15 terms are added per night, and the review can only ever ADD
  terms. It never removes anything and never touches domains.
- Every run writes an audit record saying exactly what was reviewed, what was
  added and why, and what was rejected. Records expire after 90 days.

The extension's baked-in `config.js` list is bundled into the Worker at deploy
time so the reviewer knows what the device already blocks — redeploy the
Worker after materially changing `config.js`.

Read the audit trail (all runs, or one day in full):

```sh
curl https://<worker-url>/reviews -H "Authorization: Bearer $ADMIN_KEY"
curl https://<worker-url>/reviews?date=2026-08-24 -H "Authorization: Bearer $ADMIN_KEY"
```

Run a review on demand (e.g. right after deploying, to see it work; `force`
re-runs a date that already has an audit record):

```sh
curl -X POST https://<worker-url>/review \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"date": "2026-08-24", "force": true}'
```

To **undo** an added term, pull the current config (`GET /config`), delete the
term, and `PUT /config` as in the daily-edit section above — the review will
not re-add it unless the model proposes it again on a later night (if a term
keeps coming back wrongly, add a note to `REVIEW_SYSTEM` in `worker.js`).

To **disable** the review, remove the `[triggers]` block from `wrangler.toml`
and redeploy (or `wrangler secret delete ANTHROPIC_API_KEY` — a run without
the key records a `reviewError` and changes nothing).

A failed nightly run (API outage, etc.) records why under that date's
`reviewError` (visible via `GET /reviews?date=...`) and is **not** retried
automatically — POST `/review` with that date to re-run it by hand.

Cost: one Claude API call per night over at most 400 unique queries —
typically a fraction of a cent per day on `claude-opus-5`.

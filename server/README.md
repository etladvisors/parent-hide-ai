# Search Guard config server

A single Cloudflare Worker (free tier) that serves the remote blocklist to the
extension and receives the nightly search digest from the launchd job.

## One-time deploy

```sh
npm install -g wrangler
cd server
wrangler login
wrangler kv namespace create SG_KV     # paste the returned id into wrangler.toml
wrangler secret put ADMIN_KEY          # invent a long random string, e.g. `openssl rand -hex 24`
wrangler secret put LOG_KEY            # a DIFFERENT long random string
wrangler deploy                        # prints the worker URL
```

Then:

1. Put `https://<worker-url>/config` into `REMOTE_CONFIG_URL` in
   `parent-hide-ai/config.js` **before** zipping the extension for the store.
2. Put the same base URL and the `LOG_KEY` into `tools/digest/config.json` on
   the child's machine.

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

## Reading the digest

```sh
curl https://<worker-url>/logs?date=2026-08-10 \
  -H "Authorization: Bearer $ADMIN_KEY"
```

Logs expire automatically after 90 days.

// ---------------------------------------------------------------------------
// worker.js — Cloudflare Worker backing Search Guard's remote blocklist.
//
// Endpoints:
//   GET  /config          public, CORS-open. The extension polls this.
//   PUT  /config          Bearer ADMIN_KEY. Replace the blocklist.
//   POST /log             Bearer LOG_KEY. The launchd digest job uploads here.
//   GET  /logs?date=...   Bearer ADMIN_KEY. Read a day's uploads.
//
// Storage: one KV namespace bound as SG_KV.
//   "config"          -> {version, updatedAt, terms[], domains[]}
//   "log:<date>:<id>" -> one uploaded digest (expires after 90 days)
//
// Secrets (wrangler secret put): ADMIN_KEY, LOG_KEY. Two keys on purpose —
// LOG_KEY lives on the child's machine and can only ADD log entries; it can
// never read logs back or touch the blocklist.
// ---------------------------------------------------------------------------

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const DEFAULT_CONFIG = '{"version":0,"terms":[],"domains":[]}';
const LOG_TTL_SECONDS = 60 * 60 * 24 * 90;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

function authorized(request, key) {
  return key && request.headers.get("Authorization") === `Bearer ${key}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    if (url.pathname === "/config" && request.method === "GET") {
      const config = await env.SG_KV.get("config");
      return new Response(config || DEFAULT_CONFIG, {
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
          ...CORS,
        },
      });
    }

    if (url.pathname === "/config" && request.method === "PUT") {
      if (!authorized(request, env.ADMIN_KEY)) return json({ error: "unauthorized" }, 401);
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "invalid JSON" }, 400);
      }
      if (!Array.isArray(body.terms) || !Array.isArray(body.domains)) {
        return json({ error: "terms and domains must be arrays of strings" }, 400);
      }
      if (![...body.terms, ...body.domains].every((s) => typeof s === "string")) {
        return json({ error: "terms and domains must be arrays of strings" }, 400);
      }
      const config = {
        version: body.version ?? Date.now(),
        updatedAt: new Date().toISOString(),
        terms: body.terms,
        domains: body.domains,
      };
      await env.SG_KV.put("config", JSON.stringify(config));
      return json({ ok: true, version: config.version, terms: config.terms.length, domains: config.domains.length });
    }

    if (url.pathname === "/log" && request.method === "POST") {
      if (!authorized(request, env.LOG_KEY)) return json({ error: "unauthorized" }, 401);
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "invalid JSON" }, 400);
      }
      const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : today();
      const key = `log:${date}:${crypto.randomUUID()}`;
      await env.SG_KV.put(key, JSON.stringify(body), { expirationTtl: LOG_TTL_SECONDS });
      return json({ ok: true });
    }

    if (url.pathname === "/logs" && request.method === "GET") {
      if (!authorized(request, env.ADMIN_KEY)) return json({ error: "unauthorized" }, 401);
      const date = url.searchParams.get("date") || today();
      const list = await env.SG_KV.list({ prefix: `log:${date}:` });
      const uploads = [];
      for (const entry of list.keys) {
        const value = await env.SG_KV.get(entry.name);
        if (value) uploads.push(JSON.parse(value));
      }
      return json({ date, uploads });
    }

    return json({ error: "not found" }, 404);
  },
};

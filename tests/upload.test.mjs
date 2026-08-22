// ---------------------------------------------------------------------------
// upload.test.mjs — offline checks for the log-upload batching in
// parent-hide-ai/upload.js. No network, no Chrome.
//
// Run with: npm run test:upload
//
// The property that matters: the cursor is a watermark over BOTH logs, so
// after a successful batch nothing with `at <= cursor` may still be unsent.
// ---------------------------------------------------------------------------
import { planUpload, UPLOAD_BATCH_LIMIT } from "../parent-hide-ai/upload.js";

let failures = 0;
function check(name, cond, detail = "") {
  if (!cond) {
    failures++;
    console.log(`FAIL  ${name}${detail ? `\n      ${detail}` : ""}`);
  } else {
    console.log(`PASS  ${name}`);
  }
}

const blocked = (at) => ({ at, reason: "term", value: "bmi" });
const search = (at) => ({ at, host: "google.com", q: "cake", blocked: false });

// --- only new entries go up -------------------------------------------------
{
  const p = planUpload({
    blocked: [blocked(100), blocked(200)],
    searches: [search(150), search(250)],
    since: 150,
  });
  check("skips entries at or before the cursor",
    p.blocked.length === 1 && p.searches.length === 1,
    JSON.stringify(p));
  check("cursor lands on the newest entry sent", p.cursor === 250);
  check("nothing left over", p.remaining === 0);
}

// --- an empty run leaves the cursor alone -----------------------------------
{
  const p = planUpload({ blocked: [], searches: [], since: 999 });
  check("empty run holds the cursor", p.cursor === 999 && p.remaining === 0);
}

// --- the watermark must not outrun unsent entries ---------------------------
{
  // Blocked entries are all NEWER than the searches. Draining blocked-first
  // would set the cursor past every search and lose them permanently.
  const p = planUpload({
    blocked: [blocked(900), blocked(901), blocked(902)],
    searches: [search(10), search(20), search(30)],
    since: 0,
    limit: 3,
  });
  const newestSent = Math.max(
    ...[...p.blocked, ...p.searches].map((e) => e.at)
  );
  check("batches in time order across both logs",
    p.searches.length === 3 && p.blocked.length === 0,
    JSON.stringify(p));
  check("cursor never exceeds what was actually sent", p.cursor === newestSent);
}

// --- a partial batch leaves the rest for next time --------------------------
{
  const many = Array.from({ length: 1200 }, (_, i) => search(1000 + i));
  const p = planUpload({ blocked: [], searches: many, since: 0 });
  check("caps the batch", p.searches.length === UPLOAD_BATCH_LIMIT);
  check("reports the backlog", p.remaining === 1200 - UPLOAD_BATCH_LIMIT);

  // The next run must pick up exactly where this one stopped.
  const next = planUpload({ blocked: [], searches: many, since: p.cursor });
  check("next run resumes at the cursor with no gap and no repeat",
    next.searches[0].at === p.searches.at(-1).at + 1,
    `${next.searches[0].at} vs ${p.searches.at(-1).at}`);
}

// --- same-millisecond entries are never split across batches ----------------
{
  // 5 entries share ms 500, straddling a limit of 3. Splitting them would
  // strand the tail forever, since the next run filters on `at > cursor`.
  const same = [search(500), search(500), search(500), search(500), search(500)];
  const p = planUpload({ blocked: [], searches: same, since: 0, limit: 3 });
  check("keeps a same-ms group whole", p.searches.length === 5 && p.remaining === 0,
    JSON.stringify({ sent: p.searches.length, remaining: p.remaining }));

  const next = planUpload({ blocked: [], searches: same, since: p.cursor });
  check("nothing stranded after a same-ms group", next.searches.length === 0);
}

// --- malformed entries can't poison a batch ---------------------------------
{
  const p = planUpload({
    blocked: [{ at: null }, { value: "no timestamp" }, blocked(700)],
    searches: undefined,
    since: 0,
  });
  check("drops entries without a usable timestamp",
    p.blocked.length === 1 && p.cursor === 700,
    JSON.stringify(p));
}

console.log(failures ? `\n${failures} failure(s)` : "\nall cases passed");
process.exit(failures ? 1 : 0);

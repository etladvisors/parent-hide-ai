// ---------------------------------------------------------------------------
// upload.js — batching logic for the nightly-equivalent log upload.
//
// Split out from background.js so it can be unit-tested offline
// (tests/upload.test.mjs). Nothing here touches the network or chrome.*.
//
// The cursor is a single timestamp watermark covering BOTH logs: everything
// with `at <= cursor` has been uploaded. That is why a batch is selected by
// merging the two logs in time order rather than draining one and then the
// other — draining blocked-first would push the watermark past searches that
// were never sent.
// ---------------------------------------------------------------------------

// Chosen so a first upload after a long offline stretch arrives in a few
// batches rather than one oversized POST. The alarm fires every
// REMOTE_REFRESH_MINUTES, so a backlog drains within a few hours.
export const UPLOAD_BATCH_LIMIT = 500;

export function planUpload({
  blocked = [],
  searches = [],
  since = 0,
  limit = UPLOAD_BATCH_LIMIT,
} = {}) {
  const fresh = (entries, kind) =>
    (Array.isArray(entries) ? entries : [])
      .filter((e) => Number.isFinite(Number(e?.at)) && Number(e.at) > since)
      .map((e) => ({ kind, at: Number(e.at), e }));

  const all = [...fresh(blocked, "blocked"), ...fresh(searches, "search")].sort(
    (a, b) => a.at - b.at
  );

  // Never split a group of entries sharing one millisecond across two batches:
  // the watermark would land mid-group and the tail would be filtered out
  // (`at > since`) on the next run. Overshooting the limit slightly is cheaper
  // than dropping entries.
  let end = Math.min(Math.max(1, limit), all.length);
  if (end < all.length) {
    const boundary = all[end - 1].at;
    while (end < all.length && all[end].at === boundary) end++;
  }
  const take = all.slice(0, end);

  return {
    blocked: take.filter((x) => x.kind === "blocked").map((x) => x.e),
    searches: take.filter((x) => x.kind === "search").map((x) => x.e),
    cursor: take.length ? take[take.length - 1].at : since,
    remaining: all.length - take.length,
  };
}

// ---------------------------------------------------------------------------
// content.js — backstop for sites that change the URL without a page load.
//
// YouTube, Reddit, Pinterest and TikTok all run searches through pushState, so
// the network rules catch the data request but the visible page stays put.
// This closes that gap.
// ---------------------------------------------------------------------------

(async () => {
  const { sg_pattern, sg_engines, sg_logSearches } =
    await chrome.storage.local.get(["sg_pattern", "sg_engines", "sg_logSearches"]);
  if (!sg_pattern) return;

  const matcher = new RegExp(sg_pattern, "i");
  const params = new Set(sg_engines || ["q"]);
  const blockPage = chrome.runtime.getURL("blocked.html");

  // Report each distinct query to the service worker's local log. Searches
  // blocked at the network layer never reach this script — those are logged
  // by blocked.html — so this captures what got THROUGH the filter.
  let lastReported = null;
  function report(query, blocked) {
    if (!sg_logSearches || query === lastReported) return;
    lastReported = query;
    try {
      chrome.runtime
        .sendMessage({ type: "sg:query", q: query, host: location.hostname, blocked })
        .catch(() => {});
    } catch {
      // Extension reloaded out from under us — nothing to do.
    }
  }

  function queryOf(url) {
    const search = new URL(url).searchParams;
    for (const key of params) {
      const value = search.get(key);
      if (value) return value;
    }
    return null;
  }

  function check() {
    if (location.href.startsWith(blockPage)) return;
    let query;
    try {
      query = queryOf(location.href);
    } catch {
      return;
    }
    if (!query) return;
    const blocked = matcher.test(query);
    report(query, blocked);
    if (blocked) {
      location.replace(
        `${blockPage}?reason=term&q=${encodeURIComponent(query)}`
      );
    }
  }

  check();

  // Catch pushState / replaceState / back-forward navigation.
  for (const method of ["pushState", "replaceState"]) {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      queueMicrotask(check);
      return result;
    };
  }
  addEventListener("popstate", check);

  // Some sites swap results in without touching history at all.
  let lastHref = location.href;
  new MutationObserver(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      check();
    }
  }).observe(document, { subtree: true, childList: true });
})();

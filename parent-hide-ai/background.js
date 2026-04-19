// Backup handler: DNR rules handle most cases, but webNavigation catches
// same-document updates (Google uses pushState a lot on search results).

const AI_MODE_HOSTS = ["www.google.com", "google.com"];

function shouldStrip(url) {
  try {
    const u = new URL(url);
    if (!AI_MODE_HOSTS.includes(u.hostname)) return null;

    // Strip udm=50 (AI Mode) from any google.com URL
    if (u.searchParams.get("udm") === "50") {
      u.searchParams.delete("udm");
      return u.toString();
    }

    // Redirect /aimode to /search
    if (u.pathname === "/aimode" || u.pathname === "/async/aimode") {
      const q = u.searchParams.get("q") || "";
      return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
    }

    return null;
  } catch {
    return null;
  }
}

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  const newUrl = shouldStrip(details.url);
  if (newUrl) {
    chrome.tabs.update(details.tabId, { url: newUrl });
  }
});

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0) return;
  const newUrl = shouldStrip(details.url);
  if (newUrl) {
    chrome.tabs.update(details.tabId, { url: newUrl });
  }
});

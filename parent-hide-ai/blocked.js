const params = new URLSearchParams(location.search);
const reason = params.get("reason");
const query = params.get("q");
const host = params.get("host");

const detail = document.getElementById("detail");
if (reason === "site" && host) {
  document.getElementById("heading").textContent = "This site is turned off.";
  detail.innerHTML = `You tried to open <span class="term"></span>.`;
  detail.querySelector(".term").textContent = host;
} else if (query) {
  detail.innerHTML = `You searched for <span class="term"></span>.`;
  detail.querySelector(".term").textContent = query.replace(/\+/g, " ");
} else {
  detail.remove();
}

document.getElementById("back").addEventListener("click", () => {
  // history.back() would land right back on the blocked URL, so go two deep
  // and fall back to a blank tab if there's nothing behind us.
  if (history.length > 2) history.go(-2);
  else location.href = "about:blank";
});

const store = await chrome.storage.local.get([
  "sg_support",
  "sg_logging",
  "sg_logLimit",
]);

if (store.sg_support) {
  const box = document.getElementById("support");
  document.getElementById("support-name").textContent = store.sg_support.name;
  document.getElementById("support-detail").textContent =
    store.sg_support.detail;
  box.hidden = false;
}

if (store.sg_logging) {
  const { sg_log = [] } = await chrome.storage.local.get("sg_log");
  sg_log.push({
    at: Date.now(),
    reason,
    value: query ? query.replace(/\+/g, " ") : host,
  });
  const limit = store.sg_logLimit || 300;
  await chrome.storage.local.set({ sg_log: sg_log.slice(-limit) });
}

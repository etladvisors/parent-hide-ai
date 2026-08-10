const fmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

async function render() {
  const {
    sg_log = [],
    sg_searchLog = [],
    sg_ruleCount = 0,
    sg_logging,
    sg_remote,
    sg_remoteAt,
    sg_remoteError,
  } = await chrome.storage.local.get([
    "sg_log",
    "sg_searchLog",
    "sg_ruleCount",
    "sg_logging",
    "sg_remote",
    "sg_remoteAt",
    "sg_remoteError",
  ]);

  const active = await chrome.declarativeNetRequest.getDynamicRules();
  document.getElementById("status").textContent =
    `${active.length} rules active (${sg_ruleCount} compiled). ` +
    (sg_logging ? "Logging is on." : "Logging is off.");

  let remoteLine;
  if (sg_remote) {
    remoteLine =
      `Remote block list version ${sg_remote.version ?? "?"} ` +
      `(${sg_remote.terms.length} terms, ${sg_remote.domains.length} sites), ` +
      `fetched ${fmt.format(new Date(sg_remoteAt))}.`;
    if (sg_remoteError) remoteLine += ` Last refresh failed: ${sg_remoteError}`;
  } else if (sg_remoteError) {
    remoteLine = `Remote block list unavailable: ${sg_remoteError}`;
  } else {
    remoteLine = "Remote block list is not configured.";
  }
  document.getElementById("remote").textContent = remoteLine;

  function renderRows(boxId, entries, emptyText, valueOf) {
    const box = document.getElementById(boxId);
    box.replaceChildren();

    if (!entries.length) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = emptyText;
      box.append(p);
      return;
    }

    for (const entry of [...entries].reverse()) {
      const row = document.createElement("div");
      row.className = "row";

      const val = document.createElement("span");
      val.className = "val";
      val.textContent = valueOf(entry);

      const when = document.createElement("time");
      when.textContent = fmt.format(new Date(entry.at));

      row.append(val, when);
      box.append(row);
    }
  }

  renderRows("log", sg_log, "Nothing blocked yet.", (e) => e.value ?? "(unknown)");
  renderRows(
    "searches",
    sg_searchLog.slice(-200),
    "No searches recorded yet.",
    (e) => `${e.q} — ${e.host}`
  );
}

document.getElementById("clear").addEventListener("click", async () => {
  await chrome.storage.local.set({ sg_log: [] });
  render();
});

document.getElementById("clear-searches").addEventListener("click", async () => {
  await chrome.storage.local.set({ sg_searchLog: [] });
  render();
});

document.getElementById("refresh").addEventListener("click", async () => {
  const button = document.getElementById("refresh");
  button.disabled = true;
  button.textContent = "Refreshing…";
  try {
    await chrome.runtime.sendMessage({ type: "sg:reinstall" });
  } finally {
    button.disabled = false;
    button.textContent = "Refresh block list now";
    render();
  }
});

render();

const fmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

async function render() {
  const { sg_log = [], sg_ruleCount = 0, sg_logging } =
    await chrome.storage.local.get(["sg_log", "sg_ruleCount", "sg_logging"]);

  const active = await chrome.declarativeNetRequest.getDynamicRules();
  document.getElementById("status").textContent =
    `${active.length} rules active (${sg_ruleCount} compiled). ` +
    (sg_logging ? "Logging is on." : "Logging is off.");

  const box = document.getElementById("log");
  box.replaceChildren();

  if (!sg_log.length) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "Nothing blocked yet.";
    box.append(p);
    return;
  }

  for (const entry of [...sg_log].reverse()) {
    const row = document.createElement("div");
    row.className = "row";

    const val = document.createElement("span");
    val.className = "val";
    val.textContent = entry.value ?? "(unknown)";

    const when = document.createElement("time");
    when.textContent = fmt.format(new Date(entry.at));

    row.append(val, when);
    box.append(row);
  }
}

document.getElementById("clear").addEventListener("click", async () => {
  await chrome.storage.local.set({ sg_log: [] });
  render();
});

render();

// ---------------------------------------------------------------------------
// config.js — the only file you normally need to edit.
//
// Reload the extension (chrome://extensions -> reload) after changing this.
// ---------------------------------------------------------------------------

// Terms are matched case-insensitively against the decoded search query.
// Spaces in a term will match "+", "%20", "-" or "_" in the URL, so
// "body mass index" catches "body+mass+index" and "body-mass-index".
//
// Matching is SUBSTRING by default, so "calorie" also catches "calories" and
// "calorie-counter". Wrap a term in slashes to make it a whole-word match
// instead: "/diet/" matches "diet" but not "dietary" or "dietitian".
export const BLOCKED_TERMS = [
  // --- body metrics ---
  "bmi",
  "body mass index",
  "ideal weight",
  "goal weight",
  "body fat percentage",
  "waist to hip",
  "how much should i weigh",

  // --- calorie tracking ---
  "calorie",
  "kcal",
  "calorie deficit",
  "how many calories",
  "macro calculator",
  "tdee",
  "bmr calculator",

  // --- restriction and dieting ---
  "/diet/",
  "dieting",
  "lose weight",
  "weight loss",
  "fat loss",
  "slim down",
  "flat stomach",
  "appetite suppressant",
  "meal replacement",

  // --- fasting ---
  "fasting",
  "water fast",
  "omad",
  "extended fast",

  // --- pro-eating-disorder community terms ---
  // These tags are the main thing worth blocking. The vocabulary shifts, so
  // add new terms here as you notice them. See README for how to spot them.
  "thinspo",
  "thinspiration",
  "bonespo",
  "meanspo",
  "proana",
  "pro ana",
  "promia",
  "pro mia",
  "ana coach",
  "ana buddy",
  "ed twitter",
  "edtwt",

  // --- compensatory behaviour ---
  "how to purge",
  "laxative weight",
  "diuretic weight",
  "compensate calories",
];

// Whole domains to block outright, including their subdomains.
// Calorie trackers and BMI calculators mostly live here rather than in search.
export const BLOCKED_DOMAINS = [
  "myfitnesspal.com",
  "cronometer.com",
  "loseit.com",
  "calorieking.com",
  "fatsecret.com",
  "nutritionix.com",
  "caloriecounter.com",
  "bmi-calculator.net",
  "calculator.net",
  "smartbmicalculator.com",
  "noom.com",
  "weightwatchers.com",
  "ww.com",
];

// Search engines to watch. `domains` are literal domains (subdomains are
// included automatically); `param` names the query parameter that carries the
// search terms. Any URL on these domains with a matching term in that param is
// blocked — search paths, image search, autocomplete, all of it.
// If you add a domain here, add it to host_permissions in manifest.json too.
export const SEARCH_ENGINES = [
  { domains: ["google.com", "google.co.uk"], param: "q" },
  { domains: ["bing.com"], param: "q" },
  { domains: ["duckduckgo.com"], param: "q" },
  { domains: ["search.yahoo.com"], param: "p" },
  { domains: ["search.brave.com"], param: "q" },
  { domains: ["ecosia.org"], param: "q" },
  { domains: ["youtube.com"], param: "search_query" },
  { domains: ["pinterest.com"], param: "q" },
  { domains: ["reddit.com"], param: "q" },
  { domains: ["tiktok.com"], param: "q" },
  { domains: ["tumblr.com"], param: "q" },
  { domains: ["instagram.com"], param: "q" },
];

// Remote blocklist (optional). When set, the extension fetches this URL on a
// schedule and adds its terms and domains ON TOP of the lists above — remote
// config can only tighten blocking, never loosen it. The response must be JSON:
//   { "version": 3, "terms": ["..."], "domains": ["..."] }
// Deploy server/worker.js and put its /config URL here BEFORE zipping for the
// store. Leave null to disable remote updates entirely.
//
// NOTE: remotely-added domains are blocked with a plain DNR "block" action
// (Chrome's network-error page) rather than the friendly block page, because
// redirect rules only fire on hosts listed in manifest.json host_permissions.
export const REMOTE_CONFIG_URL =
  "https://sg-config.parent-hide-ai.workers.dev/config";

// How often to re-fetch the remote list, in minutes.
export const REMOTE_REFRESH_MINUTES = 30;

// Record every search seen on the watched engines (not just blocked ones) in
// local extension storage, so a parent can review what got *through* the
// filter. Local-only, capped, clearable from the options page.
export const LOG_SEARCHES = true;

// How many observed searches to keep before the oldest are dropped.
export const SEARCH_LOG_LIMIT = 2000;

// Record blocked attempts locally so you can review them at chrome://extensions
// -> Search Guard -> Extension options. Set to false for no logging at all.
// Read the README section on this before you turn it on — it is a real
// trade-off, not a free win.
export const LOG_ATTEMPTS = true;

// How many attempts to keep before the oldest are dropped.
export const LOG_LIMIT = 300;

// Optional support line shown on the block page. Set to null to hide it.
export const SUPPORT_LINE = {
  name: "National Alliance for Eating Disorders",
  detail: "1-866-662-1235, weekdays",
};

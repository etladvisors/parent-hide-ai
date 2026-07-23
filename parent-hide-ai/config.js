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

// Search engines to watch. Each entry names the query parameter that carries
// the search terms. Add more if you find one that slips through.
export const SEARCH_ENGINES = [
  { host: "google\\.[a-z.]{2,7}", path: "/search", param: "q" },
  { host: "google\\.[a-z.]{2,7}", path: "/complete/search", param: "q" }, // autocomplete
  { host: "bing\\.com", path: "/search", param: "q" },
  { host: "bing\\.com", path: "/images/search", param: "q" },
  { host: "duckduckgo\\.com", path: "/", param: "q" },
  { host: "search\\.yahoo\\.com", path: "/search", param: "p" },
  { host: "search\\.brave\\.com", path: "/search", param: "q" },
  { host: "www\\.ecosia\\.org", path: "/search", param: "q" },
  { host: "youtube\\.com", path: "/results", param: "search_query" },
  { host: "pinterest\\.[a-z.]{2,7}", path: "/search/", param: "q" },
  { host: "reddit\\.com", path: "/search", param: "q" },
  { host: "tiktok\\.com", path: "/search", param: "q" },
  { host: "tumblr\\.com", path: "/search", param: "q" },
  { host: "instagram\\.com", path: "/explore/search", param: "q" },
];

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

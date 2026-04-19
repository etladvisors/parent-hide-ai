import { Page, test } from "@playwright/test";

/**
 * Detect if the current page is showing a CAPTCHA.
 */
async function isCaptchaPage(page: Page): Promise<boolean> {
  try {
    await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});

    return await page.evaluate(() => {
      const body = document.body?.innerText || "";
      const title = document.title || "";
      return (
        document.querySelector("#captcha-form") !== null ||
        document.querySelector("#recaptcha") !== null ||
        document.querySelector("iframe[src*='recaptcha']") !== null ||
        title.includes("unusual traffic") ||
        body.includes("systems have detected unusual traffic") ||
        body.includes("are not a robot") ||
        body.includes("Before you continue to Google")
      );
    });
  } catch {
    return false;
  }
}

/**
 * If a CAPTCHA is detected, wait for the user to solve it manually.
 * Polls every 3 seconds for up to 3 minutes.
 */
export async function waitForCaptchaSolve(page: Page): Promise<void> {
  if (!(await isCaptchaPage(page))) return;

  console.log("\n⚠️  CAPTCHA detected — please solve it in the browser window...");
  console.log("   You have up to 3 minutes. Tests will resume automatically.\n");

  const maxWait = 180_000;
  const pollInterval = 3_000;
  let waited = 0;

  while (waited < maxWait) {
    await page.waitForTimeout(pollInterval);
    waited += pollInterval;

    if (!(await isCaptchaPage(page))) {
      console.log("✓  CAPTCHA solved, continuing tests.\n");
      return;
    }
  }

  test.skip(true, "CAPTCHA not solved within 3 minutes");
}

/**
 * One-time setup: navigate to google.com, solve CAPTCHA if needed,
 * accept consent, and do a warm-up search to establish the session.
 * Call this once in beforeAll — not per-test.
 */
export async function warmUpGoogle(page: Page): Promise<void> {
  // Go to google.com homepage (not affected by extension redirects)
  await page.goto("https://www.google.com", { waitUntil: "domcontentloaded" });
  await waitForCaptchaSolve(page);

  // Handle consent dialog
  const consentButtons = [
    'button:has-text("Accept all")',
    'button:has-text("I agree")',
    'button:has-text("Accept")',
    'button:has-text("Reject all")',
  ];

  for (const selector of consentButtons) {
    const btn = page.locator(selector).first();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(1000);
      break;
    }
  }

  // Do a warm-up search to establish the session with Google
  await page.goto("https://www.google.com/search?q=hello", {
    waitUntil: "domcontentloaded",
  });
  await waitForCaptchaSolve(page);
  await page.waitForTimeout(2000);
}

/**
 * Search queries likely to trigger AI Overview / AI Mode elements.
 */
export const AI_QUERIES = [
  "what is photosynthesis",
  "how does a combustion engine work",
  "why is the sky blue",
  "benefits of drinking water",
  "what causes earthquakes",
];

/**
 * Navigate to a Google search results page and wait for content to load.
 */
export async function searchGoogle(page: Page, query: string): Promise<void> {
  await page.goto(
    `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    { waitUntil: "domcontentloaded" }
  );
  await waitForCaptchaSolve(page);

  // Wait for main search results container
  await page.waitForSelector("#search, #rso", { timeout: 10_000 }).catch(() => {});

  // Give lazy-loaded AI content time to appear
  await page.waitForTimeout(3000);
}

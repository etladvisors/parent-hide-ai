import { test, expect } from "@playwright/test";
import { launchWithExtension, cleanup } from "./helpers/extension";
import { warmUpGoogle, waitForCaptchaSolve } from "./helpers/google";
import type { BrowserContext, Page } from "@playwright/test";

/**
 * Verifies the AI Mode button is not visible on the Google homepage
 * or search results.
 */

let context: BrowserContext;
let page: Page;
let userDataDir: string;

/**
 * Assert no buttons or links with "AI Mode" text are visible on the page.
 */
async function assertNoVisibleAIMode(page: Page): Promise<void> {
  const visible = await page.evaluate(() => {
    const found: string[] = [];
    const elements = document.querySelectorAll("button, a, h1, h2, h3, [role='heading']");
    for (const el of elements) {
      const text = el.textContent?.trim() || "";
      if (/\bai mode\b/i.test(text)) {
        const style = window.getComputedStyle(el);
        if (style.display !== "none" && style.visibility !== "hidden") {
          found.push(`<${el.tagName.toLowerCase()}> "${text.slice(0, 50)}"`);
        }
      }
    }
    return found;
  });

  expect(visible, "No buttons/links with 'AI Mode' text should be visible").toEqual([]);
}

test.describe("Parent Hide AI @ci", () => {
  test.beforeAll(async () => {
    const session = await launchWithExtension();
    context = session.context;
    page = session.page;
    userDataDir = session.userDataDir;
    await warmUpGoogle(page);
  });

  test.afterAll(async () => {
    await cleanup({ context, page, userDataDir });
  });

  test("AI Mode button is not visible on homepage or search results", async () => {
    // Check the homepage
    await page.goto("https://www.google.com", { waitUntil: "domcontentloaded" });
    await waitForCaptchaSolve(page);
    await page.waitForTimeout(2000);
    await assertNoVisibleAIMode(page);

    // Check search results
    await page.goto(
      "https://www.google.com/search?q=what+is+photosynthesis",
      { waitUntil: "domcontentloaded" },
    );
    await waitForCaptchaSolve(page);
    await page.waitForTimeout(3000);
    await assertNoVisibleAIMode(page);
  });
});

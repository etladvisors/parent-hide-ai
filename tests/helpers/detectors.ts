import { Page, expect } from "@playwright/test";

/**
 * Selectors for AI Overview blocks — mirrors hide.css lines 9-17.
 */
export const AI_OVERVIEW_SELECTORS = [
  "#m-x-content",
  'div[data-attrid="AIOverview"]',
  "div[jsname][data-mcareid]",
  'div[data-subtree="aio"]',
  'div[aria-label*="AI Overview" i]',
  '[data-async-context*="aio:"]',
];

/**
 * Selectors for AI Mode tabs/buttons — mirrors hide.css lines 27-38.
 */
export const AI_MODE_SELECTORS = [
  'a[href*="udm=50"]',
  'a[href*="/aimode"]',
  'a[aria-label*="AI Mode" i]',
  'button[aria-label*="AI Mode" i]',
  'div[aria-label*="AI Mode" i][role="button"]',
];

/**
 * Assert that ALL known AI element selectors are either absent or hidden.
 * Passes if element doesn't exist OR exists but has display:none / visibility:hidden.
 */
export async function assertAllAIElementsHidden(page: Page): Promise<void> {
  const allSelectors = [...AI_OVERVIEW_SELECTORS, ...AI_MODE_SELECTORS];

  for (const selector of allSelectors) {
    const locator = page.locator(selector);
    const count = await locator.count();

    for (let i = 0; i < count; i++) {
      await expect(locator.nth(i)).not.toBeVisible();
    }
  }

  // Also check text-based: no visible heading starting with "AI Overview"
  const visibleAIHeadings = await page.evaluate(() => {
    const headings = document.querySelectorAll("h1, h2, h3, [role='heading']");
    let count = 0;
    for (const h of headings) {
      const text = h.textContent?.trim().slice(0, 30) || "";
      if (/^ai overview/i.test(text) || /^ai mode/i.test(text)) {
        const style = window.getComputedStyle(h);
        if (style.display !== "none" && style.visibility !== "hidden") {
          count++;
        }
      }
    }
    return count;
  });

  expect(visibleAIHeadings).toBe(0);
}

/**
 * Count how many AI elements are currently visible on the page.
 * Used by baseline tests to confirm Google is serving AI content.
 */
export async function countVisibleAIElements(page: Page): Promise<{
  overviewCount: number;
  modeCount: number;
}> {
  let overviewCount = 0;
  let modeCount = 0;

  for (const selector of AI_OVERVIEW_SELECTORS) {
    const locator = page.locator(selector);
    const count = await locator.count();
    for (let i = 0; i < count; i++) {
      if (await locator.nth(i).isVisible().catch(() => false)) {
        overviewCount++;
      }
    }
  }

  for (const selector of AI_MODE_SELECTORS) {
    const locator = page.locator(selector);
    const count = await locator.count();
    for (let i = 0; i < count; i++) {
      if (await locator.nth(i).isVisible().catch(() => false)) {
        modeCount++;
      }
    }
  }

  return { overviewCount, modeCount };
}

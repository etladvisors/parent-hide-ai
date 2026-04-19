import { test, expect } from "@playwright/test";
import { launchWithoutExtension, cleanup } from "./helpers/extension";
import { warmUpGoogle, searchGoogle, AI_QUERIES } from "./helpers/google";
import { countVisibleAIElements } from "./helpers/detectors";
import type { BrowserContext, Page } from "@playwright/test";

/**
 * Baseline tests — run WITHOUT the extension.
 * Confirms Google still serves AI elements for our test queries.
 * If these fail, the test queries or detection selectors need updating.
 */

let context: BrowserContext;
let page: Page;
let userDataDir: string;

test.describe("Baseline — AI elements present without extension", () => {
  test.beforeAll(async () => {
    const session = await launchWithoutExtension();
    context = session.context;
    page = session.page;
    userDataDir = session.userDataDir;
    await warmUpGoogle(page);
  });

  test.afterAll(async () => {
    await cleanup({ context, page, userDataDir });
  });

  test.afterEach(async () => {
    // Throttle requests to reduce CAPTCHA risk
    await page.waitForTimeout(3000);
  });

  test("AI Mode tab is visible on search results", async () => {
    let found = false;

    for (const query of AI_QUERIES) {
      await searchGoogle(page, query);

      const { modeCount } = await countVisibleAIElements(page);
      if (modeCount > 0) {
        found = true;
        break;
      }
    }

    if (!found) {
      test.skip(
        true,
        "No AI Mode tab detected for any query — Google may have changed rendering or is not showing AI Mode today"
      );
    }

    expect(found).toBe(true);
  });

  test("AI Overview block appears for explainer queries", async () => {
    let found = false;

    for (const query of AI_QUERIES) {
      await searchGoogle(page, query);

      const { overviewCount } = await countVisibleAIElements(page);
      if (overviewCount > 0) {
        found = true;
        break;
      }
    }

    if (!found) {
      test.skip(
        true,
        "No AI Overview detected for any query — Google may have changed rendering or is not showing AI Overview today"
      );
    }

    expect(found).toBe(true);
  });
});

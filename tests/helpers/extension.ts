import { chromium, BrowserContext, Page } from "@playwright/test";
import path from "path";
import fs from "fs";
import os from "os";

const EXTENSION_PATH = path.resolve(__dirname, "../../parent-hide-ai");

interface BrowserSession {
  context: BrowserContext;
  page: Page;
  userDataDir: string;
}

const COMMON_ARGS = [
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-search-engine-choice-screen",
  "--lang=en-US",
  "--disable-features=MediaRouter",
];

export async function launchWithExtension(): Promise<BrowserSession> {
  const userDataDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "gab-ext-test-")
  );

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      ...COMMON_ARGS,
    ],
  });

  // Wait for the service worker (background.js) to register
  let attempts = 0;
  while (attempts < 20) {
    const workers = context.serviceWorkers();
    if (workers.length > 0) break;
    await new Promise((r) => setTimeout(r, 250));
    attempts++;
  }

  const page = context.pages()[0] || (await context.newPage());

  return { context, page, userDataDir };
}

export async function launchWithoutExtension(): Promise<BrowserSession> {
  const userDataDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "gab-noext-test-")
  );

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: COMMON_ARGS,
  });

  const page = context.pages()[0] || (await context.newPage());

  return { context, page, userDataDir };
}

export async function cleanup(session: BrowserSession): Promise<void> {
  await session.context.close();
  fs.rmSync(session.userDataDir, { recursive: true, force: true });
}

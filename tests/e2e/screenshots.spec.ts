/**
 * Screenshot capture tests — saves widget screenshots to
 * /tmp/gengage-pw-screenshots/test-run/ for visual review.
 */

import { test, expect } from '@playwright/test';
import { gotoDemoReady, setupMockRoutes } from './fixtures.js';

const SCREENSHOT_DIR = '/tmp/gengage-pw-screenshots/test-run';

test.describe('Screenshot capture', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await gotoDemoReady(page);
  });

  test('capture QNA widget screenshot', async ({ page }) => {
    const container = page.locator('.gengage-qna-container');
    await expect(container).toBeVisible({ timeout: 10000 });

    await container.screenshot({ path: `${SCREENSHOT_DIR}/qna.png` });
  });

  test('capture SimRel widget screenshot', async ({ page }) => {
    const container = page.locator('.gengage-simrel-container');
    await expect(container).toBeVisible({ timeout: 10000 });

    await container.screenshot({ path: `${SCREENSHOT_DIR}/simrel.png` });
  });

  test('capture chat launcher screenshot', async ({ page }) => {
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });

    await launcher.screenshot({ path: `${SCREENSHOT_DIR}/chat-launcher.png` });
  });

  test('capture chat drawer screenshot', async ({ page }) => {
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.click();

    const drawer = page.locator('.gengage-chat-drawer');
    await expect(drawer).not.toHaveClass(/gengage-chat-drawer--hidden/, { timeout: 5000 });

    await drawer.screenshot({ path: `${SCREENSHOT_DIR}/chat-drawer.png` });
  });

  test('capture full page screenshot', async ({ page }) => {
    // Wait for all widgets to initialize
    await page.locator('.gengage-simrel-container').waitFor({ state: 'attached', timeout: 10000 });
    await page.locator('.gengage-qna-container').waitFor({ state: 'attached', timeout: 10000 });

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/full-page.png`,
      fullPage: true,
    });
  });
});

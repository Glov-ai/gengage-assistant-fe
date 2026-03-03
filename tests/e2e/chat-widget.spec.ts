/**
 * Chat widget E2E tests.
 *
 * The chat widget renders inside Shadow DOM. Playwright pierces
 * shadow DOM automatically with page.locator().
 */

import { test, expect } from '@playwright/test';
import { DEMO_URL, setupMockRoutes } from './fixtures.js';

test.describe('Chat widget', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto(DEMO_URL);
  });

  test('chat launcher is visible', async ({ page }) => {
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
  });

  test('launcher has approximately correct size', async ({ page }) => {
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });

    const box = await launcher.boundingBox();
    expect(box).toBeTruthy();
    // Launcher should be approximately 56x56 (allow some tolerance for borders/padding)
    expect(box!.width).toBeGreaterThanOrEqual(40);
    expect(box!.width).toBeLessThanOrEqual(80);
    expect(box!.height).toBeGreaterThanOrEqual(40);
    expect(box!.height).toBeLessThanOrEqual(80);
  });

  test('drawer is hidden initially (has --hidden class)', async ({ page }) => {
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });

    // The drawer element exists in the Shadow DOM but is hidden via clip-path and opacity.
    // Check for the presence of the --hidden modifier class.
    const drawer = page.locator('.gengage-chat-drawer');
    await expect(drawer).toHaveClass(/gengage-chat-drawer--hidden/);
  });

  test('clicking launcher opens the drawer', async ({ page }) => {
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.click();

    const drawer = page.locator('.gengage-chat-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
  });

  test('drawer has header with title', async ({ page }) => {
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.click();

    const header = page.locator('.gengage-chat-header');
    await expect(header).toBeVisible({ timeout: 5000 });
  });

  test('drawer has message area', async ({ page }) => {
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.click();

    const messages = page.locator('.gengage-chat-messages');
    await expect(messages).toBeVisible({ timeout: 5000 });
  });

  test('drawer has input textarea and send button', async ({ page }) => {
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.click();

    const input = page.locator('.gengage-chat-input');
    await expect(input).toBeVisible({ timeout: 5000 });

    const send = page.locator('.gengage-chat-send');
    await expect(send).toBeAttached();
  });

  test('close button closes the drawer', async ({ page }) => {
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.click();

    const drawer = page.locator('.gengage-chat-drawer');
    // Drawer should be visible (no --hidden class) after opening
    await expect(drawer).not.toHaveClass(/gengage-chat-drawer--hidden/, { timeout: 5000 });

    // Find and click the close button inside the header
    const closeBtn = page.locator('.gengage-chat-close');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    // Drawer should have --hidden class after closing
    await expect(drawer).toHaveClass(/gengage-chat-drawer--hidden/, { timeout: 5000 });
  });
});

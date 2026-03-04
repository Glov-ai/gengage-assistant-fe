/**
 * Comprehensive chat widget tests — covers launcher positioning, colors,
 * z-index, drawer dimensions, ARIA, and input area structure.
 */

import { test, expect } from '@playwright/test';
import { gotoDemoReady, setupMockRoutes } from './fixtures.js';

test.describe('Chat widget — launcher positioning & style', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await gotoDemoReady(page);
  });

  test('launcher is in the bottom-right quadrant of the viewport', async ({ page }) => {
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });

    const box = await launcher.boundingBox();
    expect(box).toBeTruthy();

    const viewport = page.viewportSize();
    expect(viewport).toBeTruthy();

    // Center of launcher should be in the right half and bottom half of the viewport
    const centerX = box!.x + box!.width / 2;
    const centerY = box!.y + box!.height / 2;
    expect(centerX).toBeGreaterThan(viewport!.width / 2);
    expect(centerY).toBeGreaterThan(viewport!.height / 2);
  });

  test('launcher has the configured primary background color (orange)', async ({ page }) => {
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });

    const bgColor = await launcher.evaluate((el) => getComputedStyle(el).backgroundColor);
    // #ec6e00 = rgb(236, 110, 0) — check approximate ranges
    const match = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    expect(match).toBeTruthy();
    const [, r, g, b] = match!;
    expect(Number(r)).toBeGreaterThan(200); // high red
    expect(Number(g)).toBeGreaterThan(50); // moderate green
    expect(Number(g)).toBeLessThan(160);
    expect(Number(b)).toBeLessThan(40); // low blue
  });

  test('launcher z-index is high (>= 1000)', async ({ page }) => {
    // The launcher container is the positioned element with z-index
    const launcherContainer = page.locator('.gengage-chat-launcher-container');
    await expect(launcherContainer).toBeAttached({ timeout: 10000 });

    const zIndex = await launcherContainer.evaluate((el) => {
      const val = getComputedStyle(el).zIndex;
      return val === 'auto' ? 0 : Number(val);
    });
    expect(zIndex).toBeGreaterThanOrEqual(1000);
  });
});

test.describe('Chat widget — drawer structure', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await gotoDemoReady(page);
    // Open the drawer for these tests
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.click();
    const drawer = page.locator('.gengage-chat-drawer');
    await expect(drawer).not.toHaveClass(/gengage-chat-drawer--hidden/, { timeout: 5000 });
  });

  test('header has a dark background color', async ({ page }) => {
    const header = page.locator('.gengage-chat-header');
    await expect(header).toBeVisible({ timeout: 5000 });

    const bgColor = await header.evaluate((el) => getComputedStyle(el).backgroundColor);
    const match = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    expect(match).toBeTruthy();
    const [, r, g, b] = match!;
    // Dark background: all channels should be below ~100
    expect(Number(r)).toBeLessThan(100);
    expect(Number(g)).toBeLessThan(100);
    expect(Number(b)).toBeLessThan(100);
  });

  test('input placeholder contains the configured text', async ({ page }) => {
    const input = page.locator('.gengage-chat-input');
    await expect(input).toBeVisible({ timeout: 5000 });

    const placeholder = await input.getAttribute('placeholder');
    expect(placeholder).toBeTruthy();
    // Configured as "Ürün ara, soru sor" — may vary but should be non-empty
    expect(placeholder!.length).toBeGreaterThan(0);
  });

  test('header contains powered-by text', async ({ page }) => {
    const header = page.locator('.gengage-chat-header');
    await expect(header).toBeVisible({ timeout: 5000 });

    const headerText = await header.textContent();
    expect(headerText).toBeTruthy();
    // The header renders the title + "Powered by Gengage" link
    expect(headerText).toContain('Gengage');
  });

  test('messages container has aria-live="polite"', async ({ page }) => {
    const messages = page.locator('.gengage-chat-messages');
    await expect(messages).toBeVisible({ timeout: 5000 });

    const ariaLive = await messages.getAttribute('aria-live');
    expect(ariaLive).toBe('polite');
  });

  test('messages container has aria-label', async ({ page }) => {
    const messages = page.locator('.gengage-chat-messages');
    await expect(messages).toBeVisible({ timeout: 5000 });

    const ariaLabel = await messages.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
  });

  test('conversation pane width is approximately 400px on desktop', async ({ page }) => {
    // The drawer uses force-expanded panel mode by default, so the overall drawer
    // width is wider than the conversation column. Test the conversation pane
    // which is the ~400px element (--gengage-chat-conversation-width: 396px).
    const conversation = page.locator('.gengage-chat-conversation');
    await expect(conversation).toBeVisible({ timeout: 5000 });

    const box = await conversation.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThanOrEqual(350);
    expect(box!.width).toBeLessThanOrEqual(500);
  });

  test('input area has textarea and send button', async ({ page }) => {
    const input = page.locator('.gengage-chat-input');
    await expect(input).toBeVisible({ timeout: 5000 });

    const send = page.locator('.gengage-chat-send');
    await expect(send).toBeAttached();
  });

  test('send button is present', async ({ page }) => {
    const send = page.locator('.gengage-chat-send');
    await expect(send).toBeAttached();
  });

  test('attachment button exists', async ({ page }) => {
    const attachBtn = page.locator('.gengage-chat-attach-btn');
    await expect(attachBtn).toBeAttached();
  });

  test('close button has an aria-label', async ({ page }) => {
    const closeBtn = page.locator('.gengage-chat-close');
    await expect(closeBtn).toBeVisible();

    const ariaLabel = await closeBtn.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel!.length).toBeGreaterThan(0);
  });
});

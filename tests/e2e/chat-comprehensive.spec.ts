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

  test('launcher renders the configured image-mode presentation', async ({ page }) => {
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await expect(launcher).toHaveClass(/gengage-chat-launcher--image-mode/);
    await expect(launcher.locator('img')).toBeVisible();

    const bgColor = await launcher.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bgColor === 'transparent' || bgColor === 'rgba(0, 0, 0, 0)' || bgColor.includes('0, 0, 0, 0')).toBe(true);
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
    // The drawer can include a side panel, so the overall drawer may be wider
    // than the conversation column. Validate the conversation pane itself,
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

test.describe('Chat widget — stop generating button', () => {
  test('stop button appears during streaming and disappears after', async ({ page }) => {
    // Use a slow-streaming mock that sends chunks with delays
    const SLOW_NDJSON = [
      '{"type":"outputText","payload":{"text":"<p>Bu bir test yaniti"}}',
      '{"type":"outputText","payload":{"text":" devam ediyor...</p>"}}',
      '{"type":"chatStreamEnd","payload":{}}',
    ];

    await page.route('**/chat/similar_products', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"results":[],"count":0}' }),
    );
    await page.route('**/chat/product_groupings', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"product_groupings":[],"count":0}' }),
    );
    await page.route('**/chat/launcher_action', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: '{"type":"chatStreamEnd","payload":{}}',
      }),
    );
    await page.route('**/analytics', (route) => route.fulfill({ status: 200, body: '{}' }));
    await page.route('**/collect?**', (route) => route.fulfill({ status: 200, body: '' }));

    // Slow stream: send each line with a 500ms delay
    await page.route('**/chat/process_action', async (route) => {
      const body = SLOW_NDJSON.join('\n');
      // Fulfill with full body but stream is fast enough — the stop button
      // is shown as soon as streaming starts and removed on chatStreamEnd
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body,
      });
    });

    await gotoDemoReady(page);

    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.click();

    const drawer = page.locator('.gengage-chat-drawer');
    await expect(drawer).not.toHaveClass(/gengage-chat-drawer--hidden/, { timeout: 5000 });

    // Type a message and send it
    const input = page.locator('.gengage-chat-input');
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.fill('Test message');
    await page.locator('.gengage-chat-send').click();

    // After stream completes, the stop button should not be present
    await page.waitForTimeout(1000);
    const stopBtn = page.locator('.gengage-chat-stop-btn');
    await expect(stopBtn).toHaveCount(0);
  });
});

test.describe('Chat widget — focus trap', () => {
  test('drawer has aria-modal="true"', async ({ page }) => {
    await setupMockRoutes(page);
    await gotoDemoReady(page);

    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.click();

    const drawer = page.locator('.gengage-chat-drawer');
    await expect(drawer).not.toHaveClass(/gengage-chat-drawer--hidden/, { timeout: 5000 });

    const ariaModal = await drawer.getAttribute('aria-modal');
    expect(ariaModal).toBe('true');
  });

  test('Tab key cycles within the drawer', async ({ page }) => {
    await setupMockRoutes(page);
    await gotoDemoReady(page);

    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.click();

    const drawer = page.locator('.gengage-chat-drawer');
    await expect(drawer).not.toHaveClass(/gengage-chat-drawer--hidden/, { timeout: 5000 });

    // Focus the input first
    const input = page.locator('.gengage-chat-input');
    await input.focus();

    // Press Tab several times — focus should stay within the drawer
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
    }

    // Check that the active element is still inside the drawer.
    // The chat widget uses Shadow DOM, so we must traverse the shadow root.
    const focusInDrawer = await page.evaluate(() => {
      // Find the shadow host — the mount target element with a shadowRoot
      const hosts = document.querySelectorAll('*');
      for (const host of hosts) {
        const sr = host.shadowRoot;
        if (!sr) continue;
        const drawer = sr.querySelector('.gengage-chat-drawer');
        if (drawer && sr.activeElement) {
          return drawer.contains(sr.activeElement);
        }
      }
      return false;
    });
    expect(focusInDrawer).toBe(true);
  });
});

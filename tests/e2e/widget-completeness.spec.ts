/**
 * Widget completeness tests (G-K) — verifies SimRel tab panel visibility,
 * product card image sizing, add-to-cart button presence, share button in
 * product details panel, and sort toolbar in chat.
 */

import { test, expect } from '@playwright/test';
import {
  gotoDemoReady,
  setupMockRoutes,
  MOCK_CHAT_PRODUCT_LIST_NDJSON,
  MOCK_CHAT_PRODUCT_DETAILS_NDJSON,
} from './fixtures.js';

// ────────────────────────────────────────────────────────────────────────
// G) SimRel tab panel visibility
// ────────────────────────────────────────────────────────────────────────

test.describe('Widget completeness — SimRel tab panel visibility', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await gotoDemoReady(page);
  });

  test('only the active tab panel is visible, others are hidden', async ({ page }) => {
    const tabs = page.locator('.gengage-simrel-tab');
    await expect(tabs.first()).toBeVisible({ timeout: 10000 });

    const panels = page.locator('.gengage-simrel-tab-panel');
    const panelCount = await panels.count();
    expect(panelCount).toBe(2);

    // First panel should be visible (display not "none")
    const firstDisplay = await panels.nth(0).evaluate((el) => getComputedStyle(el).display);
    expect(firstDisplay).not.toBe('none');

    // Second panel should be hidden
    const secondDisplay = await panels.nth(1).evaluate((el) => getComputedStyle(el).display);
    expect(secondDisplay).toBe('none');
  });

  test('switching tabs hides the previous panel and shows the new one', async ({ page }) => {
    const tabs = page.locator('.gengage-simrel-tab');
    await expect(tabs.first()).toBeVisible({ timeout: 10000 });

    const panels = page.locator('.gengage-simrel-tab-panel');

    // Click second tab
    await tabs.nth(1).click();

    // Now first panel should be hidden
    const firstDisplay = await panels.nth(0).evaluate((el) => getComputedStyle(el).display);
    expect(firstDisplay).toBe('none');

    // Second panel should be visible
    const secondDisplay = await panels.nth(1).evaluate((el) => getComputedStyle(el).display);
    expect(secondDisplay).not.toBe('none');
  });
});

// ────────────────────────────────────────────────────────────────────────
// H) Product card image aspect ratio
// ────────────────────────────────────────────────────────────────────────

test.describe('Widget completeness — product card image sizing', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await gotoDemoReady(page);
  });

  test('product card image has visible dimensions', async ({ page }) => {
    const img = page
      .locator('.gengage-simrel-tab-panel:not([style*="display: none"]) .gengage-simrel-card-image img')
      .first();
    await expect(img).toBeVisible({ timeout: 10000 });

    const metrics = await img.evaluate((el) => {
      const styles = getComputedStyle(el);
      return {
        width: parseFloat(styles.width),
        height: parseFloat(styles.height),
      };
    });
    expect(metrics.width).toBeGreaterThan(0);
    expect(metrics.height).toBeGreaterThan(0);
  });

  test('product card image is not stretched (fits within container)', async ({ page }) => {
    const img = page
      .locator('.gengage-simrel-tab-panel:not([style*="display: none"]) .gengage-simrel-card-image img')
      .first();
    await expect(img).toBeAttached({ timeout: 10000 });

    const metrics = await img.evaluate((el) => {
      const styles = getComputedStyle(el);
      return {
        objectFit: styles.objectFit,
        height: parseFloat(styles.height),
      };
    });
    expect(['contain', 'cover', 'scale-down']).toContain(metrics.objectFit);
    expect(metrics.height).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────────────
// I) SimRel add-to-cart button
// ────────────────────────────────────────────────────────────────────────

test.describe('Widget completeness — SimRel add-to-cart button', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await gotoDemoReady(page);
  });

  test('in-stock product with cart_code shows add-to-cart button', async ({ page }) => {
    const atcBtn = page.locator('.gengage-simrel-atc-button').first();
    await expect(atcBtn).toBeVisible({ timeout: 10000 });
    await expect(atcBtn).toBeEnabled();
  });

  test('add-to-cart button is a clickable button element', async ({ page }) => {
    const atcBtn = page.locator('.gengage-simrel-atc-button').first();
    await expect(atcBtn).toBeVisible({ timeout: 10000 });

    const tagName = await atcBtn.evaluate((el) => el.tagName.toLowerCase());
    expect(tagName).toBe('button');
  });

  test('out-of-stock product shows out-of-stock label instead of button', async ({ page }) => {
    const tabs = page.locator('.gengage-simrel-tab');
    await expect(tabs.first()).toBeVisible({ timeout: 10000 });

    // Switch to Ekonomik tab which has out-of-stock products
    await tabs.nth(1).click();

    const visiblePanel = page.locator('.gengage-simrel-tab-panel:not([style*="display: none"])');
    const cards = visiblePanel.locator('.gengage-simrel-card');
    await expect(cards.first()).toBeVisible({ timeout: 5000 });

    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const name = await card.locator('.gengage-simrel-card-name').textContent();
      if (name?.includes('Makita')) {
        // TEST-004 has no cart_code — should show OOS label, not ATC button
        const atcCount = await card.locator('.gengage-simrel-atc-button').count();
        expect(atcCount).toBe(0);
        const oosLabel = card.locator('.gengage-simrel-card-oos');
        await expect(oosLabel).toBeAttached();
      }
    }
  });
});

// ────────────────────────────────────────────────────────────────────────
// J) Share button in product details panel (inside chat drawer)
// ────────────────────────────────────────────────────────────────────────

test.describe('Widget completeness — product details share button', () => {
  test('product detail panel has a share button', async ({ page }) => {
    // Use mock that sends productDetails NDJSON
    await setupMockRoutes(page, { processActionBody: MOCK_CHAT_PRODUCT_DETAILS_NDJSON });
    await gotoDemoReady(page);

    // Open the chat drawer
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.click();
    const drawer = page.locator('.gengage-chat-drawer');
    await expect(drawer).not.toHaveClass(/gengage-chat-drawer--hidden/, { timeout: 5000 });

    // Send a message to trigger the process_action endpoint
    const input = page.locator('.gengage-chat-input');
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.fill('test');
    await page.locator('.gengage-chat-send').click();

    // Wait for the product details panel to appear
    const shareBtn = page.locator('.gengage-chat-product-details-share');
    await expect(shareBtn).toBeAttached({ timeout: 10000 });

    // Verify it has an aria-label
    const ariaLabel = await shareBtn.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────────────────
// K) Sort toolbar in chat (Önerilen, Fiyat ↑, Fiyat ↓)
// ────────────────────────────────────────────────────────────────────────

test.describe('Widget completeness — chat sort toolbar', () => {
  test('chat product list shows sort options', async ({ page }) => {
    // Use mock that sends productList NDJSON
    await setupMockRoutes(page, { processActionBody: MOCK_CHAT_PRODUCT_LIST_NDJSON });
    await gotoDemoReady(page);

    // Open the chat drawer
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.click();
    const drawer = page.locator('.gengage-chat-drawer');
    await expect(drawer).not.toHaveClass(/gengage-chat-drawer--hidden/, { timeout: 5000 });

    // Send a message to trigger the process_action endpoint
    const input = page.locator('.gengage-chat-input');
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.fill('test');
    await page.locator('.gengage-chat-send').click();

    // Wait for the sort toolbar to appear
    const toolbar = page.locator('.gengage-chat-product-sort-toolbar');
    await expect(toolbar).toBeAttached({ timeout: 10000 });

    // Verify the 3 sort menu options exist (in dropdown, may be hidden until opened)
    const sortOptions = toolbar.locator('.gengage-chat-product-sort-option');
    await expect(sortOptions).toHaveCount(3);

    // Verify option labels
    const texts = await sortOptions.allTextContents();
    expect(texts.some((t) => t.includes('nerilen'))).toBe(true); // "Önerilen"
    expect(texts.some((t) => t.includes('Fiyat'))).toBe(true); // "Fiyat ↑" or "Fiyat ↓"
  });
});

/**
 * Widget completeness tests (G-K) — verifies SimRel tab panel visibility,
 * product card image sizing, quantity stepper bounds, share button in
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
// I) Quantity stepper value bounds
// ────────────────────────────────────────────────────────────────────────

test.describe('Widget completeness — quantity stepper bounds', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await gotoDemoReady(page);
  });

  test('stepper starts at 1 and decrease button is disabled', async ({ page }) => {
    const stepper = page.locator('.gengage-qty-stepper').first();
    await expect(stepper).toBeVisible({ timeout: 10000 });

    const value = stepper.locator('.gengage-qty-value');
    await expect(value).toHaveText('1');

    // Decrease button (first button) should be disabled at 1
    const decBtn = stepper.locator('button').first();
    await expect(decBtn).toBeDisabled();
  });

  test('clicking decrease at value 1 does not go below 1', async ({ page }) => {
    const stepper = page.locator('.gengage-qty-stepper').first();
    await expect(stepper).toBeVisible({ timeout: 10000 });

    const value = stepper.locator('.gengage-qty-value');
    await expect(value).toHaveText('1');

    // Try clicking decrease — should stay at 1
    const decBtn = stepper.locator('button').first();
    // Force-click even though it is disabled, to verify value does not change
    await decBtn.click({ force: true });
    await expect(value).toHaveText('1');
  });

  test('increase then decrease returns to 1, decrease disabled again', async ({ page }) => {
    const stepper = page.locator('.gengage-qty-stepper').first();
    await expect(stepper).toBeVisible({ timeout: 10000 });

    const value = stepper.locator('.gengage-qty-value');
    const incBtn = stepper.locator('button').nth(1);
    const decBtn = stepper.locator('button').first();

    // Increase to 2
    await incBtn.click();
    await expect(value).toHaveText('2');
    await expect(decBtn).toBeEnabled();

    // Decrease back to 1
    await decBtn.click();
    await expect(value).toHaveText('1');
    await expect(decBtn).toBeDisabled();
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

    // Verify the 3 sort buttons exist
    const sortBtns = toolbar.locator('.gengage-chat-product-sort-btn');
    await expect(sortBtns).toHaveCount(3);

    // Verify button labels
    const texts = await sortBtns.allTextContents();
    expect(texts.some((t) => t.includes('nerilen'))).toBe(true); // "Önerilen"
    expect(texts.some((t) => t.includes('Fiyat'))).toBe(true); // "Fiyat ↑" or "Fiyat ↓"
  });
});

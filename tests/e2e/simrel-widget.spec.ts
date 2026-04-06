/**
 * SimRel widget E2E tests.
 *
 * SimRel mounts directly into the light DOM inside #koctas-similar-products.
 * It fetches similar_products first, then product_groupings.
 * When groupings succeed, it renders a tabbed interface.
 */

import { test, expect } from '@playwright/test';
import { gotoDemoReady, setupMockRoutes, MOCK_SIMILAR_PRODUCTS, MOCK_PRODUCT_GROUPINGS } from './fixtures.js';

test.describe('SimRel widget', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await gotoDemoReady(page);
  });

  test('SimRel container renders inside mount target', async ({ page }) => {
    const container = page.locator('#koctas-similar-products .gengage-simrel-container');
    await expect(container).toBeAttached({ timeout: 10000 });
  });

  test('group tabs render when product_groupings succeeds', async ({ page }) => {
    const tabs = page.locator('.gengage-simrel-tab');
    await expect(tabs.first()).toBeVisible({ timeout: 10000 });

    const count = await tabs.count();
    expect(count).toBe(2);
  });

  test('group tab labels match mock data', async ({ page }) => {
    const tabs = page.locator('.gengage-simrel-tab');
    await expect(tabs.first()).toBeVisible({ timeout: 10000 });

    const tabTexts = await tabs.allTextContents();
    expect(tabTexts).toContain('Profesyonel');
    expect(tabTexts).toContain('Ekonomik');
  });

  test('first tab is active by default', async ({ page }) => {
    const activeTab = page.locator('.gengage-simrel-tab--active');
    await expect(activeTab).toBeVisible({ timeout: 10000 });
    await expect(activeTab).toHaveText('Profesyonel');
  });

  test('product cards render in the active tab', async ({ page }) => {
    const cards = page.locator('.gengage-simrel-card');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    // First tab (Profesyonel) has 2 products
    const count = await cards.count();
    expect(count).toBe(2);
  });

  test('each card shows product name', async ({ page }) => {
    const names = page.locator('.gengage-simrel-card-name');
    await expect(names.first()).toBeVisible({ timeout: 10000 });

    // First tab (Profesyonel) has Stanley and DeWalt
    const texts = await names.allTextContents();
    expect(texts.length).toBe(2);
    // Brand is prepended to name by the normalizer
    expect(texts.some((t) => t.includes('Stanley'))).toBe(true);
    expect(texts.some((t) => t.includes('DeWalt'))).toBe(true);
  });

  test('each card has an image', async ({ page }) => {
    const images = page.locator('.gengage-simrel-card-image img');
    // Use auto-retrying assertion — images render async with lazy loading
    await expect(images).toHaveCount(2, { timeout: 10000 });
  });

  test('each card shows current price', async ({ page }) => {
    const prices = page.locator('.gengage-simrel-card-price-current');
    await expect(prices.first()).toBeVisible({ timeout: 10000 });

    const count = await prices.count();
    expect(count).toBe(2);
  });

  test('discounted product shows original (strikethrough) price', async ({ page }) => {
    const originalPrices = page.locator('.gengage-simrel-card-price-original');
    await expect(originalPrices.first()).toBeVisible({ timeout: 10000 });

    // Both products in the Profesyonel tab have discounts (TEST-001 and TEST-003)
    const count = await originalPrices.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('in-stock product with cart_code shows add-to-cart button', async ({ page }) => {
    // Both Profesyonel tab products (TEST-001 and TEST-003) have cart_code and in_stock=true
    const atcBtns = page.locator('.gengage-simrel-card .gengage-simrel-atc-button');
    await expect(atcBtns.first()).toBeVisible({ timeout: 10000 });
  });

  test('add-to-cart button is an enabled button with text', async ({ page }) => {
    const atcBtn = page.locator('.gengage-simrel-atc-button').first();
    await expect(atcBtn).toBeVisible({ timeout: 10000 });
    await expect(atcBtn).toBeEnabled();

    const text = await atcBtn.textContent();
    expect(text).toBeTruthy();
    expect(text!.length).toBeGreaterThan(0);
  });

  test('card has rating when product has rating', async ({ page }) => {
    const ratings = page.locator('.gengage-simrel-card-rating');
    await expect(ratings.first()).toBeVisible({ timeout: 10000 });
  });

  test('clicking second tab switches displayed products', async ({ page }) => {
    const tabs = page.locator('.gengage-simrel-tab');
    await expect(tabs.first()).toBeVisible({ timeout: 10000 });

    // Click the "Ekonomik" tab
    await tabs.nth(1).click();

    // Active tab should change
    const activeTab = page.locator('.gengage-simrel-tab--active');
    await expect(activeTab).toHaveText('Ekonomik');

    // Scope to the VISIBLE tab panel to avoid picking up hidden panel elements
    const visiblePanel = page.locator('.gengage-simrel-tab-panel:not([style*="display: none"])');
    const names = visiblePanel.locator('.gengage-simrel-card-name');
    await expect(names.first()).toBeVisible({ timeout: 5000 });

    const texts = await names.allTextContents();
    expect(texts.some((t) => t.includes('Bosch'))).toBe(true);
    expect(texts.some((t) => t.includes('Makita'))).toBe(true);
  });

  test('out-of-stock product without cart_code does not show ATC button', async ({ page }) => {
    const tabs = page.locator('.gengage-simrel-tab');
    await expect(tabs.first()).toBeVisible({ timeout: 10000 });

    // Switch to Ekonomik tab which has TEST-004 (no cart_code, out of stock)
    await tabs.nth(1).click();

    // Scope to the VISIBLE tab panel
    const visiblePanel = page.locator('.gengage-simrel-tab-panel:not([style*="display: none"])');
    const names = visiblePanel.locator('.gengage-simrel-card-name');
    await expect(names.first()).toBeVisible({ timeout: 5000 });

    // Find the card for TEST-004 (Makita) — should NOT have ATC button, should show OOS label
    const cards = visiblePanel.locator('.gengage-simrel-card');
    const count = await cards.count();

    let makitaHasAtc = false;
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const name = await card.locator('.gengage-simrel-card-name').textContent();
      if (name?.includes('Makita')) {
        const atcCount = await card.locator('.gengage-simrel-atc-button').count();
        makitaHasAtc = atcCount > 0;
      }
    }
    expect(makitaHasAtc).toBe(false);
  });
});

test.describe('SimRel widget - flat grid fallback', () => {
  test('renders flat product grid when product_groupings fails', async ({ page }) => {
    // Mock routes but make product_groupings return 500
    await page.route('**/chat/similar_products', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SIMILAR_PRODUCTS),
      });
    });
    await page.route('**/chat/product_groupings', (route) => {
      return route.fulfill({ status: 500, body: 'Internal Server Error' });
    });
    await page.route('**/chat/launcher_action', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: '{"type":"chatStreamEnd","payload":{}}\n',
      });
    });
    await page.route('**/chat/process_action', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: '{"type":"chatStreamEnd","payload":{}}\n',
      });
    });
    // Use URL function matcher to avoid intercepting Vite module scripts
    await page.route(
      (url) => {
        const path = url.pathname;
        return path === '/analytics' || path.endsWith('/analytics');
      },
      (route) => {
        return route.fulfill({ status: 200, body: '{}' });
      },
    );
    await page.route('**/collect?**', (route) => {
      return route.fulfill({ status: 200, body: '' });
    });

    await gotoDemoReady(page);

    // Should render flat grid with all 4 products (no tabs)
    const cards = page.locator('.gengage-simrel-card');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    const count = await cards.count();
    expect(count).toBe(4);

    // No tabs should be present
    const tabs = page.locator('.gengage-simrel-tab');
    const tabCount = await tabs.count();
    expect(tabCount).toBe(0);
  });
});

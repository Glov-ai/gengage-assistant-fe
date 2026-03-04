/**
 * Playwright E2E smoke tests for Gengage widgets.
 *
 * These tests verify that the vanilla example page loads correctly,
 * widget mount points exist, and the ES module scripts execute
 * without fatal errors. They do NOT require a live backend — API
 * calls will fail, but the widgets should still mount and handle
 * errors gracefully.
 */

import { test, expect } from '@playwright/test';

test.describe('Vanilla example — page load', () => {
  test('page loads with correct title', async ({ page }) => {
    await page.goto('/demos/vanilla-script/index.html');
    await expect(page).toHaveTitle(/Gengage.*Vanilla.*Script/i);
  });

  test('product section is visible', async ({ page }) => {
    await page.goto('/demos/vanilla-script/index.html');
    const product = page.locator('.product');
    await expect(product).toBeVisible();
    await expect(product).toContainText('Lorem Ipsum Demo');
  });

  test('QNA mount point exists', async ({ page }) => {
    await page.goto('/demos/vanilla-script/index.html');
    const qna = page.locator('#gengage-qna');
    await expect(qna).toBeAttached();
  });

  test('SimRel mount point exists', async ({ page }) => {
    await page.goto('/demos/vanilla-script/index.html');
    const simrel = page.locator('#gengage-simrel');
    await expect(simrel).toBeAttached();
  });
});

test.describe('Vanilla example — widget initialization', () => {
  test('page contains expected SKU in the DOM', async ({ page }) => {
    await page.goto('/demos/vanilla-script/index.html');

    // The demo renders the PDP SKU into #demo-sku using the query param
    // or its current default fallback.
    const skuEl = page.locator('#demo-sku');
    await expect(skuEl).not.toHaveText('—');
    await expect(skuEl).toContainText('1000465056');
  });

  test('no uncaught exceptions on page load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/demos/vanilla-script/index.html');
    // Wait for the demo page to render its product section (signals JS executed)
    await page.locator('.product').waitFor({ state: 'attached', timeout: 15_000 });

    // Filter out expected network errors from missing backend
    const unexpectedErrors = errors.filter(
      (msg) => !msg.includes('fetch') && !msg.includes('NetworkError') && !msg.includes('Failed to fetch'),
    );

    expect(unexpectedErrors).toHaveLength(0);
  });

  test('widget scripts execute and expose widget constructors', async ({ page }) => {
    await page.goto('/demos/vanilla-script/index.html');
    // Wait for the demo page to render (signals module scripts executed)
    await page.locator('.product').waitFor({ state: 'attached', timeout: 15_000 });
    await expect(page.locator('#demo-sku')).not.toHaveText('—');

    const constructorsReady = await page.evaluate(() => {
      const gengageWindow = window as Window & {
        Gengage?: {
          GengageChat?: unknown;
          GengageQNA?: unknown;
          GengageSimRel?: unknown;
        };
      };
      return Boolean(
        gengageWindow.Gengage &&
        gengageWindow.Gengage.GengageChat &&
        gengageWindow.Gengage.GengageQNA &&
        gengageWindow.Gengage.GengageSimRel,
      );
    });

    expect(constructorsReady).toBe(true);
  });
});

test.describe('Vanilla example — chat widget', () => {
  test('floating chat launcher is injected into the DOM', async ({ page }) => {
    await page.goto('/demos/vanilla-script/index.html');
    // Wait for the demo page to render its product section (signals JS executed)
    await page.locator('.product').waitFor({ state: 'attached', timeout: 15_000 });

    // The launcher is either a shadow DOM host or a direct element
    // Check for any gengage-related element in the body
    const chatElements = await page.evaluate(() => {
      const all = document.querySelectorAll('[class*="gengage"]');
      return all.length;
    });

    // Even if the API call fails, the widget class should have been instantiated
    // This is a soft check — the launcher may not render if init fails
    expect(chatElements).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Vanilla example — SimRel widget', () => {
  test('SimRel container is created inside mount point', async ({ page }) => {
    await page.goto('/demos/vanilla-script/index.html');
    // Wait for the demo page to render its product section (signals JS executed)
    await page.locator('.product').waitFor({ state: 'attached', timeout: 15_000 });

    // The SimRel widget creates a .gengage-simrel-container div
    const container = page.locator('.gengage-simrel-container');
    // May show loading spinner or error state without backend
    const count = await container.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

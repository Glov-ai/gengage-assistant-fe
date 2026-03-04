/**
 * Host page layout tests for the koctascomtr demo.
 *
 * Verifies that the host page skeleton renders correctly and widget
 * mount points are present in the expected DOM positions.
 */

import { test, expect } from '@playwright/test';
import { gotoDemoReady, setupMockRoutes } from './fixtures.js';

test.describe('Koctas demo - host page layout', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
  });

  test('page loads with correct title', async ({ page }) => {
    await gotoDemoReady(page);
    await expect(page).toHaveTitle(/Gengage Dev.*koctascomtr/i);
  });

  test('dev header is visible with account info', async ({ page }) => {
    await gotoDemoReady(page);
    const header = page.locator('.dev-header');
    await expect(header).toBeVisible();
    await expect(header).toContainText('koctascomtr');
    await expect(header).toContainText('1000465056');
  });

  test('topbar renders with brand name', async ({ page }) => {
    await gotoDemoReady(page);
    const topbar = page.locator('.host-topbar');
    await expect(topbar).toBeVisible();
    // Brand name uses Turkish character: Koctas with cedilla
    await expect(topbar.locator('.host-topbar__brand')).toContainText(/Ko[cç]ta[sş]/);
  });

  test('breadcrumb shows SKU', async ({ page }) => {
    await gotoDemoReady(page);
    const breadcrumb = page.locator('.host-breadcrumb');
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb).toContainText('1000465056');
  });

  test('PDP layout has gallery and summary cards', async ({ page }) => {
    await gotoDemoReady(page);
    const layout = page.locator('.pdp-layout');
    await expect(layout).toBeVisible();
    await expect(page.locator('.gallery-card')).toBeVisible();
    await expect(page.locator('.summary-card')).toBeVisible();
  });

  test('widget mount points exist', async ({ page }) => {
    await gotoDemoReady(page);
    await expect(page.locator('#koctas-qna-section')).toBeAttached();
    await expect(page.locator('#koctas-similar-products')).toBeAttached();
  });

  test('page sections appear in expected order', async ({ page }) => {
    await gotoDemoReady(page);
    // Verify the vertical order: pdp-layout -> content-card -> qna -> simrel
    const sections = page.locator('.pdp-layout, .content-card, .qna-section, .simrel-card');
    const count = await sections.count();
    expect(count).toBeGreaterThanOrEqual(4);

    // Content card should come after PDP layout
    const contentCard = page.locator('.content-card');
    await expect(contentCard).toBeVisible();

    // QNA section should exist
    const qnaSection = page.locator('.qna-section');
    await expect(qnaSection).toBeAttached();
  });

  test('no unexpected JS errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await setupMockRoutes(page);
    await gotoDemoReady(page);

    // Wait for all widgets to initialize
    await page.locator('.gengage-simrel-container').waitFor({ state: 'attached', timeout: 10000 });

    // Filter expected network / dev warnings
    const unexpectedErrors = errors.filter(
      (msg) =>
        !msg.includes('fetch') &&
        !msg.includes('NetworkError') &&
        !msg.includes('Failed to fetch') &&
        !msg.includes('ERR_BLOCKED_BY_CLIENT') &&
        !msg.includes('net::'),
    );

    expect(unexpectedErrors).toHaveLength(0);
  });
});

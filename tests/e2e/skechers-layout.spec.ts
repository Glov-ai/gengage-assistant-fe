/**
 * Host page layout tests for the skecherscomtr demo.
 *
 * Verifies that the host page skeleton renders correctly and widget
 * mount points are present in the expected DOM positions.
 */

import { test, expect } from '@playwright/test';
import { gotoDemoReady, setupMockRoutes } from './fixtures.js';

const SKECHERS_URL = '/demos/skecherscomtr/index.html?sku=232700';

test.describe('Skechers demo - host page layout', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
  });

  test('page loads with correct title', async ({ page }) => {
    await gotoDemoReady(page, SKECHERS_URL);
    await expect(page).toHaveTitle(/Gengage Dev.*skecherscomtr/i);
  });

  test('dev header is visible with account info', async ({ page }) => {
    await gotoDemoReady(page, SKECHERS_URL);
    const header = page.locator('.dev-header');
    await expect(header).toBeVisible();
    await expect(header).toContainText('skecherscomtr');
    await expect(header).toContainText('232700');
  });

  test('topbar renders with brand name', async ({ page }) => {
    await gotoDemoReady(page, SKECHERS_URL);
    const topbar = page.locator('.host-topbar');
    await expect(topbar).toBeVisible();
    await expect(topbar.locator('.host-topbar__brand')).toContainText('Skechers');
  });

  test('breadcrumb shows SKU', async ({ page }) => {
    await gotoDemoReady(page, SKECHERS_URL);
    const breadcrumb = page.locator('.host-breadcrumb');
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb).toContainText('232700');
  });

  test('PDP layout has gallery and summary cards', async ({ page }) => {
    await gotoDemoReady(page, SKECHERS_URL);
    const layout = page.locator('.pdp-layout');
    await expect(layout).toBeVisible();
    await expect(page.locator('.gallery-card')).toBeVisible();
    await expect(page.locator('.summary-card')).toBeVisible();
  });

  test('widget mount points exist', async ({ page }) => {
    await gotoDemoReady(page, SKECHERS_URL);
    await expect(page.locator('#skechers-qna-section')).toBeAttached();
    await expect(page.locator('#skechers-similar-products')).toBeAttached();
  });

  test('page sections appear in expected order', async ({ page }) => {
    await gotoDemoReady(page, SKECHERS_URL);
    const sections = page.locator('.pdp-layout, .content-card, .qna-section, .simrel-card');
    const count = await sections.count();
    expect(count).toBeGreaterThanOrEqual(4);

    const contentCard = page.locator('.content-card');
    await expect(contentCard).toBeVisible();

    const qnaSection = page.locator('.qna-section');
    await expect(qnaSection).toBeAttached();
  });

  test('chat launcher renders with Skechers avatar', async ({ page }) => {
    await gotoDemoReady(page, SKECHERS_URL);
    // The chat launcher should be present after init
    const launcher = page.locator('.gengage-chat-launcher, [class*="chat-launcher"]');
    await expect(launcher.first()).toBeAttached({ timeout: 10_000 });
  });

  test('no unexpected JS errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await setupMockRoutes(page);
    await gotoDemoReady(page, SKECHERS_URL);

    // Wait for SimRel to initialize
    await page.locator('.gengage-simrel-container').waitFor({ state: 'attached', timeout: 10_000 });

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

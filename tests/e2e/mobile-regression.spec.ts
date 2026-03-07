/**
 * Mobile regression tests — verifies touch interactions, drawer behavior,
 * product cards, ATC stepper, and orientation changes on mobile viewports.
 *
 * Runs in the 'mobile' Playwright project (iPhone 13 device emulation).
 */

import { test, expect } from '@playwright/test';
import { gotoDemoReady, setupMockRoutes, MOCK_CHAT_PRODUCT_LIST_NDJSON } from './fixtures.js';

test.describe('Mobile drawer', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await gotoDemoReady(page);
  });

  test('launcher is visible and tappable on mobile', async ({ page }) => {
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });

    const box = await launcher.boundingBox();
    expect(box).toBeTruthy();
    // Tap target should be at least 44px (WCAG touch target)
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('tapping launcher opens full-width drawer on mobile', async ({ page }) => {
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.tap();

    const drawer = page.locator('.gengage-chat-drawer');
    await expect(drawer).not.toHaveClass(/gengage-chat-drawer--hidden/, { timeout: 5000 });

    // Drawer should span full viewport width on mobile
    const drawerBox = await drawer.boundingBox();
    const viewport = page.viewportSize();
    expect(drawerBox).toBeTruthy();
    expect(viewport).toBeTruthy();
    expect(drawerBox!.width).toBeGreaterThanOrEqual(viewport!.width * 0.95);
  });

  test('close button closes the drawer', async ({ page }) => {
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.tap();

    const drawer = page.locator('.gengage-chat-drawer');
    await expect(drawer).not.toHaveClass(/gengage-chat-drawer--hidden/, { timeout: 5000 });

    const closeBtn = page.locator('.gengage-chat-close');
    await expect(closeBtn).toBeVisible();
    await closeBtn.tap();

    await expect(drawer).toHaveClass(/gengage-chat-drawer--hidden/, { timeout: 5000 });
  });

  test('input is focusable after drawer opens', async ({ page }) => {
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.tap();

    const input = page.locator('.gengage-chat-input');
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.tap();
    await expect(input).toBeFocused();
  });
});

test.describe('Mobile product cards', () => {
  test('product cards are tappable and render correctly', async ({ page }) => {
    await setupMockRoutes(page, { processActionBody: MOCK_CHAT_PRODUCT_LIST_NDJSON });
    await gotoDemoReady(page);

    // Open chat and send a message to trigger product list
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.tap();

    const input = page.locator('.gengage-chat-input');
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.fill('show products');
    await page.locator('.gengage-chat-send').tap();

    // Wait for product cards to appear in panel
    const productCard = page.locator('[data-sku]').first();
    await expect(productCard).toBeVisible({ timeout: 10000 });

    // Card should have reasonable tap target
    const box = await productCard.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('Mobile ATC stepper', () => {
  test('quantity stepper buttons are tappable', async ({ page }) => {
    await setupMockRoutes(page, { processActionBody: MOCK_CHAT_PRODUCT_LIST_NDJSON });
    await gotoDemoReady(page);

    // Open chat and send a message to trigger product list
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.tap();

    const input = page.locator('.gengage-chat-input');
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.fill('show products');
    await page.locator('.gengage-chat-send').tap();

    // Wait for panel to have product cards with ATC steppers
    const stepper = page.locator('.gengage-qty-stepper').first();
    // Wait for stepper to appear (mock data should include ATC-eligible products)
    await expect(stepper).toBeVisible({ timeout: 10000 });

    const plusBtn = stepper.locator('.gengage-qty-plus');
    const minusBtn = stepper.locator('.gengage-qty-minus');

    await expect(plusBtn).toBeVisible();
    const plusBox = await plusBtn.boundingBox();
    expect(plusBox).toBeTruthy();
    expect(plusBox!.width).toBeGreaterThanOrEqual(32);
    expect(plusBox!.height).toBeGreaterThanOrEqual(32);

    await expect(minusBtn).toBeVisible();
    const minusBox = await minusBtn.boundingBox();
    expect(minusBox).toBeTruthy();
    expect(minusBox!.width).toBeGreaterThanOrEqual(32);
    expect(minusBox!.height).toBeGreaterThanOrEqual(32);
  });
});

test.describe('Mobile orientation change', () => {
  test('drawer adapts to landscape orientation', async ({ page }) => {
    await setupMockRoutes(page);
    await gotoDemoReady(page);

    // Open chat in portrait
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.tap();

    const drawer = page.locator('.gengage-chat-drawer');
    await expect(drawer).not.toHaveClass(/gengage-chat-drawer--hidden/, { timeout: 5000 });

    // Switch to landscape
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(300); // Wait for resize handlers

    // Drawer should still be visible and functional
    await expect(drawer).toBeVisible();

    // Input should still be accessible
    const input = page.locator('.gengage-chat-input');
    await expect(input).toBeVisible();

    // Switch back to portrait
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await expect(drawer).toBeVisible();
  });
});

test.describe('Mobile SimRel widget', () => {
  test('SimRel cards render and are scrollable on mobile', async ({ page }) => {
    await setupMockRoutes(page);
    await gotoDemoReady(page);

    // SimRel widget should be visible below the product info
    const simrelGrid = page.locator('.gengage-simrel-grid');
    await expect(simrelGrid).toBeAttached({ timeout: 10000 });

    // Should have product cards
    const cards = simrelGrid.locator('.gengage-simrel-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // First card should be visible
    await expect(cards.first()).toBeVisible();
  });
});

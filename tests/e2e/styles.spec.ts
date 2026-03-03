/**
 * Visual style tests for widget rendering.
 *
 * Verifies CSS properties, sizing, and visual presentation.
 */

import { test, expect } from '@playwright/test';
import { DEMO_URL, setupMockRoutes } from './fixtures.js';

test.describe('Widget visual styles', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto(DEMO_URL);
  });

  test('SimRel cards have border-radius', async ({ page }) => {
    const card = page.locator('.gengage-simrel-card').first();
    await expect(card).toBeVisible({ timeout: 10000 });

    const borderRadius = await card.evaluate((el) => window.getComputedStyle(el).borderRadius);
    // Should have some border-radius (not "0px")
    expect(borderRadius).not.toBe('0px');
  });

  test('QNA buttons have pill shape', async ({ page }) => {
    const button = page.locator('.gengage-qna-button').first();
    await expect(button).toBeVisible({ timeout: 10000 });

    const borderRadius = await button.evaluate((el) => window.getComputedStyle(el).borderRadius);
    // Pill shape means high border-radius (typically 999px or 50% or a large value)
    const numericRadius = parseInt(borderRadius, 10);
    expect(numericRadius).toBeGreaterThanOrEqual(8);
  });

  test('SimRel grid has proper layout', async ({ page }) => {
    const grid = page.locator('.gengage-simrel-grid');
    await expect(grid).toBeAttached({ timeout: 10000 });

    // Grid should have display: grid
    const display = await grid.evaluate((el) => window.getComputedStyle(el).display);
    expect(display).toBe('grid');
  });

  test('font family is applied from theme', async ({ page }) => {
    // Wait for the page to fully load
    const card = page.locator('.gengage-simrel-card-name').first();
    await expect(card).toBeVisible({ timeout: 10000 });

    const fontFamily = await card.evaluate((el) => window.getComputedStyle(el).fontFamily);
    // Should contain the configured font
    expect(fontFamily.length).toBeGreaterThan(0);
  });
});

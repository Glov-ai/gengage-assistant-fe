/**
 * Responsive layout tests — verifies PDP, SimRel grid, and host shell
 * adapt correctly across mobile and desktop viewports.
 */

import { test, expect } from '@playwright/test';
import { DEMO_URL, setupMockRoutes } from './fixtures.js';

test.describe('Responsive — mobile viewport (640px)', () => {
  test('PDP layout becomes single column at 640px', async ({ page }) => {
    await setupMockRoutes(page);
    await page.setViewportSize({ width: 640, height: 900 });
    await page.goto(DEMO_URL);

    const pdpLayout = page.locator('.pdp-layout');
    await expect(pdpLayout).toBeVisible({ timeout: 10000 });

    const columns = await pdpLayout.evaluate((el) => {
      const style = getComputedStyle(el);
      return style.gridTemplateColumns;
    });
    // Single column = should NOT contain two separate column values
    // The breakpoint for PDP is 1060px, so at 640px it should be "1fr" (single column)
    const columnParts = columns.trim().split(/\s+/);
    expect(columnParts.length).toBe(1);
  });

  test('host shell has reduced padding at 640px', async ({ page }) => {
    await setupMockRoutes(page);
    await page.setViewportSize({ width: 640, height: 900 });
    await page.goto(DEMO_URL);

    const shell = page.locator('.host-shell');
    await expect(shell).toBeVisible({ timeout: 10000 });

    const padding = await shell.evaluate((el) => {
      return parseInt(getComputedStyle(el).paddingLeft, 10);
    });
    // At 640px, padding should be 12px (reduced from 16px)
    expect(padding).toBeLessThanOrEqual(14);
  });

  test('SimRel grid reduces columns at 768px', async ({ page }) => {
    await setupMockRoutes(page);
    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto(DEMO_URL);

    const grid = page.locator('.gengage-simrel-grid');
    await expect(grid).toBeAttached({ timeout: 10000 });

    const columns = await grid.evaluate((el) => {
      const style = getComputedStyle(el);
      return style.gridTemplateColumns;
    });
    // At 768px, the CSS sets grid-template-columns: repeat(2, 1fr)
    const columnParts = columns.trim().split(/\s+/);
    expect(columnParts.length).toBeLessThanOrEqual(3);
  });
});

test.describe('Responsive — desktop viewport (1280px)', () => {
  test('PDP layout has 2 columns at 1280px', async ({ page }) => {
    await setupMockRoutes(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(DEMO_URL);

    const pdpLayout = page.locator('.pdp-layout');
    await expect(pdpLayout).toBeVisible({ timeout: 10000 });

    const columns = await pdpLayout.evaluate((el) => {
      const style = getComputedStyle(el);
      return style.gridTemplateColumns;
    });
    // Two columns: should have 2 separate width values
    const columnParts = columns.trim().split(/\s+/);
    expect(columnParts.length).toBe(2);
  });

  test('SimRel grid has multiple columns at 1280px', async ({ page }) => {
    await setupMockRoutes(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(DEMO_URL);

    const grid = page.locator('.gengage-simrel-grid');
    await expect(grid).toBeAttached({ timeout: 10000 });

    const columns = await grid.evaluate((el) => {
      const style = getComputedStyle(el);
      return style.gridTemplateColumns;
    });
    // Default is repeat(4, minmax(0, 1fr)) — should have at least 2 columns
    // On desktop at 1280px the host-shell is max-width: 1280px, minus padding, the
    // simrel-mount may be narrower but the grid should still have 2+ columns
    const columnParts = columns.trim().split(/\s+/);
    expect(columnParts.length).toBeGreaterThanOrEqual(2);
  });
});

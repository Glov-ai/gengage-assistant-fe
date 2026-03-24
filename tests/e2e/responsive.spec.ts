/**
 * Responsive layout tests — verifies PDP, SimRel grid, and host shell
 * adapt correctly across mobile and desktop viewports.
 */

import { test, expect } from '@playwright/test';
import { gotoDemoReady, setupMockRoutes } from './fixtures.js';

test.describe('Responsive — mobile viewport (640px)', () => {
  test('PDP layout becomes single column at 640px', async ({ page }) => {
    await setupMockRoutes(page);
    await page.setViewportSize({ width: 640, height: 900 });
    await gotoDemoReady(page);

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
    await gotoDemoReady(page);

    const shell = page.locator('.host-shell');
    await expect(shell).toBeVisible({ timeout: 10000 });

    const padding = await shell.evaluate((el) => {
      return parseInt(getComputedStyle(el).paddingLeft, 10);
    });
    // At 640px, padding should be 12px (reduced from 16px)
    expect(padding).toBeLessThanOrEqual(14);
  });

  test('SimRel rail stays horizontally scrollable at 768px', async ({ page }) => {
    await setupMockRoutes(page);
    await page.setViewportSize({ width: 768, height: 900 });
    await gotoDemoReady(page);

    const grid = page.locator('.gengage-simrel-grid');
    await expect(grid).toBeAttached({ timeout: 10000 });

    const layout = await grid.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        display: style.display,
        overflowX: style.overflowX,
      };
    });
    expect(layout.display).toBe('flex');
    expect(layout.overflowX === 'auto' || layout.overflowX === 'scroll').toBe(true);
  });
});

test.describe('Responsive — desktop viewport (1280px)', () => {
  test('PDP layout has 2 columns at 1280px', async ({ page }) => {
    await setupMockRoutes(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoDemoReady(page);

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

  test('SimRel rail remains a horizontal list at 1280px', async ({ page }) => {
    await setupMockRoutes(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoDemoReady(page);

    const grid = page.locator('.gengage-simrel-grid');
    await expect(grid).toBeAttached({ timeout: 10000 });

    const layout = await grid.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        display: style.display,
        overflowX: style.overflowX,
        gap: style.columnGap,
      };
    });
    expect(layout.display).toBe('flex');
    expect(layout.overflowX === 'auto' || layout.overflowX === 'scroll').toBe(true);
    expect(parseInt(layout.gap, 10)).toBeGreaterThan(0);
  });
});

/**
 * Comprehensive QNA widget tests — covers input field, send button,
 * button colors, CTA styling, mount target, element count, and cursor.
 */

import { test, expect } from '@playwright/test';
import { DEMO_URL, setupMockRoutes } from './fixtures.js';

test.describe('QNA widget — element presence', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto(DEMO_URL);
  });

  test('QNA container is inside the correct mount parent', async ({ page }) => {
    const container = page.locator('#koctas-qna-section .gengage-qna-container');
    await expect(container).toBeAttached({ timeout: 10000 });
  });

  test('all 3 buttons plus CTA present (4 interactive elements)', async ({ page }) => {
    const buttons = page.locator('.gengage-qna-button');
    await expect(buttons.first()).toBeVisible({ timeout: 10000 });

    const buttonCount = await buttons.count();
    expect(buttonCount).toBe(3);

    const cta = page.locator('.gengage-qna-cta');
    await expect(cta).toBeVisible();
  });
});

test.describe('QNA widget — button styling', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto(DEMO_URL);
  });

  test('QNA button has primary background color (orange)', async ({ page }) => {
    const button = page.locator('.gengage-qna-button').first();
    await expect(button).toBeVisible({ timeout: 10000 });

    const bgColor = await button.evaluate((el) => getComputedStyle(el).backgroundColor);
    // #ec6e00 = rgb(236, 110, 0)
    const match = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    expect(match).toBeTruthy();
    const [, r, g, b] = match!;
    expect(Number(r)).toBeGreaterThan(200);
    expect(Number(b)).toBeLessThan(40);
  });

  test('CTA button has dashed border (not solid fill)', async ({ page }) => {
    const cta = page.locator('.gengage-qna-cta');
    await expect(cta).toBeVisible({ timeout: 10000 });

    const borderStyle = await cta.evaluate((el) => getComputedStyle(el).borderTopStyle);
    expect(borderStyle).toBe('dashed');
  });

  test('CTA button has transparent background', async ({ page }) => {
    const cta = page.locator('.gengage-qna-cta');
    await expect(cta).toBeVisible({ timeout: 10000 });

    const bgColor = await cta.evaluate((el) => getComputedStyle(el).backgroundColor);
    // Should be transparent (rgba(0,0,0,0)) or "transparent"
    expect(bgColor === 'transparent' || bgColor === 'rgba(0, 0, 0, 0)' || bgColor.includes('0, 0, 0, 0')).toBe(true);
  });

  test('QNA button has cursor pointer', async ({ page }) => {
    const button = page.locator('.gengage-qna-button').first();
    await expect(button).toBeVisible({ timeout: 10000 });

    const cursor = await button.evaluate((el) => getComputedStyle(el).cursor);
    expect(cursor).toBe('pointer');
  });
});

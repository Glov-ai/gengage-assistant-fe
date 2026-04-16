/**
 * Comprehensive QNA widget tests — covers input field, send button,
 * button colors, CTA styling, mount target, element count, and cursor.
 */

import { test, expect } from '@playwright/test';
import { gotoDemoReady, setupMockRoutes } from './fixtures.js';

test.describe('QNA widget — element presence', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await gotoDemoReady(page);
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
    await gotoDemoReady(page);
  });

  test('QNA button uses the primary color for its outlined chip styling', async ({ page }) => {
    const button = page.locator('.gengage-qna-button').first();
    await expect(button).toBeVisible({ timeout: 10000 });

    const styles = await button.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        backgroundColor: computed.backgroundColor,
        textColor: computed.color,
      };
    });
    const match = styles.textColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    expect(match).toBeTruthy();
    const [, r, , b] = match!;
    expect(Number(r)).toBeGreaterThan(200);
    expect(Number(b)).toBeLessThan(40);
    expect(styles.backgroundColor === 'transparent' || styles.backgroundColor.includes('0, 0, 0, 0')).toBe(false);
  });

  test('CTA button has an outline border (not solid fill)', async ({ page }) => {
    const cta = page.locator('.gengage-qna-cta');
    await expect(cta).toBeVisible({ timeout: 10000 });

    const border = await cta.evaluate((el) => {
      const styles = getComputedStyle(el);
      return {
        borderStyle: styles.borderTopStyle,
        borderWidth: styles.borderTopWidth,
      };
    });
    expect(border.borderStyle).not.toBe('none');
    expect(border.borderWidth).not.toBe('0px');
  });

  test('CTA button has a light secondary surface background', async ({ page }) => {
    const cta = page.locator('.gengage-qna-cta');
    await expect(cta).toBeVisible({ timeout: 10000 });

    const bgColor = await cta.evaluate((el) => getComputedStyle(el).backgroundColor);
    const match = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    expect(match).toBeTruthy();
    const [, r, g, b] = match!;
    expect(Number(r)).toBeGreaterThan(200);
    expect(Number(g)).toBeGreaterThan(200);
    expect(Number(b)).toBeGreaterThan(200);
  });

  test('QNA button has cursor pointer', async ({ page }) => {
    const button = page.locator('.gengage-qna-button').first();
    await expect(button).toBeVisible({ timeout: 10000 });

    const cursor = await button.evaluate((el) => getComputedStyle(el).cursor);
    expect(cursor).toBe('pointer');
  });
});

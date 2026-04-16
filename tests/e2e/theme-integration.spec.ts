/**
 * Theme integration tests — verifies CSS custom properties are applied
 * and inherited by widget components.
 */

import { test, expect } from '@playwright/test';
import { gotoDemoReady, setupMockRoutes } from './fixtures.js';

test.describe('Theme CSS custom properties', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await gotoDemoReady(page);
  });

  test('--gengage-primary-color is set on QNA container', async ({ page }) => {
    const container = page.locator('.gengage-qna-container');
    await expect(container).toBeAttached({ timeout: 10000 });

    const value = await container.evaluate((el) => {
      return getComputedStyle(el).getPropertyValue('--gengage-primary-color').trim();
    });
    expect(value.length).toBeGreaterThan(0);
    expect(value).toContain('#ec6e00');
  });

  test('--gengage-primary-foreground is set on QNA container', async ({ page }) => {
    const container = page.locator('.gengage-qna-container');
    await expect(container).toBeAttached({ timeout: 10000 });

    const value = await container.evaluate((el) => {
      return getComputedStyle(el).getPropertyValue('--gengage-primary-foreground').trim();
    });
    expect(value.length).toBeGreaterThan(0);
  });

  test('--gengage-font-family is applied to QNA container', async ({ page }) => {
    const container = page.locator('.gengage-qna-container');
    await expect(container).toBeAttached({ timeout: 10000 });

    const fontFamily = await container.evaluate((el) => {
      return getComputedStyle(el).fontFamily;
    });
    // Should contain "Source Sans Pro" from the theme config
    expect(fontFamily.toLowerCase()).toContain('source sans');
  });

  test('--gengage-border-radius is set on QNA mount root', async ({ page }) => {
    // The border-radius is set on the widget root — the parent of QNA container
    const root = page.locator('#koctas-qna-section');
    await expect(root).toBeAttached({ timeout: 10000 });

    const value = await root.evaluate((el) => {
      return getComputedStyle(el).getPropertyValue('--gengage-border-radius').trim();
    });
    // borderRadius: '8px' from config
    expect(value).toBe('8px');
  });

  test('chat launcher inherits the configured pill launcher presentation', async ({ page }) => {
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });

    await expect(launcher).toHaveClass(/gengage-chat-launcher--image-mode/);
    await expect(launcher.locator('img')).toBeVisible();
    await expect(launcher).toContainText("Koçtaş'a Sor");

    const size = await launcher.evaluate((el) => ({
      width: parseFloat(getComputedStyle(el).width),
      height: parseFloat(getComputedStyle(el).height),
    }));
    expect(size.width).toBeGreaterThan(size.height);
    expect(size.height).toBeGreaterThanOrEqual(56);
  });

  test('QNA buttons use the primary color for their text styling', async ({ page }) => {
    const button = page.locator('.gengage-qna-button').first();
    await expect(button).toBeVisible({ timeout: 10000 });

    const textColor = await button.evaluate((el) => getComputedStyle(el).color);
    const match = textColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    expect(match).toBeTruthy();
    expect(Number(match![1])).toBeGreaterThan(200);
    expect(Number(match![3])).toBeLessThan(40);
  });
});

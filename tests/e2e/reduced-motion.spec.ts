/**
 * Reduced motion tests — verifies that animations and transitions
 * are disabled when prefers-reduced-motion is set to "reduce".
 */

import { test, expect } from '@playwright/test';
import { gotoDemoReady, setupMockRoutes } from './fixtures.js';

test.describe('prefers-reduced-motion: reduce', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setupMockRoutes(page);
    await gotoDemoReady(page);
  });

  test('launcher has no animation or transition', async ({ page }) => {
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });

    const styles = await launcher.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        animation: computed.animationName,
        animationDuration: computed.animationDuration,
        transition: computed.transitionDuration,
      };
    });

    // With reduced motion, animation should be "none" and transition "0s"
    expect(styles.animation).toBe('none');
    expect(styles.transition).toBe('0s');
  });

  test('drawer has no slide transition', async ({ page }) => {
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.click();

    const drawer = page.locator('.gengage-chat-drawer');
    await expect(drawer).not.toHaveClass(/gengage-chat-drawer--hidden/, { timeout: 5000 });

    const styles = await drawer.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        animation: computed.animationName,
        transition: computed.transitionDuration,
      };
    });

    expect(styles.animation).toBe('none');
    expect(styles.transition).toBe('0s');
  });

  test('chat bubbles have no entry animation', async ({ page }) => {
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.click();

    const drawer = page.locator('.gengage-chat-drawer');
    await expect(drawer).not.toHaveClass(/gengage-chat-drawer--hidden/, { timeout: 5000 });

    // Send a message to trigger a bubble
    const input = page.locator('.gengage-chat-input');
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.fill('Test');
    await page.locator('.gengage-chat-send').click();

    // Wait for the response bubble
    const bubble = page
      .locator('.gengage-chat-bubble--assistant:not(.gengage-chat-bubble--presentation-collapsed)')
      .last();
    await expect(bubble).toBeVisible({ timeout: 5000 });

    const styles = await bubble.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        animation: computed.animationName,
        animationDuration: computed.animationDuration,
      };
    });

    expect(styles.animation).toBe('none');
  });

  test('send button has no transition', async ({ page }) => {
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.click();

    const drawer = page.locator('.gengage-chat-drawer');
    await expect(drawer).not.toHaveClass(/gengage-chat-drawer--hidden/, { timeout: 5000 });

    const send = page.locator('.gengage-chat-send');
    await expect(send).toBeAttached();

    const styles = await send.evaluate((el) => {
      const computed = getComputedStyle(el);
      return { transition: computed.transitionDuration };
    });

    expect(styles.transition).toBe('0s');
  });
});

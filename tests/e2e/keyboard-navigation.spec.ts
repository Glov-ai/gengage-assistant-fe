/**
 * Keyboard navigation tests — verifies Tab focus flow through
 * launcher, drawer, and interactive elements.
 */

import { test, expect, type Page } from '@playwright/test';
import { gotoDemoReady, setupMockRoutes } from './fixtures.js';

/**
 * Get info about the currently focused element inside the chat Shadow DOM.
 */
async function getFocusedElementInfo(page: Page): Promise<{ tag: string; className: string }> {
  return page.evaluate(() => {
    const hosts = document.querySelectorAll('*');
    for (const host of hosts) {
      const sr = host.shadowRoot;
      if (!sr) continue;
      const drawer = sr.querySelector('.gengage-chat-drawer');
      if (drawer && sr.activeElement) {
        const el = sr.activeElement as HTMLElement;
        return { tag: el.tagName.toLowerCase(), className: el.className };
      }
    }
    return { tag: 'unknown', className: '' };
  });
}

/**
 * Check if focus is inside the chat widget's Shadow DOM drawer.
 */
async function isFocusInDrawer(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const hosts = document.querySelectorAll('*');
    for (const host of hosts) {
      const sr = host.shadowRoot;
      if (!sr) continue;
      const drawer = sr.querySelector('.gengage-chat-drawer');
      if (drawer && sr.activeElement) {
        return drawer.contains(sr.activeElement);
      }
    }
    return false;
  });
}

/**
 * Check if focus is inside the chat widget's Shadow DOM (launcher or drawer).
 */
async function isFocusInShadowRoot(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const hosts = document.querySelectorAll('*');
    for (const host of hosts) {
      const sr = host.shadowRoot;
      if (!sr) continue;
      if (sr.querySelector('.gengage-chat-launcher') && sr.activeElement) {
        return true;
      }
    }
    return false;
  });
}

test.describe('Keyboard navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await gotoDemoReady(page);
  });

  test('launcher button is focusable via Tab', async ({ page }) => {
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });

    // Tab through the page until focus enters the chat shadow DOM
    let found = false;
    for (let i = 0; i < 50; i++) {
      await page.keyboard.press('Tab');
      if (await isFocusInShadowRoot(page)) {
        found = true;
        break;
      }
    }

    expect(found, 'Tab should eventually reach the chat widget shadow DOM').toBe(true);
  });

  test('Enter key on launcher opens the drawer', async ({ page }) => {
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });

    // Focus the launcher
    await launcher.focus();
    await page.keyboard.press('Enter');

    const drawer = page.locator('.gengage-chat-drawer');
    await expect(drawer).not.toHaveClass(/gengage-chat-drawer--hidden/, { timeout: 5000 });
  });

  test('Escape key closes the drawer', async ({ page }) => {
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.click();

    const drawer = page.locator('.gengage-chat-drawer');
    await expect(drawer).not.toHaveClass(/gengage-chat-drawer--hidden/, { timeout: 5000 });

    await page.keyboard.press('Escape');

    await expect(drawer).toHaveClass(/gengage-chat-drawer--hidden/, { timeout: 5000 });
  });

  test('focus moves to input when drawer opens', async ({ page }) => {
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.click();

    const drawer = page.locator('.gengage-chat-drawer');
    await expect(drawer).not.toHaveClass(/gengage-chat-drawer--hidden/, { timeout: 5000 });

    // Wait for focus to settle
    await page.waitForTimeout(300);

    const focused = await getFocusedElementInfo(page);
    expect(focused.tag).toBe('textarea');
    expect(focused.className).toContain('gengage-chat-input');
  });

  test('drawer contains multiple focusable interactive elements', async ({ page }) => {
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.click();

    const drawer = page.locator('.gengage-chat-drawer');
    await expect(drawer).not.toHaveClass(/gengage-chat-drawer--hidden/, { timeout: 5000 });

    // Query all focusable elements inside the Shadow DOM drawer
    const focusableElements = await page.evaluate(() => {
      const hosts = document.querySelectorAll('*');
      for (const host of hosts) {
        const sr = host.shadowRoot;
        if (!sr) continue;
        const drawer = sr.querySelector('.gengage-chat-drawer');
        if (!drawer) continue;
        const focusable = drawer.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        return Array.from(focusable).map((el) => {
          const htmlEl = el as HTMLElement;
          return `${htmlEl.tagName.toLowerCase()}.${htmlEl.className.split(' ')[0]}`;
        });
      }
      return [];
    });

    // Should have at least: close button, textarea, send button, attach button
    expect(focusableElements.length).toBeGreaterThanOrEqual(3);

    // Should include the expected key elements
    const hasTextarea = focusableElements.some((e) => e.startsWith('textarea'));
    const hasCloseButton = focusableElements.some((e) => e.includes('gengage-chat-close'));
    expect(hasTextarea, 'drawer should contain a textarea').toBe(true);
    expect(hasCloseButton, 'drawer should contain a close button').toBe(true);
  });

  test('Shift+Tab navigates backwards through drawer elements', async ({ page }) => {
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.click();

    const drawer = page.locator('.gengage-chat-drawer');
    await expect(drawer).not.toHaveClass(/gengage-chat-drawer--hidden/, { timeout: 5000 });

    const input = page.locator('.gengage-chat-input');
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.focus();

    // Shift+Tab should move backwards but stay inside the drawer
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Shift+Tab');
      const inDrawer = await isFocusInDrawer(page);
      expect(inDrawer, `Shift+Tab #${i + 1} should keep focus in drawer`).toBe(true);
    }
  });

  test('focus-visible styles are defined for close button', async ({ page }) => {
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.click();

    const drawer = page.locator('.gengage-chat-drawer');
    await expect(drawer).not.toHaveClass(/gengage-chat-drawer--hidden/, { timeout: 5000 });

    // Use keyboard Tab to reach the close button — this triggers :focus-visible
    const input = page.locator('.gengage-chat-input');
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.focus();

    // Tab until we reach the close button
    let reachedClose = false;
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
      const info = await getFocusedElementInfo(page);
      if (info.className.includes('gengage-chat-close')) {
        reachedClose = true;
        break;
      }
    }

    expect(reachedClose, 'Tab should reach the close button').toBe(true);

    // Verify focus-visible styles are applied
    const styles = await page.evaluate(() => {
      const hosts = document.querySelectorAll('*');
      for (const host of hosts) {
        const sr = host.shadowRoot;
        if (!sr) continue;
        const closeBtn = sr.querySelector('.gengage-chat-close');
        if (closeBtn) {
          const computed = getComputedStyle(closeBtn);
          return {
            outlineStyle: computed.outlineStyle,
            outlineWidth: computed.outlineWidth,
            boxShadow: computed.boxShadow,
          };
        }
      }
      return null;
    });

    expect(styles).not.toBeNull();
    const hasOutline = styles!.outlineStyle !== 'none' && styles!.outlineWidth !== '0px';
    const hasBoxShadow = styles!.boxShadow !== 'none' && styles!.boxShadow !== '';
    expect(hasOutline || hasBoxShadow, 'Close button should have a visible :focus-visible indicator').toBe(true);
  });
});

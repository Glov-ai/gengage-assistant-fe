/**
 * Accessibility tests — verifies ARIA roles, labels, and semantic
 * attributes across all widgets.
 */

import { test, expect } from '@playwright/test';
import { gotoDemoReady, setupMockRoutes } from './fixtures.js';

test.describe('Accessibility — Chat widget', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await gotoDemoReady(page);
    // Open the drawer
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.click();
    const drawer = page.locator('.gengage-chat-drawer');
    await expect(drawer).not.toHaveClass(/gengage-chat-drawer--hidden/, { timeout: 5000 });
  });

  test('drawer has role="dialog"', async ({ page }) => {
    const drawer = page.locator('.gengage-chat-drawer');
    const role = await drawer.getAttribute('role');
    expect(role).toBe('dialog');
  });

  test('messages area has aria-live="polite"', async ({ page }) => {
    const messages = page.locator('.gengage-chat-messages');
    await expect(messages).toBeVisible({ timeout: 5000 });

    const ariaLive = await messages.getAttribute('aria-live');
    expect(ariaLive).toBe('polite');
  });

  test('messages area has aria-label', async ({ page }) => {
    const messages = page.locator('.gengage-chat-messages');
    await expect(messages).toBeVisible({ timeout: 5000 });

    const ariaLabel = await messages.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel!.length).toBeGreaterThan(0);
  });

  test('close button has aria-label', async ({ page }) => {
    const closeBtn = page.locator('.gengage-chat-close');
    await expect(closeBtn).toBeVisible();

    const ariaLabel = await closeBtn.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
  });

  test('input textarea has placeholder attribute', async ({ page }) => {
    const input = page.locator('.gengage-chat-input');
    await expect(input).toBeVisible({ timeout: 5000 });

    const placeholder = await input.getAttribute('placeholder');
    expect(placeholder).toBeTruthy();
  });
});

test.describe('Accessibility — QNA widget', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await gotoDemoReady(page);
  });

  test('button container has role="group"', async ({ page }) => {
    const buttonGroup = page.locator('.gengage-qna-buttons[role="group"]');
    await expect(buttonGroup).toBeAttached({ timeout: 10000 });
  });

  test('button container has aria-label', async ({ page }) => {
    const buttonGroup = page.locator('.gengage-qna-buttons');
    await expect(buttonGroup).toBeAttached({ timeout: 10000 });

    const ariaLabel = await buttonGroup.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
  });
});

test.describe('Accessibility — SimRel widget', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await gotoDemoReady(page);
  });

  test('grid has role="list"', async ({ page }) => {
    const grid = page.locator('.gengage-simrel-grid');
    await expect(grid).toBeAttached({ timeout: 10000 });

    const role = await grid.getAttribute('role');
    expect(role).toBe('list');
  });

  test('cards have role="listitem"', async ({ page }) => {
    const cards = page.locator('.gengage-simrel-card');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const role = await cards.nth(i).getAttribute('role');
      expect(role).toBe('listitem');
    }
  });

  test('cards have data-sku attribute', async ({ page }) => {
    const cards = page.locator('.gengage-simrel-card');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const sku = await cards.nth(i).getAttribute('data-sku');
      expect(sku).toBeTruthy();
      expect(sku!.length).toBeGreaterThan(0);
    }
  });

  test('stepper decrease button has aria-label', async ({ page }) => {
    const stepper = page.locator('.gengage-qty-stepper').first();
    await expect(stepper).toBeVisible({ timeout: 10000 });

    const decBtn = stepper.locator('button').first();
    const ariaLabel = await decBtn.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
  });

  test('stepper increase button has aria-label', async ({ page }) => {
    const stepper = page.locator('.gengage-qty-stepper').first();
    await expect(stepper).toBeVisible({ timeout: 10000 });

    const incBtn = stepper.locator('button').nth(1);
    const ariaLabel = await incBtn.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
  });

  test('tab list has role="tablist"', async ({ page }) => {
    const tablist = page.locator('.gengage-simrel-tabs');
    await expect(tablist).toBeAttached({ timeout: 10000 });

    const role = await tablist.getAttribute('role');
    expect(role).toBe('tablist');
  });

  test('tab buttons have role="tab"', async ({ page }) => {
    const tabs = page.locator('.gengage-simrel-tab');
    await expect(tabs.first()).toBeVisible({ timeout: 10000 });

    const count = await tabs.count();
    for (let i = 0; i < count; i++) {
      const role = await tabs.nth(i).getAttribute('role');
      expect(role).toBe('tab');
    }
  });

  test('tab panels have role="tabpanel"', async ({ page }) => {
    const panels = page.locator('.gengage-simrel-tab-panel');
    await expect(panels.first()).toBeAttached({ timeout: 10000 });

    const count = await panels.count();
    for (let i = 0; i < count; i++) {
      const role = await panels.nth(i).getAttribute('role');
      expect(role).toBe('tabpanel');
    }
  });
});

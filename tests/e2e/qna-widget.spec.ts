/**
 * QNA widget E2E tests.
 *
 * QNA mounts directly into the light DOM inside #koctas-qna-section.
 * It fetches launcher_action on init to render action buttons.
 */

import { test, expect } from '@playwright/test';
import { gotoDemoReady, setupMockRoutes } from './fixtures.js';

test.describe('QNA widget', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await gotoDemoReady(page);
  });

  test('QNA container renders inside mount target', async ({ page }) => {
    const container = page.locator('#koctas-qna-section .gengage-qna-container');
    await expect(container).toBeAttached({ timeout: 10000 });
  });

  test('QNA buttons appear from mocked launcher_action response', async ({ page }) => {
    const buttons = page.locator('.gengage-qna-button');
    await expect(buttons.first()).toBeVisible({ timeout: 10000 });

    const count = await buttons.count();
    expect(count).toBe(3);
  });

  test('buttons have correct text from mock data', async ({ page }) => {
    const buttons = page.locator('.gengage-qna-button');
    await expect(buttons.first()).toBeVisible({ timeout: 10000 });

    const texts = await buttons.allTextContents();
    expect(texts).toContain('Renk secenekleri');
    expect(texts).toContain('Teknik ozellikler');
    expect(texts).toContain('Kargo bilgisi');
  });

  test('CTA button exists', async ({ page }) => {
    const cta = page.locator('.gengage-qna-cta');
    await expect(cta).toBeVisible({ timeout: 10000 });
    // The config sets ctaText: 'Baska bir sey sor'
    const text = await cta.textContent();
    expect(text).toBeTruthy();
  });

  test('QNA text input renders and send button activates when text is entered', async ({ page }) => {
    const input = page.locator('#koctas-qna-section .gengage-qna-input');
    await expect(input).toBeVisible({ timeout: 10000 });

    const send = page.locator('#koctas-qna-section .gengage-qna-send');
    await expect(send).toHaveClass(/gengage-qna-icon-btn--hidden/);

    await input.fill('Merhaba');
    await expect(send).toBeVisible({ timeout: 10000 });
    await expect(send).toBeEnabled();
  });

  test('QNA has button group with accessible role', async ({ page }) => {
    const buttonGroup = page.locator('.gengage-qna-buttons[role="group"]');
    await expect(buttonGroup).toBeAttached({ timeout: 10000 });
  });

  test('clicking a QNA button dispatches gengage:qna:action event', async ({ page }) => {
    const buttons = page.locator('.gengage-qna-button');
    await expect(buttons.first()).toBeVisible({ timeout: 10000 });

    // Listen for the custom event
    const eventFired = page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        window.addEventListener('gengage:qna:action', () => resolve(true), { once: true });
        setTimeout(() => resolve(false), 5000);
      });
    });

    await buttons.first().click();
    const fired = await eventFired;
    expect(fired).toBe(true);
  });
});

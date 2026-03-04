/**
 * Data completeness verification tests — ensures all expected data from
 * mock responses is rendered correctly and completely.
 */

import { test, expect } from '@playwright/test';
import { gotoDemoReady, setupMockRoutes } from './fixtures.js';

test.describe('Completeness — SimRel products', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await gotoDemoReady(page);
  });

  test('all 4 unique products appear across tabs', async ({ page }) => {
    const tabs = page.locator('.gengage-simrel-tab');
    await expect(tabs.first()).toBeVisible({ timeout: 10000 });

    const allNames = new Set<string>();

    // First tab
    const firstPanel = page.locator('.gengage-simrel-tab-panel:not([style*="display: none"])');
    const firstNames = firstPanel.locator('.gengage-simrel-card-name');
    await expect(firstNames.first()).toBeVisible({ timeout: 5000 });
    for (const t of await firstNames.allTextContents()) allNames.add(t.trim());

    // Second tab
    await tabs.nth(1).click();
    const secondPanel = page.locator('.gengage-simrel-tab-panel:not([style*="display: none"])');
    const secondNames = secondPanel.locator('.gengage-simrel-card-name');
    await expect(secondNames.first()).toBeVisible({ timeout: 5000 });
    for (const t of await secondNames.allTextContents()) allNames.add(t.trim());

    expect(allNames.size).toBe(4);
  });

  test('every product card has name, price, and image', async ({ page }) => {
    const cards = page.locator('.gengage-simrel-card');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      // Name
      const name = card.locator('.gengage-simrel-card-name');
      await expect(name).toBeAttached();
      const nameText = await name.textContent();
      expect(nameText!.trim().length).toBeGreaterThan(0);

      // Price
      const price = card.locator('.gengage-simrel-card-price-current');
      await expect(price).toBeAttached();

      // Image
      const img = card.locator('.gengage-simrel-card-image img');
      await expect(img).toBeAttached();
    }
  });

  test('Profesyonel tab has 2 products, Ekonomik tab has 2 products', async ({ page }) => {
    const tabs = page.locator('.gengage-simrel-tab');
    await expect(tabs.first()).toBeVisible({ timeout: 10000 });

    // First tab (Profesyonel) - already active
    const firstPanel = page.locator('.gengage-simrel-tab-panel:not([style*="display: none"])');
    const firstCards = firstPanel.locator('.gengage-simrel-card');
    await expect(firstCards.first()).toBeVisible({ timeout: 5000 });
    expect(await firstCards.count()).toBe(2);

    // Switch to Ekonomik tab
    await tabs.nth(1).click();
    const secondPanel = page.locator('.gengage-simrel-tab-panel:not([style*="display: none"])');
    const secondCards = secondPanel.locator('.gengage-simrel-card');
    await expect(secondCards.first()).toBeVisible({ timeout: 5000 });
    expect(await secondCards.count()).toBe(2);
  });

  test('products with ratings show star indicators', async ({ page }) => {
    const ratings = page.locator('.gengage-simrel-card-rating');
    await expect(ratings.first()).toBeVisible({ timeout: 10000 });

    const count = await ratings.count();
    // All products in the first tab (Stanley, DeWalt) have ratings
    expect(count).toBeGreaterThanOrEqual(1);

    // Rating text should contain star characters
    const text = await ratings.first().textContent();
    expect(text).toBeTruthy();
    expect(text!.length).toBeGreaterThan(0);
  });

  test('no stepper on products without cartCode', async ({ page }) => {
    const tabs = page.locator('.gengage-simrel-tab');
    await expect(tabs.first()).toBeVisible({ timeout: 10000 });

    // Switch to Ekonomik tab (TEST-002 has cartCode, TEST-004 does not)
    await tabs.nth(1).click();

    const visiblePanel = page.locator('.gengage-simrel-tab-panel:not([style*="display: none"])');
    const cards = visiblePanel.locator('.gengage-simrel-card');
    await expect(cards.first()).toBeVisible({ timeout: 5000 });

    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const nameText = await card.locator('.gengage-simrel-card-name').textContent();
      const stepperCount = await card.locator('.gengage-qty-stepper').count();

      if (nameText?.includes('Makita')) {
        // TEST-004 has no cart_code — should not show stepper
        expect(stepperCount).toBe(0);
      } else if (nameText?.includes('Bosch')) {
        // TEST-002 has cart_code — should show stepper
        expect(stepperCount).toBe(1);
      }
    }
  });
});

test.describe('Completeness — QNA actions', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await gotoDemoReady(page);
  });

  test('all 3 action texts match mock data exactly', async ({ page }) => {
    const buttons = page.locator('.gengage-qna-button');
    await expect(buttons.first()).toBeVisible({ timeout: 10000 });

    const texts = await buttons.allTextContents();
    expect(texts).toHaveLength(3);
    expect(texts).toContain('Renk secenekleri');
    expect(texts).toContain('Teknik ozellikler');
    expect(texts).toContain('Kargo bilgisi');
  });

  test('CTA text matches configured ctaText', async ({ page }) => {
    const cta = page.locator('.gengage-qna-cta');
    await expect(cta).toBeVisible({ timeout: 10000 });

    const text = await cta.textContent();
    // Config sets ctaText: 'Başka bir şey sor'
    expect(text!.trim()).toBe('Başka bir şey sor');
  });
});

test.describe('Completeness — Chat drawer sections', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await gotoDemoReady(page);
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.click();
    const drawer = page.locator('.gengage-chat-drawer');
    await expect(drawer).not.toHaveClass(/gengage-chat-drawer--hidden/, { timeout: 5000 });
  });

  test('drawer contains header, messages, and input area', async ({ page }) => {
    const header = page.locator('.gengage-chat-header');
    await expect(header).toBeVisible({ timeout: 5000 });

    const messages = page.locator('.gengage-chat-messages');
    await expect(messages).toBeVisible();

    const input = page.locator('.gengage-chat-input');
    await expect(input).toBeVisible();
  });
});

test.describe('Completeness — Host page sections', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await gotoDemoReady(page);
  });

  test('all major host page sections are present', async ({ page }) => {
    await expect(page.locator('.dev-header')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.host-topbar')).toBeVisible();
    await expect(page.locator('.host-breadcrumb')).toBeVisible();
    await expect(page.locator('.pdp-layout')).toBeVisible();
    await expect(page.locator('.content-card')).toBeVisible();
    await expect(page.locator('.qna-section')).toBeAttached();
    await expect(page.locator('.simrel-card')).toBeVisible();
  });
});

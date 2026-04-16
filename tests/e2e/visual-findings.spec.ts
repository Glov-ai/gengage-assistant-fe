/**
 * Tests based on visual comparison findings between local implementation
 * and production koctas.com.tr. These verify correct behavior on the
 * local mocked koctas demo page.
 */

import { test, expect } from '@playwright/test';
import { gotoDemoReady, setupMockRoutes } from './fixtures.js';

test.describe('Visual findings — component duplication check', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await gotoDemoReady(page);
  });

  test('QNA buttons render ONLY inside #koctas-qna-section', async ({ page }) => {
    const qnaButtons = page.locator('.gengage-qna-button');
    await expect(qnaButtons.first()).toBeVisible({ timeout: 10000 });

    // All QNA buttons should be descendants of #koctas-qna-section
    const allButtons = await qnaButtons.count();
    const insideMount = await page.locator('#koctas-qna-section .gengage-qna-button').count();
    expect(allButtons).toBe(insideMount);
    expect(allButtons).toBeGreaterThan(0);
  });

  test('QNA container is not duplicated outside its mount target', async ({ page }) => {
    const containers = page.locator('.gengage-qna-container');
    await expect(containers.first()).toBeAttached({ timeout: 10000 });

    const totalContainers = await containers.count();
    expect(totalContainers).toBe(1);
  });
});

test.describe('Visual findings — chat drawer separation', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await gotoDemoReady(page);
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.click();
    const drawer = page.locator('.gengage-chat-drawer');
    await expect(drawer).not.toHaveClass(/gengage-chat-drawer--hidden/, { timeout: 5000 });
  });

  test('chat drawer has z-index higher than page content', async ({ page }) => {
    const launcherContainer = page.locator('.gengage-chat-launcher-container');
    await expect(launcherContainer).toBeAttached();

    const zIndex = await launcherContainer.evaluate((el) => {
      const val = getComputedStyle(el).zIndex;
      return val === 'auto' ? 0 : Number(val);
    });
    expect(zIndex).toBeGreaterThanOrEqual(1000);
  });

  test('chat drawer does not contain QNA or SimRel containers', async ({ page }) => {
    const drawer = page.locator('.gengage-chat-drawer');
    await expect(drawer).toBeVisible();

    // QNA and SimRel containers should NOT be inside the chat drawer
    const qnaInDrawer = await drawer.locator('.gengage-qna-container').count();
    const simrelInDrawer = await drawer.locator('.gengage-simrel-container').count();
    expect(qnaInDrawer).toBe(0);
    expect(simrelInDrawer).toBe(0);
  });
});

test.describe('Visual findings — discount display on SimRel cards', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await gotoDemoReady(page);
  });

  test('products with discount show original price with strike-through', async ({ page }) => {
    // Koctas uses default discountType (undefined), which renders strike-through
    // TEST-001 (Stanley) has price 1499, price_discounted 1199 => originalPrice shown
    const originalPrices = page.locator('.gengage-simrel-card-price-original');
    await expect(originalPrices.first()).toBeVisible({ timeout: 10000 });

    const count = await originalPrices.count();
    // At least 1 product in the first tab (Stanley or DeWalt) has a discount
    expect(count).toBeGreaterThanOrEqual(1);

    // Original price should have text-decoration: line-through
    const textDecoration = await originalPrices.first().evaluate((el) => {
      return getComputedStyle(el).textDecorationLine;
    });
    expect(textDecoration).toContain('line-through');
  });

  test('products without discount do NOT show original price', async ({ page }) => {
    // Switch to Ekonomik tab where TEST-002 (Bosch, no discount) exists
    const tabs = page.locator('.gengage-simrel-tab');
    await expect(tabs.first()).toBeVisible({ timeout: 10000 });
    await tabs.nth(1).click();

    const panel = page.locator('.gengage-simrel-tab-panel:not([style*="display: none"])');
    const cards = panel.locator('.gengage-simrel-card');
    await expect(cards.first()).toBeVisible({ timeout: 5000 });

    // Check Bosch card (no discount) — should not have original price element
    for (let i = 0; i < (await cards.count()); i++) {
      const card = cards.nth(i);
      const nameText = await card.locator('.gengage-simrel-card-name').textContent();
      if (nameText?.includes('Bosch')) {
        const origPriceCount = await card.locator('.gengage-simrel-card-price-original').count();
        expect(origPriceCount).toBe(0);
      }
    }
  });
});

test.describe('Visual findings — vertical spacing between QNA and SimRel', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await gotoDemoReady(page);
  });

  test('QNA section and SimRel section are vertically ordered (QNA above SimRel)', async ({ page }) => {
    const qna = page.locator('#koctas-qna-section');
    const simrel = page.locator('.simrel-card');
    await expect(qna).toBeAttached({ timeout: 10000 });
    await expect(simrel).toBeVisible({ timeout: 10000 });

    const qnaBox = await qna.boundingBox();
    const simrelBox = await simrel.boundingBox();
    expect(qnaBox).toBeTruthy();
    expect(simrelBox).toBeTruthy();

    // SimRel section should start at or below the bottom of QNA section
    expect(simrelBox!.y).toBeGreaterThanOrEqual(qnaBox!.y + qnaBox!.height);
  });
});

test.describe('Visual findings — chip/button theming', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await gotoDemoReady(page);
  });

  test('QNA buttons use the theme primary color for their text styling', async ({ page }) => {
    const button = page.locator('.gengage-qna-button').first();
    await expect(button).toBeVisible({ timeout: 10000 });

    const textColor = await button.evaluate((el) => getComputedStyle(el).color);
    const match = textColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    expect(match).toBeTruthy();
    const [, r, , b] = match!;
    expect(Number(r)).toBeGreaterThan(200);
    expect(Number(b)).toBeLessThan(40);
  });
});

test.describe('Visual findings — chat input border styling', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await gotoDemoReady(page);
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.click();
    const drawer = page.locator('.gengage-chat-drawer');
    await expect(drawer).not.toHaveClass(/gengage-chat-drawer--hidden/, { timeout: 5000 });
  });

  test('chat input pill has a thin border (1px)', async ({ page }) => {
    const pill = page.locator('.gengage-chat-input-pill');
    await expect(pill).toBeVisible({ timeout: 5000 });

    const borderWidth = await pill.evaluate((el) => {
      return getComputedStyle(el).borderTopWidth;
    });
    // Should be 1px — not excessively thick
    const width = parseFloat(borderWidth);
    expect(width).toBeGreaterThan(0);
    expect(width).toBeLessThanOrEqual(2);
  });

  test('chat input textarea has no visible border', async ({ page }) => {
    const input = page.locator('.gengage-chat-input');
    await expect(input).toBeVisible({ timeout: 5000 });

    const borderStyle = await input.evaluate((el) => {
      return getComputedStyle(el).borderTopStyle;
    });
    // The textarea itself should have border: none
    expect(borderStyle).toBe('none');
  });
});

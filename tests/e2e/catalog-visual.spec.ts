/**
 * Playwright visual regression tests for the component catalog.
 * Run with: npx playwright test --project=catalog
 *
 * Screenshots are captured and compared against baselines using toHaveScreenshot().
 */

import { test, expect } from '@playwright/test';

const CHAT_COMPONENTS = [
  'ActionButtons',
  'ActionButton',
  'ProductCard',
  'ProductDetailsPanel',
  'ProductGrid',
  'ReviewHighlights',
  'ComparisonTable',
  'AITopPicks',
  'GroundingReviewCard',
  'AIGroupingCards',
  'AISuggestedSearchCards',
  'ProsAndCons',
  'CategoriesContainer',
  'HandoffNotice',
  'ProductSummaryCard',
  'Divider',
];

const QNA_COMPONENTS = ['ButtonRow', 'ActionButton', 'TextInput', 'QuestionHeading'];

const SIMREL_COMPONENTS = ['ProductGrid', 'ProductCard', 'AddToCartButton', 'QuickActions', 'EmptyState', 'GroupTabs'];

test.describe('Catalog — Overview', () => {
  test('overview page renders', async ({ page }) => {
    await page.goto('http://localhost:3002/#/');
    await page.waitForSelector('.catalog-overview');
    await expect(page.locator('.catalog-overview')).toHaveScreenshot('overview.png');
  });
});

test.describe('Catalog — Chat Components', () => {
  for (const name of CHAT_COMPONENTS) {
    test(`chat/${name} renders`, async ({ page }) => {
      await page.goto(`http://localhost:3002/#/chat/${name}`);
      await page.waitForSelector('.catalog-card-preview');
      // Brief wait for any async rendering (images, animations)
      await page.waitForTimeout(500);
      await expect(page.locator('.catalog-card')).toHaveScreenshot(`chat-${name}.png`);
    });
  }
});

test.describe('Catalog — QNA Components', () => {
  for (const name of QNA_COMPONENTS) {
    test(`qna/${name} renders`, async ({ page }) => {
      await page.goto(`http://localhost:3002/#/qna/${name}`);
      await page.waitForSelector('.catalog-card-preview');
      await page.waitForTimeout(500);
      await expect(page.locator('.catalog-card')).toHaveScreenshot(`qna-${name}.png`);
    });
  }
});

test.describe('Catalog — SimRel Components', () => {
  for (const name of SIMREL_COMPONENTS) {
    test(`simrel/${name} renders`, async ({ page }) => {
      await page.goto(`http://localhost:3002/#/simrel/${name}`);
      await page.waitForSelector('.catalog-card-preview');
      await page.waitForTimeout(500);
      await expect(page.locator('.catalog-card')).toHaveScreenshot(`simrel-${name}.png`);
    });
  }
});

test.describe('Catalog — Theme Comparison', () => {
  test('theme grid renders with all 12 merchants', async ({ page }) => {
    await page.goto('http://localhost:3002/#/themes');
    await page.waitForSelector('.catalog-theme-grid');
    await page.waitForTimeout(500);
    const cards = page.locator('.catalog-theme-card');
    await expect(cards).toHaveCount(12);
    await expect(page.locator('.catalog-theme-grid')).toHaveScreenshot('theme-grid.png');
  });
});

test.describe('Catalog — Full Widgets', () => {
  test('full widgets section renders', async ({ page }) => {
    await page.goto('http://localhost:3002/#/full-widgets');
    await page.waitForSelector('.catalog-full-widgets');
    await page.waitForTimeout(1000); // Wait for mock backend responses
    await expect(page.locator('.catalog-full-widgets')).toHaveScreenshot('full-widgets.png');
  });
});

test.describe('Catalog — Responsive Preview', () => {
  test('responsive frames render', async ({ page }) => {
    await page.goto('http://localhost:3002/#/responsive');
    await page.waitForSelector('.catalog-responsive-frames');
    await page.waitForTimeout(500);
    await expect(page.locator('.catalog-responsive-frames')).toHaveScreenshot('responsive-preview.png');
  });
});

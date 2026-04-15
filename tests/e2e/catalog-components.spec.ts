/**
 * Detailed Playwright visual regression tests for individual catalog components.
 * Covers: AITopPicks variants, ComparisonTable layout, Product detail panel,
 * and batch widget components.
 *
 * Run with: npx playwright test catalog-components --project=catalog
 */

import { test, expect } from '@playwright/test';

// ─── E2E-1: AITopPicks rendering ────────────────────────────────────────────

test.describe('AITopPicks', () => {
  test('renders in catalog with product cards', async ({ page }) => {
    await page.goto('http://localhost:3002/#/chat/AITopPicks');
    await page.waitForSelector('.catalog-card-preview');
    await page.waitForTimeout(500);

    const preview = page.locator('.catalog-card-preview');
    // Should have at least one top-picks container
    const container = preview.locator('.gengage-chat-ai-top-picks, [class*="top-picks"]');
    await expect(container.first()).toBeVisible();
    await expect(page.locator('.catalog-card')).toHaveScreenshot('aitoppicks-full.png');
  });

  test('renders winner card with role badge', async ({ page }) => {
    await page.goto('http://localhost:3002/#/chat/AITopPicks');
    await page.waitForSelector('.catalog-card-preview');
    await page.waitForTimeout(500);

    // Cards should have a role badge
    const badges = page.locator('.gengage-chat-ai-toppick-badge');
    const count = await badges.count();
    expect(count).toBeGreaterThan(0);
  });

  test('AIGroupingCards render with category labels', async ({ page }) => {
    await page.goto('http://localhost:3002/#/chat/AIGroupingCards');
    await page.waitForSelector('.catalog-card-preview');
    await page.waitForTimeout(500);
    await expect(page.locator('.catalog-card')).toHaveScreenshot('aigroupingcards.png');
  });
});

// ─── E2E-2: ComparisonTable layout ──────────────────────────────────────────

test.describe('ComparisonTable', () => {
  test('renders comparison columns', async ({ page }) => {
    await page.goto('http://localhost:3002/#/chat/ComparisonTable');
    await page.waitForSelector('.catalog-card-preview');
    await page.waitForTimeout(500);

    const table = page.locator('.gengage-chat-comparison-table');
    await expect(table).toBeVisible();
    await expect(page.locator('.catalog-card')).toHaveScreenshot('comparison-table.png');
  });

  test('comparison table has attribute rows', async ({ page }) => {
    await page.goto('http://localhost:3002/#/chat/ComparisonTable');
    await page.waitForSelector('.gengage-chat-comparison-table');
    await page.waitForTimeout(300);

    // Rows are plain <tr> elements inside the comparison table — no BEM class.
    const rows = page.locator('.gengage-chat-comparison-table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('comparison table at mobile width stacks vertically', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:3002/#/chat/ComparisonTable');
    await page.waitForSelector('.catalog-card-preview');
    await page.waitForTimeout(500);
    await expect(page.locator('.catalog-card')).toHaveScreenshot('comparison-table-mobile.png');
  });
});

// ─── E2E-3: Product detail panel ────────────────────────────────────────────

test.describe('ProductDetailsPanel', () => {
  test('renders product details with image and info', async ({ page }) => {
    await page.goto('http://localhost:3002/#/chat/ProductDetailsPanel');
    await page.waitForSelector('.catalog-card-preview');
    await page.waitForTimeout(500);

    const panel = page.locator('.catalog-card-preview');
    await expect(panel).toBeVisible();
    await expect(page.locator('.catalog-card')).toHaveScreenshot('product-details-panel.png');
  });

  test('product details shows image', async ({ page }) => {
    await page.goto('http://localhost:3002/#/chat/ProductDetailsPanel');
    await page.waitForSelector('.catalog-card-preview');
    await page.waitForTimeout(500);

    // Should have at least one image
    const images = page.locator('.catalog-card-preview img');
    const count = await images.count();
    expect(count).toBeGreaterThan(0);
  });
});

// ─── E2E-4: Batch widget component tests ────────────────────────────────────

test.describe('ProductSummaryCard', () => {
  test('renders inline product card', async ({ page }) => {
    await page.goto('http://localhost:3002/#/chat/ProductSummaryCard');
    await page.waitForSelector('.catalog-card-preview');
    await page.waitForTimeout(500);
    await expect(page.locator('.catalog-card')).toHaveScreenshot('product-summary-card.png');
  });
});

test.describe('GroundingReviewCard', () => {
  test('renders review card with CTA', async ({ page }) => {
    await page.goto('http://localhost:3002/#/chat/GroundingReviewCard');
    await page.waitForSelector('.catalog-card-preview');
    await page.waitForTimeout(500);
    await expect(page.locator('.catalog-card')).toHaveScreenshot('grounding-review-card.png');
  });
});

test.describe('CategoriesContainer', () => {
  test('renders categories with tabs', async ({ page }) => {
    await page.goto('http://localhost:3002/#/chat/CategoriesContainer');
    await page.waitForSelector('.catalog-card-preview');
    await page.waitForTimeout(500);
    await expect(page.locator('.catalog-card')).toHaveScreenshot('categories-container.png');
  });
});

test.describe('HandoffNotice', () => {
  test('renders handoff notice', async ({ page }) => {
    await page.goto('http://localhost:3002/#/chat/HandoffNotice');
    await page.waitForSelector('.catalog-card-preview');
    await page.waitForTimeout(500);
    await expect(page.locator('.catalog-card')).toHaveScreenshot('handoff-notice.png');
  });
});

test.describe('ProsAndCons', () => {
  test('renders pros and cons layout', async ({ page }) => {
    await page.goto('http://localhost:3002/#/chat/ProsAndCons');
    await page.waitForSelector('.catalog-card-preview');
    await page.waitForTimeout(500);
    await expect(page.locator('.catalog-card')).toHaveScreenshot('pros-and-cons.png');
  });
});

test.describe('ReviewHighlights', () => {
  test('renders review highlights', async ({ page }) => {
    await page.goto('http://localhost:3002/#/chat/ReviewHighlights');
    await page.waitForSelector('.catalog-card-preview');
    await page.waitForTimeout(500);
    await expect(page.locator('.catalog-card')).toHaveScreenshot('review-highlights.png');
  });
});

// ─── Suggested Actions (pill buttons) ────────────────────────────────────────

test.describe('ActionButtons (Suggested Actions)', () => {
  test('renders action pill buttons', async ({ page }) => {
    await page.goto('http://localhost:3002/#/chat/ActionButtons');
    await page.waitForSelector('.catalog-card-preview');
    await page.waitForTimeout(500);

    const buttons = page.locator('.gengage-chat-action-btn, [class*="action-btn"]');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
    await expect(page.locator('.catalog-card')).toHaveScreenshot('action-buttons.png');
  });

  test('action buttons are clickable with pointer cursor', async ({ page }) => {
    await page.goto('http://localhost:3002/#/chat/ActionButtons');
    await page.waitForSelector('.catalog-card-preview');
    await page.waitForTimeout(500);

    const btn = page.locator('.gengage-chat-action-btn, [class*="action-btn"]').first();
    await expect(btn).toBeVisible();
    const cursor = await btn.evaluate((el) => getComputedStyle(el).cursor);
    expect(cursor).toBe('pointer');
  });
});

// ─── ChoicePrompter ─────────────────────────────────────────────────────────

test.describe('ProductGrid', () => {
  test('renders product cards in catalog', async ({ page }) => {
    await page.goto('http://localhost:3002/#/chat/ProductGrid');
    await page.waitForSelector('.catalog-card-preview');
    await page.waitForTimeout(500);

    // ProductGrid should contain product cards with action buttons
    const cards = page.locator('.gengage-chat-product-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('QNA Components', () => {
  test('ButtonRow renders action buttons', async ({ page }) => {
    await page.goto('http://localhost:3002/#/qna/ButtonRow');
    await page.waitForSelector('.catalog-card-preview');
    await page.waitForTimeout(500);
    await expect(page.locator('.catalog-card')).toHaveScreenshot('qna-button-row.png');
  });

  test('QuestionHeading renders heading text', async ({ page }) => {
    await page.goto('http://localhost:3002/#/qna/QuestionHeading');
    await page.waitForSelector('.catalog-card-preview');
    await page.waitForTimeout(500);
    await expect(page.locator('.catalog-card')).toHaveScreenshot('qna-question-heading.png');
  });
});

import { expect, test } from '@playwright/test';
import { gotoDemoReady, MOCK_CHAT_PRODUCT_LIST_NDJSON, setupMockRoutes } from './fixtures.js';

test.describe('ChoicePrompter — mobile placement', () => {
  test('compare CTA stays inside viewport on mobile when panel content is shown', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupMockRoutes(page, { processActionBody: MOCK_CHAT_PRODUCT_LIST_NDJSON });
    await gotoDemoReady(page);

    await page.evaluate(() => {
      sessionStorage.removeItem('gengage_choice_prompter_dismissed');
    });

    // Trigger a QNA action so ProductGrid is rendered in panel mode.
    const qnaAction = page.locator('.gengage-qna-button').first();
    await expect(qnaAction).toBeVisible({ timeout: 10_000 });
    await qnaAction.click();

    const prompterCta = page.locator('.gengage-chat-choice-prompter-cta');
    await expect(prompterCta).toBeVisible({ timeout: 10_000 });

    const viewport = page.viewportSize();
    expect(viewport).toBeTruthy();

    const box = await prompterCta.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
  });

  test('compare CTA does not overlap chat launcher touch target on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupMockRoutes(page, { processActionBody: MOCK_CHAT_PRODUCT_LIST_NDJSON });
    await gotoDemoReady(page);

    await page.evaluate(() => {
      sessionStorage.removeItem('gengage_choice_prompter_dismissed');
    });

    const qnaAction = page.locator('.gengage-qna-button').first();
    await expect(qnaAction).toBeVisible({ timeout: 10_000 });
    await qnaAction.click();

    const prompterCta = page.locator('.gengage-chat-choice-prompter-cta');
    const launcher = page.locator('.gengage-chat-launcher');
    await expect(prompterCta).toBeVisible({ timeout: 10_000 });
    await expect(launcher).toBeVisible({ timeout: 10_000 });

    const ctaBox = await prompterCta.boundingBox();
    const launcherBox = await launcher.boundingBox();
    expect(ctaBox).toBeTruthy();
    expect(launcherBox).toBeTruthy();

    const cta = ctaBox!;
    const launch = launcherBox!;
    const overlapX = Math.max(0, Math.min(cta.x + cta.width, launch.x + launch.width) - Math.max(cta.x, launch.x));
    const overlapY = Math.max(0, Math.min(cta.y + cta.height, launch.y + launch.height) - Math.max(cta.y, launch.y));
    expect(overlapX * overlapY).toBe(0);
  });
});

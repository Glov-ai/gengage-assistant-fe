import { describe, expect, it } from 'vitest';

import { renderBeautyPhotoStep } from '../src/chat/components/BeautyPhotoStep.js';
import { renderConsultingStylePicker } from '../src/chat/components/ConsultingStylePicker.js';
import { renderPhotoAnalysisCard } from '../src/chat/components/PhotoAnalysisCard.js';
import { CHAT_I18N_EN } from '../src/chat/locales/en.js';
import type { ChatUISpecRenderContext } from '../src/chat/types.js';
import type { UIElement } from '../src/common/types.js';

const renderContext: ChatUISpecRenderContext = {
  i18n: CHAT_I18N_EN,
  onAction: () => undefined,
};

describe('consulting locale renderers', () => {
  it('renders BeautyPhotoStep with locale-managed defaults', () => {
    const element: UIElement = {
      type: 'BeautyPhotoStep',
      props: { processing: false },
    };

    const card = renderBeautyPhotoStep(element, renderContext);

    expect(card.textContent).toContain(CHAT_I18N_EN.beautyPhotoStepTitle);
    expect(card.textContent).toContain(CHAT_I18N_EN.beautyPhotoStepDescription);
    expect(card.textContent).toContain(CHAT_I18N_EN.beautyPhotoStepUpload);
    expect(card.textContent).toContain(CHAT_I18N_EN.beautyPhotoStepSkip);
  });

  it('renders PhotoAnalysisCard labels from ChatI18n', () => {
    const element: UIElement = {
      type: 'PhotoAnalysisCard',
      props: {
        summary: 'Balanced skin profile',
        strengths: ['Healthy glow'],
        focus_points: ['Texture'],
        celeb_style: 'Soft glam',
      },
    };

    const card = renderPhotoAnalysisCard(element, renderContext);

    expect(card.textContent).toContain(CHAT_I18N_EN.photoAnalysisBadge);
    expect(card.textContent).toContain(CHAT_I18N_EN.photoAnalysisStrengthsLabel);
    expect(card.textContent).toContain(CHAT_I18N_EN.photoAnalysisFocusLabel);
    expect(card.textContent).toContain(CHAT_I18N_EN.photoAnalysisCelebStyleLabel);
  });

  it('renders consulting fallback labels from ChatI18n', () => {
    const wrapper = document.createElement('div');
    const grid = document.createElement('div');
    const product = {
      sku: 'SKU-1',
      name: 'Glow Primer',
      brand: 'Flormar',
      url: 'https://example.com/product',
      images: ['https://example.com/product.jpg'],
      price: 999,
    };

    renderConsultingStylePicker(
      wrapper,
      grid,
      'beauty_consulting',
      [
        {
          status: 'ready',
          product_list: [product],
          recommendation_groups: [{ skus: ['SKU-1'] }],
        },
      ],
      renderContext,
    );

    expect(wrapper.textContent).toContain(CHAT_I18N_EN.beautyStylesPreparedTitle.replace('{count}', '1'));
    expect(wrapper.textContent).toContain(CHAT_I18N_EN.consultingFallbackStyleLabel.replace('{index}', '1'));
    expect(grid.textContent).toContain(`${CHAT_I18N_EN.consultingFallbackGroupLabel} (1)`);
  });
});

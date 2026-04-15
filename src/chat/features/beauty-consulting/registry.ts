/**
 * Beauty consulting UISpec component registry entries.
 *
 * Spread into the default chat UISpec registry so central renderUISpec.ts
 * only has a one-line integration point.
 */

import type { UISpecDomRegistry } from '../../../common/renderer/index.js';
import type { ChatUISpecRenderContext } from '../../types.js';
import { renderPhotoAnalysisCard } from '../../components/PhotoAnalysisCard.js';
import { renderBeautyPhotoStep } from '../../components/BeautyPhotoStep.js';

export const beautyConsultingRegistry: Partial<UISpecDomRegistry<ChatUISpecRenderContext>> = {
  PhotoAnalysisCard: ({ element, context }) => renderPhotoAnalysisCard(element, context),
  BeautyPhotoStep: ({ element, context }) => renderBeautyPhotoStep(element, context),
};

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

// During live streaming these components are intercepted by
// handleBeautyUISpec() in stream-handler.ts before the registry is
// consulted.  The entries below serve as fallbacks for session restore
// and as degraded renderers when stream-time parsing fails.
export const beautyConsultingRegistry: Partial<UISpecDomRegistry<ChatUISpecRenderContext>> = {
  PhotoAnalysisCard: ({ element, context }) => renderPhotoAnalysisCard(element, context),
  BeautyPhotoStep: ({ element, context }) => renderBeautyPhotoStep(element, context),
};

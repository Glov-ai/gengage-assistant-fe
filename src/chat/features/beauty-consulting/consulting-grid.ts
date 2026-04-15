/**
 * Consulting-aware ProductGrid helper — determines whether a ProductGrid
 * should render as a consulting style picker instead of a standard grid.
 *
 * Extracted from renderProductGrid() in renderUISpec.ts so the generic
 * grid renderer doesn't contain mode-specific branching inline.
 */

import type { UIElement } from '../../../common/types.js';
import type { ChatUISpecRenderContext } from '../../types.js';
import { renderConsultingStylePicker } from '../../components/ConsultingStylePicker.js';
import type { StyleVariation } from '../../components/ConsultingStylePicker.js';

export interface ConsultingGridResult {
  isConsulting: boolean;
  source: string | undefined;
  styleVariations: StyleVariation[];
}

/**
 * Check whether a ProductGrid element should render as a consulting style picker.
 * Returns the check result plus pre-parsed data for {@link renderConsultingGrid}.
 */
export function detectConsultingGrid(element: UIElement): ConsultingGridResult {
  const source = typeof element.props?.['source'] === 'string' ? element.props['source'] : undefined;
  const styleVariationsRaw = Array.isArray(element.props?.['styleVariations'])
    ? (element.props['styleVariations'] as StyleVariation[])
    : [];
  const styleVariations = styleVariationsRaw.filter(
    (variation) => Array.isArray(variation.product_list) && variation.product_list.length > 0,
  );
  const isConsulting = (source === 'beauty_consulting' || source === 'watch_expert') && styleVariations.length > 0;
  return { isConsulting, source, styleVariations };
}

/**
 * Render a consulting style picker into the ProductGrid wrapper.
 * Call only when `detectConsultingGrid` returned `isConsulting: true`.
 */
export function renderConsultingGrid(
  wrapper: HTMLElement,
  grid: HTMLElement,
  detected: ConsultingGridResult,
  ctx?: ChatUISpecRenderContext,
): void {
  renderConsultingStylePicker(wrapper, grid, detected.source!, detected.styleVariations, ctx);
}

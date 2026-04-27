/**
 * Consulting Style Picker — renders a tabbed style variation picker
 * for beauty consulting and watch expert flows.
 *
 * Extracted from renderProductGrid() to keep renderUISpec.ts focused
 * on generic component dispatch.
 *
 * Streaming: the first non-`loading` variation can paint immediately; later
 * chunks update tabs + product grid in place via {@link patchConsultingStylePickerDom}
 * so the panel is not fully replaced (no skeleton→full flash).
 */

import type { UIElement } from '../../common/types.js';
import type { ChatI18n, ChatUISpecRenderContext } from '../types.js';
import { isSafeUrl, safeSetAttribute } from '../../common/safe-html.js';
import { addImageErrorHandler } from '../../common/product-utils.js';
import { CHAT_I18N_TR } from '../locales/index.js';
import { renderProductCard } from './renderUISpec.js';

export type StyleVariationProduct = Record<string, unknown>;

export type StyleVariation = {
  style_label?: string;
  style_mood?: string;
  image_url?: string;
  status?: string;
  product_list?: StyleVariationProduct[];
  recommendation_groups?: Array<{ label?: string; reason?: string; skus?: string[] }>;
};

type ConsultingProductSection = {
  labelText: string;
  products: StyleVariationProduct[];
  reasonText?: string;
};

type ConsultingI18n = ChatI18n;

interface ConsultingPickerModel {
  grid: HTMLElement;
  source: string;
  ctx: ChatUISpecRenderContext | undefined;
  variations: StyleVariation[];
  i18n: ConsultingI18n;
  selectedIndex: number;
}

const CONSULTING_PICKER_MODEL = new WeakMap<HTMLElement, ConsultingPickerModel>();

function mergeConsultingI18n(ctx?: ChatUISpecRenderContext): ConsultingI18n {
  return { ...CHAT_I18N_TR, ...(ctx?.i18n ?? {}) };
}

export function getVariationStatus(variation: StyleVariation): string {
  return typeof variation.status === 'string' ? variation.status : 'ready';
}

/** First tab that is not actively loading — fast-first paint for streaming grids. */
export function firstRenderableVariationIndex(styleVariations: StyleVariation[]): number {
  const idx = styleVariations.findIndex((v) => getVariationStatus(v) !== 'loading');
  return idx < 0 ? 0 : idx;
}

/** Normalise a consulting image URL from the backend (absolute or relative). */
export function toConsultingImageUrl(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  const raw = input.trim();
  if (!raw) return undefined;

  // If the backend sends an absolute URL, use it directly.
  if (/^https?:\/\//i.test(raw)) return raw;

  // Account style-guide configs may store relative asset paths.
  let path = raw.split(/[?#]/)[0];
  if (!path) return undefined;

  path = path.replace(/^\/+/, '');
  if (path.startsWith('remoteConfig/')) {
    path = path.slice('remoteConfig/'.length);
  }

  if (!path) return undefined;
  return `https://configs.gengage.ai/assets/${path}`;
}

function renderVariationPendingState(
  m: ConsultingPickerModel,
  variation: StyleVariation,
  mode: 'loading' | 'unavailable',
  displayIndex: number,
): void {
  const { grid, i18n } = m;
  grid.innerHTML = '';
  grid.classList.remove('gengage-chat-product-grid--consulting-groups');

  const stateCard = document.createElement('section');
  stateCard.className = 'gengage-chat-consulting-loading-panel';

  const title = document.createElement('h4');
  title.className = 'gengage-chat-consulting-loading-panel-title';
  title.textContent = variationLabel(variation, displayIndex, i18n);
  stateCard.appendChild(title);

  const desc = document.createElement('p');
  desc.className = 'gengage-chat-consulting-loading-panel-copy';
  desc.textContent =
    mode === 'loading' ? i18n.consultingStyleLoadingDescription : i18n.consultingStyleUnavailableDescription;
  stateCard.appendChild(desc);

  if (mode === 'loading') {
    const skeletonGrid = document.createElement('div');
    skeletonGrid.className = 'gengage-chat-consulting-loading-grid';
    for (let i = 0; i < 3; i += 1) {
      const skeleton = document.createElement('div');
      skeleton.className = 'gengage-chat-consulting-loading-card';
      skeletonGrid.appendChild(skeleton);
    }
    stateCard.appendChild(skeletonGrid);
  }

  grid.appendChild(stateCard);
}

function variationLabel(variation: StyleVariation, index: number, i18n: ConsultingI18n): string {
  const fallbackStyleLabel = (i: number): string => i18n.consultingFallbackStyleLabel.replace('{index}', String(i));
  return variation.style_label ?? fallbackStyleLabel(index);
}

function renderConsultingVariationContentByIndex(m: ConsultingPickerModel, index: number): void {
  const variation = m.variations[index];
  if (!variation) return;

  const { grid, source, ctx, i18n } = m;
  grid.innerHTML = '';
  grid.classList.remove('gengage-chat-product-grid--consulting-groups');
  const variationStatus = getVariationStatus(variation);
  const displayIndex = index + 1;

  if (variationStatus === 'loading') {
    renderVariationPendingState(m, variation, 'loading', displayIndex);
    return;
  }
  if (
    variationStatus !== 'ready' &&
    (!Array.isArray(variation.product_list) || variation.product_list.length === 0)
  ) {
    renderVariationPendingState(m, variation, 'unavailable', displayIndex);
    return;
  }
  const products = Array.isArray(variation.product_list) ? variation.product_list : [];
  const recommendationGroups =
    source === 'watch_expert'
      ? []
      : Array.isArray(variation.recommendation_groups)
        ? variation.recommendation_groups
        : [];

  if (recommendationGroups.length > 0) {
    grid.classList.add('gengage-chat-product-grid--consulting-groups');
    const productBySku = new Map<string, StyleVariationProduct>();
    for (const product of products) {
      const sku = typeof product?.['sku'] === 'string' ? (product['sku'] as string) : undefined;
      if (sku) productBySku.set(sku, product);
    }

    const renderGroupSection = (
      labelText: string,
      groupedProducts: StyleVariationProduct[],
      isSingleSection: boolean,
      reasonText?: string,
    ): void => {
      if (groupedProducts.length === 0) return;

      const section = document.createElement('section');
      section.className = 'gengage-chat-consulting-group';

      const header = document.createElement('div');
      header.className = 'gengage-chat-consulting-group-header';

      const label = document.createElement('h4');
      label.className = 'gengage-chat-consulting-group-label';
      label.textContent = `${labelText} (${groupedProducts.length})`;
      header.appendChild(label);

      if (typeof reasonText === 'string' && reasonText.trim().length > 0) {
        const reason = document.createElement('p');
        reason.className = 'gengage-chat-consulting-group-reason';
        reason.textContent = reasonText;
        header.appendChild(reason);
      }

      section.appendChild(header);

      const groupGrid = document.createElement('div');
      groupGrid.className = 'gengage-chat-product-grid gengage-chat-consulting-group-grid';
      if (isSingleSection) {
        groupGrid.classList.add('gengage-chat-consulting-group-grid--single-group');
      }
      groupGrid.style.setProperty(
        '--consulting-group-columns',
        String(Math.max(1, Math.min(4, groupedProducts.length))),
      );
      for (const product of groupedProducts) {
        const cardElement: UIElement = {
          type: 'ProductCard',
          props: { product },
        };
        const card = renderProductCard(
          cardElement,
          ctx ?? ({ onAction: () => undefined } as ChatUISpecRenderContext),
        );
        groupGrid.appendChild(card);
      }
      section.appendChild(groupGrid);
      grid.appendChild(section);
    };

    const renderedSkus = new Set<string>();
    const sections: ConsultingProductSection[] = [];
    for (const group of recommendationGroups) {
      const skus = Array.isArray(group.skus)
        ? group.skus.filter((sku): sku is string => typeof sku === 'string' && sku.trim().length > 0)
        : [];
      const groupedProducts = skus
        .map((sku) => {
          renderedSkus.add(sku);
          return productBySku.get(sku);
        })
        .filter((product): product is StyleVariationProduct => !!product);
      if (groupedProducts.length === 0) continue;
      const labelText =
        typeof group.label === 'string' && group.label.trim().length > 0
          ? group.label
          : i18n.consultingFallbackGroupLabel;
      const reasonText = typeof group.reason === 'string' ? group.reason : undefined;
      sections.push({
        labelText,
        products: groupedProducts,
        ...(reasonText !== undefined ? { reasonText } : {}),
      });
    }

    const leftovers = products.filter((product) => {
      const sku = typeof product?.['sku'] === 'string' ? (product['sku'] as string) : '';
      return sku.length > 0 && !renderedSkus.has(sku);
    });
    if (leftovers.length > 0) {
      sections.push({
        labelText: i18n.consultingOtherCompatibleProductsLabel,
        products: leftovers,
      });
    }

    const isSingleSection = sections.length === 1;
    for (const section of sections) {
      renderGroupSection(section.labelText, section.products, isSingleSection, section.reasonText);
    }
    return;
  }

  for (const product of products) {
    const cardElement: UIElement = {
      type: 'ProductCard',
      props: { product },
    };
    const card = renderProductCard(cardElement, ctx ?? ({ onAction: () => undefined } as ChatUISpecRenderContext));
    grid.appendChild(card);
  }
}

function fillStyleButtonContent(btn: HTMLButtonElement, variation: StyleVariation, index: number, i18n: ConsultingI18n): void {
  const variationStatus = getVariationStatus(variation);
  const loadingBadge = i18n.consultingStyleLoadingBadge;
  const unavailableBadge = i18n.consultingStyleUnavailableBadge;

  btn.classList.remove('gengage-chat-consulting-style-btn--loading', 'gengage-chat-consulting-style-btn--muted');
  if (variationStatus === 'loading') {
    btn.classList.add('gengage-chat-consulting-style-btn--loading');
  } else if (variationStatus !== 'ready') {
    btn.classList.add('gengage-chat-consulting-style-btn--muted');
  }

  btn.setAttribute('aria-label', variationLabel(variation, index + 1, i18n));

  let media = btn.querySelector<HTMLElement>('.gengage-chat-consulting-style-media');
  if (!media) {
    media = document.createElement('div');
    media.className = 'gengage-chat-consulting-style-media';
    btn.appendChild(media);
  } else {
    media.innerHTML = '';
  }

  const imageUrl = toConsultingImageUrl(variation.image_url);
  if (imageUrl && isSafeUrl(imageUrl)) {
    const img = document.createElement('img');
    img.className = 'gengage-chat-consulting-style-image';
    safeSetAttribute(img, 'src', imageUrl);
    img.alt = variationLabel(variation, index + 1, i18n);
    img.loading = 'lazy';
    addImageErrorHandler(img);
    media.appendChild(img);
  }
  const caption = document.createElement('span');
  caption.className = 'gengage-chat-consulting-style-caption';
  caption.textContent = variationLabel(variation, index + 1, i18n);
  media.appendChild(caption);

  if (variationStatus === 'loading' || variationStatus !== 'ready') {
    const badge = document.createElement('span');
    badge.className = 'gengage-chat-consulting-style-status';
    badge.textContent = variationStatus === 'loading' ? loadingBadge : unavailableBadge;
    media.appendChild(badge);
  }
}

function wireStyleButtonClick(
  btn: HTMLButtonElement,
  picker: HTMLElement,
  pickerGrid: HTMLElement,
  index: number,
): void {
  btn.addEventListener('click', () => {
    const model = CONSULTING_PICKER_MODEL.get(picker);
    if (!model) return;
    if (model.selectedIndex === index) return;
    model.selectedIndex = index;
    pickerGrid.querySelectorAll('.gengage-chat-consulting-style-btn').forEach((el, btnIndex) => {
      (el as HTMLElement).classList.toggle('gengage-chat-consulting-style-btn--active', btnIndex === index);
    });
    renderConsultingVariationContentByIndex(model, index);
  });
}

/**
 * Renders the consulting style picker UI (variation buttons + grouped product grid).
 *
 * @param wrapper   Container to append into.
 * @param grid      The product grid element (cleared and repopulated per variation).
 * @param source    Backend source tag (`beauty_consulting` | `watch_expert`).
 * @param styleVariations  Non-empty filtered variation list.
 * @param ctx       Render context (i18n, callbacks).
 */
export function renderConsultingStylePicker(
  wrapper: HTMLElement,
  grid: HTMLElement,
  source: string,
  styleVariations: StyleVariation[],
  ctx?: ChatUISpecRenderContext,
): void {
  const i18n = mergeConsultingI18n(ctx);
  const initialIndex = firstRenderableVariationIndex(styleVariations);

  const picker = document.createElement('div');
  picker.className = 'gengage-chat-consulting-style-picker';

  const model: ConsultingPickerModel = {
    grid,
    source,
    ctx,
    variations: styleVariations,
    i18n,
    selectedIndex: initialIndex,
  };
  CONSULTING_PICKER_MODEL.set(picker, model);

  const pickerTitle = document.createElement('div');
  pickerTitle.className = 'gengage-chat-consulting-style-picker-title';
  const stylePreparedTemplate =
    source === 'watch_expert' ? i18n.watchStylesPreparedTitle : i18n.beautyStylesPreparedTitle;
  pickerTitle.textContent = stylePreparedTemplate.replace('{count}', String(styleVariations.length));
  picker.appendChild(pickerTitle);

  const pickerGrid = document.createElement('div');
  pickerGrid.className = 'gengage-chat-consulting-style-grid';
  picker.appendChild(pickerGrid);

  styleVariations.forEach((variation, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gengage-chat-consulting-style-btn gds-card';
    if (index === initialIndex) btn.classList.add('gengage-chat-consulting-style-btn--active');
    fillStyleButtonContent(btn, variation, index, i18n);
    wireStyleButtonClick(btn, picker, pickerGrid, index);
    pickerGrid.appendChild(btn);
  });

  wrapper.appendChild(picker);
  renderConsultingVariationContentByIndex(model, initialIndex);
}

/**
 * Apply streaming updates to an existing consulting picker without replacing the
 * whole panel DOM. Returns false if `wrapper` is not a consulting grid shell.
 */
export function patchConsultingStylePickerDom(
  wrapper: HTMLElement,
  source: string,
  styleVariations: StyleVariation[],
  ctx?: ChatUISpecRenderContext,
): boolean {
  const picker = wrapper.querySelector<HTMLElement>('.gengage-chat-consulting-style-picker');
  const grid = findConsultingOuterProductGrid(wrapper);
  if (!picker || !grid) return false;

  const pickerGrid = picker.querySelector<HTMLElement>('.gengage-chat-consulting-style-grid');
  if (!pickerGrid) return false;

  const i18n = mergeConsultingI18n(ctx);
  let model: ConsultingPickerModel | undefined = CONSULTING_PICKER_MODEL.get(picker);
  if (!model) {
    const created: ConsultingPickerModel = {
      grid,
      source,
      ctx,
      variations: styleVariations,
      i18n,
      selectedIndex: firstRenderableVariationIndex(styleVariations),
    };
    CONSULTING_PICKER_MODEL.set(picker, created);
    model = created;
  } else {
    model.grid = grid;
    model.source = source;
    model.ctx = ctx;
    model.variations = styleVariations;
    model.i18n = i18n;
  }

  const titleEl = picker.querySelector<HTMLElement>('.gengage-chat-consulting-style-picker-title');
  if (titleEl) {
    const stylePreparedTemplate =
      source === 'watch_expert' ? i18n.watchStylesPreparedTitle : i18n.beautyStylesPreparedTitle;
    titleEl.textContent = stylePreparedTemplate.replace('{count}', String(styleVariations.length));
  }

  const m = model;
  let selectedIndex = m.selectedIndex;
  if (selectedIndex >= styleVariations.length) {
    selectedIndex = Math.max(0, styleVariations.length - 1);
  }
  if (selectedIndex < 0) selectedIndex = 0;
  // If the active tab became loading (reordered spec), jump to first renderable.
  if (styleVariations.length > 0 && getVariationStatus(styleVariations[selectedIndex] ?? {}) === 'loading') {
    selectedIndex = firstRenderableVariationIndex(styleVariations);
  }
  m.selectedIndex = selectedIndex;

  const buttons = [...pickerGrid.querySelectorAll<HTMLButtonElement>('.gengage-chat-consulting-style-btn')];
  if (buttons.length === 0) return false;

  for (let index = 0; index < styleVariations.length; index += 1) {
    const variation = styleVariations[index]!;
    let btn = buttons[index];
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gengage-chat-consulting-style-btn gds-card';
      fillStyleButtonContent(btn, variation, index, i18n);
      wireStyleButtonClick(btn, picker, pickerGrid, index);
      pickerGrid.appendChild(btn);
      buttons[index] = btn;
    } else {
      fillStyleButtonContent(btn, variation, index, i18n);
    }
  }

  while (pickerGrid.querySelectorAll('.gengage-chat-consulting-style-btn').length > styleVariations.length) {
    pickerGrid.lastElementChild?.remove();
  }

  pickerGrid.querySelectorAll('.gengage-chat-consulting-style-btn').forEach((el, btnIndex) => {
    (el as HTMLElement).classList.toggle('gengage-chat-consulting-style-btn--active', btnIndex === m.selectedIndex);
  });

  renderConsultingVariationContentByIndex(m, m.selectedIndex);
  return true;
}

/** The main product grid under the picker (not nested group grids). */
function findConsultingOuterProductGrid(wrapper: HTMLElement): HTMLElement | null {
  const children = [...wrapper.children];
  for (let i = children.length - 1; i >= 0; i -= 1) {
    const el = children[i] as HTMLElement;
    if (el.classList.contains('gengage-chat-product-grid')) return el;
  }
  return wrapper.querySelector<HTMLElement>(':scope > .gengage-chat-product-grid');
}

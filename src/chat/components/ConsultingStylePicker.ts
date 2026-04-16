/**
 * Consulting Style Picker — renders a tabbed style variation picker
 * for beauty consulting and watch expert flows.
 *
 * Extracted from renderProductGrid() to keep renderUISpec.ts focused
 * on generic component dispatch.
 */

import type { UIElement } from '../../common/types.js';
import type { ChatUISpecRenderContext } from '../types.js';
import { isSafeUrl, safeSetAttribute } from '../../common/safe-html.js';
import { addImageErrorHandler } from '../../common/product-utils.js';
import { renderProductCard } from './renderUISpec.js';

export type StyleVariationProduct = Record<string, unknown>;

export type StyleVariation = {
  style_label?: string;
  style_mood?: string;
  image_url?: string;
  product_list?: StyleVariationProduct[];
  recommendation_groups?: Array<{ label?: string; reason?: string; skus?: string[] }>;
};

/** Normalise a consulting image URL from the backend (absolute or relative). */
export function toConsultingImageUrl(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  const raw = input.trim();
  if (!raw) return undefined;

  // If the backend sends an absolute URL, use it directly.
  if (/^https?:\/\//i.test(raw)) return raw;

  // Relative path fallback for old backends that don't send absolute URLs.
  let path = raw.split(/[?#]/)[0];
  if (!path) return undefined;

  path = path.replace(/^\/+/, '');
  if (path.startsWith('remoteConfig/')) {
    path = path.slice('remoteConfig/'.length);
  }

  if (!path) return undefined;
  return `https://configs.gengage.ai/assets/${path}`;
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
  const picker = document.createElement('div');
  picker.className = 'gengage-chat-consulting-style-picker';

  const pickerTitle = document.createElement('div');
  pickerTitle.className = 'gengage-chat-consulting-style-picker-title';
  const stylePreparedTemplate =
    source === 'watch_expert'
      ? (ctx?.i18n?.watchStylesPreparedTitle ?? 'Prepared {count} style directions for you')
      : (ctx?.i18n?.beautyStylesPreparedTitle ?? 'Prepared {count} beauty styles for you');
  pickerTitle.textContent = stylePreparedTemplate.replace('{count}', String(styleVariations.length));
  picker.appendChild(pickerTitle);

  const pickerGrid = document.createElement('div');
  pickerGrid.className = 'gengage-chat-consulting-style-grid';
  picker.appendChild(pickerGrid);

  const renderVariationProducts = (variation: StyleVariation): void => {
    grid.innerHTML = '';
    const products = Array.isArray(variation.product_list) ? variation.product_list : [];
    const recommendationGroups = Array.isArray(variation.recommendation_groups) ? variation.recommendation_groups : [];

    if (recommendationGroups.length > 0) {
      const productBySku = new Map<string, StyleVariationProduct>();
      for (const product of products) {
        const sku = typeof product?.['sku'] === 'string' ? (product['sku'] as string) : undefined;
        if (sku) productBySku.set(sku, product);
      }

      const renderedSkus = new Set<string>();
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

        const section = document.createElement('section');
        section.className = 'gengage-chat-consulting-group';

        const header = document.createElement('div');
        header.className = 'gengage-chat-consulting-group-header';

        const label = document.createElement('h4');
        label.className = 'gengage-chat-consulting-group-label';
        const labelText = typeof group.label === 'string' && group.label.trim().length > 0 ? group.label : 'Öneri';
        label.textContent = skus.length > 0 ? `${labelText} (${skus.length})` : labelText;
        header.appendChild(label);

        if (typeof group.reason === 'string' && group.reason.trim().length > 0) {
          const reason = document.createElement('p');
          reason.className = 'gengage-chat-consulting-group-reason';
          reason.textContent = group.reason;
          header.appendChild(reason);
        }

        section.appendChild(header);

        const groupGrid = document.createElement('div');
        groupGrid.className = 'gengage-chat-product-grid gengage-chat-consulting-group-grid';
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
      }

      const leftovers = products.filter((product) => {
        const sku = typeof product?.['sku'] === 'string' ? (product['sku'] as string) : '';
        return sku.length > 0 && !renderedSkus.has(sku);
      });
      if (leftovers.length > 0) {
        const fallbackGrid = document.createElement('div');
        fallbackGrid.className = 'gengage-chat-product-grid gengage-chat-consulting-group-grid';
        fallbackGrid.style.setProperty(
          '--consulting-group-columns',
          String(Math.max(1, Math.min(4, leftovers.length))),
        );
        for (const product of leftovers) {
          const cardElement: UIElement = {
            type: 'ProductCard',
            props: { product },
          };
          const card = renderProductCard(
            cardElement,
            ctx ?? ({ onAction: () => undefined } as ChatUISpecRenderContext),
          );
          fallbackGrid.appendChild(card);
        }
        grid.appendChild(fallbackGrid);
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
  };

  let selectedVariationIndex = 0;
  styleVariations.forEach((variation, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gengage-chat-consulting-style-btn gds-card';
    if (index === 0) btn.classList.add('gengage-chat-consulting-style-btn--active');
    btn.setAttribute('aria-label', variation.style_label ?? `Style ${index + 1}`);

    const media = document.createElement('div');
    media.className = 'gengage-chat-consulting-style-media';

    const imageUrl = toConsultingImageUrl(variation.image_url);
    if (imageUrl && isSafeUrl(imageUrl)) {
      const img = document.createElement('img');
      img.className = 'gengage-chat-consulting-style-image';
      safeSetAttribute(img, 'src', imageUrl);
      img.alt = variation.style_label ?? `Style ${index + 1}`;
      img.loading = 'lazy';
      addImageErrorHandler(img);
      media.appendChild(img);
    }

    const caption = document.createElement('span');
    caption.className = 'gengage-chat-consulting-style-caption';
    caption.textContent = variation.style_label ?? `Style ${index + 1}`;
    media.appendChild(caption);
    btn.appendChild(media);

    btn.addEventListener('click', () => {
      if (selectedVariationIndex === index) return;
      selectedVariationIndex = index;
      pickerGrid
        .querySelectorAll('.gengage-chat-consulting-style-btn')
        .forEach((el, btnIndex) =>
          (el as HTMLElement).classList.toggle('gengage-chat-consulting-style-btn--active', btnIndex === index),
        );
      renderVariationProducts(variation);
    });
    pickerGrid.appendChild(btn);
  });

  wrapper.appendChild(picker);
  renderVariationProducts(styleVariations[0] ?? {});
}

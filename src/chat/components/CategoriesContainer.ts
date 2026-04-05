/**
 * CategoriesContainer — renders grouped product lists with tab navigation
 * and optional filter tags.
 *
 * Backend sends `groupList` with `{ group_list: [{ group_name, product_list }], filter_tags }`.
 * The protocol adapter normalizes this into a CategoriesContainer UISpec element.
 *
 * XSS safety: All text is set via textContent. No innerHTML.
 */

import type { UIElement } from '../../common/types.js';
import type { ChatUISpecRenderContext } from '../types.js';
import type { NormalizedProduct } from '../../common/protocol-adapter.js';
import { isSafeImageUrl } from '../../common/safe-html.js';
import { formatPrice } from '../../common/price-formatter.js';
import { addImageErrorHandler } from '../../common/product-utils.js';

interface GroupData {
  groupName: string;
  products: NormalizedProduct[];
}

interface FilterTagData {
  title: string;
  action?: { title: string; type: string; payload?: unknown };
}

export function renderCategoriesContainer(element: UIElement, context: ChatUISpecRenderContext): HTMLElement {
  const groups = (element.props?.['groups'] as GroupData[] | undefined) ?? [];
  const filterTags = (element.props?.['filterTags'] as FilterTagData[] | undefined) ?? [];

  const container = document.createElement('div');
  container.className = 'gengage-chat-categories';
  container.dataset['gengagePart'] = 'categories-container';

  if (groups.length === 0) return container;

  // Tab bar — WAI-ARIA tablist pattern
  const tabBar = document.createElement('div');
  tabBar.className = 'gengage-chat-categories-tabs gds-toolbar';
  tabBar.dataset['gengagePart'] = 'categories-tab-bar';
  tabBar.setAttribute('role', 'tablist');

  const tabs: HTMLButtonElement[] = [];
  const panels: HTMLElement[] = [];

  const activateTab = (index: number): void => {
    for (let j = 0; j < tabs.length; j++) {
      const isActive = j === index;
      tabs[j]!.classList.toggle('gengage-chat-categories-tab--active', isActive);
      tabs[j]!.classList.toggle('is-active', isActive);
      tabs[j]!.setAttribute('aria-selected', String(isActive));
      tabs[j]!.tabIndex = isActive ? 0 : -1;
      panels[j]!.style.display = isActive ? '' : 'none';
    }
  };

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i]!;
    const tabId = `gengage-cat-tab-${i}`;
    const panelId = `gengage-cat-panel-${i}`;

    // Tab button
    const tab = document.createElement('button');
    tab.className = 'gengage-chat-categories-tab gds-tab';
    tab.type = 'button';
    tab.dataset['gengagePart'] = 'categories-tab';
    tab.id = tabId;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panelId);
    tab.setAttribute('aria-selected', String(i === 0));
    tab.tabIndex = i === 0 ? 0 : -1;
    if (i === 0) tab.classList.add('gengage-chat-categories-tab--active', 'is-active');
    tab.textContent = group.groupName;

    tab.addEventListener('click', () => activateTab(i));
    tab.addEventListener('keydown', (e: KeyboardEvent) => {
      let next = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        next = (i + 1) % groups.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        next = (i - 1 + groups.length) % groups.length;
      } else if (e.key === 'Home') {
        next = 0;
      } else if (e.key === 'End') {
        next = groups.length - 1;
      }
      if (next >= 0) {
        e.preventDefault();
        activateTab(next);
        tabs[next]!.focus();
      }
    });

    tabs.push(tab);
    tabBar.appendChild(tab);

    // Product grid panel
    const panel = document.createElement('div');
    panel.className = 'gengage-chat-categories-grid';
    panel.dataset['gengagePart'] = 'categories-panel';
    panel.id = panelId;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tabId);
    if (i !== 0) panel.style.display = 'none';

    for (const product of group.products) {
      const card = renderCategoryProductCard(product, context);
      panel.appendChild(card);
    }

    panels.push(panel);
  }

  container.appendChild(tabBar);
  for (const panel of panels) container.appendChild(panel);

  // Filter tags
  if (filterTags.length > 0) {
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'gengage-chat-categories-filter-tags gds-toolbar';
    tagsContainer.dataset['gengagePart'] = 'categories-filter-tags';

    for (const tag of filterTags) {
      const tagBtn = document.createElement('button');
      tagBtn.className = 'gengage-chat-categories-filter-tag gds-chip';
      tagBtn.type = 'button';
      tagBtn.dataset['gengagePart'] = 'categories-filter-tag';
      tagBtn.textContent = tag.title;
      if (tag.action) {
        tagBtn.addEventListener('click', () => {
          context.onAction(tag.action!);
        });
      }
      tagsContainer.appendChild(tagBtn);
    }

    container.appendChild(tagsContainer);
  }

  return container;
}

function renderCategoryProductCard(product: NormalizedProduct, ctx: ChatUISpecRenderContext): HTMLElement {
  const card = document.createElement('div');
  card.className = 'gengage-chat-product-card gds-card gds-product-card gds-card-interactive';
  card.dataset['gengagePart'] = 'categories-product-card';

  if (product.imageUrl && isSafeImageUrl(product.imageUrl)) {
    const img = document.createElement('img');
    img.className = 'gengage-chat-product-card-img';
    img.src = product.imageUrl;
    img.alt = product.name;
    img.loading = 'lazy';
    addImageErrorHandler(img);
    card.appendChild(img);
  }

  const body = document.createElement('div');
  body.className = 'gengage-chat-product-card-body';

  const nameEl = document.createElement('div');
  nameEl.className = 'gengage-chat-product-card-name';
  nameEl.textContent = product.name;
  body.appendChild(nameEl);

  if (product.price) {
    const priceEl = document.createElement('div');
    priceEl.className = 'gengage-chat-product-card-price';
    priceEl.textContent = formatPrice(product.price, ctx.pricing);
    body.appendChild(priceEl);
  }

  card.appendChild(body);

  // Click → show product details
  if (ctx.onProductSelect || ctx.onAction) {
    card.classList.add('gds-clickable');
    card.addEventListener('click', () => {
      if (product.sku) {
        ctx.onAction({
          title: product.name,
          type: 'launchSingleProduct',
          payload: { sku: product.sku },
        });
        return;
      }
      ctx.onProductSelect?.(product as unknown as Record<string, unknown>);
    });
  }

  return card;
}

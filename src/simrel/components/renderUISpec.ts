import { renderUISpecWithRegistry } from '../../common/renderer/index.js';
import type { UISpecDomRegistry, UISpecDomUnknownRenderer } from '../../common/renderer/index.js';
import type { UISpec, ActionPayload } from '../../common/types.js';
import type { SimRelUISpecRenderContext, SimilarProduct } from '../types.js';
import type { ProductGroup } from '../api.js';
import { renderProductCard } from './ProductCard.js';
import { renderGroupTabs } from './GroupTabs.js';

export type SimRelUISpecRegistry = UISpecDomRegistry<SimRelUISpecRenderContext>;

function toSimRelProduct(raw: unknown): SimilarProduct | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj['sku'] !== 'string' || typeof obj['name'] !== 'string' || typeof obj['url'] !== 'string') {
    return null;
  }

  const result: SimilarProduct = {
    sku: obj['sku'],
    name: obj['name'],
    url: obj['url'],
  };

  const imageUrl = obj['imageUrl'];
  if (typeof imageUrl === 'string') result.imageUrl = imageUrl;
  const price = obj['price'];
  if (typeof price === 'string') result.price = price;
  const originalPrice = obj['originalPrice'];
  if (typeof originalPrice === 'string') result.originalPrice = originalPrice;
  const discountPercent = obj['discountPercent'];
  if (typeof discountPercent === 'number') result.discountPercent = discountPercent;
  const brand = obj['brand'];
  if (typeof brand === 'string') result.brand = brand;
  const rating = obj['rating'];
  if (typeof rating === 'number') result.rating = rating;
  const reviewCount = obj['reviewCount'];
  if (typeof reviewCount === 'number') result.reviewCount = reviewCount;
  const cartCode = obj['cartCode'];
  if (typeof cartCode === 'string') result.cartCode = cartCode;
  const inStock = obj['inStock'];
  if (typeof inStock === 'boolean') result.inStock = inStock;
  const extras = obj['extras'];
  if (extras != null && typeof extras === 'object') result.extras = extras as Record<string, unknown>;

  return result;
}

function toActionPayload(raw: unknown): ActionPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const title = obj['title'];
  const type = obj['type'];
  if (typeof title !== 'string' || typeof type !== 'string') return null;
  const action: ActionPayload = { title, type };
  if (obj['payload'] !== undefined) action.payload = obj['payload'];
  return action;
}

const DEFAULT_SIMREL_UI_SPEC_REGISTRY: SimRelUISpecRegistry = {
  ProductGrid: ({ element, renderElement, context }) => {
    const grid = document.createElement('div');
    grid.className = 'gengage-simrel-grid';
    grid.setAttribute('role', 'list');

    const propCols = element.props?.['columns'];
    let columns: number | undefined;
    if (typeof propCols === 'number' && Number.isFinite(propCols) && propCols > 0) {
      columns = Math.floor(propCols);
    } else if (
      typeof context.gridColumns === 'number' &&
      Number.isFinite(context.gridColumns) &&
      context.gridColumns > 0
    ) {
      columns = Math.floor(context.gridColumns);
    }
    if (columns !== undefined) {
      grid.style.setProperty('--gengage-simrel-columns', String(columns));
    }

    for (const childId of element.children ?? []) {
      const rendered = renderElement(childId);
      if (rendered) grid.appendChild(rendered);
    }

    if (grid.children.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'gengage-simrel-empty';
      empty.textContent = context.i18n.emptyStateMessage;
      grid.appendChild(empty);
    }

    return grid;
  },

  ProductCard: ({ element, context }) => {
    const productRaw = (element.props?.['product'] ?? element.props) as unknown;
    const product = toSimRelProduct(productRaw);
    if (!product) return null;

    const indexRaw = element.props?.['index'];
    const index = typeof indexRaw === 'number' && Number.isFinite(indexRaw) ? indexRaw : 0;
    const discountTypeRaw = element.props?.['discountType'];
    const discountType =
      discountTypeRaw === 'strike-through' || discountTypeRaw === 'badge' ? discountTypeRaw : context.discountType;

    const options: import('./ProductCard.js').ProductCardOptions = {
      product,
      index,
      onClick: context.onClick,
      onAddToCart: context.onAddToCart,
      i18n: context.i18n,
    };
    if (discountType !== undefined) options.discountType = discountType;
    if (context.renderCard !== undefined) options.renderCard = context.renderCard;
    if (context.renderCardElement !== undefined) options.renderCardElement = context.renderCardElement;
    if (context.pricing !== undefined) options.pricing = context.pricing;
    return renderProductCard(options);
  },

  GroupTabs: ({ element, context }) => {
    const groupsRaw = element.props?.['groups'];
    if (!Array.isArray(groupsRaw)) return null;
    const groups: ProductGroup[] = [];

    for (const entry of groupsRaw) {
      if (!entry || typeof entry !== 'object') continue;
      const obj = entry as Record<string, unknown>;
      if (typeof obj['name'] !== 'string') continue;

      const products: SimilarProduct[] = [];
      if (Array.isArray(obj['products'])) {
        for (const rawProduct of obj['products']) {
          const normalized = toSimRelProduct(rawProduct);
          if (normalized) products.push(normalized);
        }
      }

      const group: ProductGroup = {
        name: obj['name'],
        products,
      };
      if (typeof obj['highlight'] === 'string') group.highlight = obj['highlight'];
      groups.push(group);
    }

    const options: import('./GroupTabs.js').GroupTabsOptions = {
      groups,
      onClick: context.onClick,
      onAddToCart: context.onAddToCart,
      i18n: context.i18n,
    };
    const tabGridCols = element.props?.['columns'];
    if (typeof tabGridCols === 'number' && Number.isFinite(tabGridCols) && tabGridCols > 0) {
      options.columns = Math.floor(tabGridCols);
    } else if (
      typeof context.gridColumns === 'number' &&
      Number.isFinite(context.gridColumns) &&
      context.gridColumns > 0
    ) {
      options.columns = Math.floor(context.gridColumns);
    }
    if (context.discountType !== undefined) options.discountType = context.discountType;
    if (context.renderCard !== undefined) options.renderCard = context.renderCard;
    if (context.renderCardElement !== undefined) options.renderCardElement = context.renderCardElement;
    return renderGroupTabs(options);
  },

  EmptyState: ({ element, context }) => {
    const empty = document.createElement('div');
    empty.className = 'gengage-simrel-empty';
    const message = element.props?.['message'];
    empty.textContent = typeof message === 'string' ? message : context.i18n.emptyStateMessage;
    return empty;
  },

  AddToCartButton: ({ element, context }) => {
    const sku = element.props?.['sku'];
    const cartCode = element.props?.['cartCode'];
    if (typeof sku !== 'string' || typeof cartCode !== 'string') return null;

    const button = document.createElement('button');
    button.className = 'gengage-simrel-atc gengage-chat-product-card-cta';
    button.type = 'button';
    const label = element.props?.['label'];
    button.textContent = typeof label === 'string' ? label : context.i18n.addToCartButton;
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      context.onAddToCart({ sku, quantity: 1, cartCode });
    });
    return button;
  },

  QuickActions: ({ element, context }) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'gengage-simrel-quick-actions';
    const actions = element.props?.['actions'];
    if (!Array.isArray(actions) || !context.onAction) return wrapper;

    for (const raw of actions) {
      if (!raw || typeof raw !== 'object') continue;
      const actionObj = raw as Record<string, unknown>;
      const label = actionObj['label'];
      const action = toActionPayload(actionObj['action']);
      if (typeof label !== 'string' || !action) continue;

      const button = document.createElement('button');
      button.className = 'gengage-simrel-quick-action';
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        context.onAction?.(action);
      });
      wrapper.appendChild(button);
    }
    return wrapper;
  },
};

export const defaultSimRelUnknownUISpecRenderer: UISpecDomUnknownRenderer<SimRelUISpecRenderContext> = ({
  element,
  renderElement,
}) => {
  if (import.meta.env?.DEV) {
    console.warn(`[gengage:simrel] Unknown ui_spec component type: ${element.type}`);
  }
  if (!element.children || element.children.length === 0) {
    return null;
  }
  const wrapper = document.createElement('div');
  for (const childId of element.children) {
    const rendered = renderElement(childId);
    if (rendered) wrapper.appendChild(rendered);
  }
  return wrapper;
};

export function createDefaultSimRelUISpecRegistry(): SimRelUISpecRegistry {
  return { ...DEFAULT_SIMREL_UI_SPEC_REGISTRY };
}

export function renderSimRelUISpec(
  spec: UISpec,
  context: SimRelUISpecRenderContext,
  registry = DEFAULT_SIMREL_UI_SPEC_REGISTRY,
  unknownRenderer: UISpecDomUnknownRenderer<SimRelUISpecRenderContext> = defaultSimRelUnknownUISpecRenderer,
): HTMLElement {
  return renderUISpecWithRegistry({
    spec,
    context,
    registry,
    containerClassName: 'gengage-simrel-uispec',
    unknownRenderer,
  });
}

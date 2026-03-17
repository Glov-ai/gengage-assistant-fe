import type { BaseWidgetConfig, ActionPayload } from '../common/types.js';
import type { UISpecRendererOverrides } from '../common/renderer/index.js';

export interface SimRelWidgetConfig extends BaseWidgetConfig {
  /** Product SKU to find similar items for. Required. */
  sku: string;

  /** Where to render the product grid. Required. */
  mountTarget: HTMLElement | string;

  // -------------------------------------------------------------------------
  // E-commerce callbacks
  // -------------------------------------------------------------------------

  /** Called when "Add to cart" is tapped on a product card. */
  onAddToCart?: (params: { sku: string; quantity: number; cartCode: string }) => void;

  /**
   * Called when the user taps a product card (navigation intent).
   * Return false to prevent the widget's default navigation.
   */
  onProductClick?: (product: SimilarProduct) => boolean | void;

  /**
   * Called just before navigating to a product page.
   * Use to call window.gengage.chat.saveSession() for cross-page session continuity.
   */
  onProductNavigate?: (url: string, sku: string, sessionId: string | null) => void;

  /** Forwarded to your analytics layer. */
  onAnalyticsEvent?: (event: string, data: Record<string, unknown>) => void;

  // -------------------------------------------------------------------------
  // Card customisation
  // -------------------------------------------------------------------------

  /**
   * Override the default product card template.
   *
   * ⚠️ XSS WARNING: This function returns a raw HTML string injected into the DOM.
   * You MUST sanitize any user-controlled data (e.g. product names from the API)
   * using DOMPurify or a similar library before returning.
   *
   * Glov/Gengage accepts no responsibility for XSS vulnerabilities introduced
   * by unsafe renderCard implementations.
   */
  renderCard?: (product: SimilarProduct, index: number) => string;

  /**
   * Override the default product card with a full DOM element.
   * Unlike `renderCard` (HTML string), this returns an HTMLElement,
   * allowing interactive elements (event listeners, state, etc.).
   * Takes precedence over `renderCard` when both are provided.
   */
  renderCardElement?: (product: SimilarProduct, index: number) => HTMLElement | null;

  /** Show the first slot as a "special" card (e.g. a promo or bundle). */
  useSpecialCard?: boolean;
  renderSpecialCard?: (product: SimilarProduct) => string | null;

  discountType?: 'strike-through' | 'badge';
  domain?: string;
  /** Locale key for SDK defaults (for example 'tr', 'en'). */
  locale?: string;
  i18n?: Partial<SimRelI18n>;
  renderer?: SimRelRendererConfig;
}

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export interface SimilarProduct {
  sku: string;
  name: string;
  imageUrl?: string;
  price?: string;
  originalPrice?: string;
  discountPercent?: number;
  url: string;
  brand?: string;
  rating?: number;
  reviewCount?: number;
  cartCode?: string;
  inStock?: boolean;
  /** Pass-through bag for backend fields not consumed by the SDK. */
  extras?: Record<string, unknown>;
}

export interface SimRelI18n {
  similarProductsAriaLabel: string;
  emptyStateMessage: string;
  addToCartButton: string;
  ctaLabel: string;
  outOfStockLabel: string;
  decreaseLabel: string;
  increaseLabel: string;
  /** Inline error message shown when similar products fail to load. */
  errorLoadingMessage: string;
  /** Retry button label shown alongside the error message. */
  retryButtonText: string;
  /**
   * @deprecated Prefer `pricing` config on the widget for locale-aware formatting.
   * Kept for backwards compatibility with existing custom integrations.
   */
  priceSuffix: string;
}

export interface SimRelUISpecRenderContext {
  onClick: (product: SimilarProduct) => void;
  onAddToCart: (params: { sku: string; quantity: number; cartCode: string }) => void;
  onAction?: (action: ActionPayload) => void;
  discountType?: 'strike-through' | 'badge';
  renderCard?: (product: SimilarProduct, index: number) => string;
  renderCardElement?: (product: SimilarProduct, index: number) => HTMLElement | null;
  i18n: SimRelI18n;
  pricing?: import('../common/price-formatter.js').PriceFormatConfig;
}

export type SimRelRendererConfig = UISpecRendererOverrides<SimRelUISpecRenderContext>;

// ---------------------------------------------------------------------------
// json-render component types for SimRel
// ---------------------------------------------------------------------------

export interface SimRelUIComponents {
  /** The outer grid/carousel container. */
  ProductGrid: {
    layout?: 'grid' | 'carousel';
    columns?: number;
  };

  /** A single product card in the grid. */
  ProductCard: {
    product: SimilarProduct;
    index: number;
    discountType?: 'strike-through' | 'badge';
  };

  /** Add-to-cart button inside a card. */
  AddToCartButton: {
    sku: string;
    label?: string;
    /** Cart code / variant identifier. */
    cartCode: string;
  };

  /** A "quick action" row of buttons below the product info. */
  QuickActions: {
    actions: Array<{ label: string; action: ActionPayload }>;
  };

  /** Empty state shown when no similar products are found. */
  EmptyState: {
    message?: string;
  };
}

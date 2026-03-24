/**
 * Similar Products (SimRel) widget — public entry point.
 *
 * Fetches and renders similar / related products for the current SKU.
 * Backend: POST /chat/similar_products  +  /chat/product_groupings
 */

import type { PageContext, UISpec, UIElement } from '../common/types.js';
import type { NormalizedProduct } from '../common/protocol-adapter.js';
import type { ChatTransportConfig } from '../common/api-paths.js';
import type { UISpecRenderHelpers } from '../common/renderer/index.js';
import { mergeUISpecRegistry } from '../common/renderer/index.js';
import { BaseWidget } from '../common/widget-base.js';
import { dispatch } from '../common/events.js';
import { getGlobalErrorMessage } from '../common/global-error-toast.js';
import {
  streamStartEvent,
  streamDoneEvent,
  streamErrorEvent,
  basketAddEvent,
  widgetHistorySnapshotEvent,
} from '../common/analytics-events.js';
import { fetchSimilarProducts, fetchProductGroupings } from './api.js';
import {
  createDefaultSimRelUISpecRegistry,
  defaultSimRelUnknownUISpecRenderer,
  renderSimRelUISpec,
} from './components/renderUISpec.js';
import type { SimRelWidgetConfig, SimilarProduct, SimRelI18n, SimRelUISpecRenderContext } from './types.js';
import { SIMREL_I18N_TR, resolveSimRelLocale } from './locales/index.js';
import * as ga from '../common/ga-datalayer.js';

import './components/simrel.css';

/**
 * Similar / related products widget for product pages.
 * Fetches AI-powered product recommendations and renders them as a scrollable grid.
 *
 * @example
 * ```ts
 * import { GengageSimRel, bootstrapSession } from '@gengage/assistant-fe';
 *
 * const simrel = new GengageSimRel();
 * await simrel.init({
 *   accountId: 'mystore',
 *   middlewareUrl: 'https://chat.gengage.ai',
 *   sku: '12345',
 *   mountTarget: '#similar-products',
 *   session: { sessionId: bootstrapSession() },
 *   onAddToCart: ({ sku, quantity }) => cart.add(sku, quantity),
 * });
 * ```
 */
export class GengageSimRel extends BaseWidget<SimRelWidgetConfig> {
  private _abortController: AbortController | null = null;
  private _contentEl: HTMLElement | null = null;
  private _lastSku: string | undefined;
  private _i18n: SimRelI18n = SIMREL_I18N_TR;

  protected async onInit(config: SimRelWidgetConfig): Promise<void> {
    this._i18n = this._resolveI18n(config);

    this._contentEl = document.createElement('div');
    this._contentEl.className = 'gengage-simrel-container';
    this.root.appendChild(this._contentEl);

    this._lastSku = config.sku;
    await this._fetchAndRender(config.sku);
    ga.trackInit('simrel');
  }

  protected onUpdate(context: Partial<PageContext>): void {
    const newSku = context.sku;
    if (!newSku || newSku === this._lastSku) return;
    this._lastSku = newSku;
    void this._fetchAndRender(newSku);
  }

  protected onShow(): void {
    if (this._contentEl) {
      this._contentEl.style.opacity = '0';
      this._contentEl.style.transition = 'opacity 0.3s ease-in';
      requestAnimationFrame(() => {
        if (this._contentEl) this._contentEl.style.opacity = '1';
      });
    }
  }

  protected onHide(): void {
    // Preserve fetched products for re-show
  }

  protected onDestroy(): void {
    this._abort();
    if (this._contentEl) {
      this._contentEl.remove();
      this._contentEl = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Internal event dispatchers
  // ---------------------------------------------------------------------------

  _handleProductClick(product: NormalizedProduct): void {
    const simRelProduct: SimilarProduct = {
      sku: product.sku,
      name: product.name,
      url: product.url,
    };
    if (product.imageUrl !== undefined) simRelProduct.imageUrl = product.imageUrl;
    if (product.price !== undefined) simRelProduct.price = product.price;
    if (product.originalPrice !== undefined) simRelProduct.originalPrice = product.originalPrice;
    if (product.discountPercent !== undefined) simRelProduct.discountPercent = product.discountPercent;
    if (product.brand !== undefined) simRelProduct.brand = product.brand;
    if (product.rating !== undefined) simRelProduct.rating = product.rating;
    if (product.reviewCount !== undefined) simRelProduct.reviewCount = product.reviewCount;
    if (product.cartCode !== undefined) simRelProduct.cartCode = product.cartCode;
    if (product.inStock !== undefined) simRelProduct.inStock = product.inStock;

    if (this.config.onProductClick?.(simRelProduct) === false) return;

    ga.trackProductDetail(product.sku, product.name);
    const sessionId = this.config.session?.sessionId ?? null;
    dispatch('gengage:similar:product-click', {
      sku: product.sku,
      url: product.url,
      sessionId,
    });

    this.config.onProductNavigate?.(product.url, product.sku, sessionId);
  }

  _handleAddToCart(params: { sku: string; quantity: number; cartCode: string }): void {
    ga.trackCartAdd(params.sku, params.quantity);
    this.config.onAddToCart?.(params);
    dispatch('gengage:similar:add-to-cart', params);

    this.track(
      basketAddEvent(this.analyticsContext(), {
        attribution_source: 'simrel',
        attribution_action_id: crypto.randomUUID(),
        cart_value: 0, // Host page should enrich via event listener
        currency: 'TRY',
        line_items: params.quantity,
        sku: params.sku,
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private _abort(): void {
    this._abortController?.abort();
    this._abortController = null;
  }

  private async _fetchAndRender(sku: string): Promise<void> {
    this._abort();
    this._abortController = new AbortController();
    // Capture signal reference at invocation time to avoid race conditions:
    // if onUpdate fires between awaits, `this._abortController` gets swapped
    // but `signal` still refers to this invocation's controller.
    const signal = this._abortController.signal;
    // Auto-abort after 10s to prevent indefinite loading state
    const timeoutId = setTimeout(() => this._abortController?.abort(), 10_000);
    signal.addEventListener('abort', () => clearTimeout(timeoutId));

    if (!this._contentEl) return;
    this._contentEl.innerHTML = '';
    // Reset visibility in case a previous error set display:none
    this._contentEl.style.display = '';

    // Show loading spinner
    const loading = document.createElement('div');
    loading.className = 'gengage-simrel-loading';
    const spinner = document.createElement('div');
    spinner.className = 'gengage-simrel-spinner';
    loading.appendChild(spinner);
    this._contentEl.appendChild(loading);

    const transport: ChatTransportConfig = {
      middlewareUrl: this.config.middlewareUrl,
    };

    const requestId = crypto.randomUUID();
    const fetchStart = Date.now();

    this.track(
      streamStartEvent(this.analyticsContext(), {
        endpoint: 'similar_products',
        request_id: requestId,
        widget: 'simrel',
      }),
    );

    try {
      // Fetch similar products
      const simReq: import('./api.js').SimilarProductsRequest = {
        account_id: this.config.accountId,
        session_id: this.config.session?.sessionId ?? '',
        correlation_id: this.config.session?.sessionId ?? '',
        sku,
      };
      if (this.config.domain !== undefined) simReq.domain = this.config.domain;
      const products = await fetchSimilarProducts(simReq, transport, signal);

      if (!this._contentEl) return;
      this._contentEl.innerHTML = '';

      // Try to fetch product groupings for tabbed view
      if (products.length > 0) {
        try {
          const skus = products.map((p) => p.sku);
          const groups = await fetchProductGroupings(
            {
              account_id: this.config.accountId,
              session_id: this.config.session?.sessionId ?? '',
              correlation_id: this.config.session?.sessionId ?? '',
              skus,
            },
            transport,
            signal,
          );

          if (groups.length > 0 && this._contentEl) {
            const groupsSpec = this._buildGroupsSpec(groups);
            const renderedGroups = this._renderUISpec(groupsSpec);
            this._contentEl.appendChild(renderedGroups);

            ga.trackShow('simrel');
            this.track(
              streamDoneEvent(this.analyticsContext(), {
                request_id: requestId,
                latency_ms: Date.now() - fetchStart,
                chunk_count: groups.reduce((n, g) => n + g.products.length, 0),
                widget: 'simrel',
              }),
            );
            this.track(
              widgetHistorySnapshotEvent(this.analyticsContext(), {
                message_count: groups.reduce((n, g) => n + g.products.length, 0),
                history_ref: requestId,
                redaction_level: 'none',
                widget: 'simrel',
              }),
            );
            return;
          }
        } catch {
          // Product groupings is optional; fall through to flat grid
        }
      }

      // If aborted (new SKU fetch started), bail out — new invocation owns _contentEl
      if (signal.aborted) return;

      // Flat grid (no groupings or groupings failed)
      if (this._contentEl) {
        const gridSpec = this._buildProductsSpec(products);
        const renderedGrid = this._renderUISpec(gridSpec);
        this._contentEl.appendChild(renderedGrid);
      }

      if (products.length > 0) {
        ga.trackShow('simrel');
      }

      this.track(
        streamDoneEvent(this.analyticsContext(), {
          request_id: requestId,
          latency_ms: Date.now() - fetchStart,
          chunk_count: products.length,
          widget: 'simrel',
        }),
      );

      this.track(
        widgetHistorySnapshotEvent(this.analyticsContext(), {
          message_count: products.length,
          history_ref: requestId,
          redaction_level: 'none',
          widget: 'simrel',
        }),
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;

      dispatch('gengage:global:error', {
        source: 'simrel',
        code: 'FETCH_ERROR',
        message: getGlobalErrorMessage(this.config.locale),
      });

      this.track(
        streamErrorEvent(this.analyticsContext(), {
          request_id: requestId,
          error_code: 'FETCH_ERROR',
          error_message: err instanceof Error ? err.message : String(err),
          widget: 'simrel',
        }),
      );

      if (import.meta.env?.DEV) {
        console.error('[gengage:simrel] Failed to fetch similar products:', err);
      }
      // Show inline error with retry instead of hiding silently
      if (this._contentEl) {
        this._contentEl.innerHTML = '';
        const errorEl = document.createElement('div');
        errorEl.className = 'gengage-simrel-error';
        const msgEl = document.createElement('span');
        msgEl.textContent = this._i18n.errorLoadingMessage;
        errorEl.appendChild(msgEl);
        const retryBtn = document.createElement('button');
        retryBtn.className = 'gengage-simrel-retry';
        retryBtn.textContent = this._i18n.retryButtonText;
        retryBtn.addEventListener('click', () => {
          void this._fetchAndRender(this.config.sku);
        });
        errorEl.appendChild(retryBtn);
        this._contentEl.appendChild(errorEl);
      }
    }
  }

  private _resolveI18n(config: SimRelWidgetConfig): SimRelI18n {
    const base = resolveSimRelLocale(config.locale);
    return { ...base, ...config.i18n };
  }

  private _resolveUISpecRegistry() {
    const baseRegistry = createDefaultSimRelUISpecRegistry();
    return mergeUISpecRegistry(baseRegistry, this.config.renderer?.registry);
  }

  private _buildRenderContext(): SimRelUISpecRenderContext {
    const renderCard = this.config.renderCard as ((product: SimilarProduct, index: number) => string) | undefined;
    const context: SimRelUISpecRenderContext = {
      onClick: (product) => this._handleProductClick(product as unknown as NormalizedProduct),
      onAddToCart: (params) => this._handleAddToCart(params),
      i18n: this._i18n,
    };
    if (this.config.discountType !== undefined) context.discountType = this.config.discountType;
    if (renderCard !== undefined) context.renderCard = renderCard;
    if (this.config.renderCardElement !== undefined) {
      context.renderCardElement = this.config.renderCardElement as (
        product: SimilarProduct,
        index: number,
      ) => HTMLElement | null;
    }
    if (this.config.pricing !== undefined) context.pricing = this.config.pricing;
    return context;
  }

  private _renderUISpec(spec: UISpec): HTMLElement {
    const registry = this._resolveUISpecRegistry();
    const context = this._buildRenderContext();
    const unknownRenderer = this.config.renderer?.unknownRenderer ?? defaultSimRelUnknownUISpecRenderer;
    const defaultRender = (inputSpec: UISpec, inputContext: SimRelUISpecRenderContext) =>
      renderSimRelUISpec(inputSpec, inputContext, registry, unknownRenderer);

    const override = this.config.renderer?.renderUISpec;
    if (!override) return defaultRender(spec, context);

    const helpers: UISpecRenderHelpers<SimRelUISpecRenderContext> = {
      registry,
      unknownRenderer,
      defaultRender,
    };
    return override(spec, context, helpers);
  }

  private _buildProductsSpec(products: NormalizedProduct[]): UISpec {
    const elements: Record<string, UIElement> = {};
    const children: string[] = [];
    for (let i = 0; i < products.length; i++) {
      const product = products[i]!;
      const id = `product-${i}`;
      children.push(id);
      elements[id] = {
        type: 'ProductCard',
        props: {
          product,
          index: i,
          discountType: this.config.discountType,
        },
      };
    }
    elements['root'] = {
      type: 'ProductGrid',
      props: {
        layout: 'grid',
      },
      children,
    };
    return {
      root: 'root',
      elements,
    };
  }

  private _buildGroupsSpec(
    groups: Array<{
      name: string;
      highlight?: string;
      products: NormalizedProduct[];
    }>,
  ): UISpec {
    return {
      root: 'root',
      elements: {
        root: {
          type: 'GroupTabs',
          props: { groups },
        },
      },
    };
  }
}

export function createSimRelWidget(): GengageSimRel {
  return new GengageSimRel();
}

export type {
  SimRelWidgetConfig,
  SimilarProduct,
  SimRelUIComponents,
  SimRelI18n,
  SimRelUISpecRenderContext,
  SimRelRendererConfig,
} from './types.js';
export {
  renderSimRelUISpec,
  createDefaultSimRelUISpecRegistry,
  defaultSimRelUnknownUISpecRenderer,
} from './components/renderUISpec.js';
export type { SimRelUISpecRegistry } from './components/renderUISpec.js';
export { simRelCatalog } from './catalog.js';
export type { SimRelCatalog, SimRelComponentName } from './catalog.js';

/**
 * Core shared types for all Gengage widgets.
 *
 * These types define the public contract between:
 *   - The host page and widgets (PageContext, WidgetConfig)
 *   - The backend wire protocol and widgets (StreamEvent, UISpec)
 *   - Widgets and each other (GengageEvent, SessionContext)
 */

// ---------------------------------------------------------------------------
// Page context — what the host page tells the widgets about the current page
// ---------------------------------------------------------------------------

/**
 * Describes the current page's context.
 * Widgets use this to tailor their behaviour (e.g. show/hide, fetch the right SKU).
 *
 * CSR/SPA: call widget.update(context) on every navigation.
 * SSR: set window.gengage.pageContext before loading widget scripts.
 */
export interface PageContext {
  /** The current page type. Determines which features activate. */
  pageType: 'pdp' | 'plp' | 'home' | 'cart' | 'search' | 'other';

  /** Product SKU — required on PDP pages for QNA and Similar Products. */
  sku?: string;

  /** Product price, formatted as a string (e.g. "149.99"). */
  price?: string;

  /** Category path array, from broad to specific (e.g. ["Electronics", "TVs"]). */
  categoryTree?: string[];

  /** Raw page URL (defaults to window.location.href). */
  url?: string;

  /**
   * Arbitrary key/value metadata the host page wants to pass through to the
   * backend for analytics or personalisation purposes.
   */
  extra?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Session — shared across all widgets on the same page/tab
// ---------------------------------------------------------------------------

export interface SessionContext {
  /**
   * A UUID created once per browser session, shared across all widgets.
   * Used as correlation_id in analytics and backend logging.
   *
   * Bootstrap:
   *   window.__gengageSessionId =
   *     window.__gengageSessionId
   *     ?? sessionStorage.getItem('gengage_session_id')
   *     ?? crypto.randomUUID();
   *   sessionStorage.setItem('gengage_session_id', window.__gengageSessionId);
   */
  sessionId: string;

  /** Opaque user identifier set by the host site's auth system. */
  userId?: string;

  /** View/visit identifier (e.g. from analytics platform). */
  viewId?: string;

  /** AB test variant assignment (e.g. 'control', 'treatment'). */
  abTestVariant?: string;

  /** AB test experiment identifier (e.g. 'exp_chat_v2'). */
  abTestExperimentId?: string;
}

// ---------------------------------------------------------------------------
// Base widget config — every widget extends this
// ---------------------------------------------------------------------------

export interface BaseWidgetConfig {
  /** Your Gengage account identifier. */
  accountId: string;

  /** Backend middleware URL — must be explicitly provided, no default. */
  middlewareUrl: string;

  /** Session context for analytics correlation. */
  session?: SessionContext;

  /** Initial page context. Can be updated later via widget.update(). */
  pageContext?: PageContext;

  /** Where to mount the widget's root element. */
  mountTarget?: HTMLElement | string;

  /**
   * Theme tokens applied as CSS custom properties on the widget root.
   * Consumers can override these in their own CSS; these are just the defaults.
   */
  theme?: WidgetTheme;

  /**
   * Analytics client instance. When provided, widgets emit stream lifecycle,
   * metering, and commerce attribution events automatically.
   */
  analyticsClient?: import('./analytics.js').AnalyticsClient;

  /** Price formatting options. Defaults to Turkish locale (TL, dot thousands, comma decimal). */
  pricing?: import('./price-formatter.js').PriceFormatConfig;
}

export interface WidgetTheme {
  primaryColor?: string;
  primaryForeground?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  borderRadius?: string;
  fontFamily?: string;
  fontSize?: string;
  /** Arbitrary additional CSS custom properties */
  [cssVar: string]: string | undefined;
}

// ---------------------------------------------------------------------------
// Widget public API — every widget implements this
// ---------------------------------------------------------------------------

export interface GengageWidget<TConfig extends BaseWidgetConfig = BaseWidgetConfig> {
  /** Mount the widget and fetch initial data. Must be called once. */
  init(config: TConfig): Promise<void>;

  /**
   * Update page context after SPA navigation or page state changes.
   * Widgets re-fetch relevant data (e.g. QNA buttons for new SKU).
   */
  update(context: Partial<PageContext>): void;

  /** Make the widget visible. No-op if already visible. */
  show(): void;

  /** Hide the widget. Preserves state (conversation history, etc.). */
  hide(): void;

  /** Fully remove the widget from the DOM and release all resources. */
  destroy(): void;

  /**
   * Subscribe to widget events.
   * Returns an unsubscribe function.
   *
   * @example
   * const off = widget.on('open', () => console.log('chat opened'));
   * // later:
   * off();
   */
  on(event: string, handler: (...args: unknown[]) => void): () => void;
}

// ---------------------------------------------------------------------------
// Wire protocol — streaming JSON events from backend to widgets
// ---------------------------------------------------------------------------

/**
 * Every event sent over the stream has a `type` discriminant.
 * Events are newline-delimited JSON (NDJSON) over a streaming HTTP response.
 */
export type StreamEvent =
  | StreamEventMetadata
  | StreamEventTextChunk
  | StreamEventUISpec
  | StreamEventAction
  | StreamEventError
  | StreamEventDone;

/** First event in every stream — session and model info. */
export interface StreamEventMetadata {
  type: 'metadata';
  sessionId: string;
  model: string;
  /** Any extra server-side metadata the backend wants to forward. */
  meta?: Record<string, unknown>;
}

/** A chunk of assistant text (streamed word-by-word or sentence-by-sentence). */
export interface StreamEventTextChunk {
  type: 'text_chunk';
  content: string;
  /** If true this chunk closes the current text block. */
  final?: boolean;
  /** Product mentions referenced in the text (for in-text product linking). */
  productMentions?: Array<{ sku: string; short_name: string }>;
  /** Map from SKU to full product data (for enriching product mention links). */
  skuToProductItem?: Record<string, Record<string, unknown>>;
  /** Current conversation mode from outputText (e.g., 'product_search'). */
  conversationMode?: string;
  /** Backend render hint for special rendering (e.g. 'photo_analysis'). */
  renderHint?: string;
}

/**
 * A json-render UI spec sent from the backend.
 * The frontend renders it using the active widget registry.
 * Backend can send UI specs mid-stream to show product cards,
 * action buttons, or any structured component alongside text.
 */
export interface StreamEventUISpec {
  type: 'ui_spec';
  /** Which widget catalog this spec targets. */
  widget: 'chat' | 'qna' | 'simrel';
  /** The json-render spec: root + elements map. */
  spec: UISpec;
  /** Routing hint for two-panel layout: 'panel' = detail/results panel, default = chat thread. */
  panelHint?: 'panel';
  /** When present, dismiss panel loading and hide/clear the assistant side panel. */
  clearPanel?: true;
}

/** A discrete action the backend instructs the widget to perform. */
export interface StreamEventAction {
  type: 'action';
  action:
    | { kind: 'open_chat'; payload?: ActionPayload }
    | { kind: 'navigate'; url: string; newTab?: boolean }
    | { kind: 'save_session'; sessionId: string; sku: string }
    | { kind: 'add_to_cart'; sku: string; quantity: number; cartCode: string }
    | { kind: 'script_call'; name: string; payload?: Record<string, unknown> }
    | { kind: string; [key: string]: unknown };
}

export interface StreamEventError {
  type: 'error';
  code: string;
  message: string;
}

export interface StreamEventDone {
  type: 'done';
}

// ---------------------------------------------------------------------------
// json-render UISpec (subset) — full spec is defined per widget catalog
// ---------------------------------------------------------------------------

/**
 * A json-render spec is a flat map of element IDs to element definitions
 * plus a root element ID.
 *
 * See: https://github.com/vercel-labs/json-render
 */
export interface UISpec {
  root: string;
  elements: Record<string, UIElement>;
}

export interface UIElement {
  type: string;
  props?: Record<string, unknown>;
  children?: string[];
}

// ---------------------------------------------------------------------------
// Backend context — state the backend returns and expects back each turn
// ---------------------------------------------------------------------------

/**
 * Shape of `context.panel` as returned by the backend's `context` event
 * and sent back with each request. Field names match the backend `SessionContext`.
 *
 * This is intentionally extensible (index signature) because the backend
 * may add fields without a frontend release.
 */
export interface BackendPanelContext {
  screen_type?: 'product_list' | 'product_details' | 'comparison_table';
  screen_summary?: string;
  screen_sku_list?: string[];
  chat_mentioned_skus?: string[];
  conversation_stage?: 'exploring' | 'evaluating' | 'deciding' | 'refining';
  last_search_query?: string;
  last_search_offset?: number;
  last_search_page_size?: number;
  last_search_end_of_list?: boolean;
  last_search_category_id?: string;
  last_search_title?: string;
  last_search_max_budget?: number;
  product_refs?: Array<{ ref: string; sku: string; name: string; brand?: string; price?: number }>;
  session_memory?: Record<string, unknown>;
  suggested_action_titles?: string[];
  [key: string]: unknown;
}

/**
 * The full backend context object stored between turns.
 * Contains `panel` (session state), `messages` (conversation history),
 * and `message_id` (last message identifier).
 */
export interface BackendContext {
  panel?: BackendPanelContext;
  messages?: Array<{ role?: string; content?: string }>;
  message_id?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Action payload — user-initiated actions (QNA, chat openers, etc.)
// ---------------------------------------------------------------------------

/** Params passed to add-to-cart callbacks across all widgets. */
export interface AddToCartParams {
  sku: string;
  cartCode: string;
  quantity: number;
}

export interface ActionPayload {
  /** Display label shown to the user. */
  title: string;
  /** Backend action type identifier. */
  type: string;
  /** Arbitrary action data passed to the backend as-is. */
  payload?: unknown;
}

// ---------------------------------------------------------------------------
// Cross-widget event bus (window CustomEvents)
// ---------------------------------------------------------------------------

/**
 * All inter-widget and host-page events follow this naming convention:
 *   gengage:<widget>:<action>
 *
 * Widgets dispatch these; host pages and other widgets listen.
 */
export type GengageEventName =
  | 'gengage:chat:open'
  | 'gengage:chat:close'
  | 'gengage:chat:ready'
  | 'gengage:chat:metadata'
  | 'gengage:chat:voice'
  | 'gengage:chat:redirect'
  | 'gengage:chat:script-call'
  | 'gengage:chat:add-to-cart'
  | 'gengage:chat:product-favorite'
  | 'gengage:qna:action'
  | 'gengage:qna:open-chat'
  | 'gengage:similar:product-click'
  | 'gengage:similar:add-to-cart'
  | 'gengage:global:error'
  | 'gengage:checkout:start'
  | 'gengage:checkout:complete'
  | 'gengage:context:update';

export type GengageEventDetailMap = {
  'gengage:chat:open': { state?: 'full' | 'half' };
  'gengage:chat:close': Record<string, never>;
  'gengage:chat:ready': Record<string, never>;
  'gengage:chat:metadata': { payload: Record<string, unknown> };
  'gengage:chat:voice': { payload: unknown };
  'gengage:chat:redirect': { target: unknown; payload: unknown };
  'gengage:chat:script-call': { name: string; payload?: Record<string, unknown> };
  'gengage:chat:add-to-cart': { sku: string; cartCode: string; quantity: number; sessionId: string | null };
  'gengage:chat:product-favorite': {
    sku: string;
    product: Record<string, unknown>;
    favorited: boolean;
    sessionId: string | null;
  };
  'gengage:qna:action': ActionPayload;
  'gengage:qna:open-chat': Record<string, never>;
  'gengage:similar:product-click': { sku: string; url: string; sessionId: string | null };
  'gengage:similar:add-to-cart': { sku: string; quantity: number; cartCode: string };
  'gengage:global:error': {
    source: 'chat' | 'qna' | 'simrel' | 'sdk';
    message: string;
    code?: string;
    durationMs?: number;
    sticky?: boolean;
  };
  'gengage:checkout:start': {
    attribution_source: 'chat' | 'qna' | 'simrel';
    attribution_action_id: string;
    cart_value: number;
    currency: string;
    line_items: number;
  };
  'gengage:checkout:complete': {
    attribution_source: 'chat' | 'qna' | 'simrel';
    attribution_action_id: string;
    cart_value: number;
    currency: string;
    line_items: number;
  };
  'gengage:context:update': Partial<PageContext>;
};

// ---------------------------------------------------------------------------
// Global window augmentation
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    /**
     * Set this before loading widget scripts for SSR / static pages.
     * CSR/SPA: call widget.update() instead.
     */
    gengage?: {
      pageContext?: PageContext;
      /** Shared session ID — set once at page bootstrap. */
      sessionId?: string;
      /** Chat widget public API, available after chat widget init(). */
      chat?: import('./widget-base').ChatPublicAPI;
      /** Overlay orchestration API, available after initOverlayWidgets(). */
      overlay?: import('./overlay.js').OverlayWidgetsController;
    };

    /** @internal Legacy compat — do not use in new integrations. */
    __gengageSessionId?: string;
  }
}

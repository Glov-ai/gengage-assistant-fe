/**
 * Google Analytics dataLayer integration.
 *
 * Pushes chat activity events to `window.dataLayer` when GA is available.
 * Falls back to `console.debug` when GA is not detected (useful for debugging).
 *
 * Event naming:
 *   - Legacy hyphen-separated names (e.g. `gengage-on-init`) are kept for
 *     backward compatibility with existing GA dashboards.
 *   - For every legacy `gengage-*` push we additionally emit a camelCase
 *     mirror (e.g. `gengageOnInit`) so customers can build new dashboards
 *     using the canonical naming used in the SaaS / GTM specifications.
 *   - A handful of events use a special standalone name (`GLOV_ON`); those
 *     are pushed exactly as named without any mirroring.
 *
 * Clients can build custom chat funnels in GA using these events.
 */

// ---------------------------------------------------------------------------
// GA dataLayer type augmentation
// ---------------------------------------------------------------------------

interface DataLayerEvent {
  event: string;
  [key: string]: unknown;
}

declare global {
  interface Window {
    dataLayer?: DataLayerEvent[];
  }
}

// ---------------------------------------------------------------------------
// GA detection
// ---------------------------------------------------------------------------

function isGAAvailable(): boolean {
  return typeof window !== 'undefined' && Array.isArray(window.dataLayer);
}

/**
 * Convert `gengage-foo-bar` → `gengageFooBar`.
 * Returns the original string when no hyphens are present so callers can
 * compare and skip the duplicate push.
 */
function kebabToCamel(name: string): string {
  if (!name.includes('-')) return name;
  return name.replace(/-([a-z0-9])/g, (_, ch: string) => ch.toUpperCase());
}

// ---------------------------------------------------------------------------
// Core push function
// ---------------------------------------------------------------------------

function pushEvent(eventName: string, params?: Record<string, unknown>): void {
  if (!isGAAvailable()) return;
  // No fallback log — GA events are silently dropped when dataLayer is absent.

  const dl = window.dataLayer!;
  dl.push({ event: eventName, ...params });

  // Mirror legacy hyphen-separated names (`gengage-foo-bar`) to the canonical
  // camelCase name (`gengageFooBar`) so customers can adopt the new naming
  // without losing data emitted by older code paths.
  if (eventName.startsWith('gengage-')) {
    const mirror = kebabToCamel(eventName);
    if (mirror !== eventName) {
      dl.push({ event: mirror, ...params });
    }
  }
}

// ---------------------------------------------------------------------------
// Typed event emitters — widget lifecycle
// ---------------------------------------------------------------------------

/** Widget icon/avatar displayed on page. */
export function trackInit(widget: string): void {
  pushEvent('gengage-on-init', { gengage_widget: widget });
}

/** Widget opened / shown to user. */
export function trackShow(widget: string): void {
  pushEvent('gengage-show', { gengage_widget: widget });
}

/** Widget closed / hidden. */
export function trackHide(widget: string): void {
  pushEvent('gengage-hide', { gengage_widget: widget });
}

/**
 * Chatbot opened from any source (launcher, QNA, programmatic, etc.).
 * Complementary to `trackShow` — both fire on every open, but this one is
 * the source-agnostic signal customers asked for.
 */
export function trackChatbotOpened(source?: string): void {
  const params: Record<string, unknown> = {};
  if (source !== undefined) params['gengage_source'] = source;
  pushEvent('gengageChatbotOpened', params);
}

/** Chat panel switched to the maximized (full / split) layout. */
export function trackChatbotMaximized(): void {
  pushEvent('gengageChatbotMaximized');
}

/**
 * Robot eligibility passed and the assistant runtime started initializing.
 * Pushed exactly once per page load before any other widget event.
 */
export function trackGlovOn(accountId?: string): void {
  const params: Record<string, unknown> = {};
  if (accountId !== undefined) params['gengage_account_id'] = accountId;
  pushEvent('GLOV_ON', params);
}

/**
 * Frontend gave up bootstrapping the assistant after exhausting the configured
 * retry budget (default: 10). Pushed exactly once per failed page load.
 */
export function trackInterfaceNotReady(reason?: string, attempts?: number): void {
  const params: Record<string, unknown> = {};
  if (reason !== undefined) params['gengage_reason'] = reason;
  if (attempts !== undefined) params['gengage_attempts'] = attempts;
  pushEvent('gengageInterfaceNotReady', params);
}

// ---------------------------------------------------------------------------
// Typed event emitters — QNA
// ---------------------------------------------------------------------------

/** User clicked a suggested question / action button. */
export function trackSuggestedQuestion(title: string, type: string): void {
  pushEvent('gengage-suggested-question', {
    gengage_question_title: title,
    gengage_action_type: type,
  });
}

/** User typed free text into the QNA input and submitted. */
export function trackQnaInput(text?: string): void {
  const params: Record<string, unknown> = {};
  if (text !== undefined) params['gengage_question_title'] = text;
  pushEvent('gengageQnaInput', params);
}

/** User clicked one of the QNA quick-action buttons (non-input action). */
export function trackQnaButton(title: string, type: string): void {
  pushEvent('gengageQnaButton', {
    gengage_question_title: title,
    gengage_action_type: type,
  });
}

// ---------------------------------------------------------------------------
// Typed event emitters — Find Similar / SimRel
// ---------------------------------------------------------------------------

/** User clicked "Find Similar" for a product. */
export function trackFindSimilars(sku: string): void {
  pushEvent('gengage-find-similars', { gengage_sku: sku });
}

/** Similar Products widget rendered with at least one product. */
export function trackSimilarProductsImpression(productCount: number, sku?: string): void {
  const params: Record<string, unknown> = { gengage_product_count: productCount };
  if (sku !== undefined) params['gengage_sku'] = sku;
  pushEvent('gengageSimilarProductsImpression', params);
}

/** User clicked a Similar Products group/filter tab. */
export function trackSimilarGroupingClick(groupName: string, index: number): void {
  pushEvent('gengageSimilarGroupingClick', {
    gengage_group_name: groupName,
    gengage_group_index: index,
  });
}

/** User clicked a Similar Products card (navigates to PDP). */
export function trackSimilarProductClick(sku: string, name?: string): void {
  const params: Record<string, unknown> = { gengage_sku: sku };
  if (name !== undefined) params['gengage_product_name'] = name;
  pushEvent('gengageSimilarProductClick', params);
}

/** User clicked the add-to-cart button on a Similar Products card. */
export function trackSimilarProductAddToCart(sku: string, quantity: number): void {
  pushEvent('gengageSimilarProductAddToCart', {
    gengage_sku: sku,
    gengage_quantity: quantity,
  });
}

// ---------------------------------------------------------------------------
// Typed event emitters — Comparison
// ---------------------------------------------------------------------------

/** User pre-selected a product for comparison. */
export function trackComparePreselection(sku: string): void {
  pushEvent('gengage-compare-preselection', { gengage_sku: sku });
}

/** User submitted the comparison (clicked "Compare Selected"). */
export function trackCompareSelected(skus: string[]): void {
  pushEvent('gengage-compare-selected', {
    gengage_skus: skus,
    gengage_product_count: skus.length,
  });
}

/** User cleared the comparison selection. */
export function trackCompareClear(): void {
  pushEvent('gengage-compare-clear');
}

/** Comparison results received and rendered. */
export function trackCompareReceived(productCount: number): void {
  pushEvent('gengage-compare-received', {
    gengage_product_count: productCount,
  });
}

/**
 * User clicked the "Compare" toggle (header chip or floating dock button).
 * This is the entry point that flips the chat into comparison-select mode;
 * `trackComparePreselection` then fires for each individual card the user picks.
 */
export function trackCompareProduct(source: 'toggle' | 'dock' | 'choice-prompter' = 'toggle'): void {
  pushEvent('gengageCompareProduct', { gengage_source: source });
}

// ---------------------------------------------------------------------------
// Typed event emitters — Product / Cart / Favorites
// ---------------------------------------------------------------------------

/** User liked / favorited a product. */
export function trackLikeProduct(sku: string): void {
  pushEvent('gengage-like-product', { gengage_sku: sku });
}

/** User clicked the favorites/likes list button. */
export function trackLikeList(): void {
  pushEvent('gengage-like-list');
}

/** Product list / search results displayed. */
export function trackSearch(query?: string, resultCount?: number): void {
  pushEvent('gengage-search', {
    gengage_search_query: query,
    gengage_result_count: resultCount,
  });
}

/** User clicked on a product to view details. */
export function trackProductDetail(sku: string, name?: string): void {
  pushEvent('gengage-product-detail', {
    gengage_sku: sku,
    gengage_product_name: name,
  });
}

/** User added a product to cart from the widget. */
export function trackCartAdd(sku: string, quantity: number): void {
  pushEvent('gengage-cart-add', {
    gengage_sku: sku,
    gengage_quantity: quantity,
  });
}

// ---------------------------------------------------------------------------
// Typed event emitters — Chat lifecycle / messaging
// ---------------------------------------------------------------------------

/** User sent a chat message. */
export function trackMessageSent(): void {
  pushEvent('gengage-message-sent');
}

/** Assistant responded with text. */
export function trackMessageReceived(): void {
  pushEvent('gengage-message-received');
}

/** User started a new conversation. */
export function trackConversationStart(): void {
  pushEvent('gengage-conversation-start');
}

/** User used voice input. */
export function trackVoiceInput(): void {
  pushEvent('gengage-voice-input');
}

/** Widget or stream error occurred. */
export function trackError(widget: string, error: string): void {
  pushEvent('gengage-error', { gengage_widget: widget, gengage_error: error });
}

// ---------------------------------------------------------------------------
// Batch wire-up: connect to the Gengage event bus
// ---------------------------------------------------------------------------

/**
 * Wire GA dataLayer tracking to the Gengage event bus.
 * Call once after widgets are initialized.
 *
 * @returns unsubscribe function that removes all listeners.
 */
let _gaWiredUnsub: (() => void) | null = null;

export function wireGADataLayer(): () => void {
  if (typeof window === 'undefined') return () => {};
  // Idempotency guard: return existing unsubscribe if already wired
  if (_gaWiredUnsub) return _gaWiredUnsub;

  const listeners: Array<() => void> = [];

  function on<T>(eventName: string, handler: (detail: T) => void): void {
    const listener = (e: Event) => handler((e as CustomEvent<T>).detail);
    window.addEventListener(eventName, listener);
    listeners.push(() => window.removeEventListener(eventName, listener));
  }

  // Chat lifecycle
  on<{ state?: string }>('gengage:chat:open', () => trackShow('chat'));
  on<Record<string, never>>('gengage:chat:close', () => trackHide('chat'));
  on<Record<string, never>>('gengage:chat:ready', () => trackInit('chat'));

  // Add to cart (from similar products widget — chat handles GA4 directly)
  on<{ sku: string; quantity: number; cartCode: string }>('gengage:similar:add-to-cart', ({ sku, quantity }) => {
    trackCartAdd(sku, quantity);
  });

  // Product click from similar products
  on<{ sku: string; url: string }>('gengage:similar:product-click', ({ sku }) => {
    trackProductDetail(sku);
  });

  // QNA action (suggested question click)
  on<{ title: string; type: string }>('gengage:qna:action', ({ title, type }) => {
    trackSuggestedQuestion(title, type);
  });

  // Voice input
  on<{ payload: unknown }>('gengage:chat:voice', () => trackVoiceInput());

  // QNA open chat
  on<Record<string, never>>('gengage:qna:open-chat', () => trackShow('chat'));

  // Error tracking
  on<{ source: string; message: string }>('gengage:global:error', ({ source, message }) => {
    trackError(source, message);
  });

  _gaWiredUnsub = () => {
    for (const unsub of listeners) unsub();
    listeners.length = 0;
    _gaWiredUnsub = null;
  };
  return _gaWiredUnsub;
}

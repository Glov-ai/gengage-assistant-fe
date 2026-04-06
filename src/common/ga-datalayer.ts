/**
 * Google Analytics dataLayer integration.
 *
 * Pushes chat activity events to `window.dataLayer` when GA is available.
 * Falls back to `console.debug` when GA is not detected (useful for debugging).
 *
 * Event naming follows the GA4 recommended event pattern:
 *   - All lowercase, hyphen-separated
 *   - Prefixed with `gengage-` for easy filtering in GA dashboards
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

// ---------------------------------------------------------------------------
// Core push function
// ---------------------------------------------------------------------------

function pushEvent(eventName: string, params?: Record<string, unknown>): void {
  const payload: DataLayerEvent = {
    event: eventName,
    ...params,
  };

  if (isGAAvailable()) {
    window.dataLayer!.push(payload);
  }
  // No fallback log — GA events are silently dropped when dataLayer is absent.
}

// ---------------------------------------------------------------------------
// Typed event emitters
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

/** User clicked a suggested question / action button. */
export function trackSuggestedQuestion(title: string, type: string): void {
  pushEvent('gengage-suggested-question', {
    gengage_question_title: title,
    gengage_action_type: type,
  });
}

/** User clicked "Find Similar" for a product. */
export function trackFindSimilars(sku: string): void {
  pushEvent('gengage-find-similars', { gengage_sku: sku });
}

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

  // Product favorite (card heart) — aligns with gengage-like-product GA event
  on<{ sku: string; favorited: boolean }>('gengage:chat:product-favorite', ({ sku, favorited }) => {
    if (favorited) trackLikeProduct(sku);
  });

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

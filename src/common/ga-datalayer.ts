/**
 * Google Analytics dataLayer integration.
 *
 * Pushes chat activity events to `window.dataLayer` when GA is available.
 * Silently skips pushes when GA is not detected.
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

/** SimRel (or chat-routed similar) product card click — distinct from generic PDP detail views. */
export function trackSimilarProductClick(
  sku: string,
  extras?: { url?: string; name?: string; session_id?: string | null },
): void {
  pushEvent('gengage-similar-product-click', {
    gengage_sku: sku,
    ...(extras?.url !== undefined ? { gengage_product_url: extras.url } : {}),
    ...(extras?.name !== undefined ? { gengage_product_name: extras.name } : {}),
    ...(extras?.session_id !== undefined ? { gengage_session_id: extras.session_id } : {}),
  });
}

/** SimRel grouping / filter tab selected. */
export function trackSimilarGroupingClick(groupingLabel: string, groupingIndex: number): void {
  pushEvent('gengage-similar-grouping-click', {
    gengage_grouping_label: groupingLabel,
    gengage_grouping_index: groupingIndex,
  });
}

/** SimRel grid rendered and shown (successful fetch + inject). */
export function trackSimilarProductsImpression(params: {
  source_sku: string;
  product_count: number;
  grouped: boolean;
  session_id?: string | null;
}): void {
  pushEvent('gengage-similar-products-impression', {
    gengage_source_sku: params.source_sku,
    gengage_product_count: params.product_count,
    gengage_grouped: params.grouped,
    ...(params.session_id !== undefined ? { gengage_session_id: params.session_id } : {}),
  });
}

/** User clicked the floating comparison dock primary action (popup bar). */
export function trackCompareProduct(skus: string[]): void {
  pushEvent('gengage-compare-product', {
    gengage_skus: skus,
    gengage_product_count: skus.length,
  });
}

/** Chat MainPane (assistant left panel) expanded into split view. */
export function trackChatbotMaximized(): void {
  pushEvent('gengage-chatbot-maximized');
}

/**
 * SDK / bridge could not become ready after bounded retries (e.g. chat not initialized).
 * Also used when overlay bootstrap fails fatally.
 */
export function trackInterfaceNotReady(params?: { reason?: string; attempts?: number; message?: string }): void {
  pushEvent('gengage-interface-not-ready', {
    ...(params?.reason !== undefined ? { gengage_reason: params.reason } : {}),
    ...(params?.attempts !== undefined ? { gengage_attempts: params.attempts } : {}),
    ...(params?.message !== undefined ? { gengage_message: params.message } : {}),
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

  // Product click from similar products (SimRel + chat navigate path)
  on<{ sku: string; url: string; sessionId: string | null; productName?: string }>(
    'gengage:similar:product-click',
    ({ sku, url, sessionId, productName }) => {
      const extras: { url?: string; name?: string; session_id?: string | null } = { url, session_id: sessionId };
      if (productName !== undefined && productName !== '') extras.name = productName;
      trackSimilarProductClick(sku, extras);
    },
  );

  on<{ grouping_label: string; grouping_index: number; sessionId: string | null }>(
    'gengage:similar:grouping-click',
    ({ grouping_label, grouping_index }) => {
      trackSimilarGroupingClick(grouping_label, grouping_index);
    },
  );

  on<{ source_sku: string; product_count: number; grouped: boolean; sessionId: string | null }>(
    'gengage:similar:products-impression',
    ({ source_sku, product_count, grouped, sessionId }) => {
      trackSimilarProductsImpression({
        source_sku,
        product_count,
        grouped,
        session_id: sessionId,
      });
    },
  );

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

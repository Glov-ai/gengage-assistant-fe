/**
 * Two-way communication bridge between the host page and embedded widgets.
 *
 * Host -> Widget: The host sends `window.postMessage({ gengage, type, payload })`.
 * The bridge validates the origin, checks the namespace, and routes to handlers.
 *
 * Widget -> Host: The bridge dispatches a `CustomEvent('gengage:bridge:message')`
 * on window so the host can listen without tight coupling.
 *
 * Built-in message types:
 *   - 'addToCart'    -- host confirms cart addition
 *   - 'navigate'     -- host navigates to URL
 *   - 'openChat'     -- programmatic open
 *   - 'closeChat'    -- programmatic close
 *   - 'getContext'   -- host requests current context
 */

export interface BridgeMessage {
  type: string;
  payload?: unknown;
}

export interface CommunicationBridgeOptions {
  /** Widget namespace for message identification (e.g. 'chat', 'qna'). */
  namespace: string;
  /** Allowed origins for postMessage security (default: ['*']). */
  allowedOrigins?: string[];
  /** Callback when a message is received from the host. */
  onMessage?: (msg: BridgeMessage) => void;
}

type BridgeHandler = (payload: unknown) => void;

export class CommunicationBridge {
  private readonly _namespace: string;
  private readonly _allowedOrigins: readonly string[];
  private readonly _onMessage: ((msg: BridgeMessage) => void) | undefined;
  private readonly _handlers = new Map<string, Set<BridgeHandler>>();
  private readonly _messageListener: (event: MessageEvent) => void;
  private _destroyed = false;

  constructor(options: CommunicationBridgeOptions) {
    this._namespace = options.namespace;
    // KNOWN TECH DEBT [SECURITY]: Default wildcard origin ['*'] silently accepts
    // postMessages from any cross-origin iframe in production. An attacker on an
    // unrelated domain can send { gengage: 'chat', type: 'openChat' } to trigger
    // widget actions. Tracked for fix: default to [location.origin] and require
    // explicit opt-in for wildcard. Risk is mitigated by: (1) message shape
    // validation (gengage namespace + type), (2) no destructive actions exposed
    // through bridge, (3) host page typically controls all iframes.
    this._allowedOrigins = options.allowedOrigins ?? ['*'];
    this._onMessage = options.onMessage;

    if (this._allowedOrigins.includes('*') && typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      console.info('[gengage] postMessage bridge using wildcard origin. Set allowedOrigins for production security.');
    }

    this._messageListener = (event: MessageEvent) => this._handlePostMessage(event);
    window.addEventListener('message', this._messageListener);
  }

  /** Send a message to the host page via CustomEvent on window. */
  send(type: string, payload?: unknown): void {
    if (this._destroyed) return;

    const detail: { namespace: string; type: string; payload?: unknown } = {
      namespace: this._namespace,
      type,
    };
    if (payload !== undefined) {
      detail.payload = payload;
    }

    window.dispatchEvent(
      new CustomEvent('gengage:bridge:message', {
        detail,
        bubbles: false,
      }),
    );
  }

  /**
   * Register a handler for a specific message type.
   * Returns an unsubscribe function.
   */
  on(type: string, handler: BridgeHandler): () => void {
    if (!this._handlers.has(type)) {
      this._handlers.set(type, new Set());
    }
    // The Map.get is guaranteed non-null after the set above
    const handlers = this._handlers.get(type)!;
    handlers.add(handler);

    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this._handlers.delete(type);
      }
    };
  }

  /** Clean up all event listeners and handlers. */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    window.removeEventListener('message', this._messageListener);
    this._handlers.clear();
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private _handlePostMessage(event: MessageEvent): void {
    if (this._destroyed) return;

    // Validate origin
    if (!this._isOriginAllowed(event.origin)) return;

    // Validate message shape: must be an object with { gengage, type }
    const data: unknown = event.data;
    if (!isValidBridgeData(data)) return;

    // Only process messages targeting this namespace
    if (data.gengage !== this._namespace) return;

    const msg: BridgeMessage = { type: data.type };
    if (data.payload !== undefined) {
      msg.payload = data.payload;
    }

    // Invoke the general onMessage callback
    this._onMessage?.(msg);

    // Route to type-specific handlers
    const handlers = this._handlers.get(msg.type);
    if (handlers) {
      for (const handler of handlers) {
        handler(msg.payload);
      }
    }
  }

  private _isOriginAllowed(origin: string): boolean {
    if (this._allowedOrigins.includes('*')) return true;
    return this._allowedOrigins.includes(origin);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shape guard for incoming postMessage data. */
function isValidBridgeData(data: unknown): data is { gengage: string; type: string; payload?: unknown } {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return typeof obj['gengage'] === 'string' && typeof obj['type'] === 'string';
}

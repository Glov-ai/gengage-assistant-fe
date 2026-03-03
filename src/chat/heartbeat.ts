/**
 * V2 heartbeat polling.
 *
 * Periodically sends session state signals to the `/v2/heartbeat` backend
 * endpoint. The backend evaluates proactive trigger rules and may return a
 * message to show to the user (e.g. idle nudge, cart abandonment reminder).
 *
 * Gated behind `ChatWidgetConfig.enableHeartbeat` (default: false).
 */

import { normalizeMiddlewareUrl } from '../common/api-paths.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HeartbeatRequest {
  account_id: string;
  thread_id: string;
  output_language: string;
  idle_seconds: number;
  page_type: string;
  current_sku: string;
  cart_item_count: number;
  searches_count: number;
  actions_count: number;
  session_duration_seconds: number;
  trigger_fire_counts: Record<string, number>;
}

export interface HeartbeatResponse {
  action: 'noop' | 'message';
  trigger_type?: string;
  message?: string;
  suggested_actions?: Array<{
    title: string;
    icon?: string;
    requestDetails?: { type: string; payload?: unknown };
  }>;
}

export interface HeartbeatManagerOptions {
  middlewareUrl: string;
  accountId: string;
  sessionId: string;
  locale: string;
  intervalMs: number;
  getPageType: () => string;
  getCurrentSku: () => string;
  onMessage: (response: HeartbeatResponse) => void;
}

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

export class HeartbeatManager {
  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _destroyed = false;
  private _abortController: AbortController | null = null;
  private _sessionStart = Date.now();
  private _lastActivity = Date.now();
  private _searchesCount = 0;
  private _actionsCount = 0;
  private _triggerFireCounts: Record<string, number> = {};
  private readonly _options: HeartbeatManagerOptions;
  private readonly _endpoint: string;

  constructor(options: HeartbeatManagerOptions) {
    this._options = options;
    const base = normalizeMiddlewareUrl(options.middlewareUrl);
    this._endpoint = `${base}/v2/heartbeat`;
  }

  start(): void {
    if (this._timer || this._destroyed) return;
    this._scheduleNext();
  }

  /** Schedule the next poll after the current one finishes (prevents overlapping polls). */
  private _scheduleNext(): void {
    if (this._destroyed) return;
    this._timer = setTimeout(() => {
      void this._poll().finally(() => this._scheduleNext());
    }, this._options.intervalMs);
  }

  stop(): void {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  /** Call when the user performs an action (search, click, etc.). */
  recordAction(): void {
    this._actionsCount++;
    this._lastActivity = Date.now();
  }

  /** Call when the user performs a search. */
  recordSearch(): void {
    this._searchesCount++;
    this._lastActivity = Date.now();
  }

  /** Call on any user interaction to reset idle timer. */
  recordActivity(): void {
    this._lastActivity = Date.now();
  }

  destroy(): void {
    this._destroyed = true;
    this._abortController?.abort();
    this._abortController = null;
    this.stop();
  }

  private async _poll(): Promise<void> {
    if (this._destroyed) return;

    const now = Date.now();
    const request: HeartbeatRequest = {
      account_id: this._options.accountId,
      thread_id: this._options.sessionId,
      output_language: this._options.locale.toUpperCase(),
      idle_seconds: (now - this._lastActivity) / 1000,
      page_type: this._options.getPageType(),
      current_sku: this._options.getCurrentSku(),
      cart_item_count: 0,
      searches_count: this._searchesCount,
      actions_count: this._actionsCount,
      session_duration_seconds: (now - this._sessionStart) / 1000,
      trigger_fire_counts: { ...this._triggerFireCounts },
    };

    this._abortController = new AbortController();
    try {
      const response = await fetch(this._endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: this._abortController.signal,
      });

      if (this._destroyed || !response.ok) return;

      const data = (await response.json()) as HeartbeatResponse;
      if (this._destroyed) return;
      if (data.action === 'message' && data.message) {
        // Track trigger fire count to avoid re-firing
        if (data.trigger_type) {
          this._triggerFireCounts[data.trigger_type] = (this._triggerFireCounts[data.trigger_type] ?? 0) + 1;
        }
        this._options.onMessage(data);
      }
    } catch {
      // Non-fatal — heartbeat is best-effort
    }
  }
}

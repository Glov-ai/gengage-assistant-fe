/**
 * Tracks user activity signals (page views, idle, scroll depth) for
 * engagement analytics.
 */

export interface ActivityEvent {
  type: 'pageview' | 'idle' | 'scroll' | 'focus' | 'blur';
  timestamp: number;
  data?: Record<string, unknown>;
}

export interface ActivityTrackerOptions {
  /** Idle threshold in ms (default: 30000). */
  idleThresholdMs?: number;
  /** Scroll depth granularity in percent (default: 25). */
  scrollGranularity?: number;
  /** Callback when an activity event fires. */
  onActivity?: (event: ActivityEvent) => void;
}

export class ActivityTracker {
  private _idleTimer: ReturnType<typeof setTimeout> | null = null;
  private _idleThreshold: number;
  private _scrollGranularity: number;
  private _maxScrollDepth = 0;
  private _lastReportedDepth = 0;
  private _onActivity: ((event: ActivityEvent) => void) | null;
  private _listeners: Array<[EventTarget, string, EventListener]> = [];
  private _destroyed = false;

  constructor(options: ActivityTrackerOptions = {}) {
    this._idleThreshold = options.idleThresholdMs ?? 30000;
    this._scrollGranularity = options.scrollGranularity ?? 25;
    this._onActivity = options.onActivity ?? null;
    this._setup();
  }

  private _setup(): void {
    this._emit({ type: 'pageview', timestamp: Date.now() });
    this._resetIdleTimer();

    this._listen(window, 'scroll', () => this._onScroll(), { passive: true });
    this._listen(window, 'mousemove', () => this._resetIdleTimer(), { passive: true });
    this._listen(window, 'keydown', () => this._resetIdleTimer(), { passive: true });
    this._listen(window, 'touchstart', () => this._resetIdleTimer(), { passive: true });
    this._listen(document, 'visibilitychange', () => this._onVisibility());
  }

  private _listen(target: EventTarget, event: string, handler: EventListener, options?: AddEventListenerOptions): void {
    target.addEventListener(event, handler, options);
    this._listeners.push([target, event, handler]);
  }

  private _resetIdleTimer(): void {
    if (this._idleTimer) clearTimeout(this._idleTimer);
    this._idleTimer = setTimeout(() => {
      this._emit({ type: 'idle', timestamp: Date.now() });
    }, this._idleThreshold);
  }

  private _onScroll(): void {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    const depth = Math.min(100, Math.round((scrollTop / docHeight) * 100));

    if (depth > this._maxScrollDepth) {
      this._maxScrollDepth = depth;
    }

    const bucket = Math.floor(depth / this._scrollGranularity) * this._scrollGranularity;
    if (bucket > this._lastReportedDepth) {
      this._lastReportedDepth = bucket;
      this._emit({
        type: 'scroll',
        timestamp: Date.now(),
        data: { depth: bucket },
      });
    }

    this._resetIdleTimer();
  }

  private _onVisibility(): void {
    if (document.hidden) {
      this._emit({ type: 'blur', timestamp: Date.now() });
      if (this._idleTimer) clearTimeout(this._idleTimer);
    } else {
      this._emit({ type: 'focus', timestamp: Date.now() });
      this._resetIdleTimer();
    }
  }

  private _emit(event: ActivityEvent): void {
    if (this._destroyed) return;
    this._onActivity?.(event);
  }

  /** Current max scroll depth reached (0-100). */
  get maxScrollDepth(): number {
    return this._maxScrollDepth;
  }

  destroy(): void {
    this._destroyed = true;
    if (this._idleTimer) clearTimeout(this._idleTimer);
    for (const [target, event, handler] of this._listeners) {
      target.removeEventListener(event, handler);
    }
    this._listeners = [];
  }
}

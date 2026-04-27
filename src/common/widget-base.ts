/**
 * Abstract base class for all Gengage widgets.
 *
 * Provides:
 *   - Lifecycle management (init → update → show/hide → destroy)
 *   - Typed event emitter
 *   - Theme application via CSS custom properties
 *   - SPA context-update listener (gengage:context:update)
 *   - Mount target resolution (selector string or HTMLElement)
 *
 * Subclasses must implement:
 *   - protected onInit(config): Promise<void>
 *   - protected onUpdate(context): void
 *   - protected onShow(): void
 *   - protected onHide(): void
 *   - protected onDestroy(): void
 */

import type { BaseWidgetConfig, GengageWidget, PageContext, WidgetTheme } from './types.js';
import type { AnalyticsInput } from './analytics.js';
import type { AnalyticsContext } from './analytics-events.js';
import { checkoutStartEvent, checkoutCompleteEvent, meteringSummaryEvent } from './analytics-events.js';
import { listen } from './events.js';
import { resolveSession } from './context.js';
import { withDefaultWidgetTheme } from './ui-theme.js';
import { registerGlobalErrorToastListener } from './global-error-toast.js';
import { debugLog } from './debug.js';

type AnyHandler = (...args: unknown[]) => void;

export abstract class BaseWidget<
  TConfig extends BaseWidgetConfig = BaseWidgetConfig,
> implements GengageWidget<TConfig> {
  protected config!: TConfig;
  protected root!: HTMLElement;
  protected isVisible = false;
  protected isInitialised = false;

  private readonly _handlers = new Map<string, Set<AnyHandler>>();
  private readonly _cleanups: Array<() => void> = [];
  private _ownsRoot = false;
  private _destroying = false;

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async init(config: TConfig): Promise<void> {
    if (this.isInitialised) {
      console.warn('[gengage] Widget already initialised. Call update() instead.');
      return;
    }

    const mergedTheme = withDefaultWidgetTheme(config.theme);

    this.config = {
      ...config,
      theme: mergedTheme,
      session: resolveSession(config.session),
    };

    this.root = this._resolveMount(config.mountTarget);
    this._applyTheme(mergedTheme);
    registerGlobalErrorToastListener();

    // Listen for context updates dispatched by the host page
    const off = listen('gengage:context:update', (patch) => this.update(patch));
    this._cleanups.push(off);

    debugLog('lifecycle', `${this.constructor.name}.init`, {
      accountId: config.accountId,
      sku: config.pageContext?.sku,
    });

    try {
      await this.onInit(this.config);
    } catch (err) {
      this.destroy();
      throw err;
    }
    if (this._destroying) return;
    this.isInitialised = true;
    debugLog('lifecycle', `${this.constructor.name} ready`);
    this.emit('ready');
  }

  update(context: Partial<PageContext>): void {
    if (!this.isInitialised) return;
    if (this.config.pageContext) {
      this.config = {
        ...this.config,
        pageContext: { ...this.config.pageContext, ...context },
      };
    } else if (context.pageType !== undefined) {
      // Only create a new pageContext when pageType is present (required field)
      this.config = { ...this.config, pageContext: context as PageContext };
    }
    this.onUpdate(context);
    this.emit('context-update', this.config.pageContext);
  }

  show(): void {
    if (this.isVisible) return;
    this.isVisible = true;
    this.root.style.display = '';
    this.onShow();
    this.emit('show');
  }

  hide(): void {
    if (!this.isVisible) return;
    this.isVisible = false;
    this.root.style.display = 'none';
    this.onHide();
    this.emit('hide');
  }

  destroy(): void {
    if (this._destroying) return;
    this._destroying = true;
    this.emit('destroy');
    this._cleanups.forEach((fn) => fn());
    this._cleanups.length = 0;
    this._handlers.clear();
    this.onDestroy();
    this.config.analyticsClient?.destroy();
    this._cleanupRoot();
    this.isInitialised = false;
  }

  /**
   * Called at the end of destroy() to remove or clear the root node.
   * Subclasses that mount into a merchant-owned element (e.g. SimBut) should
   * override this to a no-op so the host page's DOM is never mutated.
   */
  protected _cleanupRoot(): void {
    if (this._ownsRoot) {
      this.root.remove();
    } else {
      this.root.innerHTML = '';
    }
  }

  on(event: string, handler: AnyHandler): () => void {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set());
    this._handlers.get(event)!.add(handler);
    return () => this._handlers.get(event)?.delete(handler);
  }

  /** Track a checkout start event. Called by host page to attribute checkout to widget interaction. */
  trackCheckout(
    type: 'start' | 'complete',
    data: {
      attribution_source: 'chat' | 'qna' | 'simrel';
      attribution_action_id: string;
      cart_value: number;
      currency: string;
      line_items: number;
    },
  ): void {
    const builder = type === 'start' ? checkoutStartEvent : checkoutCompleteEvent;
    this.track(builder(this.analyticsContext(), data));
  }

  /** Track a metering summary event. Called by host page for session-level aggregation. */
  flushMeteringSummary(data: { meter_key: string; quantity: number; unit: string }): void {
    this.track(meteringSummaryEvent(this.analyticsContext(), data));
  }

  // ---------------------------------------------------------------------------
  // Protected — subclasses implement these
  // ---------------------------------------------------------------------------

  protected abstract onInit(config: TConfig): Promise<void>;
  protected abstract onUpdate(context: Partial<PageContext>): void;
  protected abstract onShow(): void;
  protected abstract onHide(): void;
  protected abstract onDestroy(): void;

  // ---------------------------------------------------------------------------
  // Protected helpers
  // ---------------------------------------------------------------------------

  /** Emit a widget event to all registered handlers. */
  protected emit(event: string, ...args: unknown[]): void {
    this._handlers.get(event)?.forEach((h) => h(...args));
  }

  /** Register a cleanup function to run on destroy(). */
  protected addCleanup(fn: () => void): void {
    this._cleanups.push(fn);
  }

  /** Track an analytics event (no-op if analyticsClient is not configured). */
  protected track(input: AnalyticsInput): void {
    this.config.analyticsClient?.track(input);
  }

  /** Build the shared analytics context from widget config. */
  protected analyticsContext(): AnalyticsContext {
    const ctx: AnalyticsContext = {
      account_id: this.config.accountId,
      session_id: this.config.session?.sessionId ?? '',
      correlation_id: this.config.session?.sessionId ?? '',
    };
    if (this.config.session?.viewId !== undefined) ctx.view_id = this.config.session.viewId;
    if (this.config.session?.userId !== undefined) ctx.user_id = this.config.session.userId;
    if (this.config.pageContext?.pageType !== undefined) ctx.page_type = this.config.pageContext.pageType;
    if (this.config.pageContext?.sku !== undefined) ctx.sku = this.config.pageContext.sku;
    if (this.config.session?.abTestVariant !== undefined) ctx.ab_test_variant = this.config.session.abTestVariant;
    if (this.config.session?.abTestExperimentId !== undefined)
      ctx.ab_test_experiment_id = this.config.session.abTestExperimentId;
    return ctx;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _resolveMount(target?: HTMLElement | string): HTMLElement {
    if (target instanceof HTMLElement) return target;
    if (typeof target === 'string') {
      const el = document.querySelector<HTMLElement>(target);
      if (!el) throw new Error(`[gengage] Mount target not found: "${target}"`);
      return el;
    }
    // Default: create a div prepended to body so the widget's launcher appears
    // near the start of the tab order rather than being buried at the very end
    // (which would force keyboard-only users to tab through the entire page).
    const div = document.createElement('div');
    div.dataset['gengageWidget'] = this.constructor.name.toLowerCase();
    document.body.insertBefore(div, document.body.firstChild);
    this._ownsRoot = true;
    return div;
  }

  private _applyTheme(theme?: WidgetTheme): void {
    if (!theme) return;
    for (const [key, value] of Object.entries(theme)) {
      if (value !== undefined) {
        const prop = key.startsWith('--') ? key : `--gengage-${toKebab(key)}`;
        this.root.style.setProperty(prop, value);
      }
    }
  }
}

function toKebab(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

// ---------------------------------------------------------------------------
// Chat widget public API (exposed on window.gengage.chat)
// ---------------------------------------------------------------------------

export interface ChatPublicAPI {
  open(options?: { state?: 'full' | 'half'; initialMessage?: string; source?: string }): void;
  openWithAction(
    action: import('./types.js').ActionPayload,
    options?: { sku?: string; state?: 'full' | 'half'; source?: string },
  ): void;
  /** Send a user message programmatically (same as typing + submit). */
  sendMessage(text: string): void;
  /** Send a backend action programmatically. */
  sendAction(action: import('./types.js').ActionPayload, options?: { silent?: boolean }): void;
  close(): void;
  saveSession(sessionId: string, sku: string): void;
  readonly isOpen: boolean;
  on(
    event: 'open' | 'close' | 'ready' | 'message' | 'error' | 'context-update' | 'destroy',
    handler: (...args: unknown[]) => void,
  ): () => void;
  trackCheckout(
    type: 'start' | 'complete',
    data: {
      attribution_source: 'chat' | 'qna' | 'simrel';
      attribution_action_id: string;
      cart_value: number;
      currency: string;
      line_items: number;
    },
  ): void;
  flushMeteringSummary(data: { meter_key: string; quantity: number; unit: string }): void;
  /**
   * Register a callback for a GA4 event name.
   * When the widget fires that event, the callback is invoked with the event detail.
   * Callbacks that return `false` or throw signal failure — the widget reacts accordingly
   * (e.g. showing an error message for add-to-cart failures).
   *
   * @returns unsubscribe function
   */
  addCallback(eventName: string, callback: (detail: Record<string, unknown>) => boolean | Promise<boolean>): () => void;
}

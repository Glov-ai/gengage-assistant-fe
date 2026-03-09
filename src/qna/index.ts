/**
 * QNA widget -- public entry point.
 *
 * Renders contextual action buttons (and an optional free-text input) on
 * product or content pages. When a user taps a button, the widget opens
 * the Chat widget with that action pre-loaded.
 *
 * Backend: POST /chat/launcher_action
 * Protocol: NDJSON stream -> json-render UISpec -> ActionButton / ButtonRow / TextInput
 */

import type { ActionPayload, PageContext, UISpec, UIElement } from '../common/types.js';
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
  widgetHistorySnapshotEvent,
} from '../common/analytics-events.js';
import { fetchLauncherActions } from './api.js';
import * as ga from '../common/ga-datalayer.js';
import {
  createDefaultQnaUISpecRegistry,
  defaultQnaUnknownUISpecRenderer,
  renderQnaUISpec,
} from './components/renderUISpec.js';
import type { QNAWidgetConfig, QNAI18n, QNAUISpecRenderContext } from './types.js';
import { QNA_I18N_TR, resolveQnaLocale } from './locales/index.js';

// Inline CSS import marker - Vite will bundle this
import './components/qna.css';

/**
 * Contextual Q&A action buttons for product pages.
 * Renders quick-action buttons that open the chat widget with a pre-built query.
 *
 * @example
 * ```ts
 * import { GengageQNA, wireQNAToChat, bootstrapSession } from '@gengage/assistant-fe';
 *
 * const qna = new GengageQNA();
 * await qna.init({
 *   accountId: 'mystore',
 *   middlewareUrl: 'https://chat.gengage.ai',
 *   mountTarget: '#qna-section',
 *   pageContext: { pageType: 'pdp', sku: '12345' },
 *   session: { sessionId: bootstrapSession() },
 * });
 * wireQNAToChat(); // Wire button clicks to chat.openWithAction()
 * ```
 */
export class GengageQNA extends BaseWidget<QNAWidgetConfig> {
  private _abortController: AbortController | null = null;
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _contentEl: HTMLElement | null = null;
  private _lastSku: string | undefined;
  private _i18n: QNAI18n = QNA_I18N_TR;

  protected async onInit(config: QNAWidgetConfig): Promise<void> {
    this._i18n = this._resolveI18n(config);

    this._contentEl = document.createElement('div');
    this._contentEl.className = 'gengage-qna-container';
    this.root.appendChild(this._contentEl);

    const sku = config.pageContext?.sku;
    if (sku) {
      this._lastSku = sku;
      await this._fetchAndRender(sku);
    }

    this.isVisible = true;
    ga.trackInit('qna');
  }

  protected onUpdate(context: Partial<PageContext>): void {
    const newSku = context.sku;
    if (!newSku || newSku === this._lastSku) return;

    // Debounce rapid SPA navigations
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      this._lastSku = newSku;
      void this._fetchAndRender(newSku);
    }, 50);
  }

  protected onShow(): void {
    if (this._contentEl) {
      this._contentEl.style.opacity = '0';
      this._contentEl.style.transition = 'opacity 0.2s ease-in';
      requestAnimationFrame(() => {
        if (this._contentEl) this._contentEl.style.opacity = '1';
      });
    }
  }

  protected onHide(): void {
    // Preserve fetched data for re-show
  }

  protected onDestroy(): void {
    this._abort();
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    if (this._contentEl) {
      this._cleanupTextInputTimers();
      this._contentEl.remove();
      this._contentEl = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private _abort(): void {
    this._abortController?.abort();
    this._abortController = null;
  }

  /** Clean up TextInput placeholder rotation timers to prevent interval leaks. */
  private _cleanupTextInputTimers(): void {
    if (!this._contentEl) return;
    const wrappers = this._contentEl.querySelectorAll('.gengage-qna-input-wrapper');
    for (const wrapper of wrappers) {
      (wrapper as HTMLElement & { _cleanup?: () => void })._cleanup?.();
    }
  }

  private async _fetchAndRender(sku: string): Promise<void> {
    this._abort();
    this._abortController = new AbortController();

    if (!this._contentEl) return;
    // Clean up TextInput timers before clearing DOM to prevent interval leaks
    this._cleanupTextInputTimers();
    this._contentEl.innerHTML = '';

    // Show loading dots
    const loading = this._createLoadingIndicator();
    this._contentEl.appendChild(loading);

    const transport: ChatTransportConfig = {
      middlewareUrl: this.config.middlewareUrl,
    };

    const requestId = crypto.randomUUID();
    const fetchStart = Date.now();

    this.track(
      streamStartEvent(this.analyticsContext(), {
        endpoint: 'launcher_action',
        request_id: requestId,
        widget: 'qna',
      }),
    );

    try {
      const launcherReq: import('./api.js').LauncherActionRequest = {
        account_id: this.config.accountId,
        session_id: this.config.session?.sessionId ?? '',
        correlation_id: this.config.session?.sessionId ?? '',
        sku,
        locale: this.config.locale ?? 'tr',
      };
      const pageType = this.config.pageContext?.pageType;
      if (pageType !== undefined) launcherReq.page_type = pageType;

      const result = await fetchLauncherActions(launcherReq, transport, this._abortController.signal);

      this.track(
        streamDoneEvent(this.analyticsContext(), {
          request_id: requestId,
          latency_ms: Date.now() - fetchStart,
          chunk_count: result.actions.length,
          widget: 'qna',
        }),
      );

      this.track(
        widgetHistorySnapshotEvent(this.analyticsContext(), {
          message_count: result.actions.length,
          history_ref: requestId,
          redaction_level: 'none',
          widget: 'qna',
        }),
      );

      if (!this._contentEl) return;
      this._contentEl.innerHTML = '';

      const hasQuestionHeading = this._specIncludesType(result.uiSpecs, 'QuestionHeading');

      // Render heading if configured and backend didn't provide one
      if (!hasQuestionHeading && this.config.showStaticQuestion && this.config.staticQuestionText) {
        const heading = document.createElement('h3');
        heading.className = 'gengage-qna-heading';
        heading.textContent = this.config.staticQuestionText;
        this._contentEl.appendChild(heading);
      }

      const cfgPlaceholders = this.config.inputPlaceholder;
      const effectivePlaceholders =
        result.actions.length > 0 && cfgPlaceholders === true
          ? result.actions.map((a) => a.title)
          : cfgPlaceholders === true
            ? this._i18n.defaultInputPlaceholder
            : (cfgPlaceholders ?? this._i18n.defaultInputPlaceholder);

      const renderContext: QNAUISpecRenderContext = {
        onAction: this._actionHandler,
        i18n: this._i18n,
      };
      if (!this.config.hideButtonRowCta) {
        renderContext.onOpenChat = this._openChatHandler;
        if (this.config.ctaText !== undefined) renderContext.ctaText = this.config.ctaText;
      }
      if (effectivePlaceholders !== undefined) renderContext.inputPlaceholder = effectivePlaceholders;

      const fallbackSpec = this._buildFallbackActionsSpec(result.actions);
      const specsToRender = result.uiSpecs.length > 0 ? result.uiSpecs : [fallbackSpec];
      const nonEmptySpecs = specsToRender.filter((spec) => Object.keys(spec.elements).length > 0);

      for (const spec of nonEmptySpecs) {
        const rendered = this._renderUISpec(spec, renderContext);
        this._contentEl.appendChild(rendered);
      }

      if (nonEmptySpecs.length > 0) {
        ga.trackShow('qna');
      }

      const shouldRenderStandaloneInput = !this._specIncludesType(nonEmptySpecs, 'TextInput');
      if (shouldRenderStandaloneInput) {
        this._appendStandaloneInput(renderContext, effectivePlaceholders);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;

      dispatch('gengage:global:error', {
        source: 'qna',
        code: 'FETCH_ERROR',
        message: getGlobalErrorMessage(this.config.locale),
      });

      this.track(
        streamErrorEvent(this.analyticsContext(), {
          request_id: requestId,
          error_code: 'FETCH_ERROR',
          error_message: err instanceof Error ? err.message : String(err),
          widget: 'qna',
        }),
      );

      // Keep QNA usable during backend hiccups: render at least free-text input.
      if (this._contentEl) {
        this._cleanupTextInputTimers();
        this._contentEl.innerHTML = '';
        const fallbackPlaceholders =
          this.config.inputPlaceholder === true
            ? this._i18n.defaultInputPlaceholder
            : (this.config.inputPlaceholder ?? this._i18n.defaultInputPlaceholder);
        const fallbackContext: QNAUISpecRenderContext = {
          onAction: this._actionHandler,
          i18n: this._i18n,
          onOpenChat: this._openChatHandler,
        };
        if (this.config.ctaText !== undefined) fallbackContext.ctaText = this.config.ctaText;
        this._appendStandaloneInput(fallbackContext, fallbackPlaceholders);
      }

      if (import.meta.env?.DEV) {
        console.error('[gengage:qna] Failed to fetch launcher actions:', err);
      }
    }
  }

  private _createLoadingIndicator(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'gengage-qna-loading';
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('div');
      dot.className = 'gengage-qna-loading-dot';
      el.appendChild(dot);
    }
    return el;
  }

  private _resolveI18n(config: QNAWidgetConfig): QNAI18n {
    const base = resolveQnaLocale(config.locale);
    return { ...base, ...config.i18n };
  }

  private _resolveUISpecRegistry() {
    const baseRegistry = createDefaultQnaUISpecRegistry();
    return mergeUISpecRegistry(baseRegistry, this.config.renderer?.registry);
  }

  private _renderUISpec(spec: UISpec, context: QNAUISpecRenderContext): HTMLElement {
    const registry = this._resolveUISpecRegistry();
    const unknownRenderer = this.config.renderer?.unknownRenderer ?? defaultQnaUnknownUISpecRenderer;
    const defaultRender = (inputSpec: UISpec, inputContext: QNAUISpecRenderContext) =>
      renderQnaUISpec(inputSpec, inputContext, registry, unknownRenderer);

    const override = this.config.renderer?.renderUISpec;
    if (!override) return defaultRender(spec, context);

    const helpers: UISpecRenderHelpers<QNAUISpecRenderContext> = {
      registry,
      unknownRenderer,
      defaultRender,
    };
    return override(spec, context, helpers);
  }

  private _specIncludesType(specs: UISpec[], type: string): boolean {
    for (const spec of specs) {
      for (const element of Object.values(spec.elements)) {
        if (element.type === type) return true;
      }
    }
    return false;
  }

  private _buildFallbackActionsSpec(actions: Array<{ title: string; type: string; payload?: unknown }>): UISpec {
    if (actions.length === 0) {
      return { root: 'root', elements: {} };
    }

    const elements: Record<string, UIElement> = {};
    const childIds: string[] = [];
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i]!;
      const id = `action-${i}`;
      childIds.push(id);
      elements[id] = {
        type: 'ActionButton',
        props: {
          label: action.title,
          action: {
            title: action.title,
            type: action.type,
            payload: action.payload,
          },
        },
      };
    }
    elements['root'] = {
      type: 'ButtonRow',
      children: childIds,
    };
    return {
      root: 'root',
      elements,
    };
  }

  private _appendStandaloneInput(context: QNAUISpecRenderContext, placeholder?: string | string[]): void {
    if (!this._contentEl) return;
    const inputSpec: UISpec = {
      root: 'root',
      elements: {
        root: {
          type: 'TextInput',
          props: {
            placeholder,
          },
        },
      },
    };
    const renderedInput = this._renderUISpec(inputSpec, context);
    this._contentEl.appendChild(renderedInput);
  }

  private _handleAction(action: ActionPayload): void {
    ga.trackSuggestedQuestion(action.title, action.type);
    this.config.onActionSelected?.(action);
    dispatch('gengage:qna:action', action);
  }

  private _handleOpenChat(): void {
    // Couple CTA with the inline QNA text input when available.
    const input = this._contentEl?.querySelector<HTMLInputElement>('.gengage-qna-input');
    if (input) {
      input.focus();
    }
    this.config.onOpenChat?.();
    dispatch('gengage:qna:open-chat', {});
  }

  _actionHandler = this._handleAction.bind(this);
  _openChatHandler = this._handleOpenChat.bind(this);
}

export function createQNAWidget(): GengageQNA {
  return new GengageQNA();
}

export type { QNAWidgetConfig, QNAUIComponents, QNAI18n, QNAUISpecRenderContext, QNARendererConfig } from './types.js';
export {
  renderQnaUISpec,
  createDefaultQnaUISpecRegistry,
  defaultQnaUnknownUISpecRenderer,
} from './components/renderUISpec.js';
export type { QNAUISpecRegistry } from './components/renderUISpec.js';
export { qnaCatalog } from './catalog.js';
export type { QNACatalog, QNAComponentName } from './catalog.js';

/**
 * Chat widget -- public entry point.
 *
 * Renders a floating launcher button + slide-in chat drawer inside Shadow DOM
 * for CSS isolation. Handles streaming NDJSON from the backend.
 */

import type { ActionPayload, PageContext, StreamEvent, StreamEventAction, UIElement, UISpec } from '../common/types.js';
import type { ChatTransportConfig } from '../common/api-paths.js';
import type { ActionRouterOptions } from '../common/action-router.js';
import type { UISpecRenderHelpers } from '../common/renderer/index.js';
import type { BridgeMessage, CommunicationBridgeOptions } from '../common/communication-bridge.js';
import type { BackendRequestMeta } from './api.js';
import { mergeUISpecRegistry } from '../common/renderer/index.js';
import { BaseWidget } from '../common/widget-base.js';
import { dispatch } from '../common/events.js';
import { uuidv7 } from '../common/uuidv7.js';
import { CommunicationBridge } from '../common/communication-bridge.js';
import { routeStreamAction } from '../common/action-router.js';
import {
  streamStartEvent,
  streamChunkEvent,
  streamDoneEvent,
  streamErrorEvent,
  streamUiSpecEvent,
  llmUsageEvent,
  meteringIncrementEvent,
  chatHistorySnapshotEvent,
  basketAddEvent,
} from '../common/analytics-events.js';
import { sanitizeHtml, isSafeUrl } from '../common/safe-html.js';
import { resolveLocaleTag } from '../common/locale.js';
import { debugLog } from '../common/debug.js';
import { escapeCssIdentifier } from '../common/css-escape.js';
import { validateImageFile } from './attachment-utils.js';
import { sendChatMessage, enrichActionPayload } from './api.js';
import { ChatDrawer } from './components/ChatDrawer.js';
import { AssistantModeController } from './features/beauty-consulting/mode-controller.js';
import {
  createBeautyStreamState,
  handleBeautyUISpec,
  isPhotoAnalysisMessage,
  flushBeautyStreamComplete,
  flushBeautyStreamError,
} from './features/beauty-consulting/stream-handler.js';
import {
  detectConsultingGrid,
  isConsultingGridReady,
  patchConsultingGridDom,
} from './features/beauty-consulting/consulting-grid.js';
import { createLauncher } from './components/Launcher.js';
import type { LauncherElements } from './components/Launcher.js';
import { playTtsAudio } from '../common/tts-player.js';
import type { AudioHandle } from '../common/tts-player.js';
import {
  renderUISpec,
  createDefaultChatUISpecRegistry,
  defaultChatUnknownUISpecRenderer,
} from './components/renderUISpec.js';
import { renderFloatingComparisonButton } from './components/FloatingComparisonButton.js';
import type { TypewriterHandle } from './components/typewriter.js';
import { typewriteHtml } from './components/typewriter.js';
import { linkProductMentions } from './components/productMentionLinker.js';
import { isInputAreaAction } from './components/actionClassifier.js';
import type { ThumbnailEntry } from './components/ThumbnailsColumn.js';
import {
  clearChoicePrompterDismissState,
  createChoicePrompter,
  isChoicePrompterDismissed,
  recordChoicePrompterDismissedForThread,
} from './components/ChoicePrompter.js';
import type {
  ChatActionChip,
  OpeningContextKey,
  ChatWidgetConfig,
  ChatMessage,
  ChatI18n,
  ChatUISpecRenderContext,
  ChatUISpecRegistry,
  ProductSortState,
} from './types.js';
import { GengageIndexedDB } from '../common/indexed-db.js';
import { CHAT_I18N_TR, resolveChatLocale } from './locales/index.js';
import { ExtendedModeManager } from './extendedModeManager.js';
import { PanelManager, determinePanelUpdateAction, type PanelUpdateAction } from './panel-manager.js';
import { SessionPersistence } from './session-persistence.js';
import { ChatPresentationState, getLatestUnreadAssistantThreadId } from './chat-presentation-state.js';
import { invalidateChatScrollCache } from './utils/get-chat-scroll-element.js';
import { isLikelyConnectivityIssue } from '../common/global-error-toast.js';
import { makePillLauncher } from '../common/pill-launcher.js';
import { shouldShowStreamErrorAsRedStrip } from './stream-error-display.js';
import {
  containsKvkk,
  isKvkkShown,
  markKvkkShown,
  stripKvkkBlock,
  extractKvkkBlock,
  localeToOutputLanguage,
} from './kvkk.js';

import chatStyles from './components/chat.css?inline';
import * as ga from '../common/ga-datalayer.js';

/**
 * Panel rebuild source for local drilldown history and stream-end snapshots.
 * `productDetailsWithSimilars` keeps PDP + appended similar grid in sync when
 * similars arrive in a second stream chunk (DOM append does not update `spec` alone).
 */
type PanelSource =
  | { kind: 'spec'; spec: UISpec }
  | { kind: 'productDetailsWithSimilars'; pdpSpec: UISpec; similarsSpec: UISpec }
  | { kind: 'favorites' };
const CONTEXT_LAUNCH_TYPES = new Set(['launchSingleProduct', 'launchProductList', 'launchHomepage']);

type SendActionOptions = {
  silent?: boolean;
  attachment?: File;
  preservePanel?: boolean;
  isContextPrime?: boolean;
  preservePills?: boolean;
};

/** Validate that a string is a safe CSS color value (no url(), expression(), etc.). */
function isSafeCSSColor(value: string): boolean {
  if (value.length > 120) return false;
  // Only allow characters found in valid CSS colors: hex digits, letters, parens,
  // commas, dots, spaces, percent, slash (modern color syntax), and hyphens.
  return /^[a-zA-Z0-9#(),.\s%/\-]+$/.test(value);
}

/** Lightweight runtime check: value looks like an ActionPayload (has a string `type`). */
function isActionLike(value: unknown): value is ActionPayload {
  return typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>).type === 'string';
}

import type { AssistantMode } from './assistant-mode.js';
import { asRecord } from './assistant-mode.js';

/**
 * Floating AI chat widget with streaming NDJSON responses, product cards, and comparison tables.
 *
 * @example
 * ```ts
 * import { GengageChat, bootstrapSession } from '@gengage/assistant-fe';
 *
 * const chat = new GengageChat();
 * await chat.init({
 *   accountId: 'mystore',
 *   middlewareUrl: '<backend service location provided for your Gengage account>',
 *   session: { sessionId: bootstrapSession() },
 * });
 * chat.open(); // Programmatically open the drawer
 * ```
 */
export function isSimilarsAppendGrid(element: UIElement | undefined): boolean {
  return element?.type === 'ProductGrid' && element.props?.['similarsAppend'] === true;
}

export class GengageChat extends BaseWidget<ChatWidgetConfig> {
  private static readonly _MAX_COMPARISON_SELECTION = 5;
  private _shadow: ShadowRoot | null = null;
  private _rootEl: HTMLElement | null = null;
  /** Full-viewport scrim when drawer is open (floating/overlay); not used for inline. */
  private _backdropEl: HTMLElement | null = null;
  private _launcher: LauncherElements | null = null;
  private _drawer: ChatDrawer | null = null;
  private _bridge: CommunicationBridge | null = null;
  private _drawerVisible = false;
  /** Set when `config.pillLauncher` is used — `apply()` runs at end of `onInit`. */
  private _pillLauncherApply: (() => Promise<void>) | null = null;
  /**
   * Host scroll blocked via capture-phase `touchmove`/`wheel` + preventDefault on `window` and
   * `document`, `scroll` pin for the viewport, temporary `overflow` / `overscroll-behavior` on
   * `html`/`body` (restored on release).
   */
  private _hostScrollLockActive = false;
  private _hostOverflowRestore: {
    htmlOverflow: string;
    bodyOverflow: string;
    htmlOverscroll: string;
    bodyOverscroll: string;
  } | null = null;
  /** Viewport scroll position captured when the lock starts (Windows / nested layouts). */
  private _hostScrollLockViewport: { x: number; y: number } | null = null;
  private _hostScrollPinning = false;
  private readonly _preventHostDocumentTouchMove = (e: TouchEvent): void => {
    if (!this._hostScrollLockActive) return;
    if (this._hostScrollEventShouldReachChatScroller(e)) return;
    e.preventDefault();
  };
  private readonly _preventHostDocumentWheel = (e: WheelEvent): void => {
    if (!this._hostScrollLockActive) return;
    if (this._hostScrollEventShouldReachChatScroller(e)) return;
    e.preventDefault();
  };
  private readonly _pinHostViewportScroll = (): void => {
    if (!this._hostScrollLockActive || !this._hostScrollLockViewport || this._hostScrollPinning) return;
    const t = this._hostScrollLockViewport;
    if (window.scrollX === t.x && window.scrollY === t.y) return;
    this._hostScrollPinning = true;
    window.scrollTo(t.x, t.y);
    this._hostScrollPinning = false;
  };
  private _messages: ChatMessage[] = [];
  // Bot text accumulation is now closure-local inside _sendAction to prevent
  // corruption when concurrent preservePanel streams write simultaneously.
  private _currentMessageId = 0;
  private _abortControllers = new Set<AbortController>();
  /** Current thread cursor — only messages with threadId <= this are visible. */
  private _currentThreadId: string | null = null;
  /** Most recent threadId ever created — used to detect branch points. */
  private _lastThreadId: string | null = null;
  /** Timestamp when the chat session was created (ISO 8601). */
  private _chatCreatedAt = '';
  /** Last backend-streamed context object — sent back with every request. */
  private _lastBackendContext: import('../common/types.js').BackendContext | null = null;
  private _productSort: ProductSortState = { type: 'related' };
  private _lastSku: string | undefined;
  private _lastPageType: string | undefined;
  private _lastSkuListKey: string | undefined;
  private _comparisonSelectMode = false;
  private _comparisonSelectedSkus: string[] = [];
  private _comparisonSelectionWarning: string | null = null;
  private _comparisonRefreshRafId: number | null = null;
  /** SKUs of products the user has viewed across panel product grids. */
  private _viewedProductSkus = new Set<string>();
  private _thumbnailEntries: ThumbnailEntry[] = [];
  private _choicePrompterEl: HTMLElement | null = null;
  private _openState: 'full' | 'half' = 'full';
  private _mobileBreakpoint = 768;
  private _isMobileViewport = false;
  /** GA: previous MainPane expanded state for `gengage-chatbot-maximized` edge detection. */
  private _gaPrevMainPaneExpanded = false;
  private _pdpLaunched = false;
  private _plpLaunched = false;
  private _homepageLaunched = false;
  private _entryContextPrimed = false;
  /** True while a silent context-prime launch (PDP/PLP/homepage) is in flight. */
  private _contextPrimingInFlight = false;
  /** User messages queued until context priming completes. */
  private _queuedUserMessages: Array<{ text: string; attachment?: File }> = [];
  private _productContextUnavailableSku: string | null = null;
  private _i18n: ChatI18n = CHAT_I18N_TR;
  private _extendedModeManager: ExtendedModeManager | null = null;
  /** Active typewriter animation handle — cancelled on new action or drawer close. */
  private _activeTypewriter: TypewriterHandle | null = null;
  /** Active TTS audio handle — stopped on new stream start or drawer close. */
  private _activeTtsHandle: AudioHandle | null = null;
  /** Active request thread ID — guards against stale stream events from cancelled requests. */
  private _activeRequestThreadId: string | null = null;
  /** Accumulated SKU → product item map from outputText events. */
  private _skuToProductItem: Record<string, Record<string, unknown>> = {};
  /** Current conversation mode from the latest outputText event. */
  private _conversationMode: string | null = null;
  /** Whether initialization (including IDB restore) has completed. */
  private _initComplete = false;
  /** Queue of actions received before init completes. Max 10, FIFO discard. */
  private _pendingActions: Array<{
    action: ActionPayload;
    options?: SendActionOptions | undefined;
  }> = [];
  /** Supplemental context received from host via bridge (e.g. PDP detail context). */
  private _bridgeContext: Record<string, unknown> | null = null;
  /** Last cart quantity received from host via bridge. */
  private _cartQuantity: number | null = null;
  private _threadsWithFirstBot: Set<string> = new Set();
  /** Panel state manager (snapshots, topbar, navigation). */
  private _panel: PanelManager | null = null;
  /** Client-side panel navigation stack for local drilldowns (e.g. card → detail). Max 10 entries.
   *  Stores rebuild info (UISpec or kind) instead of DOM clones so back navigation
   *  produces fresh elements with live event listeners. */
  private _localPanelHistory: Array<{
    source: PanelSource;
    title: string;
  }> = [];
  private static readonly _MAX_PANEL_HISTORY = 10;
  /** Tracks how the current panel content was produced, for history/error-recovery rebuild. */
  private _currentPanelSource: PanelSource | null = null;
  /** IndexedDB session persistence manager. */
  private _session: SessionPersistence | null = null;
  /** Transcript focus, pin-to-bottom, and scroll request coordination. */
  private readonly _presentation = new ChatPresentationState();
  /** Registered event callbacks (GA4 event hooks). Key = event name, value = set of callbacks. */
  private _eventCallbacks = new Map<string, Set<(detail: Record<string, unknown>) => boolean | Promise<boolean>>>();
  /** Last sent action+options for retry on error. */
  private _lastSentAction: {
    action: ActionPayload;
    options?: SendActionOptions | undefined;
  } | null = null;
  /** Consecutive identical error counter for account-inactive detection. */
  private _consecutiveErrorCount = 0;
  /** Last error message text for deduplication. */
  private _lastErrorMessage = '';
  private _modeController = new AssistantModeController();
  /** @deprecated Alias for backward compat in tests. Use _modeController.mode. */
  get _assistantMode(): AssistantMode {
    return this._modeController.mode;
  }
  set _assistantMode(value: AssistantMode) {
    this._modeController.mode = value;
  }
  /** @deprecated Alias for backward compat in tests. Use _modeController.uiHints. */
  get _uiHints(): Record<string, unknown> | null {
    return this._modeController.uiHints;
  }
  set _uiHints(value: Record<string, unknown> | null) {
    this._modeController.uiHints = value;
  }

  protected async onInit(config: ChatWidgetConfig): Promise<void> {
    this._i18n = this._resolveI18n(config);
    this._chatCreatedAt = new Date().toISOString();

    if (config.pillLauncher) {
      const kit = makePillLauncher(config.pillLauncher);
      config.launcherImageUrl = kit.launcherImageUrl;
      if (config.headerAvatarUrl === undefined) {
        config.headerAvatarUrl = config.pillLauncher.avatarUrl;
      }
      this._pillLauncherApply = () => kit.apply(this._shadow ?? undefined);
    }

    // Create Shadow DOM for CSS isolation
    this._shadow = this.root.attachShadow({ mode: 'open' });

    // Inject styles
    const style = document.createElement('style');
    style.textContent = chatStyles;
    this._shadow.appendChild(style);

    // Apply theme CSS custom properties on the shadow host so they cascade into the shadow tree.
    // Priority: explicit config fields > theme object entries > CSS defaults.
    const host = this.root as HTMLElement;
    const applyVar = (cssVar: string, value: string | undefined): void => {
      if (value && isSafeCSSColor(value)) host.style.setProperty(cssVar, value);
    };
    // Explicit header color shortcuts
    applyVar('--gengage-chat-header-bg', config.headerBg);
    applyVar('--gengage-chat-header-foreground', config.headerForeground);
    // Arbitrary theme tokens (e.g. theme['--gengage-primary-color'])
    if (config.theme) {
      for (const [key, value] of Object.entries(config.theme)) {
        if (key.startsWith('--') && typeof value === 'string') {
          applyVar(key, value);
        }
      }
    }

    this._applyDiscountedPriceColorVar(config.productPriceUi?.discountedPriceColor);

    // Create root container
    const rootEl = document.createElement('div');
    rootEl.className = 'gengage-chat-root';
    rootEl.lang = resolveLocaleTag(config.locale);
    this._rootEl = rootEl;
    this._shadow.appendChild(rootEl);

    const variant = config.variant ?? 'floating';
    if (variant === 'inline') {
      rootEl.classList.add('gengage-chat--inline');
    }

    // Dim page + click outside to close (not for inline — drawer is embedded)
    if (variant !== 'inline') {
      const backdropEl = document.createElement('div');
      backdropEl.className = 'gengage-chat-backdrop';
      backdropEl.setAttribute('aria-hidden', 'true');
      backdropEl.setAttribute('role', 'button');
      backdropEl.setAttribute('tabindex', '-1');
      backdropEl.setAttribute('aria-label', this._i18n.closeAriaLabel);
      backdropEl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      });
      this._backdropEl = backdropEl;
      rootEl.prepend(backdropEl);
    }

    // Create launcher (floating variant only — inline/overlay are triggered programmatically)
    if (variant === 'floating') {
      const launcherOpts: import('./components/Launcher.js').LauncherOptions = {
        onClick: () => this.open(),
        ariaLabel: this._i18n.openButton,
      };
      if (config.launcherImageUrl !== undefined) launcherOpts.imageUrl = config.launcherImageUrl;
      else if (config.launcherSvg !== undefined) launcherOpts.svgMarkup = config.launcherSvg;
      if (config.hideMobileLauncher !== undefined) launcherOpts.hideMobile = config.hideMobileLauncher;
      if (config.mobileBreakpoint !== undefined) launcherOpts.mobileBreakpoint = config.mobileBreakpoint;
      if (config.launcherTooltip !== undefined) launcherOpts.tooltip = config.launcherTooltip;
      this._launcher = createLauncher(launcherOpts);
      rootEl.appendChild(this._launcher.container);
    }

    // Overlay variant wraps drawer in a backdrop for full-screen modal
    if (variant === 'overlay') {
      rootEl.classList.add('gengage-chat--overlay');
    }

    // Create drawer (hidden initially for floating/overlay, visible for inline)
    const drawerContainer = document.createElement('div');
    rootEl.appendChild(drawerContainer);

    this._drawer = new ChatDrawer(drawerContainer, {
      i18n: this._i18n,
      onSend: (text, attachment) => this._sendMessage(text, attachment),
      onClose: () => this.close(),
      onAttachment: (file) => this._handleAttachment(file),
      onPanelToggle: () => {
        this._drawer?.persistPanelState(config.accountId);
      },
      onHostShellSync: () => {
        this._applyOpenStateClasses();
      },
      onRollback: (messageId) => this._handleRollback(messageId),
      onPanelBack: () => this._navigatePanelBack(),
      onPanelForward: () => this._panel?.navigateForward(),
      onPanelClose: () => {
        // Mobile ✕: panel is only hidden (content kept); header reopen stays meaningful.
        if (this._isMobileViewport) {
          this._comparisonSelectMode = false;
          this._comparisonSelectedSkus = [];
          return;
        }
        this._localPanelHistory = [];
        this._comparisonSelectMode = false;
        this._comparisonSelectedSkus = [];
        this._currentPanelSource = null;
      },
      headerTitle: config.headerTitle,
      headerAvatarUrl: config.headerAvatarUrl,
      launcherImageUrl: config.launcherImageUrl,
      headerBadge: config.headerBadge,
      headerCartUrl: config.headerCartUrl,
      showHeaderFavorites: typeof config.onFavoritesClick === 'function' || config.headerFavoritesToggle === true,
      onCartClick: () => {
        if (config.headerCartUrl) {
          this._saveSessionAndOpenURL(config.headerCartUrl);
        } else {
          config.onCartClick?.();
        }
      },
      onFavoritesClick: () => {
        ga.trackLikeList();
        if (typeof config.onFavoritesClick === 'function') {
          config.onFavoritesClick();
          return;
        }
        this._openFavoritesPanel();
      },
      getMobileState: () => this._openState ?? 'full',
      getMobileViewport: () => this._isMobileViewport,
      onMobileSnap: (state) => {
        if (state === 'close') {
          this.close();
        } else {
          this._openState = state;
          this._applyOpenStateClasses();
        }
      },
      onThumbnailClick: (threadId) => this._rollbackToThread(threadId),
      onLinkClick: (url) => {
        this._saveSessionAndOpenURL(url);
      },
      voiceEnabled: config.voiceEnabled,
      voiceLang: config.locale
        ? `${config.locale.split('-')[0] ?? 'tr'}-${(config.locale.split('-')[1] ?? config.locale.split('-')[0] ?? 'TR').toUpperCase()}`
        : undefined,
      presentation: {
        onPinnedToBottomChange: (pinned) => {
          this._presentation.pinnedToBottom = pinned;
        },
        onUserInteractingChange: (interacting) => {
          this._presentation.userInteracting = interacting;
        },
        onFormerMessagesHint: () => {
          if (this._presentation.focusedThreadId && this._hasMultipleThreadIds()) {
            this._drawer?.setFormerMessagesButtonVisible(true);
          }
        },
        shouldBlockSoftAutoScroll: () => this._presentation.shouldBlockStreamAutoScroll(),
        onReleasePresentationFocus: () => this._releasePresentationFocus(),
      },
    });
    this._applyUiHints();

    // Extended mode manager for host PDP maximize/minimize
    this._extendedModeManager = new ExtendedModeManager({
      onChange: (extended) => this._panel?.notifyExtension(extended),
      productDetailsInPanel: (config.isDemoWebsite ?? false) && (config.productDetailsExtended ?? false),
    });

    // Panel manager for snapshot/topbar/navigation state
    this._panel = new PanelManager({
      drawer: () => this._drawer,
      shadow: () => this._shadow,
      currentThreadId: () => this._currentThreadId,
      bridge: () => this._bridge,
      extendedModeManager: () => this._extendedModeManager,
      i18n: () => this._i18n,
      rollbackToThread: (tid) => this._rollbackToThread(tid),
    });

    // Hide drawer initially for floating/overlay variants
    if (variant !== 'inline') {
      this._drawer.getElement().classList.add('gengage-chat-drawer--hidden');
    }

    // Restore panel state from session
    const restoredCollapsedPanel = this._drawer.restorePanelState(config.accountId);

    // Panel mode: 'collapsed' starts hidden, 'expanded' starts open, 'auto' (default) expands when content arrives
    const panelMode = config.panelMode ?? 'auto';
    if (panelMode === 'collapsed') {
      this._drawer.setPanelCollapsed(true);
    } else if (panelMode === 'expanded') {
      this._drawer.setForceExpanded();
    } else if (!restoredCollapsedPanel) {
      // 'auto': panel starts collapsed — will expand when content arrives via stream
      // (prevents empty panel being visible on page load/session restore)
    }

    // Restore session if an explicit handoff signal exists (e.g. SimRel product navigation)
    const restoreSessionId = sessionStorage.getItem('gengage_restore_session_id');
    const restoreSku = sessionStorage.getItem('gengage_restore_sku');
    const hasHandoff = !!(restoreSessionId && restoreSku);
    if (hasHandoff) {
      sessionStorage.removeItem('gengage_restore_session_id');
      sessionStorage.removeItem('gengage_restore_sku');
    }

    // IndexedDB persistence — best-effort, non-fatal
    try {
      const idb = new GengageIndexedDB();
      await idb.open();
      this._session = new SessionPersistence(idb);
      await this._restoreFromIndexedDB(hasHandoff);
    } catch {
      // IndexedDB unavailable — continue without persistence
      this._session = new SessionPersistence(null);
    }

    // Register public API on window
    this._registerPublicAPI();

    // Apply mobileInitialState if configured
    if (config.mobileInitialState !== undefined) {
      this._openState = config.mobileInitialState;
    }
    this._mobileBreakpoint = config.mobileBreakpoint ?? 768;

    this._syncViewportState();
    const onResize = () => this._syncViewportState();
    window.addEventListener('resize', onResize, { passive: true });
    this.addCleanup(() => window.removeEventListener('resize', onResize));

    // iOS visualViewport keyboard handling
    if (window.visualViewport) {
      const onViewportResize = () => {
        if (!this._drawerVisible || !this._isMobileViewport) return;
        const el = this._drawer?.getElement();
        if (!el) return;
        const offset = window.innerHeight - (window.visualViewport?.height ?? window.innerHeight);
        el.style.setProperty('--gengage-keyboard-offset', `${Math.max(0, offset)}px`);
      };
      window.visualViewport.addEventListener('resize', onViewportResize);
      this.addCleanup(() => window.visualViewport?.removeEventListener('resize', onViewportResize));
    }

    // Inline variant starts visible (onShow() is not invoked — mirror presentation state here)
    if (variant === 'inline') {
      this._drawerVisible = true;
      this.isVisible = true;
      this._applyOpenStateClasses();
      this._presentation.setShown(true);
      setTimeout(() => this._maybeAutoAnchorUnreadAssistant(), 60);
    }

    // Communication bridge for host ↔ widget messaging
    const bridgeOpts: CommunicationBridgeOptions = {
      namespace: 'chat',
      onMessage: (msg) => this._handleBridgeMessage(msg),
    };
    if (config.allowedOrigins !== undefined) bridgeOpts.allowedOrigins = config.allowedOrigins;
    this._bridge = new CommunicationBridge(bridgeOpts);

    // Track initial page context for SPA navigation detection
    this._lastSku = this.config.pageContext?.sku;
    this._lastPageType = this.config.pageContext?.pageType;
    this._lastSkuListKey = this.config.pageContext?.skuList?.slice(0, 48).join(',');

    // Mark init complete and drain pending actions queue
    this._initComplete = true;
    for (const pending of this._pendingActions) {
      this._sendAction(pending.action, pending.options);
    }
    this._pendingActions = [];

    if (this._pillLauncherApply && variant === 'floating') {
      await this._pillLauncherApply();
      this._pillLauncherApply = null;
    }

    dispatch('gengage:chat:ready', {});
    ga.trackInit('chat');
    config.onReady?.();
  }

  protected onUpdate(context: Partial<PageContext>): void {
    // BaseWidget.update() spread-merges context over old pageContext, which
    // re-introduces stale fields that mergePageContext already deleted.
    // Clean them so request metadata never sends e.g. a PDP sku on a homepage action.
    if (this.config.pageContext && context.pageType !== undefined) {
      const { sku, skuList, ...rest } = this.config.pageContext;
      const cleaned: typeof this.config.pageContext = { ...rest };
      if (cleaned.pageType === 'pdp' && sku !== undefined) cleaned.sku = sku;
      if (cleaned.pageType === 'plp' && skuList !== undefined) cleaned.skuList = skuList;
      this.config = { ...this.config, pageContext: cleaned };
    }

    let shouldReset = false;

    if (context.sku !== undefined && context.sku !== this._lastSku) {
      this._lastSku = context.sku;
      shouldReset = true;
    }
    if (context.pageType !== undefined && context.pageType !== this._lastPageType) {
      this._lastPageType = context.pageType;
      shouldReset = true;
    }
    if (context.skuList !== undefined) {
      const key = context.skuList.slice(0, 48).join(',');
      if (key !== this._lastSkuListKey) {
        this._lastSkuListKey = key;
        shouldReset = true;
      }
    }

    if (shouldReset) this._resetForNewPage();
  }

  protected onShow(): void {
    this._showDrawer();
    this.emit('open');
    dispatch('gengage:chat:open', { state: this._openState });
    ga.trackShow('chat');
    this.config.onOpen?.();

    // Show welcome message on first open with empty history.
    // Dedicated context launches (PDP/PLP/homepage) provide their own greeting,
    // so skip the generic welcome bubble for those page types.
    this._showWelcomeIfNeeded();

    // Prime a contextual opening for blank / homepage / listing states when
    // the merchant configured startup journeys in the SaaS.
    this._maybePrimeEntryContextOpening();

    // Auto-launch PDP context on first open when SKU is available
    if (!this._pdpLaunched && this.config.pageContext?.pageType === 'pdp' && this.config.pageContext?.sku) {
      this._pdpLaunched = true;
      this._contextPrimingInFlight = true;
      this._sendAction(
        {
          title: '',
          type: 'launchSingleProduct',
          payload: {
            sku: this.config.pageContext.sku,
            ...(this._resolveContextualOpeningMessage('product')
              ? { opening_message: this._resolveContextualOpeningMessage('product') }
              : {}),
            ...(this._resolveContextualOpeningGuidance('product')
              ? { opening_guidance: this._resolveContextualOpeningGuidance('product') }
              : {}),
          },
        },
        { silent: true, isContextPrime: true, preservePills: true },
      );
    }

    // Auto-launch PLP context on first open when skuList is available
    if (!this._plpLaunched && this.config.pageContext?.pageType === 'plp' && this.config.pageContext.skuList?.length) {
      this._plpLaunched = true;
      this._contextPrimingInFlight = true;
      this._sendAction(
        {
          title: '',
          type: 'launchProductList',
          payload: { sku_list: this.config.pageContext.skuList.slice(0, 48) },
        },
        { silent: true, isContextPrime: true, preservePills: true },
      );
    }

    // Auto-launch homepage context on first open
    if (!this._homepageLaunched && this.config.pageContext?.pageType === 'home') {
      this._homepageLaunched = true;
      this._contextPrimingInFlight = true;
      this._sendAction(
        {
          title: '',
          type: 'launchHomepage',
          payload: {},
        },
        { silent: true, isContextPrime: true, preservePills: true },
      );
    }
  }

  protected onHide(): void {
    // Floating mode should only hide the drawer, not the launcher button.
    // BaseWidget.hide() toggles `root.style.display = 'none'`, so undo it here.
    if ((this.config.variant ?? 'floating') === 'floating') {
      this.root.style.display = '';
    }
    this._hideDrawer();
    this.emit('close');
    dispatch('gengage:chat:close', {});
    this.config.onClose?.();
  }

  protected onDestroy(): void {
    this._releaseHostDocumentScrollLock();
    this._abortAllActiveRequests();
    this._activeTypewriter?.cancel();
    this._activeTypewriter = null;
    this._activeTtsHandle?.stop();
    this._activeTtsHandle = null;
    if (this._comparisonRefreshRafId !== null) {
      cancelAnimationFrame(this._comparisonRefreshRafId);
      this._comparisonRefreshRafId = null;
    }
    this._drawer?.destroy();
    invalidateChatScrollCache();
    this._drawer = null;
    this._bridge?.destroy();
    this._bridge = null;
    this._extendedModeManager = null;
    this._panel?.destroy();
    this._panel = null;
    this._session?.close();
    this._session = null;
    this._localPanelHistory = [];
    this._currentPanelSource = null;
    if (window.gengage) {
      delete window.gengage.chat;
    }
    if (this._shadow) {
      this._shadow.innerHTML = '';
      this._shadow = null;
    }
    this._rootEl = null;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  open(options?: { state?: 'full' | 'half'; initialMessage?: string }): void {
    if (options?.state !== undefined) {
      this._openState = options.state;
      if (this._drawerVisible) {
        this._applyOpenStateClasses();
      }
    }
    this.show();
    if (options?.initialMessage !== undefined) {
      this._sendMessage(options.initialMessage);
    }
  }

  openWithAction(action: ActionPayload, options?: { sku?: string; state?: 'full' | 'half' }): void {
    if (options?.sku !== undefined) {
      this.update({ sku: options.sku });
    }
    // Mark PDP as launched since we're sending an explicit action
    this._pdpLaunched = true;
    // Action-triggered opens default to half-sheet on mobile
    if (options?.state !== undefined) {
      this._openState = options.state;
    } else if (this._isMobileViewport) {
      this._openState = 'half';
    }
    this.show();
    if (this._drawerVisible) {
      this._applyOpenStateClasses();
    }
    this._sendAction(action);
  }

  /** Send a user message programmatically (same flow as typing + submit). */
  sendMessage(text: string): void {
    this._sendMessage(text);
  }

  /** Send a backend action programmatically. */
  sendAction(action: ActionPayload, options?: { silent?: boolean }): void {
    this._sendAction(action, options);
  }

  close(): void {
    this.hide();
  }

  saveSession(sessionId: string, sku: string): void {
    sessionStorage.setItem('gengage_restore_session_id', sessionId);
    sessionStorage.setItem('gengage_restore_sku', sku);
  }

  get isOpen(): boolean {
    return this._drawerVisible;
  }

  /**
   * Register a callback for integration events (e.g. 'gengage-cart-add', 'gengage-product-favorite').
   * The callback receives the event detail and should return true (success) or false (failure).
   * For add-to-cart, failure triggers an error message in the chat.
   * For product-favorite, failure reverts the heart on the card and shows an error message.
   * @returns unsubscribe function
   */
  addCallback(
    eventName: string,
    callback: (detail: Record<string, unknown>) => boolean | Promise<boolean>,
  ): () => void {
    let set = this._eventCallbacks.get(eventName);
    if (!set) {
      set = new Set();
      this._eventCallbacks.set(eventName, set);
    }
    set.add(callback);
    return () => {
      set!.delete(callback);
      if (set!.size === 0) this._eventCallbacks.delete(eventName);
    };
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private _applyDiscountedPriceColorVar(mode: import('./types.js').DiscountedPriceColor | undefined): void {
    const host = this.root as HTMLElement;
    if (mode === 'client') {
      host.style.setProperty('--gengage-discounted-price-color', 'var(--client-primary)');
    } else {
      host.style.removeProperty('--gengage-discounted-price-color');
    }
  }

  private _abortAllActiveRequests(): void {
    for (const controller of this._abortControllers) {
      controller.abort();
    }
    this._abortControllers.clear();
  }

  /**
   * Drop assistant rows that are still "streaming" with no text when the user starts
   * a new turn. Otherwise each superseded request leaves an empty model message in
   * `_messages` — it is included in `chatHistory` and can confuse the backend and
   * delay or distort the next response.
   */
  private _pruneEmptyStreamingAssistantPlaceholders(): void {
    const next: ChatMessage[] = [];
    let thumbnailsChanged = false;
    for (const m of this._messages) {
      // Also catch status === 'done': the Stop button handler transitions streaming → done
      // before _sendAction fires, so a stop-then-Enter sequence would otherwise leave an
      // empty assistant turn in chatHistory and confuse the backend.
      const drop =
        m.role === 'assistant' &&
        (m.status === 'streaming' || m.status === 'done') &&
        (m.content == null || m.content.length === 0);
      if (drop) {
        if (m.threadId) {
          this._threadsWithFirstBot.delete(m.threadId);
          this._presentation.finalizeAssistantGroup(m.threadId);
          // Remove inline UISpec nodes (data-thread-id but no data-message-id) that may
          // have arrived before any outputText — removeMessageBubble only targets the bubble.
          this._shadow
            ?.querySelectorAll(`[data-thread-id="${escapeCssIdentifier(m.threadId)}"]:not([data-message-id])`)
            .forEach((el) => el.remove());
          if (this._panel) {
            this._panel.threads = this._panel.threads.filter((t) => t !== m.threadId);
          }
          const before = this._thumbnailEntries.length;
          this._thumbnailEntries = this._thumbnailEntries.filter((e) => e.threadId !== m.threadId);
          if (this._thumbnailEntries.length !== before) thumbnailsChanged = true;
        }
        this._drawer?.removeMessageBubble(m.id);
        this._panel?.snapshots.delete(m.id);
        this._panel?.snapshotTypes.delete(m.id);
        continue;
      }
      next.push(m);
    }
    this._messages.length = 0;
    this._messages.push(...next);
    if (thumbnailsChanged) this._drawer?.setThumbnails(this._thumbnailEntries);
  }

  /** Reset all chat state when navigating to a different SKU/page. */
  private _resetForNewPage(): void {
    // Invalidate any in-flight stream callbacks so they discard themselves
    // via the `threadId !== this._activeRequestThreadId` guard.
    this._activeRequestThreadId = null;
    // Abort in-flight streams
    this._abortAllActiveRequests();
    // Cancel active typewriter/TTS
    this._activeTypewriter?.cancel();
    this._activeTypewriter = null;
    this._activeTtsHandle?.stop();
    this._activeTtsHandle = null;
    // Clear messages
    this._messages.length = 0;
    this._drawer?.clearMessages();
    // Clear panel
    this._drawer?.clearPanel();
    this._currentPanelSource = null;
    this._panel!.snapshots.clear();
    this._panel!.threads = [];
    // Clear thumbnails
    this._thumbnailEntries = [];
    this._drawer?.setThumbnails([]);
    // Reset comparison state
    this._comparisonSelectMode = false;
    this._comparisonSelectedSkus = [];
    this._viewedProductSkus.clear();
    // Reset thread cursors
    this._currentThreadId = null;
    this._lastThreadId = null;
    this._lastBackendContext = null;
    this._chatCreatedAt = new Date().toISOString();
    // Allow PDP/PLP/homepage auto-launch for new context
    this._pdpLaunched = false;
    this._plpLaunched = false;
    this._homepageLaunched = false;
    this._entryContextPrimed = false;
    this._contextPrimingInFlight = false;
    this._queuedUserMessages = [];
    this._productContextUnavailableSku = null;
    this._presentation.reset();
    this._drawer?.setPresentationFocus(null);
    this._drawer?.setFormerMessagesButtonVisible(false);
    if (this._modeController.reset()) {
      this._drawer?.setInputPlaceholder(this._i18n.inputPlaceholder);
      this._drawer?.setAttachmentControlsVisible(true);
      this._drawer?.setBeautyPhotoStepCard({ visible: false });
    }
  }

  /**
   * Same side effects as stream UISpec `clearPanel`: hide/clear the assistant panel without
   * `restoreOrClearPanel()`. Used for `clearPanel` chunks and PDP chat layout (`productDetailsExtended` off).
   */
  private _clearAssistantPanelLikeStreamClearPanel(): void {
    this._clearChoicePrompter();
    this._drawer?.clearPanel();
    this._currentPanelSource = null;
    this._thumbnailEntries = [];
    this._drawer?.setThumbnails([]);
    this._comparisonSelectMode = false;
    this._comparisonSelectedSkus = [];
    this._comparisonSelectionWarning = null;
    if (this._panel) {
      this._panel.currentType = null;
      this._panel.updateExtendedMode('');
      this._panel.updateTopBar('');
    }
  }

  private _flushPresentationScroll(): void {
    const req = this._presentation.scrollRequest;
    if (!req || !this._drawer) return;
    let handled = false;
    if (req.type === 'thread' && req.threadId) {
      handled = this._drawer.scrollThreadIntoView(req.threadId, req.behavior);
      if (!handled) {
        this._drawer.scrollToBottomPresentation(req.behavior);
        handled = true;
      }
    } else if (req.type === 'bottom') {
      this._drawer.scrollToBottomPresentation(req.behavior);
      handled = true;
    }
    if (handled) {
      this._presentation.consumeScrollRequest(req.id);
    }
  }

  private _focusPresentationThread(
    threadId: string,
    behavior: ScrollBehavior = 'smooth',
    syncDrawerFocus = false,
  ): void {
    this._presentation.requestThreadFocus(threadId, behavior);
    if (syncDrawerFocus) {
      this._drawer?.setPresentationFocus(threadId);
    }
    this._drawer?.setFormerMessagesButtonVisible(false);
    setTimeout(() => this._flushPresentationScroll(), 40);
  }

  /** Align inline UISpec render so the thread’s first visible node stays at the top. */
  private _scrollInlineIntoView(inline: HTMLElement, threadId: string | null | undefined): void {
    if (threadId) {
      this._focusPresentationThread(threadId, 'auto');
      return;
    }
    inline.scrollIntoView({ behavior: 'auto', block: 'start' });
  }

  private _releasePresentationFocus(): void {
    this._presentation.releaseFocusedThread();
    this._drawer?.setPresentationFocus(null);
    this._drawer?.setFormerMessagesButtonVisible(false);
  }

  private _hasMultipleThreadIds(): boolean {
    const ids = new Set<string>();
    for (const m of this._messages) {
      if (m.threadId) ids.add(m.threadId);
    }
    return ids.size > 1;
  }

  private _orderedThreadIds(): string[] {
    const ordered: string[] = [];
    const seen = new Set<string>();
    for (const m of this._messages) {
      if (m.threadId && !seen.has(m.threadId)) {
        seen.add(m.threadId);
        ordered.push(m.threadId);
      }
    }
    return ordered;
  }

  private _maybeAutoAnchorUnreadAssistant(): void {
    if (!this._drawer || !this._presentation.shown) return;
    const threadIds = this._orderedThreadIds();
    if (threadIds.length === 0) return;
    const latestUnread = getLatestUnreadAssistantThreadId(threadIds, this._presentation);
    if (!latestUnread) return;
    const gid = `${latestUnread}:assistant`;
    if (this._presentation.lastAutoAnchoredGroupId === gid) return;
    if (this._presentation.userInteracting && !this._presentation.pinnedToBottom) return;
    if (this._drawer.scrollThreadIntoView(latestUnread, 'smooth')) {
      this._presentation.markGroupAutoAnchored(gid);
    }
  }

  private _handleBridgeMessage(msg: BridgeMessage): void {
    switch (msg.type) {
      case 'openChat':
        this.open();
        break;
      case 'closeChat':
        this.close();
        break;
      case 'startNewChatWithLauncherAction': {
        // Start a new chat with a preset launcher action.
        // Legacy sends payload as the action directly: { type, title, requestDetails }
        // Clean-room also accepts nested: { action: { type, title, ... } }
        const payload = msg.payload as Record<string, unknown> | undefined;
        const nested = payload?.action;
        // Prefer nested shape, fall back to payload-is-action (legacy compat)
        const action = isActionLike(nested) ? nested : isActionLike(payload) ? payload : null;
        if (action) {
          this._sendAction(action, { silent: true });
        }
        this.open();
        break;
      }
      case 'startNewChatWithDetailContext': {
        // Start chat with product detail context (e.g., from PDP page).
        // Legacy shape: { action: {...}, sku: "..." }
        const ctx = msg.payload as Record<string, unknown> | undefined;
        if (ctx && typeof ctx === 'object') {
          this._bridgeContext = ctx;
          // Extract SKU and update page context so auto-PDP launch uses it
          const sku = ctx.sku as string | undefined;
          if (sku) {
            this.update({ sku });
          }
          // Extract and send the action (legacy sent action + premade context)
          if (isActionLike(ctx.action)) {
            this._pdpLaunched = true; // Skip auto-launch, explicit action takes priority
            this.open();
            this._sendAction(ctx.action);
            break;
          }
        }
        this.open();
        break;
      }
      case 'launcherAction': {
        // Send action to active chat from external trigger
        const payload = msg.payload as Record<string, unknown> | undefined;
        const action = payload?.action;
        if (action && typeof action === 'object' && 'type' in (action as Record<string, unknown>)) {
          this._sendAction(action as ActionPayload);
        }
        break;
      }
      case 'scrollToBottom':
        this._presentation.requestScrollToBottom('smooth');
        setTimeout(() => this._flushPresentationScroll(), 40);
        break;
      case 'addToCardHandler': {
        // Host notifies widget of add-to-cart result
        this._bridge?.send('addToCardResult', msg.payload);
        break;
      }
      case 'cartQuantityHandler': {
        // Host sends updated cart quantity
        const payload = msg.payload as Record<string, unknown> | undefined;
        if (payload && 'quantity' in payload && typeof payload.quantity === 'number') {
          this._cartQuantity = payload.quantity;
        }
        break;
      }
      case 'favoritesCountHandler': {
        const payload = msg.payload as Record<string, unknown> | undefined;
        const count = payload?.count;
        if (typeof count === 'number' && count >= 0) {
          this._drawer?.updateFavoritesBadge(count);
        }
        break;
      }
      case 'minimizeRequestedByUser':
        this._extendedModeManager?.setHiddenByUser(true);
        break;
      case 'bgColorChange': {
        const payload = msg.payload as Record<string, unknown> | undefined;
        const color = payload?.color;
        if (typeof color === 'string' && isSafeCSSColor(color) && this._shadow) {
          (this._shadow.host as HTMLElement).style.setProperty('--gengage-chat-bg', color);
        }
        break;
      }
      default:
        break;
    }
  }

  private _registerPublicAPI(): void {
    if (!window.gengage) window.gengage = {};
    window.gengage.chat = {
      open: (opts) => this.open(opts),
      openWithAction: (action, opts) => this.openWithAction(action, opts),
      sendMessage: (text) => this.sendMessage(text),
      sendAction: (action, opts) => this.sendAction(action, opts),
      close: () => this.close(),
      saveSession: (sid, sku) => this.saveSession(sid, sku),
      get isOpen() {
        return false;
      }, // Placeholder, overridden below
      on: (event, handler) => this.on(event, handler),
      trackCheckout: (type, data) => this.trackCheckout(type, data),
      flushMeteringSummary: (data) => this.flushMeteringSummary(data),
      addCallback: (eventName, callback) => this.addCallback(eventName, callback),
    };
    // Fix isOpen getter to reflect actual state
    Object.defineProperty(window.gengage.chat, 'isOpen', {
      get: () => this._drawerVisible,
    });
  }

  private _showDrawer(): void {
    if (this._drawerVisible) return;
    this._drawerVisible = true;
    const el = this._drawer?.getElement();
    if (el) {
      el.classList.remove('gengage-chat-drawer--hidden');
    }
    this._applyOpenStateClasses();
    this._drawer?.trapFocus();
    if (!(this._isMobileViewport && this._openState === 'half')) {
      this._drawer?.focusInput();
    }
    this._extendedModeManager?.setChatShown(true);
    this._presentation.setShown(true);
    setTimeout(() => this._maybeAutoAnchorUnreadAssistant(), 60);
  }

  /** Show welcome message and starter pills on first open with empty history. */
  private _showWelcomeIfNeeded(): void {
    if (this._messages.length !== 0) return;

    const contextKey = this._resolveOpeningContextKey();
    const openingActions = this._resolveContextualOpeningActions(contextKey);
    if (openingActions.length > 0) {
      this._drawer?.setPills(
        openingActions.map((action) => ({
          label: action.title,
          onAction: () => this._sendAction(this._resolveContextualOpeningAction(action, contextKey)),
        })),
      );
    }

    // Dedicated context launches provide their own backend-generated greeting —
    // skip the local generic welcome bubble so the shopper doesn't see two greetings.
    if (this._hasDedicatedContextLaunch()) return;

    if (this._shouldPrimeContextualOpening()) {
      return;
    }

    const welcomeMessage = this._resolveContextualOpeningMessage(contextKey);
    if (!welcomeMessage) return;

    const welcomeMsg: ChatMessage = {
      id: uuidv7(),
      role: 'assistant',
      content: welcomeMessage,
      timestamp: Date.now(),
      status: 'done',
    };
    this._messages.push(welcomeMsg);
    this._drawer?.addMessage(welcomeMsg);
  }

  private _resolveOpeningContextKey(): OpeningContextKey {
    switch (this.config.pageContext?.pageType) {
      case 'home':
        return 'home';
      case 'search':
      case 'plp':
        return 'listing';
      case 'pdp':
        return 'product';
      default:
        return 'default';
    }
  }

  private _resolveContextualOpeningMessage(contextKey = this._resolveOpeningContextKey()): string | undefined {
    return (
      this.config.openingMessagesByContext?.[contextKey] ??
      (contextKey !== 'default' ? this.config.openingMessagesByContext?.default : undefined) ??
      this.config.welcomeMessage
    );
  }

  private _resolveContextualOpeningGuidance(contextKey = this._resolveOpeningContextKey()): string | undefined {
    return (
      this.config.openingGuidanceByContext?.[contextKey] ??
      (contextKey !== 'default' ? this.config.openingGuidanceByContext?.default : undefined)
    );
  }

  private _resolveContextualOpeningActions(contextKey = this._resolveOpeningContextKey()): ChatActionChip[] {
    const contextualActions =
      this.config.welcomeActionsByContext?.[contextKey] ??
      (contextKey !== 'default' ? this.config.welcomeActionsByContext?.default : undefined);

    if (contextualActions?.length) {
      return contextualActions.filter((action) => typeof action?.title === 'string' && action.title.trim().length > 0);
    }

    return (this.config.welcomeActions ?? [])
      .filter((title) => typeof title === 'string' && title.trim().length > 0)
      .map((title) => ({ title }));
  }

  private _resolveContextualOpeningAction(
    action: ChatActionChip,
    contextKey = this._resolveOpeningContextKey(),
  ): ActionPayload {
    const title = action.title.trim();
    const primarySku = this.config.pageContext?.sku ?? this._readContextStringField('sku');
    const visibleSkus = this._readContextStringListField('visible_skus') ?? [];

    if (action.icon === 'review' && primarySku) {
      return {
        title,
        type: 'reviewSummary',
        payload: { sku: primarySku },
      };
    }

    if (action.icon === 'similar' && primarySku) {
      return {
        title,
        type: 'findSimilar',
        payload: { sku: primarySku },
      };
    }

    if (action.icon === 'compare' && contextKey === 'listing' && visibleSkus.length >= 2) {
      return {
        title,
        type: 'getComparisonTable',
        payload: { sku_list: visibleSkus.slice(0, 2) },
      };
    }

    return {
      title,
      type: 'user_message',
      payload: title,
    };
  }

  private _readContextStringField(key: string): string | undefined {
    const pageContext = this.config.pageContext as Record<string, unknown> | undefined;
    const extra =
      pageContext?.extra && typeof pageContext.extra === 'object' && !Array.isArray(pageContext.extra)
        ? (pageContext.extra as Record<string, unknown>)
        : undefined;
    const altCamel = key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
    const candidate = pageContext?.[key] ?? extra?.[key] ?? pageContext?.[altCamel] ?? extra?.[altCamel];
    return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : undefined;
  }

  private _readContextStringListField(key: string): string[] | undefined {
    const pageContext = this.config.pageContext as Record<string, unknown> | undefined;
    const extra =
      pageContext?.extra && typeof pageContext.extra === 'object' && !Array.isArray(pageContext.extra)
        ? (pageContext.extra as Record<string, unknown>)
        : undefined;
    const altCamel = key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
    const candidate = pageContext?.[key] ?? extra?.[key] ?? pageContext?.[altCamel] ?? extra?.[altCamel];
    if (!Array.isArray(candidate)) return undefined;
    const values = candidate.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    return values.length > 0 ? values : undefined;
  }

  private _buildEntryOpeningPageDetails(): Record<string, unknown> | undefined {
    const pageDetails: Record<string, unknown> = {};

    pageDetails.url = this.config.pageContext?.url ?? window.location.href;

    const pageTitle = this._readContextStringField('page_title');
    if (pageTitle) pageDetails.page_title = pageTitle;

    const pageDescription = this._readContextStringField('page_description');
    if (pageDescription) pageDetails.page_description = pageDescription;

    const searchQuery = this._readContextStringField('search_query');
    if (searchQuery) pageDetails.search_query = searchQuery;

    const visibleSkus = this._readContextStringListField('visible_skus');
    if (visibleSkus?.length) pageDetails.visible_skus = visibleSkus;

    const popularSearches = this._readContextStringListField('popular_searches');
    if (popularSearches?.length) pageDetails.popular_searches = popularSearches;

    const categoryPath = this.config.pageContext?.categoryTree ?? this._readContextStringListField('category_path');
    if (categoryPath?.length) pageDetails.category_path = categoryPath;

    return Object.keys(pageDetails).length > 0 ? pageDetails : undefined;
  }

  /** True when the current page type has a dedicated silent auto-launch that provides its own greeting. */
  private _hasDedicatedContextLaunch(): boolean {
    const ctx = this.config.pageContext;
    if (!ctx) return false;
    if (ctx.pageType === 'pdp' && ctx.sku) return true;
    if (ctx.pageType === 'plp' && ctx.skuList?.length) return true;
    if (ctx.pageType === 'home') return true;
    return false;
  }

  private _shouldPrimeContextualOpening(): boolean {
    if (this._messages.length !== 0 || this._entryContextPrimed || this._contextPrimingInFlight) return false;
    // Dedicated launches handle context priming — skip generic contextual opening
    if (this._hasDedicatedContextLaunch()) return false;
    return Boolean(
      this.config.openingMessagesByContext ||
      this.config.openingGuidanceByContext ||
      this.config.welcomeActionsByContext,
    );
  }

  private _maybePrimeEntryContextOpening(): void {
    const contextKey = this._resolveOpeningContextKey();
    if (!this._shouldPrimeContextualOpening()) return;

    this._entryContextPrimed = true;

    const payload: Record<string, unknown> = {
      text: '',
      is_entry_context_opening: 1,
      opening_context_key: contextKey,
    };

    const pageDetails = this._buildEntryOpeningPageDetails();
    if (pageDetails) payload.page_details = pageDetails;

    const openingMessage = this._resolveContextualOpeningMessage(contextKey);
    if (openingMessage) payload.opening_message = openingMessage;

    const openingGuidance = this._resolveContextualOpeningGuidance(contextKey);
    if (openingGuidance) payload.opening_guidance = openingGuidance;

    this._sendAction(
      {
        title: '',
        type: 'user_message',
        payload,
      },
      { silent: true, preservePills: true },
    );
  }

  private _hideDrawer(): void {
    if (!this._drawerVisible) return;
    this._drawer?.releaseFocus();
    this._activeTypewriter?.cancel();
    this._activeTypewriter = null;
    this._activeTtsHandle?.stop();
    this._activeTtsHandle = null;
    this._drawerVisible = false;
    // Reset mobile open state so next launcher open defaults to full-screen
    this._openState = 'full';
    // Don't clear panel — preserve it so reopening the drawer shows the same
    // panel state. clearPanel() is reserved for SKU/page resets and stale
    // loading skeleton cleanup after streams.
    const el = this._drawer?.getElement();
    if (el) {
      el.classList.add('gengage-chat-drawer--hidden');
    }
    this._applyOpenStateClasses();
    this._extendedModeManager?.setChatShown(false);
    this._presentation.setShown(false);
    this._drawer?.setPresentationFocus(null);
    this._drawer?.setFormerMessagesButtonVisible(false);
  }

  private _syncViewportState(): void {
    if (!this._rootEl) return;
    this._isMobileViewport = window.innerWidth <= this._mobileBreakpoint;
    this._rootEl.classList.toggle('gengage-chat-root--mobile', this._isMobileViewport);

    if (this._launcher) {
      const hideLauncher = this._isMobileViewport && this.config.hideMobileLauncher === true;
      this._launcher.container.classList.toggle('gengage-chat-launcher--hidden-mobile', hideLauncher);
    }

    this._applyOpenStateClasses();
  }

  /**
   * Dimming backdrop + click-through scrim only in this state:
   * - overlay: drawer open (full-screen modal)
   * - floating: drawer open and side panel visible (split / “maximized” layout)
   */
  private _isMaximizedForHostChrome(): boolean {
    if (!this._drawerVisible) return false;
    const variant = this.config.variant ?? 'floating';
    if (variant === 'inline') return false;
    if (variant === 'overlay') return true;
    if (!(this._drawer?.isPanelVisible() ?? false)) return false;
    // Desktop split view: scrim only while MainPane is expanded; collapsed = chat-only column.
    if (!this._isMobileViewport && (this._drawer?.isPanelCollapsed() ?? false)) return false;
    return true;
  }

  /** Host page scroll blocked whenever MainPane is shown (including collapsed split). */
  private _shouldLockHostDocumentScroll(): boolean {
    if (!this._drawerVisible) return false;
    const variant = this.config.variant ?? 'floating';
    if (variant === 'inline') return false;
    if (variant === 'overlay') return true;
    if (this._isMobileViewport) return true;
    return this._drawer?.isPanelVisible() ?? false;
  }

  private _applyOpenStateClasses(): void {
    if (!this._rootEl) return;
    const mobileHalf = this._drawerVisible && this._isMobileViewport && this._openState === 'half';
    const mobileFull = this._drawerVisible && this._isMobileViewport && this._openState === 'full';
    const maximizedHost = this._isMaximizedForHostChrome();
    this._rootEl.classList.toggle('gengage-chat-root--open', this._drawerVisible);
    this._rootEl.classList.toggle('gengage-chat-root--mobile-half', mobileHalf);
    this._rootEl.classList.toggle('gengage-chat-root--mobile-full', mobileFull);
    this._rootEl.classList.toggle('gengage-chat-root--maximized-host-chrome', maximizedHost);
    if (this._backdropEl) {
      const backdropIsScrim = maximizedHost && (this.config.variant ?? 'floating') !== 'inline';
      this._backdropEl.setAttribute('aria-hidden', backdropIsScrim ? 'false' : 'true');
    }
    this._syncHostDocumentScrollLock();
    this._maybeTrackChatbotMainPaneGa();
  }

  /** MainPane = assistant left panel; mobile counts full overlay panel as expanded. */
  private _mainPaneExpandedForAnalytics(): boolean {
    const d = this._drawer;
    if (!d?.isPanelVisible()) return false;
    if (this._isMobileViewport) return true;
    return !d.isPanelCollapsed();
  }

  private _maybeTrackChatbotMainPaneGa(): void {
    const expanded = this._mainPaneExpandedForAnalytics();
    if (expanded && !this._gaPrevMainPaneExpanded) {
      ga.trackChatbotMaximized();
    }
    this._gaPrevMainPaneExpanded = expanded;
  }

  private _syncHostDocumentScrollLock(): void {
    if (typeof document === 'undefined') return;
    const variant = this.config.variant ?? 'floating';
    if (variant === 'inline') {
      this._releaseHostDocumentScrollLock();
      return;
    }
    if (this._shouldLockHostDocumentScroll()) {
      this._applyHostDocumentScrollLock();
    } else {
      this._releaseHostDocumentScrollLock();
    }
  }

  /**
   * When true, we do not preventDefault — the event may drive chat-internal scrolling.
   * Full-viewport backdrop sits inside the shadow tree, so `composedPath()` always hits
   * the host; we must not treat "inside widget" as "allow scroll" for that case.
   */
  private _hostScrollEventShouldReachChatScroller(ev: Event): boolean {
    try {
      const path = ev.composedPath();
      // Rare host/browser edge: empty path would block all wheel if treated as "outside widget".
      if (path.length === 0) return true;

      if (!path.includes(this.root)) return false;

      for (const n of path) {
        if (n === this.root) break;
        if (!(n instanceof HTMLElement)) continue;

        if (this._backdropEl && (n === this._backdropEl || this._backdropEl.contains(n))) {
          return false;
        }

        const cs = window.getComputedStyle(n);
        const canY = (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && n.scrollHeight > n.clientHeight + 1;
        const canX = (cs.overflowX === 'auto' || cs.overflowX === 'scroll') && n.scrollWidth > n.clientWidth + 1;
        if (canY || canX) return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private _applyHostDocumentScrollLock(): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    if (!this._hostOverflowRestore) {
      const html = document.documentElement;
      const body = document.body;
      this._hostOverflowRestore = {
        htmlOverflow: html.style.overflow,
        bodyOverflow: body?.style.overflow ?? '',
        htmlOverscroll: html.style.overscrollBehavior,
        bodyOverscroll: body?.style.overscrollBehavior ?? '',
      };
      html.style.overflow = 'hidden';
      html.style.overscrollBehavior = 'none';
      if (body) {
        body.style.overflow = 'hidden';
        body.style.overscrollBehavior = 'none';
      }
      this._hostScrollLockViewport = { x: window.scrollX, y: window.scrollY };
    }
    if (this._hostScrollLockActive) return;
    window.addEventListener('touchmove', this._preventHostDocumentTouchMove, { capture: true, passive: false });
    window.addEventListener('wheel', this._preventHostDocumentWheel, { capture: true, passive: false });
    document.addEventListener('touchmove', this._preventHostDocumentTouchMove, { capture: true, passive: false });
    document.addEventListener('wheel', this._preventHostDocumentWheel, { capture: true, passive: false });
    window.addEventListener('scroll', this._pinHostViewportScroll, { capture: true, passive: true });
    this._hostScrollLockActive = true;
  }

  private _releaseHostDocumentScrollLock(): void {
    if (typeof document === 'undefined') return;
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this._pinHostViewportScroll, { capture: true });
      window.removeEventListener('touchmove', this._preventHostDocumentTouchMove, { capture: true });
      window.removeEventListener('wheel', this._preventHostDocumentWheel, { capture: true });
    }
    if (this._hostScrollLockActive) {
      document.removeEventListener('touchmove', this._preventHostDocumentTouchMove, { capture: true });
      document.removeEventListener('wheel', this._preventHostDocumentWheel, { capture: true });
      this._hostScrollLockActive = false;
    }
    this._hostScrollLockViewport = null;
    this._hostScrollPinning = false;
    if (this._hostOverflowRestore) {
      const html = document.documentElement;
      const body = document.body;
      html.style.overflow = this._hostOverflowRestore.htmlOverflow;
      html.style.overscrollBehavior = this._hostOverflowRestore.htmlOverscroll;
      if (body) {
        body.style.overflow = this._hostOverflowRestore.bodyOverflow;
        body.style.overscrollBehavior = this._hostOverflowRestore.bodyOverscroll;
      }
      this._hostOverflowRestore = null;
    }
  }

  private _handleAttachment(file: File): void {
    const result = validateImageFile(file);
    if (!result.ok) {
      const message = result.reason === 'invalid_type' ? this._i18n.invalidFileType : this._i18n.fileTooLarge;
      dispatch('gengage:global:error', {
        message,
        source: 'chat' as const,
      });
      return;
    }
    this._drawer?.stageAttachment(file);
  }

  private _sendMessage(text: string, attachment?: File): void {
    if (this._contextPrimingInFlight) {
      this._abortAllActiveRequests();
      this._contextPrimingInFlight = false;
      this._queuedUserMessages = [];
    }

    ga.trackMessageSent();
    // Track conversation start on first user message in a new thread
    const hasUserMessages = this._messages.some((m) => m.role === 'user');
    if (!hasUserMessages) {
      ga.trackConversationStart();
    }
    debugLog('chat', 'sendMessage', {
      mode: this._assistantMode,
      hasAttachment: attachment !== undefined,
      textLength: text.length,
    });
    const action: ActionPayload =
      attachment !== undefined
        ? { title: text, type: this._modeController.resolveAttachmentActionType(), payload: text ? { text } : {} }
        : { title: text, type: 'user_message', payload: text };
    if (attachment !== undefined) {
      this._sendAction(action, { attachment });
    } else {
      this._sendAction(action);
    }
  }

  private _flushQueuedUserMessages(): void {
    if (this._contextPrimingInFlight || this._queuedUserMessages.length === 0) return;
    const queued = [...this._queuedUserMessages];
    this._queuedUserMessages = [];
    for (const item of queued) {
      this._sendMessage(item.text, item.attachment);
    }
  }

  /** Apply ui_hints from the backend CONTEXT event — delegates to mode controller. */
  private _applyUiHints(): void {
    this._modeController.applyUiHints(this._drawer, this._i18n.inputPlaceholder, () => {
      this._clearChoicePrompter();
    });
  }

  private _handleRedirectMetadata(redirectPayload: unknown): void {
    this._modeController.handleRedirect(redirectPayload);
  }

  private _sendAction(action: ActionPayload, options?: SendActionOptions): void {
    // Cancel any running typewriter animation and TTS playback
    this._activeTypewriter?.cancel();
    this._activeTypewriter = null;
    this._activeTtsHandle?.stop();
    this._activeTtsHandle = null;

    // Track last action for retry on error
    this._lastSentAction = { action, options };

    // Defer actions until init completes
    if (!this._initComplete) {
      if (this._pendingActions.length < 10) {
        this._pendingActions.push({ action, options });
      }
      return;
    }

    // Remove ChoicePrompter on new action
    this._clearChoicePrompter();
    // Fresh user request: reset ChoicePrompter dismiss so it can show again on the next grid
    if (!options?.preservePanel) {
      clearChoicePrompterDismissState();
    }

    // Clear comparison mode when starting a new request (unless preservePanel).
    // Exception: getComparisonTable actions keep comparison state visible during
    // the request so the floating button and checkboxes stay as loading feedback.
    // State is cleared once the ComparisonTable UISpec actually renders in the panel.
    if (!options?.preservePanel && this._comparisonSelectMode && action.type !== 'getComparisonTable') {
      this._comparisonSelectMode = false;
      this._comparisonSelectedSkus = [];
    }

    // Clear local panel history on new requests (fresh panel context)
    if (!options?.preservePanel) {
      this._localPanelHistory = [];
    }

    // Branch deletion: if user is sending from a rewound position, prune future messages
    if (this._currentThreadId && this._lastThreadId && this._lastThreadId > this._currentThreadId) {
      const cutoff = this._currentThreadId;
      // Remove future messages from array
      const removed = this._messages.filter((m) => m.threadId !== undefined && m.threadId > cutoff);
      this._messages = this._messages.filter((m) => !m.threadId || m.threadId <= cutoff);
      // Remove their DOM nodes
      for (const msg of removed) {
        this._shadow?.querySelector(`[data-message-id="${escapeCssIdentifier(msg.id)}"]`)?.remove();
        this._panel!.snapshots.delete(msg.id);
        this._panel!.snapshotTypes.delete(msg.id);
      }
      // Remove orphaned inline UISpec elements
      const orphanedUISpecs = this._shadow?.querySelectorAll(`[data-thread-id]`);
      orphanedUISpecs?.forEach((el) => {
        if (el instanceof HTMLElement && el.dataset['threadId'] && el.dataset['threadId'] > cutoff) {
          el.remove();
        }
      });
    }

    // Clear previous suggestion pills and input chips
    if (!options?.preservePills) {
      this._drawer?.setPills([]);
    }
    this._drawer?.clearInputAreaChips();

    // Notify host that assistant is responding
    this._bridge?.send('isResponding', true);

    // Generate thread ID for this request-response cycle
    const threadId = uuidv7();
    this._currentThreadId = threadId;
    this._lastThreadId = threadId;
    // Preserve the active grid intent during product drilldowns. A product click
    // should not relabel an existing search-result panel as "similar products".
    if (this._panel && !CONTEXT_LAUNCH_TYPES.has(action.type)) {
      this._panel.lastActionType = action.type;
    }
    // For preservePanel actions (like/addToCart), don't overwrite _activeRequestThreadId
    // to avoid silencing concurrent streams. Instead, track validity locally.
    const isPreservePanel = options?.preservePanel === true;
    const isContextAutoLaunch = options?.silent === true && options?.isContextPrime === true;
    const isPdpAutoLaunch = isContextAutoLaunch && action.type === 'launchSingleProduct';
    if (!isPreservePanel) {
      this._activeRequestThreadId = threadId;
    }

    // Align presentation focus with this thread *before* appending the user bubble.
    // Otherwise addMessage()'s collapse pass uses the previous focus and marks the
    // new bubble as presentation-collapsed until a later setPresentationFocus — which
    // can yield wrong scroll targets (offsetTop on display:none) and “empty” transcript.
    if (!options?.silent && !isPreservePanel) {
      this._drawer?.setPresentationFocus(threadId);
    }

    // Add user message to UI (skip for silent/auto-launch actions)
    if (!options?.silent) {
      const userText =
        typeof action.payload === 'string'
          ? action.payload
          : typeof (action.payload as Record<string, unknown>)?.['text'] === 'string'
            ? ((action.payload as Record<string, unknown>)['text'] as string)
            : action.title;
      // Retry deduplication: skip adding a duplicate user bubble when retrying
      const lastMsg = this._messages.length > 0 ? this._messages[this._messages.length - 1] : undefined;
      const isDuplicate = lastMsg !== undefined && lastMsg.role === 'user' && lastMsg.content === userText;
      if (!isDuplicate) {
        // Mark KVKK approved on first user-visible action; also dismiss the banner
        // if still visible when a later message arrives (covers chip/button actions
        // that bypass _sendMessage).
        if (!this._messages.some((m) => m.role === 'user') || this._drawer?.isKvkkBannerVisible()) {
          markKvkkShown(this.config.accountId);
          this._drawer?.hideKvkkBanner();
        }
        const userMsg = this._createMessage('user', userText);
        userMsg.threadId = threadId;
        if (options?.attachment !== undefined) {
          userMsg.attachment = options.attachment;
        }
        this._drawer?.addMessage(userMsg);
        if (options?.attachment !== undefined && this._modeController.isBeautyConsulting) {
          this._drawer?.setBeautyPhotoStepCard({ visible: false });
        }
        this._messages.push(userMsg);
      }
    }

    const shouldShortCircuitUnavailableContext =
      !options?.silent &&
      this._assistantMode === 'shopping' &&
      this._hasUnavailableProductContext() &&
      (action.type === 'user_message' || action.type === 'inputText');
    if (shouldShortCircuitUnavailableContext) {
      const fallback = this._i18n.productNotFoundMessage;
      const botMsg = this._createMessage('assistant', fallback);
      botMsg.threadId = threadId;
      botMsg.status = 'done';
      this._messages.push(botMsg);
      this._ensureAssistantMessageRendered(botMsg);
      this._drawer?.updateBotMessage(botMsg.id, fallback);
      this._drawer?.setPresentationFocus(threadId);
      this._bridge?.send('isResponding', false);
      this.emit('message', botMsg);
      this._persistToIndexedDB().catch(() => {
        /* non-fatal */
      });
      return;
    }

    // Preserve panel during the request — don't clear or show loading skeleton
    // until the backend explicitly signals new panel content (panelLoading event).
    // Exception: getComparisonTable shows the panel skeleton immediately (desktop + mobile)
    // so users see progress while the table streams in.
    // Captures the panel source (UISpec/kind) so it can be re-rendered with fresh
    // event listeners if a non-text action fails to deliver new panel content.
    let prePanelSource = this._currentPanelSource;
    let prePanelSourceCaptured = false;
    const shouldClearStalePanelOnEmptyResponse = action.type === 'user_message' || action.type === 'inputText';
    const capturePanelSourceIfNeeded = (): void => {
      if (prePanelSourceCaptured || options?.preservePanel) return;
      prePanelSource = this._currentPanelSource;
      prePanelSourceCaptured = true;
    };
    const restoreOrClearPanel = (): void => {
      if (!this._drawer?.isPanelLoading()) return;
      if (!shouldClearStalePanelOnEmptyResponse && prePanelSource) {
        const ctx = this._buildRenderContext();
        const el = this._renderPanelFromSource(prePanelSource, ctx);
        this._drawer.setPanelContent(el);
        this._drawer.setDividerPreviewEnabled(this._shouldUseDividerPreviewForSource(prePanelSource));
        this._currentPanelSource = prePanelSource;
      } else {
        this._drawer.clearPanel();
        this._currentPanelSource = null;
      }
      prePanelSource = null;
    };

    if (action.type === 'getComparisonTable') {
      this._drawer?.showPanelLoading('comparisonTable');
      this._panel?.updateTopBarForLoading('comparisonTable');
    }

    if (!options?.silent && !isPreservePanel) {
      this._pruneEmptyStreamingAssistantPlaceholders();
    }

    // Show typing indicator
    this._drawer?.showTypingIndicator();
    // Use a local text accumulator per stream invocation to prevent corruption
    // when multiple concurrent preservePanel streams write to the same state.
    let localBotText = '';

    // Create bot message placeholder
    const botMsg = this._createMessage('assistant', '');
    botMsg.threadId = threadId;
    botMsg.status = 'streaming';
    if (options?.silent) botMsg.silent = true;
    // Note: silent flag only skips the USER message above — bot response is always rendered
    this._messages.push(botMsg);

    this._presentation.registerAssistantActivity(threadId);
    // User-visible non-preservePanel: focus was already set before the user bubble.
    this._focusPresentationThread(threadId, 'smooth', options?.silent || isPreservePanel);

    // Abort previous request(s) — skip for preservePanel to avoid killing concurrent streams
    if (!options?.preservePanel) {
      if (this._contextPrimingInFlight && !isContextAutoLaunch) {
        this._contextPrimingInFlight = false;
        this._queuedUserMessages = [];
      }
      this._abortAllActiveRequests();
    }

    const transport: ChatTransportConfig = {
      middlewareUrl: this.config.middlewareUrl,
      ...(this.config.accountId ? { accountId: this.config.accountId } : {}),
    };
    if (options?.attachment !== undefined) {
      transport.attachment = options.attachment;
    }

    const visibleMessages = this._getVisibleMessages();
    const chatHistory = visibleMessages
      // Keep assistant messages even when empty (panel-only responses) so the
      // backend sees the proper alternating user/model turn structure.  Exclude
      // the current bot placeholder (just created, not yet populated).
      .filter((m) => m !== botMsg && (m.content || m.role === 'assistant'))
      .slice(-50)
      .map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        content: m.content ?? '',
      }));

    // Build meta object for backend
    const meta: BackendRequestMeta = {
      outputLanguage: localeToOutputLanguage(this.config.locale),
      parentUrl: window.location.href,
      windowWidth: String(window.innerWidth),
      windowHeight: String(window.innerHeight),
      selfUrl: '',
      id: this.config.session?.sessionId ?? '',
      userId: this.config.session?.userId ?? '',
      appId: this.config.accountId,
      threads: [],
      createdAt: this._chatCreatedAt,
      kvkkApproved: isKvkkShown(this.config.accountId),
      voiceEnabled: this.config.voiceEnabled ?? false,
      threadId,
      isControlGroup: this.config.session?.abTestVariant === 'control',
      isMobile: this._isMobileViewport,
    };
    if (!this._modeController.isShopping) {
      meta.assistantMode = this._modeController.mode;
    }
    if (this.config.session?.viewId !== undefined) {
      meta.viewId = this.config.session.viewId;
    }

    // Enrich action payload with fields the backend expects
    const enrichedAction = enrichActionPayload(action, {
      pageContext: this.config.pageContext,
      backendContext: this._lastBackendContext,
      isMobile: this._isMobileViewport,
    });

    const request: import('./api.js').ProcessActionRequest = {
      account_id: this.config.accountId,
      session_id: this.config.session?.sessionId ?? '',
      correlation_id: this.config.session?.sessionId ?? '',
      type: enrichedAction.type,
      locale: resolveLocaleTag(this.config.locale),
      meta,
      context: {
        // Spread backend context (panel, message_id, etc.) but preserve FE's
        // authoritative chatHistory — the backend's stale `messages` must not
        // overwrite the up-to-date conversation history built by the widget.
        ...(this._lastBackendContext ?? {}),
        messages: chatHistory,
        // Backend reads session_id from context.
        session_id: this.config.session?.sessionId ?? '',
      },
    };

    // Only set optional fields when values exist (exactOptionalPropertyTypes)
    if (this.config.session?.userId !== undefined) {
      request.user_id = this.config.session.userId;
    }
    if (this.config.session?.viewId !== undefined) {
      request.view_id = this.config.session.viewId;
    }
    if (enrichedAction.payload !== undefined) {
      request.payload = enrichedAction.payload;
    }
    if (this.config.pageContext?.sku !== undefined) {
      request.sku = this.config.pageContext.sku;
    }
    if (this.config.pageContext?.pageType !== undefined) {
      request.page_type = this.config.pageContext.pageType;
    }

    // Analytics tracking state for this request
    const requestId = crypto.randomUUID();
    const streamStart = Date.now();
    let chunkIndex = 0;
    let panelLoadingSeen = false;
    let panelContentReceived = false;
    /** Desktop: panel shows ProductGrid / Categories — AI picks can render above instead of in chat. */
    let panelListEligibleForAiZone = false;
    let aiAnalysisUiReceivedForPanel = false;
    let streamDone = false;
    const beautyStreamState = createBeautyStreamState();
    /** AITopPicks / AIGroupingCards often arrive before product_list; flush when grid mounts. */
    let pendingPanelAiSpec: UISpec | null = null;
    /**
     * Consulting style-picker grids may stream twice: once with some variations
     * still `loading`, then a final replace with everything `ready`. Rendering
     * the partial produces a visible skeleton→partial→final flash, so we hold
     * the partial here and only flush it if the stream ends without a fully
     * ready replacement (fallback so the shopper never sees an empty panel).
     */
    let pendingConsultingSpec: UISpec | null = null;

    const syncPanelAiAnalysisZone = (): void => {
      if (!this._drawer) return;
      // Keep rendered AITopPicks / AIGroupingCards in the panel AI zone; do not clear
      // them just because eligibility toggled mid-stream.
      if (aiAnalysisUiReceivedForPanel) return;
      if (!panelListEligibleForAiZone) {
        this._drawer.setPanelAiZoneState('hidden');
        return;
      }
      if (!streamDone) {
        this._drawer.setPanelAiZoneState('analyzing', { analyzingLabel: this._i18n.aiAnalysisAnalyzingLabel });
      } else {
        this._drawer.setPanelAiZoneState('hidden');
      }
    };

    const flushPendingPanelAiSpecToZone = (isStreaming: boolean): void => {
      if (!pendingPanelAiSpec || !this._drawer) return;
      const flushCtx = this._buildRenderContext();
      flushCtx.isStreaming = isStreaming;
      const aiEl = this._renderUISpec(pendingPanelAiSpec, flushCtx);
      aiAnalysisUiReceivedForPanel = true;
      this._drawer.setPanelAiZoneState('results', { resultEl: aiEl });
      pendingPanelAiSpec = null;
    };

    const syncPanelAiZoneAfterPanelUpdate = (
      componentType: string,
      panelAction: PanelUpdateAction,
      isStreaming: boolean,
    ): void => {
      if (componentType === 'ProductGrid' || componentType === 'CategoriesContainer') {
        panelListEligibleForAiZone = true;
        flushPendingPanelAiSpecToZone(isStreaming);
        syncPanelAiAnalysisZone();
        return;
      }
      if (panelAction !== 'appendSimilars' && panelAction !== 'append') {
        panelListEligibleForAiZone = false;
        aiAnalysisUiReceivedForPanel = false;
        pendingPanelAiSpec = null;
        this._drawer?.setPanelAiZoneState('hidden');
      }
    };

    const shouldPreserveAiZoneForPanelReplace = (componentType: string): boolean =>
      (componentType === 'ProductGrid' || componentType === 'CategoriesContainer') &&
      (panelListEligibleForAiZone || aiAnalysisUiReceivedForPanel || pendingPanelAiSpec !== null);

    const replacePanelSpec = (
      panelSpec: UISpec,
      renderContext: ChatUISpecRenderContext,
      componentType: string,
    ): void => {
      if (!this._drawer || !this._panel) return;
      const rootForPatch = panelSpec.elements[panelSpec.root];
      if (componentType === 'ProductGrid' && rootForPatch) {
        const consultingPatch = detectConsultingGrid(rootForPatch);
        if (consultingPatch.isConsulting) {
          const existingPanel = this._drawer.getPanelContentElement();
          if (existingPanel && patchConsultingGridDom(existingPanel, consultingPatch, renderContext)) {
            this._comparisonSelectMode = false;
            this._comparisonSelectedSkus = [];
            this._comparisonSelectionWarning = null;
            this._drawer.setComparisonDockContent(null);
            this._currentPanelSource = { kind: 'spec', spec: panelSpec };
            this._panel.currentType = componentType;
            this._drawer.resyncPanelTopBarFromCurrentContent();
            return;
          }
        }
      }
      this._comparisonSelectMode = false;
      this._comparisonSelectedSkus = [];
      this._comparisonSelectionWarning = null;
      this._drawer.setComparisonDockContent(null);
      this._drawer.setPanelContent(this._renderUISpec(panelSpec, renderContext), {
        preserveAiZone: shouldPreserveAiZoneForPanelReplace(componentType),
      });
      this._currentPanelSource = { kind: 'spec', spec: panelSpec };
      this._panel.currentType = componentType;
    };

    const finalizePanelUpdate = (
      componentType: string,
      rootElement: UIElement | undefined,
      panelAction: PanelUpdateAction,
      isStreaming: boolean,
    ): void => {
      if (!this._panel) return;
      this._drawer?.setDividerPreviewEnabled((this._panel.currentType ?? componentType) === 'ProductGrid');

      if (componentType === 'ProductDetailsPanel' && action.type === 'launchSingleProduct') {
        this._clearUnavailableProductContext();
      }

      if (botMsg.threadId && !this._panel.threads.includes(botMsg.threadId)) {
        this._panel.threads.push(botMsg.threadId);
      }
      const titleType = this._panel.currentType ?? componentType;
      const backendTitle = rootElement?.props?.['panelTitle'] as string | undefined;
      this._panel.updateTopBar(titleType, backendTitle);
      this._panel.updateExtendedMode(componentType);
      if (this._isMobileViewport && isPdpAutoLaunch) {
        this._drawer?.hideMobilePanel();
      }
      syncPanelAiZoneAfterPanelUpdate(componentType, panelAction, isStreaming);
    };

    this.track(
      streamStartEvent(this.analyticsContext(), {
        endpoint: 'process_action',
        request_id: requestId,
        widget: 'chat',
      }),
    );

    let streamController: AbortController | null = null;
    streamController = sendChatMessage(
      request,
      {
        onTextChunk: (content, isFinal, extra) => {
          if (!isPreservePanel && threadId !== this._activeRequestThreadId) return;
          localBotText += content;
          this._drawer?.removeTypingIndicator();

          // Store enrichment data from outputText for downstream rendering
          if (extra?.skuToProductItem) {
            this._skuToProductItem = { ...this._skuToProductItem, ...extra.skuToProductItem };
          }
          if (extra?.conversationMode) {
            this._conversationMode = extra.conversationMode;
          }
          if (extra?.renderHint) {
            botMsg.renderHint = extra.renderHint;
          }

          this.track(
            streamChunkEvent(this.analyticsContext(), {
              request_id: requestId,
              chunk_index: chunkIndex++,
              widget: 'chat',
            }),
          );

          if (!this._drawer) return;

          // KVKK filtering: strip KVKK block from display text and show banner.
          // Backend explicitly flags KVKK content via `extra.kvkk` — always respect that.
          // Keyword-based fallback (`containsKvkk`) only applies during PDP auto-launch
          // to avoid false-positives on normal replies that mention KVKK conversationally.
          let displayText = localBotText;
          const isKvkkContent = extra?.kvkk === true || (isPdpAutoLaunch && containsKvkk(displayText));
          if (isFinal && isKvkkContent) {
            const acctId = this.config.accountId;
            if (!isKvkkShown(acctId)) {
              const kvkkHtml = extractKvkkBlock(displayText);
              if (kvkkHtml) {
                this._drawer?.showKvkkBanner(kvkkHtml, () => {
                  this._drawer?.hideKvkkBanner();
                  markKvkkShown(acctId);
                });
              } else {
                // No KVKK block found — mark as shown so we don't re-check
                markKvkkShown(acctId);
              }
            }
            displayText = stripKvkkBlock(displayText);
          }

          // Check if we already have a bot bubble in the DOM (query by message ID, not :last-child)
          const existingBubble = this._shadow?.querySelector(
            `[data-message-id="${botMsg.id}"] .gengage-chat-bubble-text`,
          );
          if (existingBubble) {
            existingBubble.innerHTML = sanitizeHtml(displayText);
          } else {
            botMsg.content = displayText;
            if (botMsg.role === 'assistant' && botMsg.threadId && !this._threadsWithFirstBot.has(botMsg.threadId)) {
              this._threadsWithFirstBot.add(botMsg.threadId);
              this._drawer.markFirstBotMessage(botMsg.id);
            }
            this._drawer.addMessage(botMsg);
          }

          if (isFinal) {
            botMsg.content = displayText;
            botMsg.status = 'done';
            ga.trackMessageReceived();

            // Photo analysis messages render a structured card — skip typewriter.
            if (isPhotoAnalysisMessage(botMsg)) {
              this._drawer?.updateBotMessage(botMsg.id, displayText, 'photo_analysis', botMsg.photoAnalysis);
              if (botMsg.threadId) {
                this._focusPresentationThread(botMsg.threadId, 'auto');
              }
            } else {
              // Apply typewriter animation to the final bot text
              const bubbleTextEl = this._shadow?.querySelector(
                `[data-message-id="${botMsg.id}"] .gengage-chat-bubble-text`,
              ) as HTMLElement | null;
              if (bubbleTextEl) {
                this._activeTypewriter?.cancel();
                const mentions = extra?.productMentions;
                this._activeTypewriter = typewriteHtml({
                  container: bubbleTextEl,
                  html: sanitizeHtml(displayText),
                  onTick: () => this._drawer?.scrollToBottomIfNeeded(),
                  onComplete: () => {
                    this._activeTypewriter = null;
                    // Link product mentions after typewriter finishes
                    if (mentions && mentions.length > 0 && bubbleTextEl) {
                      linkProductMentions({
                        container: bubbleTextEl,
                        mentions,
                        onProductClick: (sku) => {
                          this._sendAction({
                            title: mentions.find((m) => m.sku === sku)?.short_name ?? sku,
                            type: 'launchSingleProduct',
                            payload: { sku },
                          });
                        },
                      });
                    }
                  },
                });
              }
            }
          }
        },
        onUISpec: (spec, widget, panelHint, clearPanel) => {
          if (!isPreservePanel && threadId !== this._activeRequestThreadId) return;
          if (widget !== 'chat') return;

          // StreamEventUISpec.clearPanel: hide/clear the assistant panel. Do not use
          // restoreOrClearPanel() here — that restores the pre-loading snapshot while the skeleton
          // is shown and breaks intended panel-dismiss behavior.
          if (clearPanel) {
            this._clearAssistantPanelLikeStreamClearPanel();
            panelLoadingSeen = false;
            pendingConsultingSpec = null;
          }

          const rootElement = spec.elements[spec.root];
          const componentType = rootElement?.type ?? 'unknown';

          // Beauty consulting UISpec components — delegated to feature handler.
          if (
            handleBeautyUISpec(
              componentType,
              rootElement?.props ?? {},
              beautyStreamState,
              {
                drawer: this._drawer,
                ensureRendered: () => this._ensureAssistantMessageRendered(botMsg),
                cancelTypewriter: () => {
                  this._activeTypewriter?.cancel();
                  this._activeTypewriter = null;
                },
                sendSkipMessage: () => this._sendMessage(this._i18n.beautyPhotoStepSkipMessage),
                streamDone,
              },
              botMsg,
            )
          ) {
            if (componentType === 'PhotoAnalysisCard' && botMsg.threadId) {
              this._focusPresentationThread(botMsg.threadId, 'auto');
            }
            return;
          }

          const similarsAppendGrid = isSimilarsAppendGrid(rootElement);
          /** PDP akışında yan panel kapalı: tam detay + benzer ürün grid’i yalnızca sohbette. */
          const skipSidePanelForUISpec =
            this.config.productDetailsExtended !== true &&
            (componentType === 'ProductDetailsPanel' || similarsAppendGrid);
          if (skipSidePanelForUISpec && !clearPanel) {
            this._clearAssistantPanelLikeStreamClearPanel();
            panelLoadingSeen = false;
          }
          const effectivePanelHint =
            componentType === 'ProductDetailsPanel' && panelHint !== 'panel' ? ('panel' as const) : panelHint;
          this.track(
            streamUiSpecEvent(this.analyticsContext(), {
              request_id: requestId,
              chunk_index: chunkIndex,
              component_type: componentType,
              widget: 'chat',
            }),
          );

          const renderContext = this._buildRenderContext();
          renderContext.isStreaming = true;

          // GA dataLayer: track component-specific events
          if (componentType === 'ComparisonTable') {
            const products = rootElement?.props?.['products'];
            ga.trackCompareReceived(Array.isArray(products) ? products.length : 0);
          }
          if (componentType === 'ProductGrid') {
            const childCount = rootElement?.children?.length ?? 0;
            ga.trackSearch(undefined, childCount);
          }

          const panelSpec = effectivePanelHint === 'panel' && this._panel ? this._panel.toPanelSpec(spec) : spec;

          // Consulting style-picker gate: wait only until at least one variation
          // is not `loading` (fast-first). Further `loading` tabs stream in via
          // `patchConsultingGridDom` without replacing the whole panel. If every
          // variation is still `loading`, keep the skeleton and buffer in
          // `pendingConsultingSpec`. Only the top-level (non-append) panel path
          // is gated — similars-append and pure append paths are unaffected.
          if (
            effectivePanelHint === 'panel' &&
            this._panel &&
            !skipSidePanelForUISpec &&
            componentType === 'ProductGrid' &&
            rootElement
          ) {
            const consultingResult = detectConsultingGrid(rootElement);
            if (consultingResult.isConsulting && !isConsultingGridReady(consultingResult)) {
              pendingConsultingSpec = spec;
              return;
            }
            if (consultingResult.isConsulting) {
              pendingConsultingSpec = null;
            }
          }

          if (effectivePanelHint === 'panel' && this._panel && !skipSidePanelForUISpec) {
            const isFirstPanelContentInStream = !panelContentReceived;
            panelContentReceived = true;
            const forceReplacePanel = rootElement?.props?.['replacePanel'] === true;

            const panelAction = forceReplacePanel
              ? 'replace'
              : determinePanelUpdateAction({
                  componentType,
                  similarsAppend: rootElement?.props?.['similarsAppend'] === true,
                  currentPanelType: this._panel.currentType,
                  hasPanelContent: this._drawer?.hasPanelContent() ?? false,
                  isPanelLoading: this._drawer?.isPanelLoading() ?? false,
                  isFirstPanelContentInStream,
                });

            renderContext.panelProductListHeading = undefined;
            if (componentType === 'ProductGrid') {
              if (panelAction === 'appendSimilars') {
                renderContext.panelProductListHeading = this._i18n.similarProductsLabel ?? 'Similar Products';
              } else {
                this._applyPanelListHeadingToContext(renderContext, { kind: 'spec', spec: panelSpec });
              }
            }

            if (panelAction === 'appendSimilars') {
              this._appendSimilarsToPanel(panelSpec, renderContext);
            } else if (panelAction === 'append') {
              this._drawer?.appendPanelContent(this._renderUISpec(panelSpec, renderContext));
              if (this._comparisonSelectMode) {
                this._refreshComparisonUI();
              }
            } else {
              replacePanelSpec(panelSpec, renderContext, componentType);
            }
            finalizePanelUpdate(componentType, rootElement, panelAction, true);
          }

          // ProductDetailsPanel goes to the panel, but also render a compact
          // horizontal ProductSummaryCard in chat messages (production parity
          // with the prior engine's LaunchSingleProduct component).
          // Silent PDP auto-prime (`isPdpAutoLaunch`) still uses a silent bot row for
          // history, but users should see the same inline summary + chip row as when
          // they open a product from chat (non-silent launchSingleProduct).
          if (
            componentType === 'ProductDetailsPanel' &&
            effectivePanelHint === 'panel' &&
            (!botMsg.silent || isPdpAutoLaunch)
          ) {
            const product = rootElement?.props?.['product'] as Record<string, unknown> | undefined;
            if (product) {
              const inlineSpec: UISpec = {
                root: 'root',
                elements: {
                  root: {
                    type: 'ProductSummaryCard',
                    props: { product },
                  },
                },
              };
              const messagesContainer = this._shadow?.querySelector('.gengage-chat-messages');
              if (messagesContainer) {
                const inline = this._renderUISpec(inlineSpec, renderContext);
                if (botMsg.threadId) {
                  inline.dataset['threadId'] = botMsg.threadId;
                }
                const bubble = this._shadow?.querySelector(`[data-message-id="${botMsg.id}"]`) as HTMLElement | null;
                if (bubble && bubble.parentNode === messagesContainer) {
                  bubble.after(inline);
                } else {
                  messagesContainer.appendChild(inline);
                }
                this._scrollInlineIntoView(inline, botMsg.threadId);
                this._drawer?.refreshPresentationCollapsed();
                panelContentReceived = true;
              }
            }
          }

          const isAiAnalysisComponent = componentType === 'AITopPicks' || componentType === 'AIGroupingCards';
          const actionButtons = componentType === 'ActionButtons' ? rootElement?.props?.['buttons'] : undefined;
          const shouldInlineQuestionActionButtons =
            componentType === 'ActionButtons' &&
            this._modeController.mode !== 'shopping' &&
            Array.isArray(actionButtons) &&
            actionButtons.length > 0 &&
            actionButtons.every((btn) => {
              const action = (btn as Record<string, unknown>)['action'] as Record<string, unknown> | undefined;
              return action?.['type'] === 'inputText';
            });
          let routeAiAnalysisToPanel = false;
          let deferAiPanelUntilGrid = false;
          if (skipSidePanelForUISpec && similarsAppendGrid) {
            renderContext.panelProductListHeading = this._i18n.similarProductsLabel ?? 'Similar Products';
          }
          if (isAiAnalysisComponent && (!botMsg.silent || isContextAutoLaunch)) {
            if (panelListEligibleForAiZone) {
              const aiEl = this._renderUISpec(spec, renderContext);
              aiAnalysisUiReceivedForPanel = true;
              this._drawer?.setPanelAiZoneState('results', { resultEl: aiEl });
              routeAiAnalysisToPanel = true;
              pendingPanelAiSpec = null;
            } else {
              pendingPanelAiSpec = spec;
              deferAiPanelUntilGrid = true;
            }
          }

          const inlineOkWhenSilentPrime =
            isContextAutoLaunch && (componentType === 'GroundingReviewCard' || isAiAnalysisComponent);
          const shouldRenderInline =
            !isAiAnalysisComponent &&
            (!botMsg.silent || inlineOkWhenSilentPrime) &&
            (effectivePanelHint !== 'panel' ||
              componentType === 'ProductCard' ||
              (skipSidePanelForUISpec && componentType === 'ProductGrid' && !similarsAppendGrid)) &&
            (componentType !== 'ActionButtons' || shouldInlineQuestionActionButtons) &&
            !routeAiAnalysisToPanel &&
            !(deferAiPanelUntilGrid && isAiAnalysisComponent);

          if (shouldRenderInline) {
            const messagesContainer = this._shadow?.querySelector('.gengage-chat-messages');
            if (messagesContainer) {
              const inline = this._renderUISpec(spec, renderContext);
              if (botMsg.threadId) {
                inline.dataset['threadId'] = botMsg.threadId;
              }
              messagesContainer.appendChild(inline);
              this._scrollInlineIntoView(inline, botMsg.threadId);
              this._drawer?.refreshPresentationCollapsed();
              if (skipSidePanelForUISpec && componentType === 'ProductGrid') {
                panelContentReceived = true;
              }
            }
          }

          // Track product thumbnails for ThumbnailsColumn
          if ((componentType === 'ProductGrid' || componentType === 'ProductCard') && botMsg.threadId) {
            const childIds = rootElement?.children ?? [];
            const products =
              componentType === 'ProductGrid'
                ? (childIds
                    .map((id) => spec.elements[id]?.props?.['product'] as Record<string, unknown> | undefined)
                    .filter(Boolean) as Record<string, unknown>[])
                : ([rootElement?.props?.['product'] as Record<string, unknown> | undefined].filter(Boolean) as Record<
                    string,
                    unknown
                  >[]);

            for (const product of products) {
              const sku = product['sku'] as string | undefined;
              const imageUrl = product['imageUrl'] as string | undefined;
              if (sku && imageUrl) {
                this._thumbnailEntries.push({ sku, imageUrl, threadId: botMsg.threadId });
              }
              if (sku) {
                this._viewedProductSkus.add(sku);
              }
            }
            this._drawer?.setThumbnails(this._thumbnailEntries);
          }

          // Send preview images to host for launcher thumbnails
          if (componentType === 'ProductGrid' || componentType === 'ProductDetailsPanel') {
            const previewProducts =
              componentType === 'ProductGrid'
                ? ((rootElement?.children ?? [])
                    .map((id) => spec.elements[id]?.props?.['product'] as Record<string, unknown> | undefined)
                    .filter(Boolean) as Record<string, unknown>[])
                : ([
                    (rootElement?.props?.['product'] ?? rootElement?.props) as Record<string, unknown> | undefined,
                  ].filter(Boolean) as Record<string, unknown>[]);
            const previewImageUrls = previewProducts
              .map((p) => p['imageUrl'] as string | undefined)
              .filter((url): url is string => typeof url === 'string')
              .slice(0, 5);
            if (previewImageUrls.length > 0) {
              this._bridge?.send('previewImages', { images: previewImageUrls });
            }
          }

          // ChoicePrompter: panel ProductGrid with 2+ products, comparison mode off
          const productGridChildCount = rootElement?.children?.length ?? 0;
          if (
            componentType === 'ProductGrid' &&
            effectivePanelHint === 'panel' &&
            !skipSidePanelForUISpec &&
            productGridChildCount > 1 &&
            !this._modeController.isChoicePrompterHidden &&
            !this._comparisonSelectMode &&
            !isChoicePrompterDismissed(this._currentThreadId ?? '')
          ) {
            this._clearChoicePrompter();
            this._choicePrompterEl = createChoicePrompter({
              heading: this._i18n.choicePrompterHeading,
              suggestion: this._i18n.choicePrompterSuggestion,
              ctaLabel: this._i18n.choicePrompterCta,
              threadId: this._currentThreadId ?? '',
              dismissAriaLabel: this._i18n.dismissAriaLabel,
              onCtaClick: () => {
                this._comparisonSelectMode = true;
                this._choicePrompterEl = null;
                this._refreshComparisonUI();
              },
              onDismiss: () => {
                this._choicePrompterEl = null;
              },
            });
            if (this._mountChoicePrompter()) {
              // Dismiss ChoicePrompter when the mobile keyboard opens (viewport shrinks)
              if (this._isMobileViewport && window.visualViewport) {
                const prompterRef = this._choicePrompterEl;
                const dismissOnKeyboard = (): void => {
                  const heightRatio = window.visualViewport!.height / window.innerHeight;
                  if (heightRatio < 0.75) {
                    prompterRef.remove();
                    if (this._choicePrompterEl === prompterRef) {
                      this._choicePrompterEl = null;
                    }
                    window.visualViewport!.removeEventListener('resize', dismissOnKeyboard);
                  }
                };
                window.visualViewport.addEventListener('resize', dismissOnKeyboard);
              }
            }
          }

          // Extract suggestion pills / input-area chips from ActionButtons UISpec
          if (componentType === 'ActionButtons') {
            const buttons = rootElement?.props?.['buttons'] as
              | Array<{
                  label: string;
                  action: ActionPayload;
                  icon?: string;
                  image?: string;
                  description?: string;
                }>
              | undefined;
            if (buttons && buttons.length > 0 && !shouldInlineQuestionActionButtons) {
              const inputChips: Array<{ label: string; icon?: string | undefined; action: ActionPayload }> = [];
              const pillButtons: typeof buttons = [];

              for (const btn of buttons) {
                if (isInputAreaAction(btn)) {
                  const chip: { label: string; icon?: string | undefined; action: ActionPayload } = {
                    label: btn.label,
                    action: btn.action,
                  };
                  if (btn.icon) chip.icon = btn.icon;
                  inputChips.push(chip);
                } else {
                  pillButtons.push(btn);
                }
              }

              if (inputChips.length > 0) {
                this._drawer?.setInputAreaChips(
                  inputChips.map((chip) => ({
                    label: chip.label,
                    onAction: () => this._sendAction(chip.action),
                    ...(chip.icon ? { icon: chip.icon } : {}),
                  })),
                );
              }

              if (pillButtons.length > 0) {
                this._drawer?.setPills(
                  pillButtons.map((btn) => {
                    const pill: {
                      label: string;
                      onAction: () => void;
                      icon?: string;
                      image?: string;
                      description?: string;
                    } = {
                      label: btn.label,
                      onAction: () => this._sendAction(btn.action),
                    };
                    if (btn.icon) pill.icon = btn.icon;
                    if (btn.image) pill.image = btn.image;
                    if (btn.description) pill.description = btn.description;
                    return pill;
                  }),
                );
              }
            }
          }

          syncPanelAiAnalysisZone();
          botMsg.uiSpec = spec;
        },
        onAction: (event: StreamEvent) => {
          if (!isPreservePanel && threadId !== this._activeRequestThreadId) return;
          if (event.type === 'action') {
            const routerOpts: ActionRouterOptions = {};
            if (this.config.actionHandling?.unknownActionPolicy !== undefined) {
              routerOpts.unknownActionPolicy = this.config.actionHandling.unknownActionPolicy;
            }
            if (this.config.actionHandling?.allowScriptCall !== undefined) {
              routerOpts.allowScriptCall = this.config.actionHandling.allowScriptCall;
            }
            routeStreamAction(
              event as StreamEventAction,
              {
                openChat: () => this.open(),
                navigate: (params) => {
                  if (!isSafeUrl(params.url)) return;
                  this._bridge?.send('navigate', params);
                  if (params.newTab) {
                    window.open(params.url, '_blank', 'noopener,noreferrer');
                  } else {
                    window.location.href = params.url;
                  }
                },
                saveSession: (params) => this.saveSession(params.sessionId, params.sku),
                addToCart: (params) => {
                  dispatch('gengage:similar:add-to-cart', params);
                },
                scriptCall: (params) => {
                  dispatch('gengage:chat:script-call', params);
                  this.config.onScriptCall?.(params);
                },
              },
              routerOpts,
            );
          }
        },
        onMetadata: (event: StreamEvent) => {
          if (!isPreservePanel && threadId !== this._activeRequestThreadId) return;
          if (event.type === 'metadata' && event.meta) {
            // Store backend context for sending with next request
            if (
              event.meta.panel !== undefined ||
              event.meta.messages !== undefined ||
              event.meta.message_id !== undefined
            ) {
              this._lastBackendContext = event.meta as import('../common/types.js').BackendContext;
              const panel = asRecord(event.meta.panel);
              if (panel) {
                this._modeController.updateFromContext(panel);
                this._applyUiHints();
              }
            }

            // Panel loading indicator
            if (event.meta.panelLoading) {
              const pendingType =
                typeof event.meta.panelPendingType === 'string' ? event.meta.panelPendingType : undefined;
              const suppressProductDetailsSkeleton =
                this.config.productDetailsExtended !== true &&
                (pendingType === 'productDetails' || pendingType === 'productDetailsSimilars');
              if (!suppressProductDetailsSkeleton) {
                panelLoadingSeen = true;
                panelContentReceived = false;
                // Snapshot current panel before replacing with skeleton
                capturePanelSourceIfNeeded();
                if (this._panel) this._panel.currentType = null;
                this._drawer?.showPanelLoading(pendingType);
                // Set panel topbar title immediately so it's not an empty white bar
                if (pendingType) {
                  this._panel?.updateTopBarForLoading(pendingType);
                }
              }
            }

            // Optional voice payload emitted by backend when voiceEnabled is true.
            if (event.meta.voice) {
              // Dispatch cancelable event — host can call preventDefault() to suppress built-in playback
              const voiceEvent = new CustomEvent('gengage:chat:voice', {
                detail: { payload: event.meta.voice },
                bubbles: false,
                cancelable: true,
              });
              const allowed = window.dispatchEvent(voiceEvent);
              ga.trackVoiceInput();

              // Built-in TTS playback (skipped if host called preventDefault)
              if (allowed) {
                const voicePayload = event.meta.voice as { audio_base64?: string; content_type?: string };
                if (voicePayload.audio_base64) {
                  this._activeTtsHandle?.stop();
                  this._activeTtsHandle = playTtsAudio(
                    voicePayload.audio_base64,
                    voicePayload.content_type ?? 'audio/ogg',
                  );
                }
              }
            }

            if (event.meta.redirectTarget || event.meta.redirect) {
              dispatch('gengage:chat:redirect', {
                target: event.meta.redirectTarget ?? null,
                payload: event.meta.redirect ?? null,
              });
              debugLog('redirect', 'redirect dispatched', {
                target: event.meta.redirectTarget ?? null,
              });
              this._handleRedirectMetadata(event.meta.redirect);
            }

            // Analyze animation — show panel loading skeleton with pulse
            if (event.meta.analyzeAnimation && this.config.productDetailsExtended === true) {
              panelLoadingSeen = true;
              panelContentReceived = false;
              capturePanelSourceIfNeeded();
              if (this._panel) this._panel.currentType = null;
              this._drawer?.showPanelLoading();
              // Default to product details title during analyze
              this._panel?.updateTopBarForLoading('productDetails');
            }

            // Thinking step messages — accumulate as checklist in typing indicator
            if (event.meta.loading) {
              const thinkingMessages = Array.isArray(event.meta.thinkingMessages)
                ? event.meta.thinkingMessages.filter((item): item is string => typeof item === 'string')
                : [];
              const loadingText = typeof event.meta.loadingText === 'string' ? event.meta.loadingText : undefined;
              if (thinkingMessages.length > 0) {
                // Beauty/watch modes: condense long thinking lists to 2 steps + loading text.
                // Standard shopping mode: show all thinking messages unmodified.
                const normalizedThinking =
                  loadingText && this._modeController.shouldCondenseThinking()
                    ? [...thinkingMessages.slice(0, 2), loadingText]
                    : thinkingMessages;
                this._drawer?.setThinkingSteps(normalizedThinking);
              }
              if (typeof loadingText === 'string' && loadingText.length > 0) {
                this._drawer?.addThinkingStep(loadingText);
                this._bridge?.send('loadingMessage', { text: loadingText });
              }
            }

            // Forward visitor engagement data to host page
            if (event.meta.visitorDataResponse) {
              this._bridge?.send('engagingMessage', event.meta.visitorDataResponse);
            }

            // Forward form events to host via bridge (Otokoc-specific)
            if (event.meta.formType) {
              this._bridge?.send('glovOtokoc', {
                type: event.meta.formType,
                data: event.meta.formPayload,
              });
            }

            // Forward launcher content to host via bridge
            if (event.meta.launcherContent) {
              this._bridge?.send('launcherContent', event.meta.launcherContent);
            }

            dispatch('gengage:chat:metadata', { payload: event.meta });

            // Extract LLM usage from metadata if present
            const meta = event.meta;
            if (typeof meta.prompt_tokens === 'number' && typeof meta.completion_tokens === 'number') {
              this.track(
                llmUsageEvent(this.analyticsContext(), {
                  model: event.model ?? 'unknown',
                  prompt_tokens: meta.prompt_tokens as number,
                  completion_tokens: meta.completion_tokens as number,
                  total_tokens:
                    (meta.total_tokens as number) ??
                    (meta.prompt_tokens as number) + (meta.completion_tokens as number),
                }),
              );
            }
          }
        },
        onError: (err) => {
          if (streamController) this._abortControllers.delete(streamController);
          // Skip error handling for aborted/superseded requests (including when no active request)
          if (!isPreservePanel && threadId !== this._activeRequestThreadId) return;
          streamDone = true;
          this._activeTypewriter?.cancel();
          this._activeTypewriter = null;
          syncPanelAiAnalysisZone();
          pendingPanelAiSpec = null;
          pendingConsultingSpec = null;
          this._bridge?.send('isResponding', false);
          this._bridge?.send('loadingMessage', { text: null });
          this._drawer?.removeTypingIndicator();
          this._drawer?.clearInputAreaChips();
          flushBeautyStreamError(beautyStreamState, {
            drawer: this._drawer,
            ensureRendered: () => {},
            cancelTypewriter: () => {},
            sendSkipMessage: () => this._sendMessage(this._i18n.beautyPhotoStepSkipMessage),
            streamDone: true,
          });
          // Capture panel state before resetting — needed for error gating below
          const hadPanelContent = panelContentReceived;
          if (panelLoadingSeen && !panelContentReceived) restoreOrClearPanel();
          panelLoadingSeen = false;
          panelContentReceived = false;
          // When the stream already delivered partial content (bot text, panel, etc.),
          // still show backend error text + recovery pills — not only clear stale chips.
          const hasVisibleContent =
            (botMsg.content != null && botMsg.content.length > 0) || localBotText.length > 0 || hadPanelContent;
          const hasContent = botMsg.silent || hasVisibleContent;
          const shouldSuppressOfflineError =
            typeof navigator !== 'undefined' && navigator.onLine === false && isLikelyConnectivityIssue(err);

          const removeAssistantPlaceholderBubble = (): void => {
            this._shadow?.querySelector(`[data-message-id="${escapeCssIdentifier(botMsg.id)}"]`)?.remove();
            const idx = this._messages.indexOf(botMsg);
            if (idx >= 0) this._messages.splice(idx, 1);
          };

          let placeholderBubbleRemoved = false;

          const applyStreamErrorRecovery = (): void => {
            if (shouldSuppressOfflineError) return;
            this.emit('error', err);
            const errMsg = err.message;
            if (errMsg === this._lastErrorMessage) {
              this._consecutiveErrorCount++;
            } else {
              this._consecutiveErrorCount = 1;
              this._lastErrorMessage = errMsg;
            }
            const backendDetail = err.message.trim();
            const displayText = backendDetail.length > 0 ? backendDetail : this._i18n.errorMessage;
            const recoveryActions = {
              onRetry: () => {
                if (this._lastSentAction) {
                  this._sendAction(this._lastSentAction.action, this._lastSentAction.options);
                }
              },
              onNewQuestion: () => {
                this._drawer?.focusInput();
              },
            };

            if (this._consecutiveErrorCount >= 2) {
              removeAssistantPlaceholderBubble();
              placeholderBubbleRemoved = true;
              this._drawer?.showErrorWithRecovery(this._i18n.accountInactiveMessage, recoveryActions);
              return;
            }

            if (shouldShowStreamErrorAsRedStrip(err, displayText)) {
              removeAssistantPlaceholderBubble();
              placeholderBubbleRemoved = true;
              this._drawer?.showErrorWithRecovery(displayText, recoveryActions);
              return;
            }

            botMsg.content = displayText;
            botMsg.status = 'done';
            const bubbleHtml = sanitizeHtml(displayText.replace(/\r\n/g, '\n').split('\n').join('<br />'));
            this._ensureAssistantMessageRendered(botMsg);
            this._drawer?.updateBotMessage(botMsg.id, bubbleHtml);
            this._drawer?.showRecoveryPillsOnly(recoveryActions);
          };

          if (isContextAutoLaunch && !hasVisibleContent) {
            if (isPdpAutoLaunch || this._hasUnavailableProductContext()) {
              this._drawer?.setPills([]);
              const fallback = this._i18n.productNotFoundMessage;
              botMsg.content = fallback;
              botMsg.status = 'done';
              this._ensureAssistantMessageRendered(botMsg);
              this._drawer?.updateBotMessage(botMsg.id, fallback);
              this._markUnavailableProductContext();
            } else {
              botMsg.status = 'done';
            }
          } else if (!hasContent) {
            applyStreamErrorRecovery();
            if (shouldSuppressOfflineError) {
              return;
            }
          } else {
            this._drawer?.setPills([]);
            if (!botMsg.silent) {
              applyStreamErrorRecovery();
            }
          }
          if (isContextAutoLaunch) {
            this._contextPrimingInFlight = false;
            this._flushQueuedUserMessages();
          }
          if (!placeholderBubbleRemoved && botMsg.status === 'streaming') {
            botMsg.status = 'error';
          }

          // Skip analytics for suppressed offline errors (consistent with the
          // early return in the !hasContent branch above).
          if (!shouldSuppressOfflineError) {
            this.track(
              streamErrorEvent(this.analyticsContext(), {
                request_id: requestId,
                error_code: 'STREAM_ERROR',
                error_message: err.message,
                widget: 'chat',
              }),
            );
          }
        },
        onDone: () => {
          if (streamController) this._abortControllers.delete(streamController);
          // Skip cleanup for aborted/superseded requests
          if (!isPreservePanel && threadId !== this._activeRequestThreadId) return;
          streamDone = true;
          // Consulting fallback: the backend never delivered a fully-ready
          // style-picker replacement, so flush the last partial spec now so
          // the shopper isn't left staring at a skeleton. Single render →
          // still no flash.
          if (pendingConsultingSpec && this._panel && this._drawer) {
            const fallbackCtx = this._buildRenderContext();
            fallbackCtx.isStreaming = false;
            const fallbackRoot = pendingConsultingSpec.elements[pendingConsultingSpec.root];
            const fallbackPanelSpec = this._panel.toPanelSpec(pendingConsultingSpec);
            this._applyPanelListHeadingToContext(fallbackCtx, { kind: 'spec', spec: fallbackPanelSpec });
            const fallbackType = fallbackRoot?.type ?? 'ProductGrid';
            replacePanelSpec(fallbackPanelSpec, fallbackCtx, fallbackType);
            finalizePanelUpdate(fallbackType, fallbackRoot, 'replace', false);
            panelContentReceived = true;
          }
          pendingConsultingSpec = null;
          // product_list never arrived but AI analysis widgets were deferred — keep them in the main panel AI zone, not the chat column
          if (pendingPanelAiSpec) {
            flushPendingPanelAiSpecToZone(false);
          }
          syncPanelAiAnalysisZone();
          this._activeRequestThreadId = null;
          // Reset consecutive error counter on successful stream completion
          this._consecutiveErrorCount = 0;
          this._lastErrorMessage = '';
          this._bridge?.send('isResponding', false);
          this._bridge?.send('loadingMessage', { text: null });
          this._drawer?.removeTypingIndicator();
          flushBeautyStreamComplete(beautyStreamState, {
            drawer: this._drawer,
            ensureRendered: () => {},
            cancelTypewriter: () => {},
            sendSkipMessage: () => this._sendMessage(this._i18n.beautyPhotoStepSkipMessage),
            streamDone: true,
          });
          const hadPanelContent = panelContentReceived;
          if (panelLoadingSeen && !panelContentReceived) restoreOrClearPanel();
          panelLoadingSeen = false;
          // Detect failed PDP auto-launch: silent launch that produced no visible
          // content. Show a soft fallback so the shopper isn't left with an empty chat.
          if (isPdpAutoLaunch && !localBotText && !hadPanelContent) {
            const fallback = this._i18n.productNotFoundMessage;
            botMsg.content = fallback;
            this._ensureAssistantMessageRendered(botMsg);
            this._drawer?.updateBotMessage(botMsg.id, fallback);
            this._markUnavailableProductContext();
          }
          panelContentReceived = false;
          if (isContextAutoLaunch) {
            this._contextPrimingInFlight = false;
            const hadQueuedMessages = this._queuedUserMessages.length > 0;
            this._flushQueuedUserMessages();
            if (!hadQueuedMessages && isPdpAutoLaunch) {
              this._ensurePdpPrimeSuggestedUiIfNeeded();
            }
          }

          if (botMsg.status === 'streaming') {
            botMsg.status = 'done';
            ga.trackMessageReceived();
          }
          this._presentation.finalizeAssistantGroup(threadId);

          // Reveal the comparison toggle button (hidden during streaming) with fade-in
          const hiddenCompareBtn = this._shadow?.querySelector('.gengage-chat-comparison-toggle-btn--hidden');
          if (hiddenCompareBtn) {
            hiddenCompareBtn.classList.remove('gengage-chat-comparison-toggle-btn--hidden');
            hiddenCompareBtn.classList.add('gengage-chat-comparison-toggle-btn--reveal');
          }

          this.emit('message', botMsg);

          // Snapshot current panel content for this message's history.
          // Pass a rebuild function so restored panels have live event listeners.
          const panelSource = this._currentPanelSource;
          this._panel?.snapshotForMessage(
            botMsg.id,
            panelSource
              ? () => {
                  const ctx = this._buildRenderContext();
                  return this._renderPanelFromSource(panelSource, ctx);
                }
              : undefined,
          );

          this.track(
            streamDoneEvent(this.analyticsContext(), {
              request_id: requestId,
              latency_ms: Date.now() - streamStart,
              chunk_count: chunkIndex,
              widget: 'chat',
            }),
          );

          this.track(
            meteringIncrementEvent(this.analyticsContext(), {
              meter_key: 'chat_request',
              quantity: 1,
              unit: 'request',
            }),
          );

          this.track(
            chatHistorySnapshotEvent(this.analyticsContext(), {
              message_count: this._messages.length,
              history_ref: this.config.session?.sessionId ?? '',
              redaction_level: 'none',
            }),
          );

          // Persist session to IndexedDB (fire-and-forget)
          this._persistToIndexedDB().catch(() => {
            /* non-fatal */
          });
        },
      },
      transport,
    );
    this._abortControllers.add(streamController);

    // Show "Stop generating" button for user-visible streams
    if (!options?.silent && !isPreservePanel) {
      const ctrl = streamController;
      this._drawer?.showStopButton(() => {
        ctrl.abort();
        this._abortControllers.delete(ctrl);
        this._drawer?.removeTypingIndicator();
        this._bridge?.send('isResponding', false);
        this._bridge?.send('loadingMessage', { text: null });
        if (botMsg.status === 'streaming') {
          botMsg.status = 'done';
        }
      });
    }
  }

  /** Return messages visible at the current thread cursor. */
  private _getVisibleMessages(): ChatMessage[] {
    const msgs = this._messages.filter((m) => !m.silent);
    if (!this._currentThreadId) return msgs;
    const cutoff = this._currentThreadId;
    return msgs.filter((m) => !m.threadId || m.threadId <= cutoff);
  }

  /** Handle rollback-on-click from a user message bubble. */
  private _appendSimilarsToPanel(spec: UISpec, ctx: import('../chat/types.js').ChatUISpecRenderContext): void {
    if (!this._drawer) return;
    const panelEl = this._drawer.getPanelContentElement();
    if (!panelEl) return;
    ctx.panelProductListHeading = this._i18n.similarProductsLabel ?? 'Similar Products';
    const grid = this._renderUISpec(spec, ctx);
    grid.classList.add('gengage-chat-product-details-similars');
    panelEl.appendChild(grid);
    this._mergePanelSourceWithSimilars(spec);
  }

  /** Normalize product SKU for comparisons (wire may send string or number). */
  private _coerceSkuKey(raw: unknown): string {
    if (typeof raw === 'string') return raw.trim();
    if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw).trim();
    return '';
  }

  private _productSkuKey(product: Record<string, unknown> | undefined): string {
    if (!product) return '';
    return this._coerceSkuKey(product['sku']);
  }

  private _pdpPageContextSkuKey(): string | null {
    const pt = this.config.pageContext?.pageType;
    if (typeof pt !== 'string' || pt.toLowerCase() !== 'pdp') return null;
    const key = this._coerceSkuKey(this.config.pageContext?.sku);
    return key || null;
  }

  /**
   * Returns the SKU of the product currently rendered in the side panel, if any.
   *
   * Used to short-circuit duplicate `ProductSummaryCard` messages when the user
   * re-clicks the product that is already open in the panel. Only returns a SKU
   * when the live panel source is a `ProductDetailsPanel` spec (either standalone
   * or paired with a similars grid).
   */
  private _getCurrentPanelProductSku(): string | null {
    const src = this._currentPanelSource;
    if (!src) return null;
    let pdpSpec: UISpec | null = null;
    if (src.kind === 'spec') pdpSpec = src.spec;
    else if (src.kind === 'productDetailsWithSimilars') pdpSpec = src.pdpSpec;
    if (!pdpSpec) return null;
    const root = pdpSpec.elements[pdpSpec.root];
    if (!root || root.type !== 'ProductDetailsPanel') return null;
    const props = root.props as Record<string, unknown> | undefined;
    const product = (props?.['product'] ?? props) as Record<string, unknown> | undefined;
    if (!product) return null;
    const key = this._coerceSkuKey(product['sku']);
    return key || null;
  }

  /**
   * “Active” PDP SKU for suppressing redundant `ProductSummaryCard` clicks: prefer
   * the panel spec when `productDetailsExtended` keeps a PDP there; otherwise
   * fall back to host `pageContext` on PDP pages (panel may have been cleared).
   */
  private _activeSkuForProductSummaryClick(): string | null {
    const fromPanel = this._getCurrentPanelProductSku();
    if (fromPanel) return fromPanel;
    return this._pdpPageContextSkuKey();
  }

  /** After similars grid is appended, extend panel source so back/history/snapshot rebuild includes it. */
  private _mergePanelSourceWithSimilars(similarsSpec: UISpec): void {
    const prev = this._currentPanelSource;
    if (prev?.kind === 'spec' && this._panel?.currentType === 'ProductDetailsPanel') {
      this._currentPanelSource = {
        kind: 'productDetailsWithSimilars',
        pdpSpec: prev.spec,
        similarsSpec,
      };
    }
  }

  /** Re-render PDP plus similar-products block (matches `_appendSimilarsToPanel` structure). */
  private _renderProductDetailsWithSimilars(
    pdpSpec: UISpec,
    similarsSpec: UISpec,
    ctx: ChatUISpecRenderContext,
  ): HTMLElement {
    this._applyPanelListHeadingToContext(ctx, {
      kind: 'productDetailsWithSimilars',
      pdpSpec,
      similarsSpec,
    });
    const panelEl = this._renderUISpec(pdpSpec, ctx);
    const grid = this._renderUISpec(similarsSpec, ctx);
    grid.classList.add('gengage-chat-product-details-similars');
    panelEl.appendChild(grid);
    return panelEl;
  }

  /** Sets ctx.panelProductListHeading for ProductGrid / PDP+similars rebuilds. */
  private _applyPanelListHeadingToContext(ctx: ChatUISpecRenderContext, source: PanelSource): void {
    ctx.panelProductListHeading = undefined;
    if (!this._panel) return;
    if (source.kind === 'spec') {
      const root = source.spec.elements[source.spec.root];
      if (root?.type === 'ProductGrid') {
        const n = root.children?.length ?? 0;
        if (n > 0) {
          ctx.panelProductListHeading = this._panel.titleForComponent(
            'ProductGrid',
            (root.props?.['panelTitle'] as string | undefined) ?? undefined,
          );
        }
      }
    } else if (source.kind === 'productDetailsWithSimilars') {
      const simRoot = source.similarsSpec.elements[source.similarsSpec.root];
      if (simRoot?.type === 'ProductGrid' && (simRoot.children?.length ?? 0) > 0) {
        ctx.panelProductListHeading = this._i18n.similarProductsLabel ?? 'Similar Products';
      }
    }
  }

  private _renderPanelFromSource(source: PanelSource, ctx: ChatUISpecRenderContext): HTMLElement {
    this._applyPanelListHeadingToContext(ctx, source);
    if (source.kind === 'favorites') {
      return this._buildFavoritesPageEl();
    }
    if (source.kind === 'productDetailsWithSimilars') {
      return this._renderProductDetailsWithSimilars(source.pdpSpec, source.similarsSpec, ctx);
    }
    return this._renderUISpec(source.spec, ctx);
  }

  private _handleRollback(messageId: string): void {
    const msg = this._messages.find((m) => m.id === messageId);
    if (!msg?.threadId) return;
    this._rollbackToThread(msg.threadId);
  }

  private _ensurePdpPrimeSuggestedUiIfNeeded(): void {
    const sku = this.config.pageContext?.sku;
    if (!sku || !this._drawer) return;
    if (this._hasUnavailableProductContext()) return;

    const contextKey: OpeningContextKey = 'product';
    const configured = this._resolveContextualOpeningActions(contextKey);
    if (configured.length > 0) {
      this._drawer.setInputAreaChips(
        configured.map((chip) => ({
          label: chip.title,
          onAction: () => this._sendAction(this._resolveContextualOpeningAction(chip, contextKey)),
          ...(chip.icon ? { icon: chip.icon } : {}),
        })),
      );
      return;
    }

    this._drawer.setInputAreaChips([
      {
        label: this._i18n.groundingReviewCta,
        icon: 'review',
        onAction: () =>
          this._sendAction({
            title: this._i18n.customerReviewsTitle,
            type: 'reviewSummary',
            payload: { sku },
          }),
      },
      {
        label: this._i18n.findSimilarLabel,
        icon: 'similar',
        onAction: () =>
          this._sendAction({
            title: this._i18n.findSimilarLabel,
            type: 'findSimilar',
            payload: { sku },
          }),
      },
    ]);
  }

  /** Rewind the conversation to the given thread. */
  private _rollbackToThread(threadId: string): void {
    // Validate thread ID exists in known threads
    if (this._panel && this._panel.threads.length > 0 && !this._panel.threads.includes(threadId)) {
      // Check if any message has this threadId as fallback
      if (!this._messages.some((m) => m.threadId === threadId)) {
        return; // Invalid thread ID — silently ignore
      }
    }
    this._currentThreadId = threadId;
    this._extendedModeManager?.setHiddenByUser(false);

    // Presentation collapse (single-thread focus) only at the conversation tip.
    // When navigating back to an older panel thread, show the full transcript up to
    // this thread — same effect as "show earlier messages" without an extra tap.
    // Forward navigation to the tip restores collapse + scroll-to-reveal UX.
    const atConversationTip = this._lastThreadId != null && threadId === this._lastThreadId;
    if (atConversationTip) {
      this._presentation.setFocusedThreadId(threadId);
      this._drawer?.setPresentationFocus(threadId);
    } else {
      this._presentation.releaseFocusedThread();
      this._drawer?.setPresentationFocus(null);
    }
    this._drawer?.setFormerMessagesButtonVisible(false);

    // Toggle visibility of messages after the cutoff
    for (const msg of this._messages) {
      const bubble = this._shadow?.querySelector(`[data-message-id="${escapeCssIdentifier(msg.id)}"]`);
      if (!bubble) continue;
      if (msg.threadId && msg.threadId > threadId) {
        bubble.classList.add('gengage-chat-bubble--hidden');
      } else {
        bubble.classList.remove('gengage-chat-bubble--hidden');
      }
    }

    // Hide inline UISpec elements from future threads
    this._shadow?.querySelectorAll('[data-thread-id]').forEach((el) => {
      if (el instanceof HTMLElement && el.dataset['threadId'] && el.dataset['threadId'] > threadId) {
        el.classList.add('gengage-chat-bubble--hidden');
      } else if (el instanceof HTMLElement) {
        el.classList.remove('gengage-chat-bubble--hidden');
      }
    });

    // Restore panel snapshot from the target thread's bot message
    const targetBot = this._messages.find((m) => m.role === 'assistant' && m.threadId === threadId);
    const restored = targetBot ? this._panel?.restoreForMessage(targetBot.id) : false;
    if (!restored) {
      this._drawer?.clearPanel();
      this._currentPanelSource = null;
    }
    if (restored && targetBot) {
      // Update panel source so drilldown history captures the correct context.
      // We can't reconstruct the exact spec, so clear it to prevent stale history pushes.
      this._currentPanelSource = null;
    }
    // Always update topbar navigation state for the new thread position
    const panelType = this._panel!.currentType ?? '';
    this._panel?.updateTopBar(panelType);

    // Clear suggestion pills (they belong to the latest thread)
    this._drawer?.setPills([]);

    requestAnimationFrame(() => {
      this._drawer?.scrollThreadIntoView(threadId, 'auto');
    });

    // Load context from IndexedDB for the target thread so the next request
    // sends the correct historical context, then prune future entries.
    if (this._session?.db && this.config.session?.sessionId) {
      const sid = this.config.session.sessionId;
      void (async () => {
        try {
          const ctx = await this._session?.db?.loadContext(sid, threadId);
          if (ctx) this._lastBackendContext = ctx.context;
          await this._session?.db?.deleteContextsAfterThread(sid, threadId);
        } catch {
          /* non-fatal */
        }
      })();
    }
  }

  // ---------------------------------------------------------------------------
  // IndexedDB persistence (delegates to SessionPersistence)
  // ---------------------------------------------------------------------------

  private async _persistToIndexedDB(): Promise<void> {
    if (!this._session || !this.config.session?.sessionId) return;
    await this._session.persist({
      userId: this.config.session.userId ?? '',
      appId: this.config.accountId,
      sessionId: this.config.session.sessionId,
      messages: this._messages,
      currentThreadId: this._currentThreadId,
      lastThreadId: this._lastThreadId,
      chatCreatedAt: this._chatCreatedAt,
      panelSnapshots: this._panel?.snapshots ?? new Map(),
      panelThreads: this._panel?.threads ?? [],
      thumbnailEntries: this._thumbnailEntries,
      lastBackendContext: this._lastBackendContext,
      sku: this.config.pageContext?.sku,
    });
  }

  private _isSameOriginUrl(url: string): boolean {
    try {
      if (!url.trim()) return false;
      const parsed = new URL(url, window.location.href);
      return parsed.origin === window.location.origin;
    } catch {
      return false;
    }
  }

  private _markUnavailableProductContext(): void {
    this._productContextUnavailableSku = this.config.pageContext?.sku ?? null;
  }

  private _clearUnavailableProductContext(): void {
    this._productContextUnavailableSku = null;
  }

  private _hasUnavailableProductContext(): boolean {
    const currentSku = this.config.pageContext?.sku;
    return currentSku !== undefined && currentSku.length > 0 && this._productContextUnavailableSku === currentSku;
  }

  private _ensureAssistantMessageRendered(msg: ChatMessage): void {
    const bubble = this._shadow?.querySelector(`[data-message-id="${escapeCssIdentifier(msg.id)}"]`);
    if (bubble || !this._drawer) return;
    if (msg.role === 'assistant' && msg.threadId && !this._threadsWithFirstBot.has(msg.threadId)) {
      this._threadsWithFirstBot.add(msg.threadId);
      this._drawer.addMessage(msg);
      this._drawer.markFirstBotMessage(msg.id);
      return;
    }
    this._drawer.addMessage(msg);
  }

  private async _saveSessionAndOpenURL(url: string): Promise<void> {
    if (!this._session) return;
    await this._session.saveAndOpenURL(url, () => this._persistToIndexedDB(), this._bridge);
  }

  private async _loadPayload(threadId: string, messageId: string): Promise<import('../common/types.js').UISpec | null> {
    if (!this._session) return null;
    return this._session.loadPayload(threadId, messageId);
  }

  /**
   * Attempt to restore chat session from IndexedDB.
   * Always restores when IDB has session data for the current sessionId.
   * Best-effort — failures are silently ignored.
   */
  private async _restoreFromIndexedDB(shouldRestore: boolean): Promise<void> {
    if (!this._session?.db) return;
    const sessionId = this.config.session?.sessionId;
    if (!sessionId) return;

    const userId = this.config.session?.userId ?? '';
    const appId = this.config.accountId;

    // Always restore favorites (user preference, not session state)
    await this._session.loadFavorites(userId, appId);
    this._drawer?.updateFavoritesBadge(this._session.favoritedSkus.size);

    // Only restore chat state on explicit handoff (e.g. SimRel product navigation)
    if (!shouldRestore) return;

    const session = await this._session.db?.loadSession(userId, appId, sessionId);
    if (!session || session.messages.length === 0) return;

    // Don't restore a session saved for a different SKU
    const currentSku = this.config.pageContext?.sku;
    if (currentSku && session.sku && session.sku !== currentSku) return;

    // Prevent duplicate auto-launch: session already has messages, so PDP launch already happened
    this._pdpLaunched = true;

    // Lock auto-scroll during restore to prevent visual jump
    this._drawer?.lockScrollForRestore();

    // Restore thread cursors and creation timestamp
    this._currentThreadId = session.currentThreadId;
    this._lastThreadId = session.lastThreadId;
    // Validate thread invariants — corrupted IDB data must not break navigation
    if (this._currentThreadId && this._lastThreadId && this._currentThreadId > this._lastThreadId) {
      this._currentThreadId = this._lastThreadId;
    }
    this._chatCreatedAt = session.createdAt;

    // Restore panel threads and thumbnail entries
    if (session.panelThreads) {
      this._panel!.threads = session.panelThreads;
    }
    if (session.thumbnailEntries) {
      this._thumbnailEntries = session.thumbnailEntries;
      this._drawer?.setThumbnails(this._thumbnailEntries);
    }

    // Restore panel snapshots from serialized HTML (sanitize for defense-in-depth)
    if (session.panelSnapshotHtml) {
      for (const [msgId, html] of Object.entries(session.panelSnapshotHtml)) {
        const container = document.createElement('div');
        container.innerHTML = sanitizeHtml(html);
        this._panel!.snapshots.set(msgId, container);
      }
    }

    // Track highest message ID to avoid collisions with new messages
    let maxMsgNum = 0;

    // Replay messages into DOM
    for (const msg of session.messages) {
      const chatMsg: ChatMessage = {
        id: msg.id,
        role: msg.role,
        timestamp: msg.timestamp,
        status: msg.status,
      };
      if (msg.threadId !== undefined) chatMsg.threadId = msg.threadId;
      if (msg.content !== undefined) chatMsg.content = msg.content;
      if (msg.silent) chatMsg.silent = true;

      this._messages.push(chatMsg);

      // Skip silent messages from DOM rendering
      if (chatMsg.silent) continue;

      if (chatMsg.role === 'assistant' && chatMsg.threadId && !this._threadsWithFirstBot.has(chatMsg.threadId)) {
        this._threadsWithFirstBot.add(chatMsg.threadId);
        this._drawer?.markFirstBotMessage(chatMsg.id);
      }
      this._drawer?.addMessage(chatMsg);

      // Track message ID counter
      const idNum = parseInt(msg.id.replace('msg-', ''), 10);
      if (!isNaN(idNum) && idNum > maxMsgNum) maxMsgNum = idNum;

      // Re-render inline UISpec elements for bot messages (load from payload store)
      if (chatMsg.role === 'assistant' && chatMsg.threadId) {
        const uiSpec = await this._loadPayload(chatMsg.threadId, chatMsg.id);
        if (uiSpec) {
          chatMsg.uiSpec = uiSpec;
          this._restoreInlineUISpec(chatMsg);
          // Clear after render to maintain lean pattern
          delete chatMsg.uiSpec;
        }
      }
    }

    // Advance message ID counter past restored messages
    if (maxMsgNum > this._currentMessageId) {
      this._currentMessageId = maxMsgNum;
    }

    // Restore backend context with fallback chain
    if (this._currentThreadId) {
      let ctx = await this._session.db?.loadContext(sessionId, this._currentThreadId);
      if (!ctx) {
        ctx = await this._session.db?.loadLatestContext(sessionId);
      }
      if (ctx) this._lastBackendContext = ctx.context;
    }

    // Restore panel for the current thread's latest bot message
    if (this._currentThreadId) {
      const panelBot = [...this._messages]
        .reverse()
        .find((m) => m.role === 'assistant' && m.threadId === this._currentThreadId && !m.silent);
      if (panelBot && this._panel!.snapshots.has(panelBot.id)) {
        this._panel?.restoreForMessage(panelBot.id);
      }
    }

    // Apply thread visibility — hide messages from future threads
    if (this._currentThreadId) {
      const cutoff = this._currentThreadId;
      for (const msg of this._messages) {
        if (msg.threadId && msg.threadId > cutoff) {
          const bubble = this._shadow?.querySelector(`[data-message-id="${escapeCssIdentifier(msg.id)}"]`);
          bubble?.classList.add('gengage-chat-bubble--hidden');
        }
      }
      this._shadow?.querySelectorAll('[data-thread-id]').forEach((el) => {
        if (el instanceof HTMLElement && el.dataset['threadId'] && el.dataset['threadId'] > cutoff) {
          el.classList.add('gengage-chat-bubble--hidden');
        }
      });
    }

    // Update panel topbar if we have panel threads
    if (this._panel!.threads.length > 0 && this._currentThreadId) {
      const lastPanelThread = this._panel!.threads[this._panel!.threads.length - 1];
      if (lastPanelThread) {
        const lastPanelBot = [...this._messages]
          .reverse()
          .find((m) => m.role === 'assistant' && m.threadId === lastPanelThread);
        if (lastPanelBot?.threadId) {
          const uiSpec = await this._loadPayload(lastPanelBot.threadId, lastPanelBot.id);
          if (uiSpec) {
            const rootEl = uiSpec.elements[uiSpec.root];
            if (rootEl) {
              this._panel?.updateTopBar(rootEl.type);
            }
          }
        }
      }
    }

    this._presentation.releaseFocusedThread();
    this._drawer?.setPresentationFocus(null);

    // After lockout expires, scroll to last thread boundary instead of absolute bottom
    setTimeout(() => {
      this._drawer?.scrollToLastThread();
    }, 550);
  }

  /**
   * Toggle comparison mode or individual SKU selection, then refresh the DOM.
   * Extracted so both the render-context callback and DOM-created checkboxes
   * share the same state-mutation + refresh path.
   */
  /**
   * Panel back navigation: pop local drilldown history first (e.g. card→detail),
   * then fall back to thread-level history.
   */
  private _navigatePanelBack(): void {
    const prev = this._localPanelHistory.pop();
    if (prev) {
      const ctx = this._buildRenderContext();
      const el = this._renderPanelFromSource(prev.source, ctx);
      this._drawer?.setPanelContent(el);
      this._drawer?.setDividerPreviewEnabled(this._shouldUseDividerPreviewForSource(prev.source));
      this._currentPanelSource = prev.source;
      const canBack = this._localPanelHistory.length > 0 || (this._panel?.threads.length ?? 0) > 1;
      this._drawer?.updatePanelTopBar(canBack, false, prev.title);
      return;
    }
    // On mobile, when there is no local history left, back = hide the side panel
    // (content is preserved so it can be reopened via the header button)
    if (this._isMobileViewport) {
      this._drawer?.hideMobilePanel();
      return;
    }
    this._panel?.navigateBack();
  }

  private _shouldUseDividerPreviewForSpec(spec: UISpec): boolean {
    return spec.elements[spec.root]?.type === 'ProductGrid';
  }

  private _shouldUseDividerPreviewForSource(source: PanelSource | null): boolean {
    return source?.kind === 'spec' ? this._shouldUseDividerPreviewForSpec(source.spec) : false;
  }

  private _toggleComparisonSku(sku: string): void {
    if (sku === '') {
      this._comparisonSelectMode = !this._comparisonSelectMode;
      this._comparisonSelectionWarning = null;
      if (this._comparisonSelectMode) {
        recordChoicePrompterDismissedForThread(this._currentThreadId ?? '');
        this._clearChoicePrompter();
      }
      if (!this._comparisonSelectMode) {
        this._comparisonSelectedSkus = [];
        this._comparisonSelectionWarning = null;
        ga.trackCompareClear();
      }
    } else {
      const idx = this._comparisonSelectedSkus.indexOf(sku);
      if (idx >= 0) {
        this._comparisonSelectedSkus = this._comparisonSelectedSkus.filter((s) => s !== sku);
        this._comparisonSelectionWarning = null;
      } else {
        if (this._comparisonSelectedSkus.length >= GengageChat._MAX_COMPARISON_SELECTION) {
          this._comparisonSelectionWarning =
            this._i18n.compareMaxHint ?? `You can select up to ${GengageChat._MAX_COMPARISON_SELECTION} products`;
          if (this._comparisonRefreshRafId !== null) {
            cancelAnimationFrame(this._comparisonRefreshRafId);
          }
          this._comparisonRefreshRafId = requestAnimationFrame(() => {
            this._comparisonRefreshRafId = null;
            this._refreshComparisonUI();
          });
          return;
        }
        this._comparisonSelectedSkus = [...this._comparisonSelectedSkus, sku];
        this._comparisonSelectionWarning = null;
        ga.trackComparePreselection(sku);
      }
    }
    // Debounce: cancel any pending refresh and schedule a new one to batch rapid toggles
    if (this._comparisonRefreshRafId !== null) {
      cancelAnimationFrame(this._comparisonRefreshRafId);
    }
    this._comparisonRefreshRafId = requestAnimationFrame(() => {
      this._comparisonRefreshRafId = null;
      this._refreshComparisonUI();
    });
  }

  /**
   * Refresh the panel DOM to reflect the current comparison state without
   * full re-render. Updates: toggle button active class, checkbox overlays
   * on product cards, and the floating comparison button.
   */
  private _refreshComparisonUI(): void {
    const panelEl = this._shadow?.querySelector('.gengage-chat-panel');
    if (!panelEl) {
      this._drawer?.setComparisonDockContent(null);
      return;
    }

    const gridWrapper = panelEl.querySelector('.gengage-chat-product-grid-wrapper');
    const grid = gridWrapper?.querySelector('.gengage-chat-product-grid');
    if (!gridWrapper || !grid) {
      this._drawer?.setComparisonDockContent(null);
      return;
    }

    // 1. Toggle comparison button active state
    const toggleBtn = gridWrapper.querySelector('.gengage-chat-comparison-toggle-btn');
    if (toggleBtn) {
      toggleBtn.classList.toggle('gengage-chat-comparison-toggle-btn--active', this._comparisonSelectMode);
    }

    // 2. Add or remove checkbox overlays on product cards
    if (this._comparisonSelectMode) {
      const cards = grid.querySelectorAll<HTMLElement>('.gengage-chat-product-card[data-sku]');
      for (const card of cards) {
        if (card.parentElement?.classList.contains('gengage-chat-comparison-select-wrapper')) {
          // Already wrapped — sync selected state
          const wrapper = card.parentElement;
          const selected = this._comparisonSelectedSkus.includes(card.dataset['sku']!);
          wrapper.classList.toggle('gengage-chat-comparison-select-wrapper--selected', selected);
          const toggle = wrapper.querySelector<HTMLButtonElement>('.gengage-chat-comparison-checkbox');
          if (toggle) {
            toggle.dataset['selected'] = selected ? 'true' : 'false';
            toggle.setAttribute('aria-pressed', selected ? 'true' : 'false');
            const icon = toggle.querySelector('.gengage-chat-comparison-checkbox-icon');
            const label = toggle.querySelector('.gengage-chat-comparison-checkbox-label');
            if (icon) {
              icon.innerHTML = selected
                ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>'
                : '<span class="gengage-chat-comparison-checkbox-dot"></span>';
            }
            if (label) {
              label.textContent = selected
                ? (this._i18n.comparisonSelectedLabel ?? 'Selected')
                : (this._i18n.comparisonSelectLabel ?? 'Select to compare');
            }
          }
          continue;
        }
        const sku = card.dataset['sku']!;
        const wrapper = document.createElement('div');
        wrapper.className = 'gengage-chat-comparison-select-wrapper';
        const selected = this._comparisonSelectedSkus.includes(sku);
        if (selected) wrapper.classList.add('gengage-chat-comparison-select-wrapper--selected');
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'gengage-chat-comparison-checkbox';
        toggle.dataset['selected'] = selected ? 'true' : 'false';
        toggle.setAttribute('aria-pressed', selected ? 'true' : 'false');
        const icon = document.createElement('span');
        icon.className = 'gengage-chat-comparison-checkbox-icon';
        icon.innerHTML = selected
          ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>'
          : '<span class="gengage-chat-comparison-checkbox-dot"></span>';
        const label = document.createElement('span');
        label.className = 'gengage-chat-comparison-checkbox-label';
        label.textContent = selected
          ? (this._i18n.comparisonSelectedLabel ?? 'Selected')
          : (this._i18n.comparisonSelectLabel ?? 'Select to compare');
        toggle.appendChild(icon);
        toggle.appendChild(label);
        toggle.addEventListener('click', (e) => {
          e.stopPropagation();
          this._toggleComparisonSku(sku);
        });
        card.parentNode!.insertBefore(wrapper, card);
        wrapper.appendChild(toggle);
        wrapper.appendChild(card);
        // Allow clicking anywhere on the card (not just the tiny checkbox) to toggle selection
        wrapper.classList.add('gds-clickable');
        wrapper.addEventListener('click', (e) => {
          if ((e.target as HTMLElement).closest('.gengage-chat-comparison-checkbox')) return;
          e.stopPropagation();
          this._toggleComparisonSku(sku);
        });
      }
    } else {
      // Remove all checkbox wrappers
      const wrappers = grid.querySelectorAll('.gengage-chat-comparison-select-wrapper');
      for (const wrapper of wrappers) {
        const card = wrapper.querySelector('.gengage-chat-product-card');
        if (card && wrapper.parentNode) {
          wrapper.parentNode.insertBefore(card, wrapper);
          wrapper.remove();
        }
      }
    }

    // 3. Update the slim bottom-docked comparison bar
    const existingFloating = gridWrapper.querySelector('.gengage-chat-comparison-floating-btn');
    existingFloating?.remove();
    if (this._comparisonSelectMode) {
      const dock = renderFloatingComparisonButton(this._comparisonSelectedSkus, this._buildRenderContext());
      if (this._isMobileViewport) {
        this._drawer?.setComparisonDockContent(dock);
      } else {
        this._drawer?.setComparisonDockContent(null);
        gridWrapper.appendChild(dock);
      }
    } else {
      this._drawer?.setComparisonDockContent(null);
    }
  }

  private _clearChoicePrompter(): void {
    this._choicePrompterEl?.remove();
    this._choicePrompterEl = null;
    this._shadow?.querySelectorAll('.gengage-chat-choice-prompter').forEach((el) => el.remove());
  }

  private _mountChoicePrompter(): boolean {
    if (!this._choicePrompterEl) return false;
    if (this._isMobileViewport) {
      this._drawer?.setComparisonDockContent(this._choicePrompterEl);
      return true;
    }
    const mountEl = this._shadow?.querySelector('.gengage-chat-panel-float');
    if (!mountEl) {
      this._choicePrompterEl = null;
      return false;
    }
    mountEl.appendChild(this._choicePrompterEl);
    return true;
  }

  private _parseAddToCartActionPayload(payload: unknown): { sku: string; cartCode: string; quantity: number } | null {
    if (typeof payload !== 'object' || payload === null) return null;
    const rec = payload as Record<string, unknown>;
    const sku = this._coerceAddToCartString(rec['sku']);
    const cartCode = this._coerceAddToCartString(rec['cartCode'] ?? rec['cart_code']);
    let quantity = 1;
    if (typeof rec['quantity'] === 'number' && Number.isFinite(rec['quantity']) && rec['quantity'] > 0) {
      quantity = Math.max(1, Math.floor(rec['quantity']));
    }
    if (!sku || !cartCode) return null;
    return { sku, cartCode, quantity };
  }

  private _coerceAddToCartString(value: unknown): string {
    if (typeof value === 'string' && value.length > 0) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return '';
  }

  private _runChatAddToCartFlow(params: { sku: string; cartCode: string; quantity: number }): void {
    if (this.config.onAddToCart !== undefined) {
      try {
        const result: unknown = this.config.onAddToCart(params);
        if (result instanceof Promise) result.catch((err: unknown) => console.error('[gengage] onAddToCart', err));
      } catch (err) {
        console.error('[gengage] onAddToCart', err);
      }
    }
    ga.trackCartAdd(params.sku, params.quantity);
    const detail = {
      ...params,
      sessionId: this.config.session?.sessionId ?? null,
    };
    dispatch('gengage:chat:add-to-cart', detail);
    this._bridge?.send('addToCart', params);
    void this._runEventCallbacks('gengage-cart-add', detail as unknown as Record<string, unknown>);
    this.track(
      basketAddEvent(this.analyticsContext(), {
        attribution_source: 'chat',
        attribution_action_id: crypto.randomUUID(),
        cart_value: 0, // Host page should enrich via event listener
        currency: this.config.pricing?.currencyCode ?? 'TRY',
        line_items: params.quantity,
        sku: params.sku,
      }),
    );
    // Sends a normalized payload to the backend regardless of the original action's
    // title or extra fields — the backend expects exactly { sku, cart_code, quantity }.
    this._sendAction(
      {
        title: this._i18n.addToCartButton ?? 'Add to Cart',
        type: 'addToCart',
        payload: { sku: params.sku, cart_code: params.cartCode, quantity: params.quantity },
      },
      { preservePanel: true },
    );
    const toastMsg = this._i18n.addedToCartToast ?? 'Added to cart';
    this._drawer?.showCartToast(toastMsg);
    this._drawer?.flashCartBadge();
  }

  /**
   * Build a ChatUISpecRenderContext with all callbacks wired up.
   * Used both during streaming and during session restore.
   */
  private _buildRenderContext(): ChatUISpecRenderContext {
    const ctx: ChatUISpecRenderContext = {
      locale: resolveLocaleTag(this.config.locale),
      onAction: (action) => {
        ga.trackSuggestedQuestion(action.title, action.type);
        if (action.type === 'addToCart') {
          const addParams = this._parseAddToCartActionPayload(action.payload);
          if (addParams) {
            this._runChatAddToCartFlow(addParams);
            return; // handled — skip the generic _sendAction fallthrough below
          }
          // Parse failed (missing sku/cartCode): fall through to _sendAction as a best-effort
        }
        if (action.type === 'launchSingleProduct') {
          this._drawer?.setDividerPreviewEnabled(false);
          const rawSku =
            typeof action.payload === 'object' && action.payload !== null && 'sku' in action.payload
              ? (action.payload as Record<string, unknown>).sku
              : undefined;
          const sku = this._coerceSkuKey(rawSku);
          const activeSku = this._activeSkuForProductSummaryClick();
          if (sku && activeSku && sku === activeSku) {
            return;
          }
          if (sku) ga.trackProductDetail(sku, action.title);
        }
        if (action.type === 'findSimilar') {
          const sku =
            typeof action.payload === 'object' && action.payload !== null && 'sku' in action.payload
              ? String((action.payload as Record<string, unknown>).sku)
              : '';
          ga.trackFindSimilars(sku);
        }
        if (action.type === 'getComparisonTable') {
          const raw = action.payload;
          const rec = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
          const src = rec && typeof rec['gengage_analytics_source'] === 'string' ? rec['gengage_analytics_source'] : '';
          let skuList: string[] = [];
          if (rec && Array.isArray(rec['sku_list'])) {
            skuList = rec['sku_list'].filter((x): x is string => typeof x === 'string');
          }
          if (src === 'floating_compare_dock') {
            ga.trackCompareProduct(skuList);
          } else {
            ga.trackCompareSelected(skuList.length > 0 ? skuList : this._comparisonSelectedSkus);
          }
        }
        // addToCart/like actions should preserve the current panel (product cards stay visible)
        const preservePanel = action.type === 'addToCart' || action.type === 'like';
        this._sendAction(action, preservePanel ? { preservePanel: true } : undefined);
      },
      onProductClick: (params) => {
        // Demo mode: load product in-chat via launchSingleProduct (no navigation)
        // Production mode: navigate to product page (chat auto-opens on new page)
        const shouldNavigate = this.config.isDemoWebsite !== true && this._isSameOriginUrl(params.url);
        if (!shouldNavigate) {
          const clickSku = this._coerceSkuKey(params.sku);
          const activeSku = this._activeSkuForProductSummaryClick();
          if (clickSku && activeSku && clickSku === activeSku) {
            return;
          }
        }
        if (!shouldNavigate) {
          ga.trackProductDetail(params.sku);
          const displayTitle = params.name?.trim() ? params.name.trim() : params.sku;
          this._sendAction({
            title: displayTitle,
            type: 'launchSingleProduct',
            payload: { sku: params.sku },
          });
        } else {
          dispatch('gengage:similar:product-click', {
            sku: params.sku,
            url: params.url,
            sessionId: this.config.session?.sessionId ?? null,
            ...(params.name !== undefined && params.name !== '' ? { productName: params.name } : {}),
          });
          this._saveSessionAndOpenURL(params.url);
        }
      },
      onAddToCart: (params) => {
        this._runChatAddToCartFlow(params);
      },
      onProductSelect: (product) => {
        // No-op when the shopper is already on this PDP (panel and/or host PDP context):
        // no extra summary bubble, no panel churn, and no follow-on launch traffic.
        const newSku = this._productSkuKey(product as Record<string, unknown>);
        const activeSku = this._activeSkuForProductSummaryClick();
        if (newSku && activeSku && newSku === activeSku) {
          return;
        }
        // Save current panel source to local history so back button can re-render it
        if (this._currentPanelSource) {
          const currentTitle = this._drawer?.getPanelTopBarTitle() ?? '';
          this._localPanelHistory.push({ source: this._currentPanelSource, title: currentTitle });
          if (this._localPanelHistory.length > GengageChat._MAX_PANEL_HISTORY) this._localPanelHistory.shift();
        }
        const summaryCtx = this._buildRenderContext();
        const summarySpec: import('../common/types.js').UISpec = {
          root: 'root',
          elements: {
            root: { type: 'ProductSummaryCard', props: { product } },
          },
        };
        const messagesContainer = this._shadow?.querySelector('.gengage-chat-messages');
        if (messagesContainer) {
          const summaryEl = this._renderUISpec(summarySpec, summaryCtx);
          if (this._currentThreadId) {
            summaryEl.dataset['threadId'] = this._currentThreadId;
          }
          messagesContainer.appendChild(summaryEl);
          this._scrollInlineIntoView(summaryEl, this._currentThreadId);
          this._drawer?.refreshPresentationCollapsed();
        }
        if (this.config.productDetailsExtended !== true) {
          this._clearAssistantPanelLikeStreamClearPanel();
          return;
        }
        const detailSpec: import('../common/types.js').UISpec = {
          root: 'root',
          elements: {
            root: {
              type: 'ProductDetailsPanel',
              props: { product },
            },
          },
        };
        this._drawer?.setPanelContent(this._renderUISpec(detailSpec, ctx));
        this._drawer?.setDividerPreviewEnabled(false);
        this._currentPanelSource = { kind: 'spec', spec: detailSpec };
        if (this._panel) this._panel.currentType = 'ProductDetailsPanel';
        this._drawer?.updatePanelTopBar(true, false, this._i18n.panelTitleProductDetails);
      },
      i18n: this._i18n,
      pricing: this.config.pricing,
      productPriceUi: this.config.productPriceUi,
      hideProductDiscountBadge: this.config.hideProductDiscountBadge,
      productSort: this._productSort,
      onSortChange: (sort) => {
        this._productSort = sort;
      },
      comparisonSelectMode: this._comparisonSelectMode,
      comparisonSelectedSkus: this._comparisonSelectedSkus,
      comparisonMaxSelection: GengageChat._MAX_COMPARISON_SELECTION,
      comparisonSelectionWarning: this._comparisonSelectionWarning,
      onToggleComparisonSku: (sku) => {
        this._toggleComparisonSku(sku);
      },
      favoritedSkus: this._session?.favoritedSkus ?? new Set(),
      onFavoriteToggle: (sku, product) => {
        void this._toggleProductFavorite(sku, product);
      },
      isMobile: this._isMobileViewport,
    };
    return ctx;
  }

  private async _toggleFavorite(sku: string, product: Record<string, unknown>): Promise<void> {
    if (!this._session) return;
    const userId = this.config.session?.userId ?? '';
    const appId = this.config.accountId;
    await this._session.toggleFavorite(userId, appId, sku, product);
    this._drawer?.updateFavoritesBadge(this._session.favoritedSkus.size);
  }

  /** Revert optimistic heart UI after a failed host favorite callback. */
  private _revertFavoriteHeartUi(sku: string): void {
    const btns = this._shadow?.querySelectorAll(`[data-gengage-favorite-sku="${escapeCssIdentifier(sku)}"]`);
    if (!btns?.length) return;
    for (const btn of btns) {
      if (!(btn instanceof HTMLButtonElement)) continue;
      btn.classList.toggle('gengage-chat-favorite-btn--active');
      const svg = btn.querySelector('svg');
      if (svg) {
        svg.setAttribute('fill', btn.classList.contains('gengage-chat-favorite-btn--active') ? 'currentColor' : 'none');
      }
    }
  }

  /**
   * Product-card favorite: dispatches window + bridge for the host, then runs `addCallback('gengage-product-favorite')`
   * handlers when registered. If none are registered, falls back to IDB favorites + optional `like` backend action.
   */
  private async _toggleProductFavorite(sku: string, product: Record<string, unknown>): Promise<void> {
    const wasLiked = this._session?.favoritedSkus.has(sku) ?? false;
    const favorited = !wasLiked;
    const detail = {
      sku,
      product,
      favorited,
      sessionId: this.config.session?.sessionId ?? null,
    };

    dispatch('gengage:chat:product-favorite', detail);
    this._bridge?.send('productFavorite', detail);

    const callbacks = this._eventCallbacks.get('gengage-product-favorite');
    if (callbacks && callbacks.size > 0) {
      for (const cb of callbacks) {
        try {
          const result = cb(detail);
          const success = result instanceof Promise ? await result : result;
          if (success === false) {
            this._revertFavoriteHeartUi(sku);
            this._handleCallbackFailure('gengage-product-favorite', detail);
            return;
          }
        } catch {
          this._revertFavoriteHeartUi(sku);
          this._handleCallbackFailure('gengage-product-favorite', detail);
          return;
        }
      }
      // All callbacks succeeded — sync in-memory state so the next click reads the correct direction.
      // IDB is intentionally skipped: the host owns persistence in callback mode.
      if (this._session) {
        if (favorited) {
          this._session.favoritedSkus.add(sku);
        } else {
          this._session.favoritedSkus.delete(sku);
        }
        this._drawer?.updateFavoritesBadge(this._session.favoritedSkus.size);
      }
      return;
    }

    await this._toggleFavorite(sku, product);
    if (favorited) {
      ga.trackLikeProduct(sku);
      const productName = (product['name'] as string | undefined) ?? sku;
      this._sendAction(
        {
          title: productName,
          type: 'like',
          payload: { sku },
        },
        { preservePanel: true },
      );
    }
  }

  private _openFavoritesPanel(): void {
    if (!this._drawer) return;

    // Save current panel source to local history so back button can re-render it
    if (this._currentPanelSource) {
      const currentTitle = this._drawer.getPanelTopBarTitle() ?? '';
      this._localPanelHistory.push({ source: this._currentPanelSource, title: currentTitle });
      if (this._localPanelHistory.length > GengageChat._MAX_PANEL_HISTORY) this._localPanelHistory.shift();
    }

    this._drawer.setPanelContent(this._buildFavoritesPageEl());
    this._drawer.setDividerPreviewEnabled(false);
    this._currentPanelSource = { kind: 'favorites' };
    this._drawer.updatePanelTopBar(true, false, this._i18n.favoritesPageTitle);
  }

  private _buildFavoritesPageEl(): HTMLElement {
    const favorites = this._session?.getFavoriteProducts() ?? [];

    if (favorites.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'gengage-chat-favorites-empty';

      const icon = document.createElement('div');
      icon.className = 'gengage-chat-favorites-empty-icon';
      icon.innerHTML = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
      empty.appendChild(icon);

      const text = document.createElement('p');
      text.textContent = this._i18n.emptyFavoritesMessage;
      empty.appendChild(text);

      return empty;
    }

    // Convert favorites to product records and render as ProductGrid UISpec
    const elements: import('../common/types.js').UISpec['elements'] = {};
    const childKeys: string[] = [];

    for (const [i, fav] of favorites.entries()) {
      const key = `card_${i}`;
      childKeys.push(key);
      elements[key] = {
        type: 'ProductCard',
        props: {
          product: {
            sku: fav.sku,
            name: fav.name,
            imageUrl: fav.imageUrl,
            price: fav.price,
          } as Record<string, unknown>,
        },
      };
    }

    elements['grid'] = { type: 'ProductGrid', children: childKeys };

    const spec: import('../common/types.js').UISpec = { root: 'grid', elements };
    return this._renderUISpec(spec, this._buildRenderContext());
  }

  /**
   * Run registered callbacks for a GA4 event.
   * If any callback returns false or throws, handle the failure (e.g. show error for cart-add).
   */
  private async _runEventCallbacks(eventName: string, detail: Record<string, unknown>): Promise<void> {
    const callbacks = this._eventCallbacks.get(eventName);
    if (!callbacks || callbacks.size === 0) return;

    for (const cb of callbacks) {
      try {
        const result = cb(detail);
        const success = result instanceof Promise ? await result : result;
        if (success === false) {
          this._handleCallbackFailure(eventName, detail);
          return;
        }
      } catch {
        this._handleCallbackFailure(eventName, detail);
        return;
      }
    }
  }

  /**
   * Handle a callback failure — for add-to-cart, show an error message in chat.
   */
  private _handleCallbackFailure(eventName: string, _detail: Record<string, unknown>): void {
    if (eventName === 'gengage-cart-add') {
      const errorText = this._i18n.cartAddErrorMessage;
      const botMsg = this._createMessage('assistant', errorText);
      if (this._currentThreadId) botMsg.threadId = this._currentThreadId;
      this._messages.push(botMsg);
      this._drawer?.addMessage(botMsg);
      // Note: _sendAction is NOT called here — onAddToCart already sent the backend
      // request unconditionally. Sending again would duplicate the cart-add action.
    }
    if (eventName === 'gengage-product-favorite') {
      const errorText = this._i18n.favoriteToggleErrorMessage;
      const botMsg = this._createMessage('assistant', errorText);
      if (this._currentThreadId) botMsg.threadId = this._currentThreadId;
      this._messages.push(botMsg);
      this._drawer?.addMessage(botMsg);
    }
  }

  /**
   * Re-render inline UISpec elements for a restored bot message.
   * Inserts them into the messages container after the message bubble.
   */
  private _restoreInlineUISpec(chatMsg: ChatMessage): void {
    if (!chatMsg.uiSpec || !this._drawer) return;
    const spec = chatMsg.uiSpec;
    const rootElement = spec.elements[spec.root];
    if (!rootElement) return;

    const componentType = rootElement.type;

    // ActionButtons are rendered as pills/chips, not inline
    if (componentType === 'ActionButtons') return;

    // Panel-only components should not be rendered inline.
    // Note: panelHint is a StreamEvent property not stored in UISpec elements,
    // so we identify panel-only status by component type.
    // ProductDetailsPanel is panel-only but gets a compact ProductSummaryCard below.
    // ComparisonTable is always panel-only.
    // ProductGrid with similarsAppend is panel-only (matches desktop + mobile behavior).
    if (componentType === 'ComparisonTable') return;
    if (isSimilarsAppendGrid(rootElement)) return;

    const renderContext = this._buildRenderContext();
    const messagesContainer = this._shadow?.querySelector('.gengage-chat-messages');
    if (!messagesContainer) return;

    // ProductDetailsPanel: synthesize a compact ProductSummaryCard for inline rendering
    if (componentType === 'ProductDetailsPanel') {
      const product = rootElement.props?.['product'] as Record<string, unknown> | undefined;
      if (!product) return;
      const inlineSpec: UISpec = {
        root: 'root',
        elements: { root: { type: 'ProductSummaryCard', props: { product } } },
      };
      const inline = this._renderUISpec(inlineSpec, renderContext);
      if (chatMsg.threadId) inline.dataset['threadId'] = chatMsg.threadId;
      messagesContainer.appendChild(inline);
      this._drawer?.refreshPresentationCollapsed();
      return;
    }

    const inline = this._renderUISpec(spec, renderContext);
    if (chatMsg.threadId) {
      inline.dataset['threadId'] = chatMsg.threadId;
    }
    messagesContainer.appendChild(inline);
    this._drawer?.refreshPresentationCollapsed();
  }

  private _createMessage(role: 'user' | 'assistant', content: string): ChatMessage {
    this._currentMessageId++;
    return {
      id: `msg-${this._currentMessageId}`,
      role,
      content,
      timestamp: Date.now(),
      status: 'done',
    };
  }

  private _resolveI18n(config: ChatWidgetConfig): ChatI18n {
    const base = resolveChatLocale(config.locale);
    return { ...base, ...config.i18n };
  }

  private _resolveUISpecRegistry(): ChatUISpecRegistry {
    const baseRegistry = createDefaultChatUISpecRegistry();
    return mergeUISpecRegistry(baseRegistry, this.config.renderer?.registry);
  }

  private _renderUISpec(spec: UISpec, context: ChatUISpecRenderContext): HTMLElement {
    const registry = this._resolveUISpecRegistry();
    const unknownRenderer = this.config.renderer?.unknownRenderer ?? defaultChatUnknownUISpecRenderer;
    const defaultRender = (inputSpec: UISpec, inputContext: ChatUISpecRenderContext) =>
      renderUISpec(inputSpec, inputContext, registry, unknownRenderer);

    const override = this.config.renderer?.renderUISpec;
    if (!override) return defaultRender(spec, context);

    const helpers: UISpecRenderHelpers<ChatUISpecRenderContext> = {
      registry,
      unknownRenderer,
      defaultRender,
    };
    return override(spec, context, helpers);
  }
}

// ---------------------------------------------------------------------------
// Convenience factory
// ---------------------------------------------------------------------------

export function createChatWidget(): GengageChat {
  return new GengageChat();
}

export type {
  ChatWidgetConfig,
  ChatMessage,
  ChatSession,
  ChatUIComponents,
  ChatI18n,
  ChatRendererConfig,
  ChatUISpecRenderContext,
  ChatUISpecRegistry,
  ProductSortState,
  SerializableChatMessage,
} from './types.js';
export {
  renderUISpec,
  createDefaultChatUISpecRegistry,
  defaultChatUnknownUISpecRenderer,
} from './components/renderUISpec.js';
export type { UISpecRenderContext } from './components/renderUISpec.js';
export { chatCatalog } from './catalog.js';
export type { ChatCatalog, ChatComponentName } from './catalog.js';
export {
  getChatScrollElement,
  invalidateChatScrollCache,
  CHAT_SCROLL_ELEMENT_ID,
} from './utils/get-chat-scroll-element.js';
export { ChatPresentationState } from './chat-presentation-state.js';
export type { GroupReadState, PresentationGroupMeta, ScrollRequest } from './chat-presentation-state.js';

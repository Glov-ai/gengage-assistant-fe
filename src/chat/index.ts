/**
 * Chat widget -- public entry point.
 *
 * Renders a floating launcher button + slide-in chat drawer inside Shadow DOM
 * for CSS isolation. Handles streaming NDJSON from the backend.
 */

import type { ActionPayload, PageContext, StreamEvent, StreamEventAction, UISpec } from '../common/types.js';
import type { ChatTransportConfig } from '../common/api-paths.js';
import type { ActionRouterOptions } from '../common/action-router.js';
import type { UISpecRenderHelpers } from '../common/renderer/index.js';
import type { BridgeMessage } from '../common/communication-bridge.js';
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
} from '../common/analytics-events.js';
import { sanitizeHtml, isSafeUrl } from '../common/safe-html.js';
import { validateImageFile } from './attachment-utils.js';
import { sendChatMessage, enrichActionPayload } from './api.js';
import { ChatDrawer } from './components/ChatDrawer.js';
import { createLauncher } from './components/Launcher.js';
import type { LauncherElements } from './components/Launcher.js';
import { playTtsAudio } from '../common/tts-player.js';
import type { AudioHandle } from '../common/tts-player.js';
import {
  renderUISpec,
  createDefaultChatUISpecRegistry,
  defaultChatUnknownUISpecRenderer,
} from './components/renderUISpec.js';
import type { TypewriterHandle } from './components/typewriter.js';
import { typewriteHtml } from './components/typewriter.js';
import { linkProductMentions } from './components/productMentionLinker.js';
import { isInputAreaAction } from './components/actionClassifier.js';
import type { ThumbnailEntry } from './components/ThumbnailsColumn.js';
import {
  createChoicePrompter,
  isChoicePrompterDismissed,
  isChoicePrompterGloballyDismissed,
} from './components/ChoicePrompter.js';
import type {
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
import { PanelManager, determinePanelUpdateAction } from './panel-manager.js';
import { SessionPersistence } from './session-persistence.js';
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
 *   middlewareUrl: 'https://chat.gengage.ai',
 *   session: { sessionId: bootstrapSession() },
 * });
 * chat.open(); // Programmatically open the drawer
 * ```
 */
export class GengageChat extends BaseWidget<ChatWidgetConfig> {
  private _shadow: ShadowRoot | null = null;
  private _rootEl: HTMLElement | null = null;
  private _launcher: LauncherElements | null = null;
  private _drawer: ChatDrawer | null = null;
  private _bridge: CommunicationBridge | null = null;
  private _drawerVisible = false;
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
  private _comparisonSelectMode = false;
  private _comparisonSelectedSkus: string[] = [];
  /** SKUs of products the user has viewed across panel product grids. */
  private _viewedProductSkus = new Set<string>();
  private _thumbnailEntries: ThumbnailEntry[] = [];
  private _choicePrompterEl: HTMLElement | null = null;
  private _openState: 'full' | 'half' = 'full';
  private _mobileBreakpoint = 768;
  private _isMobileViewport = false;
  private _pdpLaunched = false;
  /** True while the initial silent PDP launch request is in flight. */
  private _pdpPrimingInFlight = false;
  /** User messages queued until silent PDP priming completes. */
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
    options?: { silent?: boolean; attachment?: File } | undefined;
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
    source: { kind: 'spec'; spec: import('../common/types.js').UISpec } | { kind: 'favorites' };
    title: string;
  }> = [];
  private static readonly _MAX_PANEL_HISTORY = 10;
  /** Tracks how the current panel content was produced, for history/error-recovery rebuild. */
  private _currentPanelSource:
    | { kind: 'spec'; spec: import('../common/types.js').UISpec }
    | { kind: 'favorites' }
    | null = null;
  /** IndexedDB session persistence manager. */
  private _session: SessionPersistence | null = null;
  /** Registered event callbacks (GA4 event hooks). Key = event name, value = set of callbacks. */
  private _eventCallbacks = new Map<string, Set<(detail: Record<string, unknown>) => boolean | Promise<boolean>>>();
  /** Last sent action+options for retry on error. */
  private _lastSentAction: {
    action: ActionPayload;
    options?: { silent?: boolean; attachment?: File; preservePanel?: boolean; isPdpPrime?: boolean } | undefined;
  } | null = null;
  /** Consecutive identical error counter for account-inactive detection. */
  private _consecutiveErrorCount = 0;
  /** Last error message text for deduplication. */
  private _lastErrorMessage = '';

  protected async onInit(config: ChatWidgetConfig): Promise<void> {
    this._i18n = this._resolveI18n(config);
    this._chatCreatedAt = new Date().toISOString();

    // Create Shadow DOM for CSS isolation
    this._shadow = this.root.attachShadow({ mode: 'open' });

    // Inject styles
    const style = document.createElement('style');
    style.textContent = chatStyles;
    this._shadow.appendChild(style);

    // Create root container
    const rootEl = document.createElement('div');
    rootEl.className = 'gengage-chat-root';
    this._rootEl = rootEl;
    this._shadow.appendChild(rootEl);

    // Create launcher (floating variant only — inline/overlay are triggered programmatically)
    const variant = config.variant ?? 'floating';
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
      onRollback: (messageId) => this._handleRollback(messageId),
      onPanelBack: () => this._navigatePanelBack(),
      onPanelForward: () => this._panel?.navigateForward(),
      headerTitle: config.headerTitle,
      headerAvatarUrl: config.headerAvatarUrl,
      launcherImageUrl: config.launcherImageUrl,
      headerBadge: config.headerBadge,
      headerCartUrl: config.headerCartUrl,
      headerFavoritesToggle: config.headerFavoritesToggle,
      onCartClick: () => {
        if (config.headerCartUrl) {
          this._saveSessionAndOpenURL(config.headerCartUrl);
        } else {
          config.onCartClick?.();
        }
      },
      onFavoritesClick: () => {
        ga.trackLikeList();
        config.onFavoritesClick?.();
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
      onNewChat: () => {
        this._abortControllers.forEach((c) => c.abort());
        this._abortControllers.clear();
        this._activeTypewriter?.cancel();
        this._activeTypewriter = null;
        this._activeTtsHandle?.stop();
        this._activeTtsHandle = null;
        this._messages = [];
        this._drawer?.clearMessages();
        this._currentThreadId = uuidv7();
        this._lastThreadId = this._currentThreadId;
        this._choicePrompterEl?.remove();
        this._choicePrompterEl = null;
        this._viewedProductSkus.clear();
        this._drawer?.clearPanel();
        this._consecutiveErrorCount = 0;
        this._lastErrorMessage = '';
        this._thumbnailEntries = [];
        this._drawer?.setThumbnails([]);
        this._panel!.snapshots.clear();
        this._panel!.threads = [];
        // Re-show welcome if configured
        this._showWelcomeIfNeeded();
      },
    });

    // Extended mode manager for host PDP maximize/minimize
    this._extendedModeManager = new ExtendedModeManager({
      onChange: (extended) => this._panel?.notifyExtension(extended),
      productDetailsInPanel: config.isDemoWebsite ?? false,
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

    // Inline variant starts visible
    if (variant === 'inline') {
      this._drawerVisible = true;
      this.isVisible = true;
      this._applyOpenStateClasses();
    }

    // Communication bridge for host ↔ widget messaging
    this._bridge = new CommunicationBridge({
      namespace: 'chat',
      onMessage: (msg) => this._handleBridgeMessage(msg),
    });

    // Track initial SKU for page-change detection
    this._lastSku = this.config.pageContext?.sku;

    // Mark init complete and drain pending actions queue
    this._initComplete = true;
    for (const pending of this._pendingActions) {
      this._sendAction(pending.action, pending.options);
    }
    this._pendingActions = [];

    dispatch('gengage:chat:ready', {});
    ga.trackInit('chat');
    config.onReady?.();
  }

  protected onUpdate(context: Partial<PageContext>): void {
    if (context.sku !== undefined && context.sku !== this._lastSku) {
      this._lastSku = context.sku;
      this._resetForNewPage();
    }
  }

  protected onShow(): void {
    this._showDrawer();
    this.emit('open');
    dispatch('gengage:chat:open', { state: this._openState });
    ga.trackShow('chat');
    this.config.onOpen?.();

    // Show welcome message on first open with empty history
    this._showWelcomeIfNeeded();

    // Auto-launch PDP context on first open when SKU is available
    if (!this._pdpLaunched && this.config.pageContext?.sku) {
      this._pdpLaunched = true;
      this._pdpPrimingInFlight = true;
      this._sendAction(
        {
          title: '',
          type: 'launchSingleProduct',
          payload: { sku: this.config.pageContext.sku },
        },
        { silent: true, isPdpPrime: true },
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
    this._abortControllers.forEach((c) => c.abort());
    this._abortControllers.clear();
    this._activeTypewriter?.cancel();
    this._activeTypewriter = null;
    this._activeTtsHandle?.stop();
    this._activeTtsHandle = null;
    this._drawer?.destroy();
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
   * Register a callback for a GA4 event name (e.g. 'gengage-cart-add').
   * The callback receives the event detail and should return true (success) or false (failure).
   * For add-to-cart, failure triggers an error message in the chat.
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

  /** Reset all chat state when navigating to a different SKU/page. */
  private _resetForNewPage(): void {
    // Invalidate any in-flight stream callbacks so they discard themselves
    // via the `threadId !== this._activeRequestThreadId` guard.
    this._activeRequestThreadId = null;
    // Abort in-flight streams
    this._abortControllers.forEach((c) => c.abort());
    this._abortControllers.clear();
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
    // Allow PDP auto-launch for new SKU
    this._pdpLaunched = false;
    this._pdpPrimingInFlight = false;
    this._queuedUserMessages = [];
    this._productContextUnavailableSku = null;
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
        this._drawer?.scrollToBottomIfNeeded();
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
  }

  /** Show welcome message and starter pills on first open with empty history. */
  private _showWelcomeIfNeeded(): void {
    if (this._messages.length !== 0 || !this.config.welcomeMessage) return;
    const welcomeMsg: ChatMessage = {
      id: uuidv7(),
      role: 'assistant',
      content: this.config.welcomeMessage,
      timestamp: Date.now(),
      status: 'done',
    };
    this._messages.push(welcomeMsg);
    this._drawer?.addMessage(welcomeMsg);
    if (this.config.welcomeActions?.length) {
      this._drawer?.setPills(
        this.config.welcomeActions.map((label) => ({
          label,
          onAction: () => this._sendMessage(label),
        })),
      );
    }
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

  private _applyOpenStateClasses(): void {
    if (!this._rootEl) return;
    const mobileHalf = this._drawerVisible && this._isMobileViewport && this._openState === 'half';
    const mobileFull = this._drawerVisible && this._isMobileViewport && this._openState === 'full';
    this._rootEl.classList.toggle('gengage-chat-root--open', this._drawerVisible);
    this._rootEl.classList.toggle('gengage-chat-root--mobile-half', mobileHalf);
    this._rootEl.classList.toggle('gengage-chat-root--mobile-full', mobileFull);
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
    if (this._pdpPrimingInFlight) {
      this._queuedUserMessages.push(attachment !== undefined ? { text, attachment } : { text });
      return;
    }

    ga.trackMessageSent();
    // Track conversation start on first user message in a new thread
    const hasUserMessages = this._messages.some((m) => m.role === 'user');
    if (!hasUserMessages) {
      ga.trackConversationStart();
    }
    // Image upload from Chat Input uses findSimilar (not inputText) per wire protocol
    const action: ActionPayload =
      attachment !== undefined
        ? { title: text, type: 'findSimilar', payload: text ? { text } : {} }
        : { title: text, type: 'user_message', payload: text };
    if (attachment !== undefined) {
      this._sendAction(action, { attachment });
    } else {
      this._sendAction(action);
    }
  }

  private _flushQueuedUserMessages(): void {
    if (this._pdpPrimingInFlight || this._queuedUserMessages.length === 0) return;
    const queued = [...this._queuedUserMessages];
    this._queuedUserMessages = [];
    for (const item of queued) {
      this._sendMessage(item.text, item.attachment);
    }
  }

  private _sendAction(
    action: ActionPayload,
    options?: { silent?: boolean; attachment?: File; preservePanel?: boolean; isPdpPrime?: boolean },
  ): void {
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
    this._choicePrompterEl?.remove();
    this._choicePrompterEl = null;

    // Clear comparison mode when starting a new request (unless preservePanel)
    if (!options?.preservePanel && this._comparisonSelectMode) {
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
        this._shadow?.querySelector(`[data-message-id="${CSS.escape(msg.id)}"]`)?.remove();
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
    this._drawer?.setPills([]);
    this._drawer?.clearInputAreaChips();

    // Notify host that assistant is responding
    this._bridge?.send('isResponding', true);

    // Generate thread ID for this request-response cycle
    const threadId = uuidv7();
    this._currentThreadId = threadId;
    this._lastThreadId = threadId;
    // Preserve the active grid intent during product drilldowns. A product click
    // should not relabel an existing search-result panel as "similar products".
    if (this._panel && action.type !== 'launchSingleProduct') {
      this._panel.lastActionType = action.type;
    }
    // For preservePanel actions (like/addToCart), don't overwrite _activeRequestThreadId
    // to avoid silencing concurrent streams. Instead, track validity locally.
    const isPreservePanel = options?.preservePanel === true;
    const isPdpAutoLaunch =
      action.type === 'launchSingleProduct' && options?.silent === true && options?.isPdpPrime === true;
    if (!isPreservePanel) {
      this._activeRequestThreadId = threadId;
    }

    // Add user message to UI (skip for silent/auto-launch actions)
    if (!options?.silent) {
      const userText = typeof action.payload === 'string' ? action.payload : action.title;
      // Retry deduplication: skip adding a duplicate user bubble when retrying
      const lastMsg = this._messages.length > 0 ? this._messages[this._messages.length - 1] : undefined;
      const isDuplicate = lastMsg !== undefined && lastMsg.role === 'user' && lastMsg.content === userText;
      if (!isDuplicate) {
        const userMsg = this._createMessage('user', userText);
        userMsg.threadId = threadId;
        if (options?.attachment !== undefined) {
          userMsg.attachment = options.attachment;
        }
        this._drawer?.addMessage(userMsg);
        this._messages.push(userMsg);
      }
    }

    const shouldShortCircuitUnavailableContext =
      !options?.silent &&
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
      this._bridge?.send('isResponding', false);
      this.emit('message', botMsg);
      this._persistToIndexedDB().catch(() => {
        /* non-fatal */
      });
      return;
    }

    // Preserve panel during the request — don't clear or show loading skeleton
    // until the backend explicitly signals new panel content (panelLoading event).
    // Captures the panel source (UISpec/kind) so it can be re-rendered with fresh
    // event listeners if the backend fails to deliver new panel content.
    let prePanelSource = this._currentPanelSource;
    let prePanelSourceCaptured = false;
    const capturePanelSourceIfNeeded = (): void => {
      if (prePanelSourceCaptured || options?.preservePanel) return;
      prePanelSource = this._currentPanelSource;
      prePanelSourceCaptured = true;
    };
    const restoreOrClearPanel = (): void => {
      if (!this._drawer?.isPanelLoading()) return;
      if (prePanelSource) {
        const ctx = this._buildRenderContext();
        const el =
          prePanelSource.kind === 'favorites'
            ? this._buildFavoritesPageEl()
            : this._renderUISpec(prePanelSource.spec, ctx);
        this._drawer.setPanelContent(el);
        this._currentPanelSource = prePanelSource;
      } else {
        this._drawer.clearPanel();
        this._currentPanelSource = null;
      }
      prePanelSource = null;
    };

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

    // Abort previous request(s) — skip for preservePanel to avoid killing concurrent streams
    if (!options?.preservePanel) {
      this._abortControllers.forEach((c) => c.abort());
      this._abortControllers.clear();
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
      locale: this.config.locale ?? 'tr',
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

          this.track(
            streamChunkEvent(this.analyticsContext(), {
              request_id: requestId,
              chunk_index: chunkIndex++,
              widget: 'chat',
            }),
          );

          if (!this._drawer) return;

          // KVKK filtering: always strip KVKK block from display text.
          // Show banner on first encounter only.
          let displayText = localBotText;
          if (isFinal && containsKvkk(displayText)) {
            const acctId = this.config.accountId;
            if (!isKvkkShown(acctId)) {
              const kvkkHtml = extractKvkkBlock(displayText);
              if (kvkkHtml) {
                this._drawer?.showKvkkBanner(kvkkHtml, () => {
                  this._drawer?.hideKvkkBanner();
                });
              }
              markKvkkShown(acctId);
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
        },
        onUISpec: (spec, widget, panelHint) => {
          if (!isPreservePanel && threadId !== this._activeRequestThreadId) return;
          if (widget !== 'chat') return;

          const rootElement = spec.elements[spec.root];
          const componentType = rootElement?.type ?? 'unknown';
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

          const panelSpec = panelHint === 'panel' && this._panel ? this._panel.toPanelSpec(spec) : spec;
          const shouldRenderInline =
            !botMsg.silent &&
            (panelHint !== 'panel' || componentType === 'ProductCard') &&
            componentType !== 'ActionButtons'; // ActionButtons render as bottom pills only

          if (panelHint === 'panel' && this._panel) {
            const isFirstPanelContentInStream = !panelContentReceived;
            panelContentReceived = true;

            const panelAction = determinePanelUpdateAction({
              componentType,
              similarsAppend: rootElement?.props?.['similarsAppend'] === true,
              currentPanelType: this._panel.currentType,
              hasPanelContent: this._drawer?.hasPanelContent() ?? false,
              isPanelLoading: this._drawer?.isPanelLoading() ?? false,
              isFirstPanelContentInStream,
            });

            if (panelAction === 'appendSimilars') {
              this._appendSimilarsToPanel(panelSpec, renderContext);
            } else if (panelAction === 'append') {
              this._drawer?.appendPanelContent(this._renderUISpec(panelSpec, renderContext));
            } else {
              // Reset comparison state when new panel content replaces the grid
              this._comparisonSelectMode = false;
              this._comparisonSelectedSkus = [];
              this._drawer?.setPanelContent(this._renderUISpec(panelSpec, renderContext));
              this._currentPanelSource = { kind: 'spec', spec: panelSpec };
              this._panel.currentType = componentType;
            }

            if (componentType === 'ProductDetailsPanel' && action.type === 'launchSingleProduct') {
              this._clearUnavailableProductContext();
            }

            // Track panel thread and update topbar + extended mode
            if (botMsg.threadId && !this._panel.threads.includes(botMsg.threadId)) {
              this._panel.threads.push(botMsg.threadId);
            }
            // Use the primary panel type for title (don't let appended grids overwrite it).
            // Backend-provided panelTitle (e.g. search results title) takes precedence.
            const titleType = this._panel.currentType ?? componentType;
            const backendTitle = rootElement?.props?.['panelTitle'] as string | undefined;
            this._panel.updateTopBar(titleType, backendTitle);
            this._panel.updateExtendedMode(componentType);
          }

          // ProductDetailsPanel goes to the panel, but also render a compact
          // horizontal ProductSummaryCard in chat messages (production parity
          // with the prior engine's LaunchSingleProduct component).
          if (componentType === 'ProductDetailsPanel' && !botMsg.silent && panelHint === 'panel') {
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
                messagesContainer.appendChild(inline);
                inline.scrollIntoView({ behavior: 'auto', block: 'end' });
              }
            }
          }

          if (shouldRenderInline) {
            const messagesContainer = this._shadow?.querySelector('.gengage-chat-messages');
            if (messagesContainer) {
              const inline = this._renderUISpec(spec, renderContext);
              if (botMsg.threadId) {
                inline.dataset['threadId'] = botMsg.threadId;
              }
              messagesContainer.appendChild(inline);
              inline.scrollIntoView({ behavior: 'auto', block: 'end' });
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

          // Show ChoicePrompter when ProductGrid in panel, comparison mode is not active,
          // the user has viewed 2+ products, and hasn't dismissed for this thread
          if (
            componentType === 'ProductGrid' &&
            panelHint === 'panel' &&
            this._viewedProductSkus.size >= 2 &&
            !this._comparisonSelectMode &&
            !isChoicePrompterGloballyDismissed() &&
            !isChoicePrompterDismissed(this._currentThreadId ?? '')
          ) {
            this._choicePrompterEl?.remove();
            this._shadow?.querySelectorAll('.gengage-chat-choice-prompter').forEach((el) => el.remove());
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
            // Mount in the panel float anchor — the prompter floats at the
            // bottom-right of the details pane (panel), not the conversation pane.
            const mountEl = this._shadow?.querySelector('.gengage-chat-panel-float');
            if (mountEl) {
              mountEl.appendChild(this._choicePrompterEl);

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
            } else {
              this._choicePrompterEl = null;
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
            if (buttons && buttons.length > 0) {
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
            }

            // Panel loading indicator
            if (event.meta.panelLoading) {
              panelLoadingSeen = true;
              panelContentReceived = false;
              // Snapshot current panel before replacing with skeleton
              capturePanelSourceIfNeeded();
              const pendingType =
                typeof event.meta.panelPendingType === 'string' ? event.meta.panelPendingType : undefined;
              if (this._panel) this._panel.currentType = null;
              this._drawer?.showPanelLoading(pendingType);
              // Set panel topbar title immediately so it's not an empty white bar
              if (pendingType) {
                this._panel?.updateTopBarForLoading(pendingType);
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
            }

            // Analyze animation — show panel loading skeleton with pulse
            if (event.meta.analyzeAnimation) {
              panelLoadingSeen = true;
              panelContentReceived = false;
              capturePanelSourceIfNeeded();
              if (this._panel) this._panel.currentType = null;
              this._drawer?.showPanelLoading();
              // Default to product details title during analyze
              this._panel?.updateTopBarForLoading('productDetails');
            }

            // Thinking step messages — accumulate as checklist in typing indicator
            if (event.meta.loading && typeof event.meta.loadingText === 'string') {
              this._drawer?.addThinkingStep(event.meta.loadingText);
              this._bridge?.send('loadingMessage', { text: event.meta.loadingText });
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
          this._bridge?.send('isResponding', false);
          this._bridge?.send('loadingMessage', { text: null });
          this._drawer?.removeTypingIndicator();
          // Capture panel state before resetting — needed for error gating below
          const hadPanelContent = panelContentReceived;
          if (panelLoadingSeen && !panelContentReceived) restoreOrClearPanel();
          panelLoadingSeen = false;
          panelContentReceived = false;
          // Skip error toast when the stream already delivered user-facing content
          // (bot text, panel content, or silent auto-launch). Showing a generic
          // error on top of an already-rendered assistant response is confusing.
          const hasContent =
            botMsg.silent ||
            (botMsg.content != null && botMsg.content.length > 0) ||
            localBotText.length > 0 ||
            hadPanelContent;
          if (!hasContent) {
            if (isPdpAutoLaunch || this._hasUnavailableProductContext()) {
              // Show soft fallback instead of generic error for auto-launch
              const fallback = this._i18n.productNotFoundMessage;
              botMsg.content = fallback;
              botMsg.status = 'done';
              this._ensureAssistantMessageRendered(botMsg);
              this._drawer?.updateBotMessage(botMsg.id, fallback);
              this._markUnavailableProductContext();
            } else {
              // Show error inline in the chat — not as a global toast.
              // The user is in an active conversation; a toast on top of the
              // chat is confusing and can overlap with prior bot messages.
              this.emit('error', err);

              // Track consecutive identical errors — repeated failures suggest
              // the account is inactive or backend is unreachable.
              const errMsg = err.message;
              if (errMsg === this._lastErrorMessage) {
                this._consecutiveErrorCount++;
              } else {
                this._consecutiveErrorCount = 1;
                this._lastErrorMessage = errMsg;
              }

              if (this._consecutiveErrorCount >= 2) {
                // Escalate: show account-inactive message with recovery pills
                this._drawer?.showErrorWithRecovery(this._i18n.accountInactiveMessage, {
                  onRetry: () => {
                    if (this._lastSentAction) {
                      this._sendAction(this._lastSentAction.action, this._lastSentAction.options);
                    }
                  },
                  onNewQuestion: () => {
                    this._drawer?.focusInput();
                  },
                });
              } else {
                // First error: show standard error with retry + recovery pills
                this._drawer?.showErrorWithRecovery(this._i18n.errorMessage, {
                  onRetry: () => {
                    if (this._lastSentAction) {
                      this._sendAction(this._lastSentAction.action, this._lastSentAction.options);
                    }
                  },
                  onNewQuestion: () => {
                    this._drawer?.focusInput();
                  },
                });
              }
            }
          }
          if (isPdpAutoLaunch) {
            this._pdpPrimingInFlight = false;
            this._flushQueuedUserMessages();
          }
          // Only overwrite status if message hasn't already completed (isFinal text chunk sets 'done')
          if (botMsg.status === 'streaming') {
            botMsg.status = 'error';
          }

          this.track(
            streamErrorEvent(this.analyticsContext(), {
              request_id: requestId,
              error_code: 'STREAM_ERROR',
              error_message: err.message,
              widget: 'chat',
            }),
          );
        },
        onDone: () => {
          if (streamController) this._abortControllers.delete(streamController);
          // Skip cleanup for aborted/superseded requests
          if (!isPreservePanel && threadId !== this._activeRequestThreadId) return;
          this._activeRequestThreadId = null;
          // Reset consecutive error counter on successful stream completion
          this._consecutiveErrorCount = 0;
          this._lastErrorMessage = '';
          this._bridge?.send('isResponding', false);
          this._bridge?.send('loadingMessage', { text: null });
          this._drawer?.removeTypingIndicator();
          if (panelLoadingSeen && !panelContentReceived) restoreOrClearPanel();
          panelLoadingSeen = false;
          panelContentReceived = false;
          // Detect failed PDP auto-launch: silent launch action that produced
          // no visible content (no bot text, no panel). Show a soft fallback
          // message so the user isn't left with an empty chat.
          if (isPdpAutoLaunch && !localBotText && !panelContentReceived) {
            const fallback = this._i18n.productNotFoundMessage;
            botMsg.content = fallback;
            this._ensureAssistantMessageRendered(botMsg);
            this._drawer?.updateBotMessage(botMsg.id, fallback);
            this._markUnavailableProductContext();
          }
          if (isPdpAutoLaunch) {
            this._pdpPrimingInFlight = false;
            this._flushQueuedUserMessages();
          }

          if (botMsg.status === 'streaming') {
            botMsg.status = 'done';
            ga.trackMessageReceived();
          }

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
                  return panelSource.kind === 'favorites'
                    ? this._buildFavoritesPageEl()
                    : this._renderUISpec(panelSource.spec, ctx);
                }
              : undefined,
          );
          // Make the bot message bubble clickable to restore its panel state
          this._panel?.attachClickHandler(botMsg.id);

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
    const heading = document.createElement('h3');
    heading.className = 'gengage-chat-product-details-similars-heading';
    heading.textContent = this._i18n.similarProductsLabel ?? 'Similar Products';
    panelEl.appendChild(heading);
    const grid = this._renderUISpec(spec, ctx);
    grid.classList.add('gengage-chat-product-details-similars');
    panelEl.appendChild(grid);
  }

  private _handleRollback(messageId: string): void {
    const msg = this._messages.find((m) => m.id === messageId);
    if (!msg?.threadId) return;
    this._rollbackToThread(msg.threadId);
  }

  /** Rewind the conversation to the given thread. */
  private _rollbackToThread(threadId: string): void {
    this._currentThreadId = threadId;
    this._extendedModeManager?.setHiddenByUser(false);

    // Toggle visibility of messages after the cutoff
    for (const msg of this._messages) {
      const bubble = this._shadow?.querySelector(`[data-message-id="${CSS.escape(msg.id)}"]`);
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
    // Always update topbar navigation state for the new thread position
    const panelType = this._panel!.currentType ?? '';
    this._panel?.updateTopBar(panelType);

    // Clear suggestion pills (they belong to the latest thread)
    this._drawer?.setPills([]);

    // Load context from IndexedDB for the target thread so the next request
    // sends the correct historical context (not the latest one).
    if (this._session?.db && this.config.session?.sessionId) {
      this._session?.db
        .loadContext(this.config.session.sessionId, threadId)
        .then((ctx) => {
          if (ctx) this._lastBackendContext = ctx.context;
        })
        .catch(() => {
          /* non-fatal */
        });
    }

    // Prune future context entries from IndexedDB
    if (this._session?.db && this.config.session?.sessionId) {
      this._session?.db.deleteContextsAfterThread(this.config.session.sessionId, threadId).catch(() => {
        /* non-fatal */
      });
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
    const bubble = this._shadow?.querySelector(`[data-message-id="${CSS.escape(msg.id)}"]`);
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
          this._panel?.attachClickHandler(chatMsg.id);
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
          const bubble = this._shadow?.querySelector(`[data-message-id="${CSS.escape(msg.id)}"]`);
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
      const el =
        prev.source.kind === 'favorites' ? this._buildFavoritesPageEl() : this._renderUISpec(prev.source.spec, ctx);
      this._drawer?.setPanelContent(el);
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

  private _toggleComparisonSku(sku: string): void {
    if (sku === '') {
      this._comparisonSelectMode = !this._comparisonSelectMode;
      if (!this._comparisonSelectMode) {
        this._comparisonSelectedSkus = [];
        ga.trackCompareClear();
      }
    } else {
      const idx = this._comparisonSelectedSkus.indexOf(sku);
      if (idx >= 0) {
        this._comparisonSelectedSkus = this._comparisonSelectedSkus.filter((s) => s !== sku);
      } else {
        this._comparisonSelectedSkus = [...this._comparisonSelectedSkus, sku];
        ga.trackComparePreselection(sku);
      }
    }
    this._refreshComparisonUI();
  }

  /**
   * Refresh the panel DOM to reflect the current comparison state without
   * full re-render. Updates: toggle button active class, checkbox overlays
   * on product cards, and the floating comparison button.
   */
  private _refreshComparisonUI(): void {
    const panelEl = this._shadow?.querySelector('.gengage-chat-panel');
    if (!panelEl) return;

    const gridWrapper = panelEl.querySelector('.gengage-chat-product-grid-wrapper');
    if (!gridWrapper) return;
    const grid = gridWrapper.querySelector('.gengage-chat-product-grid');
    if (!grid) return;

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
          // Already wrapped — sync checked state
          const cb = card.parentElement.querySelector<HTMLInputElement>('.gengage-chat-comparison-checkbox');
          if (cb) cb.checked = this._comparisonSelectedSkus.includes(card.dataset['sku']!);
          continue;
        }
        const sku = card.dataset['sku']!;
        const wrapper = document.createElement('div');
        wrapper.className = 'gengage-chat-comparison-select-wrapper';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'gengage-chat-comparison-checkbox';
        checkbox.checked = this._comparisonSelectedSkus.includes(sku);
        checkbox.addEventListener('change', () => {
          this._toggleComparisonSku(sku);
        });
        card.parentNode!.insertBefore(wrapper, card);
        wrapper.appendChild(checkbox);
        wrapper.appendChild(card);
        // Allow clicking anywhere on the card (not just the tiny checkbox) to toggle selection
        wrapper.style.cursor = 'pointer';
        wrapper.addEventListener('click', (e) => {
          // Avoid double-toggle when the checkbox itself is clicked
          if (e.target === checkbox) return;
          checkbox.checked = !checkbox.checked;
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

    // 3. Update floating comparison button
    const existingFloating = gridWrapper.querySelector('.gengage-chat-comparison-floating-btn');
    if (this._comparisonSelectMode) {
      const count = this._comparisonSelectedSkus.length;
      const canCompare = count >= 2;
      const label = this._i18n.compareSelected ?? 'Compare';
      const text = canCompare ? `${label} (${count})` : (this._i18n.compareMinHint ?? 'Select at least 2 products');
      if (existingFloating) {
        existingFloating.textContent = text;
        (existingFloating as HTMLButtonElement).disabled = !canCompare;
        existingFloating.classList.toggle('gengage-chat-comparison-floating-btn--disabled', !canCompare);
      } else {
        const btn = document.createElement('button');
        btn.className = 'gengage-chat-comparison-floating-btn';
        btn.type = 'button';
        btn.textContent = text;
        btn.disabled = !canCompare;
        if (!canCompare) btn.classList.add('gengage-chat-comparison-floating-btn--disabled');
        btn.addEventListener('click', () => {
          if (this._comparisonSelectedSkus.length < 2) return;
          ga.trackCompareSelected(this._comparisonSelectedSkus);
          // On mobile: hide the side panel first so the user sees the chat stream starting
          if (this._isMobileViewport) this._drawer?.hideMobilePanel();
          this._sendAction({
            title: label,
            type: 'getComparisonTable',
            payload: { sku_list: [...this._comparisonSelectedSkus] },
          });
        });
        gridWrapper.appendChild(btn);
      }
    } else {
      existingFloating?.remove();
    }
  }

  /**
   * Build a ChatUISpecRenderContext with all callbacks wired up.
   * Used both during streaming and during session restore.
   */
  private _buildRenderContext(): ChatUISpecRenderContext {
    const ctx: ChatUISpecRenderContext = {
      onAction: (action) => {
        ga.trackSuggestedQuestion(action.title, action.type);
        if (action.type === 'findSimilar') {
          const sku =
            typeof action.payload === 'object' && action.payload !== null && 'sku' in action.payload
              ? String((action.payload as Record<string, unknown>).sku)
              : '';
          ga.trackFindSimilars(sku);
        }
        if (action.type === 'getComparisonTable') {
          ga.trackCompareSelected(this._comparisonSelectedSkus);
        }
        // addToCart/like actions should preserve the current panel (product cards stay visible)
        const preservePanel = action.type === 'addToCart' || action.type === 'like';
        this._sendAction(action, preservePanel ? { preservePanel: true } : undefined);
      },
      onProductClick: (params) => {
        ga.trackProductDetail(params.sku);
        // Demo mode: load product in-chat via launchSingleProduct (no navigation)
        // Production mode: navigate to product page (chat auto-opens on new page)
        const shouldNavigate = this.config.isDemoWebsite !== true && this._isSameOriginUrl(params.url);
        if (!shouldNavigate) {
          this._sendAction({
            title: params.sku,
            type: 'launchSingleProduct',
            payload: { sku: params.sku },
          });
        } else {
          dispatch('gengage:similar:product-click', {
            sku: params.sku,
            url: params.url,
            sessionId: this.config.session?.sessionId ?? null,
          });
          this._saveSessionAndOpenURL(params.url);
        }
      },
      onAddToCart: (params) => {
        ga.trackCartAdd(params.sku, params.quantity);
        const detail = {
          ...params,
          sessionId: this.config.session?.sessionId ?? null,
        };
        dispatch('gengage:chat:add-to-cart', detail);
        this._bridge?.send('addToCart', params);
        void this._runEventCallbacks('gengage-cart-add', detail as unknown as Record<string, unknown>);
        // Send addToCart action to backend — preservePanel keeps current products visible
        this._sendAction(
          {
            title: this._i18n.addToCartButton ?? 'Add to Cart',
            type: 'addToCart',
            payload: { sku: params.sku, cart_code: params.cartCode, quantity: params.quantity },
          },
          { preservePanel: true },
        );
      },
      onProductSelect: (product) => {
        // Save current panel source to local history so back button can re-render it
        if (this._currentPanelSource) {
          const currentTitle = this._drawer?.getPanelTopBarTitle() ?? '';
          this._localPanelHistory.push({ source: this._currentPanelSource, title: currentTitle });
          if (this._localPanelHistory.length > GengageChat._MAX_PANEL_HISTORY) this._localPanelHistory.shift();
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
        this._currentPanelSource = { kind: 'spec', spec: detailSpec };
        this._drawer?.updatePanelTopBar(true, false, this._i18n.panelTitleProductDetails);
      },
      i18n: this._i18n,
      pricing: this.config.pricing,
      productSort: this._productSort,
      onSortChange: (sort) => {
        this._productSort = sort;
      },
      comparisonSelectMode: this._comparisonSelectMode,
      comparisonSelectedSkus: this._comparisonSelectedSkus,
      onToggleComparisonSku: (sku) => {
        this._toggleComparisonSku(sku);
      },
      favoritedSkus: this._session?.favoritedSkus ?? new Set(),
      onFavoriteToggle: (sku, product) => {
        const wasLiked = this._session?.favoritedSkus.has(sku) ?? false;
        void this._toggleFavorite(sku, product);
        // Only send like action to backend when adding, not when removing
        if (!wasLiked) {
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

  private _openFavoritesPanel(): void {
    if (!this._drawer) return;

    // Save current panel source to local history so back button can re-render it
    if (this._currentPanelSource) {
      const currentTitle = this._drawer.getPanelTopBarTitle() ?? '';
      this._localPanelHistory.push({ source: this._currentPanelSource, title: currentTitle });
      if (this._localPanelHistory.length > GengageChat._MAX_PANEL_HISTORY) this._localPanelHistory.shift();
    }

    this._drawer.setPanelContent(this._buildFavoritesPageEl());
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
    // ProductGrid with similarsAppend is panel-appended, not inline.
    if (componentType === 'ComparisonTable') return;
    if (componentType === 'ProductGrid' && rootElement.props?.['similarsAppend'] === true) return;

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
      return;
    }

    const inline = this._renderUISpec(spec, renderContext);
    if (chatMsg.threadId) {
      inline.dataset['threadId'] = chatMsg.threadId;
    }
    messagesContainer.appendChild(inline);
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

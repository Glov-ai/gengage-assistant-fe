import { GengageChat } from '../chat/index.js';
import type { ChatI18n, ChatWidgetConfig } from '../chat/types.js';
import { GengageQNA } from '../qna/index.js';
import type { QNAWidgetConfig } from '../qna/types.js';
import { GengageSimRel } from '../simrel/index.js';
import type { SimRelWidgetConfig } from '../simrel/types.js';
import { GengageSimBut } from '../simbut/index.js';
import type { SimButWidgetConfig } from '../simbut/types.js';
import { DEFAULT_IDEMPOTENCY_KEY } from './config-schema.js';
import { resolveSession } from './context.js';
import { wireQNAToChat } from './events.js';
import { isSafeUrl } from './safe-html.js';
import type { PageContext, SessionContext, WidgetTheme } from './types.js';

const DEFAULT_OVERLAY_KEY_PREFIX = `${DEFAULT_IDEMPOTENCY_KEY}_overlay_`;
const DEFAULT_QNA_MOUNT = '#gengage-qna';
const DEFAULT_SIMREL_MOUNT = '#gengage-simrel';
const DEFAULT_SIMBUT_MOUNT = '#gengage-simbut';

interface OverlayRegistryState {
  instances: Record<string, OverlayWidgetsRuntime>;
  pending: Record<string, Promise<OverlayWidgetsRuntime>>;
}

interface WindowWithOverlayRegistry extends Window {
  __gengageOverlayRegistry?: OverlayRegistryState;
}

function getOverlayRegistry(): OverlayRegistryState {
  const win = window as WindowWithOverlayRegistry;
  if (!win.__gengageOverlayRegistry) {
    win.__gengageOverlayRegistry = {
      instances: {},
      pending: {},
    };
  }
  return win.__gengageOverlayRegistry;
}

function buildInitialPageContext(options: OverlayWidgetsOptions): PageContext {
  const base: PageContext = {
    pageType: options.pageContext?.pageType ?? (options.sku !== undefined ? 'pdp' : 'other'),
  };

  const incoming = options.pageContext;
  if (incoming?.sku !== undefined) base.sku = incoming.sku;
  if (incoming?.skuList !== undefined) base.skuList = incoming.skuList;
  if (incoming?.price !== undefined) base.price = incoming.price;
  if (incoming?.categoryTree !== undefined) base.categoryTree = incoming.categoryTree;
  if (incoming?.url !== undefined) base.url = incoming.url;
  if (incoming?.extra !== undefined) base.extra = incoming.extra;

  if (options.sku !== undefined) {
    base.sku = options.sku;
  }

  return base;
}

function mergePageContext(current: PageContext, patch: Partial<PageContext>): PageContext {
  const next: PageContext = {
    ...current,
    ...patch,
    pageType: patch.pageType ?? current.pageType,
  };
  if (patch.sku === undefined && current.sku !== undefined) {
    next.sku = current.sku;
  }
  return next;
}

function resolveMountTarget(target: HTMLElement | string): HTMLElement | string | null {
  if (target instanceof HTMLElement) return target;
  if (document.querySelector(target)) return target;
  return null;
}

function buildOverlayKey(options: OverlayWidgetsOptions): string {
  return options.idempotencyKey ?? `${DEFAULT_OVERLAY_KEY_PREFIX}${options.accountId}`;
}

export interface OverlayChatOptions {
  enabled?: boolean;
  variant?: ChatWidgetConfig['variant'];
  mountTarget?: HTMLElement | string;
  launcherSvg?: string;
  launcherImageUrl?: string;
  headerTitle?: string;
  headerAvatarUrl?: string;
  headerBadge?: string;
  headerCartUrl?: string;
  headerFavoritesToggle?: boolean;
  /** Opens merchant favorites page (passed to chat `onFavoritesClick`). */
  onFavoritesClick?: () => void;
  hideMobileLauncher?: boolean;
  mobileBreakpoint?: number;
  mobileInitialState?: 'half' | 'full';
  i18n?: Partial<ChatI18n>;
  actionHandling?: ChatWidgetConfig['actionHandling'];
  /** UISpec renderer overrides for chat components. */
  renderer?: ChatWidgetConfig['renderer'];
  /** When true, allow full product details in the assistant side panel; default is chat summary only. */
  productDetailsExtended?: boolean;
  isDemoWebsite?: ChatWidgetConfig['isDemoWebsite'];
  /** Pill launcher — forwarded to `chat.pillLauncher` (applied inside GengageChat). */
  pillLauncher?: ChatWidgetConfig['pillLauncher'];
  /** Called when the chat panel opens. */
  onOpen?: () => void;
  /** Called when the chat panel closes. */
  onClose?: () => void;
  productPriceUi?: ChatWidgetConfig['productPriceUi'];
}

export interface OverlayQNAOptions {
  enabled?: boolean;
  mountTarget?: HTMLElement | string;
  ctaText?: string;
  hideButtonRowCta?: boolean;
  inputPlaceholder?: QNAWidgetConfig['inputPlaceholder'];
  i18n?: QNAWidgetConfig['i18n'];
  /** UISpec renderer overrides for QNA components. */
  renderer?: QNAWidgetConfig['renderer'];
  /**
   * Q&A panel heading (e.g. "Koçtaş'a Sor"). Independent from `chat.headerTitle`.
   * If omitted, falls back to the deprecated `headingTitle` field.
   * Set this explicitly — it does not inherit from `chat.headerTitle`.
   */
  headerTitle?: string;
  /** @deprecated Use `headerTitle` */
  headingTitle?: string;
}

export interface OverlaySimRelOptions {
  enabled?: boolean;
  mountTarget?: HTMLElement | string;
  discountType?: SimRelWidgetConfig['discountType'];
  /** Custom card element renderer for the direct rendering path (GroupTabs/ProductGrid). */
  renderCardElement?: SimRelWidgetConfig['renderCardElement'];
  /** UISpec renderer overrides for simrel components. */
  renderer?: SimRelWidgetConfig['renderer'];
}

export interface OverlaySimButOptions {
  enabled?: boolean;
  mountTarget?: HTMLElement | string;
  /** `findSimilar` yüküne eklenecek ürün görseli URL’si. */
  imageUrl?: string;
  i18n?: SimButWidgetConfig['i18n'];
  /** Chat kapalıyken veya özel davranış için; tanımlıysa tıklamada `chat` yerine bu çağrılır. */
  onFindSimilar?: SimButWidgetConfig['onFindSimilar'];
}

export interface OverlayWidgetsOptions {
  accountId: string;
  middlewareUrl: string;
  locale?: string;
  session?: Partial<SessionContext>;
  pageContext?: Partial<PageContext>;
  sku?: string;
  theme?: WidgetTheme;
  /** Backward-compatible alias for `chat.isDemoWebsite`. */
  isDemoWebsite?: ChatWidgetConfig['isDemoWebsite'];
  /** Backward-compatible alias for `chat.productDetailsExtended`. */
  productDetailsExtended?: ChatWidgetConfig['productDetailsExtended'];
  /** Price formatting options. Defaults to Turkish locale. */
  pricing?: import('./price-formatter.js').PriceFormatConfig;
  idempotencyKey?: string;
  wireQnaToChat?: boolean;
  chat?: OverlayChatOptions;
  qna?: OverlayQNAOptions;
  simrel?: OverlaySimRelOptions;
  simbut?: OverlaySimButOptions;
  onAddToCart?: (params: import('./types.js').AddToCartParams) => void;
  onProductNavigate?: SimRelWidgetConfig['onProductNavigate'];
  onScriptCall?: ChatWidgetConfig['onScriptCall'];
}

export interface OverlayWidgetsController {
  readonly idempotencyKey: string;
  readonly session: SessionContext;
  readonly chat: GengageChat | null;
  readonly qna: GengageQNA | null;
  readonly simrel: GengageSimRel | null;
  readonly simbut: GengageSimBut | null;
  /** Shared analytics client for custom event tracking (null if not configured). */
  readonly analyticsClient: import('./analytics.js').AnalyticsClient | null;
  openChat(options?: { state?: 'half' | 'full' }): void;
  closeChat(): void;
  updateContext(patch: Partial<PageContext>): Promise<void>;
  updateSku(sku: string, pageType?: PageContext['pageType']): Promise<void>;
  destroy(): void;
}

class OverlayWidgetsRuntime implements OverlayWidgetsController {
  private _chat: GengageChat | null = null;
  private _qna: GengageQNA | null = null;
  private _simrel: GengageSimRel | null = null;
  private _simbut: GengageSimBut | null = null;
  private _analyticsClient: import('./analytics.js').AnalyticsClient | null = null;
  private _offQnaWire: (() => void) | null = null;
  private _pageContext: PageContext;
  private _destroyed = false;
  private _queue: Promise<void> = Promise.resolve();
  private _warnedQnaMountMissing = false;
  private _warnedSimRelMountMissing = false;
  private _warnedSimButMountMissing = false;
  private _warnedSimButNoChat = false;

  readonly idempotencyKey: string;
  readonly session: SessionContext;

  constructor(
    private readonly options: OverlayWidgetsOptions,
    private readonly onDestroy: () => void,
  ) {
    this.idempotencyKey = buildOverlayKey(options);
    this.session = resolveSession(options.session);
    this._pageContext = buildInitialPageContext(options);
  }

  get chat(): GengageChat | null {
    return this._chat;
  }

  get qna(): GengageQNA | null {
    return this._qna;
  }

  get simrel(): GengageSimRel | null {
    return this._simrel;
  }

  get simbut(): GengageSimBut | null {
    return this._simbut;
  }

  get analyticsClient(): import('./analytics.js').AnalyticsClient | null {
    return this._analyticsClient;
  }

  async init(): Promise<void> {
    if (!window.gengage) window.gengage = {};
    window.gengage.sessionId = this.session.sessionId;
    window.gengage.pageContext = this._pageContext;

    await this._initChat();

    if (this.options.wireQnaToChat !== false) {
      this._offQnaWire = wireQNAToChat();
    }

    await this._syncPdpWidgets();

    window.gengage.overlay = this;
  }

  openChat(options?: { state?: 'half' | 'full' }): void {
    this._chat?.open(options);
  }

  closeChat(): void {
    this._chat?.close();
  }

  async updateContext(patch: Partial<PageContext>): Promise<void> {
    if (this._destroyed) return;
    await this._enqueue(async () => {
      this._pageContext = mergePageContext(this._pageContext, patch);

      if (!window.gengage) window.gengage = {};
      window.gengage.pageContext = this._pageContext;

      this._chat?.update(patch);
      this._qna?.update(patch);
      this._simrel?.update(patch);
      this._simbut?.update(patch);
      await this._syncPdpWidgets();
    });
  }

  async updateSku(sku: string, pageType: PageContext['pageType'] = 'pdp'): Promise<void> {
    await this.updateContext({ sku, pageType });
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    this._offQnaWire?.();
    this._offQnaWire = null;

    this._chat?.destroy();
    this._qna?.destroy();
    this._simrel?.destroy();
    this._simbut?.destroy();

    this._chat = null;
    this._qna = null;
    this._simrel = null;
    this._simbut = null;

    if (window.gengage?.overlay === this) {
      delete window.gengage.overlay;
    }

    this.onDestroy();
  }

  private async _initChat(): Promise<void> {
    if (this.options.chat?.enabled === false) return;

    const middlewareUrl = this.options.middlewareUrl;
    const productDetailsExtended = this.options.chat?.productDetailsExtended ?? this.options.productDetailsExtended;
    const isDemoWebsite = this.options.chat?.isDemoWebsite ?? this.options.isDemoWebsite;

    const config: ChatWidgetConfig = {
      accountId: this.options.accountId,
      middlewareUrl,
      session: this.session,
      pageContext: this._pageContext,
      variant: this.options.chat?.variant ?? 'floating',
    };

    if (this.options.theme !== undefined) config.theme = this.options.theme;
    if (this.options.locale !== undefined) config.locale = this.options.locale;
    if (this.options.pricing !== undefined) config.pricing = this.options.pricing;
    if (this.options.chat?.mountTarget !== undefined) config.mountTarget = this.options.chat.mountTarget;
    if (this.options.chat?.pillLauncher !== undefined) {
      config.pillLauncher = this.options.chat.pillLauncher;
    }
    if (this.options.chat?.launcherImageUrl !== undefined) config.launcherImageUrl = this.options.chat.launcherImageUrl;
    else if (this.options.chat?.launcherSvg !== undefined) config.launcherSvg = this.options.chat.launcherSvg;
    if (this.options.chat?.headerTitle !== undefined) config.headerTitle = this.options.chat.headerTitle;
    if (this.options.chat?.headerAvatarUrl !== undefined) {
      config.headerAvatarUrl = this.options.chat.headerAvatarUrl;
    }
    if (this.options.chat?.headerBadge !== undefined) config.headerBadge = this.options.chat.headerBadge;
    if (this.options.chat?.headerCartUrl !== undefined) config.headerCartUrl = this.options.chat.headerCartUrl;
    if (this.options.chat?.headerFavoritesToggle !== undefined) {
      config.headerFavoritesToggle = this.options.chat.headerFavoritesToggle;
    }
    if (this.options.chat?.onFavoritesClick !== undefined) {
      config.onFavoritesClick = this.options.chat.onFavoritesClick;
    }
    if (this.options.chat?.hideMobileLauncher !== undefined) {
      config.hideMobileLauncher = this.options.chat.hideMobileLauncher;
    }
    if (this.options.chat?.mobileBreakpoint !== undefined) {
      config.mobileBreakpoint = this.options.chat.mobileBreakpoint;
    }
    if (this.options.chat?.mobileInitialState !== undefined) {
      config.mobileInitialState = this.options.chat.mobileInitialState;
    }
    if (this.options.chat?.i18n !== undefined) config.i18n = this.options.chat.i18n;
    if (this.options.chat?.actionHandling !== undefined) {
      config.actionHandling = this.options.chat.actionHandling;
    }
    if (this.options.chat?.renderer !== undefined) config.renderer = this.options.chat.renderer;
    if (productDetailsExtended !== undefined) {
      config.productDetailsExtended = productDetailsExtended;
    }
    if (isDemoWebsite !== undefined) {
      config.isDemoWebsite = isDemoWebsite;
    }
    if (this.options.chat?.productPriceUi !== undefined) {
      config.productPriceUi = this.options.chat.productPriceUi;
    }
    if (this.options.onScriptCall !== undefined) {
      config.onScriptCall = this.options.onScriptCall;
    }
    if (this.options.onAddToCart !== undefined) {
      config.onAddToCart = this.options.onAddToCart;
    }
    if (this.options.chat?.onOpen !== undefined) {
      config.onOpen = this.options.chat.onOpen;
    }
    if (this.options.chat?.onClose !== undefined) {
      config.onClose = this.options.chat.onClose;
    }

    this._chat = new GengageChat();
    await this._chat.init(config);
  }

  private async _syncPdpWidgets(): Promise<void> {
    if (this._destroyed) return;
    const sku = this._pageContext.sku;
    const isPdp = this._pageContext.pageType === 'pdp' && sku !== undefined && sku.length > 0;

    if (!isPdp) {
      // Hide rather than destroy — the mount target stays populated so the
      // user sees a graceful empty state instead of a blank/missing widget.
      // Widgets are re-shown and updated when navigation returns to a PDP page.
      this._qna?.hide();
      this._simrel?.hide();
      this._simbut?.hide();
      return;
    }

    const middlewareUrl = this.options.middlewareUrl;

    if (this.options.qna?.enabled !== false) {
      const qnaTarget = this.options.qna?.mountTarget ?? DEFAULT_QNA_MOUNT;
      const mountTarget = resolveMountTarget(qnaTarget);

      if (mountTarget) {
        this._warnedQnaMountMissing = false;
        if (!this._qna) {
          const qna = new GengageQNA();
          const qnaConfig: QNAWidgetConfig = {
            accountId: this.options.accountId,
            middlewareUrl,
            session: this.session,
            pageContext: {
              pageType: 'pdp',
              sku,
            },
            mountTarget,
          };
          if (this.options.theme !== undefined) qnaConfig.theme = this.options.theme;
          if (this.options.qna?.ctaText !== undefined) qnaConfig.ctaText = this.options.qna.ctaText;
          if (this.options.qna?.hideButtonRowCta !== undefined) {
            qnaConfig.hideButtonRowCta = this.options.qna.hideButtonRowCta;
          }
          if (this.options.qna?.inputPlaceholder !== undefined) {
            qnaConfig.inputPlaceholder = this.options.qna.inputPlaceholder;
          }
          if (this.options.qna?.i18n !== undefined) qnaConfig.i18n = this.options.qna.i18n;
          if (this.options.qna?.renderer !== undefined) qnaConfig.renderer = this.options.qna.renderer;
          const qnaHeading = this.options.qna?.headerTitle ?? this.options.qna?.headingTitle;
          if (qnaHeading !== undefined) qnaConfig.headerTitle = qnaHeading;
          await qna.init(qnaConfig);
          this._qna = qna;
        } else {
          this._qna.show();
          this._qna.update({ pageType: 'pdp', sku });
        }
      } else {
        this._qna?.destroy();
        this._qna = null;
        if (!this._warnedQnaMountMissing) {
          console.warn(`[gengage] QNA mount target not found: ${qnaTarget}`);
          this._warnedQnaMountMissing = true;
        }
      }
    } else {
      this._qna?.destroy();
      this._qna = null;
    }

    if (this.options.simrel?.enabled !== false) {
      const simRelTarget = this.options.simrel?.mountTarget ?? DEFAULT_SIMREL_MOUNT;
      const mountTarget = resolveMountTarget(simRelTarget);

      if (mountTarget) {
        this._warnedSimRelMountMissing = false;
        if (!this._simrel) {
          const simrel = new GengageSimRel();
          const simRelConfig: SimRelWidgetConfig = {
            accountId: this.options.accountId,
            middlewareUrl,
            session: this.session,
            sku,
            mountTarget,
          };
          if (this.options.theme !== undefined) simRelConfig.theme = this.options.theme;
          if (this.options.pricing !== undefined) simRelConfig.pricing = this.options.pricing;
          if (this.options.simrel?.discountType !== undefined) {
            simRelConfig.discountType = this.options.simrel.discountType;
          }
          if (this.options.simrel?.renderCardElement !== undefined) {
            simRelConfig.renderCardElement = this.options.simrel.renderCardElement;
          }
          if (this.options.simrel?.renderer !== undefined) {
            simRelConfig.renderer = this.options.simrel.renderer;
          }
          if (this.options.onAddToCart !== undefined) {
            simRelConfig.onAddToCart = this.options.onAddToCart;
          }
          if (this.options.onProductNavigate !== undefined) {
            simRelConfig.onProductNavigate = this.options.onProductNavigate;
          } else {
            simRelConfig.onProductNavigate = (url, productSku, sessionId) => {
              if (!isSafeUrl(url)) return;
              this._chat?.saveSession(sessionId ?? this.session.sessionId, productSku);
              window.location.href = url;
            };
          }
          await simrel.init(simRelConfig);
          this._simrel = simrel;
        } else {
          this._simrel.show();
          this._simrel.update({ pageType: 'pdp', sku });
        }
      } else {
        this._simrel?.destroy();
        this._simrel = null;
        if (!this._warnedSimRelMountMissing) {
          console.warn(`[gengage] SimRel mount target not found: ${simRelTarget}`);
          this._warnedSimRelMountMissing = true;
        }
      }
    } else {
      this._simrel?.destroy();
      this._simrel = null;
    }

    if (this.options.simbut && this.options.simbut.enabled !== false) {
      const simButTarget = this.options.simbut.mountTarget ?? DEFAULT_SIMBUT_MOUNT;
      const mountTarget = resolveMountTarget(simButTarget);
      const chatOrHandler = this._chat ?? this.options.simbut.onFindSimilar;

      if (mountTarget && chatOrHandler) {
        this._warnedSimButMountMissing = false;
        this._warnedSimButNoChat = false;
        if (!this._simbut) {
          const simbut = new GengageSimBut();
          const simButConfig: SimButWidgetConfig = {
            accountId: this.options.accountId,
            middlewareUrl,
            session: this.session,
            pageContext: {
              pageType: 'pdp',
              sku,
            },
            mountTarget,
            chat: this._chat,
          };
          if (this.options.theme !== undefined) simButConfig.theme = this.options.theme;
          if (this.options.locale !== undefined) simButConfig.locale = this.options.locale;
          if (this.options.simbut.imageUrl !== undefined) simButConfig.imageUrl = this.options.simbut.imageUrl;
          if (this.options.simbut.i18n !== undefined) simButConfig.i18n = this.options.simbut.i18n;
          if (this.options.simbut.onFindSimilar !== undefined) {
            simButConfig.onFindSimilar = this.options.simbut.onFindSimilar;
          }
          await simbut.init(simButConfig);
          this._simbut = simbut;
        } else {
          this._simbut.show();
          this._simbut.setChat(this._chat);
          this._simbut.update({ pageType: 'pdp', sku });
        }
      } else {
        this._simbut?.destroy();
        this._simbut = null;
        if (!mountTarget && !this._warnedSimButMountMissing) {
          console.warn(`[gengage] SimBut mount target not found: ${simButTarget}`);
          this._warnedSimButMountMissing = true;
        } else if (!chatOrHandler && !this._warnedSimButNoChat) {
          console.warn('[gengage] SimBut requires chat to be enabled or simbut.onFindSimilar');
          this._warnedSimButNoChat = true;
        }
      }
    } else {
      this._simbut?.destroy();
      this._simbut = null;
    }
  }

  private _enqueue(fn: () => Promise<void>): Promise<void> {
    const next = this._queue.then(fn);
    this._queue = next.catch((err) => {
      if (import.meta.env?.DEV) {
        console.error('[gengage:overlay] Queued operation failed:', err);
      }
    });
    return next;
  }
}

/**
 * Initialize chat, QNA, SimRel, and optional SimBut (PDP image “find similar” pill) in one call.
 * Idempotent — safe to call multiple times from GTM; deduplicates by account + SKU key.
 *
 * @example
 * ```ts
 * import { initOverlayWidgets } from '@gengage/assistant-fe';
 *
 * const controller = await initOverlayWidgets({
 *   accountId: 'mystore',
 *   middlewareUrl: 'https://chat.gengage.ai',
 *   sku: window.productSku,
 *   pageContext: { pageType: 'pdp' },
 *   chat: { variant: 'floating' },
 *   qna: { mountTarget: '#qna-section' },
 *   simrel: { mountTarget: '#similar-products' },
 *   simbut: { mountTarget: '#pdp-image-wrap' },
 * });
 * ```
 */
export async function initOverlayWidgets(options: OverlayWidgetsOptions): Promise<OverlayWidgetsController> {
  const key = buildOverlayKey(options);
  const registry = getOverlayRegistry();

  const existing = registry.instances[key];
  if (existing) return existing;

  const pending = registry.pending[key];
  if (pending) return pending;

  const runtime = new OverlayWidgetsRuntime(options, () => {
    const liveRegistry = getOverlayRegistry();
    delete liveRegistry.instances[key];
    delete liveRegistry.pending[key];
  });

  const runtimeInit = runtime
    .init()
    .then(() => {
      registry.instances[key] = runtime;
      delete registry.pending[key];
      return runtime;
    })
    .catch((err) => {
      delete registry.pending[key];
      throw err;
    });

  registry.pending[key] = runtimeInit;
  return runtimeInit;
}

export function getOverlayWidgets(idempotencyKey: string): OverlayWidgetsController | null {
  const registry = getOverlayRegistry();
  return registry.instances[idempotencyKey] ?? null;
}

export function destroyOverlayWidgets(idempotencyKey: string): void {
  const controller = getOverlayWidgets(idempotencyKey);
  controller?.destroy();
}

export function buildOverlayIdempotencyKey(accountId: string): string {
  return `${DEFAULT_OVERLAY_KEY_PREFIX}${accountId}`;
}

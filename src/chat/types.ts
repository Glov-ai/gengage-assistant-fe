import type { BaseWidgetConfig, ActionPayload } from '../common/types.js';
import type { UnknownActionPolicy } from '../common/config-schema.js';
import type { PillLauncherOptions } from '../common/pill-launcher.js';
import type { UISpecDomRegistry, UISpecRendererOverrides } from '../common/renderer/index.js';

export interface ChatWidgetConfig extends BaseWidgetConfig {
  /**
   * Widget display variant:
   *   - 'floating'  : Launcher button + slide-in drawer (default)
   *   - 'inline'    : Renders directly into mountTarget, no launcher
   *   - 'overlay'   : Full-screen modal, triggered programmatically
   */
  variant?: 'floating' | 'inline' | 'overlay';

  /**
   * Initial open state for mobile.
   * 'half' shows a half-height sheet; 'full' is full-screen.
   */
  mobileInitialState?: 'half' | 'full';

  /** Custom launcher button SVG markup. */
  launcherSvg?: string;

  /**
   * Launcher image URL — renders the launcher as a full-size image button
   * (no circular background, no padding). The image fills the entire button.
   * Takes precedence over launcherSvg when set.
   * Ignored when `pillLauncher` is set (pill derives `launcherImageUrl` from `pillLauncher.avatarUrl`).
   */
  launcherImageUrl?: string;

  /**
   * Declarative pill-shaped floating launcher (label + avatar). The widget calls
   * `makePillLauncher` and `apply()` internally after mount — no host `apply()` needed.
   * Floating variant only; omit manual `launcherImageUrl` when using this.
   */
  pillLauncher?: PillLauncherOptions;

  /** Tooltip text shown on launcher hover. */
  launcherTooltip?: string;

  /** Header display title (overrides i18n.headerTitle). */
  headerTitle?: string;

  /** Header avatar image URL. */
  headerAvatarUrl?: string;

  /** Header badge text (e.g. "BETA"). */
  headerBadge?: string;

  /**
   * Header background color (CSS color value, e.g. "#1d2939" or "hsl(220 26% 14%)").
   * Sets the `--gengage-chat-header-bg` CSS custom property.
   * Can also be set via `theme['--gengage-chat-header-bg']`.
   */
  headerBg?: string;

  /**
   * Header foreground (text/icon) color.
   * Sets the `--gengage-chat-header-foreground` CSS custom property.
   * Can also be set via `theme['--gengage-chat-header-foreground']`.
   */
  headerForeground?: string;

  /** Header cart link URL (e.g. "/sepetim"). Shows a cart icon in the header. */
  headerCartUrl?: string;

  /**
   * Legacy: show the header favorites (heart) button without `onFavoritesClick`.
   * Opens the built-in favorites list in the side panel (IDB-backed).
   */
  headerFavoritesToggle?: boolean;

  /**
   * When set, shows the header favorites button. On click, only this callback runs — use it to
   * open the merchant's favorites page (same pattern as `onCartClick`). The built-in favorites panel is not opened.
   */
  onFavoritesClick?: () => void;

  /** Callback fired when the cart icon button in the header is clicked (when headerCartUrl is not set). */
  onCartClick?: () => void;

  /** Hide the launcher on mobile viewports. */
  hideMobileLauncher?: boolean;

  /** Mobile breakpoint in px (default: 768). */
  mobileBreakpoint?: number;

  /**
   * Panel display mode:
   *   - 'auto'      : Panel appears/hides with content; user can toggle (default)
   *   - 'collapsed'  : Panel starts collapsed; user can expand
   *   - 'expanded'   : Panel starts expanded (users can still collapse/expand)
   */
  panelMode?: 'auto' | 'collapsed' | 'expanded';

  /**
   * Locale for built-in i18n strings.
   * Provide a custom `i18n` object to override any string.
   */
  locale?: string;
  i18n?: Partial<ChatI18n>;
  renderer?: ChatRendererConfig;

  // -------------------------------------------------------------------------
  // Action handling configuration
  // -------------------------------------------------------------------------

  /** Controls how streamed actions are routed (policy for unknowns, script_call gating). */
  actionHandling?: {
    unknownActionPolicy?: UnknownActionPolicy;
    allowScriptCall?: boolean;
  };

  // -------------------------------------------------------------------------
  // Welcome message
  // -------------------------------------------------------------------------

  /** Welcome message shown on first drawer open with empty history. */
  welcomeMessage?: string;
  /** Starter action pills shown with welcome message. */
  welcomeActions?: string[];
  /** Context-specific starter action pills for blank/home/listing/PDP entry states. */
  welcomeActionsByContext?: ChatWelcomeActionsByContext;
  /** Context-specific opening copy that is forwarded to the backend entry-opening flow. */
  openingMessagesByContext?: ChatContextualCopyByContext;
  /** Context-specific steering notes forwarded to the backend entry-opening flow. */
  openingGuidanceByContext?: ChatContextualCopyByContext;

  // -------------------------------------------------------------------------
  // Demo / feature flags
  // -------------------------------------------------------------------------

  /**
   * Whether this is a demo website. When combined with `productDetailsExtended: true`,
   * `productDetails` content triggers the extended panel (host PDP maximize).
   * Regular accounts render product details inline in the chat pane.
   */
  isDemoWebsite?: boolean;

  /**
   * When `true`, full `ProductDetailsPanel` and PDP similar products (`similarsAppend` grid) use
   * the assistant side panel; demo extended mode includes `productDetails`. Default `false`/omitted:
   * product details and similar products render only in the chat stream; the side panel is cleared.
   * `ProductSummaryCard` always renders inline (except for silent messages).
   */
  productDetailsExtended?: boolean;

  // -------------------------------------------------------------------------
  // Voice input (Web Speech API STT)
  // -------------------------------------------------------------------------

  /** Enable browser-native voice input. Default: false. */
  voiceEnabled?: boolean;

  // -------------------------------------------------------------------------
  // Lifecycle callbacks (alternative to .on() event listeners)
  // -------------------------------------------------------------------------
  onOpen?: () => void;
  onClose?: () => void;
  onReady?: () => void;
  onScriptCall?: (params: { name: string; payload?: Record<string, unknown> }) => void;
  onAddToCart?: (params: import('../common/types.js').AddToCartParams) => void;

  // -------------------------------------------------------------------------
  // Security
  // -------------------------------------------------------------------------

  /**
   * Allowed origins for the postMessage communication bridge.
   * Defaults to `[location.origin]` (same-origin only).
   * Pass `['*']` to allow any origin (not recommended for production).
   */
  allowedOrigins?: string[];
}

export interface ChatI18n {
  headerTitle: string;
  inputPlaceholder: string;
  sendButton: string;
  closeButton: string;
  openButton: string;
  newChatButton: string;
  poweredBy: string;
  errorMessage: string;
  retryButton: string;
  loadingMessage: string;
  loadingSequenceGeneric: string[];
  loadingSequencePanel: string[];
  loadingSequenceComparison: string[];
  productCtaLabel: string;
  /** CTA label in the product details panel when navigating to the product URL (distinct from the card "İncele" CTA). */
  viewOnSiteLabel: string;
  attachImageButton: string;
  /** Image attach popup: pick from device. */
  attachMenuSelectPhoto: string;
  /** Image attach popup: paste from clipboard. */
  attachMenuPaste: string;
  /** When clipboard has no image (paste menu or unsupported API). */
  clipboardNoImageMessage: string;
  removeAttachmentButton: string;
  invalidFileType: string;
  fileTooLarge: string;
  aiTopPicksTitle: string;
  roleWinner: string;
  roleBestValue: string;
  roleBestAlternative: string;
  viewDetails: string;
  groundingReviewCta: string;
  groundingReviewSubtitle: string;
  variantsLabel: string;
  sortRelated: string;
  sortPriceAsc: string;
  sortPriceDesc: string;
  sortToolbarAriaLabel: string;
  compareSelected: string;
  compareMinHint: string;
  compareMaxHint: string;
  comparisonSelectLabel: string;
  comparisonSelectedLabel: string;
  /** Shown on product cards while comparison mode is on — whole card toggles selection. */
  comparisonSelectCardHint: string;
  /** Shown on the main panel while the comparison table is being generated. */
  comparisonPreparingLabel: string;
  panelTitleProductDetails: string;
  panelTitleSimilarProducts: string;
  panelTitleComparisonResults: string;
  panelTitleCategories: string;
  panelTitleSearchResults: string;
  inStockLabel: string;
  outOfStockLabel: string;
  findSimilarLabel: string;
  /** Product details gallery: previous / next image controls */
  galleryPrevAriaLabel: string;
  galleryNextAriaLabel: string;
  choicePrompterHeading: string;
  choicePrompterSuggestion: string;
  choicePrompterCta: string;
  viewMoreLabel: string;
  similarProductsLabel: string;
  addToCartButton: string;
  addedToCartToast: string;
  shareButton: string;
  productInfoTab: string;
  specificationsTab: string;
  recommendedChoiceLabel: string;
  highlightsLabel: string;
  keyDifferencesLabel: string;
  specialCasesLabel: string;
  emptyReviewsMessage: string;
  closeAriaLabel: string;
  startChatLabel: string;
  voiceButton: string;
  voiceListening: string;
  voiceNotSupported: string;
  voicePermissionDenied: string;
  voiceError: string;
  handoffHeading: string;
  productNotFoundMessage: string;
  stopGenerating: string;
  offlineMessage: string;
  cartAriaLabel: string;
  favoritesAriaLabel: string;
  showPanelAriaLabel: string;
  addToFavoritesLabel: string;
  customerReviewsTitle: string;
  togglePanelAriaLabel: string;
  chatMessagesAriaLabel: string;
  suggestionsAriaLabel: string;
  moreSuggestionsAriaLabel: string;
  rollbackAriaLabel: string;
  backAriaLabel: string;
  forwardAriaLabel: string;
  /** Aria label for the panel close (✕) button shown on mobile. */
  closePanelAriaLabel: string;
  dismissAriaLabel: string;
  cartAddErrorMessage: string;
  /** Shown when a host `gengage-product-favorite` callback fails (returns false or throws). */
  favoriteToggleErrorMessage: string;
  /** Used as lowercase suffix for positive mention counts, e.g. "3 positive". */
  reviewFilterPositive: string;
  /** Used as lowercase suffix for negative mention counts, e.g. "2 negative". */
  reviewFilterNegative: string;
  decreaseLabel: string;
  increaseLabel: string;
  reviewCustomersMentionSingular: string;
  reviewCustomersMentionPlural: string;
  reviewSubjectsHeading: string;
  tryAgainButton: string;
  askSomethingElseButton: string;
  accountInactiveMessage: string;
  favoritesPageTitle: string;
  emptyFavoritesMessage: string;
  /** Sticky control when transcript is focused on the latest thread — restores full history */
  showFormerMessagesButton: string;
  /** Shown above the product grid on desktop while AI picks/groupings are still streaming. */
  aiAnalysisAnalyzingLabel: string;
  /** Section heading above AI grouping cards (panel browse categories). */
  aiBrowseCategoriesTitle: string;
}

export type OpeningContextKey = 'home' | 'listing' | 'product' | 'default';

export interface ChatActionChip {
  title: string;
  icon?: string;
}

export interface ChatWelcomeActionsByContext {
  home?: ChatActionChip[];
  listing?: ChatActionChip[];
  product?: ChatActionChip[];
  default?: ChatActionChip[];
}

export interface ChatContextualCopyByContext {
  home?: string;
  listing?: string;
  product?: string;
  default?: string;
}

export interface ChatUISpecRenderContext {
  onAction: (action: ActionPayload) => void;
  onProductClick?: (params: { sku: string; url: string; name?: string }) => void;
  onAddToCart?: (params: import('../common/types.js').AddToCartParams) => void;
  onProductSelect?: (product: Record<string, unknown>) => void;
  pricing?: import('../common/price-formatter.js').PriceFormatConfig | undefined;
  i18n?: Pick<
    ChatI18n,
    | 'productCtaLabel'
    | 'viewOnSiteLabel'
    | 'aiTopPicksTitle'
    | 'roleWinner'
    | 'roleBestValue'
    | 'roleBestAlternative'
    | 'viewDetails'
    | 'groundingReviewCta'
    | 'groundingReviewSubtitle'
    | 'variantsLabel'
    | 'sortRelated'
    | 'sortPriceAsc'
    | 'sortPriceDesc'
    | 'sortToolbarAriaLabel'
    | 'compareSelected'
    | 'compareMinHint'
    | 'comparisonSelectLabel'
    | 'comparisonSelectedLabel'
    | 'comparisonSelectCardHint'
    | 'panelTitleProductDetails'
    | 'panelTitleSimilarProducts'
    | 'panelTitleComparisonResults'
    | 'panelTitleCategories'
    | 'panelTitleSearchResults'
    | 'inStockLabel'
    | 'outOfStockLabel'
    | 'findSimilarLabel'
    | 'galleryPrevAriaLabel'
    | 'galleryNextAriaLabel'
    | 'viewMoreLabel'
    | 'similarProductsLabel'
    | 'addToCartButton'
    | 'shareButton'
    | 'productInfoTab'
    | 'specificationsTab'
    | 'recommendedChoiceLabel'
    | 'highlightsLabel'
    | 'keyDifferencesLabel'
    | 'specialCasesLabel'
    | 'emptyReviewsMessage'
    | 'closeAriaLabel'
    | 'dismissAriaLabel'
    | 'startChatLabel'
    | 'handoffHeading'
    | 'customerReviewsTitle'
    | 'addToFavoritesLabel'
    | 'reviewFilterPositive'
    | 'reviewFilterNegative'
    | 'decreaseLabel'
    | 'increaseLabel'
    | 'reviewCustomersMentionSingular'
    | 'reviewCustomersMentionPlural'
    | 'reviewSubjectsHeading'
    | 'aiBrowseCategoriesTitle'
  >;
  productSort?: ProductSortState | undefined;
  onSortChange?: ((sort: ProductSortState) => void) | undefined;
  comparisonSelectMode?: boolean | undefined;
  comparisonSelectedSkus?: string[] | undefined;
  comparisonMaxSelection?: number | undefined;
  comparisonSelectionWarning?: string | null | undefined;
  onToggleComparisonSku?: ((sku: string) => void) | undefined;
  favoritedSkus?: Set<string> | undefined;
  onFavoriteToggle?: ((sku: string, product: Record<string, unknown>) => void) | undefined;
  topPicksLoadingSku?: string | null | undefined;
  /** When true the stream is still in progress — defer compare CTA until stream ends. */
  isStreaming?: boolean | undefined;
  /** True when the widget is displayed in mobile viewport. Replaces hardcoded 768px check. */
  isMobile?: boolean | undefined;
  /** ProductGrid: heading on the same row as sort/compare (panel list / Benzer Ürünler). */
  panelProductListHeading?: string | undefined;
}

export interface ProductSortState {
  type: 'related' | 'price';
  direction?: 'asc' | 'desc' | undefined;
}

export type ChatUISpecRegistry = UISpecDomRegistry<ChatUISpecRenderContext>;
export type ChatRendererConfig = UISpecRendererOverrides<ChatUISpecRenderContext>;

// ---------------------------------------------------------------------------
// Chat-specific stream message types
// (In addition to the shared StreamEvent types in common/types.ts)
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  threadId?: string;
  role: 'user' | 'assistant';
  /** Plain text content. */
  content?: string;
  /** json-render UI spec attached to this message (e.g. product cards). */
  uiSpec?: import('../common/types.js').UISpec;
  /** Image attachment (user-uploaded). Stored in-memory until send. */
  attachment?: File;
  /** Snapshot of panel DOM at time this message's stream completed. */
  panelSnapshot?: HTMLElement;
  /** Silent messages are hidden from the conversation but kept for context. */
  silent?: boolean;
  timestamp: number;
  status: 'streaming' | 'done' | 'error';
}

export interface ChatSession {
  sessionId: string;
  messages: ChatMessage[];
  /** SKU associated with this session (for cross-page restore). */
  sku?: string;
}

/**
 * Serializable subset of ChatMessage for IndexedDB persistence.
 * Omits `attachment` (File) and `panelSnapshot` (HTMLElement) which are not
 * structurally cloneable.
 */
export interface SerializableChatMessage {
  id: string;
  threadId?: string | undefined;
  role: 'user' | 'assistant';
  content?: string | undefined;
  silent?: boolean | undefined;
  timestamp: number;
  status: 'streaming' | 'done' | 'error';
}

// ---------------------------------------------------------------------------
// json-render catalog component types for chat
// ---------------------------------------------------------------------------

export interface ChatUIComponents {
  /** A single text message bubble. */
  MessageBubble: {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: number;
  };

  /** A product card shown inline in the chat stream. */
  ProductCard: {
    sku: string;
    name: string;
    imageUrl?: string;
    price?: string;
    originalPrice?: string;
    url: string;
  };

  /** A row of quick-reply action buttons. */
  ActionButtons: {
    buttons: Array<{ label: string; action: ActionPayload }>;
  };

  /** A "typing..." indicator. */
  TypingIndicator: Record<string, never>;

  /** A divider with an optional label (e.g. "New conversation"). */
  Divider: { label?: string };
}

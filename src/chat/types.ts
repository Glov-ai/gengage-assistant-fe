import type { BaseWidgetConfig, ActionPayload } from '../common/types.js';
import type { UnknownActionPolicy } from '../common/config-schema.js';
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
   */
  launcherImageUrl?: string;

  /** Tooltip text shown on launcher hover. */
  launcherTooltip?: string;

  /** Header display title (overrides i18n.headerTitle). */
  headerTitle?: string;

  /** Header avatar image URL. */
  headerAvatarUrl?: string;

  /** Header badge text (e.g. "BETA"). */
  headerBadge?: string;

  /** Header cart link URL (e.g. "/sepetim"). Shows a cart icon in the header. */
  headerCartUrl?: string;

  /** Show a favorites (heart) toggle button in the header. */
  headerFavoritesToggle?: boolean;

  /** Callback fired when the favorites header button is clicked (before internal favorites panel opens). */
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

  // -------------------------------------------------------------------------
  // Demo / feature flags
  // -------------------------------------------------------------------------

  /**
   * Whether this is a demo website. When true, `productDetails` content
   * triggers the extended panel (host PDP maximize). Regular accounts
   * render product details inline in the chat pane.
   */
  isDemoWebsite?: boolean;

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
  productCtaLabel: string;
  attachImageButton: string;
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
  compareSelected: string;
  compareMinHint: string;
  panelTitleProductDetails: string;
  panelTitleSimilarProducts: string;
  panelTitleComparisonResults: string;
  panelTitleCategories: string;
  panelTitleSearchResults: string;
  inStockLabel: string;
  outOfStockLabel: string;
  findSimilarLabel: string;
  choicePrompterHeading: string;
  choicePrompterSuggestion: string;
  choicePrompterCta: string;
  viewMoreLabel: string;
  similarProductsLabel: string;
  addToCartButton: string;
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
  stillWorkingMessage: string;
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
  dismissAriaLabel: string;
  cartAddErrorMessage: string;
  reviewFilterAll: string;
  reviewFilterPositive: string;
  reviewFilterNegative: string;
  decreaseLabel: string;
  increaseLabel: string;
  tryAgainButton: string;
  askSomethingElseButton: string;
  accountInactiveMessage: string;
  favoritesPageTitle: string;
  emptyFavoritesMessage: string;
}

export interface ChatUISpecRenderContext {
  onAction: (action: ActionPayload) => void;
  onProductClick?: (params: { sku: string; url: string }) => void;
  onAddToCart?: (params: { sku: string; cartCode: string; quantity: number }) => void;
  onProductSelect?: (product: Record<string, unknown>) => void;
  pricing?: import('../common/price-formatter.js').PriceFormatConfig | undefined;
  i18n?: Pick<
    ChatI18n,
    | 'productCtaLabel'
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
    | 'compareSelected'
    | 'panelTitleProductDetails'
    | 'panelTitleSimilarProducts'
    | 'panelTitleComparisonResults'
    | 'panelTitleCategories'
    | 'panelTitleSearchResults'
    | 'inStockLabel'
    | 'outOfStockLabel'
    | 'findSimilarLabel'
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
    | 'startChatLabel'
    | 'handoffHeading'
    | 'customerReviewsTitle'
    | 'addToFavoritesLabel'
    | 'reviewFilterAll'
    | 'reviewFilterPositive'
    | 'reviewFilterNegative'
    | 'decreaseLabel'
    | 'increaseLabel'
  >;
  productSort?: ProductSortState | undefined;
  onSortChange?: ((sort: ProductSortState) => void) | undefined;
  comparisonSelectMode?: boolean | undefined;
  comparisonSelectedSkus?: string[] | undefined;
  onToggleComparisonSku?: ((sku: string) => void) | undefined;
  favoritedSkus?: Set<string> | undefined;
  onFavoriteToggle?: ((sku: string, product: Record<string, unknown>) => void) | undefined;
  topPicksLoadingSku?: string | null | undefined;
  /** When true the stream is still in progress — defer compare CTA until stream ends. */
  isStreaming?: boolean | undefined;
  /** True when the widget is displayed in mobile viewport. Replaces hardcoded 768px check. */
  isMobile?: boolean | undefined;
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

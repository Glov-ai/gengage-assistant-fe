import type { ChatI18n, ChatMessage } from '../types.js';
import { sanitizeHtml, isSafeImageUrl } from '../../common/safe-html.js';
import { CHAT_I18N_TR } from '../locales/index.js';
import { VoiceInput, isVoiceInputSupported } from '../../common/voice-input.js';
import { createKvkkBanner } from './KvkkBanner.js';
import { PanelTopBar } from './PanelTopBar.js';
import { ThumbnailsColumn } from './ThumbnailsColumn.js';
import type { ThumbnailEntry } from './ThumbnailsColumn.js';

/** Generic fallback icon (right-arrow) used when a pill specifies an icon name not in the map. */
const DEFAULT_ACTION_ICON =
  '<svg viewBox="0 0 16 16" class="gengage-chat-icon"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** SVG icon map for suggested action chips/pills. Keys match backend icon names. */
const SUGGESTED_ACTION_ICONS: Record<string, string> = {
  search:
    '<svg viewBox="0 0 16 16" class="gengage-chat-icon"><circle cx="6.5" cy="6.5" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="10" x2="15" y2="15" stroke="currentColor" stroke-width="1.5"/></svg>',
  review:
    '<svg viewBox="0 0 16 16" class="gengage-chat-icon"><polygon points="8,1 10,6 15,6 11,9 12.5,14 8,11 3.5,14 5,9 1,6 6,6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  info: '<svg viewBox="0 0 16 16" class="gengage-chat-icon"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="8" y1="7" x2="8" y2="12" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="4.5" r="0.8" fill="currentColor"/></svg>',
  similar:
    '<svg viewBox="0 0 16 16" class="gengage-chat-icon"><rect x="1" y="3" width="6" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="9" y="3" width="6" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
};

export { SUGGESTED_ACTION_ICONS, DEFAULT_ACTION_ICON };

export interface ChatDrawerOptions {
  i18n: ChatI18n;
  onSend: (text: string, attachment?: File) => void;
  /** Callback fired when the cart icon button in the header is clicked. */
  onCartClick?: (() => void) | undefined;
  onClose: () => void;
  onAttachment?: (file: File) => void;
  onPanelToggle?: () => void;
  onRollback?: (messageId: string) => void;
  headerTitle?: string | undefined;
  headerAvatarUrl?: string | undefined;
  /** Launcher image URL — used as avatar fallback when headerAvatarUrl is not set. */
  launcherImageUrl?: string | undefined;
  headerBadge?: string | undefined;
  /** URL for the cart icon link in the header (e.g. "/sepetim"). */
  /** @deprecated Use onCartClick instead. If set, the cart button will navigate to this URL. */
  headerCartUrl?: string | undefined;
  /** @deprecated Favorites button is always shown. */
  headerFavoritesToggle?: boolean | undefined;
  onFavoritesClick?: (() => void) | undefined;
  /** Callback fired when the panel back button is clicked. */
  onPanelBack?: (() => void) | undefined;
  /** Callback fired when the panel forward button is clicked. */
  onPanelForward?: (() => void) | undefined;
  /**
   * Fired when the user drags the mobile handle and releases.
   * 'half' | 'full' → switch to that snap position.
   * 'close'          → close the drawer.
   */
  onMobileSnap?: ((state: 'half' | 'full' | 'close') => void) | undefined;
  /** Returns the current mobile sheet state so the drag handler knows which snap to target. */
  getMobileState?: (() => 'half' | 'full') | undefined;
  /** Returns true when the chat is displayed as a mobile bottom-sheet. Used to keep the side-panel back button always enabled. */
  getMobileViewport?: (() => boolean) | undefined;
  /** Callback fired when a product thumbnail is clicked (for thread rollback). */
  onThumbnailClick?: ((threadId: string) => void) | undefined;
  /** Callback fired when a link in bot HTML is clicked. */
  onLinkClick?: ((url: string) => void) | undefined;
  /** Enable voice input (Web Speech API STT). Default: false. */
  voiceEnabled?: boolean | undefined;
  /** BCP 47 language for speech recognition. Default: 'tr-TR'. */
  voiceLang?: string | undefined;
  /** Callback fired when the "New Chat" button is clicked. */
  onNewChat?: (() => void) | undefined;
}

const DEFAULT_I18N: ChatI18n = CHAT_I18N_TR;

export class ChatDrawer {
  private root: HTMLElement;
  private messagesEl: HTMLElement;
  private inputEl: HTMLTextAreaElement;
  private sendBtn: HTMLButtonElement;
  private i18n: ChatI18n;
  private onSend: (text: string, attachment?: File) => void;
  private _panelEl: HTMLElement;
  private _panelVisible = false;
  private _panelCollapsed = false;
  private _dividerEl: HTMLElement;
  private _onPanelToggle: (() => void) | undefined = undefined;
  private _pendingAttachment: File | null = null;
  private _fileInput: HTMLInputElement;
  private _previewStrip: HTMLElement;
  private _previewName: HTMLElement;
  private _onAttachment: ((file: File) => void) | undefined = undefined;
  private _onRollback: ((messageId: string) => void) | undefined = undefined;
  private _onLinkClick: ((url: string) => void) | undefined = undefined;
  private _pillsEl: HTMLElement;
  private _kvkkSlot: HTMLElement;
  private _panelTopBar: PanelTopBar;
  private _userScrolledUp = false;
  private _scrollLockedUntil = 0;
  private _inputChipsEl: HTMLElement;
  private _thumbnailsColumn: ThumbnailsColumn;
  private _panelFloatingEl: HTMLElement;
  private _favBadgeEl: HTMLElement | null = null;
  private _thinkingSteps: string[] = [];
  private _firstBotMessageIds: Set<string> = new Set();
  private _voiceInput: VoiceInput | null = null;
  private _micBtn: HTMLButtonElement | null = null;
  private _voiceEnabled = false;
  private _voiceLang = 'tr-TR';
  private _ignoreNextDividerClick = false;
  private readonly _cleanups: Array<() => void> = [];
  private _focusTrapHandler: ((e: KeyboardEvent) => void) | null = null;
  private _previouslyFocusedElement: HTMLElement | null = null;
  private _stillWorkingTimer: ReturnType<typeof setTimeout> | null = null;
  private _conversationEl: HTMLElement | null = null;
  private readonly _options: ChatDrawerOptions;
  private _reopenPanelBtn: HTMLButtonElement | null = null;

  constructor(container: HTMLElement, options: ChatDrawerOptions) {
    this._options = options;
    this.i18n = { ...DEFAULT_I18N, ...options.i18n };
    this.onSend = options.onSend;
    if (options.onPanelToggle !== undefined) {
      this._onPanelToggle = options.onPanelToggle;
    }
    if (options.onAttachment !== undefined) {
      this._onAttachment = options.onAttachment;
    }
    if (options.onRollback !== undefined) {
      this._onRollback = options.onRollback;
    }
    if (options.onLinkClick !== undefined) {
      this._onLinkClick = options.onLinkClick;
    }
    if (options.voiceEnabled) {
      this._voiceEnabled = true;
    }
    if (options.voiceLang !== undefined) {
      this._voiceLang = options.voiceLang;
    }

    this.root = document.createElement('div');
    this.root.className = 'gengage-chat-drawer';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', this.i18n.headerTitle ?? 'Chat');
    this.root.setAttribute('aria-modal', 'true');

    const descId = 'gengage-chat-dialog-desc';
    const descEl = document.createElement('span');
    descEl.id = descId;
    descEl.className = 'gengage-sr-only';
    descEl.textContent = this.i18n.headerTitle ?? 'AI shopping assistant';
    this.root.appendChild(descEl);
    this.root.setAttribute('aria-describedby', descId);

    // Mobile drag handle — pill indicator at the very top of the sheet
    {
      const handleEl = document.createElement('div');
      handleEl.className = 'gengage-chat-drawer-handle';
      handleEl.setAttribute('aria-hidden', 'true');
      this.root.appendChild(handleEl);

      const SNAP_THRESHOLD = 72; // px to trigger a snap to the next position
      let dragStartY = 0;
      let dragDelta = 0;
      let dragging = false;

      const onHandleTouchStart = (e: TouchEvent) => {
        if (!(this._options.getMobileViewport?.() ?? window.innerWidth <= 768)) return;
        const t = e.changedTouches?.[0];
        if (!t) return;
        dragStartY = t.clientY;
        dragDelta = 0;
        dragging = true;
        this.root.style.transition = 'none';
      };

      const onHandleTouchMove = (e: TouchEvent) => {
        if (!dragging) return;
        const t = e.changedTouches?.[0];
        if (!t) return;
        dragDelta = t.clientY - dragStartY;
        // Clamp: don't allow pulling upward past the current top
        const currentState = options.getMobileState?.() ?? 'full';
        const clampedDelta =
          currentState === 'full'
            ? Math.max(0, dragDelta) // full → only drag down
            : dragDelta; // half → allow both directions
        e.preventDefault(); // prevent body scroll
        this.root.style.transform = `translateY(${clampedDelta}px)`;
      };

      const onHandleTouchEnd = () => {
        if (!dragging) return;
        dragging = false;
        const currentState = options.getMobileState?.() ?? 'full';

        let nextState: 'half' | 'full' | 'close';
        if (dragDelta > SNAP_THRESHOLD) {
          nextState = currentState === 'full' ? 'half' : 'close';
        } else if (dragDelta < -SNAP_THRESHOLD && currentState === 'half') {
          nextState = 'full';
        } else {
          nextState = currentState; // snap back
        }

        // Re-enable transition before state change so CSS animates smoothly
        this.root.style.transition = '';
        if (nextState === 'close') {
          // Animate drawer off-screen before calling close
          this.root.style.transform = 'translateY(100%)';
          setTimeout(() => {
            this.root.style.transform = '';
            options.onMobileSnap?.('close');
          }, 280);
        } else {
          this.root.style.transform = '';
          options.onMobileSnap?.(nextState);
        }
        dragDelta = 0;
      };

      const onHandleTouchCancel = () => {
        if (!dragging) return;
        dragging = false;
        dragDelta = 0;
        this.root.style.transition = '';
        this.root.style.transform = '';
      };

      handleEl.addEventListener('touchstart', onHandleTouchStart, { passive: true });
      handleEl.addEventListener('touchmove', onHandleTouchMove, { passive: false });
      handleEl.addEventListener('touchend', onHandleTouchEnd, { passive: true });
      handleEl.addEventListener('touchcancel', onHandleTouchCancel, { passive: true });
      this._cleanups.push(() => {
        handleEl.removeEventListener('touchstart', onHandleTouchStart);
        handleEl.removeEventListener('touchmove', onHandleTouchMove);
        handleEl.removeEventListener('touchend', onHandleTouchEnd);
        handleEl.removeEventListener('touchcancel', onHandleTouchCancel);
      });
    }

    // Header — branded dark bar
    const header = document.createElement('div');
    header.className = 'gengage-chat-header';

    const headerLeft = document.createElement('div');
    headerLeft.className = 'gengage-chat-header-left';

    const avatarUrl = options.headerAvatarUrl ?? options.launcherImageUrl;
    if (avatarUrl) {
      const avatar = document.createElement('img');
      avatar.className = 'gengage-chat-header-avatar';
      avatar.src = avatarUrl;
      avatar.alt = options.headerTitle ?? 'Assistant';
      headerLeft.appendChild(avatar);
    }

    const headerInfo = document.createElement('div');
    headerInfo.className = 'gengage-chat-header-info';

    const titleRow = document.createElement('div');
    titleRow.className = 'gengage-chat-header-title-row';
    const title = document.createElement('span');
    title.className = 'gengage-chat-header-title';
    title.textContent = options.headerTitle ?? this.i18n.headerTitle ?? 'Product Expert';
    titleRow.appendChild(title);

    if (options.headerBadge) {
      const badge = document.createElement('span');
      badge.className = 'gengage-chat-header-badge';
      badge.textContent = options.headerBadge;
      titleRow.appendChild(badge);
    }
    headerInfo.appendChild(titleRow);

    const powered = document.createElement('a');
    powered.className = 'gengage-chat-header-powered';
    powered.href = 'https://gengage.ai/';
    powered.target = '_blank';
    powered.rel = 'noopener noreferrer';
    powered.innerHTML = `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 110 14A7 7 0 018 1zm0 1.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM7 4.5h2v4H7v-4zm0 5h2v2H7v-2z"/></svg>Powered by Gengage`;
    headerInfo.appendChild(powered);

    headerLeft.appendChild(headerInfo);
    header.appendChild(headerLeft);

    const headerRight = document.createElement('div');
    headerRight.className = 'gengage-chat-header-right';

    // Reopen-panel button — shown on mobile when the side panel is hidden but has content
    {
      const reopenBtn = document.createElement('button');
      reopenBtn.type = 'button';
      reopenBtn.className = 'gengage-chat-header-btn gengage-chat-header-btn--reopen-panel';
      reopenBtn.setAttribute('aria-label', this.i18n.showPanelAriaLabel);
      reopenBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>`;
      reopenBtn.addEventListener('click', () => this._showMobilePanelFromBtn());
      headerRight.appendChild(reopenBtn);
      this._reopenPanelBtn = reopenBtn;
    }

    // Cart button — always a <button> so the onCartClick callback is always invoked
    // (handles session persistence before navigation when headerCartUrl is set).
    {
      const cartBtn = document.createElement('button');
      cartBtn.type = 'button';
      cartBtn.className = 'gengage-chat-header-btn';
      cartBtn.setAttribute('aria-label', this.i18n.cartAriaLabel);
      cartBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`;
      cartBtn.addEventListener('click', () => options.onCartClick?.());
      headerRight.appendChild(cartBtn);
    }

    // New Chat button (optional — reset conversation)
    if (options.onNewChat) {
      const newChatBtn = document.createElement('button');
      newChatBtn.className = 'gengage-chat-header-btn gengage-chat-new-chat';
      newChatBtn.type = 'button';
      newChatBtn.setAttribute('aria-label', this.i18n.newChatButton);
      newChatBtn.title = this.i18n.newChatButton;
      newChatBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;
      newChatBtn.addEventListener('click', () => options.onNewChat?.());
      headerRight.appendChild(newChatBtn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'gengage-chat-close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', this.i18n.closeButton);
    closeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    closeBtn.addEventListener('click', options.onClose);

    // Favorites button — always visible, placed just before the close button
    {
      const favBtn = document.createElement('button');
      favBtn.className = 'gengage-chat-header-btn gengage-chat-header-btn--fav';
      favBtn.type = 'button';
      favBtn.setAttribute('aria-label', this.i18n.favoritesAriaLabel);
      favBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;

      const badge = document.createElement('span');
      badge.className = 'gengage-chat-header-fav-badge';
      badge.setAttribute('aria-hidden', 'true');
      badge.style.display = 'none';
      favBtn.appendChild(badge);
      this._favBadgeEl = badge;

      favBtn.addEventListener('click', () => options.onFavoritesClick?.());
      headerRight.appendChild(favBtn);
    }

    headerRight.appendChild(closeBtn);
    header.appendChild(headerRight);

    // Body: flex container for panel + conversation
    const body = document.createElement('div');
    body.className = 'gengage-chat-body';

    // Panel (hidden by default)
    this._panelEl = document.createElement('div');
    this._panelEl.className = 'gengage-chat-panel';

    // Panel top bar (navigation)
    this._panelTopBar = new PanelTopBar({
      onBack: () => options.onPanelBack?.(),
      onForward: () => options.onPanelForward?.(),
      backAriaLabel: this.i18n.backAriaLabel,
      forwardAriaLabel: this.i18n.forwardAriaLabel,
    });
    this._panelEl.appendChild(this._panelTopBar.getElement());

    // Panel scroll affordance — bottom fade gradient when content is scrollable
    const onPanelScroll = () => this._updateScrollAffordance();
    this._panelEl.addEventListener('scroll', onPanelScroll, { passive: true });
    this._cleanups.push(() => this._panelEl.removeEventListener('scroll', onPanelScroll));

    body.appendChild(this._panelEl);

    // Divider between panel and conversation
    this._dividerEl = document.createElement('div');
    this._dividerEl.className = 'gengage-chat-panel-divider gengage-chat-panel-divider--hidden';
    this._dividerEl.setAttribute('role', 'separator');
    this._dividerEl.setAttribute('aria-label', this.i18n.togglePanelAriaLabel);
    this._dividerEl.setAttribute('title', this.i18n.togglePanelAriaLabel);
    const chevron = document.createElement('button');
    chevron.className = 'gengage-chat-panel-divider-toggle';
    chevron.type = 'button';
    chevron.setAttribute('aria-label', this.i18n.togglePanelAriaLabel);
    chevron.setAttribute('title', this.i18n.togglePanelAriaLabel);
    chevron.textContent = '\u00BB'; // » (collapse right)
    chevron.addEventListener('click', () => {
      if (this._ignoreNextDividerClick) {
        this._ignoreNextDividerClick = false;
        return;
      }
      this.togglePanel();
      this._onPanelToggle?.();
    });
    let touchStartX: number | null = null;
    let touchStartY: number | null = null;
    const swipeThreshold = 24;
    const onDividerTouchStart = (event: TouchEvent) => {
      if (!(this._options.getMobileViewport?.() ?? window.innerWidth <= 768)) return;
      const touch = event.changedTouches?.[0];
      if (!touch) return;
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    };
    const onDividerTouchEnd = (event: TouchEvent) => {
      if (!(this._options.getMobileViewport?.() ?? window.innerWidth <= 768)) return;
      if (touchStartX === null || touchStartY === null) return;
      const touch = event.changedTouches?.[0];
      if (!touch) return;

      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      touchStartX = null;
      touchStartY = null;

      // Vertical swipe only. Swipe up collapses panel, swipe down expands.
      if (Math.abs(deltaY) < swipeThreshold || Math.abs(deltaY) < Math.abs(deltaX)) return;
      const nextCollapsed = deltaY < 0;
      if (nextCollapsed === this._panelCollapsed) return;

      this._ignoreNextDividerClick = true;
      this.setPanelCollapsed(nextCollapsed);
      this._onPanelToggle?.();
    };
    this._dividerEl.addEventListener('touchstart', onDividerTouchStart, { passive: true });
    this._dividerEl.addEventListener('touchend', onDividerTouchEnd, { passive: true });
    this._cleanups.push(() => {
      this._dividerEl.removeEventListener('touchstart', onDividerTouchStart);
      this._dividerEl.removeEventListener('touchend', onDividerTouchEnd);
    });
    this._dividerEl.appendChild(chevron);
    body.appendChild(this._dividerEl);

    // Conversation wrapper — header lives inside so it only spans chat width
    const conversation = document.createElement('div');
    conversation.className = 'gengage-chat-conversation';
    this._conversationEl = conversation;
    conversation.appendChild(header);

    // Offline status bar (hidden by default, shown when navigator.onLine === false)
    const offlineBar = document.createElement('div');
    offlineBar.className = 'gengage-chat-offline-bar';
    offlineBar.setAttribute('role', 'status');
    offlineBar.setAttribute('aria-live', 'polite');
    offlineBar.textContent = this.i18n.offlineMessage;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      offlineBar.classList.add('gengage-chat-offline-bar--visible');
    }
    conversation.appendChild(offlineBar);

    const onOffline = () => offlineBar.classList.add('gengage-chat-offline-bar--visible');
    const onOnline = () => offlineBar.classList.remove('gengage-chat-offline-bar--visible');
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    this._cleanups.push(() => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    });

    // KVKK banner slot (inserted above messages)
    this._kvkkSlot = document.createElement('div');
    this._kvkkSlot.className = 'gengage-chat-kvkk-slot';
    conversation.appendChild(this._kvkkSlot);

    // Messages area
    this.messagesEl = document.createElement('div');
    this.messagesEl.className = 'gengage-chat-messages';
    this.messagesEl.setAttribute('role', 'log');
    this.messagesEl.setAttribute('aria-live', 'polite');
    this.messagesEl.setAttribute('aria-atomic', 'false');
    this.messagesEl.setAttribute('aria-label', this.i18n.chatMessagesAriaLabel);

    // Track user scroll position to avoid auto-scrolling when reading history
    let scrollRafPending = false;
    const onMessagesScroll = () => {
      if (scrollRafPending) return;
      scrollRafPending = true;
      requestAnimationFrame(() => {
        scrollRafPending = false;
        const { scrollTop, scrollHeight, clientHeight } = this.messagesEl;
        this._userScrolledUp = scrollHeight - scrollTop - clientHeight > 10;
      });
    };
    this.messagesEl.addEventListener('scroll', onMessagesScroll, { passive: true });
    this._cleanups.push(() => {
      this.messagesEl.removeEventListener('scroll', onMessagesScroll);
    });

    conversation.appendChild(this.messagesEl);

    // Thumbnails column (right edge of panel — quick-scroll shortcuts for search results)
    this._thumbnailsColumn = new ThumbnailsColumn({
      onThumbnailClick: (threadId) => options.onThumbnailClick?.(threadId),
    });
    this._panelEl.appendChild(this._thumbnailsColumn.getElement());

    // Floating overlay: sticky zero-height anchor so absolutely-positioned overlays
    // (e.g. ChoicePrompter) stay fixed to the panel's visible area regardless of scroll.
    this._panelFloatingEl = document.createElement('div');
    this._panelFloatingEl.className = 'gengage-chat-panel-float';
    this._panelEl.appendChild(this._panelFloatingEl);

    // Suggestion pills row (between messages and input)
    this._pillsEl = document.createElement('div');
    this._pillsEl.className = 'gengage-chat-pills';
    this._pillsEl.setAttribute('role', 'toolbar');
    this._pillsEl.setAttribute('aria-label', this.i18n.suggestionsAriaLabel);
    this._pillsEl.style.display = 'none';

    const pillsScroll = document.createElement('div');
    pillsScroll.className = 'gengage-chat-pills-scroll';
    this._pillsEl.appendChild(pillsScroll);

    const pillsArrow = document.createElement('button');
    pillsArrow.className = 'gengage-chat-pills-arrow';
    pillsArrow.type = 'button';
    pillsArrow.setAttribute('aria-label', this.i18n.moreSuggestionsAriaLabel);
    pillsArrow.textContent = '\u203A'; // › single right-pointing angle
    pillsArrow.addEventListener('click', () => {
      pillsScroll.scrollBy({ left: 150, behavior: 'smooth' });
    });
    this._pillsEl.appendChild(pillsArrow);

    // Hide arrow when fully scrolled
    let pillsRafPending = false;
    const onPillsScroll = () => {
      if (pillsRafPending) return;
      pillsRafPending = true;
      requestAnimationFrame(() => {
        pillsRafPending = false;
        const atEnd = pillsScroll.scrollLeft + pillsScroll.clientWidth >= pillsScroll.scrollWidth - 4;
        pillsArrow.style.display = atEnd ? 'none' : '';
      });
    };
    pillsScroll.addEventListener('scroll', onPillsScroll, { passive: true });
    this._cleanups.push(() => {
      pillsScroll.removeEventListener('scroll', onPillsScroll);
    });

    conversation.appendChild(this._pillsEl);

    // Input-area chips (compact chips above input for search/info/review/similar)
    this._inputChipsEl = document.createElement('div');
    this._inputChipsEl.className = 'gengage-chat-input-chips';
    this._inputChipsEl.style.display = 'none';
    conversation.appendChild(this._inputChipsEl);

    // Input area
    const inputArea = document.createElement('div');
    inputArea.className = 'gengage-chat-input-area';

    this.inputEl = document.createElement('textarea');
    this.inputEl.className = 'gengage-chat-input';
    this.inputEl.rows = 1;
    this.inputEl.placeholder = this.i18n.inputPlaceholder;

    // Auto-expand on desktop as user types (capped at 120px)
    this.inputEl.addEventListener('input', () => {
      requestAnimationFrame(() => {
        this.inputEl.style.height = 'auto';
        this.inputEl.style.height = `${Math.min(this.inputEl.scrollHeight, 120)}px`;
      });
      this._updateSendEnabled();
    });

    // Enter submits; Shift+Enter inserts newline on desktop only
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const isMobile = this._options.getMobileViewport?.() ?? window.innerWidth <= 768;
        if (isMobile || !e.shiftKey) {
          e.preventDefault();
          this._submit();
        }
        // else: Shift+Enter on desktop → natural newline (no preventDefault)
      }
    });

    this.inputEl.addEventListener('paste', (e) => {
      const file = e.clipboardData?.files[0];
      if (file && file.type.startsWith('image/')) {
        e.preventDefault();
        if (this._onAttachment) {
          this._onAttachment(file);
        } else {
          this.stageAttachment(file);
        }
      }
    });

    // Hidden file input
    this._fileInput = document.createElement('input');
    this._fileInput.type = 'file';
    this._fileInput.accept = 'image/jpeg,image/png,image/webp';
    this._fileInput.style.display = 'none';
    this._fileInput.addEventListener('change', () => {
      const file = this._fileInput.files?.[0];
      if (file) {
        if (this._onAttachment) {
          this._onAttachment(file);
        } else {
          this.stageAttachment(file);
        }
      }
      this._fileInput.value = '';
    });

    // Attach button with camera SVG
    const attachBtn = document.createElement('button');
    attachBtn.className = 'gengage-chat-attach-btn';
    attachBtn.type = 'button';
    attachBtn.setAttribute('aria-label', this.i18n.attachImageButton);
    attachBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
    attachBtn.addEventListener('click', () => this._fileInput.click());

    // Attachment preview strip (hidden by default)
    this._previewStrip = document.createElement('div');
    this._previewStrip.className = 'gengage-chat-attachment-preview gengage-chat-attachment-preview--hidden';
    const previewThumb = document.createElement('img');
    previewThumb.className = 'gengage-chat-attachment-preview-thumb';
    previewThumb.alt = '';
    this._previewName = document.createElement('span');
    this._previewName.className = 'gengage-chat-attachment-name';
    const removeBtn = document.createElement('button');
    removeBtn.className = 'gengage-chat-attachment-remove';
    removeBtn.type = 'button';
    removeBtn.setAttribute('aria-label', this.i18n.removeAttachmentButton);
    removeBtn.textContent = '\u00D7'; // multiplication sign (x)
    removeBtn.addEventListener('click', () => this.clearAttachment());
    this._previewStrip.appendChild(previewThumb);
    this._previewStrip.appendChild(this._previewName);
    this._previewStrip.appendChild(removeBtn);

    this.sendBtn = document.createElement('button');
    this.sendBtn.className = 'gengage-chat-send';
    this.sendBtn.type = 'button';
    this.sendBtn.disabled = true;
    this.sendBtn.setAttribute('aria-label', this.i18n.sendButton);
    this.sendBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;
    this.sendBtn.addEventListener('click', () => this._submit());

    // Drag-and-drop on input area
    inputArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      inputArea.classList.add('gengage-chat-input-area--dragover');
    });
    inputArea.addEventListener('dragleave', () => {
      inputArea.classList.remove('gengage-chat-input-area--dragover');
    });
    inputArea.addEventListener('drop', (e) => {
      e.preventDefault();
      inputArea.classList.remove('gengage-chat-input-area--dragover');
      const file = e.dataTransfer?.files[0];
      if (file) {
        if (this._onAttachment) {
          this._onAttachment(file);
        } else {
          this.stageAttachment(file);
        }
      }
    });

    // Build pill container: [camera] [input] [mic?] [send]
    const pill = document.createElement('div');
    pill.className = 'gengage-chat-input-pill';
    pill.appendChild(attachBtn);
    pill.appendChild(this.inputEl);

    // Voice input mic button (Web Speech API STT)
    if (this._voiceEnabled && isVoiceInputSupported()) {
      this._micBtn = document.createElement('button');
      this._micBtn.className = 'gengage-chat-mic-btn';
      this._micBtn.type = 'button';
      this._micBtn.setAttribute('aria-label', this.i18n.voiceButton);
      this._micBtn.innerHTML =
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>' +
        '<path d="M19 10v2a7 7 0 0 1-14 0v-2"/>' +
        '<line x1="12" y1="19" x2="12" y2="23"/>' +
        '<line x1="8" y1="23" x2="16" y2="23"/>' +
        '</svg>';
      this._micBtn.addEventListener('click', () => this._toggleVoice());
      pill.appendChild(this._micBtn);

      this._voiceInput = new VoiceInput(
        {
          onInterim: (text) => {
            this.inputEl.value = text;
            this.inputEl.style.height = 'auto';
            this.inputEl.style.height = `${Math.min(this.inputEl.scrollHeight, 120)}px`;
          },
          onFinal: (text) => {
            this.inputEl.value = text;
          },
          onAutoSubmit: (text) => {
            this.inputEl.value = text;
            this._micBtn?.classList.remove('gengage-chat-mic-btn--active');
            this._submit();
          },
          onStateChange: (state) => {
            if (state === 'listening') {
              this._micBtn?.classList.add('gengage-chat-mic-btn--active');
            } else {
              this._micBtn?.classList.remove('gengage-chat-mic-btn--active');
            }
          },
          onError: (_code, _message) => {
            this._micBtn?.classList.remove('gengage-chat-mic-btn--active');
          },
        },
        { lang: this._voiceLang },
      );
    }

    pill.appendChild(this.sendBtn);

    inputArea.appendChild(this._previewStrip);
    inputArea.appendChild(this._fileInput);
    inputArea.appendChild(pill);
    conversation.appendChild(inputArea);

    body.appendChild(conversation);
    this.root.appendChild(body);

    // Horizontal swipe to toggle panel on mobile (GAP-101)
    this._setupHorizontalSwipe(conversation);
    this._setupHorizontalSwipe(this._panelEl);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'gengage-chat-footer';
    footer.textContent = this.i18n.poweredBy;
    this.root.appendChild(footer);

    // Escape key to close drawer
    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        options.onClose();
      }
    };
    this.root.addEventListener('keydown', escapeHandler);
    this._cleanups.push(() => this.root.removeEventListener('keydown', escapeHandler));

    container.appendChild(this.root);
  }

  addMessage(message: ChatMessage): void {
    const bubble = document.createElement('div');
    bubble.className = `gengage-chat-bubble gengage-chat-bubble--${message.role}`;
    bubble.setAttribute('role', 'listitem');
    bubble.dataset['messageId'] = message.id;
    if (message.threadId) {
      bubble.dataset['threadId'] = message.threadId;
    }

    if (this._firstBotMessageIds.has(message.id)) {
      bubble.classList.add('gengage-chat-bubble--first');
    }

    if (message.attachment) {
      const thumbEl = document.createElement('img');
      thumbEl.className = 'gengage-chat-attachment-thumb';
      const blobUrl = URL.createObjectURL(message.attachment);
      thumbEl.src = blobUrl;
      thumbEl.alt = message.attachment.name;
      // Revoke blob URL once image loads (or errors) to free memory
      thumbEl.addEventListener('load', () => URL.revokeObjectURL(blobUrl), { once: true });
      thumbEl.addEventListener('error', () => URL.revokeObjectURL(blobUrl), { once: true });
      bubble.insertBefore(thumbEl, bubble.firstChild);
    }

    if (message.content) {
      const text = document.createElement('div');
      text.className = 'gengage-chat-bubble-text';
      if (message.role === 'assistant') {
        text.innerHTML = sanitizeHtml(message.content);
        // Intercept all links in bot HTML
        if (this._onLinkClick) {
          const links = text.querySelectorAll('a[href]');
          for (const link of links) {
            link.addEventListener('click', (e) => {
              e.preventDefault();
              const href = link.getAttribute('href');
              if (href) {
                this._onLinkClick?.(href);
              }
            });
          }
        }
      } else {
        text.textContent = message.content; // User messages: always safe textContent
      }
      bubble.appendChild(text);
    }

    // Add rollback button to user message bubbles
    if (message.role === 'user' && this._onRollback) {
      const rollbackBtn = document.createElement('button');
      rollbackBtn.className = 'gengage-chat-rollback-btn';
      rollbackBtn.type = 'button';
      rollbackBtn.setAttribute('aria-label', this.i18n.rollbackAriaLabel);
      rollbackBtn.title = this.i18n.rollbackAriaLabel;
      rollbackBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`;
      rollbackBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._onRollback?.(message.id);
      });
      bubble.appendChild(rollbackBtn);
    }

    this.messagesEl.appendChild(bubble);
    this._scrollToBottom(message.role === 'user');
  }

  showTypingIndicator(searchText?: string): void {
    this.removeTypingIndicator();
    const container = document.createElement('div');
    container.className = 'gengage-chat-typing';
    container.dataset['typing'] = 'true';

    if (this._thinkingSteps.length > 0) {
      // Render accumulated thinking steps
      this._renderThinkingStepsInto(container);
    } else {
      // Default 3-dot animation
      const indicator = document.createElement('div');
      indicator.className = 'gengage-chat-typing-dots';
      for (let i = 0; i < 3; i++) indicator.appendChild(document.createElement('span'));
      container.appendChild(indicator);
      if (searchText) {
        const sparkle = document.createElement('span');
        sparkle.className = 'gengage-chat-typing-sparkle';
        sparkle.textContent = '\u2728'; // sparkle
        container.appendChild(sparkle);

        const text = document.createElement('span');
        text.className = 'gengage-chat-typing-text';
        text.textContent = searchText;
        container.appendChild(text);
      }
    }

    this.messagesEl.appendChild(container);
    this._scrollToBottom(true);

    // Start "still working" timer — shows a hint after 10s with no text chunks
    this._clearStillWorkingTimer();
    this._stillWorkingTimer = setTimeout(() => {
      this._stillWorkingTimer = null;
      const typing = this.messagesEl.querySelector('.gengage-chat-typing');
      if (!typing) return;
      // Only add if not already present
      if (typing.querySelector('.gengage-chat-still-working')) return;
      const hint = document.createElement('div');
      hint.className = 'gengage-chat-still-working';
      hint.textContent = this.i18n.stillWorkingMessage;
      typing.appendChild(hint);
      this._scrollToBottom(true);
    }, 10_000);
  }

  /** Accumulate a new thinking step (shown as a checklist in the typing indicator). */
  addThinkingStep(text: string): void {
    this._thinkingSteps.push(text);
    this._renderThinkingSteps();
  }

  removeTypingIndicator(): void {
    this._clearStillWorkingTimer();
    const existing = this.messagesEl.querySelector('.gengage-chat-typing');
    existing?.remove();
    this._thinkingSteps = [];
    this.hideStopButton();
  }

  private _clearStillWorkingTimer(): void {
    if (this._stillWorkingTimer !== null) {
      clearTimeout(this._stillWorkingTimer);
      this._stillWorkingTimer = null;
    }
  }

  /** Show a "Stop generating" button below the typing indicator. */
  showStopButton(onStop: () => void): void {
    this.hideStopButton();
    const btn = document.createElement('button');
    btn.className = 'gengage-chat-stop-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', this.i18n.stopGenerating);
    // Square stop icon + label
    const icon = document.createElement('span');
    icon.className = 'gengage-chat-stop-icon';
    icon.setAttribute('aria-hidden', 'true');
    btn.appendChild(icon);
    const label = document.createElement('span');
    label.textContent = this.i18n.stopGenerating;
    btn.appendChild(label);
    btn.addEventListener('click', () => {
      this.hideStopButton();
      onStop();
    });
    this.messagesEl.appendChild(btn);
    this._scrollToBottom(true);
  }

  /** Remove the stop-generating button if present. */
  hideStopButton(): void {
    const existing = this.messagesEl.querySelector('.gengage-chat-stop-btn');
    existing?.remove();
  }

  showError(message?: string, onRetry?: () => void): void {
    const errEl = document.createElement('div');
    errEl.className = 'gengage-chat-error';
    errEl.setAttribute('role', 'alert');
    const textEl = document.createElement('span');
    textEl.textContent = message ?? this.i18n.errorMessage;
    errEl.appendChild(textEl);

    if (onRetry) {
      const retryBtn = document.createElement('button');
      retryBtn.className = 'gengage-chat-error-retry';
      retryBtn.textContent = this.i18n.retryButton ?? 'Retry';
      retryBtn.addEventListener('click', () => {
        errEl.remove();
        onRetry();
      });
      errEl.appendChild(retryBtn);
    }

    this.messagesEl.appendChild(errEl);
    this._scrollToBottom(true);
  }

  /** Show error with recovery action pills ("Try again" + "Ask something else"). */
  showErrorWithRecovery(message: string, actions: { onRetry: () => void; onNewQuestion: () => void }): void {
    this.showError(message);
    this.setPills([
      { label: this.i18n.tryAgainButton, onAction: actions.onRetry },
      { label: this.i18n.askSomethingElseButton, onAction: actions.onNewQuestion },
    ]);
  }

  clearMessages(): void {
    this.messagesEl.innerHTML = '';
  }

  /** Replace suggestion pills. Pass empty array to hide. */
  setPills(
    pills: Array<{ label: string; onAction: () => void; icon?: string; image?: string; description?: string }>,
  ): void {
    const scroll = this._pillsEl.querySelector('.gengage-chat-pills-scroll');
    if (!scroll) return;
    while (scroll.firstChild) scroll.removeChild(scroll.firstChild);

    if (pills.length === 0) {
      this._pillsEl.style.display = 'none';
      return;
    }

    this._pillsEl.style.display = '';
    for (const pill of pills) {
      const btn = document.createElement('button');
      btn.className = pill.image ? 'gengage-chat-pill gengage-chat-pill--rich' : 'gengage-chat-pill';
      btn.type = 'button';

      if (pill.icon) {
        const svgHtml = SUGGESTED_ACTION_ICONS[pill.icon] ?? DEFAULT_ACTION_ICON;
        const iconSpan = document.createElement('span');
        iconSpan.className = 'gengage-chat-pill-icon';
        iconSpan.innerHTML = svgHtml;
        btn.appendChild(iconSpan);
      }

      if (pill.image && isSafeImageUrl(pill.image)) {
        const img = document.createElement('img');
        img.className = 'gengage-chat-pill-img';
        img.src = pill.image;
        img.alt = '';
        btn.appendChild(img);
      }

      const textWrap = document.createElement('span');
      textWrap.className = 'gengage-chat-pill-text';
      textWrap.textContent = pill.label;
      btn.appendChild(textWrap);

      if (pill.description) {
        const desc = document.createElement('span');
        desc.className = 'gengage-chat-pill-desc';
        const descId = `pill-desc-${Math.random().toString(36).slice(2, 9)}`;
        desc.id = descId;
        desc.textContent = pill.description;
        btn.appendChild(desc);
        btn.setAttribute('aria-describedby', descId);
      }

      btn.addEventListener('click', () => pill.onAction());
      scroll.appendChild(btn);
    }

    // Show/hide arrow based on overflow
    const arrow = this._pillsEl.querySelector('.gengage-chat-pills-arrow') as HTMLElement | null;
    if (arrow) {
      requestAnimationFrame(() => {
        arrow.style.display = scroll.scrollWidth > scroll.clientWidth ? '' : 'none';
      });
    }
  }

  focusInput(): void {
    this.inputEl.focus();
  }

  showKvkkBanner(html: string, onDismiss: () => void): void {
    this._kvkkSlot.innerHTML = '';
    const banner = createKvkkBanner({ htmlContent: html, onDismiss, closeAriaLabel: this.i18n.closeAriaLabel });
    this._kvkkSlot.appendChild(banner);
  }

  hideKvkkBanner(): void {
    this._kvkkSlot.innerHTML = '';
  }

  getElement(): HTMLElement {
    return this.root;
  }

  /** Stage a file attachment for sending. Shows preview. */
  stageAttachment(file: File): void {
    this._pendingAttachment = file;
    this._previewName.textContent = file.name;
    const thumb = this._previewStrip.querySelector('.gengage-chat-attachment-preview-thumb') as HTMLImageElement;
    if (thumb) {
      // Revoke previous blob URL to prevent memory leak
      if (thumb.src && thumb.src.startsWith('blob:')) {
        URL.revokeObjectURL(thumb.src);
      }
      thumb.src = URL.createObjectURL(file);
    }
    this._previewStrip.classList.remove('gengage-chat-attachment-preview--hidden');
    this._updateSendEnabled();
  }

  /** Remove the staged attachment and hide preview. */
  clearAttachment(): void {
    const thumb = this._previewStrip.querySelector('.gengage-chat-attachment-preview-thumb') as HTMLImageElement;
    if (thumb?.src) {
      URL.revokeObjectURL(thumb.src);
      thumb.src = '';
    }
    this._pendingAttachment = null;
    this._previewStrip.classList.add('gengage-chat-attachment-preview--hidden');
    this._updateSendEnabled();
  }

  /** Get the currently staged attachment file, or null. */
  getPendingAttachment(): File | null {
    return this._pendingAttachment;
  }

  /** Replace panel content and show the panel. */
  setPanelContent(el: HTMLElement): void {
    // Brief crossfade transition when swapping panel content
    this._panelEl.classList.add('gengage-chat-panel--transitioning');
    this._panelEl.innerHTML = '';
    this._panelEl.appendChild(this._panelTopBar.getElement());
    this._panelEl.appendChild(el);
    this._panelEl.appendChild(this._panelFloatingEl);
    this._dividerEl.classList.remove('gengage-chat-panel-divider--hidden');
    if (!this._panelVisible) {
      this._panelVisible = true;
      this._panelEl.classList.add('gengage-chat-panel--visible');
      this.root.classList.add('gengage-chat-drawer--with-panel');
    }
    if (this._panelCollapsed) {
      this._panelEl.classList.add('gengage-chat-panel--collapsed');
    }
    requestAnimationFrame(() => {
      this._panelEl.classList.remove('gengage-chat-panel--transitioning');
      this._updateScrollAffordance();
    });
    // New content always reopens the panel — hide the reopen button
    if (this._reopenPanelBtn) this._reopenPanelBtn.style.display = 'none';
  }

  /** Append content to the panel without replacing existing content. */
  appendPanelContent(el: HTMLElement): void {
    this._panelEl.insertBefore(el, this._panelFloatingEl);
    this._dividerEl.classList.remove('gengage-chat-panel-divider--hidden');
    if (!this._panelVisible) {
      this._panelVisible = true;
      this._panelEl.classList.add('gengage-chat-panel--visible');
      this.root.classList.add('gengage-chat-drawer--with-panel');
    }
  }

  /** Return the panel element's content child (after topbar), or null. */
  getPanelContentElement(): HTMLElement | null {
    const children = this._panelEl.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i] as HTMLElement;
      if (
        child.classList.contains('gengage-chat-panel-topbar') ||
        child.classList.contains('gengage-chat-thumbnails-column') ||
        child.classList.contains('gengage-chat-panel-float')
      ) {
        continue;
      }
      return child;
    }
    return null;
  }

  /** Whether the panel is currently visible (may be empty). */
  isPanelVisible(): boolean {
    return this._panelVisible;
  }

  /** Whether the panel is currently visible and has rendered content (beyond topbar + thumbnails column). */
  hasPanelContent(): boolean {
    return this._panelVisible && this.getPanelContentElement() !== null;
  }

  /** Whether panel currently shows loading skeleton blocks. */
  isPanelLoading(): boolean {
    return this._panelEl.querySelector('.gengage-chat-panel-skeleton') !== null;
  }

  /** Show loading skeleton in the panel. Variant depends on contentType hint. */
  showPanelLoading(contentType?: string): void {
    this._dividerEl.classList.remove('gengage-chat-panel-divider--hidden');
    this._panelEl.innerHTML = '';
    this._panelEl.appendChild(this._panelTopBar.getElement());
    const skeleton = document.createElement('div');
    skeleton.className = 'gengage-chat-panel-skeleton';

    switch (contentType) {
      case 'productDetails': {
        // Tall image placeholder + text lines
        const imgBlock = document.createElement('div');
        imgBlock.className = 'gengage-chat-panel-skeleton-block gengage-chat-panel-skeleton-block--image';
        skeleton.appendChild(imgBlock);
        for (let i = 0; i < 3; i++) {
          const line = document.createElement('div');
          line.className = 'gengage-chat-panel-skeleton-block gengage-chat-panel-skeleton-block--text';
          skeleton.appendChild(line);
        }
        break;
      }
      case 'productList':
      case 'groupList': {
        // 2x3 grid of small card placeholders
        const grid = document.createElement('div');
        grid.className = 'gengage-chat-panel-skeleton-grid';
        for (let i = 0; i < 6; i++) {
          const card = document.createElement('div');
          card.className = 'gengage-chat-panel-skeleton-block gengage-chat-panel-skeleton-block--card';
          grid.appendChild(card);
        }
        skeleton.appendChild(grid);
        break;
      }
      case 'comparisonTable': {
        // Table-like rows
        for (let i = 0; i < 4; i++) {
          const row = document.createElement('div');
          row.className = 'gengage-chat-panel-skeleton-block gengage-chat-panel-skeleton-block--row';
          skeleton.appendChild(row);
        }
        break;
      }
      default: {
        // Generic: 3 blocks (existing behavior)
        for (let i = 0; i < 3; i++) {
          const block = document.createElement('div');
          block.className = 'gengage-chat-panel-skeleton-block';
          skeleton.appendChild(block);
        }
        break;
      }
    }

    this._panelEl.appendChild(skeleton);
    this._panelEl.appendChild(this._panelFloatingEl);
    if (!this._panelVisible) {
      this._panelVisible = true;
      this._panelEl.classList.add('gengage-chat-panel--visible');
      this.root.classList.add('gengage-chat-drawer--with-panel');
    }
  }

  /** Update the panel top bar navigation state. */
  updatePanelTopBar(canBack: boolean, canForward: boolean, title: string): void {
    // On mobile the back button always closes the side-panel overlay, so keep it active
    const isMobile = this._options.getMobileViewport?.() ?? false;
    this._panelTopBar.update(isMobile ? true : canBack, canForward, title);
  }

  getPanelTopBarTitle(): string {
    return this._panelTopBar.getTitle();
  }

  /** Update the favorites badge count. Pass 0 to hide the badge. */
  updateFavoritesBadge(count: number): void {
    if (!this._favBadgeEl) return;
    if (count > 0) {
      this._favBadgeEl.textContent = count > 99 ? '99+' : String(count);
      this._favBadgeEl.style.display = '';
    } else {
      this._favBadgeEl.style.display = 'none';
    }
  }

  /**
   * Hide the panel and clear its content. Always hides — even in force-expanded mode.
   * Callers: _hideDrawer (stale panel cleanup), stream onDone (loading skeleton cleanup),
   * thread navigation (no snapshot to restore). All require full hide.
   * Keeps `_panelCollapsed` untouched so user collapse preference survives future panel renders.
   */
  clearPanel(): void {
    this._panelEl.innerHTML = '';
    this._panelEl.appendChild(this._panelTopBar.getElement());
    this._panelEl.appendChild(this._panelFloatingEl);
    this._panelVisible = false;
    this._panelEl.classList.remove('gengage-chat-panel--visible', 'gengage-chat-panel--collapsed');
    this.root.classList.remove('gengage-chat-drawer--with-panel');
    this._dividerEl.classList.add('gengage-chat-panel-divider--hidden');
    if (this._reopenPanelBtn) this._reopenPanelBtn.style.display = 'none';
  }

  /**
   * On mobile: hide the side panel overlay without clearing its content.
   * Shows the reopen button in the header so the user can slide the panel back in.
   */
  hideMobilePanel(): void {
    if (!this._panelVisible) return;
    this._panelVisible = false;
    this._panelEl.classList.remove('gengage-chat-panel--visible');
    if (this._reopenPanelBtn) this._reopenPanelBtn.style.display = 'flex';
  }

  private _showMobilePanelFromBtn(): void {
    if (this._panelVisible) return;
    this._panelVisible = true;
    this._panelEl.classList.add('gengage-chat-panel--visible');
    if (this._reopenPanelBtn) this._reopenPanelBtn.style.display = 'none';
  }

  /** Expand panel without locking — user can still toggle via divider. */
  expandPanel(): void {
    this._panelCollapsed = false;
    this._panelEl.classList.remove('gengage-chat-panel--collapsed');
    if (!this._panelVisible) {
      this._panelVisible = true;
      this._panelEl.classList.add('gengage-chat-panel--visible');
      this.root.classList.add('gengage-chat-drawer--with-panel');
    }
  }

  /**
   * Ensure the panel starts expanded (panelMode: 'expanded').
   * Users can still collapse/expand via the divider chevron.
   */
  setForceExpanded(): void {
    this._panelCollapsed = false;
    this._panelEl.classList.remove('gengage-chat-panel--collapsed');
    // Show panel immediately even if empty
    if (!this._panelVisible) {
      this._panelVisible = true;
      this._panelEl.classList.add('gengage-chat-panel--visible');
      this.root.classList.add('gengage-chat-drawer--with-panel');
    }
    this._dividerEl.classList.remove('gengage-chat-panel-divider--hidden');
  }

  /** Update scroll affordance (bottom fade gradient) on the panel. */
  private _updateScrollAffordance(): void {
    const panel = this._panelEl;
    const atBottom = panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 10;
    panel.classList.toggle('gengage-chat-panel--has-scroll', !atBottom && panel.scrollHeight > panel.clientHeight);
  }

  /** Horizontal swipe on conversation/panel areas to toggle the panel (mobile only). */
  private _setupHorizontalSwipe(el: HTMLElement): void {
    let startX = 0;
    let startY = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (window.innerWidth > 768) return;
      const t = e.touches[0];
      if (!t) return;
      startX = t.clientX;
      startY = t.clientY;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (window.innerWidth > 768) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      // Only trigger if horizontal movement > 50px and dominant direction
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 2) {
        this.togglePanel();
        this._onPanelToggle?.();
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    this._cleanups.push(() => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    });
  }

  /** Toggle panel between collapsed and expanded. */
  togglePanel(): void {
    this.setPanelCollapsed(!this._panelCollapsed);
  }

  /** Whether the panel is currently collapsed by the user. */
  isPanelCollapsed(): boolean {
    return this._panelCollapsed;
  }

  /** Programmatically set panel collapsed state. */
  setPanelCollapsed(collapsed: boolean): void {
    this._panelCollapsed = collapsed;
    if (collapsed) {
      this._panelEl.classList.add('gengage-chat-panel--collapsed');
    } else {
      this._panelEl.classList.remove('gengage-chat-panel--collapsed');
    }
    const chevronBtn = this._dividerEl.querySelector('.gengage-chat-panel-divider-toggle');
    if (chevronBtn) {
      chevronBtn.textContent = collapsed ? '\u00AB' : '\u00BB'; // « (expand left) or » (collapse right)
    }
  }

  /** Save panel collapsed state to sessionStorage. */
  persistPanelState(accountId: string): void {
    try {
      const key = `gengage:panel:${accountId}`;
      if (this._panelCollapsed) {
        sessionStorage.setItem(key, 'collapsed');
      } else {
        sessionStorage.removeItem(key);
      }
    } catch {
      // sessionStorage may be unavailable in restricted environments
    }
  }

  /** Restore panel collapsed state from sessionStorage. Returns true when restored as collapsed. */
  restorePanelState(accountId: string): boolean {
    try {
      const key = `gengage:panel:${accountId}`;
      if (sessionStorage.getItem(key) === 'collapsed') {
        this._panelCollapsed = true;
        return true;
      }
    } catch {
      // sessionStorage may be unavailable in restricted environments
    }
    return false;
  }

  /** Re-render thinking steps inside the existing typing indicator container. */
  private _renderThinkingSteps(): void {
    const existing = this.messagesEl.querySelector('[data-typing="true"]') as HTMLElement | null;
    if (!existing) {
      // No typing indicator yet — create one with the steps
      this.showTypingIndicator();
      return;
    }
    // Clear and re-render
    existing.innerHTML = '';
    this._renderThinkingStepsInto(existing);
    this._scrollToBottom(false);
  }

  /** Render the accumulated thinking-step checklist into a container element. */
  private _renderThinkingStepsInto(container: HTMLElement): void {
    const list = document.createElement('div');
    list.className = 'gengage-chat-thinking-steps';

    for (let i = 0; i < this._thinkingSteps.length; i++) {
      const step = document.createElement('div');
      step.className = 'gengage-chat-thinking-step';

      const marker = document.createElement('span');
      marker.className = 'gengage-chat-thinking-step-marker';

      if (i < this._thinkingSteps.length - 1) {
        // Completed step
        marker.textContent = '\u2713'; // ✓
        marker.classList.add('gengage-chat-thinking-step-marker--done');
      } else {
        // Current step (last one — still in progress)
        marker.textContent = '\u25CF'; // ●
        marker.classList.add('gengage-chat-thinking-step-marker--active');
      }

      step.appendChild(marker);

      const text = document.createElement('span');
      text.className = 'gengage-chat-thinking-step-text';
      text.textContent = this._thinkingSteps[i]!;
      step.appendChild(text);

      list.appendChild(step);
    }

    container.appendChild(list);
  }

  private _updateSendEnabled(): void {
    const hasContent = this.inputEl.value.trim().length > 0 || this._pendingAttachment !== null;
    this.sendBtn.disabled = !hasContent;
  }

  private _submit(): void {
    const text = this.inputEl.value.trim();
    const attachment = this._pendingAttachment;
    if (!text && !attachment) return;
    this.onSend(text, attachment ?? undefined);
    this.inputEl.value = '';
    this.inputEl.style.height = 'auto'; // Reset textarea height after submit
    this.clearAttachment();
    this._updateSendEnabled();
  }

  private _toggleVoice(): void {
    if (!this._voiceInput) return;
    if (this._voiceInput.state === 'listening') {
      const text = this._voiceInput.stop();
      if (text.trim()) {
        this.inputEl.value = text;
        this._submit();
      }
    } else {
      this.inputEl.value = '';
      this._voiceInput.start();
    }
  }

  /** Lock auto-scroll for 500ms after session history restore to prevent visual jump. */
  lockScrollForRestore(): void {
    this._scrollLockedUntil = Date.now() + 500;
  }

  /** Scroll to bottom only if user hasn't scrolled up. Force=true always scrolls. */
  private _scrollToBottom(force = false): void {
    if (!force && this._userScrolledUp) return;
    if (!force && Date.now() < this._scrollLockedUntil) return;
    requestAnimationFrame(() => {
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
      this._userScrolledUp = false;
    });
  }

  /** Public method for typewriter ticks — scrolls only if user is near bottom. */
  scrollToBottomIfNeeded(): void {
    this._scrollToBottom(false);
  }

  /** Update a bot message's text content in the DOM (e.g. for fallback messages). */
  updateBotMessage(messageId: string, html: string): void {
    const bubble = this.messagesEl.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
    if (!bubble) return;
    let textEl = bubble.querySelector('.gengage-chat-bubble-text');
    if (!textEl) {
      textEl = document.createElement('div');
      textEl.className = 'gengage-chat-bubble-text';
      bubble.appendChild(textEl);
    }
    textEl.innerHTML = sanitizeHtml(html);
    this._scrollToBottom(false);
  }

  /** Mark a message as the first bot message in its thread (for special styling). */
  markFirstBotMessage(messageId: string): void {
    this._firstBotMessageIds.add(messageId);
    const bubble = this.messagesEl.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
    if (bubble) {
      bubble.classList.add('gengage-chat-bubble--first');
    }
  }

  /** Scroll to the first message of the last thread (for restore targeting). */
  scrollToLastThread(): void {
    const allBubbles = this.messagesEl.querySelectorAll('[data-thread-id]');
    if (allBubbles.length === 0) {
      this._scrollToBottom(true);
      return;
    }
    const lastThreadId = allBubbles[allBubbles.length - 1]!.getAttribute('data-thread-id');
    if (!lastThreadId) {
      this._scrollToBottom(true);
      return;
    }
    const target = this.messagesEl.querySelector(`[data-thread-id="${CSS.escape(lastThreadId)}"]`);
    if (target) {
      requestAnimationFrame(() => {
        target.scrollIntoView({ block: 'start', behavior: 'auto' });
        this._userScrolledUp = false;
      });
    } else {
      this._scrollToBottom(true);
    }
  }

  /** Set compact input-area chips (search/info/review shortcuts above input). */
  setInputAreaChips(chips: Array<{ label: string; onAction: () => void; icon?: string }>): void {
    this._inputChipsEl.innerHTML = '';
    if (chips.length === 0) {
      this._inputChipsEl.style.display = 'none';
      return;
    }
    this._inputChipsEl.style.display = '';
    for (const chip of chips) {
      const btn = document.createElement('button');
      btn.className = 'gengage-chat-input-chip';
      btn.type = 'button';

      // Icon (SVG from icon map, falls back to generic arrow for unknown names)
      if (chip.icon) {
        const svgHtml = SUGGESTED_ACTION_ICONS[chip.icon] ?? DEFAULT_ACTION_ICON;
        const iconSpan = document.createElement('span');
        iconSpan.className = 'gengage-chat-input-chip-icon';
        iconSpan.innerHTML = svgHtml;
        btn.appendChild(iconSpan);
      }

      const label = document.createElement('span');
      label.textContent = chip.label;
      btn.appendChild(label);

      btn.addEventListener('click', () => chip.onAction());
      this._inputChipsEl.appendChild(btn);
    }
  }

  /** Clear input-area chips. */
  clearInputAreaChips(): void {
    this._inputChipsEl.innerHTML = '';
    this._inputChipsEl.style.display = 'none';
  }

  setThumbnails(entries: ThumbnailEntry[]): void {
    this._thumbnailsColumn.setEntries(entries);
    if (entries.length > 0) {
      this._thumbnailsColumn.show();
    } else {
      this._thumbnailsColumn.hide();
    }
  }

  hideThumbnails(): void {
    this._thumbnailsColumn.hide();
  }

  /** Activate focus trap — Tab/Shift+Tab cycles within the drawer. */
  trapFocus(): void {
    this._previouslyFocusedElement = document.activeElement as HTMLElement | null;
    this.releaseFocus();

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = this.root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      // Use getRootNode() to resolve activeElement inside Shadow DOM
      const rootNode = this.root.getRootNode();
      const active = rootNode instanceof ShadowRoot ? rootNode.activeElement : document.activeElement;

      if (e.shiftKey) {
        if (active === first || !this.root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !this.root.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    this._focusTrapHandler = handler;
    this.root.addEventListener('keydown', handler);
  }

  /** Release the focus trap and restore previously focused element. */
  releaseFocus(): void {
    if (this._focusTrapHandler) {
      this.root.removeEventListener('keydown', this._focusTrapHandler);
      this._focusTrapHandler = null;
    }
    if (this._previouslyFocusedElement) {
      try {
        this._previouslyFocusedElement.focus();
      } catch {
        // Element may no longer be in the DOM
      }
      this._previouslyFocusedElement = null;
    }
  }

  /** Clean up event listeners and child resources (VoiceInput, timers). */
  destroy(): void {
    this.releaseFocus();
    this._clearStillWorkingTimer();
    for (const cleanup of this._cleanups) cleanup();
    this._cleanups.length = 0;
    this._voiceInput?.destroy();
    this._voiceInput = null;
  }
}

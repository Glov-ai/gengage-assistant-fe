import type { ChatI18n, ChatMessage } from '../types.js';
import { registerChatScrollElement, CHAT_SCROLL_ELEMENT_ID } from '../utils/get-chat-scroll-element.js';
import { sanitizeHtml, isSafeImageUrl } from '../../common/safe-html.js';
import { dispatch } from '../../common/events.js';
import { CHAT_I18N_TR } from '../locales/index.js';
import { VoiceInput, isVoiceInputSupported } from '../../common/voice-input.js';
import { escapeCssIdentifier } from '../../common/css-escape.js';
import { createKvkkBanner } from './KvkkBanner.js';
import { PanelTopBar } from './PanelTopBar.js';
import { ThumbnailsColumn } from './ThumbnailsColumn.js';
import type { ThumbnailEntry } from './ThumbnailsColumn.js';
import { applyBeautyPhotoStepCard } from '../features/beauty-consulting/drawer-extensions.js';
import { renderPhotoAnalysisBubble } from './PhotoAnalysisCard.js';

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
  /**
   * Fired when side panel visibility/content changes so the parent can refresh host scroll lock
   * and backdrop classes. Not related to the Google Chrome browser — “host shell” means the
   * surrounding page/document integration.
   */
  onHostShellSync?: () => void;
  onRollback?: (messageId: string) => void;
  headerTitle?: string | undefined;
  headerAvatarUrl?: string | undefined;
  /** Launcher image URL — used as avatar fallback when headerAvatarUrl is not set. */
  launcherImageUrl?: string | undefined;
  headerBadge?: string | undefined;
  /** URL for the cart icon link in the header (e.g. "/sepetim"). */
  /** @deprecated Use onCartClick instead. If set, the cart button will navigate to this URL. */
  headerCartUrl?: string | undefined;
  /** When true, render the header favorites (heart) button. */
  showHeaderFavorites?: boolean | undefined;
  onFavoritesClick?: (() => void) | undefined;
  /** Callback fired when the panel back button is clicked. */
  onPanelBack?: (() => void) | undefined;
  /** Callback fired when the panel forward button is clicked. */
  onPanelForward?: (() => void) | undefined;
  /** Callback fired when the mobile panel close (✕) button is tapped.
   *  Should clear panel history and comparison state in the caller. */
  onPanelClose?: (() => void) | undefined;
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
  /**
   * Transcript presentation hooks (focus thread, pin-to-bottom heuristics).
   * Optional — when omitted, legacy scroll behaviour is unchanged.
   */
  presentation?: {
    onPinnedToBottomChange?: (pinned: boolean) => void;
    onUserInteractingChange?: (interacting: boolean) => void;
    /** User scrolled up while a thread focus is active — parent may show "former messages" */
    onFormerMessagesHint?: () => void;
    /** When true, stream-driven soft scroll-to-bottom is suppressed */
    shouldBlockSoftAutoScroll?: () => boolean;
    /** User tapped "show former messages" */
    onReleasePresentationFocus?: () => void;
  };
}

const DEFAULT_I18N: ChatI18n = CHAT_I18N_TR;
const LOADING_STEP_INTERVAL_MS = 1400;

interface LoadingSequenceBinding {
  labelEl: HTMLElement;
  steps: string[];
  index: number;
  intervalId: ReturnType<typeof setInterval> | null;
}

const CLIPBOARD_DATA_URL_IN_HTML = /data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+/gi;

/** Turn clipboard items into an image File (PNG/JPEG/WebP). */
async function fileFromClipboardItems(items: ClipboardItem[]): Promise<File | null> {
  for (const clipItem of items) {
    for (const type of clipItem.types) {
      if (!type.startsWith('image/')) continue;
      try {
        const blob = await clipItem.getType(type);
        if (!blob || blob.size === 0) continue;
        const mime = type || blob.type || 'image/png';
        const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
        const name = `paste-${Date.now()}.${ext}`;
        return new File([blob], name, { type: mime });
      } catch {
        continue;
      }
    }
  }

  // Windows / Office / browser copy sometimes exposes images only inside text/html (data URLs).
  for (const clipItem of items) {
    if (!clipItem.types.includes('text/html')) continue;
    try {
      const blob = await clipItem.getType('text/html');
      const html = await blob.text();
      const matches = html.match(CLIPBOARD_DATA_URL_IN_HTML);
      const dataUrl = matches?.[0];
      if (!dataUrl || dataUrl.length > 5_000_000) continue;
      const res = await fetch(dataUrl);
      const out = await res.blob();
      if (!out || out.size === 0) continue;
      const mime = out.type || 'image/png';
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) continue;
      const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
      return new File([out], `paste-${Date.now()}.${ext}`, { type: mime });
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Read image from system clipboard.
 * @param readPromise - Pass `navigator.clipboard.read()` from the **synchronous** click handler.
 *   Chromium on Windows often requires starting `read()` in the same turn as the user gesture;
 *   awaiting other work first can clear activation so `read()` yields nothing / rejects.
 */
async function readClipboardImageAsFile(readPromise?: Promise<ClipboardItem[]>): Promise<File | null> {
  try {
    // readPromise is always supplied by the click handler (started synchronously for Chromium
    // user-activation). The fallback only fires in non-Chromium environments where activation
    // is not required, so it will never be reached on the browsers that need the fix.
    const p = readPromise ?? (typeof navigator.clipboard?.read === 'function' ? navigator.clipboard.read() : null);
    if (!p) return null;
    const items = await p;
    return fileFromClipboardItems(items);
  } catch {
    /* unsupported or permission denied */
  }
  return null;
}

export class ChatDrawer {
  private root: HTMLElement;
  private messagesEl: HTMLElement;
  private inputEl: HTMLTextAreaElement;
  private sendBtn: HTMLButtonElement;
  private _sendStopHandler: (() => void) | null = null;
  private i18n: ChatI18n;
  private onSend: (text: string, attachment?: File) => void;
  private _panelEl: HTMLElement;
  private _panelVisible = false;
  private _panelCollapsed = false;
  private _dividerPreviewEnabled = false;
  private _dividerEl: HTMLElement;
  private _dividerPreviewEl: HTMLElement;
  private _onPanelToggle: (() => void) | undefined = undefined;
  private _onHostShellSync: (() => void) | undefined = undefined;
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
  /** Mobile: overlay host for comparison dock (above panel scroll; avoids transformed panel containing block). */
  private _comparisonDockSlotEl: HTMLElement;
  /** Slot between panel top bar and main scroll content (desktop AI picks / analyzing strip). */
  private _panelAiZoneEl!: HTMLElement;
  private _favBadgeEl: HTMLElement | null = null;
  private _thinkingSteps: string[] = [];
  private _firstBotMessageIds: Set<string> = new Set();
  private _voiceInput: VoiceInput | null = null;
  private _micBtn: HTMLButtonElement | null = null;
  private _voiceEnabled = false;
  private _voiceLang = 'tr-TR';
  private _ignoreNextDividerClick = false;
  /** Cancels in-flight panel list scroll-to-top tween when a new one starts. */
  private _panelListScrollAnimToken = 0;
  private readonly _cleanups: Array<() => void> = [];
  private _focusTrapHandler: ((e: KeyboardEvent) => void) | null = null;
  private _previouslyFocusedElement: HTMLElement | null = null;
  private _conversationEl: HTMLElement | null = null;
  private readonly _options: ChatDrawerOptions;
  private _reopenPanelBtn: HTMLButtonElement | null = null;
  private _presentationFocusThreadId: string | null = null;
  private _formerMessagesBtn: HTMLButtonElement | null = null;
  private _programmaticScrollUntil = 0;
  private _userInteractionUntil = 0;
  private _touchStartY: number | null = null;
  private _presentationPinned = true;
  private _presentationUserInteracting = false;
  private _resizeRafId: number | null = null;
  private _cartBtn: HTMLButtonElement | null = null;
  private _attachWrapEl: HTMLElement | null = null;
  private _attachMenuEl: HTMLElement | null = null;
  private _attachBtn: HTMLButtonElement | null = null;
  private _attachMenuCleanup: (() => void) | null = null;
  private _attachMenuClickTimerId: number | null = null;
  private _typingLoadingBinding: LoadingSequenceBinding | null = null;
  private _panelLoadingBinding: LoadingSequenceBinding | null = null;
  private _panelAiZoneLoadingBinding: LoadingSequenceBinding | null = null;
  private _beautyPhotoStepEl: HTMLElement | null = null;

  private _renderPhotoAnalysisCard(
    container: HTMLElement,
    structured?: {
      summary: string;
      strengths?: string[];
      focusPoints?: string[];
      celebStyle?: string;
      celebStyleReason?: string;
      nextQuestion?: string;
    },
  ): void {
    renderPhotoAnalysisBubble(
      container,
      {
        badge: this.i18n.photoAnalysisBadge,
        strengths: this.i18n.photoAnalysisStrengthsLabel,
        focus: this.i18n.photoAnalysisFocusLabel,
        celebStyle: this.i18n.photoAnalysisCelebStyleLabel,
      },
      structured,
    );
  }

  constructor(container: HTMLElement, options: ChatDrawerOptions) {
    this._options = options;
    this.i18n = { ...DEFAULT_I18N, ...options.i18n };
    this.onSend = options.onSend;
    if (options.onPanelToggle !== undefined) {
      this._onPanelToggle = options.onPanelToggle;
    }
    if (options.onHostShellSync !== undefined) {
      this._onHostShellSync = options.onHostShellSync;
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
    this.root.className = 'gengage-chat-drawer gds-panel';
    this.root.dataset['gengagePart'] = 'chat-drawer';
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

    // Mobile drag handle — visual pill indicator (events attached to the full header below)
    let _handleEl: HTMLDivElement | null = null;
    {
      const handleEl = document.createElement('div');
      handleEl.className = 'gengage-chat-drawer-handle';
      handleEl.dataset['gengagePart'] = 'chat-drawer-handle';
      handleEl.setAttribute('aria-hidden', 'true');
      handleEl.style.pointerEvents = 'none'; // visual only; header receives the touch events
      _handleEl = handleEl;
    }

    // Header — branded surface bar
    const header = document.createElement('div');
    header.className = 'gengage-chat-header gds-shell-header';
    header.dataset['gengagePart'] = 'chat-header';

    const headerLeft = document.createElement('div');
    headerLeft.className = 'gengage-chat-header-left';
    headerLeft.dataset['gengagePart'] = 'chat-header-left';

    const avatarUrl = options.headerAvatarUrl ?? options.launcherImageUrl;
    const useLogoAvatar =
      typeof options.headerAvatarUrl === 'string' &&
      options.headerAvatarUrl.length > 0 &&
      options.headerAvatarUrl !== options.launcherImageUrl;
    if (avatarUrl) {
      const avatar = document.createElement('img');
      avatar.className = 'gengage-chat-header-avatar';
      if (useLogoAvatar) avatar.classList.add('gengage-chat-header-avatar--logo');
      avatar.dataset['gengagePart'] = 'chat-header-avatar';
      avatar.src = avatarUrl;
      avatar.alt = options.headerTitle ?? 'Assistant';
      headerLeft.appendChild(avatar);
    }

    const headerInfo = document.createElement('div');
    headerInfo.className = 'gengage-chat-header-info';
    headerInfo.dataset['gengagePart'] = 'chat-header-info';

    const titleRow = document.createElement('div');
    titleRow.className = 'gengage-chat-header-title-row';
    titleRow.dataset['gengagePart'] = 'chat-header-title-row';
    const title = document.createElement('span');
    title.className = 'gengage-chat-header-title';
    title.dataset['gengagePart'] = 'chat-header-title';
    title.textContent = options.headerTitle ?? this.i18n.headerTitle ?? 'Product Expert';
    titleRow.appendChild(title);

    if (options.headerBadge) {
      const badge = document.createElement('span');
      badge.className = 'gengage-chat-header-badge gds-badge gds-badge-brand';
      badge.dataset['gengagePart'] = 'chat-header-badge';
      badge.textContent = options.headerBadge;
      titleRow.appendChild(badge);
    }
    headerInfo.appendChild(titleRow);

    const powered = document.createElement('a');
    powered.className = 'gengage-chat-header-powered';
    powered.dataset['gengagePart'] = 'chat-header-powered-by';
    powered.href = 'https://gengage.ai/';
    powered.target = '_blank';
    powered.rel = 'noopener noreferrer';
    powered.innerHTML =
      `<svg viewBox="0 0 15 15" fill="none" aria-hidden="true">` +
      `<path d="M15 5.88941C12.2201 5.88941 9.72762 7.14107 8.05571 9.11059H0C2.77991 9.11059 5.27238 7.85893 6.94429 5.88941H15Z" fill="currentColor"/>` +
      `<path d="M9.10964 0C9.10964 2.24394 8.29524 4.30038 6.94429 5.88941C5.27238 7.85962 2.77922 9.11059 0 9.11059V5.88941C3.24802 5.88941 5.89036 3.2465 5.89036 0H9.10964Z" fill="currentColor" fill-opacity="0.68"/>` +
      `<path d="M15 5.88941V9.11059C11.752 9.11059 9.10964 11.7535 9.10964 15H5.89036C5.89036 12.7561 6.70476 10.6996 8.05571 9.11059C9.72762 7.14038 12.2208 5.88941 15 5.88941Z" fill="currentColor" fill-opacity="0.68"/>` +
      `</svg>${this.i18n.poweredBy}`;
    headerInfo.appendChild(powered);

    headerLeft.appendChild(headerInfo);
    header.appendChild(headerLeft);

    const headerRight = document.createElement('div');
    headerRight.className = 'gengage-chat-header-right';
    headerRight.dataset['gengagePart'] = 'chat-header-actions';

    // Reopen-panel button — shown on mobile when the side panel is hidden but has content
    {
      const reopenBtn = document.createElement('button');
      reopenBtn.type = 'button';
      reopenBtn.className =
        'gengage-chat-header-btn gengage-chat-header-btn--reopen-panel gds-btn gds-btn-ghost gds-icon-btn';
      reopenBtn.dataset['gengagePart'] = 'chat-header-reopen-panel';
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
      cartBtn.className = 'gengage-chat-header-btn gds-btn gds-btn-ghost gds-icon-btn';
      cartBtn.dataset['gengagePart'] = 'chat-header-cart';
      cartBtn.setAttribute('aria-label', this.i18n.cartAriaLabel);
      cartBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`;
      cartBtn.addEventListener('click', () => options.onCartClick?.());
      headerRight.appendChild(cartBtn);
      this._cartBtn = cartBtn;
    }

    // New Chat button (optional — reset conversation)
    if (options.onNewChat) {
      const newChatBtn = document.createElement('button');
      newChatBtn.className = 'gengage-chat-header-btn gengage-chat-new-chat gds-btn gds-btn-ghost gds-icon-btn';
      newChatBtn.dataset['gengagePart'] = 'chat-header-new-chat';
      newChatBtn.type = 'button';
      newChatBtn.setAttribute('aria-label', this.i18n.newChatButton);
      newChatBtn.title = this.i18n.newChatButton;
      newChatBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;
      newChatBtn.addEventListener('click', () => options.onNewChat?.());
      headerRight.appendChild(newChatBtn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'gengage-chat-close gds-btn gds-btn-ghost gds-icon-btn';
    closeBtn.dataset['gengagePart'] = 'chat-header-close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', this.i18n.closeButton);
    closeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    closeBtn.addEventListener('click', options.onClose);

    if (options.showHeaderFavorites) {
      const favBtn = document.createElement('button');
      favBtn.className = 'gengage-chat-header-btn gengage-chat-header-btn--fav gds-btn gds-btn-ghost gds-icon-btn';
      favBtn.dataset['gengagePart'] = 'chat-header-favorites';
      favBtn.type = 'button';
      favBtn.setAttribute('aria-label', this.i18n.favoritesAriaLabel);
      favBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;

      const badge = document.createElement('span');
      badge.className = 'gengage-chat-header-fav-badge';
      badge.dataset['gengagePart'] = 'chat-header-favorites-badge';
      badge.setAttribute('aria-hidden', 'true');
      badge.style.display = 'none';
      favBtn.appendChild(badge);
      this._favBadgeEl = badge;

      favBtn.addEventListener('click', () => {
        options.onFavoritesClick?.();
      });
      headerRight.appendChild(favBtn);
    }

    headerRight.appendChild(closeBtn);
    // Insert handle at the very top of header (before headerLeft / headerRight)
    if (_handleEl) header.insertBefore(_handleEl, header.firstChild);
    header.appendChild(headerRight);

    // Attach drag-to-dismiss events to the full header so any header tap-drag works.
    // Interactive children (buttons, links) are excluded so they keep normal tap behaviour.
    {
      const SNAP_THRESHOLD = 72;
      let dragStartY = 0;
      let dragDelta = 0;
      let dragging = false;

      const onDragStart = (e: TouchEvent) => {
        if (!(this._options.getMobileViewport?.() ?? window.innerWidth <= 768)) return;
        // Don't start drag if the touch landed on an interactive element
        const target = e.target as HTMLElement;
        if (target.closest('button, a, input, [role="button"]')) return;
        const t = e.changedTouches?.[0];
        if (!t) return;
        dragStartY = t.clientY;
        dragDelta = 0;
        dragging = true;
        this.root.style.transition = 'none';
      };

      const onDragMove = (e: TouchEvent) => {
        if (!dragging) return;
        const t = e.changedTouches?.[0];
        if (!t) return;
        dragDelta = t.clientY - dragStartY;
        const currentState = options.getMobileState?.() ?? 'full';
        const clampedDelta = currentState === 'full' ? Math.max(0, dragDelta) : dragDelta;
        e.preventDefault();
        this.root.style.transform = `translateY(${clampedDelta}px)`;
      };

      const onDragEnd = () => {
        if (!dragging) return;
        dragging = false;
        const currentState = options.getMobileState?.() ?? 'full';

        let nextState: 'half' | 'full' | 'close';
        if (dragDelta > SNAP_THRESHOLD) {
          nextState = currentState === 'full' ? 'half' : 'close';
        } else if (dragDelta < -SNAP_THRESHOLD && currentState === 'half') {
          nextState = 'full';
        } else {
          nextState = currentState;
        }

        this.root.style.transition = '';
        if (nextState === 'close') {
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

      const onDragCancel = () => {
        if (!dragging) return;
        dragging = false;
        dragDelta = 0;
        this.root.style.transition = '';
        this.root.style.transform = '';
      };

      header.addEventListener('touchstart', onDragStart, { passive: true });
      header.addEventListener('touchmove', onDragMove, { passive: false });
      header.addEventListener('touchend', onDragEnd, { passive: true });
      header.addEventListener('touchcancel', onDragCancel, { passive: true });
      this._cleanups.push(() => {
        header.removeEventListener('touchstart', onDragStart);
        header.removeEventListener('touchmove', onDragMove);
        header.removeEventListener('touchend', onDragEnd);
        header.removeEventListener('touchcancel', onDragCancel);
      });
    }

    // Body: flex container for panel + conversation
    const body = document.createElement('div');
    body.className = 'gengage-chat-body';
    body.dataset['gengagePart'] = 'chat-body';

    // Panel (hidden by default)
    this._panelEl = document.createElement('div');
    this._panelEl.className = 'gengage-chat-panel gds-panel';
    this._panelEl.dataset['gengagePart'] = 'chat-panel';

    // Panel top bar (navigation)
    this._panelTopBar = new PanelTopBar({
      onBack: () => options.onPanelBack?.(),
      onForward: () => options.onPanelForward?.(),
      onClose: () => {
        if (options.getMobileViewport?.() ?? false) {
          this.hideMobilePanel();
        } else {
          this.clearPanel();
        }
        options.onPanelClose?.();
      },
      backAriaLabel: this.i18n.backAriaLabel,
      forwardAriaLabel: this.i18n.forwardAriaLabel,
      closePanelAriaLabel: this.i18n.closePanelAriaLabel,
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
    this._dividerEl.dataset['gengagePart'] = 'chat-panel-divider';
    this._dividerEl.setAttribute('role', 'separator');
    this._dividerEl.setAttribute('aria-label', this.i18n.togglePanelAriaLabel);
    this._dividerEl.setAttribute('title', this.i18n.togglePanelAriaLabel);
    this._dividerPreviewEl = document.createElement('div');
    this._dividerPreviewEl.className = 'gengage-chat-panel-divider-preview';
    this._dividerPreviewEl.dataset['gengagePart'] = 'chat-panel-divider-preview';
    this._dividerPreviewEl.setAttribute('aria-hidden', 'true');
    this._dividerEl.appendChild(this._dividerPreviewEl);
    const chevron = document.createElement('button');
    chevron.className = 'gengage-chat-panel-divider-toggle gds-btn gds-btn-ghost';
    chevron.dataset['gengagePart'] = 'chat-panel-divider-toggle';
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
    conversation.dataset['gengagePart'] = 'chat-conversation';
    this._conversationEl = conversation;
    conversation.appendChild(header);

    // Offline status bar (hidden by default, shown when navigator.onLine === false)
    const offlineBar = document.createElement('div');
    offlineBar.className = 'gengage-chat-offline-bar gds-evidence-card gds-evidence-card-warning';
    offlineBar.dataset['gengagePart'] = 'chat-offline-bar';
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
    this._kvkkSlot.dataset['gengagePart'] = 'chat-kvkk-slot';
    conversation.appendChild(this._kvkkSlot);

    // Messages area (stable id for host tooling / getChatScrollElement registration)
    this.messagesEl = document.createElement('div');
    this.messagesEl.id = CHAT_SCROLL_ELEMENT_ID;
    this.messagesEl.className = 'gengage-chat-messages';
    this.messagesEl.dataset['gengagePart'] = 'chat-messages';
    this.messagesEl.setAttribute('role', 'log');
    this.messagesEl.setAttribute('aria-live', 'polite');
    this.messagesEl.setAttribute('aria-atomic', 'false');
    this.messagesEl.setAttribute('aria-label', this.i18n.chatMessagesAriaLabel);
    registerChatScrollElement(this.messagesEl);

    const formerBtn = document.createElement('button');
    formerBtn.type = 'button';
    formerBtn.className = 'gengage-chat-former-messages-btn gds-chip';
    formerBtn.dataset['gengagePart'] = 'chat-former-messages-button';
    formerBtn.textContent = this.i18n.showFormerMessagesButton;
    formerBtn.setAttribute('aria-label', this.i18n.showFormerMessagesButton);
    formerBtn.style.display = 'none';
    formerBtn.addEventListener('click', () => {
      this._options.presentation?.onReleasePresentationFocus?.();
    });
    this.messagesEl.appendChild(formerBtn);
    this._formerMessagesBtn = formerBtn;

    const markExplicitUserInteraction = () => {
      this._userInteractionUntil = Date.now() + 2000;
    };

    // Track user scroll position + presentation pin / interaction (aligned with legacy UX)
    let scrollRafPending = false;
    const pres = () => this._options.presentation;
    const onMessagesScroll = () => {
      if (scrollRafPending) return;
      scrollRafPending = true;
      requestAnimationFrame(() => {
        scrollRafPending = false;
        const { scrollTop, scrollHeight, clientHeight } = this.messagesEl;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        this._userScrolledUp = distanceFromBottom > 10;

        const pinnedEnterThreshold = 32;
        const pinnedExitThreshold = 96;
        const previouslyPinned = this._presentationPinned;
        const pinned = previouslyPinned
          ? distanceFromBottom < pinnedExitThreshold
          : distanceFromBottom < pinnedEnterThreshold;

        const now = Date.now();
        const isProgrammaticScroll = now < this._programmaticScrollUntil;
        const explicitUserInteracting = !pinned && now < this._userInteractionUntil;
        const nextUserInteracting = isProgrammaticScroll ? false : explicitUserInteracting;

        if (pinned !== this._presentationPinned) {
          this._presentationPinned = pinned;
          pres()?.onPinnedToBottomChange?.(pinned);
        }
        if (nextUserInteracting !== this._presentationUserInteracting) {
          this._presentationUserInteracting = nextUserInteracting;
          pres()?.onUserInteractingChange?.(nextUserInteracting);
        }
      });
    };
    this.messagesEl.addEventListener('scroll', onMessagesScroll, { passive: true });
    this._cleanups.push(() => {
      this.messagesEl.removeEventListener('scroll', onMessagesScroll);
    });

    const onWheel = (e: WheelEvent) => {
      markExplicitUserInteraction();
      if (e.deltaY < -6 && this._presentationFocusThreadId) {
        this._options.presentation?.onFormerMessagesHint?.();
      }
    };
    this.messagesEl.addEventListener('wheel', onWheel, { passive: true });
    this._cleanups.push(() => this.messagesEl.removeEventListener('wheel', onWheel));

    const onTouchStart = (e: TouchEvent) => {
      markExplicitUserInteraction();
      this._touchStartY = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      markExplicitUserInteraction();
      const y = e.touches[0]?.clientY;
      const start = this._touchStartY;
      if (typeof y === 'number' && typeof start === 'number' && y - start > 10 && this._presentationFocusThreadId) {
        this._options.presentation?.onFormerMessagesHint?.();
      }
    };
    this.messagesEl.addEventListener('touchstart', onTouchStart, { passive: true });
    this.messagesEl.addEventListener('touchmove', onTouchMove, { passive: true });
    this._cleanups.push(() => {
      this.messagesEl.removeEventListener('touchstart', onTouchStart);
      this.messagesEl.removeEventListener('touchmove', onTouchMove);
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
    this._panelFloatingEl.dataset['gengagePart'] = 'chat-panel-floating-layer';
    this._panelEl.appendChild(this._panelFloatingEl);

    this._resetPanelAiZoneElement();

    // Suggestion pills row (between messages and input)
    this._pillsEl = document.createElement('div');
    this._pillsEl.className = 'gengage-chat-pills';
    this._pillsEl.dataset['gengagePart'] = 'chat-suggestion-pills';
    this._pillsEl.setAttribute('role', 'toolbar');
    this._pillsEl.setAttribute('aria-label', this.i18n.suggestionsAriaLabel);
    this._pillsEl.style.display = 'none';

    const pillsScroll = document.createElement('div');
    pillsScroll.className = 'gengage-chat-pills-scroll';
    pillsScroll.dataset['gengagePart'] = 'chat-suggestion-pills-scroll';
    this._pillsEl.appendChild(pillsScroll);

    const pillsArrow = document.createElement('button');
    pillsArrow.className = 'gengage-chat-pills-arrow gds-btn gds-btn-ghost';
    pillsArrow.dataset['gengagePart'] = 'chat-suggestion-pills-more';
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
    this._inputChipsEl.dataset['gengagePart'] = 'chat-input-chips';
    this._inputChipsEl.style.display = 'none';
    conversation.appendChild(this._inputChipsEl);

    // Input area
    const inputArea = document.createElement('div');
    inputArea.className = 'gengage-chat-input-area';
    inputArea.dataset['gengagePart'] = 'chat-input-area';

    this.inputEl = document.createElement('textarea');
    this.inputEl.className = 'gengage-chat-input';
    this.inputEl.dataset['gengagePart'] = 'chat-input';
    this.inputEl.rows = 1;
    this.inputEl.placeholder = this.i18n.inputPlaceholder;

    // Auto-expand on desktop as user types (capped at 120px)
    this.inputEl.addEventListener('input', () => {
      // Cancel any pending resize rAF to avoid queuing multiple reflows
      if (this._resizeRafId !== null) {
        cancelAnimationFrame(this._resizeRafId);
      }
      this._resizeRafId = requestAnimationFrame(() => {
        this._resizeRafId = null;
        this.inputEl.style.height = 'auto';
        this.inputEl.style.height = `${Math.min(this.inputEl.scrollHeight, 120)}px`;
      });
      this._updateSendEnabled();
    });

    // Enter submits; Shift+Enter inserts newline on desktop only
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) {
        const isMobile = this._options.getMobileViewport?.() ?? window.innerWidth <= 768;
        if (isMobile || !e.shiftKey) {
          e.preventDefault();
          this._submit();
        }
        // else: Shift+Enter on desktop → natural newline (no preventDefault)
      }
    });

    this.inputEl.addEventListener('paste', (e) => {
      const cd = e.clipboardData;
      if (!cd) return;
      let file: File | null = null;
      const f0 = cd.files?.[0];
      if (f0 && f0.type.startsWith('image/')) {
        file = f0;
      } else if (cd.items?.length) {
        for (let i = 0; i < cd.items.length; i++) {
          const item = cd.items[i];
          if (item?.kind === 'file' && item.type.startsWith('image/')) {
            const f = item.getAsFile();
            if (f) {
              file = f;
              break;
            }
          }
        }
      }
      if (file) {
        e.preventDefault();
        this._routeAttachmentFile(file);
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
        this._routeAttachmentFile(file);
      }
      this._fileInput.value = '';
    });

    // Attach: camera button + popup (fotoğraf seç / panodan yapıştır)
    const attachWrap = document.createElement('div');
    attachWrap.className = 'gengage-chat-attach-wrap';
    attachWrap.dataset['gengagePart'] = 'chat-attach-wrap';
    this._attachWrapEl = attachWrap;

    const attachBtn = document.createElement('button');
    this._attachBtn = attachBtn;
    attachBtn.className = 'gengage-chat-attach-btn gds-btn gds-btn-ghost';
    attachBtn.dataset['gengagePart'] = 'chat-attach-button';
    attachBtn.type = 'button';
    attachBtn.setAttribute('aria-label', this.i18n.attachImageButton);
    attachBtn.setAttribute('aria-haspopup', 'menu');
    attachBtn.setAttribute('aria-expanded', 'false');
    attachBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
    attachBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this._toggleAttachMenu();
    });

    const attachMenu = document.createElement('div');
    this._attachMenuEl = attachMenu;
    attachMenu.className = 'gengage-chat-attach-menu gds-menu';
    attachMenu.dataset['gengagePart'] = 'chat-attach-menu';
    attachMenu.setAttribute('role', 'menu');
    attachMenu.setAttribute('hidden', '');

    const selectPhotoBtn = document.createElement('button');
    selectPhotoBtn.type = 'button';
    selectPhotoBtn.className = 'gengage-chat-attach-menu-item gds-btn gds-btn-ghost';
    selectPhotoBtn.dataset['gengagePart'] = 'chat-attach-menu-select-photo';
    selectPhotoBtn.setAttribute('role', 'menuitem');
    selectPhotoBtn.innerHTML =
      '<span class="gengage-chat-attach-menu-icon" aria-hidden="true">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></span>' +
      `<span class="gengage-chat-attach-menu-label">${this.i18n.attachMenuSelectPhoto}</span>`;
    selectPhotoBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this._closeAttachMenu();
      this._fileInput.click();
    });

    const sep = document.createElement('div');
    sep.className = 'gengage-chat-attach-menu-sep';
    sep.dataset['gengagePart'] = 'chat-attach-menu-separator';
    sep.setAttribute('aria-hidden', 'true');

    const pasteBtn = document.createElement('button');
    pasteBtn.type = 'button';
    pasteBtn.className = 'gengage-chat-attach-menu-item gds-btn gds-btn-ghost';
    pasteBtn.dataset['gengagePart'] = 'chat-attach-menu-paste';
    pasteBtn.setAttribute('role', 'menuitem');
    pasteBtn.innerHTML =
      '<span class="gengage-chat-attach-menu-icon" aria-hidden="true">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M15 2H9a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1Z"/>' +
      '<path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>' +
      '<path d="M16 4h2a2 2 0 0 1 2 2v4"/>' +
      '<path d="M21 14H11"/>' +
      '<path d="m15 10-4 4 4 4"/>' +
      '</svg></span>' +
      `<span class="gengage-chat-attach-menu-label">${this.i18n.attachMenuPaste}</span>`;
    pasteBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      // Start Clipboard API read synchronously in this handler (Chromium user-activation rule).
      const clipRead = typeof navigator.clipboard?.read === 'function' ? navigator.clipboard.read() : undefined;
      void this._pasteImageFromClipboardMenu(clipRead);
    });

    attachMenu.appendChild(selectPhotoBtn);
    attachMenu.appendChild(sep);
    attachMenu.appendChild(pasteBtn);
    attachWrap.appendChild(attachBtn);
    attachWrap.appendChild(attachMenu);

    // Attachment preview strip (hidden by default)
    this._previewStrip = document.createElement('div');
    this._previewStrip.className =
      'gengage-chat-attachment-preview gengage-chat-attachment-preview--hidden gds-card-soft';
    this._previewStrip.dataset['gengagePart'] = 'chat-attachment-preview';
    const previewThumb = document.createElement('img');
    previewThumb.className = 'gengage-chat-attachment-preview-thumb';
    previewThumb.dataset['gengagePart'] = 'chat-attachment-preview-thumb';
    previewThumb.alt = '';
    this._previewName = document.createElement('span');
    this._previewName.className = 'gengage-chat-attachment-name';
    this._previewName.dataset['gengagePart'] = 'chat-attachment-preview-name';
    const removeBtn = document.createElement('button');
    removeBtn.className = 'gengage-chat-attachment-remove gds-btn gds-btn-ghost';
    removeBtn.dataset['gengagePart'] = 'chat-attachment-preview-remove';
    removeBtn.type = 'button';
    removeBtn.setAttribute('aria-label', this.i18n.removeAttachmentButton);
    removeBtn.textContent = '\u00D7'; // multiplication sign (x)
    removeBtn.addEventListener('click', () => this.clearAttachment());
    this._previewStrip.appendChild(previewThumb);
    this._previewStrip.appendChild(this._previewName);
    this._previewStrip.appendChild(removeBtn);

    this.sendBtn = document.createElement('button');
    this.sendBtn.className = 'gengage-chat-send gds-btn gds-btn-primary';
    this.sendBtn.dataset['gengagePart'] = 'chat-send';
    this.sendBtn.type = 'button';
    this.sendBtn.disabled = true;
    this.sendBtn.setAttribute('aria-label', this.i18n.sendButton);
    this.sendBtn.dataset['tooltip'] = this.i18n.sendButton;
    this._renderSendButtonIcon('send');
    this.sendBtn.addEventListener('click', () => {
      if (this._sendStopHandler) {
        const onStop = this._sendStopHandler;
        this.hideStopButton();
        onStop();
        return;
      }
      this._submit();
    });

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
        this._routeAttachmentFile(file);
      }
    });

    // Build pill container: [camera] [input] [mic?] [send]
    const pill = document.createElement('div');
    pill.className = 'gengage-chat-input-pill gds-input-shell';
    pill.dataset['gengagePart'] = 'chat-input-shell';
    pill.appendChild(attachWrap);
    pill.appendChild(this.inputEl);

    // Voice input mic button (Web Speech API STT)
    if (this._voiceEnabled && isVoiceInputSupported()) {
      this._micBtn = document.createElement('button');
      this._micBtn.className = 'gengage-chat-mic-btn gds-btn gds-btn-ghost';
      this._micBtn.dataset['gengagePart'] = 'chat-mic-button';
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
            if (this._resizeRafId !== null) {
              cancelAnimationFrame(this._resizeRafId);
              this._resizeRafId = null;
            }
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

    this._comparisonDockSlotEl = document.createElement('div');
    this._comparisonDockSlotEl.className = 'gengage-chat-comparison-dock-slot';
    this._comparisonDockSlotEl.dataset['gengagePart'] = 'comparison-dock-slot';
    body.appendChild(this._comparisonDockSlotEl);

    this.root.appendChild(body);

    // Horizontal swipe to toggle panel on mobile (GAP-101)
    this._setupHorizontalSwipe(conversation);
    this._setupHorizontalSwipe(this._panelEl);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'gengage-chat-footer';
    footer.dataset['gengagePart'] = 'chat-footer';
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
    const bubbleRoleClass = message.role === 'assistant' ? 'gds-message-assistant' : 'gds-message-user';
    bubble.className = `gengage-chat-bubble gds-message ${bubbleRoleClass} gengage-chat-bubble--${message.role}`;
    bubble.dataset['gengagePart'] = message.role === 'assistant' ? 'chat-message-assistant' : 'chat-message-user';
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
      text.dataset['gengagePart'] = 'chat-message-text';
      if (message.role === 'assistant') {
        if (message.renderHint === 'photo_analysis') {
          bubble.classList.add('gengage-chat-bubble--photo-analysis');
          this._renderPhotoAnalysisCard(text, message.photoAnalysis);
        } else {
          text.innerHTML = sanitizeHtml(message.content);
        }
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
      rollbackBtn.className = 'gengage-chat-rollback-btn gds-btn gds-btn-ghost';
      rollbackBtn.dataset['gengagePart'] = 'chat-message-rollback';
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
    if (this._presentationFocusThreadId) {
      this._applyPresentationCollapsed();
    }
    this._scrollToBottom(message.role === 'user');
  }

  /** Remove one transcript bubble (e.g. superseded empty assistant placeholder). */
  removeMessageBubble(messageId: string): void {
    this._firstBotMessageIds.delete(messageId);
    this.messagesEl.querySelector(`[data-message-id="${escapeCssIdentifier(messageId)}"]`)?.remove();
    if (this._presentationFocusThreadId) {
      this._applyPresentationCollapsed();
    }
  }

  showTypingIndicator(searchText?: string): void {
    this.removeTypingIndicator();
    const initialSteps =
      this._thinkingSteps.length > 0
        ? this._thinkingSteps.slice(-3)
        : searchText
          ? [searchText]
          : this.i18n.loadingSequenceGeneric;
    const { root, binding } = this._createLoadingSequence(
      'chat',
      initialSteps,
      'chat-typing-indicator',
      'gengage-chat-typing',
    );
    root.dataset['typing'] = 'true';
    this._typingLoadingBinding = binding;

    this.messagesEl.appendChild(root);
    this._scrollToBottom(true);
  }

  /** Accumulate a new thinking step (shown as a checklist in the typing indicator). */
  addThinkingStep(text: string): void {
    const normalized = text.trim();
    if (!normalized) return;
    if (this._thinkingSteps[this._thinkingSteps.length - 1] === normalized) return;
    this._thinkingSteps.push(normalized);
    this._thinkingSteps = this._thinkingSteps.slice(-3);
    if (this._typingLoadingBinding) {
      this._applyLoadingSteps(this._typingLoadingBinding, this._thinkingSteps, true);
    }
    if (this._panelLoadingBinding) {
      this._applyLoadingSteps(this._panelLoadingBinding, this._thinkingSteps, true);
    }
    if (this._panelAiZoneLoadingBinding) {
      this._applyLoadingSteps(this._panelAiZoneLoadingBinding, this._thinkingSteps, true);
    }
  }

  setThinkingSteps(steps: string[]): void {
    const normalized = steps
      .map((step) => step.trim())
      .filter(Boolean)
      .slice(-3);
    if (normalized.length === 0) return;
    this._thinkingSteps = normalized;
    if (this._typingLoadingBinding) {
      this._applyLoadingSteps(this._typingLoadingBinding, this._thinkingSteps, true);
    }
    if (this._panelLoadingBinding) {
      this._applyLoadingSteps(this._panelLoadingBinding, this._thinkingSteps, true);
    }
    if (this._panelAiZoneLoadingBinding) {
      this._applyLoadingSteps(this._panelAiZoneLoadingBinding, this._thinkingSteps, true);
    }
  }

  removeTypingIndicator(): void {
    this._destroyLoadingBinding(this._typingLoadingBinding);
    this._typingLoadingBinding = null;
    const existing = this.messagesEl.querySelector('.gengage-chat-typing');
    existing?.remove();
    this._thinkingSteps = [];
    this.hideStopButton();
  }

  /** Show a "Stop generating" button below the typing indicator. */
  showStopButton(onStop: () => void): void {
    this._sendStopHandler = onStop;
    this.sendBtn.disabled = false;
    this.sendBtn.classList.add('gengage-chat-send--stop', 'gds-btn-secondary');
    this.sendBtn.classList.remove('gds-btn-primary');
    this.sendBtn.setAttribute('aria-label', this.i18n.stopGenerating);
    this.sendBtn.dataset['tooltip'] = this.i18n.stopGenerating;
    this._renderSendButtonIcon('stop');
  }

  /** Remove the stop-generating button if present. */
  hideStopButton(): void {
    this._sendStopHandler = null;
    this.sendBtn.classList.remove('gengage-chat-send--stop', 'gds-btn-secondary');
    this.sendBtn.classList.add('gds-btn-primary');
    this.sendBtn.setAttribute('aria-label', this.i18n.sendButton);
    this.sendBtn.dataset['tooltip'] = this.i18n.sendButton;
    this._renderSendButtonIcon('send');
    this._updateSendEnabled();
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
    this.setRecoveryPills(actions);
  }

  /** Recovery pills only — error copy is shown as a normal assistant message. */
  showRecoveryPillsOnly(actions: { onRetry: () => void; onNewQuestion: () => void }): void {
    this.setRecoveryPills(actions);
  }

  private setRecoveryPills(actions: { onRetry: () => void; onNewQuestion: () => void }): void {
    this.setPills([
      { label: this.i18n.tryAgainButton, onAction: actions.onRetry },
      { label: this.i18n.askSomethingElseButton, onAction: actions.onNewQuestion },
    ]);
  }

  clearMessages(): void {
    const former = this._formerMessagesBtn;
    for (const child of [...this.messagesEl.children]) {
      if (child !== former) child.remove();
    }
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
      btn.className = pill.image
        ? 'gengage-chat-pill gds-chip gds-chip-active gengage-chat-pill--rich'
        : 'gengage-chat-pill gds-chip gds-chip-active';
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

  /** True when the KVKK banner is mounted (user has not dismissed it yet). */
  isKvkkBannerVisible(): boolean {
    return this._kvkkSlot.childNodes.length > 0;
  }

  getElement(): HTMLElement {
    return this.root;
  }

  /** Opens the hidden file picker used by the attachment flow. */
  openAttachmentPicker(): void {
    this._fileInput.click();
  }

  /** Show/hide camera attach controls in the input shell. */
  setAttachmentControlsVisible(visible: boolean): void {
    if (!this._attachWrapEl) return;
    this._attachWrapEl.style.display = visible ? '' : 'none';
    if (!visible) this._closeAttachMenu();
  }

  /** Beauty mode selfie helper card shown above the input area. */
  setBeautyPhotoStepCard(options: {
    visible: boolean;
    processing?: boolean;
    onSkip?: (() => void) | undefined;
    title?: string | undefined;
    description?: string | undefined;
    uploadLabel?: string | undefined;
    skipLabel?: string | undefined;
  }): void {
    this._beautyPhotoStepEl = applyBeautyPhotoStepCard(
      this._beautyPhotoStepEl,
      this._conversationEl ?? null,
      options,
      this.i18n,
      () => this.openAttachmentPicker(),
    );
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

  private _routeAttachmentFile(file: File): void {
    if (this._onAttachment) {
      try {
        this._onAttachment(file);
      } catch (err) {
        console.error('[gengage:chat] Attachment callback error:', err);
      }
    } else {
      this.stageAttachment(file);
    }
  }

  private _closeAttachMenu(): void {
    if (!this._attachMenuEl) return;
    this._attachMenuEl.setAttribute('hidden', '');
    this._attachBtn?.setAttribute('aria-expanded', 'false');
    if (this._attachMenuClickTimerId !== null) {
      clearTimeout(this._attachMenuClickTimerId);
      this._attachMenuClickTimerId = null;
    }
    if (this._attachMenuCleanup) {
      this._attachMenuCleanup();
      this._attachMenuCleanup = null;
    }
  }

  private _openAttachMenu(): void {
    if (!this._attachMenuEl) return;
    this._attachMenuEl.removeAttribute('hidden');
    this._attachBtn?.setAttribute('aria-expanded', 'true');
    const onDocCapture = (e: MouseEvent): void => {
      if (this._attachWrapEl?.contains(e.target as Node)) return;
      this._closeAttachMenu();
    };
    const onEsc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        this._closeAttachMenu();
      }
    };
    this._attachMenuClickTimerId = window.setTimeout(() => {
      this._attachMenuClickTimerId = null;
      document.addEventListener('click', onDocCapture, true);
    }, 0);
    document.addEventListener('keydown', onEsc, true);
    this._attachMenuCleanup = () => {
      document.removeEventListener('click', onDocCapture, true);
      document.removeEventListener('keydown', onEsc, true);
    };
  }

  private _toggleAttachMenu(): void {
    if (!this._attachMenuEl) return;
    if (this._attachMenuEl.hasAttribute('hidden')) {
      this._openAttachMenu();
    } else {
      this._closeAttachMenu();
    }
  }

  private async _pasteImageFromClipboardMenu(clipRead?: Promise<ClipboardItem[]>): Promise<void> {
    const file = await readClipboardImageAsFile(clipRead);
    if (file) {
      this._routeAttachmentFile(file);
      this._closeAttachMenu();
      return;
    }
    dispatch('gengage:global:error', {
      message: this.i18n.clipboardNoImageMessage,
      source: 'chat' as const,
    });
    this._closeAttachMenu();
  }

  /** Get the currently staged attachment file, or null. */
  getPendingAttachment(): File | null {
    return this._pendingAttachment;
  }

  /**
   * Desktop: area above the main panel body for “analyzing” + AITopPicks / AIGroupingCards
   * so they are not duplicated in the chat column.
   */
  setPanelAiZoneState(
    state: 'hidden' | 'analyzing' | 'results',
    options?: { resultEl?: HTMLElement; analyzingLabel?: string },
  ): void {
    if (!this._panelAiZoneEl.isConnected) return;
    this._destroyLoadingBinding(this._panelAiZoneLoadingBinding);
    this._panelAiZoneLoadingBinding = null;
    if (state === 'hidden') {
      this._panelAiZoneEl.innerHTML = '';
      this._panelAiZoneEl.setAttribute('hidden', '');
      return;
    }
    this._panelAiZoneEl.removeAttribute('hidden');
    if (state === 'analyzing') {
      this._panelAiZoneEl.innerHTML = '';
      const fallbackSequence = [
        options?.analyzingLabel ?? this.i18n.aiAnalysisAnalyzingLabel,
        ...this.i18n.loadingSequencePanel,
      ];
      const { root, binding } = this._createLoadingSequence(
        'panel',
        this._thinkingSteps.length > 0 ? this._thinkingSteps.slice(-3) : fallbackSequence,
        'panel-ai-zone-loading',
        'gengage-chat-panel-ai-zone-inner',
      );
      this._panelAiZoneLoadingBinding = binding;
      this._panelAiZoneEl.appendChild(root);
    } else if (state === 'results' && options?.resultEl) {
      this._panelAiZoneEl.innerHTML = '';
      this._panelAiZoneEl.appendChild(options.resultEl);
    }
  }

  private _resetPanelAiZoneElement(): void {
    this._panelAiZoneEl = document.createElement('div');
    this._panelAiZoneEl.className = 'gengage-chat-panel-ai-zone';
    this._panelAiZoneEl.setAttribute('hidden', '');
  }

  private _emitHostShellSync(): void {
    this._onHostShellSync?.();
  }

  private _syncPanelTopBarFromContent(contentEl: HTMLElement): void {
    const gridHead = contentEl.querySelector<HTMLElement>('.gengage-chat-product-grid-head');
    if (gridHead) {
      const titleEl = gridHead.querySelector<HTMLElement>('.gengage-chat-product-grid-head-title');
      const actionsEl = gridHead.querySelector<HTMLElement>('.gengage-chat-product-grid-head-actions');
      if (titleEl?.textContent?.trim()) {
        const derivedTitle = titleEl.textContent.trim();
        contentEl.dataset['gengagePanelDerivedTitle'] = derivedTitle;
        this._panelTopBar.setTitle(derivedTitle);
      }
      if (actionsEl) {
        actionsEl.classList.add('gengage-chat-panel-topbar-toolbar-host');
        this._panelTopBar.setActions(actionsEl);
      } else {
        this._panelTopBar.setActions(null);
      }
      gridHead.remove();
      return;
    }
    this._syncPanelTopBarTitleFromContent(contentEl);
  }

  private _syncPanelTopBarTitleFromContent(contentEl: HTMLElement): void {
    const derivedTitle = contentEl.dataset['gengagePanelDerivedTitle'];
    if (derivedTitle?.trim()) {
      this._panelTopBar.setTitle(derivedTitle.trim());
      return;
    }
    const titleCandidate = contentEl.querySelector<HTMLElement>(
      '.gengage-chat-product-details-title, .gengage-chat-product-details-similars-heading, .gengage-chat-ai-top-picks-title',
    );
    const titleText = titleCandidate?.textContent?.trim();
    if (titleText) {
      this._panelTopBar.setTitle(titleText);
    }
  }

  /** Replace panel content and show the panel. */
  setPanelContent(el: HTMLElement): void {
    this._destroyLoadingBinding(this._panelLoadingBinding);
    this._panelLoadingBinding = null;
    this._destroyLoadingBinding(this._panelAiZoneLoadingBinding);
    this._panelAiZoneLoadingBinding = null;
    const wasVisible = this._panelVisible;
    // Only apply opacity crossfade when swapping content in an already-visible panel.
    // Applying it on first-show would hide the slide-in animation (opacity:0 masks the transform).
    if (wasVisible) {
      this._panelEl.classList.add('gengage-chat-panel--transitioning');
    }
    this._panelEl.innerHTML = '';
    this._resetPanelAiZoneElement();
    this._panelEl.appendChild(this._panelTopBar.getElement());
    this._panelEl.appendChild(this._panelAiZoneEl);
    this._panelTopBar.setActions(null);
    this._panelEl.appendChild(el);
    this._panelEl.appendChild(this._thumbnailsColumn.getElement());
    this._panelEl.appendChild(this._panelFloatingEl);
    this._syncPanelTopBarFromContent(el);
    this._dividerEl.classList.remove('gengage-chat-panel-divider--hidden');
    if (!this._panelVisible) {
      this._panelVisible = true;
      this._panelEl.classList.add('gengage-chat-panel--visible');
      this.root.classList.add('gengage-chat-drawer--with-panel');
    }
    if (this._panelCollapsed) {
      this._panelEl.classList.add('gengage-chat-panel--collapsed');
    }
    this._syncDividerPreview();
    requestAnimationFrame(() => {
      this._panelEl.classList.remove('gengage-chat-panel--transitioning');
      this._updateScrollAffordance();
      this._smoothScrollPanelListToTop();
    });
    // New content always reopens the panel — hide the reopen button
    if (this._reopenPanelBtn) this._reopenPanelBtn.style.display = 'none';
    this._emitHostShellSync();
  }

  /** Append content to the panel without replacing existing content. */
  appendPanelContent(el: HTMLElement): void {
    const thumb = this._thumbnailsColumn.getElement();
    const ref = thumb.parentElement === this._panelEl ? thumb : this._panelFloatingEl;
    this._panelEl.insertBefore(el, ref);
    this._syncPanelTopBarFromContent(this.getPanelContentElement() ?? el);
    this._dividerEl.classList.remove('gengage-chat-panel-divider--hidden');
    if (!this._panelVisible) {
      this._panelVisible = true;
      this._panelEl.classList.add('gengage-chat-panel--visible');
      this.root.classList.add('gengage-chat-drawer--with-panel');
    }
    this._syncDividerPreview();
    this._emitHostShellSync();
  }

  /** Return the panel element's content child (after topbar), or null. */
  getPanelContentElement(): HTMLElement | null {
    const children = this._panelEl.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i] as HTMLElement;
      if (
        child.classList.contains('gengage-chat-panel-topbar') ||
        child.classList.contains('gengage-chat-panel-ai-zone') ||
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
    this._destroyLoadingBinding(this._panelLoadingBinding);
    this._panelLoadingBinding = null;
    this._dividerEl.classList.remove('gengage-chat-panel-divider--hidden');
    this._panelEl.innerHTML = '';
    this._resetPanelAiZoneElement();
    this._panelEl.appendChild(this._panelTopBar.getElement());
    this._panelEl.appendChild(this._panelAiZoneEl);
    const skeleton = document.createElement('div');
    skeleton.className = 'gengage-chat-panel-skeleton';
    const panelSequence =
      contentType === 'comparisonTable' ? this.i18n.loadingSequenceComparison : this.i18n.loadingSequencePanel;
    const { root: panelStatus, binding: panelBinding } = this._createLoadingSequence(
      'panel',
      this._thinkingSteps.length > 0 ? this._thinkingSteps.slice(-3) : panelSequence,
      'panel-loading-status',
      'gengage-chat-panel-loading-status',
    );
    this._panelLoadingBinding = panelBinding;

    switch (contentType) {
      case 'productDetails': {
        skeleton.appendChild(panelStatus);
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
        skeleton.appendChild(panelStatus);
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
        skeleton.classList.add('gengage-chat-panel-skeleton--comparison');
        skeleton.appendChild(panelStatus);
        const root = document.createElement('div');
        root.className = 'gengage-chat-comparison gengage-chat-comparison--skeleton';
        root.setAttribute('aria-busy', 'true');

        // Önerilen seçim kartı — gerçek .gengage-chat-comparison-recommended ile aynı kutu
        const rec = document.createElement('div');
        rec.className = 'gengage-chat-comparison-recommended';
        const recLabel = document.createElement('div');
        recLabel.className = 'gengage-chat-comparison-skeleton-shimmer gengage-chat-comparison-skeleton-rec-label';
        rec.appendChild(recLabel);
        const recBody = document.createElement('div');
        recBody.className = 'gengage-chat-comparison-recommended-body';
        const recImg = document.createElement('div');
        recImg.className = 'gengage-chat-comparison-skeleton-shimmer gengage-chat-comparison-skeleton-rec-img';
        recImg.setAttribute('aria-hidden', 'true');
        const recInfo = document.createElement('div');
        recInfo.className = 'gengage-chat-comparison-recommended-info';
        for (let i = 0; i < 2; i++) {
          const t = document.createElement('div');
          t.className = 'gengage-chat-comparison-skeleton-shimmer gengage-chat-comparison-skeleton-rec-title';
          if (i === 1) t.classList.add('gengage-chat-comparison-skeleton-rec-title--short');
          recInfo.appendChild(t);
        }
        const recPrice = document.createElement('div');
        recPrice.className = 'gengage-chat-comparison-skeleton-shimmer gengage-chat-comparison-skeleton-rec-price';
        recInfo.appendChild(recPrice);
        recBody.appendChild(recImg);
        recBody.appendChild(recInfo);
        rec.appendChild(recBody);
        const hl = document.createElement('div');
        hl.className = 'gengage-chat-comparison-highlights';
        const hlLab = document.createElement('div');
        hlLab.className = 'gengage-chat-comparison-skeleton-shimmer gengage-chat-comparison-skeleton-hl-label';
        hl.appendChild(hlLab);
        const hlUl = document.createElement('ul');
        hlUl.className = 'gengage-chat-comparison-skeleton-hl-list';
        for (let i = 0; i < 3; i++) {
          const li = document.createElement('li');
          const line = document.createElement('div');
          line.className = 'gengage-chat-comparison-skeleton-shimmer gengage-chat-comparison-skeleton-hl-line';
          if (i === 1) line.classList.add('gengage-chat-comparison-skeleton-hl-line--medium');
          if (i === 2) line.classList.add('gengage-chat-comparison-skeleton-hl-line--short');
          li.appendChild(line);
          hlUl.appendChild(li);
        }
        hl.appendChild(hlUl);
        rec.appendChild(hl);
        root.appendChild(rec);

        // Temel farklar — .gengage-chat-comparison-key-differences
        const kd = document.createElement('div');
        kd.className = 'gengage-chat-comparison-key-differences';
        const kdH = document.createElement('div');
        kdH.className = 'gengage-chat-comparison-skeleton-shimmer gengage-chat-comparison-skeleton-kd-heading';
        kd.appendChild(kdH);
        const kdContent = document.createElement('div');
        kdContent.className = 'gengage-chat-comparison-key-differences-content';
        for (let i = 0; i < 4; i++) {
          const line = document.createElement('div');
          line.className = 'gengage-chat-comparison-skeleton-shimmer gengage-chat-comparison-skeleton-kd-line';
          kdContent.appendChild(line);
        }
        kd.appendChild(kdContent);
        root.appendChild(kd);

        // Özel durumlar çubuğu — gerçek special ile aynı dolgu/kenar
        const special = document.createElement('div');
        special.className = 'gengage-chat-comparison-special gengage-chat-comparison-special--skeleton';
        const specialInner = document.createElement('div');
        specialInner.className =
          'gengage-chat-comparison-skeleton-shimmer gengage-chat-comparison-skeleton-special-line';
        special.appendChild(specialInner);
        root.appendChild(special);

        // Tablo özeti — thead (görsel + isim + fiyat) + birkaç attribute satırı
        const tableWrap = document.createElement('div');
        tableWrap.className = 'gengage-chat-comparison-skeleton-table-wrap';
        const thead = document.createElement('div');
        thead.className = 'gengage-chat-comparison-skeleton-table-head';
        const corner = document.createElement('div');
        corner.className = 'gengage-chat-comparison-skeleton-table-corner';
        thead.appendChild(corner);
        for (let c = 0; c < 3; c++) {
          const col = document.createElement('div');
          col.className = 'gengage-chat-comparison-skeleton-table-col';
          const thImg = document.createElement('div');
          thImg.className = 'gengage-chat-comparison-skeleton-shimmer gengage-chat-comparison-skeleton-table-th-img';
          const thName = document.createElement('div');
          thName.className = 'gengage-chat-comparison-skeleton-shimmer gengage-chat-comparison-skeleton-table-th-name';
          const thPrice = document.createElement('div');
          thPrice.className =
            'gengage-chat-comparison-skeleton-shimmer gengage-chat-comparison-skeleton-table-th-price';
          col.appendChild(thImg);
          col.appendChild(thName);
          col.appendChild(thPrice);
          thead.appendChild(col);
        }
        tableWrap.appendChild(thead);
        for (let r = 0; r < 3; r++) {
          const row = document.createElement('div');
          row.className = 'gengage-chat-comparison-skeleton-table-row';
          const labelCell = document.createElement('div');
          labelCell.className = 'gengage-chat-comparison-skeleton-shimmer gengage-chat-comparison-skeleton-table-label';
          row.appendChild(labelCell);
          for (let c = 0; c < 3; c++) {
            const cell = document.createElement('div');
            cell.className = 'gengage-chat-comparison-skeleton-shimmer gengage-chat-comparison-skeleton-table-cell';
            row.appendChild(cell);
          }
          tableWrap.appendChild(row);
        }
        root.appendChild(tableWrap);

        skeleton.appendChild(root);
        break;
      }
      default: {
        skeleton.appendChild(panelStatus);
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
    this._panelEl.appendChild(this._thumbnailsColumn.getElement());
    this._panelEl.appendChild(this._panelFloatingEl);
    if (!this._panelVisible) {
      this._panelVisible = true;
      this._panelEl.classList.add('gengage-chat-panel--visible');
      this.root.classList.add('gengage-chat-drawer--with-panel');
    }
    this._syncDividerPreview();
    this._emitHostShellSync();
  }

  /** Update the panel top bar navigation state. */
  updatePanelTopBar(canBack: boolean, canForward: boolean, title: string): void {
    // On mobile the back button always closes the side-panel overlay, so keep it active
    const isMobile = this._options.getMobileViewport?.() ?? false;
    this._panelTopBar.update(isMobile ? true : canBack, canForward, title);
    const contentEl = this.getPanelContentElement();
    if (contentEl) {
      this._syncPanelTopBarTitleFromContent(contentEl);
    }
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
    this._destroyLoadingBinding(this._panelLoadingBinding);
    this._panelLoadingBinding = null;
    this._destroyLoadingBinding(this._panelAiZoneLoadingBinding);
    this._panelAiZoneLoadingBinding = null;
    this._panelEl.innerHTML = '';
    this._resetPanelAiZoneElement();
    this._panelEl.appendChild(this._panelTopBar.getElement());
    this._panelEl.appendChild(this._panelAiZoneEl);
    this._panelEl.appendChild(this._thumbnailsColumn.getElement());
    this._panelEl.appendChild(this._panelFloatingEl);
    this._panelTopBar.setActions(null);
    this._panelVisible = false;
    this._panelEl.classList.remove('gengage-chat-panel--visible', 'gengage-chat-panel--collapsed');
    this.root.classList.remove('gengage-chat-drawer--with-panel');
    this._dividerEl.classList.add('gengage-chat-panel-divider--hidden');
    this._dividerPreviewEnabled = false;
    this._syncDividerPreview();
    if (this._reopenPanelBtn) this._reopenPanelBtn.style.display = 'none';
    this.setComparisonDockContent(null);
    this._emitHostShellSync();
  }

  /**
   * Mobile-only slot (see CSS): pins the comparison dock above panel scroll.
   * Pass null to clear.
   */
  setComparisonDockContent(el: HTMLElement | null): void {
    this._comparisonDockSlotEl.replaceChildren();
    if (el) this._comparisonDockSlotEl.appendChild(el);
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
    this._emitHostShellSync();
  }

  private _showMobilePanelFromBtn(): void {
    if (this._panelVisible) return;
    this._panelVisible = true;
    this._panelEl.classList.add('gengage-chat-panel--visible');
    if (this._reopenPanelBtn) this._reopenPanelBtn.style.display = 'none';
    this._emitHostShellSync();
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
    this._syncDividerPreview();
    this._emitHostShellSync();
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
    this._syncDividerPreview();
    this._emitHostShellSync();
  }

  /**
   * After new list/grid content is mounted, scroll the left panel toward the top smoothly.
   * InnerHTML resets scrollTop to 0, so we nudge down first; a rAF tween (ease-out quint) replaces
   * native smooth scroll for a softer deceleration.
   */
  private _smoothScrollPanelListToTop(): void {
    const panel = this._panelEl;
    const reduceMotion =
      typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false);

    if (reduceMotion) {
      panel.scrollTop = 0;
      return;
    }

    this._panelListScrollAnimToken += 1;
    const token = this._panelListScrollAnimToken;

    requestAnimationFrame(() => {
      if (token !== this._panelListScrollAnimToken) return;
      const maxScroll = Math.max(0, panel.scrollHeight - panel.clientHeight);
      if (maxScroll <= 0) return;

      const startTop = Math.min(160, Math.max(48, maxScroll * 0.28));
      panel.scrollTop = startTop;

      const durationMs = Math.min(720, Math.max(380, 320 + Math.sqrt(startTop) * 28));
      const t0 = performance.now();

      const easeOutQuint = (t: number) => 1 - (1 - t) ** 5;

      const step = (now: number) => {
        if (token !== this._panelListScrollAnimToken) return;
        const elapsed = now - t0;
        const linear = Math.min(1, elapsed / durationMs);
        const eased = easeOutQuint(linear);
        panel.scrollTop = startTop * (1 - eased);
        if (linear < 1) {
          requestAnimationFrame(step);
        } else {
          panel.scrollTop = 0;
        }
      };
      requestAnimationFrame(step);
    });
  }

  /** Update scroll affordance (bottom fade gradient) on the panel. */
  private _updateScrollAffordance(): void {
    const panel = this._panelEl;
    const atBottom = panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 10;
    panel.classList.toggle('gengage-chat-panel--has-scroll', !atBottom && panel.scrollHeight > panel.clientHeight);
    panel.classList.toggle('gengage-chat-panel--scrolled', panel.scrollTop > 88);
  }

  /** Horizontal swipe on conversation/panel areas to toggle the panel (mobile only). */
  private _setupHorizontalSwipe(el: HTMLElement): void {
    let startX = 0;
    let startY = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (!(this._options.getMobileViewport?.() ?? window.innerWidth <= 768)) return;
      const t = e.touches[0];
      if (!t) return;
      startX = t.clientX;
      startY = t.clientY;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!(this._options.getMobileViewport?.() ?? window.innerWidth <= 768)) return;
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
    this._syncDividerPreview();
  }

  setDividerPreviewEnabled(enabled: boolean): void {
    this._dividerPreviewEnabled = enabled;
    this._syncDividerPreview();
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

  private _createLoadingSequence(
    variant: 'chat' | 'panel',
    steps: string[],
    part: string,
    className: string,
  ): { root: HTMLElement; binding: LoadingSequenceBinding } {
    const root = document.createElement('div');
    root.className = `${className} gds-progress-loader ${variant === 'chat' ? 'gds-progress-loader-chat' : 'gds-progress-loader-panel'}`;
    root.dataset['gengagePart'] = part;
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');

    const label = document.createElement('span');
    label.className =
      variant === 'chat'
        ? 'gengage-chat-typing-text gds-progress-label'
        : 'gengage-chat-panel-loading-label gds-progress-label';
    root.appendChild(label);

    const dots = document.createElement('span');
    dots.className = variant === 'chat' ? 'gengage-chat-typing-dots gds-progress-dots' : 'gds-progress-dots';
    dots.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('span');
      dot.className = 'gds-progress-dot';
      dots.appendChild(dot);
    }
    root.appendChild(dots);

    const binding: LoadingSequenceBinding = {
      labelEl: label,
      steps: [],
      index: 0,
      intervalId: null,
    };
    this._applyLoadingSteps(binding, steps);
    return { root, binding };
  }

  private _applyLoadingSteps(binding: LoadingSequenceBinding, steps: string[], forceLatest = false): void {
    const normalized = steps
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(-3);
    const fallback = [this.i18n.loadingMessage];
    binding.steps = normalized.length > 0 ? normalized : fallback;
    this._clearLoadingBindingInterval(binding);
    binding.index = forceLatest ? binding.steps.length - 1 : 0;
    binding.labelEl.textContent = binding.steps[binding.index]!;

    if (!forceLatest && binding.steps.length > 1) {
      binding.intervalId = setInterval(() => {
        if (binding.index >= binding.steps.length - 1) {
          this._clearLoadingBindingInterval(binding);
          return;
        }
        binding.index += 1;
        binding.labelEl.textContent = binding.steps[binding.index]!;
        if (binding.index >= binding.steps.length - 1) {
          this._clearLoadingBindingInterval(binding);
        }
      }, LOADING_STEP_INTERVAL_MS);
    }
  }

  private _clearLoadingBindingInterval(binding: LoadingSequenceBinding | null): void {
    if (binding?.intervalId) {
      clearInterval(binding.intervalId);
      binding.intervalId = null;
    }
  }

  private _destroyLoadingBinding(binding: LoadingSequenceBinding | null): void {
    this._clearLoadingBindingInterval(binding);
  }

  private _updateSendEnabled(): void {
    if (this._sendStopHandler) {
      this.sendBtn.disabled = false;
      return;
    }
    const hasContent = this.inputEl.value.trim().length > 0 || this._pendingAttachment !== null;
    this.sendBtn.disabled = !hasContent;
  }

  private _renderSendButtonIcon(mode: 'send' | 'stop'): void {
    this.sendBtn.innerHTML =
      mode === 'stop'
        ? '<span class="gengage-chat-send-stop-icon" aria-hidden="true"></span>'
        : `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;
  }

  private _submit(): void {
    const text = this.inputEl.value.trim();
    const attachment = this._pendingAttachment;
    if (this._sendStopHandler) {
      const onStop = this._sendStopHandler;
      this.hideStopButton();
      onStop();
      if (!text && !attachment) return;
    } else if (!text && !attachment) {
      return;
    }
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
    if (!force && this._options.presentation?.shouldBlockSoftAutoScroll?.()) return;
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
  updateBotMessage(
    messageId: string,
    html: string,
    renderHint?: string,
    photoAnalysis?: {
      summary: string;
      strengths?: string[];
      focusPoints?: string[];
      celebStyle?: string;
      celebStyleReason?: string;
      nextQuestion?: string;
    },
  ): void {
    const bubble = this.messagesEl.querySelector(`[data-message-id="${escapeCssIdentifier(messageId)}"]`);
    if (!bubble) return;
    let textEl = bubble.querySelector('.gengage-chat-bubble-text');
    if (!textEl) {
      textEl = document.createElement('div');
      textEl.className = 'gengage-chat-bubble-text';
      bubble.appendChild(textEl);
    }
    if (renderHint === 'photo_analysis') {
      bubble.classList.add('gengage-chat-bubble--photo-analysis');
      this._renderPhotoAnalysisCard(textEl as HTMLElement, photoAnalysis);
    } else {
      bubble.classList.remove('gengage-chat-bubble--photo-analysis');
      textEl.innerHTML = sanitizeHtml(html);
    }
    this._scrollToBottom(false);
  }

  /** Mark a message as the first bot message in its thread (for special styling). */
  markFirstBotMessage(messageId: string): void {
    this._firstBotMessageIds.add(messageId);
    const bubble = this.messagesEl.querySelector(`[data-message-id="${escapeCssIdentifier(messageId)}"]`);
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
    this._programmaticScrollUntil = Date.now() + 700;
    const target = this.messagesEl.querySelector(`[data-thread-id="${escapeCssIdentifier(lastThreadId)}"]`);
    if (target) {
      requestAnimationFrame(() => {
        target.scrollIntoView({ block: 'start', behavior: 'auto' });
        this._userScrolledUp = false;
      });
    } else {
      this._scrollToBottom(true);
    }
  }

  /**
   * Smooth scroll transcript so the given thread’s first bubble is near the top.
   * Used by centralized presentation scroll requests.
   */
  scrollThreadIntoView(threadId: string, behavior: ScrollBehavior = 'smooth'): boolean {
    const matches = this.messagesEl.querySelectorAll(`[data-thread-id="${escapeCssIdentifier(threadId)}"]`);
    let target: HTMLElement | null = null;
    for (let i = 0; i < matches.length; i++) {
      const el = matches[i];
      if (!(el instanceof HTMLElement)) continue;
      if (el.classList.contains('gengage-chat-bubble--presentation-collapsed')) continue;
      target = el;
      break;
    }
    if (!target && matches.length > 0 && matches[0] instanceof HTMLElement) {
      target = matches[0];
    }
    if (!target) return false;
    const topInset = 20;
    const nextTop = Math.max(target.offsetTop - topInset, 0);
    this._programmaticScrollUntil = Date.now() + 700;
    this._scrollMessagesTo(nextTop, behavior);
    return true;
  }

  /** Programmatic scroll to bottom (e.g. host bridge) — bypasses “user scrolled up” until next frame. */
  scrollToBottomPresentation(behavior: ScrollBehavior = 'smooth'): void {
    this._programmaticScrollUntil = Date.now() + 700;
    requestAnimationFrame(() => {
      this._scrollMessagesTo(this.messagesEl.scrollHeight, behavior);
      this._userScrolledUp = false;
    });
  }

  private _scrollMessagesTo(top: number, behavior: ScrollBehavior): void {
    if (typeof this.messagesEl.scrollTo === 'function') {
      this.messagesEl.scrollTo({ top, behavior });
      return;
    }
    this.messagesEl.scrollTop = top;
  }

  /** Collapse transcript to a single thread (null = show full history). */
  setPresentationFocus(threadId: string | null): void {
    this._presentationFocusThreadId = threadId;
    this._applyPresentationCollapsed();
  }

  setFormerMessagesButtonVisible(visible: boolean): void {
    if (this._formerMessagesBtn) {
      this._formerMessagesBtn.style.display = visible ? '' : 'none';
    }
  }

  setInputPlaceholder(placeholder: string): void {
    this.inputEl.placeholder = placeholder;
  }

  private _applyPresentationCollapsed(): void {
    const focus = this._presentationFocusThreadId;
    this.messagesEl.querySelectorAll<HTMLElement>('[data-thread-id]').forEach((el) => {
      const tid = el.dataset['threadId'];
      if (!tid) return;
      if (focus && tid !== focus) {
        el.classList.add('gengage-chat-bubble--presentation-collapsed');
      } else {
        el.classList.remove('gengage-chat-bubble--presentation-collapsed');
      }
    });
  }

  /** Call after inline chat DOM (e.g. ProductSummaryCard) is appended — reapplies thread collapse. */
  refreshPresentationCollapsed(): void {
    if (this._presentationFocusThreadId) {
      this._applyPresentationCollapsed();
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
      btn.className = 'gengage-chat-input-chip gds-chip';
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
    this._renderDividerPreview(entries);
    this._syncDividerPreview();
  }

  hideThumbnails(): void {
    this._thumbnailsColumn.hide();
    this._renderDividerPreview([]);
    this._syncDividerPreview();
  }

  private _renderDividerPreview(entries: ThumbnailEntry[]): void {
    this._dividerPreviewEl.innerHTML = '';

    const seen = new Set<string>();
    const previewEntries: ThumbnailEntry[] = [];
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (!entry || seen.has(entry.sku) || !isSafeImageUrl(entry.imageUrl)) continue;
      seen.add(entry.sku);
      previewEntries.push(entry);
      if (previewEntries.length >= 3) break;
    }
    previewEntries.reverse();

    for (const entry of previewEntries) {
      const thumb = document.createElement('span');
      thumb.className = 'gengage-chat-panel-divider-preview-thumb';
      const img = document.createElement('img');
      img.className = 'gengage-chat-panel-divider-preview-img';
      img.src = entry.imageUrl;
      img.alt = '';
      img.width = 48;
      img.height = 48;
      thumb.appendChild(img);
      this._dividerPreviewEl.appendChild(thumb);
    }
  }

  private _syncDividerPreview(): void {
    const hasPreview = this._dividerPreviewEl.childElementCount > 0;
    const isActive =
      this._dividerPreviewEnabled &&
      hasPreview &&
      this._panelCollapsed &&
      !this._dividerEl.classList.contains('gengage-chat-panel-divider--hidden');
    this._dividerEl.classList.toggle('gengage-chat-panel-divider--preview-active', isActive);
  }

  /** Activate focus trap — Tab/Shift+Tab cycles within the drawer. */
  trapFocus(): void {
    this._previouslyFocusedElement = document.activeElement as HTMLElement | null;
    this.releaseFocus();

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = Array.from(
        this.root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => {
        const styles = getComputedStyle(el);
        if (el.hidden || el.getAttribute('aria-hidden') === 'true') return false;
        if (styles.display === 'none' || styles.visibility === 'hidden') return false;
        return el.getClientRects().length > 0;
      });
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      const composedTarget =
        e.composedPath().find((node): node is HTMLElement => node instanceof HTMLElement && this.root.contains(node)) ??
        null;
      const rootNode = this.root.getRootNode();
      const activeCandidate =
        composedTarget ??
        (rootNode instanceof ShadowRoot && rootNode.activeElement instanceof HTMLElement
          ? rootNode.activeElement
          : document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null);
      const active = activeCandidate && this.root.contains(activeCandidate) ? activeCandidate : null;

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

  /** Briefly animate the cart icon button to signal a successful add-to-cart. */
  flashCartBadge(): void {
    if (!this._cartBtn) return;
    // Restart animation by removing then re-adding the class after a reflow
    this._cartBtn.classList.remove('gengage-chat-header-btn--cart-flash');
    void this._cartBtn.offsetWidth;
    this._cartBtn.classList.add('gengage-chat-header-btn--cart-flash');
    this._cartBtn.addEventListener(
      'animationend',
      () => {
        this._cartBtn?.classList.remove('gengage-chat-header-btn--cart-flash');
      },
      { once: true },
    );
  }

  /** Show a temporary success toast inside the shadow root. */
  showCartToast(message: string): void {
    const existing = this.root.querySelector('.gengage-chat-cart-toast');
    existing?.remove();
    const toast = document.createElement('div');
    toast.className = 'gengage-chat-cart-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.textContent = message;
    this.root.appendChild(toast);
    // Force reflow then add visible class for animation
    void toast.offsetWidth;
    toast.classList.add('gengage-chat-cart-toast--visible');
    setTimeout(() => {
      toast.classList.remove('gengage-chat-cart-toast--visible');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  /** Clean up event listeners and child resources (VoiceInput, timers). */
  destroy(): void {
    registerChatScrollElement(null);
    this.releaseFocus();
    if (this._resizeRafId !== null) {
      cancelAnimationFrame(this._resizeRafId);
      this._resizeRafId = null;
    }
    this._destroyLoadingBinding(this._typingLoadingBinding);
    this._typingLoadingBinding = null;
    this._destroyLoadingBinding(this._panelLoadingBinding);
    this._panelLoadingBinding = null;
    this._destroyLoadingBinding(this._panelAiZoneLoadingBinding);
    this._panelAiZoneLoadingBinding = null;
    this._closeAttachMenu();
    for (const cleanup of this._cleanups) cleanup();
    this._cleanups.length = 0;
    this._voiceInput?.destroy();
    this._voiceInput = null;
  }
}

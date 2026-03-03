/**
 * Tests for 500ms first-open scroll lockout.
 *
 * When session history is restored from IndexedDB, auto-scroll is suppressed
 * for 500ms to prevent a visual jump as messages are replayed into the DOM.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChatDrawer } from '../src/chat/components/ChatDrawer.js';
import type { ChatMessage } from '../src/chat/types.js';

function makeI18n() {
  return {
    headerTitle: 'Test',
    inputPlaceholder: 'Type...',
    sendButton: 'Send',
    closeButton: 'Close',
    openButton: 'Open',
    newChatButton: 'New',
    poweredBy: 'Powered by Test',
    errorMessage: 'Error',
    loadingMessage: 'Loading...',
    productCtaLabel: 'View',
    attachImageButton: 'Attach',
    removeAttachmentButton: 'Remove',
    invalidFileType: 'Invalid',
    fileTooLarge: 'Too large',
    aiTopPicksTitle: 'Top Picks',
    roleWinner: 'Winner',
    roleBestValue: 'Best Value',
    roleBestAlternative: 'Alternative',
    viewDetails: 'Details',
    groundingReviewCta: 'Read Reviews',
    variantsLabel: 'Variants',
    sortRelated: 'Related',
    sortPriceAsc: 'Price ↑',
    sortPriceDesc: 'Price ↓',
    compareSelected: 'Compare',
    panelTitleProductDetails: 'Product Details',
    panelTitleSimilarProducts: 'Similar Products',
    panelTitleComparisonResults: 'Comparison',
    panelTitleCategories: 'Categories',
    inStockLabel: 'In Stock',
    outOfStockLabel: 'Out of Stock',
    findSimilarLabel: 'Find Similar',
    viewMoreLabel: 'Show More',
    similarProductsLabel: 'Similar Products',
    choicePrompterHeading: "Can't decide?",
    choicePrompterSuggestion: 'Select products to compare them',
    choicePrompterCta: 'Select & Compare',
  };
}

function createDrawer() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const drawer = new ChatDrawer(container, {
    i18n: makeI18n(),
    onSend: vi.fn(),
    onClose: vi.fn(),
  });
  return { drawer, container };
}

function makeChatMessage(role: 'user' | 'assistant', content: string, id?: string): ChatMessage {
  return {
    id: id ?? `msg-${Date.now()}`,
    role,
    content,
    timestamp: Date.now(),
    status: 'done',
  };
}

describe('500ms first-open scroll lockout', () => {
  let dateNowSpy: ReturnType<typeof vi.spyOn>;
  let rafSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dateNowSpy = vi.spyOn(Date, 'now');
    // Flush rAF calls synchronously for testability
    rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
    rafSpy.mockRestore();
    document.body.innerHTML = '';
  });

  it('lockScrollForRestore sets a 500ms lock window', () => {
    dateNowSpy.mockReturnValue(1000);
    const { drawer } = createDrawer();
    drawer.lockScrollForRestore();

    // During lockout, scrollToBottomIfNeeded should not scroll
    dateNowSpy.mockReturnValue(1200); // 200ms into lockout
    const el = drawer.getElement();
    const messagesEl = el.querySelector('.gengage-chat-messages') as HTMLElement;

    // Fake scrollable content
    Object.defineProperty(messagesEl, 'scrollHeight', { value: 1000, configurable: true });
    messagesEl.scrollTop = 0;

    drawer.scrollToBottomIfNeeded();
    expect(messagesEl.scrollTop).toBe(0);
  });

  it('_scrollToBottom does not scroll during lockout period (via addMessage)', () => {
    dateNowSpy.mockReturnValue(1000);
    const { drawer } = createDrawer();
    drawer.lockScrollForRestore();

    dateNowSpy.mockReturnValue(1300); // 300ms — still locked

    const el = drawer.getElement();
    const messagesEl = el.querySelector('.gengage-chat-messages') as HTMLElement;
    Object.defineProperty(messagesEl, 'scrollHeight', { value: 1000, configurable: true });
    messagesEl.scrollTop = 0;

    // Assistant messages use force=false in addMessage
    const msg = makeChatMessage('assistant', 'Restored message');
    drawer.addMessage(msg);

    expect(messagesEl.scrollTop).toBe(0);
  });

  it('force=true ignores lockout (user messages still scroll)', () => {
    dateNowSpy.mockReturnValue(1000);
    const { drawer } = createDrawer();
    drawer.lockScrollForRestore();

    dateNowSpy.mockReturnValue(1200); // 200ms — still locked

    const el = drawer.getElement();
    const messagesEl = el.querySelector('.gengage-chat-messages') as HTMLElement;
    Object.defineProperty(messagesEl, 'scrollHeight', { value: 1000, configurable: true });
    messagesEl.scrollTop = 0;

    // User messages call _scrollToBottom(true) via addMessage(role='user')
    const msg = makeChatMessage('user', 'Hello');
    drawer.addMessage(msg);

    // force=true should bypass lockout — scrollTop should be set to scrollHeight
    expect(messagesEl.scrollTop).toBe(1000);
  });

  it('after 500ms, auto-scroll resumes normally', () => {
    dateNowSpy.mockReturnValue(1000);
    const { drawer } = createDrawer();
    drawer.lockScrollForRestore();

    // Advance past lockout
    dateNowSpy.mockReturnValue(1501); // 501ms — lockout expired

    const el = drawer.getElement();
    const messagesEl = el.querySelector('.gengage-chat-messages') as HTMLElement;
    Object.defineProperty(messagesEl, 'scrollHeight', { value: 1000, configurable: true });
    messagesEl.scrollTop = 0;

    drawer.scrollToBottomIfNeeded();
    expect(messagesEl.scrollTop).toBe(1000);
  });

  it('scrollToBottomIfNeeded also respects lockout', () => {
    dateNowSpy.mockReturnValue(2000);
    const { drawer } = createDrawer();
    drawer.lockScrollForRestore();

    // During lockout
    dateNowSpy.mockReturnValue(2400); // 400ms — still locked

    const el = drawer.getElement();
    const messagesEl = el.querySelector('.gengage-chat-messages') as HTMLElement;
    Object.defineProperty(messagesEl, 'scrollHeight', { value: 500, configurable: true });
    messagesEl.scrollTop = 0;

    drawer.scrollToBottomIfNeeded();
    expect(messagesEl.scrollTop).toBe(0);

    // After lockout expires
    dateNowSpy.mockReturnValue(2501);
    drawer.scrollToBottomIfNeeded();
    expect(messagesEl.scrollTop).toBe(500);
  });

  it('without lockScrollForRestore, scrollToBottomIfNeeded works immediately', () => {
    dateNowSpy.mockReturnValue(5000);
    const { drawer } = createDrawer();

    const el = drawer.getElement();
    const messagesEl = el.querySelector('.gengage-chat-messages') as HTMLElement;
    Object.defineProperty(messagesEl, 'scrollHeight', { value: 800, configurable: true });
    messagesEl.scrollTop = 0;

    drawer.scrollToBottomIfNeeded();
    expect(messagesEl.scrollTop).toBe(800);
  });
});

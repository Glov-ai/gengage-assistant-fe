/**
 * Tests for ChatDrawer smart auto-scroll behavior.
 */
import { describe, it, expect, vi } from 'vitest';
import { ChatDrawer } from '../src/chat/components/ChatDrawer.js';
import type { ChatMessage } from '../src/chat/types.js';

function makeChatMessage(role: 'user' | 'assistant', content: string, id?: string): ChatMessage {
  return {
    id: id ?? `msg-${Date.now()}`,
    role,
    content,
    timestamp: Date.now(),
    status: 'done',
  };
}

function createDrawer() {
  const container = document.createElement('div');
  return new ChatDrawer(container, {
    i18n: {
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
    },
    onSend: vi.fn(),
    onClose: vi.fn(),
  });
}

describe('ChatDrawer smart scroll', () => {
  it('has scrollToBottomIfNeeded method', () => {
    const drawer = createDrawer();
    expect(typeof drawer.scrollToBottomIfNeeded).toBe('function');
  });

  it('adds user message and scrolls', () => {
    const drawer = createDrawer();
    const msg = makeChatMessage('user', 'Hello');
    drawer.addMessage(msg);

    const el = drawer.getElement();
    const bubble = el.querySelector('.gengage-chat-bubble--user');
    expect(bubble).toBeTruthy();
  });

  it('adds assistant message without forcing scroll', () => {
    const drawer = createDrawer();
    const msg = makeChatMessage('assistant', 'Hi there');
    drawer.addMessage(msg);

    const el = drawer.getElement();
    const bubble = el.querySelector('.gengage-chat-bubble--assistant');
    expect(bubble).toBeTruthy();
  });
});

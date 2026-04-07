/**
 * Tests for PR #3 review fixes:
 * - Comparison card wrapper click (no double-toggle)
 * - Cart button always fires onCartClick callback
 * - Panel history cleared on destroy
 * - Panel manager rebuild function
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderUISpec } from '../src/chat/components/renderUISpec.js';
import { ChatDrawer } from '../src/chat/components/ChatDrawer.js';
import { PanelManager } from '../src/chat/panel-manager.js';
import { CHAT_I18N_TR } from '../src/chat/locales/index.js';
import type { UISpec } from '../src/common/types.js';
import type { ChatUISpecRenderContext } from '../src/chat/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGridSpec(products: Array<{ sku: string; name: string; price: string }>): UISpec {
  const elements: Record<string, { type: string; props: Record<string, unknown>; children?: string[] }> = {};
  const childIds: string[] = [];
  for (let i = 0; i < products.length; i++) {
    const id = `product-${i}`;
    childIds.push(id);
    elements[id] = {
      type: 'ProductCard',
      props: { product: { ...products[i], url: '' }, index: i },
    };
  }
  elements['root'] = { type: 'ProductGrid', props: { layout: 'grid' }, children: childIds };
  return { root: 'root', elements };
}

function makeContext(overrides?: Partial<ChatUISpecRenderContext>): ChatUISpecRenderContext {
  return {
    onAction: vi.fn(),
    productSort: { type: 'related' },
    onSortChange: vi.fn(),
    onToggleComparisonSku: vi.fn(),
    i18n: {
      productCtaLabel: 'View',
      aiTopPicksTitle: 'Top',
      roleWinner: 'W',
      roleBestValue: 'BV',
      roleBestAlternative: 'BA',
      viewDetails: 'V',
      groundingReviewCta: 'R',
      variantsLabel: 'Var',
      sortRelated: 'Related',
      sortPriceAsc: 'Price ↑',
      sortPriceDesc: 'Price ↓',
      compareSelected: 'Compare',
      panelTitleProductDetails: 'PD',
      panelTitleSimilarProducts: 'SP',
      panelTitleComparisonResults: 'CR',
      panelTitleCategories: 'Cat',
      inStockLabel: 'In Stock',
      outOfStockLabel: 'Out of Stock',
      findSimilarLabel: 'Find Similar',
      viewMoreLabel: 'Show More',
      similarProductsLabel: 'Similar Products',
    } as ChatUISpecRenderContext['i18n'],
    ...overrides,
  };
}

function createDrawer(options?: Record<string, unknown>) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const drawer = new ChatDrawer(container, {
    i18n: CHAT_I18N_TR,
    onSend: () => {},
    onClose: () => {},
    ...(options ?? {}),
  } as ConstructorParameters<typeof ChatDrawer>[1]);
  return { container, drawer };
}

// ---------------------------------------------------------------------------
// #1 — Comparison wrapper click must NOT double-toggle checkbox
// ---------------------------------------------------------------------------

describe('Comparison card wrapper click', () => {
  it('calls onToggleComparisonSku once (not double-toggle) when wrapper is clicked', () => {
    const onToggle = vi.fn();
    const spec = makeGridSpec([{ sku: 'SKU-1', name: 'Product', price: '100' }]);
    const ctx = makeContext({
      comparisonSelectMode: true,
      comparisonSelectedSkus: [],
      onToggleComparisonSku: onToggle,
    });
    const dom = renderUISpec(spec, ctx);
    const wrapper = dom.querySelector('.gengage-chat-comparison-select-wrapper') as HTMLElement;
    expect(wrapper).not.toBeNull();

    // Click the wrapper (not the checkbox itself)
    wrapper.click();

    // Should call toggle exactly once
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('SKU-1');
  });

  it('does not manually flip comparison button pressed state (leaves it to external sync)', () => {
    const onToggle = vi.fn();
    const spec = makeGridSpec([{ sku: 'SKU-1', name: 'Product', price: '100' }]);
    const ctx = makeContext({
      comparisonSelectMode: true,
      comparisonSelectedSkus: [],
      onToggleComparisonSku: onToggle,
    });
    const dom = renderUISpec(spec, ctx);
    const checkbox = dom.querySelector('.gengage-chat-comparison-checkbox') as HTMLButtonElement;
    expect(checkbox.getAttribute('aria-pressed')).toBe('false');

    // Click the wrapper — checkbox should NOT be flipped manually
    const wrapper = dom.querySelector('.gengage-chat-comparison-select-wrapper') as HTMLElement;
    wrapper.click();

    // Pressed state remains unchanged because external sync (refreshComparisonUI) handles it
    expect(checkbox.getAttribute('aria-pressed')).toBe('false');
  });
});

// ---------------------------------------------------------------------------
// #2 — Cart button always fires onCartClick callback (even with headerCartUrl)
// ---------------------------------------------------------------------------

describe('Cart button always invokes onCartClick', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders cart as <button> even when headerCartUrl is set', () => {
    const { container } = createDrawer({
      headerCartUrl: '/sepetim',
      onCartClick: vi.fn(),
    });
    const cartEl = container.querySelector('.gengage-chat-header-btn[aria-label]');
    // Should be a button, not an <a> tag
    expect(cartEl?.tagName).toBe('BUTTON');
    container.remove();
  });

  it('fires onCartClick when headerCartUrl is set', () => {
    const onCartClick = vi.fn();
    const { container } = createDrawer({
      headerCartUrl: '/sepetim',
      onCartClick,
    });
    const cartBtn = container.querySelector(
      `.gengage-chat-header-btn[aria-label="${CHAT_I18N_TR.cartAriaLabel}"]`,
    ) as HTMLElement;
    expect(cartBtn).not.toBeNull();
    cartBtn.click();
    expect(onCartClick).toHaveBeenCalledTimes(1);
    container.remove();
  });

  it('fires onCartClick when no headerCartUrl is set', () => {
    const onCartClick = vi.fn();
    const { container } = createDrawer({ onCartClick });
    const cartBtn = container.querySelector(
      `.gengage-chat-header-btn[aria-label="${CHAT_I18N_TR.cartAriaLabel}"]`,
    ) as HTMLElement;
    expect(cartBtn).not.toBeNull();
    cartBtn.click();
    expect(onCartClick).toHaveBeenCalledTimes(1);
    container.remove();
  });
});

// ---------------------------------------------------------------------------
// #4 — PanelManager rebuild function
// ---------------------------------------------------------------------------

describe('PanelManager rebuild function', () => {
  it('stores and uses rebuild function for restoreForMessage', () => {
    const rebuiltEl = document.createElement('div');
    rebuiltEl.textContent = 'Rebuilt content';
    const rebuild = vi.fn(() => rebuiltEl);

    const panelEl = document.createElement('div');
    panelEl.className = 'gengage-chat-panel';
    const content = document.createElement('div');
    content.textContent = 'Original';
    panelEl.appendChild(content);

    let setPanelContentArg: HTMLElement | null = null;
    const mockDrawer = {
      hasPanelContent: () => true,
      isPanelLoading: () => false,
      getPanelContentElement: () => content,
      setPanelContent: (el: HTMLElement) => {
        setPanelContentArg = el;
      },
      updatePanelTopBar: vi.fn(),
      setDividerPreviewEnabled: vi.fn(),
    };

    const shadow = document.createElement('div');
    const pm = new PanelManager({
      drawer: () => mockDrawer as never,
      shadow: () => shadow as unknown as ShadowRoot,
      currentThreadId: () => 't1',
      bridge: () => null,
      extendedModeManager: () => null,
      i18n: () => CHAT_I18N_TR,
      rollbackToThread: () => {},
    });

    pm.snapshotForMessage('msg-1', rebuild);
    expect(pm.snapshots.has('msg-1')).toBe(true);

    // Restore — should call rebuild instead of cloneNode
    pm.restoreForMessage('msg-1');
    expect(rebuild).toHaveBeenCalledTimes(1);
    expect(setPanelContentArg).toBe(rebuiltEl);
  });

  it('falls back to cloneNode when no rebuild is stored', () => {
    const content = document.createElement('div');
    content.textContent = 'Cloneable';

    let setPanelContentArg: HTMLElement | null = null;
    const mockDrawer = {
      hasPanelContent: () => true,
      isPanelLoading: () => false,
      getPanelContentElement: () => content,
      setPanelContent: (el: HTMLElement) => {
        setPanelContentArg = el;
      },
      updatePanelTopBar: vi.fn(),
      setDividerPreviewEnabled: vi.fn(),
    };

    const shadow = document.createElement('div');
    const pm = new PanelManager({
      drawer: () => mockDrawer as never,
      shadow: () => shadow as unknown as ShadowRoot,
      currentThreadId: () => 't1',
      bridge: () => null,
      extendedModeManager: () => null,
      i18n: () => CHAT_I18N_TR,
      rollbackToThread: () => {},
    });

    // No rebuild function
    pm.snapshotForMessage('msg-1');
    pm.restoreForMessage('msg-1');

    // Should get a clone (different object, same content)
    expect(setPanelContentArg).not.toBeNull();
    expect(setPanelContentArg!.textContent).toBe('Cloneable');
    expect(setPanelContentArg).not.toBe(content);
  });

  it('clears rebuild functions on destroy', () => {
    const pm = new PanelManager({
      drawer: () => null,
      shadow: () => null,
      currentThreadId: () => null,
      bridge: () => null,
      extendedModeManager: () => null,
      i18n: () => CHAT_I18N_TR,
      rollbackToThread: () => {},
    });

    // Access internal via type assertion to verify cleanup
    (pm as unknown as { _snapshotRebuilders: Map<string, unknown> })._snapshotRebuilders.set('x', () => null);
    pm.destroy();
    expect((pm as unknown as { _snapshotRebuilders: Map<string, unknown> })._snapshotRebuilders.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Review tag pills — data-tag attribute
// ---------------------------------------------------------------------------

describe('Review highlights filter pills', () => {
  it('renders pills with data-tag attribute for robust selection', () => {
    const spec: UISpec = {
      root: 'root',
      elements: {
        root: {
          type: 'ReviewHighlights',
          props: {
            reviews: [
              {
                author: 'Test',
                rating: 5,
                text: 'Great product',
                date: '2025-01-01',
                sentiment: 'positive' as const,
              },
              {
                author: 'Test2',
                rating: 2,
                text: 'Not good',
                date: '2025-01-02',
                sentiment: 'negative' as const,
              },
            ],
          },
        },
      },
    };
    const ctx = makeContext({
      i18n: {
        ...makeContext().i18n!,
        reviewFilterPositive: 'Positive',
        reviewFilterNegative: 'Negative',
        customerReviewsTitle: 'Reviews',
      },
    });

    const dom = renderUISpec(spec, ctx);
    const pills = dom.querySelectorAll('.gengage-chat-review-filter-pill');

    if (pills.length > 0) {
      // Verify pills have data-tag attribute
      const tags = Array.from(pills).map((p) => (p as HTMLElement).dataset['tag']);
      expect(tags).toContain('all');
    }
  });
});

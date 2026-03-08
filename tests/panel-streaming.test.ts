/**
 * Integration tests for panel content streaming behavior.
 *
 * Verifies that when new panel UISpecs arrive during streaming,
 * the panel content is correctly replaced or appended based on context.
 * These tests caught the regression where search results were appended
 * to old panel content instead of replacing it (c519146 panel preservation).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChatDrawer } from '../src/chat/components/ChatDrawer.js';
import { CHAT_I18N_EN } from '../src/chat/locales/en.js';
import { determinePanelUpdateAction } from '../src/chat/panel-manager.js';
import type { PanelUpdateAction } from '../src/chat/panel-manager.js';

let container: HTMLElement;
let drawer: ChatDrawer;

function createDrawer(): ChatDrawer {
  container = document.createElement('div');
  document.body.appendChild(container);
  return new ChatDrawer(container, {
    i18n: CHAT_I18N_EN,
    onSend: vi.fn(),
    onClose: vi.fn(),
  });
}

function makeContent(id: string): HTMLElement {
  const el = document.createElement('div');
  el.className = `panel-content-${id}`;
  el.textContent = id;
  return el;
}

/**
 * Simulate the panel update logic from index.ts onUISpec handler.
 * This mirrors the exact branching in the production code.
 */
function applyPanelUpdate(
  d: ChatDrawer,
  content: HTMLElement,
  action: PanelUpdateAction,
): void {
  switch (action) {
    case 'appendSimilars':
    case 'append':
      d.appendPanelContent(content);
      break;
    case 'replace':
      d.setPanelContent(content);
      break;
  }
}

beforeEach(() => {
  document.body.innerHTML = '';
  drawer = createDrawer();
});

afterEach(() => {
  container?.remove();
});

describe('Panel streaming: content transitions', () => {
  // -----------------------------------------------------------------------
  // Scenario 1: Search results must REPLACE previous product details
  // -----------------------------------------------------------------------

  it('search results (ProductGrid) replace previous ProductDetailsPanel', () => {
    // Stream 1: product details shown
    const productDetails = makeContent('product-details');
    drawer.setPanelContent(productDetails);
    expect(drawer.hasPanelContent()).toBe(true);

    // Stream 2: user types a search query, ProductGrid arrives as first panel content
    const action = determinePanelUpdateAction({
      componentType: 'ProductGrid',
      similarsAppend: false,
      currentPanelType: 'ProductDetailsPanel',
      hasPanelContent: drawer.hasPanelContent(),
      isPanelLoading: drawer.isPanelLoading(),
      isFirstPanelContentInStream: true,
    });

    const searchResults = makeContent('search-results');
    applyPanelUpdate(drawer, searchResults, action);

    // Old product details must be GONE, search results visible
    const el = drawer.getElement();
    expect(el.querySelector('.panel-content-product-details')).toBeNull();
    expect(el.querySelector('.panel-content-search-results')).not.toBeNull();
  });

  // -----------------------------------------------------------------------
  // Scenario 2: ComparisonTable must REPLACE previous content
  // -----------------------------------------------------------------------

  it('ComparisonTable replaces previous ProductGrid (search results)', () => {
    // Stream 1: search results shown
    const searchResults = makeContent('search-results');
    drawer.setPanelContent(searchResults);

    // Stream 2: comparison requested, ComparisonTable arrives
    const action = determinePanelUpdateAction({
      componentType: 'ComparisonTable',
      similarsAppend: false,
      currentPanelType: 'ProductGrid',
      hasPanelContent: drawer.hasPanelContent(),
      isPanelLoading: drawer.isPanelLoading(),
      isFirstPanelContentInStream: true,
    });

    const comparisonTable = makeContent('comparison-table');
    applyPanelUpdate(drawer, comparisonTable, action);

    const el = drawer.getElement();
    expect(el.querySelector('.panel-content-search-results')).toBeNull();
    expect(el.querySelector('.panel-content-comparison-table')).not.toBeNull();
  });

  // -----------------------------------------------------------------------
  // Scenario 3: ProductDetailsPanel must REPLACE previous comparison table
  // -----------------------------------------------------------------------

  it('ProductDetailsPanel replaces previous ComparisonTable', () => {
    const comparisonTable = makeContent('comparison-table');
    drawer.setPanelContent(comparisonTable);

    const action = determinePanelUpdateAction({
      componentType: 'ProductDetailsPanel',
      similarsAppend: false,
      currentPanelType: 'ComparisonTable',
      hasPanelContent: drawer.hasPanelContent(),
      isPanelLoading: drawer.isPanelLoading(),
      isFirstPanelContentInStream: true,
    });

    const productDetails = makeContent('product-details');
    applyPanelUpdate(drawer, productDetails, action);

    const el = drawer.getElement();
    expect(el.querySelector('.panel-content-comparison-table')).toBeNull();
    expect(el.querySelector('.panel-content-product-details')).not.toBeNull();
  });

  // -----------------------------------------------------------------------
  // Scenario 4: Similar products APPEND after product details (same stream)
  // -----------------------------------------------------------------------

  it('similar products ProductGrid appends after ProductDetailsPanel in same stream', () => {
    // First UISpec in stream: product details
    const action1 = determinePanelUpdateAction({
      componentType: 'ProductDetailsPanel',
      similarsAppend: false,
      currentPanelType: null,
      hasPanelContent: false,
      isPanelLoading: false,
      isFirstPanelContentInStream: true,
    });
    expect(action1).toBe('replace');

    const productDetails = makeContent('product-details');
    applyPanelUpdate(drawer, productDetails, action1);

    // Second UISpec in same stream: similar products grid
    const action2 = determinePanelUpdateAction({
      componentType: 'ProductGrid',
      similarsAppend: false,
      currentPanelType: 'ProductDetailsPanel',
      hasPanelContent: drawer.hasPanelContent(),
      isPanelLoading: drawer.isPanelLoading(),
      isFirstPanelContentInStream: false, // second in stream
    });
    expect(action2).toBe('append');

    const similarProducts = makeContent('similar-products');
    applyPanelUpdate(drawer, similarProducts, action2);

    // Both must be present
    const el = drawer.getElement();
    expect(el.querySelector('.panel-content-product-details')).not.toBeNull();
    expect(el.querySelector('.panel-content-similar-products')).not.toBeNull();
  });

  // -----------------------------------------------------------------------
  // Scenario 5: Text-only answer preserves existing panel content
  // -----------------------------------------------------------------------

  it('text-only answer does not disturb existing panel content', () => {
    const productDetails = makeContent('product-details');
    drawer.setPanelContent(productDetails);

    // Stream 2: text-only answer — no panel UISpec arrives at all.
    // The panel manager is never called. Panel stays as-is.
    const el = drawer.getElement();
    expect(el.querySelector('.panel-content-product-details')).not.toBeNull();
    expect(drawer.hasPanelContent()).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Scenario 6: Loading skeleton is replaced by new content
  // -----------------------------------------------------------------------

  it('panel content replaces loading skeleton', () => {
    // panelLoading shows skeleton
    drawer.showPanelLoading('productList');
    expect(drawer.isPanelLoading()).toBe(true);

    // ProductGrid arrives
    const action = determinePanelUpdateAction({
      componentType: 'ProductGrid',
      similarsAppend: false,
      currentPanelType: null,
      hasPanelContent: drawer.hasPanelContent(),
      isPanelLoading: drawer.isPanelLoading(),
      isFirstPanelContentInStream: true,
    });
    expect(action).toBe('replace');

    const searchResults = makeContent('search-results');
    applyPanelUpdate(drawer, searchResults, action);

    expect(drawer.isPanelLoading()).toBe(false);
    expect(drawer.getElement().querySelector('.panel-content-search-results')).not.toBeNull();
  });

  // -----------------------------------------------------------------------
  // Scenario 7: productDetailsSimilars append via similarsAppend flag
  // -----------------------------------------------------------------------

  it('similarsAppend ProductGrid uses appendSimilars action', () => {
    // Product details already in panel
    const productDetails = makeContent('product-details');
    drawer.setPanelContent(productDetails);

    const action = determinePanelUpdateAction({
      componentType: 'ProductGrid',
      similarsAppend: true,
      currentPanelType: 'ProductDetailsPanel',
      hasPanelContent: drawer.hasPanelContent(),
      isPanelLoading: drawer.isPanelLoading(),
      isFirstPanelContentInStream: false,
    });
    expect(action).toBe('appendSimilars');
  });

  // -----------------------------------------------------------------------
  // Scenario 8: Rapid fire — two searches in a row
  // -----------------------------------------------------------------------

  it('second search replaces first search results', () => {
    // Stream 1: first search results
    const first = makeContent('first-search');
    drawer.setPanelContent(first);

    // Stream 2: second search — ProductGrid as first panel content
    const action = determinePanelUpdateAction({
      componentType: 'ProductGrid',
      similarsAppend: false,
      currentPanelType: 'ProductGrid',
      hasPanelContent: drawer.hasPanelContent(),
      isPanelLoading: drawer.isPanelLoading(),
      isFirstPanelContentInStream: true,
    });
    expect(action).toBe('replace');

    const second = makeContent('second-search');
    applyPanelUpdate(drawer, second, action);

    const el = drawer.getElement();
    expect(el.querySelector('.panel-content-first-search')).toBeNull();
    expect(el.querySelector('.panel-content-second-search')).not.toBeNull();
  });
});

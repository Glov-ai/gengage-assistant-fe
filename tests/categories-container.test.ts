import { describe, it, expect, vi } from 'vitest';
import { renderCategoriesContainer } from '../src/chat/components/CategoriesContainer.js';
import type { UIElement } from '../src/common/types.js';
import type { ChatUISpecRenderContext } from '../src/chat/types.js';

function makeContext(overrides?: Partial<ChatUISpecRenderContext>): ChatUISpecRenderContext {
  return {
    onAction: vi.fn(),
    ...overrides,
  };
}

function makeElement(props: Record<string, unknown>): UIElement {
  return { type: 'CategoriesContainer', props };
}

describe('renderCategoriesContainer', () => {
  it('renders tabs for each group', () => {
    const element = makeElement({
      groups: [
        { groupName: 'Electronics', products: [] },
        { groupName: 'Clothing', products: [] },
      ],
      filterTags: [],
    });
    const result = renderCategoriesContainer(element, makeContext());
    const tabs = result.querySelectorAll('.gengage-chat-categories-tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]!.textContent).toBe('Electronics');
    expect(tabs[1]!.textContent).toBe('Clothing');
  });

  it('first tab is active by default', () => {
    const element = makeElement({
      groups: [
        { groupName: 'A', products: [] },
        { groupName: 'B', products: [] },
      ],
      filterTags: [],
    });
    const result = renderCategoriesContainer(element, makeContext());
    const tabs = result.querySelectorAll('.gengage-chat-categories-tab');
    expect(tabs[0]!.classList.contains('gengage-chat-categories-tab--active')).toBe(true);
    expect(tabs[1]!.classList.contains('gengage-chat-categories-tab--active')).toBe(false);
  });

  it('switches active tab on click', () => {
    const element = makeElement({
      groups: [
        { groupName: 'A', products: [] },
        { groupName: 'B', products: [] },
      ],
      filterTags: [],
    });
    const result = renderCategoriesContainer(element, makeContext());
    const tabs = result.querySelectorAll('.gengage-chat-categories-tab');
    const grids = result.querySelectorAll('.gengage-chat-categories-grid') as NodeListOf<HTMLElement>;

    // Initially first grid visible, second hidden
    expect(grids[0]!.style.display).toBe('');
    expect(grids[1]!.style.display).toBe('none');

    // Click second tab
    (tabs[1] as HTMLElement).click();
    expect(tabs[1]!.classList.contains('gengage-chat-categories-tab--active')).toBe(true);
    expect(tabs[0]!.classList.contains('gengage-chat-categories-tab--active')).toBe(false);
    expect(grids[0]!.style.display).toBe('none');
    expect(grids[1]!.style.display).toBe('');
  });

  it('renders product cards per group', () => {
    const element = makeElement({
      groups: [
        {
          groupName: 'Group A',
          products: [
            { sku: 'P1', name: 'Product 1', url: '', price: '100' },
            { sku: 'P2', name: 'Product 2', url: '', price: '200' },
          ],
        },
        {
          groupName: 'Group B',
          products: [{ sku: 'P3', name: 'Product 3', url: '' }],
        },
      ],
      filterTags: [],
    });
    const result = renderCategoriesContainer(element, makeContext());
    const grids = result.querySelectorAll('.gengage-chat-categories-grid');
    expect(grids[0]!.querySelectorAll('.gengage-chat-product-card')).toHaveLength(2);
    expect(grids[1]!.querySelectorAll('.gengage-chat-product-card')).toHaveLength(1);
  });

  it('renders filter tags and fires action on click', () => {
    const onAction = vi.fn();
    const element = makeElement({
      groups: [{ groupName: 'G', products: [] }],
      filterTags: [
        { title: 'Budget', action: { title: 'Budget', type: 'filter', payload: { tag: 'budget' } } },
        { title: 'Premium' },
      ],
    });
    const result = renderCategoriesContainer(element, makeContext({ onAction }));
    const tags = result.querySelectorAll('.gengage-chat-categories-filter-tag');
    expect(tags).toHaveLength(2);
    expect(tags[0]!.textContent).toBe('Budget');
    expect(tags[1]!.textContent).toBe('Premium');

    // Click first tag fires action
    (tags[0] as HTMLElement).click();
    expect(onAction).toHaveBeenCalledWith({ title: 'Budget', type: 'filter', payload: { tag: 'budget' } });
  });

  it('returns empty container when no groups', () => {
    const element = makeElement({ groups: [], filterTags: [] });
    const result = renderCategoriesContainer(element, makeContext());
    expect(result.classList.contains('gengage-chat-categories')).toBe(true);
    expect(result.children).toHaveLength(0);
  });
});

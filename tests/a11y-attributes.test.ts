/**
 * Tests for a11y attributes on ChatDrawer and ComparisonTable components.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { ChatDrawer } from '../src/chat/components/ChatDrawer.js';
import { CHAT_I18N_TR } from '../src/chat/locales/index.js';
import { renderComparisonTable } from '../src/chat/components/ComparisonTable.js';

function createDrawer(options?: { showHeaderFavorites?: boolean; onFavoritesClick?: () => void }) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const drawer = new ChatDrawer(container, {
    i18n: CHAT_I18N_TR,
    onSend: () => {},
    onClose: () => {},
    showHeaderFavorites: options?.showHeaderFavorites,
    onFavoritesClick: options?.onFavoritesClick,
  });
  return { container, drawer };
}

describe('ChatDrawer a11y attributes', () => {
  let container: HTMLElement;
  let drawer: ChatDrawer;

  afterEach(() => {
    container?.remove();
  });

  it('showError() renders div with role="alert"', () => {
    ({ container, drawer } = createDrawer());
    drawer.showError('Something went wrong');
    const errorEl = container.querySelector('.gengage-chat-error');
    expect(errorEl).not.toBeNull();
    expect(errorEl?.getAttribute('role')).toBe('alert');
  });

  it('setPills() adds aria-describedby when pill has description', () => {
    ({ container, drawer } = createDrawer());
    drawer.setPills([
      {
        label: 'Find Similar',
        onAction: () => {},
        description: 'Search for similar products',
      },
    ]);
    const pillBtn = container.querySelector('.gengage-chat-pill') as HTMLElement;
    expect(pillBtn).not.toBeNull();

    const describedBy = pillBtn.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();

    const descSpan = container.querySelector(`#${describedBy}`);
    expect(descSpan).not.toBeNull();
    expect(descSpan?.textContent).toBe('Search for similar products');
  });

  it('favorite header button invokes onFavoritesClick', () => {
    const onFav = vi.fn();
    ({ container, drawer } = createDrawer({
      showHeaderFavorites: true,
      onFavoritesClick: onFav,
    }));

    const favBtn = container.querySelector(
      `button[aria-label="${CHAT_I18N_TR.favoritesAriaLabel}"]`,
    ) as HTMLButtonElement;
    expect(favBtn).not.toBeNull();

    favBtn.click();
    expect(onFav).toHaveBeenCalledTimes(1);
  });
});

describe('ComparisonTable a11y attributes', () => {
  it('comparison container has role="dialog" and aria-label', () => {
    const el = renderComparisonTable({
      recommended: { sku: 'ABC', name: 'Product A', price: '199 TL' },
      products: [],
      attributes: [],
      highlights: [],
      onProductClick: () => {},
    });
    expect(el.getAttribute('role')).toBe('dialog');
    expect(el.getAttribute('aria-label')).toBeTruthy();
  });
});

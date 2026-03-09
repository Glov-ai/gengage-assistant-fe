/**
 * FavoritesPage — renders the in-chat favorites panel.
 *
 * Shows saved/favorited products with image, name and price.
 * Each card has a remove-from-favorites button.
 * Fires onRemove(sku) so the caller can sync IDB + badge.
 *
 * XSS safety: all text is set via textContent; image src is validated externally.
 */

import type { FavoriteData } from '../session-persistence.js';
import { addImageErrorHandler } from '../../common/product-utils.js';
import { isSafeUrl, safeSetAttribute } from '../../common/safe-html.js';

export interface FavoritesPageOptions {
  favorites: FavoriteData[];
  emptyMessage?: string;
  onRemove: (sku: string) => void;
  onProductSelect?: (fav: FavoriteData) => void;
}

export function renderFavoritesPage(options: FavoritesPageOptions): HTMLElement {
  const page = document.createElement('div');
  page.className = 'gengage-chat-favorites-page';

  if (options.favorites.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'gengage-chat-favorites-empty';

    const icon = document.createElement('div');
    icon.className = 'gengage-chat-favorites-empty-icon';
    icon.innerHTML = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
    empty.appendChild(icon);

    const text = document.createElement('p');
    text.textContent = options.emptyMessage ?? 'No favorites yet.';
    empty.appendChild(text);

    page.appendChild(empty);
    return page;
  }

  const list = document.createElement('div');
  list.className = 'gengage-chat-favorites-list';

  for (const fav of options.favorites) {
    const card = document.createElement('div');
    card.className = 'gengage-chat-favorites-card';
    if (options.onProductSelect) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.gengage-chat-favorites-remove')) return;
        options.onProductSelect!(fav);
      });
    }

    // Image
    if (fav.imageUrl && isSafeUrl(fav.imageUrl)) {
      const imgWrap = document.createElement('div');
      imgWrap.className = 'gengage-chat-favorites-card__image';
      const img = document.createElement('img');
      img.loading = 'lazy';
      safeSetAttribute(img, 'src', fav.imageUrl);
      img.alt = fav.name ?? 'Product';
      addImageErrorHandler(img);
      imgWrap.appendChild(img);
      card.appendChild(imgWrap);
    }

    // Info
    const info = document.createElement('div');
    info.className = 'gengage-chat-favorites-card__info';

    if (fav.name) {
      const nameEl = document.createElement('div');
      nameEl.className = 'gengage-chat-favorites-card__name';
      nameEl.textContent = fav.name;
      info.appendChild(nameEl);
    }

    if (fav.price) {
      const priceEl = document.createElement('div');
      priceEl.className = 'gengage-chat-favorites-card__price';
      priceEl.textContent = fav.price;
      info.appendChild(priceEl);
    }

    card.appendChild(info);

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'gengage-chat-favorites-remove';
    removeBtn.setAttribute('aria-label', 'Remove from favorites');
    removeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      card.classList.add('gengage-chat-favorites-card--removing');
      setTimeout(() => {
        options.onRemove(fav.sku);
      }, 200);
    });
    card.appendChild(removeBtn);

    list.appendChild(card);
  }

  page.appendChild(list);
  return page;
}

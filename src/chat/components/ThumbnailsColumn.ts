/**
 * Vertical strip of product thumbnails along the right edge of the panel (results) pane.
 *
 * Clicking a thumbnail dispatches a rollback to the thread where that product was shown.
 */

import { isSafeImageUrl } from '../../common/safe-html.js';

export interface ThumbnailEntry {
  sku: string;
  imageUrl: string;
  threadId: string;
}

export interface ThumbnailsColumnOptions {
  onThumbnailClick: (threadId: string) => void;
}

export class ThumbnailsColumn {
  private readonly _el: HTMLElement;
  private readonly _onThumbnailClick: (threadId: string) => void;

  constructor(options: ThumbnailsColumnOptions) {
    this._onThumbnailClick = options.onThumbnailClick;

    this._el = document.createElement('div');
    this._el.className = 'gengage-chat-thumbnails-column';
    this._el.style.display = 'none';
  }

  getElement(): HTMLElement {
    return this._el;
  }

  setEntries(entries: ThumbnailEntry[]): void {
    // Deduplicate by SKU (keep first occurrence)
    const seen = new Set<string>();
    const unique: ThumbnailEntry[] = [];
    for (const entry of entries) {
      if (!seen.has(entry.sku)) {
        seen.add(entry.sku);
        unique.push(entry);
      }
    }

    this._el.innerHTML = '';

    for (const entry of unique) {
      const thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = 'gengage-chat-thumbnail-btn';
      thumb.title = entry.sku;

      if (isSafeImageUrl(entry.imageUrl)) {
        const img = document.createElement('img');
        img.className = 'gengage-chat-thumbnail-img';
        img.src = entry.imageUrl;
        img.alt = entry.sku;
        img.width = 40;
        img.height = 40;
        thumb.appendChild(img);
      }

      thumb.addEventListener('click', () => {
        this._onThumbnailClick(entry.threadId);
      });

      this._el.appendChild(thumb);
    }
  }

  show(): void {
    this._el.style.display = '';
  }

  hide(): void {
    this._el.style.display = 'none';
  }
}

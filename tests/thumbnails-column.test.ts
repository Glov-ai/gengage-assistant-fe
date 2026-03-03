/**
 * Tests for ThumbnailsColumn component.
 */

import { describe, it, expect, vi } from 'vitest';
import { ThumbnailsColumn } from '../src/chat/components/ThumbnailsColumn.js';
import type { ThumbnailEntry } from '../src/chat/components/ThumbnailsColumn.js';

describe('ThumbnailsColumn', () => {
  it('renders thumbnail buttons for each entry', () => {
    const onThumbnailClick = vi.fn();
    const col = new ThumbnailsColumn({ onThumbnailClick });

    const entries: ThumbnailEntry[] = [
      { sku: 'A', imageUrl: 'https://example.com/a.jpg', threadId: 'thread-1' },
      { sku: 'B', imageUrl: 'https://example.com/b.jpg', threadId: 'thread-2' },
    ];
    col.setEntries(entries);

    const el = col.getElement();
    const buttons = el.querySelectorAll('.gengage-chat-thumbnail-btn');
    expect(buttons).toHaveLength(2);

    const imgs = el.querySelectorAll('.gengage-chat-thumbnail-img') as NodeListOf<HTMLImageElement>;
    expect(imgs[0]!.src).toContain('example.com/a.jpg');
    expect(imgs[1]!.src).toContain('example.com/b.jpg');
  });

  it('dispatches threadId on click', () => {
    const onThumbnailClick = vi.fn();
    const col = new ThumbnailsColumn({ onThumbnailClick });

    col.setEntries([{ sku: 'X', imageUrl: 'https://example.com/x.jpg', threadId: 'thread-abc' }]);

    const btn = col.getElement().querySelector('.gengage-chat-thumbnail-btn') as HTMLElement;
    btn.click();
    expect(onThumbnailClick).toHaveBeenCalledWith('thread-abc');
  });

  it('deduplicates entries by SKU', () => {
    const col = new ThumbnailsColumn({ onThumbnailClick: vi.fn() });

    col.setEntries([
      { sku: 'DUP', imageUrl: 'https://example.com/1.jpg', threadId: 'thread-1' },
      { sku: 'DUP', imageUrl: 'https://example.com/2.jpg', threadId: 'thread-2' },
      { sku: 'OTHER', imageUrl: 'https://example.com/3.jpg', threadId: 'thread-3' },
    ]);

    const buttons = col.getElement().querySelectorAll('.gengage-chat-thumbnail-btn');
    expect(buttons).toHaveLength(2);
  });

  it('show/hide toggles display', () => {
    const col = new ThumbnailsColumn({ onThumbnailClick: vi.fn() });
    const el = col.getElement();

    // Initially hidden
    expect(el.style.display).toBe('none');

    col.show();
    expect(el.style.display).toBe('');

    col.hide();
    expect(el.style.display).toBe('none');
  });

  it('clears old entries when setEntries is called again', () => {
    const col = new ThumbnailsColumn({ onThumbnailClick: vi.fn() });

    col.setEntries([{ sku: 'A', imageUrl: 'https://example.com/a.jpg', threadId: 't1' }]);
    expect(col.getElement().querySelectorAll('.gengage-chat-thumbnail-btn')).toHaveLength(1);

    col.setEntries([
      { sku: 'B', imageUrl: 'https://example.com/b.jpg', threadId: 't2' },
      { sku: 'C', imageUrl: 'https://example.com/c.jpg', threadId: 't3' },
    ]);
    expect(col.getElement().querySelectorAll('.gengage-chat-thumbnail-btn')).toHaveLength(2);
  });
});

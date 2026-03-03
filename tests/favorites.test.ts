/**
 * Tests for Add to Favorites — IDB persistence and UI rendering.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { GengageIndexedDB } from '../src/common/indexed-db.js';
import type { FavoriteData } from '../src/common/indexed-db.js';
import type { UISpec } from '../src/common/types.js';
import { renderUISpec } from '../src/chat/components/renderUISpec.js';
import type { UISpecRenderContext } from '../src/chat/components/renderUISpec.js';

// ---------------------------------------------------------------------------
// IDB helpers
// ---------------------------------------------------------------------------

let testCounter = 0;
function uniqueDbName(): string {
  return `gengage_fav_test_${++testCounter}_${Date.now()}`;
}

// ---------------------------------------------------------------------------
// Favorites IDB
// ---------------------------------------------------------------------------

describe('Favorites IDB', () => {
  let db: GengageIndexedDB;

  beforeEach(async () => {
    db = new GengageIndexedDB(uniqueDbName(), 3);
    await db.open();
  });

  afterEach(() => {
    db.close();
  });

  it('v3 migration creates favorites store', async () => {
    const freshDb = new GengageIndexedDB(uniqueDbName(), 3);
    const idb = await freshDb.open();
    expect(idb.objectStoreNames.contains('favorites')).toBe(true);
    freshDb.close();
  });

  it('saveFavorite persists and isFavorite returns true', async () => {
    const fav: FavoriteData = {
      userId: 'user-1',
      appId: 'app-1',
      sku: 'SKU-001',
      name: 'Widget',
      imageUrl: 'https://img/w.jpg',
      price: '100',
      savedAt: '2025-01-01T00:00:00.000Z',
    };

    await db.saveFavorite(fav);
    const result = await db.isFavorite('user-1', 'app-1', 'SKU-001');
    expect(result).toBe(true);
  });

  it('removeFavorite deletes and isFavorite returns false', async () => {
    await db.saveFavorite({
      userId: 'user-1',
      appId: 'app-1',
      sku: 'SKU-002',
      savedAt: '2025-01-01T00:00:00.000Z',
    });

    await db.removeFavorite('user-1', 'app-1', 'SKU-002');
    const result = await db.isFavorite('user-1', 'app-1', 'SKU-002');
    expect(result).toBe(false);
  });

  it('loadFavorites returns only matching userId/appId entries', async () => {
    await db.saveFavorite({
      userId: 'alice',
      appId: 'store-a',
      sku: 'S1',
      savedAt: '2025-01-01T00:00:00.000Z',
    });
    await db.saveFavorite({
      userId: 'alice',
      appId: 'store-a',
      sku: 'S2',
      savedAt: '2025-01-01T00:00:01.000Z',
    });
    await db.saveFavorite({
      userId: 'bob',
      appId: 'store-a',
      sku: 'S3',
      savedAt: '2025-01-01T00:00:02.000Z',
    });
    await db.saveFavorite({
      userId: 'alice',
      appId: 'store-b',
      sku: 'S4',
      savedAt: '2025-01-01T00:00:03.000Z',
    });

    const aliceA = await db.loadFavorites('alice', 'store-a');
    expect(aliceA).toHaveLength(2);
    const skus = aliceA.map((f) => f.sku).sort();
    expect(skus).toEqual(['S1', 'S2']);

    const bobA = await db.loadFavorites('bob', 'store-a');
    expect(bobA).toHaveLength(1);
    expect(bobA[0]!.sku).toBe('S3');

    const nobody = await db.loadFavorites('charlie', 'store-a');
    expect(nobody).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

function makeContext(overrides: Partial<UISpecRenderContext> = {}): UISpecRenderContext {
  return {
    onAction: vi.fn(),
    onProductClick: vi.fn(),
    ...overrides,
  };
}

function productCardSpec(product: Record<string, unknown>): UISpec {
  return {
    root: 'root',
    elements: {
      root: {
        type: 'ProductCard',
        props: { product },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Favorites UI
// ---------------------------------------------------------------------------

describe('Favorites UI', () => {
  it('heart button rendered when onFavoriteToggle provided', () => {
    const spec = productCardSpec({
      sku: 'FAV-1',
      name: 'Favorite Test',
      imageUrl: 'https://example.com/img.jpg',
      price: '100',
      url: '/product/fav-1',
    });

    const result = renderUISpec(
      spec,
      makeContext({
        onFavoriteToggle: vi.fn(),
      }),
    );

    const heart = result.querySelector('.gengage-chat-favorite-btn');
    expect(heart).not.toBeNull();
    expect(heart!.getAttribute('aria-label')).toBe('Favorilere ekle');
  });

  it('heart click toggles active class', () => {
    const spec = productCardSpec({
      sku: 'FAV-2',
      name: 'Toggle Test',
      imageUrl: 'https://example.com/img.jpg',
      url: '/product/fav-2',
    });

    const result = renderUISpec(
      spec,
      makeContext({
        onFavoriteToggle: vi.fn(),
      }),
    );

    const heart = result.querySelector('.gengage-chat-favorite-btn') as HTMLButtonElement;
    expect(heart.classList.contains('gengage-chat-favorite-btn--active')).toBe(false);

    heart.click();
    expect(heart.classList.contains('gengage-chat-favorite-btn--active')).toBe(true);

    heart.click();
    expect(heart.classList.contains('gengage-chat-favorite-btn--active')).toBe(false);
  });

  it('heart click calls onFavoriteToggle with sku', () => {
    const onFavoriteToggle = vi.fn();
    const spec = productCardSpec({
      sku: 'FAV-3',
      name: 'Callback Test',
      imageUrl: 'https://example.com/img.jpg',
      url: '/product/fav-3',
    });

    const result = renderUISpec(spec, makeContext({ onFavoriteToggle }));

    const heart = result.querySelector('.gengage-chat-favorite-btn') as HTMLButtonElement;
    heart.click();

    expect(onFavoriteToggle).toHaveBeenCalledTimes(1);
    expect(onFavoriteToggle).toHaveBeenCalledWith('FAV-3', expect.objectContaining({ sku: 'FAV-3' }));
  });

  it('no heart rendered when onFavoriteToggle not provided', () => {
    const spec = productCardSpec({
      sku: 'FAV-4',
      name: 'No Heart Test',
      imageUrl: 'https://example.com/img.jpg',
      url: '/product/fav-4',
    });

    const result = renderUISpec(spec, makeContext());

    const heart = result.querySelector('.gengage-chat-favorite-btn');
    expect(heart).toBeNull();
  });

  it('heart starts active when sku is in favoritedSkus', () => {
    const spec = productCardSpec({
      sku: 'FAV-5',
      name: 'Pre-favorited',
      imageUrl: 'https://example.com/img.jpg',
      url: '/product/fav-5',
    });

    const favoritedSkus = new Set(['FAV-5']);
    const result = renderUISpec(
      spec,
      makeContext({
        favoritedSkus,
        onFavoriteToggle: vi.fn(),
      }),
    );

    const heart = result.querySelector('.gengage-chat-favorite-btn') as HTMLButtonElement;
    expect(heart.classList.contains('gengage-chat-favorite-btn--active')).toBe(true);

    // SVG fill should be 'currentColor' when active
    const svg = heart.querySelector('svg');
    expect(svg?.getAttribute('fill')).toBe('currentColor');
  });

  it('heart not rendered when product has no sku', () => {
    const spec = productCardSpec({
      name: 'No SKU Product',
      imageUrl: 'https://example.com/img.jpg',
      url: '/product/no-sku',
    });

    const result = renderUISpec(
      spec,
      makeContext({
        onFavoriteToggle: vi.fn(),
      }),
    );

    const heart = result.querySelector('.gengage-chat-favorite-btn');
    expect(heart).toBeNull();
  });

  it('heart not rendered when product has no image', () => {
    const spec = productCardSpec({
      sku: 'FAV-NO-IMG',
      name: 'No Image Product',
      url: '/product/no-img',
    });

    const result = renderUISpec(
      spec,
      makeContext({
        onFavoriteToggle: vi.fn(),
      }),
    );

    // No imgWrapper, so no heart
    const heart = result.querySelector('.gengage-chat-favorite-btn');
    expect(heart).toBeNull();
  });

  it('heart click stops event propagation', () => {
    const onProductSelect = vi.fn();
    const spec = productCardSpec({
      sku: 'FAV-PROP',
      name: 'Propagation Test',
      imageUrl: 'https://example.com/img.jpg',
      url: '/product/prop',
    });

    const result = renderUISpec(
      spec,
      makeContext({
        onFavoriteToggle: vi.fn(),
        onProductSelect,
      }),
    );

    const heart = result.querySelector('.gengage-chat-favorite-btn') as HTMLButtonElement;
    heart.click();

    // onProductSelect should NOT be called because click was stopped
    expect(onProductSelect).not.toHaveBeenCalled();
  });
});

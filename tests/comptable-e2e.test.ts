/**
 * ma-v2-comptable E2E smoke verification.
 *
 * Confirms that `comparisonTable` payloads round-trip correctly through the
 * V1 adapter: full payloads, edge cases (empty, single product, missing
 * optional fields), and V2 wire format compatibility.
 */

import { describe, it, expect } from 'vitest';
import { adaptV1Event } from '../src/common/v1-protocol-adapter.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type UISpecResult = {
  type: 'ui_spec';
  widget: string;
  panelHint?: string;
  spec: {
    root: string;
    elements: Record<string, { type: string; props?: Record<string, unknown> }>;
  };
};

function adaptAndAssertComparisonTable(raw: Record<string, unknown>): UISpecResult {
  const result = adaptV1Event(raw);
  expect(result).not.toBeNull();
  expect(result!.type).toBe('ui_spec');
  const uiSpec = result as UISpecResult;
  expect(uiSpec.spec.elements['root']!.type).toBe('ComparisonTable');
  expect(uiSpec.panelHint).toBe('panel');
  expect(uiSpec.widget).toBe('chat');
  return uiSpec;
}

function getComparisonProps(uiSpec: UISpecResult): Record<string, unknown> {
  return uiSpec.spec.elements['root']!.props!;
}

// ---------------------------------------------------------------------------
// Full payload round-trip
// ---------------------------------------------------------------------------

describe('comparisonTable: full payload round-trip', () => {
  const fullPayload = {
    type: 'comparisonTable',
    payload: {
      multiple_product_details: [
        {
          sku: 'SKU-A1',
          name: 'Bosch Matkap 500W',
          brand: 'Bosch',
          price: 1299.99,
          price_discounted: 999.99,
          url: 'https://example.com/bosch-500w',
          images: ['https://cdn.example.com/bosch-500w-1.jpg', 'https://cdn.example.com/bosch-500w-2.jpg'],
          rating: 4.5,
          review_count: 128,
          cart_code: 'CART-A1',
          in_stock: true,
        },
        {
          sku: 'SKU-B2',
          name: 'Makita Matkap 700W',
          brand: 'Makita',
          price: 1599.99,
          url: 'https://example.com/makita-700w',
          images: ['https://cdn.example.com/makita-700w-1.jpg'],
          rating: 4.8,
          review_count: 256,
          cart_code: 'CART-B2',
          in_stock: true,
        },
        {
          sku: 'SKU-C3',
          name: 'DeWalt Matkap 600W',
          brand: 'DeWalt',
          price: 1499.99,
          price_discounted: 1199.99,
          url: 'https://example.com/dewalt-600w',
          images: ['https://cdn.example.com/dewalt-600w-1.jpg'],
          rating: 4.3,
          review_count: 64,
          in_stock: false,
        },
      ],
      table: {
        power: ['500W', '700W', '600W'],
        weight: ['1.8 kg', '2.2 kg', '2.0 kg'],
        warranty: ['2 yil', '3 yil', '2 yil'],
      },
      features_list: ['power', 'weight', 'warranty'],
      product_comparison_framework: {
        key_differences: ['Makita daha guclu motor', 'Bosch daha hafif', 'DeWalt indirimli'],
        recommended_choice: 'Bosch en iyi fiyat/performans oranina sahip',
        recommended_choice_sku: 'SKU-A1',
        special_considerations: ['Agir isler icin Makita onerilir', 'Stok durumunu kontrol edin'],
        criteria_view: { power: 'Guc', weight: 'Agirlik', warranty: 'Garanti' },
        criteria_view_short: { power: 'W', weight: 'kg', warranty: 'Gar.' },
        compared_field_names: ['power', 'weight', 'warranty'],
        winner_product: [{ sku: 'SKU-A1', name: 'Bosch Matkap 500W' }],
        winner_hits: {
          'SKU-A1': { positive: ['En hafif', 'En uygun fiyat'] },
          'SKU-B2': { positive: ['En guclu', 'En yuksek puan'], negative: ['En pahali'] },
          'SKU-C3': { positive: ['Indirimli'], negative: ['Stokta yok'] },
        },
      },
    },
  };

  it('produces a ComparisonTable ui_spec with correct product count', () => {
    const uiSpec = adaptAndAssertComparisonTable(fullPayload);
    const props = getComparisonProps(uiSpec);
    const products = props['products'] as Array<Record<string, unknown>>;
    expect(products).toHaveLength(3);
  });

  it('normalizes product fields correctly', () => {
    const uiSpec = adaptAndAssertComparisonTable(fullPayload);
    const props = getComparisonProps(uiSpec);
    const products = props['products'] as Array<Record<string, unknown>>;

    // First product (Bosch) has discount
    const bosch = products[0]!;
    expect(bosch['sku']).toBe('SKU-A1');
    expect(bosch['name']).toBe('Bosch Matkap 500W');
    expect(bosch['price']).toBe('999.99'); // discounted
    expect(bosch['originalPrice']).toBe('1299.99');
    expect(bosch['imageUrl']).toBe('https://cdn.example.com/bosch-500w-1.jpg');
    expect(bosch['url']).toBe('https://example.com/bosch-500w');
    expect(bosch['rating']).toBe(4.5);
    expect(bosch['reviewCount']).toBe(128);
    expect(bosch['cartCode']).toBe('CART-A1');
    expect(bosch['inStock']).toBe(true);

    // Second product (Makita) no discount
    const makita = products[1]!;
    expect(makita['sku']).toBe('SKU-B2');
    expect(makita['price']).toBe('1599.99');
    expect(makita['originalPrice']).toBeUndefined();
  });

  it('builds attributes table from table + criteria_view', () => {
    const uiSpec = adaptAndAssertComparisonTable(fullPayload);
    const props = getComparisonProps(uiSpec);
    const attributes = props['attributes'] as Array<{ label: string; values: string[] }>;

    expect(attributes).toHaveLength(3);
    expect(attributes[0]).toEqual({ label: 'Guc', values: ['500W', '700W', '600W'] });
    expect(attributes[1]).toEqual({ label: 'Agirlik', values: ['1.8 kg', '2.2 kg', '2.0 kg'] });
    expect(attributes[2]).toEqual({ label: 'Garanti', values: ['2 yil', '3 yil', '2 yil'] });
  });

  it('identifies the recommended product by sku', () => {
    const uiSpec = adaptAndAssertComparisonTable(fullPayload);
    const props = getComparisonProps(uiSpec);
    const recommended = props['recommended'] as Record<string, unknown>;
    expect(recommended['sku']).toBe('SKU-A1');
    expect(recommended['name']).toBe('Bosch Matkap 500W');
  });

  it('preserves highlights (key_differences array)', () => {
    const uiSpec = adaptAndAssertComparisonTable(fullPayload);
    const props = getComparisonProps(uiSpec);
    expect(props['highlights']).toEqual(['Makita daha guclu motor', 'Bosch daha hafif', 'DeWalt indirimli']);
  });

  it('preserves specialCases and recommendedText', () => {
    const uiSpec = adaptAndAssertComparisonTable(fullPayload);
    const props = getComparisonProps(uiSpec);
    expect(props['specialCases']).toEqual(['Agir isler icin Makita onerilir', 'Stok durumunu kontrol edin']);
    expect(props['recommendedText']).toBe('Bosch en iyi fiyat/performans oranina sahip');
  });

  it('preserves winnerHits per product', () => {
    const uiSpec = adaptAndAssertComparisonTable(fullPayload);
    const props = getComparisonProps(uiSpec);
    const winnerHits = props['winnerHits'] as Record<string, { positive?: string[]; negative?: string[] }>;
    expect(winnerHits['SKU-A1']!.positive).toEqual(['En hafif', 'En uygun fiyat']);
    expect(winnerHits['SKU-B2']!.negative).toEqual(['En pahali']);
    expect(winnerHits['SKU-C3']!.negative).toEqual(['Stokta yok']);
  });

  it('builds productActions for each product', () => {
    const uiSpec = adaptAndAssertComparisonTable(fullPayload);
    const props = getComparisonProps(uiSpec);
    const productActions = props['productActions'] as Record<string, Record<string, unknown>>;
    expect(productActions['SKU-A1']).toBeDefined();
    expect(productActions['SKU-A1']!['type']).toBe('launchSingleProduct');
    expect(productActions['SKU-B2']).toBeDefined();
    expect(productActions['SKU-C3']).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('comparisonTable: edge cases', () => {
  it('handles empty products array', () => {
    const uiSpec = adaptAndAssertComparisonTable({
      type: 'comparisonTable',
      payload: {
        multiple_product_details: [],
      },
    });
    const props = getComparisonProps(uiSpec);
    const products = props['products'] as Array<Record<string, unknown>>;
    expect(products).toHaveLength(0);
    // Recommended defaults to first product (undefined if empty)
    expect(props['recommended']).toBeUndefined();
  });

  it('handles single product', () => {
    const uiSpec = adaptAndAssertComparisonTable({
      type: 'comparisonTable',
      payload: {
        multiple_product_details: [{ sku: 'SOLO', name: 'Only Product', price: 500, url: 'https://example.com/solo' }],
      },
    });
    const props = getComparisonProps(uiSpec);
    const products = props['products'] as Array<Record<string, unknown>>;
    expect(products).toHaveLength(1);
    expect(products[0]!['sku']).toBe('SOLO');
    // Recommended defaults to the single product
    const recommended = props['recommended'] as Record<string, unknown>;
    expect(recommended['sku']).toBe('SOLO');
  });

  it('handles products with missing optional fields (no images, no price, no specs)', () => {
    const uiSpec = adaptAndAssertComparisonTable({
      type: 'comparisonTable',
      payload: {
        multiple_product_details: [
          { sku: 'BARE-1', name: 'Bare Product 1' },
          { sku: 'BARE-2', name: 'Bare Product 2' },
        ],
      },
    });
    const props = getComparisonProps(uiSpec);
    const products = props['products'] as Array<Record<string, unknown>>;
    expect(products).toHaveLength(2);
    expect(products[0]!['imageUrl']).toBeUndefined();
    expect(products[0]!['price']).toBeUndefined();
    expect(products[0]!['rating']).toBeUndefined();
    expect(products[0]!['url']).toBe(''); // url defaults to empty string
  });

  it('handles missing table (no attributes)', () => {
    const uiSpec = adaptAndAssertComparisonTable({
      type: 'comparisonTable',
      payload: {
        multiple_product_details: [
          { sku: 'P1', name: 'A', price: 100, url: 'https://example.com/a' },
          { sku: 'P2', name: 'B', price: 200, url: 'https://example.com/b' },
        ],
      },
    });
    const props = getComparisonProps(uiSpec);
    expect(props['attributes']).toEqual([]);
  });

  it('handles missing product_comparison_framework', () => {
    const uiSpec = adaptAndAssertComparisonTable({
      type: 'comparisonTable',
      payload: {
        multiple_product_details: [{ sku: 'P1', name: 'A', price: 100, url: 'https://example.com/a' }],
        table: { color: ['Red'] },
      },
    });
    const props = getComparisonProps(uiSpec);
    // Attributes should still work from table alone
    expect(props['attributes']).toEqual([{ label: 'color', values: ['Red'] }]);
    // No recommended text or highlights
    expect(props['highlights']).toEqual([]);
    expect(props['recommendedText']).toBeUndefined();
    expect(props['specialCases']).toBeUndefined();
    expect(props['winnerHits']).toBeUndefined();
  });

  it('handles recommended_choice_sku that does not match any product', () => {
    const uiSpec = adaptAndAssertComparisonTable({
      type: 'comparisonTable',
      payload: {
        multiple_product_details: [
          { sku: 'P1', name: 'A', price: 100, url: 'https://example.com/a' },
          { sku: 'P2', name: 'B', price: 200, url: 'https://example.com/b' },
        ],
        product_comparison_framework: {
          recommended_choice_sku: 'NONEXISTENT',
        },
      },
    });
    const props = getComparisonProps(uiSpec);
    // Falls back to first product when SKU is not found
    const recommended = props['recommended'] as Record<string, unknown>;
    expect(recommended['sku']).toBe('P1');
  });

  it('uses winner_product[0].sku as fallback when recommended_choice_sku is absent', () => {
    const uiSpec = adaptAndAssertComparisonTable({
      type: 'comparisonTable',
      payload: {
        multiple_product_details: [
          { sku: 'P1', name: 'A', price: 100, url: 'https://example.com/a' },
          { sku: 'P2', name: 'B', price: 200, url: 'https://example.com/b' },
        ],
        product_comparison_framework: {
          winner_product: [{ sku: 'P2', name: 'B' }],
        },
      },
    });
    const props = getComparisonProps(uiSpec);
    const recommended = props['recommended'] as Record<string, unknown>;
    expect(recommended['sku']).toBe('P2');
  });

  it('handles missing multiple_product_details field', () => {
    const uiSpec = adaptAndAssertComparisonTable({
      type: 'comparisonTable',
      payload: {},
    });
    const props = getComparisonProps(uiSpec);
    const products = props['products'] as Array<Record<string, unknown>>;
    expect(products).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// V2 wire format compatibility
// ---------------------------------------------------------------------------

describe('comparisonTable: V2 wire format', () => {
  it('adapts comparisonTable with version:"v2" correctly', () => {
    const raw = {
      type: 'comparisonTable',
      payload: {
        multiple_product_details: [
          { sku: 'V2-A', name: 'V2 Product A', price: 100, url: 'https://example.com/v2-a' },
          { sku: 'V2-B', name: 'V2 Product B', price: 200, url: 'https://example.com/v2-b' },
        ],
        table: {
          color: ['Red', 'Blue'],
        },
        product_comparison_framework: {
          recommended_choice_sku: 'V2-B',
          key_differences: ['Color preference'],
          compared_field_names: ['color'],
          criteria_view: { color: 'Renk' },
        },
      },
      version: 'v2',
      messageId: 'msg-comp-1',
      threadId: 'thread-42',
      from: 'assistant',
    };

    const uiSpec = adaptAndAssertComparisonTable(raw);
    const props = getComparisonProps(uiSpec);

    const products = props['products'] as Array<Record<string, unknown>>;
    expect(products).toHaveLength(2);

    const recommended = props['recommended'] as Record<string, unknown>;
    expect(recommended['sku']).toBe('V2-B');

    const attributes = props['attributes'] as Array<{ label: string; values: string[] }>;
    expect(attributes).toEqual([{ label: 'Renk', values: ['Red', 'Blue'] }]);

    expect(props['highlights']).toEqual(['Color preference']);
  });

  it('V2 wire fields do not leak into comparison props', () => {
    const raw = {
      type: 'comparisonTable',
      payload: {
        multiple_product_details: [{ sku: 'X1', name: 'X', price: 50, url: 'https://example.com/x' }],
      },
      version: 'v2',
      messageId: 'msg-leak-test',
    };

    const uiSpec = adaptAndAssertComparisonTable(raw);
    const props = getComparisonProps(uiSpec);
    // version and messageId should NOT appear in the comparison props
    expect(props['version']).toBeUndefined();
    expect(props['messageId']).toBeUndefined();
  });
});

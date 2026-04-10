import { describe, it, expect } from 'vitest';
import { mergeStandaloneFindSimilarIntoQuickPills } from '../src/qna/normalize-ui-specs.js';
import type { UISpec } from '../src/common/types.js';
import { QNA_I18N_TR } from '../src/qna/locales/tr.js';

describe('mergeStandaloneFindSimilarIntoQuickPills', () => {
  it('drops standalone findSimilar ActionButton and prepends pill to ActionButtons row', () => {
    const hero: UISpec = {
      root: 'root',
      elements: {
        root: {
          type: 'ActionButton',
          props: {
            label: 'Buna benzer ürünler buldum',
            action: { title: 'Buna benzer ürünler buldum', type: 'findSimilar', payload: { sku: 'SKU1' } },
          },
        },
      },
    };
    const pills: UISpec = {
      root: 'root',
      elements: {
        root: {
          type: 'ActionButtons',
          props: {
            buttons: [
              {
                label: 'Soru 1?',
                action: { title: 'Soru 1?', type: 'user_message', payload: 'Soru 1?' },
              },
            ],
          },
          children: ['action-0'],
        },
        'action-0': {
          type: 'ActionButton',
          props: {
            label: 'Soru 1?',
            action: { title: 'Soru 1?', type: 'user_message', payload: 'Soru 1?' },
          },
        },
      },
    };

    const out = mergeStandaloneFindSimilarIntoQuickPills([hero, pills], QNA_I18N_TR, {
      skuList: ['SKU-PDP-1'],
    });
    expect(out).toHaveLength(1);
    const root = out[0]!.elements[out[0]!.root];
    expect(root?.type).toBe('ActionButtons');
    const buttons = root?.props?.['buttons'] as Array<{
      label: string;
      action: { type: string; payload?: Record<string, unknown> };
    }>;
    expect(buttons?.[0]?.label).toBe(QNA_I18N_TR.productContextQuickPillLabel);
    expect(buttons?.[0]?.action?.type).toBe('user_message');
    expect(buttons?.[0]?.action?.payload).toMatchObject({
      text: QNA_I18N_TR.productContextQuickPillLabel,
      sku_list: ['SKU-PDP-1'],
    });
    expect(buttons?.[1]?.label).toBe('Soru 1?');
  });

  it('omits sku_list when options.skuList is not provided', () => {
    const hero: UISpec = {
      root: 'root',
      elements: {
        root: {
          type: 'ActionButton',
          props: {
            label: 'Similar',
            action: { title: 'Similar', type: 'findSimilar', payload: { sku: 'SKU1' } },
          },
        },
      },
    };
    const pills: UISpec = {
      root: 'root',
      elements: {
        root: {
          type: 'ButtonRow',
          children: ['a1'],
        },
        a1: {
          type: 'ActionButton',
          props: {
            label: 'Q?',
            action: { title: 'Q?', type: 'user_message', payload: 'Q?' },
          },
        },
      },
    };
    const out = mergeStandaloneFindSimilarIntoQuickPills([hero, pills], QNA_I18N_TR);
    const rowRoot = out[0]!.elements[out[0]!.root];
    const firstId = rowRoot?.children?.[0];
    const firstBtn = firstId ? out[0]!.elements[firstId] : undefined;
    const wrapped = firstBtn?.props?.['action'] as { payload?: Record<string, unknown> } | undefined;
    expect(wrapped?.payload).toEqual({ text: QNA_I18N_TR.productContextQuickPillLabel });
  });

  it('returns original array when no standalone findSimilar', () => {
    const spec: UISpec = {
      root: 'root',
      elements: {
        root: {
          type: 'ActionButton',
          props: {
            label: 'Info',
            action: { title: 'Info', type: 'product_info', payload: { sku: 'X' } },
          },
        },
      },
    };
    const arr = [spec];
    const out = mergeStandaloneFindSimilarIntoQuickPills(arr, QNA_I18N_TR);
    expect(out).toBe(arr);
  });
});

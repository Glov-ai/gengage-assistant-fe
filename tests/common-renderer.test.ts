import { describe, it, expect } from 'vitest';
import { renderUISpecWithRegistry, defaultUnknownUISpecRenderer } from '../src/common/renderer/index.js';
import type { UISpec } from '../src/common/types.js';

describe('renderUISpecWithRegistry', () => {
  it('renders root element with the mapped component renderer', () => {
    const spec: UISpec = {
      root: 'root',
      elements: {
        root: { type: 'Card', props: { title: 'Merhaba' } },
      },
    };

    const result = renderUISpecWithRegistry({
      spec,
      context: { locale: 'tr' },
      containerClassName: 'test-container',
      registry: {
        Card: ({ element }) => {
          const card = document.createElement('article');
          card.textContent = String(element.props?.['title'] ?? '');
          return card;
        },
      },
    });

    expect(result.className).toBe('test-container');
    expect(result.querySelector('article')?.textContent).toBe('Merhaba');
  });

  it('uses unknown renderer fallback for unregistered types', () => {
    const spec: UISpec = {
      root: 'root',
      elements: {
        root: { type: 'UnknownContainer', children: ['child'] },
        child: { type: 'Label', props: { text: 'İçerik' } },
      },
    };

    const result = renderUISpecWithRegistry({
      spec,
      context: {},
      containerClassName: 'test-container',
      unknownRenderer: defaultUnknownUISpecRenderer,
      registry: {
        Label: ({ element }) => {
          const span = document.createElement('span');
          span.textContent = String(element.props?.['text'] ?? '');
          return span;
        },
      },
    });

    expect(result.querySelector('span')?.textContent).toBe('İçerik');
  });

  it('returns empty container when root element is missing', () => {
    const spec: UISpec = {
      root: 'missing',
      elements: {},
    };

    const result = renderUISpecWithRegistry({
      spec,
      context: {},
      containerClassName: 'test-container',
      registry: {},
    });

    expect(result.className).toBe('test-container');
    expect(result.children).toHaveLength(0);
  });
});

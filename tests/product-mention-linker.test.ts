import { describe, it, expect, vi } from 'vitest';
import { linkProductMentions } from '../src/chat/components/productMentionLinker.js';

describe('linkProductMentions', () => {
  it('wraps matching text with clickable links', () => {
    const container = document.createElement('div');
    container.textContent = 'Check out the Bosch Hammer Drill for your project';

    const onClick = vi.fn();
    linkProductMentions({
      container,
      mentions: [{ sku: 'SKU-1', short_name: 'Bosch Hammer Drill' }],
      onProductClick: onClick,
    });

    const link = container.querySelector('.gengage-product-mention');
    expect(link).toBeTruthy();
    expect(link!.textContent).toBe('Bosch Hammer Drill');

    (link as HTMLElement).click();
    expect(onClick).toHaveBeenCalledWith('SKU-1');
  });

  it('only links first occurrence per mention', () => {
    const container = document.createElement('div');
    container.innerHTML = '<p>The Drill is great. The Drill is powerful.</p>';

    linkProductMentions({
      container,
      mentions: [{ sku: 'SKU-1', short_name: 'Drill' }],
      onProductClick: vi.fn(),
    });

    const links = container.querySelectorAll('.gengage-product-mention');
    expect(links.length).toBe(1);
  });

  it('handles multiple different mentions', () => {
    const container = document.createElement('div');
    container.textContent = 'Compare Product A and Product B';

    linkProductMentions({
      container,
      mentions: [
        { sku: 'A1', short_name: 'Product A' },
        { sku: 'B2', short_name: 'Product B' },
      ],
      onProductClick: vi.fn(),
    });

    const links = container.querySelectorAll('.gengage-product-mention');
    expect(links.length).toBe(2);
    expect(links[0]!.textContent).toBe('Product A');
    expect(links[1]!.textContent).toBe('Product B');
  });

  it('is case-insensitive in matching', () => {
    const container = document.createElement('div');
    container.textContent = 'Try the BOSCH DRILL today';

    linkProductMentions({
      container,
      mentions: [{ sku: 'SKU-1', short_name: 'Bosch Drill' }],
      onProductClick: vi.fn(),
    });

    const link = container.querySelector('.gengage-product-mention');
    expect(link).toBeTruthy();
    expect(link!.textContent).toBe('BOSCH DRILL');
  });

  it('handles empty mentions array', () => {
    const container = document.createElement('div');
    container.textContent = 'No mentions here';

    linkProductMentions({
      container,
      mentions: [],
      onProductClick: vi.fn(),
    });

    expect(container.querySelectorAll('.gengage-product-mention').length).toBe(0);
  });

  it('does not link partial matches inside larger alphanumeric tokens', () => {
    const container = document.createElement('div');
    container.textContent = 'ARCELIK 901 KMP I 9 Kg Kurutma Makinesi';

    linkProductMentions({
      container,
      mentions: [{ sku: 'SKU-1', short_name: '01 KMP I 9 Kg Kurutma Makinesi' }],
      onProductClick: vi.fn(),
    });

    expect(container.querySelectorAll('.gengage-product-mention').length).toBe(0);
    expect(container.textContent).toBe('ARCELIK 901 KMP I 9 Kg Kurutma Makinesi');
  });

  it('handles mentions with empty short_name', () => {
    const container = document.createElement('div');
    container.textContent = 'Some text';

    linkProductMentions({
      container,
      mentions: [{ sku: 'SKU-1', short_name: '' }],
      onProductClick: vi.fn(),
    });

    expect(container.querySelectorAll('.gengage-product-mention').length).toBe(0);
  });

  it('preserves surrounding HTML structure', () => {
    const container = document.createElement('div');
    container.innerHTML = '<p>I recommend the <strong>Best Drill</strong> for you</p>';

    linkProductMentions({
      container,
      mentions: [{ sku: 'SKU-1', short_name: 'Best Drill' }],
      onProductClick: vi.fn(),
    });

    // Should still have the paragraph
    expect(container.querySelector('p')).toBeTruthy();
  });
});

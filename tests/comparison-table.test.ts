/**
 * Tests for ComparisonTable — DOM rendering of product comparison tables.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderComparisonTable } from '../src/chat/components/ComparisonTable.js';

describe('ComparisonTable', () => {
  it('renders a container with comparison class', () => {
    const el = renderComparisonTable({
      recommended: { sku: 'ABC', name: 'Product A', price: '199 TL', imageUrl: 'https://img.test/a.jpg' },
      products: [
        { sku: 'ABC', name: 'Product A', price: '199 TL', imageUrl: 'https://img.test/a.jpg' },
        { sku: 'DEF', name: 'Product B', price: '249 TL', imageUrl: 'https://img.test/b.jpg' },
      ],
      attributes: [
        { label: 'Marka', values: ['BrandA', 'BrandB'] },
        { label: 'Puan', values: ['4.5', '3.8'] },
      ],
      highlights: ['Great value', 'Durable'],
      onProductClick: () => {},
    });
    expect(el.className).toBe('gengage-chat-comparison');
    expect(el.querySelectorAll('th').length).toBe(3); // empty + 2 products
    expect(el.querySelectorAll('tbody tr').length).toBe(2); // 2 attributes
  });

  it('marks the recommended product with selected class', () => {
    const el = renderComparisonTable({
      recommended: { sku: 'ABC', name: 'Rec', price: '99 TL' },
      products: [{ sku: 'ABC', name: 'Rec', price: '99 TL' }],
      attributes: [{ label: 'Test', values: ['val'] }],
      highlights: [],
      onProductClick: () => {},
    });
    expect(el.querySelector('.gengage-chat-comparison-recommended')).not.toBeNull();
    expect(el.querySelector('.gengage-chat-comparison-selected')).not.toBeNull();
  });

  it('renders highlights list', () => {
    const el = renderComparisonTable({
      recommended: { sku: 'ABC', name: 'Rec', price: '99 TL' },
      products: [],
      attributes: [],
      highlights: ['Feature 1', 'Feature 2'],
      onProductClick: () => {},
    });
    const items = el.querySelectorAll('.gengage-chat-comparison-highlights li');
    expect(items.length).toBe(2);
    expect(items[0]?.textContent).toBe('Feature 1');
  });

  it('renders special cases as expandable details', () => {
    const el = renderComparisonTable({
      recommended: { sku: 'ABC', name: 'Rec', price: '99 TL' },
      products: [],
      attributes: [],
      highlights: [],
      specialCases: ['Case 1', 'Case 2'],
      onProductClick: () => {},
    });
    const details = el.querySelector('details');
    expect(details).not.toBeNull();
    expect(details?.querySelectorAll('li').length).toBe(2);
  });

  it('renders special cases HTML as list items instead of raw tags', () => {
    const el = renderComparisonTable({
      recommended: { sku: 'ABC', name: 'Rec', price: '99 TL' },
      products: [],
      attributes: [],
      highlights: [],
      specialCases: [
        '<ul><li><b>Oda Boyutu:</b> Kucuk odalar icin daha uygun.</li><li><b>Kisisel Tercihler:</b> Daha genis yatak tercih edebilirsiniz.</li></ul>',
      ],
      onProductClick: () => {},
    });

    const items = el.querySelectorAll('details li');
    expect(items.length).toBe(2);
    expect(el.querySelector('details')?.textContent).not.toContain('<ul>');
    expect(items[0]?.textContent).toContain('Oda Boyutu:');
  });

  it('renders heading text', () => {
    const el = renderComparisonTable({
      recommended: { sku: 'ABC', name: 'Rec', price: '99 TL' },
      products: [],
      attributes: [],
      highlights: [],
      onProductClick: () => {},
    });
    expect(el.querySelector('h3')?.textContent).toContain('COMPARISON');
  });

  it('does not render image for unsafe URLs', () => {
    const el = renderComparisonTable({
      recommended: { sku: 'ABC', name: 'Rec', price: '99 TL', imageUrl: 'javascript:alert(1)' },
      products: [],
      attributes: [],
      highlights: [],
      onProductClick: () => {},
    });
    const recBody = el.querySelector('.gengage-chat-comparison-recommended-body');
    expect(recBody?.querySelector('img')).toBeNull();
  });

  it('calls onProductClick when recommended body is clicked', () => {
    const onClick = vi.fn();
    const el = renderComparisonTable({
      recommended: { sku: 'ABC', name: 'Rec', price: '99 TL' },
      products: [],
      attributes: [],
      highlights: [],
      onProductClick: onClick,
    });
    const recBody = el.querySelector('.gengage-chat-comparison-recommended-body') as HTMLElement;
    recBody.click();
    expect(onClick).toHaveBeenCalledWith('ABC');
  });

  it('does not render table when products or attributes are empty', () => {
    const el = renderComparisonTable({
      recommended: { sku: 'ABC', name: 'Rec', price: '99 TL' },
      products: [],
      attributes: [],
      highlights: [],
      onProductClick: () => {},
    });
    expect(el.querySelector('table')).toBeNull();
  });

  it('does not render special cases section when absent', () => {
    const el = renderComparisonTable({
      recommended: { sku: 'ABC', name: 'Rec', price: '99 TL' },
      products: [],
      attributes: [],
      highlights: [],
      onProductClick: () => {},
    });
    expect(el.querySelector('details')).toBeNull();
  });

  it('renders recommended product info correctly', () => {
    const el = renderComparisonTable({
      recommended: { sku: 'REC1', name: 'Best Product', price: '1.299 TL', imageUrl: 'https://img.test/best.jpg' },
      products: [],
      attributes: [],
      highlights: [],
      onProductClick: () => {},
    });
    expect(el.querySelector('.gengage-chat-comparison-recommended-title')?.textContent).toBe('Best Product');
    expect(el.querySelector('.gengage-chat-comparison-recommended-price')?.textContent).toBe('1.299 TL');
    expect(el.querySelector('.gengage-chat-comparison-recommended-label')?.textContent).toBe('Recommended Choice');
  });

  it('renders recommended text explanation when present', () => {
    const el = renderComparisonTable({
      recommended: { sku: 'ABC', name: 'Rec', price: '99 TL' },
      products: [],
      attributes: [],
      highlights: [],
      onProductClick: () => {},
      recommendedText: 'This product offers the best value for money.',
    });
    const recText = el.querySelector('.gengage-chat-comparison-recommended-text');
    expect(recText).not.toBeNull();
    expect(recText?.textContent).toBe('This product offers the best value for money.');
  });

  it('does not render recommended text when absent', () => {
    const el = renderComparisonTable({
      recommended: { sku: 'ABC', name: 'Rec', price: '99 TL' },
      products: [],
      attributes: [],
      highlights: [],
      onProductClick: () => {},
    });
    expect(el.querySelector('.gengage-chat-comparison-recommended-text')).toBeNull();
  });

  it('renders view product buttons when productActions is present', () => {
    const el = renderComparisonTable({
      recommended: { sku: 'ABC', name: 'Product A', price: '99 TL' },
      products: [
        { sku: 'ABC', name: 'Product A', price: '99 TL' },
        { sku: 'DEF', name: 'Product B', price: '149 TL' },
      ],
      attributes: [{ label: 'Test', values: ['v1', 'v2'] }],
      highlights: [],
      onProductClick: () => {},
      productActions: {
        ABC: { title: 'Product A', type: 'launchSingleProduct', payload: { sku: 'ABC' } },
        DEF: { title: 'Product B', type: 'launchSingleProduct', payload: { sku: 'DEF' } },
      },
    });
    const btns = el.querySelectorAll('.gengage-chat-comparison-view-btn');
    expect(btns.length).toBe(2);
    expect(btns[0]?.textContent).toBe('Product A');
    expect(btns[1]?.textContent).toBe('Product B');
  });

  it('view product button click calls onProductClick with sku', () => {
    const onClick = vi.fn();
    const el = renderComparisonTable({
      recommended: { sku: 'ABC', name: 'Product A', price: '99 TL' },
      products: [{ sku: 'ABC', name: 'Product A', price: '99 TL' }],
      attributes: [{ label: 'Test', values: ['v1'] }],
      highlights: [],
      onProductClick: onClick,
      productActions: {
        ABC: { title: 'Product A', type: 'launchSingleProduct', payload: { sku: 'ABC' } },
      },
    });
    const btn = el.querySelector('.gengage-chat-comparison-view-btn') as HTMLButtonElement;
    btn.click();
    expect(onClick).toHaveBeenCalledWith('ABC');
  });

  it('does not render view product buttons when productActions is absent', () => {
    const el = renderComparisonTable({
      recommended: { sku: 'ABC', name: 'Rec', price: '99 TL' },
      products: [{ sku: 'ABC', name: 'Rec', price: '99 TL' }],
      attributes: [{ label: 'Test', values: ['v1'] }],
      highlights: [],
      onProductClick: () => {},
    });
    expect(el.querySelector('.gengage-chat-comparison-product-actions')).toBeNull();
  });
});

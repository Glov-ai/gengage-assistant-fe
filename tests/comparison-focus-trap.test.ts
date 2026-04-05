/**
 * Tests for ComparisonTable focus trap — Tab cycling stays within the dialog.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderComparisonTable } from '../src/chat/components/ComparisonTable.js';
import type { ComparisonTableOptions } from '../src/chat/components/ComparisonTable.js';

function baseOptions(overrides?: Partial<ComparisonTableOptions>): ComparisonTableOptions {
  return {
    recommended: { sku: 'A', name: 'Product A', price: '99 TL' },
    products: [
      { sku: 'A', name: 'Product A', price: '99 TL' },
      { sku: 'B', name: 'Product B', price: '149 TL' },
    ],
    attributes: [{ label: 'Brand', values: ['X', 'Y'] }],
    highlights: ['Good battery'],
    onProductClick: vi.fn(),
    productActions: {
      A: { title: 'Product A', type: 'launchSingleProduct' },
      B: { title: 'Product B', type: 'launchSingleProduct' },
    },
    ...overrides,
  };
}

describe('ComparisonTable focus trap', () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = renderComparisonTable(baseOptions());
    document.body.appendChild(container);
  });

  it('has role="dialog" on the container', () => {
    expect(container.getAttribute('role')).toBe('dialog');
  });

  it('wraps focus from last to first on Tab at last focusable', () => {
    const focusables = container.querySelectorAll<HTMLElement>(
      'button, [href], input, [tabindex]:not([tabindex="-1"])',
    );
    expect(focusables.length).toBeGreaterThanOrEqual(2);

    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;

    last.focus();
    expect(document.activeElement).toBe(last);

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    const preventSpy = vi.spyOn(event, 'preventDefault');
    last.dispatchEvent(event);

    expect(preventSpy).toHaveBeenCalled();
    expect(document.activeElement).toBe(first);
  });

  it('wraps focus from first to last on Shift+Tab at first focusable', () => {
    const focusables = container.querySelectorAll<HTMLElement>(
      'button, [href], input, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;

    first.focus();
    expect(document.activeElement).toBe(first);

    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    const preventSpy = vi.spyOn(event, 'preventDefault');
    first.dispatchEvent(event);

    expect(preventSpy).toHaveBeenCalled();
    expect(document.activeElement).toBe(last);
  });

  it('does not prevent default for Tab in the middle of focusables', () => {
    const focusables = container.querySelectorAll<HTMLElement>(
      'button, [href], input, [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length < 3) return; // skip if not enough focusables

    const middle = focusables[1]!;
    middle.focus();

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    const preventSpy = vi.spyOn(event, 'preventDefault');
    middle.dispatchEvent(event);

    expect(preventSpy).not.toHaveBeenCalled();
  });

  it('does not intercept non-Tab key events', () => {
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    const preventSpy = vi.spyOn(event, 'preventDefault');
    container.dispatchEvent(event);

    expect(preventSpy).not.toHaveBeenCalled();
  });

  it('handles container with no focusable elements gracefully', () => {
    const emptyContainer = renderComparisonTable({
      recommended: { sku: 'A', name: 'Product A', price: '99 TL' },
      products: [],
      attributes: [],
      highlights: [],
      onProductClick: vi.fn(),
    });
    document.body.appendChild(emptyContainer);

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    const preventSpy = vi.spyOn(event, 'preventDefault');
    emptyContainer.dispatchEvent(event);

    expect(preventSpy).not.toHaveBeenCalled();
  });
});

import { describe, it, expect } from 'vitest';
import { determinePanelUpdateAction } from '../src/chat/panel-manager.js';

describe('determinePanelUpdateAction', () => {
  const base = {
    componentType: 'ProductGrid',
    similarsAppend: false,
    currentPanelType: null as string | null,
    hasPanelContent: false,
    isPanelLoading: false,
    isFirstPanelContentInStream: true,
  };

  // -----------------------------------------------------------------------
  // Search results (ProductGrid as first panel content) — must REPLACE
  // -----------------------------------------------------------------------

  it('replaces panel when ProductGrid is the first panel content in a new stream', () => {
    expect(
      determinePanelUpdateAction({
        ...base,
        componentType: 'ProductGrid',
        hasPanelContent: true, // old content from previous request
        isPanelLoading: false,
        isFirstPanelContentInStream: true,
      }),
    ).toBe('replace');
  });

  it('replaces panel when ProductGrid is the first panel content and panel has loading skeleton', () => {
    expect(
      determinePanelUpdateAction({
        ...base,
        componentType: 'ProductGrid',
        hasPanelContent: true,
        isPanelLoading: true,
        isFirstPanelContentInStream: true,
      }),
    ).toBe('replace');
  });

  it('replaces panel when ProductGrid is the first content and panel is empty', () => {
    expect(
      determinePanelUpdateAction({
        ...base,
        componentType: 'ProductGrid',
        hasPanelContent: false,
        isFirstPanelContentInStream: true,
      }),
    ).toBe('replace');
  });

  // -----------------------------------------------------------------------
  // Similar products (ProductGrid as subsequent panel content) — must APPEND
  // -----------------------------------------------------------------------

  it('appends ProductGrid when it follows other panel content in the same stream', () => {
    expect(
      determinePanelUpdateAction({
        ...base,
        componentType: 'ProductGrid',
        hasPanelContent: true,
        isPanelLoading: false,
        isFirstPanelContentInStream: false, // second UISpec in same stream
      }),
    ).toBe('append');
  });

  it('replaces when ProductGrid follows panel content but panel is still loading', () => {
    // Edge case: loading skeleton present means we should replace it
    expect(
      determinePanelUpdateAction({
        ...base,
        componentType: 'ProductGrid',
        hasPanelContent: true,
        isPanelLoading: true,
        isFirstPanelContentInStream: false,
      }),
    ).toBe('replace');
  });

  // -----------------------------------------------------------------------
  // productDetailsSimilars (similarsAppend flag) — must APPEND via similars helper
  // -----------------------------------------------------------------------

  it('uses appendSimilars when similarsAppend is true and current type is ProductDetailsPanel', () => {
    expect(
      determinePanelUpdateAction({
        ...base,
        componentType: 'ProductGrid',
        similarsAppend: true,
        currentPanelType: 'ProductDetailsPanel',
        hasPanelContent: true,
        isPanelLoading: false,
        isFirstPanelContentInStream: false,
      }),
    ).toBe('appendSimilars');
  });

  it('does not appendSimilars when panel is loading (replaces skeleton instead)', () => {
    expect(
      determinePanelUpdateAction({
        ...base,
        componentType: 'ProductGrid',
        similarsAppend: true,
        currentPanelType: 'ProductDetailsPanel',
        hasPanelContent: true,
        isPanelLoading: true,
        isFirstPanelContentInStream: false,
      }),
    ).toBe('replace');
  });

  it('does not appendSimilars when current panel type is not ProductDetailsPanel', () => {
    expect(
      determinePanelUpdateAction({
        ...base,
        componentType: 'ProductGrid',
        similarsAppend: true,
        currentPanelType: 'ComparisonTable',
        hasPanelContent: true,
        isPanelLoading: false,
        isFirstPanelContentInStream: false,
      }),
    ).toBe('append'); // falls through to regular append
  });

  // -----------------------------------------------------------------------
  // ComparisonTable — must always REPLACE
  // -----------------------------------------------------------------------

  it('replaces panel when ComparisonTable arrives (first in stream)', () => {
    expect(
      determinePanelUpdateAction({
        ...base,
        componentType: 'ComparisonTable',
        hasPanelContent: true,
        isFirstPanelContentInStream: true,
      }),
    ).toBe('replace');
  });

  it('replaces panel when ComparisonTable arrives (subsequent in stream)', () => {
    expect(
      determinePanelUpdateAction({
        ...base,
        componentType: 'ComparisonTable',
        hasPanelContent: true,
        isFirstPanelContentInStream: false,
      }),
    ).toBe('replace');
  });

  // -----------------------------------------------------------------------
  // ProductDetailsPanel — must always REPLACE
  // -----------------------------------------------------------------------

  it('replaces panel when ProductDetailsPanel arrives (first in stream)', () => {
    expect(
      determinePanelUpdateAction({
        ...base,
        componentType: 'ProductDetailsPanel',
        hasPanelContent: true,
        isFirstPanelContentInStream: true,
      }),
    ).toBe('replace');
  });

  it('replaces panel when ProductDetailsPanel arrives with old content visible', () => {
    expect(
      determinePanelUpdateAction({
        ...base,
        componentType: 'ProductDetailsPanel',
        currentPanelType: 'ProductGrid',
        hasPanelContent: true,
        isPanelLoading: false,
        isFirstPanelContentInStream: true,
      }),
    ).toBe('replace');
  });

  // -----------------------------------------------------------------------
  // AIGroupingCards — must always REPLACE
  // -----------------------------------------------------------------------

  it('replaces panel when AIGroupingCards arrives', () => {
    expect(
      determinePanelUpdateAction({
        ...base,
        componentType: 'AIGroupingCards',
        hasPanelContent: true,
        isFirstPanelContentInStream: true,
      }),
    ).toBe('replace');
  });

  // -----------------------------------------------------------------------
  // Edge: panel empty (no previous content)
  // -----------------------------------------------------------------------

  it('replaces when panel is empty regardless of stream position', () => {
    expect(
      determinePanelUpdateAction({
        ...base,
        componentType: 'ProductGrid',
        hasPanelContent: false,
        isFirstPanelContentInStream: false,
      }),
    ).toBe('replace');
  });
});

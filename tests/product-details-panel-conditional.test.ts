import { describe, it, expect, vi } from 'vitest';
import { ExtendedModeManager } from '../src/chat/extendedModeManager.js';

/**
 * GAPS #40: productDetails should only extend panel when isDemoWebsite is true.
 *
 * Production behavior (PROD-JSON-RENDER.md §14.2):
 *   - comparisonTable, groupList, productList, productDetailsSimilars → always extend
 *   - productDetails → only extend when isDemoWebsite (productDetailsInPanel) is true
 */
describe('Conditional productDetails Panel Extension', () => {
  function createManager(productDetailsInPanel: boolean): ExtendedModeManager {
    const mgr = new ExtendedModeManager({
      onChange: vi.fn(),
      productDetailsInPanel,
    });
    // Unlock and show chat so isExtended depends only on content type
    mgr.unlock();
    mgr.setChatShown(true);
    return mgr;
  }

  // ---------- productDetails conditional ----------

  it('extends panel for productDetails when productDetailsInPanel is true (demo site)', () => {
    const mgr = createManager(true);
    mgr.setPanelContentType('productDetails');
    expect(mgr.isExtended).toBe(true);
  });

  it('does NOT extend panel for productDetails when productDetailsInPanel is false (regular account)', () => {
    const mgr = createManager(false);
    mgr.setPanelContentType('productDetails');
    expect(mgr.isExtended).toBe(false);
  });

  it('does NOT extend panel for productDetails when productDetailsInPanel is omitted', () => {
    const mgr = new ExtendedModeManager({ onChange: vi.fn() });
    mgr.unlock();
    mgr.setChatShown(true);
    mgr.setPanelContentType('productDetails');
    expect(mgr.isExtended).toBe(false);
  });

  // ---------- Always-extend types ----------

  it('always extends panel for comparisonTable', () => {
    const mgr = createManager(false);
    mgr.setPanelContentType('comparisonTable');
    expect(mgr.isExtended).toBe(true);
  });

  it('always extends panel for productList', () => {
    const mgr = createManager(false);
    mgr.setPanelContentType('productList');
    expect(mgr.isExtended).toBe(true);
  });

  it('always extends panel for groupList', () => {
    const mgr = createManager(false);
    mgr.setPanelContentType('groupList');
    expect(mgr.isExtended).toBe(true);
  });

  it('always extends panel for productDetailsSimilars', () => {
    const mgr = createManager(false);
    mgr.setPanelContentType('productDetailsSimilars');
    expect(mgr.isExtended).toBe(true);
  });

  // ---------- onChange callback fires correctly ----------

  it('fires onChange when productDetails triggers extension on demo site', () => {
    const onChange = vi.fn();
    const mgr = new ExtendedModeManager({ onChange, productDetailsInPanel: true });
    mgr.unlock();
    mgr.setChatShown(true);
    mgr.setPanelContentType('productDetails');
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does NOT fire onChange for productDetails on regular account', () => {
    const onChange = vi.fn();
    const mgr = new ExtendedModeManager({ onChange, productDetailsInPanel: false });
    mgr.unlock();
    mgr.setChatShown(true);
    mgr.setPanelContentType('productDetails');
    // onChange should never have been called with true
    expect(onChange).not.toHaveBeenCalledWith(true);
  });
});

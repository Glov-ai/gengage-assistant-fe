/**
 * Tests for ExtendedModeManager — lock-count system for panel extension.
 */

import { describe, it, expect, vi } from 'vitest';
import { ExtendedModeManager } from '../src/chat/extendedModeManager.js';

describe('ExtendedModeManager', () => {
  it('starts with isExtended = false (locked by default)', () => {
    const onChange = vi.fn();
    const mgr = new ExtendedModeManager({ onChange });
    expect(mgr.isExtended).toBe(false);
  });

  it('becomes extended when all conditions are met', () => {
    const onChange = vi.fn();
    const mgr = new ExtendedModeManager({ onChange, productDetailsInPanel: true });
    mgr.unlock(); // lockCount 1 → 0
    mgr.setChatShown(true);
    mgr.setPanelContentType('productDetails');
    expect(mgr.isExtended).toBe(true);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('fires onChange only when state actually changes', () => {
    const onChange = vi.fn();
    const mgr = new ExtendedModeManager({ onChange, productDetailsInPanel: true });
    mgr.unlock();
    mgr.setChatShown(true);
    expect(onChange).not.toHaveBeenCalled(); // no panel content type yet
    mgr.setPanelContentType('productDetails');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
    // Setting same type again should not fire
    mgr.setPanelContentType('productDetails');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('is not extended when lockCount > 0', () => {
    const onChange = vi.fn();
    const mgr = new ExtendedModeManager({ onChange });
    mgr.setChatShown(true);
    mgr.setPanelContentType('productList');
    expect(mgr.isExtended).toBe(false);
  });

  it('is not extended when hiddenByUser is true', () => {
    const onChange = vi.fn();
    const mgr = new ExtendedModeManager({ onChange, productDetailsInPanel: true });
    mgr.unlock();
    mgr.setChatShown(true);
    mgr.setPanelContentType('productDetails');
    expect(mgr.isExtended).toBe(true);
    mgr.setHiddenByUser(true);
    expect(mgr.isExtended).toBe(false);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('is not extended when isFavoritesMode is true', () => {
    const onChange = vi.fn();
    const mgr = new ExtendedModeManager({ onChange });
    mgr.unlock();
    mgr.setChatShown(true);
    mgr.setPanelContentType('productList');
    mgr.setFavoritesMode(true);
    expect(mgr.isExtended).toBe(false);
  });

  it('is not extended when chatShown is false', () => {
    const onChange = vi.fn();
    const mgr = new ExtendedModeManager({ onChange });
    mgr.unlock();
    mgr.setPanelContentType('productList');
    expect(mgr.isExtended).toBe(false);
  });

  it('is not extended when panelContentType is null', () => {
    const onChange = vi.fn();
    const mgr = new ExtendedModeManager({ onChange });
    mgr.unlock();
    mgr.setChatShown(true);
    expect(mgr.isExtended).toBe(false);
  });

  it('lock() increments lockCount and blocks extension', () => {
    const onChange = vi.fn();
    const mgr = new ExtendedModeManager({ onChange });
    mgr.unlock(); // 1 → 0
    mgr.setChatShown(true);
    mgr.setPanelContentType('productList');
    expect(mgr.isExtended).toBe(true);
    mgr.lock(); // 0 → 1
    expect(mgr.isExtended).toBe(false);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('unlock() does not go below 0', () => {
    const onChange = vi.fn();
    const mgr = new ExtendedModeManager({ onChange });
    mgr.unlock(); // 1 → 0
    mgr.unlock(); // already 0 — stays 0
    mgr.setChatShown(true);
    mgr.setPanelContentType('comparisonTable');
    expect(mgr.isExtended).toBe(true);
  });

  it('recognizes all valid PanelContentType values (with productDetailsInPanel)', () => {
    const types = ['comparisonTable', 'groupList', 'productDetails', 'productDetailsSimilars', 'productList'] as const;
    for (const type of types) {
      const onChange = vi.fn();
      const mgr = new ExtendedModeManager({ onChange, productDetailsInPanel: true });
      mgr.unlock();
      mgr.setChatShown(true);
      mgr.setPanelContentType(type);
      expect(mgr.isExtended).toBe(true);
    }
  });

  it('transitions back to extended after clearing a blocking condition', () => {
    const onChange = vi.fn();
    const mgr = new ExtendedModeManager({ onChange, productDetailsInPanel: true });
    mgr.unlock();
    mgr.setChatShown(true);
    mgr.setPanelContentType('productDetails');
    expect(mgr.isExtended).toBe(true);

    mgr.setHiddenByUser(true);
    expect(mgr.isExtended).toBe(false);

    mgr.setHiddenByUser(false);
    expect(mgr.isExtended).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(3); // true, false, true
  });

  it('clearing panelContentType to null disables extension', () => {
    const onChange = vi.fn();
    const mgr = new ExtendedModeManager({ onChange });
    mgr.unlock();
    mgr.setChatShown(true);
    mgr.setPanelContentType('groupList');
    expect(mgr.isExtended).toBe(true);
    mgr.setPanelContentType(null);
    expect(mgr.isExtended).toBe(false);
  });
});

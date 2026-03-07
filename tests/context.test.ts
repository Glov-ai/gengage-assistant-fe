import { describe, it, expect, beforeEach, vi } from 'vitest';
import { bootstrapSession, getWindowPageContext, updatePageContext, resolveSession } from '../src/common/context.js';

describe('context', () => {
  beforeEach(() => {
    // Reset global state
    delete window.__gengageSessionId;
    delete (window as unknown as Record<string, unknown>).gengage;
    sessionStorage.clear();
  });

  describe('bootstrapSession', () => {
    it('generates a session ID on first call', () => {
      const id = bootstrapSession();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('returns the same ID on subsequent calls', () => {
      const id1 = bootstrapSession();
      const id2 = bootstrapSession();
      expect(id1).toBe(id2);
    });

    it('persists to sessionStorage', () => {
      const id = bootstrapSession();
      expect(sessionStorage.getItem('gengage_session_id')).toBe(id);
    });

    it('sets window.__gengageSessionId', () => {
      const id = bootstrapSession();
      expect(window.__gengageSessionId).toBe(id);
    });

    it('sets window.gengage.sessionId', () => {
      const id = bootstrapSession();
      expect(window.gengage?.sessionId).toBe(id);
    });

    it('recovers from sessionStorage on fresh load', () => {
      sessionStorage.setItem('gengage_session_id', 'stored-id');
      const id = bootstrapSession();
      expect(id).toBe('stored-id');
    });

    it('prefers window.__gengageSessionId over sessionStorage', () => {
      window.__gengageSessionId = 'window-id';
      sessionStorage.setItem('gengage_session_id', 'storage-id');
      const id = bootstrapSession();
      expect(id).toBe('window-id');
    });
  });

  describe('getWindowPageContext', () => {
    it('returns null when not set', () => {
      expect(getWindowPageContext()).toBeNull();
    });

    it('returns pageContext when set', () => {
      (window as unknown as Record<string, unknown>).gengage = { pageContext: { pageType: 'pdp', sku: 'ABC' } };
      const ctx = getWindowPageContext();
      expect(ctx).toEqual({ pageType: 'pdp', sku: 'ABC' });
    });
  });

  describe('updatePageContext', () => {
    it('creates pageContext with defaults', () => {
      updatePageContext({ sku: '123' });
      expect(window.gengage?.pageContext?.pageType).toBe('other');
      expect(window.gengage?.pageContext?.sku).toBe('123');
    });

    it('merges with existing context', () => {
      (window as unknown as Record<string, unknown>).gengage = { pageContext: { pageType: 'pdp', sku: 'old' } };
      updatePageContext({ sku: 'new' });
      expect(window.gengage?.pageContext?.pageType).toBe('pdp');
      expect(window.gengage?.pageContext?.sku).toBe('new');
    });

    it('dispatches gengage:context:update event', () => {
      const handler = vi.fn();
      window.addEventListener('gengage:context:update', handler);
      updatePageContext({ pageType: 'cart' });
      expect(handler).toHaveBeenCalledTimes(1);
      window.removeEventListener('gengage:context:update', handler);
    });
  });

  describe('resolveSession', () => {
    it('bootstraps session when no overrides', () => {
      const session = resolveSession();
      expect(session.sessionId).toBeTruthy();
    });

    it('uses provided sessionId', () => {
      const session = resolveSession({ sessionId: 'custom-id' });
      expect(session.sessionId).toBe('custom-id');
    });

    it('merges additional overrides', () => {
      const session = resolveSession({ sessionId: 'id', viewId: 'view-1', userId: 'user-1' });
      expect(session.sessionId).toBe('id');
      expect(session.viewId).toBe('view-1');
      expect(session.userId).toBe('user-1');
    });
  });
});

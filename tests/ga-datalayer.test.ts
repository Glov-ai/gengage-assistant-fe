import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  trackInit,
  trackShow,
  trackHide,
  trackCartAdd,
  trackMessageSent,
  trackProductDetail,
  trackSuggestedQuestion,
  trackCompareSelected,
  trackCompareClear,
  trackLikeProduct,
  trackSearch,
  trackError,
  trackVoiceInput,
  wireGADataLayer,
} from '../src/common/ga-datalayer.js';

describe('ga-datalayer', () => {
  let originalDataLayer: unknown;

  beforeEach(() => {
    originalDataLayer = window.dataLayer;
    window.dataLayer = [];
  });

  afterEach(() => {
    window.dataLayer = originalDataLayer as typeof window.dataLayer;
  });

  describe('individual event functions', () => {
    it('trackInit pushes gengage-on-init', () => {
      trackInit('chat');
      expect(window.dataLayer).toHaveLength(1);
      expect(window.dataLayer![0]).toEqual({ event: 'gengage-on-init', gengage_widget: 'chat' });
    });

    it('trackShow pushes gengage-show', () => {
      trackShow('qna');
      expect(window.dataLayer![0]).toEqual({ event: 'gengage-show', gengage_widget: 'qna' });
    });

    it('trackHide pushes gengage-hide', () => {
      trackHide('simrel');
      expect(window.dataLayer![0]).toEqual({ event: 'gengage-hide', gengage_widget: 'simrel' });
    });

    it('trackCartAdd pushes sku and quantity', () => {
      trackCartAdd('SKU123', 2);
      expect(window.dataLayer![0]).toEqual({
        event: 'gengage-cart-add',
        gengage_sku: 'SKU123',
        gengage_quantity: 2,
      });
    });

    it('trackProductDetail pushes sku and name', () => {
      trackProductDetail('SKU456', 'Test Product');
      expect(window.dataLayer![0]).toEqual({
        event: 'gengage-product-detail',
        gengage_sku: 'SKU456',
        gengage_product_name: 'Test Product',
      });
    });

    it('trackSuggestedQuestion pushes title and type', () => {
      trackSuggestedQuestion('Show reviews', 'reviewSummary');
      expect(window.dataLayer![0]).toEqual({
        event: 'gengage-suggested-question',
        gengage_question_title: 'Show reviews',
        gengage_action_type: 'reviewSummary',
      });
    });

    it('trackCompareSelected pushes skus array', () => {
      trackCompareSelected(['A', 'B']);
      expect(window.dataLayer![0]).toEqual({
        event: 'gengage-compare-selected',
        gengage_skus: ['A', 'B'],
        gengage_product_count: 2,
      });
    });

    it('trackCompareClear pushes event', () => {
      trackCompareClear();
      expect(window.dataLayer![0]).toEqual({ event: 'gengage-compare-clear' });
    });

    it('trackLikeProduct pushes sku', () => {
      trackLikeProduct('SKU789');
      expect(window.dataLayer![0]).toEqual({ event: 'gengage-like-product', gengage_sku: 'SKU789' });
    });

    it('trackSearch pushes query and count', () => {
      trackSearch('shoes', 42);
      expect(window.dataLayer![0]).toEqual({
        event: 'gengage-search',
        gengage_search_query: 'shoes',
        gengage_result_count: 42,
      });
    });

    it('trackMessageSent pushes event', () => {
      trackMessageSent();
      expect(window.dataLayer![0]).toEqual({ event: 'gengage-message-sent' });
    });

    it('trackError pushes widget and error', () => {
      trackError('chat', 'timeout');
      expect(window.dataLayer![0]).toEqual({
        event: 'gengage-error',
        gengage_widget: 'chat',
        gengage_error: 'timeout',
      });
    });

    it('trackVoiceInput pushes event', () => {
      trackVoiceInput();
      expect(window.dataLayer![0]).toEqual({ event: 'gengage-voice-input' });
    });
  });

  describe('without dataLayer', () => {
    it('silently drops events when dataLayer is absent', () => {
      delete window.dataLayer;
      expect(() => trackInit('chat')).not.toThrow();
    });
  });

  describe('wireGADataLayer', () => {
    it('returns unsubscribe function', () => {
      const unsub = wireGADataLayer();
      expect(typeof unsub).toBe('function');
      unsub();
    });

    it('is idempotent — second call returns same unsub', () => {
      const unsub1 = wireGADataLayer();
      const unsub2 = wireGADataLayer();
      expect(unsub1).toBe(unsub2);
      unsub1();
    });

    it('listens to gengage:chat:ready and pushes gengage-on-init', () => {
      const unsub = wireGADataLayer();
      window.dispatchEvent(new CustomEvent('gengage:chat:ready', { detail: {} }));
      expect(window.dataLayer).toContainEqual(
        expect.objectContaining({ event: 'gengage-on-init', gengage_widget: 'chat' }),
      );
      unsub();
    });

    it('listens to gengage:chat:open and pushes gengage-show', () => {
      const unsub = wireGADataLayer();
      window.dispatchEvent(new CustomEvent('gengage:chat:open', { detail: { state: 'full' } }));
      expect(window.dataLayer).toContainEqual(
        expect.objectContaining({ event: 'gengage-show', gengage_widget: 'chat' }),
      );
      unsub();
    });

    it('listens to gengage:chat:product-favorite and pushes gengage-like-product when favorited', () => {
      const unsub = wireGADataLayer();
      window.dispatchEvent(
        new CustomEvent('gengage:chat:product-favorite', {
          detail: { sku: 'SKU-F', product: {}, favorited: true, sessionId: null },
        }),
      );
      expect(window.dataLayer).toContainEqual(
        expect.objectContaining({ event: 'gengage-like-product', gengage_sku: 'SKU-F' }),
      );
      window.dataLayer = [];
      window.dispatchEvent(
        new CustomEvent('gengage:chat:product-favorite', {
          detail: { sku: 'SKU-F', product: {}, favorited: false, sessionId: null },
        }),
      );
      expect(window.dataLayer).toHaveLength(0);
      unsub();
    });

    it('cleans up listeners after unsub', () => {
      const unsub = wireGADataLayer();
      unsub();
      window.dataLayer = [];
      window.dispatchEvent(new CustomEvent('gengage:chat:ready', { detail: {} }));
      expect(window.dataLayer).toHaveLength(0);
    });
  });
});

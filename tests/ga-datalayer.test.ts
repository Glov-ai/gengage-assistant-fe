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
  trackChatbotOpened,
  trackChatbotMaximized,
  trackGlovOn,
  trackInterfaceNotReady,
  trackQnaInput,
  trackQnaButton,
  trackSimilarProductsImpression,
  trackSimilarGroupingClick,
  trackSimilarProductClick,
  trackSimilarProductAddToCart,
  trackCompareProduct,
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
    it('trackInit pushes gengage-on-init plus camelCase mirror', () => {
      trackInit('chat');
      expect(window.dataLayer).toHaveLength(2);
      expect(window.dataLayer![0]).toEqual({ event: 'gengage-on-init', gengage_widget: 'chat' });
      expect(window.dataLayer![1]).toEqual({ event: 'gengageOnInit', gengage_widget: 'chat' });
    });

    it('trackShow pushes gengage-show plus gengageShow', () => {
      trackShow('qna');
      expect(window.dataLayer).toEqual([
        { event: 'gengage-show', gengage_widget: 'qna' },
        { event: 'gengageShow', gengage_widget: 'qna' },
      ]);
    });

    it('trackHide pushes gengage-hide plus gengageHide', () => {
      trackHide('simrel');
      expect(window.dataLayer).toEqual([
        { event: 'gengage-hide', gengage_widget: 'simrel' },
        { event: 'gengageHide', gengage_widget: 'simrel' },
      ]);
    });

    it('trackCartAdd pushes gengage-cart-add plus gengageCartAdd', () => {
      trackCartAdd('SKU123', 2);
      expect(window.dataLayer).toEqual([
        { event: 'gengage-cart-add', gengage_sku: 'SKU123', gengage_quantity: 2 },
        { event: 'gengageCartAdd', gengage_sku: 'SKU123', gengage_quantity: 2 },
      ]);
    });

    it('trackProductDetail pushes legacy and camelCase variants', () => {
      trackProductDetail('SKU456', 'Test Product');
      expect(window.dataLayer).toContainEqual({
        event: 'gengage-product-detail',
        gengage_sku: 'SKU456',
        gengage_product_name: 'Test Product',
      });
      expect(window.dataLayer).toContainEqual({
        event: 'gengageProductDetail',
        gengage_sku: 'SKU456',
        gengage_product_name: 'Test Product',
      });
    });

    it('trackSuggestedQuestion pushes legacy and camelCase variants', () => {
      trackSuggestedQuestion('Show reviews', 'reviewSummary');
      expect(window.dataLayer).toContainEqual({
        event: 'gengage-suggested-question',
        gengage_question_title: 'Show reviews',
        gengage_action_type: 'reviewSummary',
      });
      expect(window.dataLayer).toContainEqual({
        event: 'gengageSuggestedQuestion',
        gengage_question_title: 'Show reviews',
        gengage_action_type: 'reviewSummary',
      });
    });

    it('trackCompareSelected pushes legacy and camelCase variants', () => {
      trackCompareSelected(['A', 'B']);
      expect(window.dataLayer).toContainEqual({
        event: 'gengage-compare-selected',
        gengage_skus: ['A', 'B'],
        gengage_product_count: 2,
      });
      expect(window.dataLayer).toContainEqual({
        event: 'gengageCompareSelected',
        gengage_skus: ['A', 'B'],
        gengage_product_count: 2,
      });
    });

    it('trackCompareClear pushes legacy and camelCase variants', () => {
      trackCompareClear();
      expect(window.dataLayer).toEqual([{ event: 'gengage-compare-clear' }, { event: 'gengageCompareClear' }]);
    });

    it('trackLikeProduct pushes legacy and camelCase variants', () => {
      trackLikeProduct('SKU789');
      expect(window.dataLayer).toEqual([
        { event: 'gengage-like-product', gengage_sku: 'SKU789' },
        { event: 'gengageLikeProduct', gengage_sku: 'SKU789' },
      ]);
    });

    it('trackSearch pushes legacy and camelCase variants', () => {
      trackSearch('shoes', 42);
      expect(window.dataLayer).toContainEqual({
        event: 'gengage-search',
        gengage_search_query: 'shoes',
        gengage_result_count: 42,
      });
      expect(window.dataLayer).toContainEqual({
        event: 'gengageSearch',
        gengage_search_query: 'shoes',
        gengage_result_count: 42,
      });
    });

    it('trackMessageSent pushes legacy and camelCase variants', () => {
      trackMessageSent();
      expect(window.dataLayer).toEqual([{ event: 'gengage-message-sent' }, { event: 'gengageMessageSent' }]);
    });

    it('trackError pushes legacy and camelCase variants', () => {
      trackError('chat', 'timeout');
      expect(window.dataLayer).toContainEqual({
        event: 'gengage-error',
        gengage_widget: 'chat',
        gengage_error: 'timeout',
      });
      expect(window.dataLayer).toContainEqual({
        event: 'gengageError',
        gengage_widget: 'chat',
        gengage_error: 'timeout',
      });
    });

    it('trackVoiceInput pushes legacy and camelCase variants', () => {
      trackVoiceInput();
      expect(window.dataLayer).toEqual([{ event: 'gengage-voice-input' }, { event: 'gengageVoiceInput' }]);
    });
  });

  describe('canonical-only events (no kebab mirror)', () => {
    it('trackChatbotOpened pushes only the camelCase event', () => {
      trackChatbotOpened('launcher');
      expect(window.dataLayer).toEqual([{ event: 'gengageChatbotOpened', gengage_source: 'launcher' }]);
    });

    it('trackChatbotMaximized pushes only the camelCase event', () => {
      trackChatbotMaximized();
      expect(window.dataLayer).toEqual([{ event: 'gengageChatbotMaximized' }]);
    });

    it('trackGlovOn pushes the GLOV_ON event verbatim', () => {
      trackGlovOn('mystore');
      expect(window.dataLayer).toEqual([{ event: 'GLOV_ON', gengage_account_id: 'mystore' }]);
    });

    it('trackInterfaceNotReady pushes attempts metadata', () => {
      trackInterfaceNotReady('overlay_init_failed', 10);
      expect(window.dataLayer).toEqual([
        {
          event: 'gengageInterfaceNotReady',
          gengage_reason: 'overlay_init_failed',
          gengage_attempts: 10,
        },
      ]);
    });

    it('trackQnaInput captures the typed text', () => {
      trackQnaInput('en uygun mont hangisi?');
      expect(window.dataLayer).toEqual([
        { event: 'gengageQnaInput', gengage_question_title: 'en uygun mont hangisi?' },
      ]);
    });

    it('trackQnaButton captures title and type', () => {
      trackQnaButton('Show reviews', 'reviewSummary');
      expect(window.dataLayer).toEqual([
        {
          event: 'gengageQnaButton',
          gengage_question_title: 'Show reviews',
          gengage_action_type: 'reviewSummary',
        },
      ]);
    });

    it('trackSimilarProductsImpression captures count and sku', () => {
      trackSimilarProductsImpression(8, 'SKU-A');
      expect(window.dataLayer).toEqual([
        {
          event: 'gengageSimilarProductsImpression',
          gengage_product_count: 8,
          gengage_sku: 'SKU-A',
        },
      ]);
    });

    it('trackSimilarGroupingClick captures group name and index', () => {
      trackSimilarGroupingClick('Bütçe Dostu', 1);
      expect(window.dataLayer).toEqual([
        {
          event: 'gengageSimilarGroupingClick',
          gengage_group_name: 'Bütçe Dostu',
          gengage_group_index: 1,
        },
      ]);
    });

    it('trackSimilarProductClick captures sku and name', () => {
      trackSimilarProductClick('SKU-A', 'Test Product');
      expect(window.dataLayer).toEqual([
        {
          event: 'gengageSimilarProductClick',
          gengage_sku: 'SKU-A',
          gengage_product_name: 'Test Product',
        },
      ]);
    });

    it('trackSimilarProductAddToCart captures sku and quantity', () => {
      trackSimilarProductAddToCart('SKU-A', 1);
      expect(window.dataLayer).toEqual([
        { event: 'gengageSimilarProductAddToCart', gengage_sku: 'SKU-A', gengage_quantity: 1 },
      ]);
    });

    it('trackCompareProduct defaults to source: toggle', () => {
      trackCompareProduct();
      expect(window.dataLayer).toEqual([{ event: 'gengageCompareProduct', gengage_source: 'toggle' }]);
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

    it('listens to gengage:chat:ready and pushes gengage-on-init plus mirror', () => {
      const unsub = wireGADataLayer();
      window.dispatchEvent(new CustomEvent('gengage:chat:ready', { detail: {} }));
      expect(window.dataLayer).toContainEqual(
        expect.objectContaining({ event: 'gengage-on-init', gengage_widget: 'chat' }),
      );
      expect(window.dataLayer).toContainEqual(
        expect.objectContaining({ event: 'gengageOnInit', gengage_widget: 'chat' }),
      );
      unsub();
    });

    it('listens to gengage:chat:open and pushes gengage-show plus mirror', () => {
      const unsub = wireGADataLayer();
      window.dispatchEvent(new CustomEvent('gengage:chat:open', { detail: { state: 'full' } }));
      expect(window.dataLayer).toContainEqual(
        expect.objectContaining({ event: 'gengage-show', gengage_widget: 'chat' }),
      );
      expect(window.dataLayer).toContainEqual(
        expect.objectContaining({ event: 'gengageShow', gengage_widget: 'chat' }),
      );
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

/**
 * Canned NDJSON response sequences for the mock backend.
 * Each endpoint maps to an array of NDJSON lines (one object per line).
 */

import { PRODUCTS, productAsRecord } from './products.js';

const p = PRODUCTS;

function ndjsonLines(events: Record<string, unknown>[]): string {
  return events.map((e) => JSON.stringify(e)).join('\n') + '\n';
}

/** POST /chat/process_action — greeting stream */
export const CHAT_GREETING_STREAM = ndjsonLines([
  { type: 'loading', payload: { text: 'Dusunuyorum...' } },
  {
    type: 'outputText',
    payload: {
      text: '<p>Merhaba! Size nasil yardimci olabilirim? Urun aramanizda, karsilastirmanizda veya teknik sorularinizda yardimci olabilirim.</p>',
    },
  },
  {
    type: 'suggestedActions',
    payload: {
      actions: [
        { title: 'Akulu matkap onerir misin?', requestDetails: { type: 'search', payload: { query: 'akulu matkap' } } },
        { title: 'Indirimli urunler', requestDetails: { type: 'search', payload: { query: 'indirim' } } },
        { title: 'En cok satanlar', requestDetails: { type: 'search', payload: { query: 'cok satan' } } },
      ],
    },
  },
  {
    type: 'context',
    payload: {
      panel: { screen_type: 'product_list', conversation_stage: 'exploring' },
      messages: [],
      message_id: 'msg-001',
    },
  },
  { type: 'chatStreamEnd', payload: {} },
]);

/** POST /chat/process_action — search results stream */
export const CHAT_SEARCH_STREAM = ndjsonLines([
  { type: 'loading', payload: { text: 'Urunler araniyor...' } },
  { type: 'outputText', payload: { text: '<p>Akulu matkaplar icin su urunleri buldum:</p>' } },
  {
    type: 'productList',
    payload: {
      products: [productAsRecord(p[0]!), productAsRecord(p[1]!), productAsRecord(p[2]!), productAsRecord(p[3]!)],
      endOfList: false,
    },
  },
  {
    type: 'context',
    payload: {
      panel: { screen_type: 'product_list', last_search_query: 'akulu matkap' },
      messages: [],
      message_id: 'msg-002',
    },
  },
  { type: 'chatStreamEnd', payload: {} },
]);

/** POST /chat/launcher_action — QNA buttons */
export const QNA_ACTIONS_STREAM = ndjsonLines([
  {
    type: 'launcherAction',
    payload: {
      action_list: [
        {
          title: 'Bu urun hakkinda bilgi ver',
          requestDetails: { type: 'product_info', payload: { sku: 'DRILL-001' } },
        },
        {
          title: 'Benzer urunler goster',
          requestDetails: { type: 'findSimilar', payload: { sku: 'DRILL-001' } },
        },
        {
          title: 'Kargo ne zaman gelir?',
          requestDetails: { type: 'inputText', payload: 'Kargo suresi nedir?' },
        },
        {
          title: 'Musteri yorumlari',
          requestDetails: { type: 'reviews', payload: { sku: 'DRILL-001' } },
        },
      ],
    },
  },
]);

/** POST /chat/similar_products — SimRel product list */
export const SIMREL_PRODUCTS_STREAM = ndjsonLines([
  {
    type: 'productDetailsSimilars',
    payload: {
      products: PRODUCTS.map((pp) => ({
        sku: pp.sku,
        name: pp.name,
        imageUrl: pp.imageUrl,
        price: pp.price,
        originalPrice: pp.originalPrice,
        discountPercent: pp.discountPercent,
        url: pp.url,
        brand: pp.brand,
        rating: pp.rating,
        reviewCount: pp.reviewCount,
        cartCode: pp.cartCode,
      })),
    },
  },
]);

/** POST /chat/process_action — suggested searches stream */
export const CHAT_SUGGESTED_SEARCHES_STREAM = ndjsonLines([
  { type: 'loading', payload: { text: 'Alternatifler dusunuluyor...' } },
  { type: 'outputText', payload: { text: '<p>Aradiginiz urune benzer kategoriler buldum:</p>' } },
  {
    type: 'aiSuggestedSearches',
    payload: {
      suggested_searches: [
        {
          short_name: 'Akulu Matkap Seti',
          detailed_user_message: 'Matkap + canta + sarj aleti + 2 aku iceren komple setler.',
          display_keywords: ['akulu', 'set', 'komple'],
          representative_product_sku: 'DRILL-001',
          group_skus: ['DRILL-001', 'DRILL-002'],
          image: 'https://placehold.co/200x200/0077cc/fff?text=Set',
          requestDetails: { type: 'search', payload: { query: 'akulu matkap seti' } },
        },
        {
          short_name: 'Darbeli Matkap',
          detailed_user_message: 'Beton ve tugla delme ozelligi olan matkaplar.',
          display_keywords: ['darbeli', 'beton', 'tugla'],
          representative_product_sku: 'DRILL-003',
          group_skus: ['DRILL-003'],
          requestDetails: { type: 'search', payload: { query: 'darbeli matkap' } },
        },
        {
          short_name: 'Mini Matkap',
          detailed_user_message: 'Dar alanlar ve hassas isler icin kompakt matkaplar.',
          display_keywords: ['mini', 'kompakt', 'hafif'],
          representative_product_sku: 'DRILL-004',
          group_skus: ['DRILL-004'],
          requestDetails: { type: 'search', payload: { query: 'mini matkap' } },
        },
      ],
    },
  },
  {
    type: 'context',
    payload: {
      panel: { screen_type: 'product_list', conversation_stage: 'exploring' },
      messages: [],
      message_id: 'msg-003',
    },
  },
  { type: 'chatStreamEnd', payload: {} },
]);

/** Silent acknowledgment — no visible output, just closes the stream */
export const CHAT_SILENT_STREAM = ndjsonLines([{ type: 'chatStreamEnd', payload: {} }]);

/** More products stream — different products + endOfList flag */
export const CHAT_MORE_PRODUCTS_STREAM = ndjsonLines([
  { type: 'loading', payload: { text: 'Daha fazla urun yukleniyor...' } },
  {
    type: 'productList',
    payload: {
      products: [productAsRecord(p[4]!), productAsRecord(p[3]!), productAsRecord(p[2]!), productAsRecord(p[1]!)],
      endOfList: true,
    },
  },
  { type: 'chatStreamEnd', payload: {} },
]);

/** Analytics endpoint — just 200 OK */
export const ANALYTICS_OK = '{}';

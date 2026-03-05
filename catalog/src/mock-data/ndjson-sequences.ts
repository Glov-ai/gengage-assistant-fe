/**
 * Canned NDJSON response sequences for the mock backend.
 * Each endpoint maps to an array of NDJSON lines (one object per line).
 */

import { PRODUCTS, productAsRecord } from './products.js';

const p = PRODUCTS;

function ndjsonLines(events: Record<string, unknown>[]): string {
  return events.map(e => JSON.stringify(e)).join('\n') + '\n';
}

/** POST /chat/process_action — greeting stream */
export const CHAT_GREETING_STREAM = ndjsonLines([
  { type: 'loading', payload: { text: 'Dusunuyorum...' } },
  { type: 'outputText', payload: { text: '<p>Merhaba! Size nasil yardimci olabilirim? Urun aramanizda, karsilastirmanizda veya teknik sorularinizda yardimci olabilirim.</p>' } },
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
  { type: 'context', payload: { panel: { screen_type: 'product_list', conversation_stage: 'exploring' }, messages: [], message_id: 'msg-001' } },
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
  { type: 'context', payload: { panel: { screen_type: 'product_list', last_search_query: 'akulu matkap' }, messages: [], message_id: 'msg-002' } },
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
      products: PRODUCTS.map(pp => ({
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

/** Analytics endpoint — just 200 OK */
export const ANALYTICS_OK = '{}';

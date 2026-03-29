import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/chat/api.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/chat/api.js')>();
  return {
    ...actual,
    sendChatMessage: vi.fn(),
  };
});

import { GengageChat } from '../src/chat/index.js';
import { sendChatMessage } from '../src/chat/api.js';
import type { ProcessActionRequest, StreamCallbacks } from '../src/chat/api.js';

const mockedSendChatMessage = sendChatMessage as unknown as ReturnType<typeof vi.fn>;

function respondDone(callbacks: StreamCallbacks): AbortController {
  setTimeout(() => callbacks.onDone(), 0);
  return new AbortController();
}

describe('Chat contextual openings', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="chat-root"></div>';
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('primes listing openings through the backend entry-context request and shows contextual pills', async () => {
    let capturedRequest: ProcessActionRequest | null = null;
    mockedSendChatMessage.mockImplementation((request, callbacks) => {
      capturedRequest = request;
      return respondDone(callbacks);
    });

    const chat = new GengageChat();
    await chat.init({
      accountId: 'test',
      middlewareUrl: 'https://test.example.com',
      mountTarget: '#chat-root',
      session: { sessionId: 'test-session' },
      pageContext: {
        pageType: 'search',
        categoryTree: ['Beyaz Esya', 'Klima'],
        extra: {
          search_query: 'klima',
          visible_skus: ['SKU-1', 'SKU-2'],
          page_title: 'Klima Sonuclari',
          popular_searches: ['klima', 'buzdolabi'],
        },
      },
      openingMessagesByContext: {
        listing: 'Bu listedeki one cikan secenekleri birlikte daraltalim.',
      },
      openingGuidanceByContext: {
        listing: 'Once urunleri kisa ozetle, sonra farklarini belirginlestir.',
      },
      welcomeActionsByContext: {
        listing: [{ title: 'Bu listedeki farklari ozetle' }, { title: 'En iyi fiyat/performansi sec' }],
      },
    });

    chat.open();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockedSendChatMessage).toHaveBeenCalledTimes(1);
    expect(capturedRequest?.type).toBe('user_message');
    expect(capturedRequest?.page_type).toBe('search');
    expect(capturedRequest?.payload).toEqual(
      expect.objectContaining({
        text: '',
        is_entry_context_opening: 1,
        opening_context_key: 'listing',
        opening_message: 'Bu listedeki one cikan secenekleri birlikte daraltalim.',
        opening_guidance: 'Once urunleri kisa ozetle, sonra farklarini belirginlestir.',
        page_details: {
          url: 'http://localhost:3000/',
          page_title: 'Klima Sonuclari',
          search_query: 'klima',
          visible_skus: ['SKU-1', 'SKU-2'],
          popular_searches: ['klima', 'buzdolabi'],
          category_path: ['Beyaz Esya', 'Klima'],
        },
      }),
    );

    const shadow = (chat as unknown as Record<string, unknown>)['_shadow'] as ShadowRoot | null;
    const pills = shadow?.querySelectorAll('.gengage-chat-pill');
    expect(pills?.length).toBe(2);
    expect(pills?.[0]?.textContent).toContain('Bu listedeki farklari ozetle');
    expect(pills?.[1]?.textContent).toContain('En iyi fiyat/performansi sec');

    chat.destroy();
  });

  it('passes contextual opening copy and guidance into silent PDP priming', async () => {
    let capturedRequest: ProcessActionRequest | null = null;
    mockedSendChatMessage.mockImplementation((request, callbacks) => {
      capturedRequest = request;
      return respondDone(callbacks);
    });

    const chat = new GengageChat();
    await chat.init({
      accountId: 'test',
      middlewareUrl: 'https://test.example.com',
      mountTarget: '#chat-root',
      session: { sessionId: 'test-session' },
      pageContext: {
        pageType: 'pdp',
        sku: '9209341100',
      },
      openingMessagesByContext: {
        product: 'Bu urunun one cikan taraflarini hemen ozetle.',
      },
      openingGuidanceByContext: {
        product: 'Kisa bir ilk degerlendirme ver, sonra yorum ve alternatif sorularina gec.',
      },
      welcomeActionsByContext: {
        product: [{ title: 'Bu urun bana uygun mu?' }, { title: 'Yorumlari ozetle' }],
      },
    });

    chat.open();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockedSendChatMessage).toHaveBeenCalledTimes(1);
    expect(capturedRequest?.type).toBe('launchSingleProduct');
    expect(capturedRequest?.sku).toBe('9209341100');
    expect(capturedRequest?.payload).toEqual(
      expect.objectContaining({
        sku: '9209341100',
        opening_message: 'Bu urunun one cikan taraflarini hemen ozetle.',
        opening_guidance: 'Kisa bir ilk degerlendirme ver, sonra yorum ve alternatif sorularina gec.',
      }),
    );

    const shadow = (chat as unknown as Record<string, unknown>)['_shadow'] as ShadowRoot | null;
    const pills = shadow?.querySelectorAll('.gengage-chat-pill');
    expect(pills?.length).toBe(2);
    expect(pills?.[0]?.textContent).toContain('Bu urun bana uygun mu?');
    expect(pills?.[1]?.textContent).toContain('Yorumlari ozetle');

    chat.destroy();
  });

  it('turns PDP review starter chips into a real reviewSummary action when product context exists', async () => {
    const capturedRequests: ProcessActionRequest[] = [];
    mockedSendChatMessage.mockImplementation((request, callbacks) => {
      capturedRequests.push(request);
      return respondDone(callbacks);
    });

    const chat = new GengageChat();
    await chat.init({
      accountId: 'test',
      middlewareUrl: 'https://test.example.com',
      mountTarget: '#chat-root',
      session: { sessionId: 'test-session' },
      pageContext: {
        pageType: 'pdp',
        sku: '9209341100',
      },
      openingMessagesByContext: {
        product: 'Bu urunun one cikan taraflarini hemen ozetle.',
      },
      welcomeActionsByContext: {
        product: [
          { title: 'Benzer alternatifleri goster', icon: 'similar' },
          { title: 'Yorumlari ozetle', icon: 'review' },
        ],
      },
    });

    chat.open();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const shadow = (chat as unknown as Record<string, unknown>)['_shadow'] as ShadowRoot | null;
    const pills = shadow?.querySelectorAll('.gengage-chat-pill');
    expect(pills?.length).toBe(2);

    (pills?.[1] as HTMLButtonElement | undefined)?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(capturedRequests).toHaveLength(2);
    expect(capturedRequests[1]?.type).toBe('reviewSummary');
    expect(capturedRequests[1]?.payload).toEqual(
      expect.objectContaining({
        sku: '9209341100',
      }),
    );

    chat.destroy();
  });

  it('turns listing compare starter chips into a real comparison action when visible SKUs exist', async () => {
    const capturedRequests: ProcessActionRequest[] = [];
    mockedSendChatMessage.mockImplementation((request, callbacks) => {
      capturedRequests.push(request);
      return respondDone(callbacks);
    });

    const chat = new GengageChat();
    await chat.init({
      accountId: 'test',
      middlewareUrl: 'https://test.example.com',
      mountTarget: '#chat-root',
      session: { sessionId: 'test-session' },
      pageContext: {
        pageType: 'search',
        extra: {
          search_query: 'klima',
          visible_skus: ['SKU-1', 'SKU-2', 'SKU-3'],
        },
      },
      openingMessagesByContext: {
        listing: 'Bu listedeki secenekleri birlikte daraltalim.',
      },
      welcomeActionsByContext: {
        listing: [{ title: 'Bu listedeki farklari ozetle', icon: 'compare' }],
      },
    });

    chat.open();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const shadow = (chat as unknown as Record<string, unknown>)['_shadow'] as ShadowRoot | null;
    const pills = shadow?.querySelectorAll('.gengage-chat-pill');
    expect(pills?.length).toBe(1);

    (pills?.[0] as HTMLButtonElement | undefined)?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(capturedRequests).toHaveLength(2);
    expect(capturedRequests[1]?.type).toBe('getComparisonTable');
    expect(capturedRequests[1]?.payload).toEqual(
      expect.objectContaining({
        sku_list: ['SKU-1', 'SKU-2'],
      }),
    );

    chat.destroy();
  });
});

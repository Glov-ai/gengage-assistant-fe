import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GengageChat } from '../src/chat/index.js';
import { sendChatMessage } from '../src/chat/api.js';

vi.mock('../src/chat/api.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/chat/api.js')>();
  return {
    ...actual,
    sendChatMessage: vi.fn(),
  };
});

const mockedSendChatMessage = sendChatMessage as unknown as ReturnType<typeof vi.fn>;
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

function getChatShadow(): ShadowRoot {
  const host = document.querySelector<HTMLElement>('[data-gengage-widget="gengagechat"]');
  expect(host).toBeTruthy();
  expect(host?.shadowRoot).toBeTruthy();
  return host!.shadowRoot!;
}

async function createChat(): Promise<GengageChat> {
  const chat = new GengageChat();
  await chat.init({
    accountId: 'test-account',
    middlewareUrl: 'https://test.example.com',
    session: { sessionId: 'test-session' },
  });
  return chat;
}

describe('Chat panel loading regression', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
  });

  it('clears panel loading skeleton when stream ends without panel ui_spec', async () => {
    mockedSendChatMessage.mockImplementation((_request, callbacks) => {
      callbacks.onMetadata({
        type: 'metadata',
        sessionId: '',
        model: '',
        meta: { panelLoading: true },
      } as never);

      setTimeout(() => callbacks.onDone(), 0);
      return new AbortController();
    });

    const chat = await createChat();
    chat.openWithAction({
      title: 'Soru',
      type: 'user_message',
      payload: 'Urun detayini goster',
    });

    const shadow = getChatShadow();
    expect(shadow.querySelector('.gengage-chat-panel-skeleton')).toBeTruthy();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(shadow.querySelector('.gengage-chat-panel-skeleton')).toBeNull();
    // Panel hides when cleared — no empty panel left visible
    expect(shadow.querySelector('.gengage-chat-drawer--with-panel')).toBeNull();
    chat.destroy();
  });

  it('keeps panel content when panel ui_spec arrives before stream end', async () => {
    mockedSendChatMessage.mockImplementation((_request, callbacks) => {
      callbacks.onMetadata({
        type: 'metadata',
        sessionId: '',
        model: '',
        meta: { panelLoading: true },
      } as never);

      callbacks.onUISpec(
        {
          root: 'root',
          elements: {
            root: {
              type: 'ProductCard',
              props: {
                product: {
                  sku: 'SKU-1',
                  name: 'Ornek Urun',
                  price: '1.000 TL',
                  url: 'https://example.com/p/SKU-1',
                },
              },
            },
          },
        },
        'chat',
        'panel',
      );
      callbacks.onDone();
      return new AbortController();
    });

    const chat = await createChat();
    chat.openWithAction({
      title: 'Soru',
      type: 'user_message',
      payload: 'Detay',
    });

    const shadow = getChatShadow();
    expect(shadow.querySelector('.gengage-chat-panel-skeleton')).toBeNull();
    expect(shadow.querySelector('.gengage-chat-panel--visible')).toBeTruthy();

    const title = shadow.querySelector('.gengage-chat-product-details-title');
    expect(title?.textContent).toContain('Ornek Urun');
    chat.destroy();
  });

  it('clears stale panel content when a text request ends after panel loading without new panel ui', async () => {
    mockedSendChatMessage.mockImplementation((_request, callbacks) => {
      const callIndex = mockedSendChatMessage.mock.calls.length;

      if (callIndex === 1) {
        callbacks.onUISpec(
          {
            root: 'root',
            elements: {
              root: {
                type: 'ProductCard',
                props: {
                  product: {
                    sku: 'SKU-1',
                    name: 'Ornek Urun',
                    price: '1.000 TL',
                    url: 'https://example.com/p/SKU-1',
                  },
                },
              },
            },
          },
          'chat',
          'panel',
        );
        callbacks.onDone();
        return new AbortController();
      }

      callbacks.onMetadata({
        type: 'metadata',
        sessionId: '',
        model: '',
        meta: { panelLoading: true, panelPendingType: 'productList' },
      } as never);

      setTimeout(() => callbacks.onDone(), 0);
      return new AbortController();
    });

    const chat = await createChat();
    chat.openWithAction({
      title: 'Detay',
      type: 'user_message',
      payload: 'Ilk urunu goster',
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    let shadow = getChatShadow();
    expect(shadow.querySelector('.gengage-chat-panel--visible')).toBeTruthy();
    expect(shadow.querySelector('.gengage-chat-product-details-title')?.textContent).toContain('Ornek Urun');

    chat.openWithAction({
      title: 'Ara',
      type: 'user_message',
      payload: 'matkap bul',
    });

    shadow = getChatShadow();
    expect(shadow.querySelector('.gengage-chat-panel-skeleton')).toBeTruthy();

    await new Promise((resolve) => setTimeout(resolve, 0));

    shadow = getChatShadow();
    expect(shadow.querySelector('.gengage-chat-panel-skeleton')).toBeNull();
    expect(shadow.querySelector('.gengage-chat-drawer--with-panel')).toBeNull();
    expect(shadow.querySelector('.gengage-chat-product-details-title')).toBeNull();
    chat.destroy();
  });
});

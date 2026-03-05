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

describe('Chat panel state restore', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    sessionStorage.clear();
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

  it('keeps restored collapsed preference in auto panel mode', async () => {
    sessionStorage.setItem('gengage:panel:test-account', 'collapsed');

    mockedSendChatMessage.mockImplementation((_request, callbacks) => {
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

    const chat = new GengageChat();
    await chat.init({
      accountId: 'test-account',
      session: { sessionId: 'test-session' },
    });

    chat.openWithAction({
      title: 'Soru',
      type: 'user_message',
      payload: 'Detaylari goster',
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const shadow = getChatShadow();
    const panel = shadow.querySelector('.gengage-chat-panel');
    expect(panel?.classList.contains('gengage-chat-panel--collapsed')).toBe(true);

    chat.destroy();
  });
});

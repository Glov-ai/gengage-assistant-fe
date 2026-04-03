import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GengageSimBut } from '../src/simbut/index.js';

describe('GengageSimBut', () => {
  let mount: HTMLDivElement;

  beforeEach(() => {
    mount = document.createElement('div');
    mount.id = 'simbut-mount';
    document.body.appendChild(mount);
  });

  afterEach(() => {
    mount.remove();
  });

  it('click calls chat.openWithAction with findSimilar payload', async () => {
    const openWithAction = vi.fn();
    const chat = { openWithAction } as unknown as import('../src/chat/index.js').GengageChat;

    const w = new GengageSimBut();
    await w.init({
      accountId: 'acc',
      middlewareUrl: 'https://example.com',
      mountTarget: '#simbut-mount',
      pageContext: { pageType: 'pdp', sku: 'SKU-1' },
      chat,
    });

    const btn = mount.querySelector('.gengage-chat-find-similar-pill') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    btn.click();

    expect(openWithAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'findSimilar',
        payload: { sku: 'SKU-1' },
      }),
      { sku: 'SKU-1' },
    );

    w.destroy();
  });

  it('includes image_url when imageUrl is safe', async () => {
    const openWithAction = vi.fn();
    const chat = { openWithAction } as unknown as import('../src/chat/index.js').GengageChat;

    const w = new GengageSimBut();
    await w.init({
      accountId: 'acc',
      middlewareUrl: 'https://example.com',
      mountTarget: '#simbut-mount',
      pageContext: { pageType: 'pdp', sku: 'SKU-2' },
      imageUrl: 'https://cdn.example.com/p.jpg',
      chat,
    });

    const btn = mount.querySelector('.gengage-chat-find-similar-pill') as HTMLButtonElement;
    btn.click();

    expect(openWithAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'findSimilar',
        payload: { sku: 'SKU-2', image_url: 'https://cdn.example.com/p.jpg' },
      }),
      { sku: 'SKU-2' },
    );

    w.destroy();
  });
});

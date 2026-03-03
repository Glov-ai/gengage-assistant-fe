import { describe, it, expect, vi } from 'vitest';
import { ChatDrawer } from '../src/chat/components/ChatDrawer.js';
import { CHAT_I18N_EN } from '../src/chat/locales/en.js';

function createDrawer(onLinkClick: (url: string) => void) {
  const container = document.createElement('div');
  return new ChatDrawer(container, {
    i18n: CHAT_I18N_EN,
    onSend: vi.fn(),
    onClose: vi.fn(),
    onLinkClick,
  });
}

describe('Link interception in bot HTML', () => {
  it('intercepts link clicks in assistant messages', () => {
    const onLinkClick = vi.fn();
    const drawer = createDrawer(onLinkClick);

    drawer.addMessage({
      id: 'msg-1',
      role: 'assistant',
      content: '<p>Visit <a href="https://example.com/product">this product</a></p>',
      timestamp: Date.now(),
      status: 'done',
    });

    const el = drawer.getElement();
    const link = el.querySelector('.gengage-chat-bubble--assistant a[href]') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('https://example.com/product');

    // Simulate click
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);

    expect(onLinkClick).toHaveBeenCalledWith('https://example.com/product');
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not intercept links in user messages', () => {
    const onLinkClick = vi.fn();
    const drawer = createDrawer(onLinkClick);

    drawer.addMessage({
      id: 'msg-2',
      role: 'user',
      content: 'Check https://example.com',
      timestamp: Date.now(),
      status: 'done',
    });

    const el = drawer.getElement();
    const links = el.querySelectorAll('.gengage-chat-bubble--user a[href]');
    expect(links).toHaveLength(0);
    expect(onLinkClick).not.toHaveBeenCalled();
  });

  it('does not intercept when onLinkClick is not provided', () => {
    const container = document.createElement('div');
    const drawer = new ChatDrawer(container, {
      i18n: CHAT_I18N_EN,
      onSend: vi.fn(),
      onClose: vi.fn(),
    });

    drawer.addMessage({
      id: 'msg-3',
      role: 'assistant',
      content: '<p><a href="https://example.com">Link</a></p>',
      timestamp: Date.now(),
      status: 'done',
    });

    const el = drawer.getElement();
    const link = el.querySelector('.gengage-chat-bubble--assistant a[href]') as HTMLAnchorElement;
    expect(link).not.toBeNull();

    // Click should not be prevented (no listener attached)
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

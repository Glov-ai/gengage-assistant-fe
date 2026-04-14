import { describe, it, expect, vi } from 'vitest';
import { createKvkkBanner } from '../src/chat/components/KvkkBanner.js';
import { ChatDrawer } from '../src/chat/components/ChatDrawer.js';
import { CHAT_I18N_TR } from '../src/chat/locales/index.js';

function makeDrawer() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const drawer = new ChatDrawer(container, {
    i18n: CHAT_I18N_TR,
    onSend: vi.fn(),
    onClose: vi.fn(),
  });
  return { drawer, container };
}

describe('KvkkBanner', () => {
  it('renders a banner with the provided HTML content', () => {
    const el = createKvkkBanner({
      htmlContent: '<p>KVKK uyarisi <a href="https://example.com">Detaylar</a></p>',
      onDismiss: () => {},
    });
    expect(el.classList.contains('gengage-chat-kvkk-banner')).toBe(true);
    expect(el.classList.contains('gds-evidence-card')).toBe(true);
    expect(el.getAttribute('role')).toBe('alert');
    expect(el.querySelector('a')?.href).toBe('https://example.com/');
    expect(el.querySelector('a')?.target).toBe('_blank');
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    let dismissed = false;
    const el = createKvkkBanner({
      htmlContent: '<p>Notice</p>',
      onDismiss: () => {
        dismissed = true;
      },
    });
    el.querySelector('button')?.click();
    expect(dismissed).toBe(true);
  });

  it('sanitizes the HTML content', () => {
    const el = createKvkkBanner({
      htmlContent: '<script>alert(1)</script><p>Safe</p>',
      onDismiss: () => {},
    });
    expect(el.querySelector('script')).toBeNull();
    expect(el.querySelector('p')?.textContent).toBe('Safe');
  });

  it('renders the dismiss button with correct aria-label', () => {
    const el = createKvkkBanner({
      htmlContent: '<p>Test</p>',
      onDismiss: () => {},
    });
    const btn = el.querySelector('button');
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute('aria-label')).toBe('Close privacy notice');
    expect(btn?.textContent).toBe('\u00D7');
  });
});

describe('ChatDrawer.isKvkkBannerVisible', () => {
  it('returns false when no banner has been shown', () => {
    const { drawer } = makeDrawer();
    expect(drawer.isKvkkBannerVisible()).toBe(false);
  });

  it('returns true after showKvkkBanner', () => {
    const { drawer } = makeDrawer();
    drawer.showKvkkBanner('<p>KVKK metni</p>', () => {});
    expect(drawer.isKvkkBannerVisible()).toBe(true);
  });

  it('returns false after hideKvkkBanner', () => {
    const { drawer } = makeDrawer();
    drawer.showKvkkBanner('<p>KVKK metni</p>', () => {});
    drawer.hideKvkkBanner();
    expect(drawer.isKvkkBannerVisible()).toBe(false);
  });

  it('returns false after calling showKvkkBanner then dismiss callback', () => {
    const { drawer } = makeDrawer();
    drawer.showKvkkBanner('<p>KVKK metni</p>', () => {
      drawer.hideKvkkBanner();
    });
    expect(drawer.isKvkkBannerVisible()).toBe(true);
    drawer.hideKvkkBanner();
    expect(drawer.isKvkkBannerVisible()).toBe(false);
  });

  it('replaces existing banner when showKvkkBanner called again', () => {
    const { drawer, container } = makeDrawer();
    drawer.showKvkkBanner('<p>First</p>', () => {});
    drawer.showKvkkBanner('<p>Second</p>', () => {});
    expect(drawer.isKvkkBannerVisible()).toBe(true);
    // Only one banner should exist inside this drawer's slot
    const slot = container.querySelector('[data-gengage-part="chat-kvkk-slot"]');
    expect(slot?.childNodes.length).toBe(1);
  });
});

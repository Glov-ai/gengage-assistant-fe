import { describe, it, expect } from 'vitest';
import { createKvkkBanner } from '../src/chat/components/KvkkBanner.js';

describe('KvkkBanner', () => {
  it('renders a banner with the provided HTML content', () => {
    const el = createKvkkBanner({
      htmlContent: '<p>KVKK uyarisi <a href="https://example.com">Detaylar</a></p>',
      onDismiss: () => {},
    });
    expect(el.className).toBe('gengage-chat-kvkk-banner');
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
    expect(btn?.getAttribute('aria-label')).toBe('KVKK bildirimini kapat');
    expect(btn?.textContent).toBe('\u00D7');
  });
});

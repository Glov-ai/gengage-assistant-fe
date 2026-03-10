import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChatDrawer } from '../src/chat/components/ChatDrawer.js';
import { CHAT_I18N_EN } from '../src/chat/locales/index.js';

function createDrawer() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const sendSpy = vi.fn();
  const drawer = new ChatDrawer(container, {
    i18n: CHAT_I18N_EN,
    onSend: sendSpy,
    onClose: vi.fn(),
  });
  return { container, drawer, sendSpy };
}

// jsdom does not provide URL.createObjectURL / revokeObjectURL
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock/1');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

// ---------------------------------------------------------------------------
// Dialog aria-describedby (GAP-098)
// ---------------------------------------------------------------------------

describe('ChatDrawer dialog a11y', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has aria-describedby pointing to a hidden description element', () => {
    const { container } = createDrawer();
    const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
    const descId = dialog.getAttribute('aria-describedby');
    expect(descId).toBe('gengage-chat-dialog-desc');

    const descEl = dialog.querySelector(`#${descId}`) as HTMLElement;
    expect(descEl).not.toBeNull();
    expect(descEl.classList.contains('gengage-sr-only')).toBe(true);
    expect(descEl.textContent).toBeTruthy();
    container.remove();
  });
});

// ---------------------------------------------------------------------------
// Send button disabled state (GAP-096)
// ---------------------------------------------------------------------------

describe('ChatDrawer send button disabled state', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('send button is disabled on initial render', () => {
    const { container } = createDrawer();
    const sendBtn = container.querySelector('.gengage-chat-send') as HTMLButtonElement;
    expect(sendBtn.disabled).toBe(true);
    container.remove();
  });

  it('send button becomes enabled when user types text', () => {
    const { container } = createDrawer();
    const input = container.querySelector('.gengage-chat-input') as HTMLTextAreaElement;
    const sendBtn = container.querySelector('.gengage-chat-send') as HTMLButtonElement;

    input.value = 'hello';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(sendBtn.disabled).toBe(false);
    container.remove();
  });

  it('send button returns to disabled when text is cleared', () => {
    const { container } = createDrawer();
    const input = container.querySelector('.gengage-chat-input') as HTMLTextAreaElement;
    const sendBtn = container.querySelector('.gengage-chat-send') as HTMLButtonElement;

    input.value = 'hello';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(sendBtn.disabled).toBe(false);

    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(sendBtn.disabled).toBe(true);
    container.remove();
  });

  it('send button is enabled when attachment is staged (no text)', () => {
    const { container, drawer } = createDrawer();
    const sendBtn = container.querySelector('.gengage-chat-send') as HTMLButtonElement;

    const file = new File(['img-data'], 'photo.jpg', { type: 'image/jpeg' });
    drawer.stageAttachment(file);

    expect(sendBtn.disabled).toBe(false);
    container.remove();
  });

  it('send button returns to disabled after attachment is cleared', () => {
    const { container, drawer } = createDrawer();
    const sendBtn = container.querySelector('.gengage-chat-send') as HTMLButtonElement;

    const file = new File(['img-data'], 'photo.jpg', { type: 'image/jpeg' });
    drawer.stageAttachment(file);
    expect(sendBtn.disabled).toBe(false);

    drawer.clearAttachment();
    expect(sendBtn.disabled).toBe(true);
    container.remove();
  });

  it('send button is disabled after submit clears input', () => {
    const { container } = createDrawer();
    const input = container.querySelector('.gengage-chat-input') as HTMLTextAreaElement;
    const sendBtn = container.querySelector('.gengage-chat-send') as HTMLButtonElement;

    input.value = 'hello';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(sendBtn.disabled).toBe(false);

    // Simulate Enter key to submit
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(sendBtn.disabled).toBe(true);
    container.remove();
  });

  it('whitespace-only text keeps send button disabled', () => {
    const { container } = createDrawer();
    const input = container.querySelector('.gengage-chat-input') as HTMLTextAreaElement;
    const sendBtn = container.querySelector('.gengage-chat-send') as HTMLButtonElement;

    input.value = '   ';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(sendBtn.disabled).toBe(true);
    container.remove();
  });
});

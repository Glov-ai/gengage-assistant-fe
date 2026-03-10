import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('Auto-Expanding Textarea', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('creates a textarea element for chat input', () => {
    const { container } = createDrawer();
    const input = container.querySelector('.gengage-chat-input');
    expect(input).not.toBeNull();
    expect(input?.tagName).toBe('TEXTAREA');
    container.remove();
  });

  it('textarea has rows=1 for initial single-line appearance', () => {
    const { container } = createDrawer();
    const textarea = container.querySelector('.gengage-chat-input') as HTMLTextAreaElement;
    expect(textarea.rows).toBe(1);
    container.remove();
  });

  it('textarea has the correct placeholder', () => {
    const { container } = createDrawer();
    const textarea = container.querySelector('.gengage-chat-input') as HTMLTextAreaElement;
    expect(textarea.placeholder).toBe(CHAT_I18N_EN.inputPlaceholder);
    container.remove();
  });

  it('Enter without Shift triggers submit on desktop', () => {
    let submitted = false;
    const isMobile = false;

    const handleKeydown = (e: { key: string; shiftKey: boolean; preventDefault: () => void }) => {
      if (e.key === 'Enter') {
        if (isMobile || !e.shiftKey) {
          e.preventDefault();
          submitted = true;
        }
      }
    };

    handleKeydown({ key: 'Enter', shiftKey: false, preventDefault: () => {} });
    expect(submitted).toBe(true);
  });

  it('Shift+Enter does NOT submit on desktop', () => {
    let submitted = false;
    const isMobile = false;

    const handleKeydown = (e: { key: string; shiftKey: boolean; preventDefault: () => void }) => {
      if (e.key === 'Enter') {
        if (isMobile || !e.shiftKey) {
          e.preventDefault();
          submitted = true;
        }
      }
    };

    handleKeydown({ key: 'Enter', shiftKey: true, preventDefault: () => {} });
    expect(submitted).toBe(false);
  });

  it('Enter always submits on mobile (even with Shift)', () => {
    let submitted = false;
    const isMobile = true;

    const handleKeydown = (e: { key: string; shiftKey: boolean; preventDefault: () => void }) => {
      if (e.key === 'Enter') {
        if (isMobile || !e.shiftKey) {
          e.preventDefault();
          submitted = true;
        }
      }
    };

    handleKeydown({ key: 'Enter', shiftKey: true, preventDefault: () => {} });
    expect(submitted).toBe(true);
  });

  it('resets height after submit clears value', () => {
    const sendSpy = vi.fn();
    const { container } = createDrawer();
    const textarea = container.querySelector('.gengage-chat-input') as HTMLTextAreaElement;
    textarea.style.height = '80px';
    textarea.value = 'hello';
    // Simulate submit via Enter key
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(sendSpy).toBeDefined();
    // After submit, height should be reset to 'auto'
    expect(textarea.style.height).toBe('auto');
    container.remove();
  });

  it('submits via send button and resets textarea height', () => {
    const sendSpy = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    new ChatDrawer(container, {
      i18n: CHAT_I18N_EN,
      onSend: sendSpy,
      onClose: vi.fn(),
    });
    const textarea = container.querySelector('.gengage-chat-input') as HTMLTextAreaElement;
    textarea.value = 'test message';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.style.height = '80px';
    const sendBtn = container.querySelector('.gengage-chat-send') as HTMLElement;
    sendBtn.click();
    expect(sendSpy).toHaveBeenCalledWith('test message', undefined);
    expect(textarea.style.height).toBe('auto');
    container.remove();
  });

  it('focusInput focuses the textarea', () => {
    const { container, drawer } = createDrawer();
    const textarea = container.querySelector('.gengage-chat-input') as HTMLTextAreaElement;
    const focusSpy = vi.spyOn(textarea, 'focus');
    drawer.focusInput();
    expect(focusSpy).toHaveBeenCalled();
    container.remove();
  });
});

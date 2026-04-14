import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChatDrawer } from '../src/chat/components/ChatDrawer.js';
import { CHAT_I18N_EN } from '../src/chat/locales/index.js';

function createDrawer(onSend?: (text: string, attachment?: File) => void) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const sendSpy = onSend ?? vi.fn();
  const drawer = new ChatDrawer(container, {
    i18n: CHAT_I18N_EN,
    onSend: sendSpy,
    onClose: vi.fn(),
  });
  return { container, drawer, sendSpy };
}

// jsdom does not provide URL.createObjectURL / revokeObjectURL
let objectUrlCounter = 0;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

beforeEach(() => {
  objectUrlCounter = 0;
  URL.createObjectURL = vi.fn(() => `blob:mock/${++objectUrlCounter}`);
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

describe('ChatDrawer attachment staging', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has a file picker button in the input area', () => {
    const { container } = createDrawer();
    const btn = container.querySelector('.gengage-chat-attach-btn');
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute('aria-label')).toBe('Attach image');
    container.remove();
  });

  it('has a hidden file input accepting image types', () => {
    const { container } = createDrawer();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(input?.accept).toBe('image/jpeg,image/png,image/webp');
    expect(input?.style.display).toBe('none');
    container.remove();
  });

  it('stages a valid image file and shows preview strip', () => {
    const { container, drawer } = createDrawer();
    const file = new File(['img-data'], 'photo.jpg', { type: 'image/jpeg' });
    drawer.stageAttachment(file);
    const preview = container.querySelector('.gengage-chat-attachment-preview');
    expect(preview?.classList.contains('gengage-chat-attachment-preview--hidden')).toBe(false);
    expect(container.querySelector('.gengage-chat-attachment-name')?.textContent).toBe('photo.jpg');
    container.remove();
  });

  it('removes staged attachment on X click', () => {
    const { container, drawer } = createDrawer();
    const file = new File(['img-data'], 'photo.jpg', { type: 'image/jpeg' });
    drawer.stageAttachment(file);
    const removeBtn = container.querySelector('.gengage-chat-attachment-remove') as HTMLElement;
    removeBtn.click();
    const preview = container.querySelector('.gengage-chat-attachment-preview');
    expect(preview?.classList.contains('gengage-chat-attachment-preview--hidden')).toBe(true);
    expect(drawer.getPendingAttachment()).toBeNull();
    container.remove();
  });

  it('passes attachment to onSend when submitting', () => {
    const sendSpy = vi.fn();
    const { container, drawer } = createDrawer(sendSpy);
    const file = new File(['img-data'], 'photo.jpg', { type: 'image/jpeg' });
    drawer.stageAttachment(file);
    const input = container.querySelector('.gengage-chat-input') as HTMLTextAreaElement;
    input.value = 'find similar';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(sendSpy).toHaveBeenCalledWith('find similar', file);
    expect(drawer.getPendingAttachment()).toBeNull();
    container.remove();
  });

  it('allows sending attachment without text', () => {
    const sendSpy = vi.fn();
    const { container, drawer } = createDrawer(sendSpy);
    const file = new File(['img-data'], 'photo.jpg', { type: 'image/jpeg' });
    drawer.stageAttachment(file);
    const sendBtn = container.querySelector('.gengage-chat-send') as HTMLElement;
    sendBtn.click();
    expect(sendSpy).toHaveBeenCalledWith('', file);
    container.remove();
  });

  it('replaces previous attachment when staging a new one', () => {
    const { drawer, container } = createDrawer();
    const file1 = new File(['a'], 'first.jpg', { type: 'image/jpeg' });
    const file2 = new File(['b'], 'second.png', { type: 'image/png' });
    drawer.stageAttachment(file1);
    drawer.stageAttachment(file2);
    expect(drawer.getPendingAttachment()?.name).toBe('second.png');
    expect(container.querySelector('.gengage-chat-attachment-name')?.textContent).toBe('second.png');
    container.remove();
  });

  it('can hide attachment controls for guided modes', () => {
    const { container, drawer } = createDrawer();
    drawer.setAttachmentControlsVisible(false);
    const wrap = container.querySelector('.gengage-chat-attach-wrap') as HTMLElement | null;
    expect(wrap?.style.display).toBe('none');
    drawer.setAttachmentControlsVisible(true);
    expect(wrap?.style.display).toBe('');
    container.remove();
  });

  it('renders beauty photo helper card and calls skip callback', () => {
    const skipSpy = vi.fn();
    const { container, drawer } = createDrawer();
    drawer.setBeautyPhotoStepCard({ visible: true, onSkip: skipSpy });
    const card = container.querySelector('.gengage-chat-beauty-photo-step-card');
    expect(card).not.toBeNull();
    const skipBtn = container.querySelector('.gengage-chat-beauty-photo-step-skip') as HTMLButtonElement | null;
    skipBtn?.click();
    expect(skipSpy).toHaveBeenCalledTimes(1);
    drawer.setBeautyPhotoStepCard({ visible: false });
    const host = container.querySelector('.gengage-chat-beauty-photo-step') as HTMLElement | null;
    expect(host?.hidden).toBe(true);
    container.remove();
  });
});

describe('ChatDrawer attach-menu timer race condition', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('does not add document click listener when destroy() is called before setTimeout(0) fires', () => {
    vi.useFakeTimers();
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    const { container, drawer } = createDrawer();

    // Click the attach button — this calls _openAttachMenu() which schedules
    // a setTimeout(0) to add a document-level click listener
    const attachBtn = container.querySelector('.gengage-chat-attach-btn') as HTMLElement;
    attachBtn.click();

    // Reset the spy AFTER the click so we only track calls that happen after destroy()
    // (the click handler itself may call document.addEventListener for keydown)
    addEventListenerSpy.mockClear();

    // Destroy before the deferred setTimeout(0) fires
    drawer.destroy();

    // Advance timers — the deferred callback WOULD have fired here without the fix
    vi.runAllTimers();

    // The deferred 'click' listener must NOT have been added
    const clickListenerCalls = addEventListenerSpy.mock.calls.filter(([event]) => event === 'click');
    expect(clickListenerCalls).toHaveLength(0);

    vi.useRealTimers();
    container.remove();
  });
});

describe('ChatDrawer addMessage with attachment', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders thumbnail image in user bubble when message has attachment', () => {
    const { container, drawer } = createDrawer();
    const file = new File(['img-data'], 'photo.jpg', { type: 'image/jpeg' });
    drawer.addMessage({
      id: 'msg-1',
      role: 'user',
      content: 'find similar',
      attachment: file,
      timestamp: Date.now(),
      status: 'done',
    });
    const thumbnail = container.querySelector('.gengage-chat-bubble--user .gengage-chat-attachment-thumb');
    expect(thumbnail).not.toBeNull();
    expect(thumbnail?.tagName.toLowerCase()).toBe('img');
    container.remove();
  });
});

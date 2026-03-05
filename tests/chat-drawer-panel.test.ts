import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChatDrawer } from '../src/chat/components/ChatDrawer.js';
import { CHAT_I18N_TR } from '../src/chat/locales/index.js';

function createDrawer() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const drawer = new ChatDrawer(container, {
    i18n: CHAT_I18N_TR,
    onSend: () => {},
    onClose: () => {},
  });
  return { container, drawer };
}

function createTouchEvent(type: string, clientX: number, clientY: number): Event {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, 'changedTouches', {
    value: [{ clientX, clientY }],
  });
  return event;
}

function setViewportWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
}

describe('ChatDrawer panel collapse/expand', () => {
  let container: HTMLElement;
  let drawer: ChatDrawer;

  beforeEach(() => {
    document.body.innerHTML = '';
    sessionStorage.clear();
    ({ container, drawer } = createDrawer());
  });

  afterEach(() => {
    container.remove();
  });

  it('has a divider element between panel and conversation', () => {
    const divider = container.querySelector('.gengage-chat-panel-divider');
    expect(divider).not.toBeNull();
  });

  it('divider is hidden when panel has no content', () => {
    const divider = container.querySelector('.gengage-chat-panel-divider') as HTMLElement;
    expect(divider.classList.contains('gengage-chat-panel-divider--hidden')).toBe(true);
  });

  it('divider becomes visible when panel content is set', () => {
    const content = document.createElement('div');
    content.textContent = 'Product details';
    drawer.setPanelContent(content);

    const divider = container.querySelector('.gengage-chat-panel-divider') as HTMLElement;
    expect(divider.classList.contains('gengage-chat-panel-divider--hidden')).toBe(false);
  });

  it('reports panel content when only topbar and main content are present', () => {
    const content = document.createElement('div');
    content.textContent = 'Comparison results';
    drawer.setPanelContent(content);

    expect(drawer.hasPanelContent()).toBe(true);
  });

  it('togglePanel collapses an expanded panel', () => {
    const content = document.createElement('div');
    drawer.setPanelContent(content);
    expect(drawer.isPanelCollapsed()).toBe(false);

    drawer.togglePanel();
    expect(drawer.isPanelCollapsed()).toBe(true);
  });

  it('togglePanel expands a collapsed panel', () => {
    const content = document.createElement('div');
    drawer.setPanelContent(content);
    drawer.togglePanel(); // collapse
    drawer.togglePanel(); // expand
    expect(drawer.isPanelCollapsed()).toBe(false);
  });

  it('collapsed panel has gengage-chat-panel--collapsed class', () => {
    const content = document.createElement('div');
    drawer.setPanelContent(content);
    drawer.togglePanel();

    const panel = container.querySelector('.gengage-chat-panel');
    expect(panel?.classList.contains('gengage-chat-panel--collapsed')).toBe(true);
  });

  it('clearPanel hides divider again', () => {
    const content = document.createElement('div');
    drawer.setPanelContent(content);
    drawer.clearPanel();

    const divider = container.querySelector('.gengage-chat-panel-divider') as HTMLElement;
    expect(divider.classList.contains('gengage-chat-panel-divider--hidden')).toBe(true);
  });

  it('clearPanel keeps collapsed preference for the next panel render', () => {
    const content = document.createElement('div');
    drawer.setPanelContent(content);
    drawer.togglePanel();
    expect(drawer.isPanelCollapsed()).toBe(true);

    drawer.clearPanel();

    const nextContent = document.createElement('div');
    drawer.setPanelContent(nextContent);
    const panel = container.querySelector('.gengage-chat-panel');

    expect(drawer.isPanelCollapsed()).toBe(true);
    expect(panel?.classList.contains('gengage-chat-panel--collapsed')).toBe(true);
  });
});

describe('Panel sessionStorage persistence', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    sessionStorage.clear();
  });

  it('stores collapsed state in sessionStorage', () => {
    const { drawer, container } = createDrawer();
    const content = document.createElement('div');
    drawer.setPanelContent(content);
    drawer.persistPanelState('testaccount');

    expect(sessionStorage.getItem('gengage:panel:testaccount')).toBeNull();

    drawer.togglePanel(); // collapse
    drawer.persistPanelState('testaccount');

    expect(sessionStorage.getItem('gengage:panel:testaccount')).toBe('collapsed');
    container.remove();
  });

  it('restores collapsed state from sessionStorage', () => {
    sessionStorage.setItem('gengage:panel:testaccount', 'collapsed');

    const { drawer, container } = createDrawer();
    drawer.restorePanelState('testaccount');

    const content = document.createElement('div');
    drawer.setPanelContent(content);

    expect(drawer.isPanelCollapsed()).toBe(true);
    container.remove();
  });

  it('clears sessionStorage on expand', () => {
    sessionStorage.setItem('gengage:panel:testaccount', 'collapsed');

    const { drawer, container } = createDrawer();
    drawer.restorePanelState('testaccount');
    drawer.togglePanel(); // expand
    drawer.persistPanelState('testaccount');

    expect(sessionStorage.getItem('gengage:panel:testaccount')).toBeNull();
    container.remove();
  });
});

describe('Panel expanded-start mode', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('setForceExpanded shows panel immediately even without content', () => {
    const { drawer, container } = createDrawer();
    drawer.setForceExpanded();

    const panel = container.querySelector('.gengage-chat-panel');
    expect(panel?.classList.contains('gengage-chat-panel--visible')).toBe(true);
    container.remove();
  });

  it('togglePanel can still collapse after setForceExpanded', () => {
    const { drawer, container } = createDrawer();
    drawer.setForceExpanded();
    drawer.togglePanel();

    expect(drawer.isPanelCollapsed()).toBe(true);
    container.remove();
  });

  it('setPanelCollapsed(true) works after setForceExpanded', () => {
    const { drawer, container } = createDrawer();
    drawer.setForceExpanded();
    drawer.setPanelCollapsed(true);

    expect(drawer.isPanelCollapsed()).toBe(true);
    const panel = container.querySelector('.gengage-chat-panel');
    expect(panel?.classList.contains('gengage-chat-panel--collapsed')).toBe(true);
    container.remove();
  });

  it('clearPanel hides panel even in force-expanded mode', () => {
    const { drawer, container } = createDrawer();
    drawer.setForceExpanded();
    const content = document.createElement('div');
    drawer.setPanelContent(content);
    drawer.clearPanel();

    const panel = container.querySelector('.gengage-chat-panel');
    expect(panel?.classList.contains('gengage-chat-panel--visible')).toBe(false);
    container.remove();
  });

  it('divider toggle remains visible in expanded-start mode', () => {
    const { drawer, container } = createDrawer();
    drawer.setForceExpanded();

    const divider = container.querySelector('.gengage-chat-panel-divider') as HTMLElement;
    expect(divider.classList.contains('gengage-chat-panel-divider--hidden')).toBe(false);
    container.remove();
  });
});

describe('Panel mobile swipe gestures', () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    document.body.innerHTML = '';
    sessionStorage.clear();
    setViewportWidth(390);
  });

  afterEach(() => {
    setViewportWidth(originalInnerWidth);
  });

  it('swipe up on divider collapses an expanded panel', () => {
    const { drawer, container } = createDrawer();
    const content = document.createElement('div');
    drawer.setPanelContent(content);

    const divider = container.querySelector('.gengage-chat-panel-divider') as HTMLElement;
    divider.dispatchEvent(createTouchEvent('touchstart', 120, 220));
    divider.dispatchEvent(createTouchEvent('touchend', 124, 140));

    expect(drawer.isPanelCollapsed()).toBe(true);
    container.remove();
  });

  it('swipe down on divider expands a collapsed panel', () => {
    const { drawer, container } = createDrawer();
    const content = document.createElement('div');
    drawer.setPanelContent(content);
    drawer.togglePanel();
    expect(drawer.isPanelCollapsed()).toBe(true);

    const divider = container.querySelector('.gengage-chat-panel-divider') as HTMLElement;
    divider.dispatchEvent(createTouchEvent('touchstart', 120, 140));
    divider.dispatchEvent(createTouchEvent('touchend', 124, 220));

    expect(drawer.isPanelCollapsed()).toBe(false);
    container.remove();
  });

  it('ignores horizontal swipe gestures on divider', () => {
    const { drawer, container } = createDrawer();
    const content = document.createElement('div');
    drawer.setPanelContent(content);

    const divider = container.querySelector('.gengage-chat-panel-divider') as HTMLElement;
    divider.dispatchEvent(createTouchEvent('touchstart', 100, 180));
    divider.dispatchEvent(createTouchEvent('touchend', 180, 185));

    expect(drawer.isPanelCollapsed()).toBe(false);
    container.remove();
  });

  it('ignores the first click after a swipe toggle to avoid accidental bounce', () => {
    const { drawer, container } = createDrawer();
    const content = document.createElement('div');
    drawer.setPanelContent(content);

    const divider = container.querySelector('.gengage-chat-panel-divider') as HTMLElement;
    divider.dispatchEvent(createTouchEvent('touchstart', 120, 220));
    divider.dispatchEvent(createTouchEvent('touchend', 120, 140));
    expect(drawer.isPanelCollapsed()).toBe(true);

    const toggle = container.querySelector('.gengage-chat-panel-divider-toggle') as HTMLButtonElement;
    toggle.click();
    expect(drawer.isPanelCollapsed()).toBe(true);

    toggle.click();
    expect(drawer.isPanelCollapsed()).toBe(false);
    container.remove();
  });
});

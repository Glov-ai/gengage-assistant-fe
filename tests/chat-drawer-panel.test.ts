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

describe('Panel force-expanded mode', () => {
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

  it('togglePanel is a no-op in force-expanded mode', () => {
    const { drawer, container } = createDrawer();
    drawer.setForceExpanded();
    drawer.togglePanel();

    expect(drawer.isPanelCollapsed()).toBe(false);
    container.remove();
  });

  it('setPanelCollapsed is a no-op in force-expanded mode', () => {
    const { drawer, container } = createDrawer();
    drawer.setForceExpanded();
    drawer.setPanelCollapsed(true);

    expect(drawer.isPanelCollapsed()).toBe(false);
    const panel = container.querySelector('.gengage-chat-panel');
    expect(panel?.classList.contains('gengage-chat-panel--collapsed')).toBe(false);
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

  it('divider toggle is hidden in force-expanded mode', () => {
    const { drawer, container } = createDrawer();
    drawer.setForceExpanded();

    const divider = container.querySelector('.gengage-chat-panel-divider') as HTMLElement;
    expect(divider.classList.contains('gengage-chat-panel-divider--hidden')).toBe(true);
    container.remove();
  });
});

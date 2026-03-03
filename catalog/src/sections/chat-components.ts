/**
 * Renders individual chat components in isolation using the real registry.
 * Components are wrapped in a chat-drawer-like frame to show how they
 * actually appear in production.
 */

import { renderUISpecWithRegistry } from '@gengage/assistant-fe/common';
import { createDefaultChatUISpecRegistry } from '@gengage/assistant-fe/chat';
import { CHAT_SPECS } from '../mock-data/chat-specs.js';
import { createNoopChatContext, setCurrentConsole } from '../utils/noop-context.js';

export const CHAT_COMPONENT_NAMES = Object.keys(CHAT_SPECS);

/** Components that render in the side panel (not the message stream). */
const PANEL_COMPONENTS = new Set(['ProductDetailsPanel']);

export function renderChatComponent(container: HTMLElement, name: string): void {
  const entry = CHAT_SPECS[name];
  if (!entry) {
    container.innerHTML = `<p>Unknown chat component: ${name}</p>`;
    return;
  }

  const card = document.createElement('div');
  card.className = 'catalog-card';

  // Header
  const header = document.createElement('div');
  header.className = 'catalog-card-header';
  const h3 = document.createElement('h3');
  h3.textContent = `Chat / ${name}`;
  header.appendChild(h3);
  const desc = document.createElement('p');
  desc.textContent = entry.description;
  header.appendChild(desc);
  card.appendChild(header);

  // Preview area
  const preview = document.createElement('div');
  preview.className = 'catalog-card-preview';

  // Render the component DOM
  let componentDom: HTMLElement;
  try {
    const registry = createDefaultChatUISpecRegistry();
    const ctx = createNoopChatContext();
    const spec = entry.spec as { root: string; elements: Record<string, { type: string; props?: Record<string, unknown>; children?: string[] }> };
    componentDom = renderUISpecWithRegistry({
      spec,
      context: ctx,
      registry,
      containerClassName: 'gengage-chat-uispec',
    });
  } catch (err) {
    const errEl = document.createElement('pre');
    errEl.style.color = 'red';
    errEl.textContent = `Render error: ${err instanceof Error ? err.message : String(err)}`;
    preview.appendChild(errEl);
    card.appendChild(preview);
    container.appendChild(card);
    return;
  }

  // Wrap in the appropriate frame
  if (PANEL_COMPONENTS.has(name)) {
    preview.appendChild(buildPanelFrame(componentDom));
  } else {
    preview.appendChild(buildChatFrame(componentDom));
  }

  card.appendChild(preview);

  // Mini console for action logs
  const consoleEl = document.createElement('div');
  consoleEl.className = 'catalog-card-console';
  setCurrentConsole(consoleEl);
  card.appendChild(consoleEl);

  // Collapsible UISpec JSON source
  const source = document.createElement('details');
  source.className = 'catalog-card-source';
  const summary = document.createElement('summary');
  summary.textContent = 'UISpec JSON';
  source.appendChild(summary);
  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify(entry.spec, null, 2);
  source.appendChild(pre);
  card.appendChild(source);

  container.appendChild(card);
}

/** Builds a chat-drawer-like frame with header + message area. */
function buildChatFrame(componentDom: HTMLElement): HTMLElement {
  const frame = document.createElement('div');
  frame.className = 'catalog-chat-frame';

  // Header
  const hdr = document.createElement('div');
  hdr.className = 'catalog-chat-frame-header';

  const avatar = document.createElement('div');
  avatar.className = 'catalog-chat-frame-avatar';
  avatar.textContent = '🤖';
  hdr.appendChild(avatar);

  const info = document.createElement('div');
  info.className = 'catalog-chat-frame-info';
  const title = document.createElement('div');
  title.className = 'catalog-chat-frame-title';
  title.textContent = 'Gengage Asistan';
  info.appendChild(title);
  const subtitle = document.createElement('div');
  subtitle.className = 'catalog-chat-frame-subtitle';
  subtitle.textContent = 'Çevrimiçi';
  info.appendChild(subtitle);
  hdr.appendChild(info);

  const actions = document.createElement('div');
  actions.className = 'catalog-chat-frame-actions';
  for (const icon of ['⟵', '—', '✕']) {
    const btn = document.createElement('span');
    btn.className = 'catalog-chat-frame-btn';
    btn.textContent = icon;
    actions.appendChild(btn);
  }
  hdr.appendChild(actions);
  frame.appendChild(hdr);

  // Message body
  const body = document.createElement('div');
  body.className = 'catalog-chat-frame-body';
  body.appendChild(componentDom);
  frame.appendChild(body);

  return frame;
}

/** Builds a two-pane panel frame (panel + mini chat) for ProductDetailsPanel. */
function buildPanelFrame(componentDom: HTMLElement): HTMLElement {
  const frame = document.createElement('div');
  frame.className = 'catalog-panel-frame';

  // Left panel (product details)
  const sidebar = document.createElement('div');
  sidebar.className = 'catalog-panel-frame-sidebar';
  sidebar.appendChild(componentDom);
  frame.appendChild(sidebar);

  // Right chat pane
  const chat = document.createElement('div');
  chat.className = 'catalog-panel-frame-chat';

  const hdr = document.createElement('div');
  hdr.className = 'catalog-panel-frame-chat-header';
  const avatar = document.createElement('div');
  avatar.className = 'catalog-chat-frame-avatar';
  avatar.textContent = '🤖';
  hdr.appendChild(avatar);
  const title = document.createElement('div');
  title.style.cssText = 'font-size:14px;font-weight:700';
  title.textContent = 'Gengage Asistan';
  hdr.appendChild(title);
  chat.appendChild(hdr);

  const messages = document.createElement('div');
  messages.className = 'catalog-panel-frame-messages';

  // Fake conversation context
  const msgs = [
    'Bu ürün hakkında detaylı bilgi almak ister misiniz?',
    'İşte ürün detayları — sol panelden inceleyebilirsiniz.',
  ];
  for (const text of msgs) {
    const bubble = document.createElement('div');
    bubble.className = 'catalog-panel-frame-msg-placeholder';
    bubble.textContent = text;
    messages.appendChild(bubble);
  }
  chat.appendChild(messages);
  frame.appendChild(chat);

  return frame;
}

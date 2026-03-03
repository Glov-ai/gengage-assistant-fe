/**
 * Responsive preview: shows a selected component at 3 viewport widths.
 */

import { renderUISpecWithRegistry } from '@gengage/assistant-fe/common';
import { createDefaultChatUISpecRegistry } from '@gengage/assistant-fe/chat';
import { CHAT_SPECS } from '../mock-data/chat-specs.js';
import { createNoopChatContext } from '../utils/noop-context.js';

const VIEWPORTS = [
  { label: 'Mobile (375px)', width: 375, scale: 1 },
  { label: 'Tablet (768px)', width: 768, scale: 0.75 },
  { label: 'Desktop (1280px)', width: 1280, scale: 0.5 },
];

const COMPONENT_OPTIONS = Object.keys(CHAT_SPECS);

export function renderResponsivePreview(container: HTMLElement): void {
  const h2 = document.createElement('h2');
  h2.textContent = 'Responsive Preview';
  h2.style.marginBottom = '16px';
  container.appendChild(h2);

  // Component selector
  const selector = document.createElement('div');
  selector.className = 'catalog-component-select';

  const label = document.createElement('label');
  label.textContent = 'Component:';
  label.htmlFor = 'responsive-component-select';
  selector.appendChild(label);

  const select = document.createElement('select');
  select.id = 'responsive-component-select';
  for (const name of COMPONENT_OPTIONS) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (name === 'ProductGrid') opt.selected = true;
    select.appendChild(opt);
  }
  selector.appendChild(select);
  container.appendChild(selector);

  // Frames container
  const framesContainer = document.createElement('div');
  framesContainer.className = 'catalog-responsive-frames';
  container.appendChild(framesContainer);

  function renderFrames(componentName: string): void {
    framesContainer.innerHTML = '';
    const specEntry = CHAT_SPECS[componentName];
    if (!specEntry) return;

    for (const vp of VIEWPORTS) {
      const frame = document.createElement('div');
      frame.className = 'catalog-responsive-frame';

      const header = document.createElement('div');
      header.className = 'catalog-responsive-frame-header';
      header.textContent = vp.label;
      frame.appendChild(header);

      const body = document.createElement('div');
      body.className = 'catalog-responsive-frame-body';
      body.style.width = `${vp.width * vp.scale}px`;
      body.style.height = `${500 * vp.scale}px`;
      body.style.overflow = 'auto';

      const inner = document.createElement('div');
      inner.style.width = `${vp.width}px`;
      inner.style.transformOrigin = 'top left';
      inner.style.transform = `scale(${vp.scale})`;

      try {
        const registry = createDefaultChatUISpecRegistry();
        const ctx = createNoopChatContext();
        const spec = specEntry.spec as { root: string; elements: Record<string, { type: string; props?: Record<string, unknown>; children?: string[] }> };
        const dom = renderUISpecWithRegistry({
          spec,
          context: ctx,
          registry,
          containerClassName: 'gengage-chat-uispec',
        });
        inner.appendChild(dom);
      } catch (err) {
        inner.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
      }

      body.appendChild(inner);
      frame.appendChild(body);
      framesContainer.appendChild(frame);
    }
  }

  // Initial render
  renderFrames(select.value);

  select.addEventListener('change', () => {
    renderFrames(select.value);
  });
}

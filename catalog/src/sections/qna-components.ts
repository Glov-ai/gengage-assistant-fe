/**
 * Renders individual QNA components in isolation using the real registry.
 * Wrapped in a PDP-like frame to show context.
 */

import { renderUISpecWithRegistry } from '@gengage/assistant-fe/common';
import { createDefaultQnaUISpecRegistry } from '@gengage/assistant-fe/qna';
import { QNA_SPECS } from '../mock-data/qna-specs.js';
import { createNoopQnaContext, setCurrentConsole } from '../utils/noop-context.js';

export const QNA_COMPONENT_NAMES = Object.keys(QNA_SPECS);

export function renderQnaComponent(container: HTMLElement, name: string): void {
  const entry = QNA_SPECS[name];
  if (!entry) {
    container.innerHTML = `<p>Unknown QNA component: ${name}</p>`;
    return;
  }

  const card = document.createElement('div');
  card.className = 'catalog-card';

  // Header
  const header = document.createElement('div');
  header.className = 'catalog-card-header';
  const h3 = document.createElement('h3');
  h3.textContent = `QNA / ${name}`;
  header.appendChild(h3);
  const desc = document.createElement('p');
  desc.textContent = entry.description;
  header.appendChild(desc);
  card.appendChild(header);

  // Preview
  const preview = document.createElement('div');
  preview.className = 'catalog-card-preview';

  let componentDom: HTMLElement;
  try {
    const registry = createDefaultQnaUISpecRegistry();
    const ctx = createNoopQnaContext();
    const spec = entry.spec as { root: string; elements: Record<string, { type: string; props?: Record<string, unknown>; children?: string[] }> };
    componentDom = renderUISpecWithRegistry({
      spec,
      context: ctx,
      registry,
      containerClassName: 'gengage-qna-uispec',
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

  // QNA frame: PDP-like context header + component
  const frame = document.createElement('div');
  frame.className = 'catalog-qna-frame';

  const fhdr = document.createElement('div');
  fhdr.className = 'catalog-qna-frame-header';
  const prodTitle = document.createElement('h4');
  prodTitle.textContent = 'Bosch Professional GSB 18V-55 Akülü Darbeli Matkap';
  fhdr.appendChild(prodTitle);
  const price = document.createElement('div');
  price.className = 'price';
  price.textContent = '4.299,90 TL';
  fhdr.appendChild(price);
  frame.appendChild(fhdr);

  const body = document.createElement('div');
  body.className = 'catalog-qna-frame-body';
  body.appendChild(componentDom);
  frame.appendChild(body);

  preview.appendChild(frame);
  card.appendChild(preview);

  // Mini console
  const consoleEl = document.createElement('div');
  consoleEl.className = 'catalog-card-console';
  setCurrentConsole(consoleEl);
  card.appendChild(consoleEl);

  // Collapsible UISpec JSON
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

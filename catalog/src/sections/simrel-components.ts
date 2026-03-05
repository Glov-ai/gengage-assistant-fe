/**
 * Renders individual SimRel components in isolation using the real registry.
 * Wrapped in a PDP section-like frame.
 */

import { renderUISpecWithRegistry } from '@gengage/assistant-fe/common';
import { createDefaultSimRelUISpecRegistry } from '@gengage/assistant-fe/simrel';
import { SIMREL_SPECS } from '../mock-data/simrel-specs.js';
import { createNoopSimrelContext, setCurrentConsole } from '../utils/noop-context.js';

export const SIMREL_COMPONENT_NAMES = Object.keys(SIMREL_SPECS);

export function renderSimrelComponent(container: HTMLElement, name: string): void {
  const entry = SIMREL_SPECS[name];
  if (!entry) {
    container.innerHTML = `<p>Unknown SimRel component: ${name}</p>`;
    return;
  }

  const card = document.createElement('div');
  card.className = 'catalog-card';

  // Header
  const header = document.createElement('div');
  header.className = 'catalog-card-header';
  const h3 = document.createElement('h3');
  h3.textContent = `SimRel / ${name}`;
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
    const registry = createDefaultSimRelUISpecRegistry();
    const ctx = createNoopSimrelContext();
    const spec = entry.spec as {
      root: string;
      elements: Record<string, { type: string; props?: Record<string, unknown>; children?: string[] }>;
    };
    componentDom = renderUISpecWithRegistry({
      spec,
      context: ctx,
      registry,
      containerClassName: 'gengage-simrel-uispec',
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

  // SimRel frame: PDP section with title
  const frame = document.createElement('div');
  frame.className = 'catalog-simrel-frame';

  const fhdr = document.createElement('div');
  fhdr.className = 'catalog-simrel-frame-header';
  const sectionTitle = document.createElement('h4');
  sectionTitle.textContent = 'Benzer Ürünler';
  fhdr.appendChild(sectionTitle);
  frame.appendChild(fhdr);

  const body = document.createElement('div');
  body.className = 'catalog-simrel-frame-body';
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

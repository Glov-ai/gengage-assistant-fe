/**
 * Renders the SimBut widget in isolation using the real widget implementation.
 * SimBut is not UISpec-driven, so the catalog shows a live widget preview instead.
 */

import { GengageSimBut } from '@gengage/assistant-fe/simbut';
import { SIMBUT_SPECS } from '../mock-data/simbut-specs.js';
import { createSimbutPreviewFrame } from '../utils/simbut-frame.js';

export const SIMBUT_COMPONENT_NAMES = Object.keys(SIMBUT_SPECS);

export function renderSimbutComponent(container: HTMLElement, name: string): void {
  const entry = SIMBUT_SPECS[name as keyof typeof SIMBUT_SPECS];
  if (!entry) {
    container.innerHTML = `<p>Unknown SimBut preview: ${name}</p>`;
    return;
  }

  const card = document.createElement('div');
  card.className = 'catalog-card';

  const header = document.createElement('div');
  header.className = 'catalog-card-header';
  const heading = document.createElement('h3');
  heading.textContent = `SimBut / ${name}`;
  header.appendChild(heading);
  const description = document.createElement('p');
  description.textContent = `${entry.description} SimBut is a direct DOM widget, not a UISpec registry surface.`;
  header.appendChild(description);
  card.appendChild(header);

  const preview = document.createElement('div');
  preview.className = 'catalog-card-preview';
  const { frame, mountTarget } = createSimbutPreviewFrame({
    product: entry.product,
    title: 'Product Image Overlay',
    subtitle: 'Live widget preview using the real GengageSimBut class',
  });
  preview.appendChild(frame);
  card.appendChild(preview);

  const consoleEl = document.createElement('div');
  consoleEl.className = 'catalog-card-console';
  card.appendChild(consoleEl);

  const appendLog = (message: string): void => {
    const line = document.createElement('div');
    line.className = 'log-entry';
    line.textContent = message;
    consoleEl.appendChild(line);
  };

  appendLog('Click the pill to inspect the onFindSimilar payload.');

  const source = document.createElement('details');
  source.className = 'catalog-card-source';
  const summary = document.createElement('summary');
  summary.textContent = 'Widget Config';
  source.appendChild(summary);
  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify(
    {
      accountId: 'catalog',
      middlewareUrl: 'https://mock.gengage.ai',
      mountTarget: '#product-image-wrap',
      sku: entry.config.sku,
      imageUrl: entry.config.imageUrl,
      locale: entry.config.locale,
      i18n: { findSimilarLabel: entry.config.label },
      onFindSimilar: 'callback(detail)',
    },
    null,
    2,
  );
  source.appendChild(pre);
  card.appendChild(source);

  container.appendChild(card);

  const simbut = new GengageSimBut();
  let cleanedUp = false;

  const cleanup = (): void => {
    if (cleanedUp) return;
    cleanedUp = true;
    observer.disconnect();
    simbut.destroy();
  };

  const observer = new MutationObserver(() => {
    if (!card.isConnected) {
      cleanup();
    }
  });
  observer.observe(container.parentElement ?? document.body, { childList: true, subtree: true });

  void simbut
    .init({
      accountId: 'catalog',
      middlewareUrl: 'https://mock.gengage.ai',
      mountTarget,
      sku: entry.config.sku,
      imageUrl: entry.config.imageUrl,
      locale: entry.config.locale,
      i18n: { findSimilarLabel: entry.config.label },
      onFindSimilar: (detail) => {
        appendLog(`onFindSimilar: ${JSON.stringify(detail)}`);
      },
    })
    .catch((err) => {
      appendLog(`Init error: ${err instanceof Error ? err.message : String(err)}`);
    });
}

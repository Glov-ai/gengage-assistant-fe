/**
 * Theme comparison: renders the same component with all 12 merchant themes side-by-side.
 */

import { renderUISpecWithRegistry } from '@gengage/assistant-fe/common';
import { createDefaultChatUISpecRegistry } from '@gengage/assistant-fe/chat';
import { getMerchantConfig, getMerchantIds } from '../merchant-configs.js';
import { CHAT_SPECS } from '../mock-data/chat-specs.js';
import { createNoopChatContext } from '../utils/noop-context.js';
import { applyTheme } from '../utils/theme-applicator.js';

const COMPONENT_OPTIONS = Object.keys(CHAT_SPECS);

export function renderThemeComparison(container: HTMLElement): void {
  const h2 = document.createElement('h2');
  h2.textContent = 'Theme Comparison';
  h2.style.marginBottom = '16px';
  container.appendChild(h2);

  // Component selector
  const selector = document.createElement('div');
  selector.className = 'catalog-component-select';

  const label = document.createElement('label');
  label.textContent = 'Component:';
  label.htmlFor = 'theme-component-select';
  selector.appendChild(label);

  const select = document.createElement('select');
  select.id = 'theme-component-select';
  for (const name of COMPONENT_OPTIONS) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (name === 'AITopPicks') opt.selected = true;
    select.appendChild(opt);
  }
  selector.appendChild(select);
  container.appendChild(selector);

  // Grid container
  const grid = document.createElement('div');
  grid.className = 'catalog-theme-grid';
  container.appendChild(grid);

  function renderGrid(componentName: string): void {
    grid.innerHTML = '';
    const specEntry = CHAT_SPECS[componentName];
    if (!specEntry) return;

    const merchantIds = getMerchantIds();
    for (const merchantId of merchantIds) {
      const config = getMerchantConfig(merchantId);
      if (!config) continue;

      const card = document.createElement('div');
      card.className = 'catalog-theme-card';

      // Header with color swatch
      const header = document.createElement('div');
      header.className = 'catalog-theme-card-header';

      const swatch = document.createElement('div');
      swatch.className = 'catalog-theme-swatch';
      swatch.style.backgroundColor = config.theme.primaryColor ?? '#666';
      header.appendChild(swatch);

      const nameEl = document.createElement('span');
      nameEl.textContent = merchantId;
      header.appendChild(nameEl);

      card.appendChild(header);

      // Body with rendered component
      const body = document.createElement('div');
      body.className = 'catalog-theme-card-body';
      applyTheme(body, config.theme);

      try {
        const registry = createDefaultChatUISpecRegistry();
        const ctx = createNoopChatContext();
        const spec = specEntry.spec as {
          root: string;
          elements: Record<string, { type: string; props?: Record<string, unknown>; children?: string[] }>;
        };
        const dom = renderUISpecWithRegistry({
          spec,
          context: ctx,
          registry,
          containerClassName: 'gengage-chat-uispec',
        });
        body.appendChild(dom);
      } catch (err) {
        const errEl = document.createElement('pre');
        errEl.style.color = 'red';
        errEl.style.fontSize = '11px';
        errEl.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
        body.appendChild(errEl);
      }

      card.appendChild(body);
      grid.appendChild(card);
    }
  }

  // Initial render
  renderGrid(select.value);

  // Re-render on component change
  select.addEventListener('change', () => {
    renderGrid(select.value);
  });
}

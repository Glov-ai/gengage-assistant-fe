import type { NormalizedProduct } from '../../common/protocol-adapter.js';
import type { ProductGroup } from '../api.js';
import type { SimRelI18n } from '../types.js';
import { renderProductGrid } from './ProductGrid.js';

export interface GroupTabsOptions {
  groups: ProductGroup[];
  discountType?: 'strike-through' | 'badge';
  onClick: (product: NormalizedProduct) => void;
  onAddToCart: (params: { sku: string; quantity: number; cartCode: string }) => void;
  renderCard?: (product: NormalizedProduct, index: number) => string;
  renderCardElement?: (product: NormalizedProduct, index: number) => HTMLElement | null;
  i18n?: SimRelI18n;
}

let _groupTabsInstanceCounter = 0;

export function renderGroupTabs(options: GroupTabsOptions): HTMLElement {
  const instanceId = _groupTabsInstanceCounter++;
  const container = document.createElement('div');
  container.className = 'gengage-simrel-groups';

  if (options.groups.length === 0) {
    container.style.display = 'none';
    container.dataset['empty'] = 'true';
    return container;
  }

  // Tab bar — WAI-ARIA tablist pattern
  const tabBar = document.createElement('div');
  tabBar.className = 'gengage-simrel-tabs';
  tabBar.setAttribute('role', 'tablist');

  const tabs: HTMLButtonElement[] = [];
  const panels: HTMLElement[] = [];

  const buildGridOptions = (group: ProductGroup): import('./ProductGrid.js').ProductGridOptions => {
    const gridOpts: import('./ProductGrid.js').ProductGridOptions = {
      products: group.products,
      onClick: options.onClick,
      onAddToCart: options.onAddToCart,
    };
    if (options.i18n !== undefined) gridOpts.i18n = options.i18n;
    if (options.discountType !== undefined) gridOpts.discountType = options.discountType;
    if (options.renderCard !== undefined) gridOpts.renderCard = options.renderCard;
    if (options.renderCardElement !== undefined) gridOpts.renderCardElement = options.renderCardElement;
    return gridOpts;
  };

  const activateTab = (index: number): void => {
    for (let j = 0; j < tabs.length; j++) {
      const isActive = j === index;
      tabs[j]!.classList.toggle('gengage-simrel-tab--active', isActive);
      tabs[j]!.setAttribute('aria-selected', String(isActive));
      tabs[j]!.tabIndex = isActive ? 0 : -1;
    }

    // Lazy-render the grid content for the active panel
    const group = options.groups[index]!;
    const panel = panels[index]!;
    panel.innerHTML = '';
    const grid = renderProductGrid(buildGridOptions(group));
    panel.appendChild(grid);

    // Show only the active panel and manage tabindex for keyboard access
    for (let j = 0; j < panels.length; j++) {
      const isActive = j === index;
      panels[j]!.style.display = isActive ? '' : 'none';
      panels[j]!.tabIndex = isActive ? 0 : -1;
    }
  };

  for (let i = 0; i < options.groups.length; i++) {
    const group = options.groups[i]!;
    const tabId = `gengage-simrel-tab-${instanceId}-${i}`;
    const panelId = `gengage-simrel-panel-${instanceId}-${i}`;

    // Tab button
    const tab = document.createElement('button');
    tab.className = 'gengage-simrel-tab';
    tab.type = 'button';
    tab.id = tabId;
    tab.textContent = group.name;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panelId);
    tab.setAttribute('aria-selected', String(i === 0));
    tab.tabIndex = i === 0 ? 0 : -1;
    if (i === 0) tab.classList.add('gengage-simrel-tab--active');

    tab.addEventListener('click', () => activateTab(i));
    tab.addEventListener('keydown', (e: KeyboardEvent) => {
      let next = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        next = (i + 1) % options.groups.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        next = (i - 1 + options.groups.length) % options.groups.length;
      } else if (e.key === 'Home') {
        next = 0;
      } else if (e.key === 'End') {
        next = options.groups.length - 1;
      }
      if (next >= 0) {
        e.preventDefault();
        activateTab(next);
        tabs[next]!.focus();
      }
    });

    tabs.push(tab);
    tabBar.appendChild(tab);

    // Tab panel
    const panel = document.createElement('div');
    panel.className = 'gengage-simrel-tab-panel';
    panel.id = panelId;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tabId);
    panel.tabIndex = i === 0 ? 0 : -1;
    if (i !== 0) panel.style.display = 'none';

    panels.push(panel);
  }

  container.appendChild(tabBar);

  // Render the initial (first) tab content
  const firstPanel = panels[0]!;
  const firstGrid = renderProductGrid(buildGridOptions(options.groups[0]!));
  firstPanel.appendChild(firstGrid);

  for (const panel of panels) container.appendChild(panel);

  return container;
}

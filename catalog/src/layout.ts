import { ROUTES, navigate, getCurrentPath, getBreadcrumb } from './router.js';
import type { Route } from './router.js';
import { applyTheme } from './utils/theme-applicator.js';
import { getMerchantConfig, getMerchantIds } from './merchant-configs.js';

let contentEl: HTMLElement | null = null;
let breadcrumbEl: HTMLElement | null = null;
let themeDropdownEl: HTMLSelectElement | null = null;
let currentThemeOverride: string | null = null;

export function getThemeOverride(): string | null {
  return currentThemeOverride;
}

export function getContentEl(): HTMLElement | null {
  return contentEl;
}

/** Applies or clears the global theme on the content area. */
function applyGlobalTheme(): void {
  if (!contentEl) return;
  if (currentThemeOverride) {
    const config = getMerchantConfig(currentThemeOverride);
    if (config) {
      applyTheme(contentEl, config.theme);
      return;
    }
  }
  // Clear: remove inline styles set by applyTheme
  contentEl.removeAttribute('style');
}

export function mountLayout(root: HTMLElement): HTMLElement {
  root.innerHTML = '';
  root.className = 'catalog-shell';

  // Sidebar
  const sidebar = document.createElement('nav');
  sidebar.className = 'catalog-sidebar';

  const logo = document.createElement('div');
  logo.className = 'catalog-logo';
  logo.innerHTML = '<strong>Gengage</strong> Catalog';
  logo.addEventListener('click', () => navigate('/'));
  sidebar.appendChild(logo);

  const navTree = document.createElement('ul');
  navTree.className = 'catalog-nav';

  for (const route of ROUTES) {
    const li = createNavItem(route);
    navTree.appendChild(li);
  }

  sidebar.appendChild(navTree);
  root.appendChild(sidebar);

  // Main area
  const main = document.createElement('div');
  main.className = 'catalog-main';

  // Top bar
  const topbar = document.createElement('div');
  topbar.className = 'catalog-topbar';

  breadcrumbEl = document.createElement('div');
  breadcrumbEl.className = 'catalog-breadcrumb';
  topbar.appendChild(breadcrumbEl);

  const themeControl = document.createElement('div');
  themeControl.className = 'catalog-theme-control';

  const themeLabel = document.createElement('label');
  themeLabel.textContent = 'Theme: ';
  themeLabel.htmlFor = 'theme-select';
  themeControl.appendChild(themeLabel);

  themeDropdownEl = document.createElement('select');
  themeDropdownEl.id = 'theme-select';
  themeDropdownEl.className = 'catalog-theme-select';

  const noneOpt = document.createElement('option');
  noneOpt.value = '';
  noneOpt.textContent = 'None (default)';
  themeDropdownEl.appendChild(noneOpt);

  for (const id of getMerchantIds()) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    themeDropdownEl.appendChild(opt);
  }

  themeDropdownEl.addEventListener('change', () => {
    currentThemeOverride = themeDropdownEl!.value || null;
    applyGlobalTheme();
    window.dispatchEvent(new CustomEvent('catalog:theme-change'));
  });

  themeControl.appendChild(themeDropdownEl);
  topbar.appendChild(themeControl);
  main.appendChild(topbar);

  // Content area
  contentEl = document.createElement('div');
  contentEl.className = 'catalog-content';
  main.appendChild(contentEl);

  root.appendChild(main);

  return contentEl;
}

export function updateBreadcrumb(path: string): void {
  if (!breadcrumbEl) return;
  const crumbs = getBreadcrumb(path);
  breadcrumbEl.textContent = crumbs.join(' / ');
}

export function highlightActiveNav(path: string): void {
  const allLinks = document.querySelectorAll('.catalog-nav a');
  for (const link of allLinks) {
    const href = (link as HTMLAnchorElement).getAttribute('href');
    if (href === `#${path}`) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  }

  // Expand parent sections
  const allGroups = document.querySelectorAll('.catalog-nav-group');
  for (const group of allGroups) {
    const children = group.querySelector('.catalog-nav-children') as HTMLElement | null;
    if (!children) continue;
    const hasActive = children.querySelector('.active');
    if (hasActive) {
      children.style.display = '';
      group.classList.add('expanded');
    }
  }
}

function createNavItem(route: Route): HTMLLIElement {
  const li = document.createElement('li');

  if (route.children) {
    li.className = 'catalog-nav-group';

    const header = document.createElement('div');
    header.className = 'catalog-nav-group-header';

    const link = document.createElement('a');
    link.href = `#${route.children[0]?.path ?? route.path}`;
    link.textContent = route.label;
    header.appendChild(link);

    const toggle = document.createElement('span');
    toggle.className = 'catalog-nav-toggle';
    toggle.textContent = '\u25B6';
    header.appendChild(toggle);

    header.addEventListener('click', (e) => {
      e.preventDefault();
      li.classList.toggle('expanded');
      const children = li.querySelector('.catalog-nav-children') as HTMLElement | null;
      if (children) {
        children.style.display = li.classList.contains('expanded') ? '' : 'none';
      }
      toggle.textContent = li.classList.contains('expanded') ? '\u25BC' : '\u25B6';
    });

    li.appendChild(header);

    const childList = document.createElement('ul');
    childList.className = 'catalog-nav-children';
    childList.style.display = 'none';

    for (const child of route.children) {
      const childLi = document.createElement('li');
      const childLink = document.createElement('a');
      childLink.href = `#${child.path}`;
      childLink.textContent = child.label;
      childLink.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(child.path);
      });
      childLi.appendChild(childLink);
      childList.appendChild(childLi);
    }

    li.appendChild(childList);
  } else {
    const link = document.createElement('a');
    link.href = `#${route.path}`;
    link.textContent = route.label;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(route.path);
    });
    li.appendChild(link);
  }

  return li;
}

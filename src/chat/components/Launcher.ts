export interface LauncherOptions {
  onClick: () => void;
  svgMarkup?: string;
  /** Full-size image URL — renders launcher as an image button (no circular bg). */
  imageUrl?: string;
  ariaLabel?: string;
  hideMobile?: boolean;
  mobileBreakpoint?: number;
  tooltip?: string;
}

/**
 * Result of createLauncher — the container wraps the button and exposes
 * content-area slots where the QNA widget or host page can inject engagement
 * actions (buying-hesitation questions, "Find Similar" buttons, etc.).
 */
export interface LauncherElements {
  /** Outer container — append this to the DOM. */
  container: HTMLElement;
  /** The clickable FAB button. */
  button: HTMLButtonElement;
  /** Slot above the button (primary QNA actions). */
  contentArea: HTMLElement;
  /** Slot below the button (secondary content). */
  contentAreaBottom: HTMLElement;
}

const DEFAULT_SVG = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="3" y="7" width="18" height="13" rx="3" fill="currentColor" opacity="0.15"/>
  <rect x="3" y="7" width="18" height="13" rx="3" stroke="currentColor" stroke-width="1.5"/>
  <circle cx="9" cy="13" r="1.5" fill="currentColor"/>
  <circle cx="15" cy="13" r="1.5" fill="currentColor"/>
  <path d="M9.5 17C10.3 17.6 11.1 18 12 18C12.9 18 13.7 17.6 14.5 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M12 7V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="12" cy="3" r="1" fill="currentColor"/>
  <path d="M1 12V14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M23 12V14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

export function createLauncher(options: LauncherOptions): LauncherElements {
  // Container holds content areas + button
  const container = document.createElement('div');
  container.className = 'gengage-chat-launcher-container';

  // Content area above button (QNA actions, buying-hesitation questions)
  const contentArea = document.createElement('div');
  contentArea.className = 'gengage-chat-launcher-content-area';
  container.appendChild(contentArea);

  // The FAB button
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', options.ariaLabel ?? 'Open chat');

  if (options.imageUrl) {
    button.className = 'gengage-chat-launcher gengage-chat-launcher--image-mode';
    const img = document.createElement('img');
    img.src = options.imageUrl;
    img.alt = '';
    img.draggable = false;
    button.appendChild(img);
  } else {
    button.className = 'gengage-chat-launcher';
    button.innerHTML = options.svgMarkup ?? DEFAULT_SVG;
  }

  if (options.tooltip !== undefined) {
    const tooltipEl = document.createElement('span');
    tooltipEl.className = 'gengage-chat-launcher-tooltip';
    tooltipEl.textContent = options.tooltip;
    button.appendChild(tooltipEl);
  }

  if (options.hideMobile) {
    container.dataset['hideMobile'] = '1';
  }
  if (options.mobileBreakpoint !== undefined) {
    container.dataset['mobileBreakpoint'] = String(options.mobileBreakpoint);
  }

  button.addEventListener('click', options.onClick);
  container.appendChild(button);

  // Content area below button (secondary content)
  const contentAreaBottom = document.createElement('div');
  contentAreaBottom.className = 'gengage-chat-launcher-content-area-bottom';
  container.appendChild(contentAreaBottom);

  return { container, button, contentArea, contentAreaBottom };
}

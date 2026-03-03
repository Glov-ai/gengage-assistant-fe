import { sanitizeHtml } from '../../common/safe-html.js';

export interface KvkkBannerOptions {
  htmlContent: string;
  onDismiss: () => void;
  closeAriaLabel?: string;
}

export function createKvkkBanner(options: KvkkBannerOptions): HTMLElement {
  const banner = document.createElement('div');
  banner.className = 'gengage-chat-kvkk-banner';
  banner.setAttribute('role', 'alert');

  const content = document.createElement('div');
  content.className = 'gengage-chat-kvkk-content';
  content.innerHTML = sanitizeHtml(options.htmlContent);
  banner.appendChild(content);

  const dismiss = document.createElement('button');
  dismiss.className = 'gengage-chat-kvkk-dismiss';
  dismiss.type = 'button';
  dismiss.setAttribute('aria-label', options.closeAriaLabel ?? 'Kapat');
  dismiss.textContent = '\u00D7';
  dismiss.addEventListener('click', options.onDismiss);
  banner.appendChild(dismiss);

  return banner;
}

/**
 * PanelTopBar — navigation bar at the top of the panel pane.
 *
 * Shows back/forward arrow buttons and a title derived from the current
 * panel content type.  On mobile a close (✕) button is also rendered so
 * users can dismiss all panel layers with a single tap and return to the
 * conversation, without having to navigate back through every history entry.
 */

export interface PanelTopBarOptions {
  onBack: () => void;
  onForward: () => void;
  /** Called when the mobile close (✕) button is tapped. Should clear all panel history. */
  onClose?: () => void;
  backAriaLabel?: string;
  forwardAriaLabel?: string;
  /** Aria label for the close button (mobile only). */
  closePanelAriaLabel?: string;
}

export class PanelTopBar {
  private _el: HTMLElement;
  private _backBtn: HTMLButtonElement;
  private _forwardBtn: HTMLButtonElement;
  private _titleEl: HTMLElement;
  private _closeBtn: HTMLButtonElement;

  constructor(options: PanelTopBarOptions) {
    this._el = document.createElement('div');
    this._el.className = 'gengage-chat-panel-topbar gds-toolbar';
    this._el.dataset['gengagePart'] = 'panel-topbar';

    this._backBtn = document.createElement('button');
    this._backBtn.className = 'gengage-chat-panel-topbar-back';
    this._backBtn.dataset['gengagePart'] = 'panel-topbar-back';
    this._backBtn.type = 'button';
    this._backBtn.disabled = true;
    this._backBtn.setAttribute('aria-label', options.backAriaLabel ?? 'Back');
    this._backBtn.title = options.backAriaLabel ?? 'Back';
    this._backBtn.textContent = '\u2190'; // ←
    this._backBtn.addEventListener('click', () => options.onBack());

    this._titleEl = document.createElement('span');
    this._titleEl.className = 'gengage-chat-panel-topbar-title';
    this._titleEl.dataset['gengagePart'] = 'panel-topbar-title';

    this._forwardBtn = document.createElement('button');
    this._forwardBtn.className = 'gengage-chat-panel-topbar-forward';
    this._forwardBtn.dataset['gengagePart'] = 'panel-topbar-forward';
    this._forwardBtn.type = 'button';
    this._forwardBtn.disabled = true;
    this._forwardBtn.setAttribute('aria-label', options.forwardAriaLabel ?? 'Forward');
    this._forwardBtn.title = options.forwardAriaLabel ?? 'Forward';
    this._forwardBtn.textContent = '\u2192'; // →
    this._forwardBtn.addEventListener('click', () => options.onForward());

    // Close button — only visible on mobile via CSS.
    // Dismisses all panel layers and returns to the base conversation.
    this._closeBtn = document.createElement('button');
    this._closeBtn.className = 'gengage-chat-panel-topbar-close';
    this._closeBtn.dataset['gengagePart'] = 'panel-topbar-close';
    this._closeBtn.type = 'button';
    this._closeBtn.setAttribute('aria-label', options.closePanelAriaLabel ?? 'Close panel');
    this._closeBtn.title = options.closePanelAriaLabel ?? 'Close panel';
    this._closeBtn.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    this._closeBtn.addEventListener('click', () => options.onClose?.());

    this._el.appendChild(this._backBtn);
    this._el.appendChild(this._titleEl);
    this._el.appendChild(this._forwardBtn);
    this._el.appendChild(this._closeBtn);
  }

  update(canBack: boolean, canForward: boolean, title: string): void {
    this._backBtn.disabled = !canBack;
    this._forwardBtn.disabled = !canForward;
    this._titleEl.textContent = title;
  }

  getElement(): HTMLElement {
    return this._el;
  }

  getTitle(): string {
    return this._titleEl.textContent ?? '';
  }
}

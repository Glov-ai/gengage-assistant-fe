/**
 * PanelTopBar — navigation bar at the top of the panel pane.
 *
 * Shows back/forward arrow buttons and a title derived from the current
 * panel content type.
 */

export interface PanelTopBarOptions {
  onBack: () => void;
  onForward: () => void;
  backAriaLabel?: string;
  forwardAriaLabel?: string;
}

export class PanelTopBar {
  private _el: HTMLElement;
  private _backBtn: HTMLButtonElement;
  private _forwardBtn: HTMLButtonElement;
  private _titleEl: HTMLElement;

  constructor(options: PanelTopBarOptions) {
    this._el = document.createElement('div');
    this._el.className = 'gengage-chat-panel-topbar';

    this._backBtn = document.createElement('button');
    this._backBtn.className = 'gengage-chat-panel-topbar-back';
    this._backBtn.type = 'button';
    this._backBtn.disabled = true;
    this._backBtn.setAttribute('aria-label', options.backAriaLabel ?? 'Back');
    this._backBtn.title = options.backAriaLabel ?? 'Back';
    this._backBtn.textContent = '\u2190'; // ←
    this._backBtn.addEventListener('click', () => options.onBack());

    this._titleEl = document.createElement('span');
    this._titleEl.className = 'gengage-chat-panel-topbar-title';

    this._forwardBtn = document.createElement('button');
    this._forwardBtn.className = 'gengage-chat-panel-topbar-forward';
    this._forwardBtn.type = 'button';
    this._forwardBtn.disabled = true;
    this._forwardBtn.setAttribute('aria-label', options.forwardAriaLabel ?? 'Forward');
    this._forwardBtn.title = options.forwardAriaLabel ?? 'Forward';
    this._forwardBtn.textContent = '\u2192'; // →
    this._forwardBtn.addEventListener('click', () => options.onForward());

    this._el.appendChild(this._backBtn);
    this._el.appendChild(this._titleEl);
    this._el.appendChild(this._forwardBtn);
  }

  update(canBack: boolean, canForward: boolean, title: string): void {
    this._backBtn.disabled = !canBack;
    this._forwardBtn.disabled = !canForward;
    this._titleEl.textContent = title;
  }

  getElement(): HTMLElement {
    return this._el;
  }
}

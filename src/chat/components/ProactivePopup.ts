export interface ProactiveAction {
  title: string;
  onSelect: () => void;
}

export interface ProactivePopupOptions {
  message: string;
  onAccept: () => void;
  onDismiss: () => void;
  /** Auto-dismiss after this many ms (default: 15000). 0 = never. */
  autoDismissMs?: number;
  /** Accept button label (default: "Sohbete Başla"). */
  acceptLabel?: string;
  /** Dismiss button aria-label (default: "Kapat"). */
  closeAriaLabel?: string;
  /** Backend-driven action buttons. When provided, renders per-action buttons
   *  instead of the generic accept button. */
  actionButtons?: ProactiveAction[];
}

export function createProactivePopup(options: ProactivePopupOptions): HTMLElement {
  const popup = document.createElement('div');
  popup.className = 'gengage-chat-proactive';

  const messageEl = document.createElement('p');
  messageEl.className = 'gengage-chat-proactive-message';
  messageEl.textContent = options.message;
  popup.appendChild(messageEl);

  const actions = document.createElement('div');
  actions.className = 'gengage-chat-proactive-actions';

  // Auto-dismiss timer (stored so manual dismiss can cancel it)
  let autoDismissTimer: ReturnType<typeof setTimeout> | null = null;

  function clearAndRemove(): void {
    if (autoDismissTimer !== null) clearTimeout(autoDismissTimer);
    popup.remove();
  }

  if (options.actionButtons && options.actionButtons.length > 0) {
    // Render per-action buttons from backend response (like legacy proactive)
    for (const ab of options.actionButtons) {
      const btn = document.createElement('button');
      btn.className = 'gengage-chat-proactive-accept';
      btn.type = 'button';
      btn.textContent = ab.title;
      btn.addEventListener('click', () => {
        clearAndRemove();
        ab.onSelect();
      });
      actions.appendChild(btn);
    }
  } else {
    // Fallback: single generic accept button
    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'gengage-chat-proactive-accept';
    acceptBtn.type = 'button';
    acceptBtn.textContent = options.acceptLabel ?? 'Sohbete Başla';
    acceptBtn.addEventListener('click', () => {
      clearAndRemove();
      options.onAccept();
    });
    actions.appendChild(acceptBtn);
  }

  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'gengage-chat-proactive-dismiss';
  dismissBtn.type = 'button';
  dismissBtn.textContent = '\u00D7';
  dismissBtn.setAttribute('aria-label', options.closeAriaLabel ?? 'Kapat');
  dismissBtn.addEventListener('click', () => {
    clearAndRemove();
    options.onDismiss();
  });
  popup.appendChild(dismissBtn);

  popup.appendChild(actions);

  // Auto-dismiss
  const timeout = options.autoDismissMs ?? 15000;
  if (timeout > 0) {
    autoDismissTimer = setTimeout(() => {
      if (popup.parentElement) {
        popup.remove();
        options.onDismiss();
      }
    }, timeout);
  }

  // Animate in
  requestAnimationFrame(() => popup.classList.add('gengage-chat-proactive--visible'));

  return popup;
}

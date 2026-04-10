import type { ActionPayload } from '../../common/types.js';

export interface TextInputOptions {
  placeholders?: string | string[];
  ctaLabel?: string;
  defaultInputPlaceholder?: string;
  askQuestionAriaLabel?: string;
  sendButtonText?: string;
  sendQuestionAriaLabel?: string;
  onSubmit: (action: ActionPayload) => void;
}

export function renderTextInput(options: TextInputOptions): HTMLElement {
  const container = document.createElement('div');
  container.className = 'gengage-qna-input-wrapper';
  container.dataset['gengagePart'] = 'qna-input-wrapper';

  const combo = document.createElement('div');
  combo.className = 'gengage-qna-input-combo';
  combo.dataset['gengagePart'] = 'qna-input-combo';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'gengage-qna-input';
  input.dataset['gengagePart'] = 'qna-input';
  input.setAttribute('aria-label', options.askQuestionAriaLabel ?? 'Ask a question');

  // Rotating placeholders
  const placeholders = Array.isArray(options.placeholders)
    ? options.placeholders
    : options.placeholders
      ? [options.placeholders]
      : [options.defaultInputPlaceholder ?? 'Ask a question...'];

  let placeholderIndex = 0;
  let activePlaceholder = placeholders[0] ?? '';
  input.placeholder = activePlaceholder;

  let rotateTimer: ReturnType<typeof setInterval> | null = null;
  let fadeTimer: ReturnType<typeof setTimeout> | null = null;
  let isFocused = false;

  const stopPlaceholderRotation = () => {
    if (rotateTimer) clearInterval(rotateTimer);
    rotateTimer = null;
    if (fadeTimer) clearTimeout(fadeTimer);
    fadeTimer = null;
    input.classList.remove('gengage-qna-input--fade');
  };

  const shouldRotatePlaceholders = () => placeholders.length > 1 && !isFocused && input.value.trim().length === 0;

  const startPlaceholderRotation = () => {
    stopPlaceholderRotation();
    if (!shouldRotatePlaceholders()) return;
    rotateTimer = setInterval(() => {
      if (!shouldRotatePlaceholders()) return;
      input.classList.add('gengage-qna-input--fade');
      fadeTimer = setTimeout(() => {
        placeholderIndex = (placeholderIndex + 1) % placeholders.length;
        activePlaceholder = placeholders[placeholderIndex] ?? '';
        input.placeholder = activePlaceholder;
        input.classList.remove('gengage-qna-input--fade');
      }, 180);
    }, 3000);
  };

  const actionIcons = document.createElement('div');
  actionIcons.className = 'gengage-qna-input-actions';
  actionIcons.dataset['gengagePart'] = 'qna-input-actions';

  const clearBtn = document.createElement('button');
  clearBtn.className = 'gengage-qna-icon-btn gengage-qna-clear gengage-qna-icon-btn--hidden';
  clearBtn.type = 'button';
  clearBtn.dataset['gengagePart'] = 'qna-clear';
  clearBtn.setAttribute('aria-label', 'Clear question');
  clearBtn.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18 6L6 18" /><path d="M6 6L18 18" /></svg>';

  const sendBtn = document.createElement('button');
  sendBtn.className = 'gengage-qna-icon-btn gengage-qna-send gengage-qna-icon-btn--hidden';
  sendBtn.type = 'button';
  sendBtn.dataset['gengagePart'] = 'qna-send';
  sendBtn.setAttribute('aria-label', options.sendQuestionAriaLabel ?? 'Send question');
  sendBtn.setAttribute('aria-disabled', 'true');
  sendBtn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" /></svg><span class="gengage-qna-sr-only">${options.ctaLabel ?? options.sendButtonText ?? 'Ask'}</span>`;

  const updateActionButtons = () => {
    const hasValue = input.value.trim().length > 0;
    clearBtn.classList.toggle('gengage-qna-icon-btn--hidden', !hasValue);
    sendBtn.classList.toggle('gengage-qna-icon-btn--hidden', !hasValue);
    sendBtn.classList.toggle('gengage-qna-send--active', hasValue);
    sendBtn.setAttribute('aria-disabled', hasValue ? 'false' : 'true');
  };

  const submit = () => {
    const text = input.value.trim();
    if (!text) return;
    options.onSubmit({
      title: text,
      type: 'user_message',
      // Align with chat composer: user_message payload is plain string.
      payload: text,
    });
    input.value = '';
    updateActionButtons();
    startPlaceholderRotation();
  };

  clearBtn.addEventListener('click', (event) => {
    event.preventDefault();
    input.value = '';
    updateActionButtons();
    input.focus({ preventScroll: true });
    input.placeholder = '';
    startPlaceholderRotation();
  });

  sendBtn.addEventListener('click', submit);

  input.addEventListener('focus', () => {
    isFocused = true;
    stopPlaceholderRotation();
    input.placeholder = '';
  });

  input.addEventListener('blur', () => {
    isFocused = false;
    if (input.value.trim().length === 0) {
      input.placeholder = activePlaceholder;
    }
    startPlaceholderRotation();
  });

  input.addEventListener('input', () => {
    updateActionButtons();
    if (input.value.trim().length > 0) {
      stopPlaceholderRotation();
      return;
    }
    input.placeholder = isFocused ? '' : activePlaceholder;
    startPlaceholderRotation();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
    if (e.key === 'Escape' && input.value.length > 0) {
      input.value = '';
      updateActionButtons();
      startPlaceholderRotation();
    }
  });

  actionIcons.appendChild(clearBtn);
  actionIcons.appendChild(sendBtn);
  combo.appendChild(input);
  combo.appendChild(actionIcons);
  container.appendChild(combo);

  updateActionButtons();
  startPlaceholderRotation();

  // Cleanup method
  (container as HTMLElement & { _cleanup?: () => void })._cleanup = () => {
    stopPlaceholderRotation();
  };

  return container;
}

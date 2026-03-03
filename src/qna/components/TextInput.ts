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

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'gengage-qna-input';
  input.setAttribute('aria-label', options.askQuestionAriaLabel ?? 'Ask a question');

  // Rotating placeholders
  const placeholders = Array.isArray(options.placeholders)
    ? options.placeholders
    : options.placeholders
      ? [options.placeholders]
      : [options.defaultInputPlaceholder ?? 'Bir soru sorun...'];

  let placeholderIndex = 0;
  input.placeholder = placeholders[0] ?? '';

  let rotateTimer: ReturnType<typeof setInterval> | null = null;
  let fadeTimer: ReturnType<typeof setTimeout> | null = null;
  if (placeholders.length > 1) {
    rotateTimer = setInterval(() => {
      input.classList.add('gengage-qna-input--fade');
      fadeTimer = setTimeout(() => {
        placeholderIndex = (placeholderIndex + 1) % placeholders.length;
        input.placeholder = placeholders[placeholderIndex] ?? '';
        input.classList.remove('gengage-qna-input--fade');
      }, 180);
    }, 3000);
  }

  const sendBtn = document.createElement('button');
  sendBtn.className = 'gengage-qna-send';
  sendBtn.type = 'button';
  sendBtn.textContent = options.ctaLabel ?? options.sendButtonText ?? 'Sor';
  sendBtn.setAttribute('aria-label', options.sendQuestionAriaLabel ?? 'Send question');

  const submit = () => {
    const text = input.value.trim();
    if (!text) return;
    options.onSubmit({
      title: text,
      type: 'user_message',
      payload: { text },
    });
    input.value = '';
  };

  sendBtn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });

  container.appendChild(input);
  container.appendChild(sendBtn);

  // Cleanup method
  (container as HTMLElement & { _cleanup?: () => void })._cleanup = () => {
    if (rotateTimer) clearInterval(rotateTimer);
    if (fadeTimer) clearTimeout(fadeTimer);
  };

  return container;
}

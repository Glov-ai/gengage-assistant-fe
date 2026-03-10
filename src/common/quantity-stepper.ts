export interface QuantityStepperOptions {
  min?: number | undefined;
  max?: number | undefined;
  initial?: number | undefined;
  label?: string | undefined;
  compact?: boolean | undefined;
  decreaseLabel?: string | undefined;
  increaseLabel?: string | undefined;
  /** Symbol for decrease button (default: '\u2212' minus sign). */
  decreaseSymbol?: string | undefined;
  /** Symbol for increase button (default: '+'). */
  increaseSymbol?: string | undefined;
  /** Icon HTML for compact mode submit button (default: cart SVG icon). */
  submitIcon?: string | undefined;
  onSubmit: (quantity: number) => void;
}

/**
 * Creates a quantity stepper with [−] [value] [+] and a submit button.
 * Compact mode renders a cart icon button; full mode renders a labeled button.
 */
export function createQuantityStepper(options: QuantityStepperOptions): HTMLElement {
  const rawMin = options.min ?? 1;
  const rawMax = options.max ?? 99;
  // Ensure min <= max; swap if caller provided inverted range
  const min = Math.min(rawMin, rawMax);
  const max = Math.max(rawMin, rawMax);
  const initial = Math.max(min, Math.min(max, options.initial ?? min));
  const compact = options.compact ?? false;

  let quantity = initial;

  const container = document.createElement('div');
  container.className = `gengage-qty-stepper${compact ? ' gengage-qty-stepper--compact' : ''}`;

  const decBtn = document.createElement('button');
  decBtn.className = 'gengage-qty-btn';
  decBtn.type = 'button';
  decBtn.textContent = options.decreaseSymbol ?? '\u2212'; // minus sign
  decBtn.setAttribute('aria-label', options.decreaseLabel ?? 'Decrease');

  const valueEl = document.createElement('span');
  valueEl.className = 'gengage-qty-value';
  valueEl.textContent = String(quantity);
  valueEl.setAttribute('aria-live', 'polite');
  valueEl.setAttribute('aria-atomic', 'true');

  const incBtn = document.createElement('button');
  incBtn.className = 'gengage-qty-btn';
  incBtn.type = 'button';
  incBtn.textContent = options.increaseSymbol ?? '+';
  incBtn.setAttribute('aria-label', options.increaseLabel ?? 'Increase');

  const submitBtn = document.createElement('button');
  submitBtn.className = 'gengage-qty-submit';
  submitBtn.type = 'button';

  const defaultCartSvg =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>';

  if (compact) {
    submitBtn.innerHTML = options.submitIcon ?? defaultCartSvg;
    submitBtn.title = options.label ?? 'Add to Cart';
  } else {
    submitBtn.textContent = options.label ?? 'Add to Cart';
  }

  function updateButtons(): void {
    decBtn.disabled = quantity <= min;
    incBtn.disabled = quantity >= max;
  }

  decBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (quantity > min) {
      quantity--;
      valueEl.textContent = String(quantity);
      updateButtons();
    }
  });

  incBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (quantity < max) {
      quantity++;
      valueEl.textContent = String(quantity);
      updateButtons();
    }
  });

  submitBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    options.onSubmit(quantity);
    // Brief visual feedback: show checkmark then revert
    const original = submitBtn.innerHTML;
    submitBtn.textContent = '\u2713'; // checkmark
    submitBtn.classList.add('gengage-qty-submit--success');
    submitBtn.disabled = true;
    setTimeout(() => {
      submitBtn.innerHTML = original;
      submitBtn.classList.remove('gengage-qty-submit--success');
      submitBtn.disabled = false;
    }, 1200);
  });

  // Prevent card click when interacting with stepper
  container.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  updateButtons();

  container.appendChild(decBtn);
  container.appendChild(valueEl);
  container.appendChild(incBtn);
  container.appendChild(submitBtn);

  return container;
}

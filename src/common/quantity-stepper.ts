export interface QuantityStepperOptions {
  min?: number;
  max?: number;
  initial?: number;
  label?: string;
  compact?: boolean;
  decreaseLabel?: string;
  increaseLabel?: string;
  /** Symbol for decrease button (default: '\u2212' minus sign). */
  decreaseSymbol?: string;
  /** Symbol for increase button (default: '+'). */
  increaseSymbol?: string;
  /** Icon/text for compact mode submit button (default: shopping cart emoji). */
  submitIcon?: string;
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
  decBtn.setAttribute('aria-label', options.decreaseLabel ?? 'Azalt');

  const valueEl = document.createElement('span');
  valueEl.className = 'gengage-qty-value';
  valueEl.textContent = String(quantity);
  valueEl.setAttribute('aria-live', 'polite');
  valueEl.setAttribute('aria-atomic', 'true');

  const incBtn = document.createElement('button');
  incBtn.className = 'gengage-qty-btn';
  incBtn.type = 'button';
  incBtn.textContent = options.increaseSymbol ?? '+';
  incBtn.setAttribute('aria-label', options.increaseLabel ?? 'Art\u0131r');

  const submitBtn = document.createElement('button');
  submitBtn.className = 'gengage-qty-submit';
  submitBtn.type = 'button';

  if (compact) {
    submitBtn.textContent = options.submitIcon ?? '\uD83D\uDED2'; // shopping cart emoji
    submitBtn.title = options.label ?? 'Sepete Ekle';
  } else {
    submitBtn.textContent = options.label ?? 'Sepete Ekle';
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

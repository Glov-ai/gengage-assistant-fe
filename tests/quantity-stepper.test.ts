import { describe, it, expect, vi } from 'vitest';
import { createQuantityStepper } from '../src/common/quantity-stepper.js';

describe('createQuantityStepper', () => {
  it('renders stepper with default values', () => {
    const onSubmit = vi.fn();
    const stepper = createQuantityStepper({ onSubmit });

    const valueEl = stepper.querySelector('.gengage-qty-value') as HTMLElement;
    expect(valueEl.textContent).toBe('1');

    const buttons = stepper.querySelectorAll('.gengage-qty-btn');
    expect(buttons).toHaveLength(2);
  });

  it('increments and decrements quantity', () => {
    const onSubmit = vi.fn();
    const stepper = createQuantityStepper({ onSubmit, min: 1, max: 5 });

    const [decBtn, incBtn] = stepper.querySelectorAll('.gengage-qty-btn') as unknown as HTMLButtonElement[];
    const valueEl = stepper.querySelector('.gengage-qty-value') as HTMLElement;

    incBtn.click();
    expect(valueEl.textContent).toBe('2');

    incBtn.click();
    expect(valueEl.textContent).toBe('3');

    decBtn.click();
    expect(valueEl.textContent).toBe('2');
  });

  it('disables decrement at min and increment at max', () => {
    const onSubmit = vi.fn();
    const stepper = createQuantityStepper({ onSubmit, min: 1, max: 3 });

    const [decBtn, incBtn] = stepper.querySelectorAll('.gengage-qty-btn') as unknown as HTMLButtonElement[];
    const valueEl = stepper.querySelector('.gengage-qty-value') as HTMLElement;

    // At min=1, decrement should be disabled
    expect(decBtn.disabled).toBe(true);

    // Go to max
    incBtn.click();
    incBtn.click();
    expect(valueEl.textContent).toBe('3');
    expect(incBtn.disabled).toBe(true);
  });

  it('submits current quantity', () => {
    const onSubmit = vi.fn();
    const stepper = createQuantityStepper({ onSubmit, min: 1, max: 10 });

    const incBtn = stepper.querySelectorAll('.gengage-qty-btn')[1] as HTMLButtonElement;
    const submitBtn = stepper.querySelector('.gengage-qty-submit') as HTMLButtonElement;

    incBtn.click();
    incBtn.click();
    submitBtn.click();
    expect(onSubmit).toHaveBeenCalledWith(3);
  });

  it('swaps min and max if inverted range provided', () => {
    const onSubmit = vi.fn();
    const stepper = createQuantityStepper({ onSubmit, min: 10, max: 1 });

    const [decBtn, incBtn] = stepper.querySelectorAll('.gengage-qty-btn') as unknown as HTMLButtonElement[];
    const valueEl = stepper.querySelector('.gengage-qty-value') as HTMLElement;

    // After swap: min=1, max=10. Initial should be min=1
    expect(valueEl.textContent).toBe('1');
    expect(decBtn.disabled).toBe(true);
    expect(incBtn.disabled).toBe(false);

    incBtn.click();
    expect(valueEl.textContent).toBe('2');
  });

  it('renders compact mode with cart SVG icon', () => {
    const onSubmit = vi.fn();
    const stepper = createQuantityStepper({ onSubmit, compact: true });

    expect(stepper.classList.contains('gengage-qty-stepper--compact')).toBe(true);
    const submitBtn = stepper.querySelector('.gengage-qty-submit') as HTMLButtonElement;
    expect(submitBtn.querySelector('svg')).toBeTruthy();
  });

  it('renders full mode with label text', () => {
    const onSubmit = vi.fn();
    const stepper = createQuantityStepper({ onSubmit, label: 'Add to Basket' });

    const submitBtn = stepper.querySelector('.gengage-qty-submit') as HTMLButtonElement;
    expect(submitBtn.textContent).toBe('Add to Basket');
  });

  it('respects custom initial value', () => {
    const onSubmit = vi.fn();
    const stepper = createQuantityStepper({ onSubmit, min: 1, max: 99, initial: 5 });

    const valueEl = stepper.querySelector('.gengage-qty-value') as HTMLElement;
    expect(valueEl.textContent).toBe('5');
  });

  it('clamps initial value to valid range', () => {
    const onSubmit = vi.fn();
    const stepper = createQuantityStepper({ onSubmit, min: 5, max: 10, initial: 1 });

    const valueEl = stepper.querySelector('.gengage-qty-value') as HTMLElement;
    expect(valueEl.textContent).toBe('5');
  });

  it('stops propagation on container click', () => {
    const onSubmit = vi.fn();
    const stepper = createQuantityStepper({ onSubmit });

    const parentClick = vi.fn();
    const wrapper = document.createElement('div');
    wrapper.addEventListener('click', parentClick);
    wrapper.appendChild(stepper);

    stepper.click();
    expect(parentClick).not.toHaveBeenCalled();
  });
});

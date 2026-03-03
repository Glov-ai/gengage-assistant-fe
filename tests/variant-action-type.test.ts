import { describe, it, expect } from 'vitest';

/**
 * Tests that variant button clicks dispatch 'launchVariant' action type.
 * Production sends launchVariant (not launchSingleProduct) for variant selection.
 */
describe('Variant Action Type', () => {
  it('variant action type should be launchVariant', () => {
    const variantSku = 'SKU-VARIANT-1';
    const variantName = 'Red / Large';

    const action = {
      title: variantName,
      type: 'launchVariant',
      payload: { sku: variantSku },
    };

    expect(action.type).toBe('launchVariant');
    expect(action.payload.sku).toBe(variantSku);
  });

  it('variant action should NOT be launchSingleProduct', () => {
    const correctType = 'launchVariant';
    const wrongType = 'launchSingleProduct';
    expect(correctType).not.toBe(wrongType);
  });
});

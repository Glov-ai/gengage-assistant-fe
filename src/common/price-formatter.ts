/**
 * Configurable price formatting.
 *
 * Defaults to Turkish locale (dot thousands, comma decimal, TL suffix),
 * but renders whole TL amounts without kurus for a cleaner retail UI.
 * Configure via widget config `pricing` field for any locale/currency.
 */

export interface PriceFormatConfig {
  currencyCode?: string;
  /** Currency symbol. Default: 'TL' */
  currencySymbol?: string;
  /** Where to place the symbol. Default: 'suffix' */
  currencyPosition?: 'prefix' | 'suffix';
  /** Separator between thousands. Default: '.' (Turkish) */
  thousandsSeparator?: string;
  /** Decimal point character. Default: ',' (Turkish) */
  decimalSeparator?: string;
  /** Whether to show decimal part for whole numbers. Default: false */
  alwaysShowDecimals?: boolean;
}

const TURKISH_DEFAULTS: Required<PriceFormatConfig> = {
  currencyCode: 'TRY',
  currencySymbol: 'TL',
  currencyPosition: 'suffix',
  thousandsSeparator: '.',
  decimalSeparator: ',',
  alwaysShowDecimals: false,
};

/**
 * Formats a raw numeric price string into the configured locale format.
 *
 * Examples (default Turkish):
 *   "17990"   → "17.990 TL"
 *   "17990.5" → "17.990,50 TL"
 *
 * Examples (GBP prefix):
 *   "17990" with { currencySymbol: '£', currencyPosition: 'prefix', thousandsSeparator: ',', decimalSeparator: '.' }
 *   → "£17,990"
 *
 * Returns the input as-is if it's not a valid number.
 */
export function formatPrice(raw: string, config?: PriceFormatConfig): string {
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0) return raw;

  const resolved = { ...TURKISH_DEFAULTS, ...config };

  const isWholeAmount = Math.abs(num % 1) < Number.EPSILON;
  const shouldShowDecimals = resolved.alwaysShowDecimals || !isWholeAmount;
  const fixed = shouldShowDecimals ? num.toFixed(2) : num.toFixed(0);
  const dotIdx = fixed.indexOf('.');
  const intPart = dotIdx === -1 ? fixed : fixed.slice(0, dotIdx);
  const decPart = dotIdx === -1 ? undefined : fixed.slice(dotIdx + 1);

  // Add thousands separators to integer part
  const withSeparators = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, resolved.thousandsSeparator);

  let formatted: string;
  if (decPart !== undefined) {
    formatted = `${withSeparators}${resolved.decimalSeparator}${decPart}`;
  } else {
    formatted = withSeparators;
  }

  if (resolved.currencySymbol) {
    if (resolved.currencyPosition === 'prefix') {
      return `${resolved.currencySymbol}${formatted}`;
    }
    return `${formatted} ${resolved.currencySymbol}`;
  }

  return formatted;
}

/**
 * Shared product rendering utilities.
 *
 * Extracted from chat/renderUISpec and simrel/ProductCard to eliminate
 * duplication and provide consistent behavior across all widgets.
 */

/** Clamp a rating value to the 0–5 range. Returns 0 for NaN/non-finite. */
export function clampRating(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(5, value));
}

/** Clamp a discount percentage to the 0–100 range, rounded to integer. Returns 0 for NaN/non-finite. */
export function clampDiscount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Render a star rating string with full, half, and empty stars.
 *
 * @param rating - A numeric rating (will be clamped to 0–5).
 * @param halfStars - Whether to render half-star characters. Defaults to true.
 * @returns A string like "★★★½☆" or "★★★☆☆" (without half-stars).
 */
export function renderStarRating(rating: number, halfStars: boolean = true): string {
  const clamped = clampRating(rating);
  if (halfStars) {
    const full = Math.floor(clamped);
    const half = clamped - full >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return '\u2605'.repeat(full) + (half ? '\u00BD' : '') + '\u2606'.repeat(empty);
  }
  const rounded = Math.round(clamped);
  return '\u2605'.repeat(rounded) + '\u2606'.repeat(5 - rounded);
}

/**
 * Attach a one-time error handler that hides the image on load failure.
 *
 * Works with any HTMLImageElement. Hides the element by setting
 * `display: none` so layout doesn't break from broken images.
 */
export function addImageErrorHandler(img: HTMLImageElement): void {
  img.addEventListener(
    'error',
    () => {
      img.style.display = 'none';
    },
    { once: true },
  );
}

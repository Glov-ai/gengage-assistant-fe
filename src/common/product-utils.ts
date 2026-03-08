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
 * Create a star rating DOM element with proper half-filled star rendering.
 *
 * Uses a CSS-clipped full star overlaid on an empty star for the half-star,
 * giving a visually accurate half-filled appearance instead of the "½" character.
 *
 * @param rating - A numeric rating (will be clamped to 0–5).
 * @returns An HTMLSpanElement containing the star icons.
 */
export function createStarRatingElement(rating: number): HTMLSpanElement {
  const clamped = clampRating(rating);
  const full = Math.floor(clamped);
  const hasHalf = clamped - full >= 0.5;
  const empty = 5 - full - (hasHalf ? 1 : 0);

  const container = document.createElement('span');
  container.className = 'gengage-star-rating';

  if (full > 0) {
    container.appendChild(document.createTextNode('\u2605'.repeat(full)));
  }

  if (hasHalf) {
    const halfStar = document.createElement('span');
    halfStar.className = 'gengage-star-half';
    halfStar.textContent = '\u2606';
    const filled = document.createElement('span');
    filled.textContent = '\u2605';
    halfStar.appendChild(filled);
    container.appendChild(halfStar);
  }

  if (empty > 0) {
    container.appendChild(document.createTextNode('\u2606'.repeat(empty)));
  }

  return container;
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

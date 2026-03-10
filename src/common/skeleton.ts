/**
 * Shared loading skeleton utility.
 *
 * Creates shimmer placeholder elements for cards or messages while
 * content loads. Respects `prefers-reduced-motion` via CSS (no animation
 * when reduced motion is preferred).
 */

export function createSkeleton(type: 'card' | 'message'): HTMLElement {
  const container = document.createElement('div');
  container.className = `gengage-skeleton gengage-skeleton--${type}`;

  if (type === 'card') {
    for (let i = 0; i < 3; i++) {
      const card = document.createElement('div');
      card.className = 'gengage-skeleton-card';
      const img = document.createElement('div');
      img.className = 'gengage-skeleton-img';
      card.appendChild(img);
      const text = document.createElement('div');
      text.className = 'gengage-skeleton-text';
      card.appendChild(text);
      const price = document.createElement('div');
      price.className = 'gengage-skeleton-price';
      card.appendChild(price);
      container.appendChild(card);
    }
  } else {
    container.classList.add('gengage-skeleton-message');
    for (let i = 0; i < 3; i++) {
      const line = document.createElement('div');
      line.className = 'gengage-skeleton-line';
      line.style.width = `${60 + i * 15}%`;
      container.appendChild(line);
    }
  }
  return container;
}

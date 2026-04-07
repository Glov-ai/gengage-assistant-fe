/**
 * UI Utilities for the Gengage Chat components.
 */

/**
 * Creates a Lucide-style SVG icon from paths.
 * @param paths SVG path strings (the 'd' attribute).
 * @param size Icon width/height in pixels.
 * @returns An SVGElement.
 */
export function createLucideIcon(paths: string[], size = 18): SVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');

  for (const d of paths) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }

  return svg;
}

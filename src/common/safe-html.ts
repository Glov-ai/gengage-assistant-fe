/**
 * DOMParser-based HTML sanitizer.
 *
 * Backend sends HTML in assistant messages (e.g. KVKK notice).
 * This module strips dangerous elements/attributes while preserving
 * safe formatting tags.
 *
 * WARNING: Any new injection point that uses innerHTML must call this function first.
 */

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'a',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'span',
  'div',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'hr',
  'code',
  'pre',
  'blockquote',
  'img',
  'sup',
  'sub',
]);

/** Elements removed entirely (children NOT promoted). */
const DISALLOWED_TAGS = new Set([
  'script',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'textarea',
  'select',
  'button',
  'style',
  'link',
  'meta',
  'template',
  'noscript',
]);

/**
 * Attributes allowed per-tag. `'*'` means any allowed tag.
 * The `style` attribute is further sanitized by `sanitizeCssStyle()` to
 * strip dangerous CSS values (url(), expression(), -moz-binding, etc.).
 */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  '*': new Set(['class']),
  a: new Set(['href', 'target', 'rel']),
  img: new Set(['src', 'alt', 'width', 'height']),
  div: new Set(['style']),
  span: new Set(['style']),
  p: new Set(['style']),
};

function hasJavascriptProtocol(value: string): boolean {
  // Normalize whitespace + case then check
  return /^\s*javascript\s*:/i.test(value);
}

/** CSS properties considered safe in style attributes (layout + typography). */
const SAFE_CSS_PROPERTIES = new Set([
  'color',
  'background-color',
  'font-size',
  'font-weight',
  'font-style',
  'font-family',
  'text-align',
  'text-decoration',
  'line-height',
  'letter-spacing',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-radius',
  'border-color',
  'border-width',
  'border-style',
  'width',
  'max-width',
  'min-width',
  'height',
  'max-height',
  'min-height',
  'display',
  'vertical-align',
  'white-space',
  'word-break',
  'overflow',
  'opacity',
  'visibility',
  'list-style',
  'list-style-type',
  'text-transform',
  'text-indent',
  'text-overflow',
  'box-sizing',
  'flex',
  'flex-direction',
  'flex-wrap',
  'justify-content',
  'align-items',
  'gap',
]);

/** Patterns indicating dangerous CSS values that could execute code or load external resources. */
const DANGEROUS_CSS_VALUE = /url\s*\(|expression\s*\(|javascript\s*:|\bimport\b|-moz-binding|behavior\s*:/i;

/**
 * Sanitize a CSS style attribute value.
 * Allowlists safe properties and rejects values containing dangerous patterns.
 * Returns empty string if nothing is safe.
 */
function sanitizeCssStyle(raw: string): string {
  const safe: string[] = [];
  for (const decl of raw.split(';')) {
    const trimmed = decl.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const property = trimmed.slice(0, colonIdx).trim().toLowerCase();
    const value = trimmed.slice(colonIdx + 1).trim();
    if (!SAFE_CSS_PROPERTIES.has(property)) continue;
    if (DANGEROUS_CSS_VALUE.test(value)) continue;
    safe.push(trimmed);
  }
  return safe.join('; ');
}

function sanitizeNode(node: Node, parent: Node): void {
  if (node.nodeType === Node.TEXT_NODE) return;

  if (node.nodeType !== Node.ELEMENT_NODE) {
    node.parentNode?.removeChild(node);
    return;
  }

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  // Disallowed: remove entirely (including children)
  if (DISALLOWED_TAGS.has(tag)) {
    el.parentNode?.removeChild(el);
    return;
  }

  // Unknown: unwrap (promote children to parent)
  if (!ALLOWED_TAGS.has(tag)) {
    const children = Array.from(el.childNodes);
    for (const child of children) {
      parent.insertBefore(child, el);
    }
    parent.removeChild(el);
    // Sanitize promoted children
    for (const child of children) {
      sanitizeNode(child, parent);
    }
    return;
  }

  // Sanitize attributes
  const globalAllowed = ALLOWED_ATTRS['*'] ?? new Set();
  const tagAllowed = ALLOWED_ATTRS[tag] ?? new Set();
  const attrs = Array.from(el.attributes);

  for (const attr of attrs) {
    const name = attr.name.toLowerCase();

    if (!globalAllowed.has(name) && !tagAllowed.has(name)) {
      el.removeAttribute(attr.name);
      continue;
    }

    // Strip javascript: protocol from any attribute value
    if (hasJavascriptProtocol(attr.value)) {
      el.removeAttribute(attr.name);
      continue;
    }

    // Sanitize CSS style values to prevent XSS via url(), expression(), etc.
    if (name === 'style') {
      const sanitized = sanitizeCssStyle(attr.value);
      if (sanitized) {
        el.setAttribute('style', sanitized);
      } else {
        el.removeAttribute('style');
      }
      continue;
    }
  }

  // Validate specific attribute values
  if (tag === 'a') {
    const href = el.getAttribute('href');
    if (href !== null) {
      const trimmed = href.trim().toLowerCase();
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('mailto:')) {
        el.removeAttribute('href');
      }
    }
    // Force safe link behavior
    el.setAttribute('target', '_blank');
    el.setAttribute('rel', 'noopener noreferrer');
  }

  if (tag === 'img') {
    const src = el.getAttribute('src');
    if (src !== null) {
      const trimmed = src.trim().toLowerCase();
      if (!trimmed.startsWith('https://')) {
        el.removeAttribute('src');
      }
    }
  }

  // Recurse into children (snapshot the list since we may mutate)
  const children = Array.from(el.childNodes);
  for (const child of children) {
    sanitizeNode(child, el);
  }
}

/**
 * Sanitize an HTML string for safe insertion via innerHTML.
 *
 * - Allowed tags are preserved; disallowed tags are removed entirely.
 * - Unknown tags are unwrapped (children promoted).
 * - `<a>` tags are forced to `target="_blank" rel="noopener noreferrer"`.
 * - Only `https://` is allowed for `<img src>`.
 */
const SAFE_URL_PROTOCOLS = ['http:', 'https:'];

/** Check if a URL uses a safe protocol (http or https). */
export function isSafeImageUrl(url: string): boolean {
  try {
    return SAFE_URL_PROTOCOLS.includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

/**
 * Check if a URL is safe for use in href/src attributes.
 * Allows http:, https:, and relative paths (starting with `/`).
 */
export function isSafeUrl(url: string): boolean {
  // Allow relative paths but reject protocol-relative URLs (//evil.com/...)
  if (url.startsWith('/') && !url.startsWith('//')) return true;
  try {
    const parsed = new URL(url);
    return SAFE_URL_PROTOCOLS.includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Safely set an attribute on an element.
 * For `href` and `src` attributes, validates the URL against safe protocols.
 */
export function safeSetAttribute(el: HTMLElement, attr: string, value: string): void {
  if (attr === 'href' || attr === 'src') {
    if (!isSafeUrl(value)) return;
  }
  el.setAttribute(attr, value);
}

export function sanitizeHtml(raw: string): string {
  if (!raw) return '';

  const doc = new DOMParser().parseFromString(raw, 'text/html');
  const body = doc.body;

  const children = Array.from(body.childNodes);
  for (const child of children) {
    sanitizeNode(child, body);
  }

  return body.innerHTML;
}

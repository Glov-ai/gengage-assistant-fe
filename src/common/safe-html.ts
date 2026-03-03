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
]);

/**
 * Attributes allowed per-tag. `'*'` means any allowed tag.
 *
 * KNOWN TECH DEBT [SECURITY]: `style` attribute on div/span/p enables CSS-based XSS vectors:
 *   - `style="background:url(javascript:alert(1))"` bypasses hasJavascriptProtocol
 *     (which checks the raw attribute value, not nested CSS url() arguments)
 *   - `style="expression(alert(1))"` on legacy IE
 *   - `style="-moz-binding:url(...)"` on older Firefox
 *   Tracked for fix: either remove `style` from ALLOWED_ATTRS entirely, or implement
 *   a CSS property sanitizer that allowlists specific properties and validates values.
 *   Also add `<template>` to DISALLOWED_TAGS for defense-in-depth.
 *   Risk is mitigated by: (1) modern browsers block javascript: in CSS url(),
 *   (2) backend is trusted first-party, (3) only relevant if backend is compromised.
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

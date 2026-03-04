/**
 * Product mention linker.
 *
 * After sanitiseHtml() renders bot text, this module walks text nodes and
 * wraps product name occurrences with clickable links that dispatch a
 * `launchSingleProduct` action.
 *
 * XSS safety: Uses DOM text-node manipulation only — no innerHTML.
 */

export interface ProductMention {
  sku: string;
  short_name: string;
}

export interface ProductMentionLinkerOptions {
  container: HTMLElement;
  mentions: ProductMention[];
  onProductClick: (sku: string) => void;
}

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && /[\p{L}\p{N}_]/u.test(char);
}

/**
 * Walk text nodes in `container` and wrap occurrences of each mention's
 * `short_name` with a clickable `<a>` element.
 *
 * Only the first occurrence of each mention is linked to avoid visual clutter.
 */
export function linkProductMentions(options: ProductMentionLinkerOptions): void {
  const { container, mentions, onProductClick } = options;
  if (mentions.length === 0) return;

  // Build a map of lowercase short_name → mention for case-insensitive matching
  const mentionMap = new Map<string, ProductMention>();
  for (const m of mentions) {
    if (m.short_name.length === 0) continue;
    mentionMap.set(m.short_name.toLowerCase(), m);
  }

  if (mentionMap.size === 0) return;

  // Process one mention at a time, re-walking the tree each time
  // (DOM mutations invalidate the walker)
  for (const [lowerName, mention] of mentionMap) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    let found = false;

    while (node && !found) {
      const text = node.textContent ?? '';
      const idx = text.toLowerCase().indexOf(lowerName);
      if (idx === -1) {
        node = walker.nextNode();
        continue;
      }

      const prevChar = idx > 0 ? text[idx - 1] : undefined;
      const nextChar = text[idx + mention.short_name.length];
      if (isWordChar(prevChar) || isWordChar(nextChar)) {
        node = walker.nextNode();
        continue;
      }

      const before = text.slice(0, idx);
      const match = text.slice(idx, idx + mention.short_name.length);
      const after = text.slice(idx + mention.short_name.length);

      const parent = node.parentNode;
      if (!parent) {
        node = walker.nextNode();
        continue;
      }

      const link = document.createElement('a');
      link.className = 'gengage-product-mention';
      link.textContent = match;
      link.href = '#';
      link.addEventListener('click', (e) => {
        e.preventDefault();
        onProductClick(mention.sku);
      });

      if (before) parent.insertBefore(document.createTextNode(before), node);
      parent.insertBefore(link, node);
      if (after) parent.insertBefore(document.createTextNode(after), node);
      parent.removeChild(node);

      found = true;
    }
  }
}

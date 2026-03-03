/**
 * URL-based page type detection.
 *
 * Provides auto-detection of page type from URL patterns and DOM signals.
 * Falls back to 'other' when no rule matches.
 */

import type { PageContext } from './types.js';

export type DetectablePageType = PageContext['pageType'];

export interface PageDetectionRule {
  /** Page type to assign when this rule matches. */
  pageType: DetectablePageType;
  /** URL pathname patterns (tested with `new RegExp(pattern)`). */
  urlPatterns?: string[];
  /** If present, page type is detected only when this query param exists. */
  queryParam?: string;
  /** DOM selector — if an element matching this exists, rule matches. */
  selector?: string;
}

/** Default rules covering common Turkish e-commerce URL patterns. */
const DEFAULT_RULES: PageDetectionRule[] = [
  {
    pageType: 'home',
    urlPatterns: ['^/$', '^/index\\.html?$', '^/anasayfa$'],
  },
  {
    pageType: 'search',
    urlPatterns: ['/arama', '/search', '/ara\\?'],
    queryParam: 'q',
  },
  {
    pageType: 'cart',
    urlPatterns: ['/sepet', '/cart', '/basket', '/sepetim'],
  },
  {
    pageType: 'plp',
    urlPatterns: ['/kategori/', '/category/', '/c/', '/koleksiyon/', '/collection/'],
  },
  {
    pageType: 'pdp',
    urlPatterns: ['/urun/', '/product/', '/p/', '/-p-', '/-pm-'],
  },
];

/**
 * Detects page type from the current URL and optional DOM signals.
 *
 * @param rules - Custom rules (defaults to common Turkish e-commerce patterns).
 * @param url   - URL to analyze (defaults to window.location).
 * @returns Detected page type, or 'other' if no rule matches.
 */
export function detectPageType(rules?: PageDetectionRule[], url?: URL): DetectablePageType {
  const loc = url ?? (typeof window !== 'undefined' ? new URL(window.location.href) : null);
  if (!loc) return 'other';

  const effectiveRules = rules ?? DEFAULT_RULES;
  const pathname = loc.pathname;

  for (const rule of effectiveRules) {
    // Check URL patterns
    if (rule.urlPatterns) {
      const urlMatch = rule.urlPatterns.some((pattern) => {
        try {
          return new RegExp(pattern, 'i').test(pathname);
        } catch {
          return false;
        }
      });
      if (!urlMatch) continue;
    }

    // Check query param requirement
    if (rule.queryParam && !loc.searchParams.has(rule.queryParam)) {
      continue;
    }

    // Check DOM selector
    if (rule.selector && typeof document !== 'undefined') {
      if (!document.querySelector(rule.selector)) continue;
    }

    return rule.pageType;
  }

  return 'other';
}

/**
 * Attempts to extract a product SKU from the URL path.
 * Looks for common patterns like `/p/SKU`, `/urun/SKU`, `/-p-SKU`.
 */
export function extractSkuFromUrl(url?: URL): string | undefined {
  const loc = url ?? (typeof window !== 'undefined' ? new URL(window.location.href) : null);
  if (!loc) return undefined;

  const pathname = loc.pathname;

  // Pattern: /p/SKU or /urun/SKU or /product/SKU
  const segmentMatch = pathname.match(/\/(?:p|urun|product)\/([^/?#]+)/i);
  if (segmentMatch?.[1]) return segmentMatch[1];

  // Pattern: -p-SKU at end of path (Trendyol style)
  const suffixMatch = pathname.match(/-p-(\d+)/i);
  if (suffixMatch?.[1]) return suffixMatch[1];

  return undefined;
}

/**
 * Auto-detects page context from URL and DOM signals.
 * Use as a fallback when the host page doesn't set pageContext explicitly.
 */
export function autoDetectPageContext(rules?: PageDetectionRule[]): Partial<PageContext> {
  const pageType = detectPageType(rules);
  const result: Partial<PageContext> = { pageType };

  if (pageType === 'pdp') {
    const sku = extractSkuFromUrl();
    if (sku) result.sku = sku;
  }

  if (typeof window !== 'undefined') {
    result.url = window.location.href;
  }

  return result;
}

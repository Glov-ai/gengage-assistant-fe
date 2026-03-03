/**
 * KVKK notice filtering and caching helpers.
 *
 * KVKK (Kişisel Verilerin Korunması Kanunu) is Turkey's data protection law.
 * When the backend streams a response containing a KVKK notice, we:
 * 1. Strip the KVKK block from the visible bot text
 * 2. Show a banner on first encounter (per account)
 * 3. Mark it as shown in localStorage to avoid repeat banners
 */

const KVKK_STORAGE_KEY = 'gengage_kvkk_shown';
const KVKK_TEXT_MARKERS = ['kvkk', 'kişisel veri', 'kisisel veri'];
const KVKK_LAW_NUMBER_RE = /\b6698\b/;

export function containsKvkk(html: string): boolean {
  const lower = html.toLowerCase();
  return KVKK_TEXT_MARKERS.some((m) => lower.includes(m)) || KVKK_LAW_NUMBER_RE.test(lower);
}

export function isKvkkShown(accountId: string): boolean {
  try {
    return localStorage.getItem(`${KVKK_STORAGE_KEY}_${accountId}`) === '1';
  } catch {
    return false;
  }
}

export function markKvkkShown(accountId: string): void {
  try {
    localStorage.setItem(`${KVKK_STORAGE_KEY}_${accountId}`, '1');
  } catch {
    // localStorage unavailable — silently ignore
  }
}

/**
 * Strip the KVKK portion from bot HTML.
 * KVKK is typically wrapped in a `<div style="...">` at the start.
 * We remove the first block-level element that contains a KVKK marker.
 */
export function stripKvkkBlock(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;
  const children = Array.from(body.children);
  for (const child of children) {
    if (containsKvkk(child.textContent ?? '')) {
      child.remove();
      break; // Only strip the first KVKK block
    }
  }
  return body.innerHTML.trim();
}

export function extractKvkkBlock(html: string): string | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const child of Array.from(doc.body.children)) {
    if (containsKvkk(child.textContent ?? '')) {
      return child.outerHTML;
    }
  }
  return null;
}

const LOCALE_TO_LANGUAGE: Record<string, string> = {
  tr: 'TURKISH',
  en: 'ENGLISH',
  de: 'GERMAN',
  fr: 'FRENCH',
};

export function localeToOutputLanguage(locale?: string): string {
  if (!locale) return 'TURKISH';
  return LOCALE_TO_LANGUAGE[locale.toLowerCase().slice(0, 2)] ?? 'TURKISH';
}

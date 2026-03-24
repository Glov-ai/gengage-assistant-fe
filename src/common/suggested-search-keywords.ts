/**
 * Compact browse-card keyword line for `aiSuggestedSearches`.
 *
 * Prefer backend `display_keywords`; otherwise derive short fragments from
 * `chosen_attribute` / `short_name`. Does not use `why_different` (avoids long
 * explanatory sentences in the tertiary line).
 */

export type SuggestedSearchKeywordSource = {
  display_keywords?: string[];
  chosen_attribute?: string;
  short_name?: string;
};

const MAX_KEYWORDS = 3;

const cleanKeyword = (value: string, options?: { stripLeadingStopWords?: boolean }): string => {
  const normalized = value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[,.;:!?•-]+|[,.;:!?•-]+$/g, '');

  if (!normalized) {
    return '';
  }

  const withoutStopWords = options?.stripLeadingStopWords
    ? normalized.replace(/^(?:daha|için)\s+/i, '').trim()
    : normalized;

  if (!withoutStopWords) {
    return '';
  }

  return withoutStopWords.split(/\s+/).slice(0, 3).join(' ').trim();
};

const splitKeywordSource = (value?: string, options?: { stripLeadingStopWords?: boolean }): string[] => {
  if (!value) {
    return [];
  }

  return value
    .split(/[•,;:/()]|(?:\sve\s)|(?:\sand\s)|(?:\sile\s)|(?:\sfor\s)|(?:\swith\s)/i)
    .map((part) => cleanKeyword(part, options))
    .filter(Boolean);
};

/**
 * Ordered unique keywords (max 3) for suggested-search browse cards.
 */
export function getSuggestedSearchKeywords(search: SuggestedSearchKeywordSource): string[] {
  const explicitKeywords = (search.display_keywords ?? []).flatMap((keyword) =>
    splitKeywordSource(keyword, { stripLeadingStopWords: true }),
  );
  const uniqueExplicit = explicitKeywords.filter((keyword, index) => explicitKeywords.indexOf(keyword) === index);
  if (uniqueExplicit.length > 0) {
    return uniqueExplicit.slice(0, MAX_KEYWORDS);
  }

  const fallbackKeywords = [
    ...splitKeywordSource(search.chosen_attribute, { stripLeadingStopWords: true }),
    ...splitKeywordSource(search.short_name),
  ];
  return fallbackKeywords
    .filter((keyword, index) => fallbackKeywords.indexOf(keyword) === index)
    .slice(0, MAX_KEYWORDS);
}

/** Join keywords for the tertiary browse line (e.g. "A • B • C"). */
export function getSuggestedSearchKeywordsText(search: SuggestedSearchKeywordSource): string {
  return getSuggestedSearchKeywords(search).join(' • ');
}

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

const cleanKeyword = (value: string): string => {
  const normalized = value
    .replace(/\s+/g, ' ')
    .replace(/^(?:daha|için)\s+/i, '')
    .trim()
    .replace(/^[,.;:!?•-]+|[,.;:!?•-]+$/g, '');

  if (!normalized) {
    return '';
  }

  return normalized.split(/\s+/).slice(0, 3).join(' ').trim();
};

const splitKeywordSource = (value?: string): string[] => {
  if (!value) {
    return [];
  }

  return value
    .split(/[•,;:/()]|(?:\sve\s)|(?:\sand\s)|(?:\sile\s)|(?:\sfor\s)|(?:\swith\s)/i)
    .map((part) => cleanKeyword(part))
    .filter(Boolean);
};

/**
 * Ordered unique keywords (max 3) for suggested-search browse cards.
 */
export function getSuggestedSearchKeywords(search: SuggestedSearchKeywordSource): string[] {
  const orderedCandidates = [
    ...(search.display_keywords ?? []).flatMap((keyword) => splitKeywordSource(keyword)),
    ...splitKeywordSource(search.chosen_attribute),
    ...splitKeywordSource(search.short_name),
  ];

  return orderedCandidates
    .filter((keyword, index) => orderedCandidates.indexOf(keyword) === index)
    .slice(0, MAX_KEYWORDS);
}

/** Join keywords for the tertiary browse line (e.g. "A • B • C"). */
export function getSuggestedSearchKeywordsText(search: SuggestedSearchKeywordSource): string {
  return getSuggestedSearchKeywords(search).join(' • ');
}

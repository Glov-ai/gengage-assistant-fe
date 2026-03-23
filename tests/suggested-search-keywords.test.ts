import { describe, expect, it } from 'vitest';
import {
  getSuggestedSearchKeywords,
  getSuggestedSearchKeywordsText,
} from '../src/common/suggested-search-keywords.js';

const base = {
  short_name: 'Standart Toz Torbalari',
  detailed_user_message: 'Standart toz torbalarini goster',
  why_different: 'Daha yuksek enerji verimliligi ile daha fazla alan sunar.',
};

describe('suggestedSearchKeywords', () => {
  it('prefers display_keywords from the backend', () => {
    const search = {
      ...base,
      display_keywords: ['Robot Supurge', 'Kolay Degisim', 'Hijyenik'],
    };
    expect(getSuggestedSearchKeywords(search)).toEqual(['Robot Supurge', 'Kolay Degisim', 'Hijyenik']);
    expect(getSuggestedSearchKeywordsText(search)).toBe('Robot Supurge • Kolay Degisim • Hijyenik');
  });

  it('falls back to attribute and name fragments without using why_different', () => {
    const search = {
      ...base,
      chosen_attribute: 'A+++ Enerji Sinifi',
    };
    expect(getSuggestedSearchKeywords(search)).toEqual(['A+++ Enerji Sinifi', 'Standart Toz Torbalari']);
    expect(getSuggestedSearchKeywordsText(search)).toBe('A+++ Enerji Sinifi • Standart Toz Torbalari');
  });
});

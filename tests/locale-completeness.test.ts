import { describe, it, expect } from 'vitest';
import { CHAT_I18N_EN } from '../src/chat/locales/en.js';
import { CHAT_I18N_TR } from '../src/chat/locales/tr.js';
import { QNA_I18N_EN } from '../src/qna/locales/en.js';
import { QNA_I18N_TR } from '../src/qna/locales/tr.js';
import { SIMREL_I18N_EN } from '../src/simrel/locales/en.js';
import { SIMREL_I18N_TR } from '../src/simrel/locales/tr.js';

describe('locale key completeness', () => {
  it('chat EN and TR have identical keys', () => {
    const enKeys = Object.keys(CHAT_I18N_EN).sort();
    const trKeys = Object.keys(CHAT_I18N_TR).sort();
    expect(enKeys).toEqual(trKeys);
  });

  it('chat EN has no empty string values', () => {
    for (const [key, value] of Object.entries(CHAT_I18N_EN)) {
      expect(value, `EN chat key "${key}" should not be empty`).not.toBe('');
    }
  });

  it('chat TR has no empty string values', () => {
    for (const [key, value] of Object.entries(CHAT_I18N_TR)) {
      expect(value, `TR chat key "${key}" should not be empty`).not.toBe('');
    }
  });

  it('qna EN and TR have identical keys', () => {
    const enKeys = Object.keys(QNA_I18N_EN).sort();
    const trKeys = Object.keys(QNA_I18N_TR).sort();
    expect(enKeys).toEqual(trKeys);
  });

  it('simrel EN and TR have identical keys', () => {
    const enKeys = Object.keys(SIMREL_I18N_EN).sort();
    const trKeys = Object.keys(SIMREL_I18N_TR).sort();
    expect(enKeys).toEqual(trKeys);
  });

  it('all locale objects have only string values', () => {
    const allLocales = [CHAT_I18N_EN, CHAT_I18N_TR, QNA_I18N_EN, QNA_I18N_TR, SIMREL_I18N_EN, SIMREL_I18N_TR];

    for (const locale of allLocales) {
      for (const [key, value] of Object.entries(locale)) {
        expect(typeof value, `key "${key}" should be a string`).toBe('string');
      }
    }
  });
});

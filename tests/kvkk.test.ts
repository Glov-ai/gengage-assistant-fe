import { describe, it, expect, beforeEach } from 'vitest';
import {
  containsKvkk,
  stripKvkkBlock,
  extractKvkkBlock,
  localeToOutputLanguage,
  isKvkkShown,
  markKvkkShown,
} from '../src/chat/kvkk.js';

describe('kvkk', () => {
  describe('containsKvkk', () => {
    it('detects "kvkk" keyword', () => {
      expect(containsKvkk('KVKK hakkında bilgilendirme')).toBe(true);
    });

    it('detects "kişisel veri" keyword', () => {
      expect(containsKvkk('Kişisel veri koruma politikası')).toBe(true);
    });

    it('detects "kisisel veri" (ASCII) keyword', () => {
      expect(containsKvkk('Kisisel veri bilgilendirmesi')).toBe(true);
    });

    it('detects law number 6698', () => {
      expect(containsKvkk('6698 sayılı kanun kapsamında')).toBe(true);
    });

    it('returns false for non-KVKK content', () => {
      expect(containsKvkk('Bu ürün hakkında bilgi verin')).toBe(false);
    });

    it('is case-insensitive', () => {
      expect(containsKvkk('kvkk')).toBe(true);
      expect(containsKvkk('KVKK')).toBe(true);
    });
  });

  describe('stripKvkkBlock', () => {
    it('removes the first KVKK block', () => {
      const html = '<div>KVKK bilgilendirmesi</div><p>Normal metin</p>';
      const result = stripKvkkBlock(html);
      expect(result).not.toContain('KVKK');
      expect(result).toContain('Normal metin');
    });

    it('removes only the first KVKK block', () => {
      const html = '<div>KVKK 1</div><p>KVKK 2</p><p>Normal</p>';
      const result = stripKvkkBlock(html);
      expect(result).toContain('KVKK 2');
      expect(result).toContain('Normal');
    });

    it('returns full content when no KVKK found', () => {
      const html = '<p>Hello world</p>';
      expect(stripKvkkBlock(html)).toBe('<p>Hello world</p>');
    });
  });

  describe('extractKvkkBlock', () => {
    it('returns the first KVKK block HTML', () => {
      const html = '<div style="font-size:12px">KVKK bilgilendirmesi</div><p>Other</p>';
      const result = extractKvkkBlock(html);
      expect(result).toContain('KVKK bilgilendirmesi');
      expect(result).not.toContain('Other');
    });

    it('returns null when no KVKK block found', () => {
      expect(extractKvkkBlock('<p>No notice here</p>')).toBeNull();
    });
  });

  describe('localeToOutputLanguage', () => {
    it('returns TURKISH for "tr"', () => {
      expect(localeToOutputLanguage('tr')).toBe('TURKISH');
    });

    it('returns ENGLISH for "en"', () => {
      expect(localeToOutputLanguage('en')).toBe('ENGLISH');
    });

    it('returns GERMAN for "de"', () => {
      expect(localeToOutputLanguage('de')).toBe('GERMAN');
    });

    it('returns FRENCH for "fr"', () => {
      expect(localeToOutputLanguage('fr')).toBe('FRENCH');
    });

    it('handles locale with region code', () => {
      expect(localeToOutputLanguage('tr-TR')).toBe('TURKISH');
      expect(localeToOutputLanguage('en-US')).toBe('ENGLISH');
    });

    it('returns TURKISH for undefined/empty', () => {
      expect(localeToOutputLanguage()).toBe('TURKISH');
      expect(localeToOutputLanguage('')).toBe('TURKISH');
    });

    it('returns TURKISH for unknown locale', () => {
      expect(localeToOutputLanguage('ja')).toBe('TURKISH');
    });
  });

  describe('localStorage caching', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('isKvkkShown returns false when not set', () => {
      expect(isKvkkShown('test-account')).toBe(false);
    });

    it('markKvkkShown persists and isKvkkShown returns true', () => {
      markKvkkShown('test-account');
      expect(isKvkkShown('test-account')).toBe(true);
    });

    it('uses account-specific keys', () => {
      markKvkkShown('account-a');
      expect(isKvkkShown('account-a')).toBe(true);
      expect(isKvkkShown('account-b')).toBe(false);
    });
  });
});

import type { ChatI18n } from '../types.js';
import { CHAT_I18N_TR } from './tr.js';
import { CHAT_I18N_EN } from './en.js';

function normalizeLocale(locale?: string): string {
  if (!locale) return 'tr';
  return locale.toLowerCase().split('-')[0] ?? 'tr';
}

export function resolveChatLocale(locale?: string): ChatI18n {
  switch (normalizeLocale(locale)) {
    case 'en':
      return CHAT_I18N_EN;
    default:
      return CHAT_I18N_TR;
  }
}

export { CHAT_I18N_TR, CHAT_I18N_EN };

import type { SimRelI18n } from '../types.js';
import { SIMREL_I18N_TR } from './tr.js';
import { SIMREL_I18N_EN } from './en.js';

function normalizeLocale(locale?: string): string {
  if (!locale) return 'tr';
  return locale.toLowerCase().split('-')[0] ?? 'tr';
}

export function resolveSimRelLocale(locale?: string): SimRelI18n {
  switch (normalizeLocale(locale)) {
    case 'en':
      return SIMREL_I18N_EN;
    default:
      return SIMREL_I18N_TR;
  }
}

export { SIMREL_I18N_TR, SIMREL_I18N_EN };

import type { QNAI18n } from '../types.js';
import { QNA_I18N_TR } from './tr.js';
import { QNA_I18N_EN } from './en.js';

function normalizeLocale(locale?: string): string {
  if (!locale) return 'tr';
  return locale.toLowerCase().split('-')[0] ?? 'tr';
}

export function resolveQnaLocale(locale?: string): QNAI18n {
  switch (normalizeLocale(locale)) {
    case 'en':
      return QNA_I18N_EN;
    default:
      return QNA_I18N_TR;
  }
}

export { QNA_I18N_TR, QNA_I18N_EN };

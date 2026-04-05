import type { WidgetTheme } from './types.js';

/**
 * Shared baseline tokens used by account customizations.
 *
 * These values come from historical Gengage host defaults and are
 * intentionally conservative so account themes can override only what differs.
 */
export const BASE_WIDGET_THEME: WidgetTheme = {
  /* ── Editorial Commerce Framework ────────────────────────────────────── */
  /* Primary: signature red; never use pure black for text — use on_surface */
  primaryColor: '#b7102a',
  primaryForeground: '#ffffff',
  backgroundColor: '#ffffff' /* surface-card */,
  foregroundColor: '#111827' /* text-primary */,
  borderRadius: '0.75rem' /* md roundedness */,
  fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSize: '14px',
  zIndex: '1000',

  '--glov-chatbot-width': '420px',
  '--glov-left-spacing': '260px',
  '--chatbot-padding': '16px',
  '--root-wrapper-background-color': '#f8f9fa' /* background token */,
  '--root-wrapper-border-color': '#edeeef' /* surface-container */,

  '--gengage-chat-width': '400px',
  '--gengage-chat-shell-radius': '1rem' /* lg roundedness */,
  '--gengage-chat-header-height': '60px',
  '--gengage-chat-conversation-width': '396px',
  '--gengage-chat-panel-min-width': '320px',
  '--gengage-chat-panel-max-width': '860px',
  '--gengage-chat-input-height': '48px',
  '--gengage-qna-pill-radius': '999px' /* roundedness-full */,
  '--gengage-qna-input-radius': '0.75rem' /* md roundedness */,
  '--gengage-simrel-card-radius': '0.75rem' /* md roundedness */,

  '--client-primary': '#b7102a',
  '--client-primary-hover': 'color-mix(in srgb, #b7102a 88%, black 12%)',
  '--client-primary-active': 'color-mix(in srgb, #b7102a 78%, black 22%)',
  '--client-primary-subtle': 'color-mix(in srgb, #b7102a 12%, white)',
  '--client-primary-soft': 'color-mix(in srgb, #b7102a 20%, white)',
  '--client-on-primary': '#ffffff',
  '--client-focus-ring': 'color-mix(in srgb, #b7102a 32%, transparent)',

  '--surface-page': '#f6f7fb',
  '--surface-shell': '#10131a',
  '--surface-card': '#ffffff',
  '--surface-card-muted': '#f8fafc',
  '--surface-card-soft': '#f8fafc',
  '--surface-elevated': '#ffffff',
  '--surface-input': '#ffffff',
  '--surface-overlay': 'rgba(16, 19, 26, 0.52)',

  '--text-primary': '#111827',
  '--text-secondary': '#4b5563',
  '--text-muted': '#6b7280',
  '--text-inverse': '#f9fafb',

  '--border-subtle': 'rgba(17, 24, 39, 0.06)',
  '--border-default': 'rgba(17, 24, 39, 0.10)',
  '--border-strong': 'rgba(17, 24, 39, 0.18)',

  '--shadow-1': '0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)',
  '--shadow-2': '0 4px 12px rgba(16, 24, 40, 0.08)',
  '--shadow-3': '0 10px 24px rgba(16, 24, 40, 0.12)',

  '--radius-control': '12px',
  '--radius-card': '16px',
  '--radius-panel': '24px',
  '--radius-pill': '999px',

  '--success': '#16a34a',
  '--warning': '#d97706',
  '--error': '#dc2626',
  '--info': '#2563eb',
  '--rating': '#f5b301',

  '--ai-accent-start': '#0b24d6',
  '--ai-accent-end': '#f768f2',
  '--ai-accent-soft': 'linear-gradient(135deg, rgba(11, 36, 214, 0.08), rgba(247, 104, 242, 0.08))',
};

/**
 * Merge account overrides on top of the shared base theme.
 *
 * Account customization files should call this helper so shared defaults stay
 * centralized under src/common.
 */
export function withBaseTheme(overrides: WidgetTheme): WidgetTheme {
  return { ...BASE_WIDGET_THEME, ...overrides };
}

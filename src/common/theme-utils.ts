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
  backgroundColor: '#f8f9fa' /* canvas / background */,
  foregroundColor: '#191c1d' /* on_surface — softened contrast */,
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

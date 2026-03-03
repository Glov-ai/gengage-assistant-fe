import type { WidgetTheme } from './types.js';

/**
 * Shared baseline tokens used by account customizations.
 *
 * These values come from historical Gengage host defaults and are
 * intentionally conservative so account themes can override only what differs.
 */
export const BASE_WIDGET_THEME: WidgetTheme = {
  primaryColor: '#000000',
  primaryForeground: '#ffffff',
  backgroundColor: '#ffffff',
  foregroundColor: '#222222',
  borderRadius: '8px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontSize: '14px',
  zIndex: '1000',

  '--glov-chatbot-width': '420px',
  '--glov-left-spacing': '260px',
  '--chatbot-padding': '16px',
  '--root-wrapper-background-color': '#F2F2F2',
  '--root-wrapper-border-color': '#E5E5E5',

  '--gengage-chat-width': '400px',
  '--gengage-chat-shell-radius': '12px',
  '--gengage-chat-header-height': '60px',
  '--gengage-chat-conversation-width': '396px',
  '--gengage-chat-panel-min-width': '320px',
  '--gengage-chat-panel-max-width': '860px',
  '--gengage-chat-input-height': '48px',
  '--gengage-qna-pill-radius': '999px',
  '--gengage-qna-input-radius': '14px',
  '--gengage-simrel-card-radius': '14px',
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

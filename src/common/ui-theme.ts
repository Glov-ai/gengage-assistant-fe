import type { WidgetTheme } from './types.js';

/**
 * Shared SDK-wide visual tokens.
 *
 * Applied to every widget root by default so account customizations only
 * override what they need.
 */
export const DEFAULT_WIDGET_THEME_TOKENS: WidgetTheme = {
  '--gengage-chat-offset': '20px',
  '--gengage-chat-launcher-size': '56px',
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

export function withDefaultWidgetTheme(theme?: WidgetTheme): WidgetTheme {
  if (!theme) {
    return { ...DEFAULT_WIDGET_THEME_TOKENS };
  }
  return { ...DEFAULT_WIDGET_THEME_TOKENS, ...theme };
}

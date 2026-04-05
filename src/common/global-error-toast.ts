import type { GengageEventDetailMap } from './types.js';
import { listen } from './events.js';
import { BASE_WIDGET_THEME } from './theme-utils.js';

const ROOT_ID = 'gengage-global-toast-root';
const STYLE_ID = 'gengage-global-toast-style';
const ROOT_VISIBLE_CLASS = 'gengage-global-toast-root--visible';
const DEFAULT_DURATION_MS = 4200;
const MIN_DURATION_MS = 1500;
const MAX_DURATION_MS = 15000;
const THEME_SYNC_VARS = [
  '--gengage-font-family',
  '--surface-card',
  '--text-primary',
  '--text-muted',
  '--border-default',
  '--radius-card',
  '--shadow-3',
  '--error',
  '--ds-toast-error-bg',
  '--ds-toast-error-border',
  '--ds-toast-error-accent',
  '--ds-toast-error-fg',
  '--ds-toast-error-shadow',
] as const;

let listenerRegistered = false;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;

export function getGlobalErrorMessage(locale?: string): string {
  if (typeof locale === 'string' && locale.toLowerCase().startsWith('tr')) {
    return 'Bağlantı sorunu oluştu. Lütfen tekrar deneyin.';
  }
  return 'Connection issue. Please try again.';
}

export function registerGlobalErrorToastListener(): void {
  if (listenerRegistered || typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  listenerRegistered = true;
  listen('gengage:global:error', (detail) => {
    showGlobalErrorToast(detail);
  });
}

export function showGlobalErrorToast(detail: GengageEventDetailMap['gengage:global:error']): void {
  if (typeof document === 'undefined') return;
  const message = detail.message.trim();
  if (!message) return;

  ensureStyles();
  const root = ensureRoot();
  syncRootThemeVars(root);
  root.innerHTML = '';

  const toast = document.createElement('section');
  toast.className = 'gengage-global-toast gengage-global-toast--error';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  const title = document.createElement('div');
  title.className = 'gengage-global-toast-title';
  title.textContent = sourceTitle(detail.source);

  const body = document.createElement('div');
  body.className = 'gengage-global-toast-message';
  body.textContent = message;

  toast.appendChild(title);
  toast.appendChild(body);
  root.appendChild(toast);
  root.classList.add(ROOT_VISIBLE_CLASS);

  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }

  dismissTimer = setTimeout(() => {
    dismissGlobalErrorToast();
  }, clampDuration(detail.durationMs));
}

export function dismissGlobalErrorToast(): void {
  if (typeof document === 'undefined') return;
  const root = document.getElementById(ROOT_ID);
  if (!root) return;

  root.classList.remove(ROOT_VISIBLE_CLASS);
  root.innerHTML = '';

  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
}

function sourceTitle(source: GengageEventDetailMap['gengage:global:error']['source']): string {
  switch (source) {
    case 'chat':
      return 'Chat warning';
    case 'qna':
      return 'QnA warning';
    case 'simrel':
      return 'Widget warning';
    default:
      return 'Connection warning';
  }
}

function ensureRoot(): HTMLElement {
  const existing = document.getElementById(ROOT_ID);
  if (existing instanceof HTMLElement) return existing;

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.className = 'gengage-global-toast-root';
  document.body.appendChild(root);
  return root;
}

function syncRootThemeVars(root: HTMLElement): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const source = document.querySelector<HTMLElement>(
    '.gengage-chat-root, .gengage-qna-container, .gengage-simrel-container, .gengage-simbut-root',
  );
  if (!source) return;
  const computed = window.getComputedStyle(source);
  for (const name of THEME_SYNC_VARS) {
    const value = computed.getPropertyValue(name).trim();
    if (value) {
      root.style.setProperty(name, value);
    } else {
      root.style.removeProperty(name);
    }
  }
}

function clampDuration(durationMs?: number): number {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) {
    return DEFAULT_DURATION_MS;
  }
  return Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, Math.round(durationMs)));
}

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  const surfaceCard = BASE_WIDGET_THEME['--surface-card'] ?? BASE_WIDGET_THEME.backgroundColor ?? '#ffffff';
  const textPrimary = BASE_WIDGET_THEME['--text-primary'] ?? BASE_WIDGET_THEME.foregroundColor ?? '#111827';
  const borderDefault = BASE_WIDGET_THEME['--border-default'] ?? 'rgba(17, 24, 39, 0.10)';
  const error = BASE_WIDGET_THEME['--error'] ?? '#dc2626';
  const shadow3 = BASE_WIDGET_THEME['--shadow-3'] ?? '0 10px 24px rgba(16, 24, 40, 0.12)';
  const radiusCard = BASE_WIDGET_THEME['--radius-card'] ?? '16px';
  const textMuted = BASE_WIDGET_THEME['--text-muted'] ?? '#6b7280';
  style.textContent = `
#${ROOT_ID} {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 2147483646;
  pointer-events: none;
}
#${ROOT_ID}.${ROOT_VISIBLE_CLASS} {
  pointer-events: auto;
}
#${ROOT_ID} .gengage-global-toast {
  min-width: 260px;
  max-width: min(92vw, 420px);
  border-radius: var(--radius-card, ${radiusCard});
  border: 1px solid var(--ds-toast-error-border, color-mix(in srgb, var(--error, ${error}) 18%, var(--border-default, ${borderDefault})));
  border-left: 4px solid var(--ds-toast-error-accent, var(--error, ${error}));
  background: var(--ds-toast-error-bg, color-mix(in srgb, var(--error, ${error}) 5%, var(--surface-card, ${surfaceCard})));
  color: var(--ds-toast-error-fg, color-mix(in srgb, var(--error, ${error}) 22%, var(--text-primary, ${textPrimary})));
  box-shadow: var(--ds-toast-error-shadow, var(--shadow-3, ${shadow3}));
  padding: 10px 12px;
  font-family: var(--gengage-font-family, ${JSON.stringify(BASE_WIDGET_THEME.fontFamily ?? '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif')});
  font-size: 13px;
  line-height: 1.4;
  animation: gengage-global-toast-in 180ms ease-out forwards;
}
#${ROOT_ID} .gengage-global-toast-title {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted, ${textMuted});
}
#${ROOT_ID} .gengage-global-toast-message {
  margin: 0;
  font-weight: 500;
}
@keyframes gengage-global-toast-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
`;
  document.head.appendChild(style);
}

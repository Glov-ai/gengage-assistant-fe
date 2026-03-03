import type { ChatWidgetConfig } from '../chat/types.js';
import type { QNAWidgetConfig } from '../qna/types.js';
import type { SimRelWidgetConfig } from '../simrel/types.js';
import type { AnalyticsClientConfig } from './analytics.js';
import type { WidgetTheme } from './types.js';

export const DEFAULT_CUSTOMIZATION_LOCALE = 'tr';

export interface AccountIdentityConfig {
  accountId: string;
  middlewareUrl: string;
  locale?: string;
}

export interface AccountIdentity {
  ACCOUNT_ID: string;
  MIDDLEWARE_URL: string;
  LOCALE: string;
}

interface BaseAccountWidgetConfigInput {
  accountId: string;
  middlewareUrl: string;
  sessionId: string;
  theme?: WidgetTheme;
}

export interface FloatingChatConfigInput extends BaseAccountWidgetConfigInput {
  locale?: string;
}

export interface PdpQnaConfigInput extends BaseAccountWidgetConfigInput {
  sku: string;
  mountTarget: QNAWidgetConfig['mountTarget'];
}

export interface PdpSimRelConfigInput extends BaseAccountWidgetConfigInput {
  sku: string;
  mountTarget: SimRelWidgetConfig['mountTarget'];
}

type FloatingChatConfigOverrides = Omit<
  Partial<ChatWidgetConfig>,
  'accountId' | 'middlewareUrl' | 'session' | 'variant' | 'theme' | 'locale'
>;
type PdpQnaConfigOverrides = Omit<
  Partial<QNAWidgetConfig>,
  'accountId' | 'middlewareUrl' | 'session' | 'pageContext' | 'mountTarget' | 'theme'
>;
type SimRelAccountConfig = Omit<SimRelWidgetConfig, 'onAddToCart' | 'onProductNavigate'>;
type PdpSimRelConfigOverrides = Omit<
  Partial<SimRelAccountConfig>,
  'accountId' | 'middlewareUrl' | 'session' | 'sku' | 'mountTarget' | 'theme'
>;
type DefaultAnalyticsConfigOverrides = Omit<AnalyticsClientConfig, 'middlewareUrl'>;

/**
 * Shared account identity factory used by all customization folders.
 * Keeps middleware URL + locale defaults centralized in the SDK layer.
 */
export function createAccountIdentity(config: AccountIdentityConfig): AccountIdentity {
  return {
    ACCOUNT_ID: config.accountId,
    MIDDLEWARE_URL: config.middlewareUrl,
    LOCALE: config.locale ?? DEFAULT_CUSTOMIZATION_LOCALE,
  };
}

/**
 * Shared floating-chat baseline used by account customizations.
 * Account files only pass differences via `overrides`.
 */
export function createFloatingChatConfig(
  input: FloatingChatConfigInput,
  overrides: FloatingChatConfigOverrides = {},
): ChatWidgetConfig {
  const config: ChatWidgetConfig = {
    accountId: input.accountId,
    middlewareUrl: input.middlewareUrl,
    session: { sessionId: input.sessionId },
    variant: 'floating',
    locale: input.locale ?? DEFAULT_CUSTOMIZATION_LOCALE,
    ...overrides,
  };
  if (input.theme !== undefined) {
    config.theme = input.theme;
  }
  return config;
}

/**
 * Shared PDP QNA baseline used by account customizations.
 */
export function createPdpQnaConfig(input: PdpQnaConfigInput, overrides: PdpQnaConfigOverrides = {}): QNAWidgetConfig {
  const config: QNAWidgetConfig = {
    accountId: input.accountId,
    middlewareUrl: input.middlewareUrl,
    session: { sessionId: input.sessionId },
    pageContext: { pageType: 'pdp', sku: input.sku },
    mountTarget: input.mountTarget,
    ...overrides,
  };
  if (input.theme !== undefined) {
    config.theme = input.theme;
  }
  return config;
}

/**
 * Shared PDP SimRel baseline used by account customizations.
 * Host-level commerce callbacks stay in account init wrappers.
 */
export function createPdpSimRelConfig(
  input: PdpSimRelConfigInput,
  overrides: PdpSimRelConfigOverrides = {},
): SimRelAccountConfig {
  const config: SimRelAccountConfig = {
    accountId: input.accountId,
    middlewareUrl: input.middlewareUrl,
    session: { sessionId: input.sessionId },
    sku: input.sku,
    mountTarget: input.mountTarget,
    ...overrides,
  };
  if (input.theme !== undefined) {
    config.theme = input.theme;
  }
  return config;
}

/**
 * Shared analytics defaults for account customization wrappers.
 */
export function createDefaultAnalyticsConfig(
  middlewareUrl: string,
  overrides: DefaultAnalyticsConfigOverrides = {},
): AnalyticsClientConfig {
  return {
    enabled: true,
    middlewareUrl,
    endpoint: '/analytics',
    fireAndForget: true,
    useBeacon: true,
    ...overrides,
  };
}

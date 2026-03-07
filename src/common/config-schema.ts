import { z } from 'zod';
import { debugLog } from './debug.js';

const WidgetToggleSchema = z.object({
  enabled: z.boolean().default(true),
});

const MountSelectorsSchema = z.object({
  chat: z.string().optional(),
  qna: z.string().optional(),
  simrel: z.string().optional(),
});

const TransportSchema = z.object({});

export const AnalyticsAuthModeSchema = z.enum(['none', 'x-api-key-header', 'bearer-header', 'body-api-key']);

const AnalyticsAuthSchema = z.object({
  mode: AnalyticsAuthModeSchema.default('none'),
  key: z.string().optional(),
  headerName: z.string().optional(),
  bodyField: z.string().default('api_key'),
});

const AnalyticsSchema = z.object({
  enabled: z.boolean().default(true),
  endpoint: z.string().default('/analytics'),
  auth: AnalyticsAuthSchema.default({ mode: 'none', bodyField: 'api_key' }),
  fireAndForget: z.boolean().default(true),
  useBeacon: z.boolean().default(true),
  keepaliveFetch: z.boolean().default(true),
  timeoutMs: z.number().int().positive().default(4000),
  maxRetries: z.number().int().min(0).max(5).default(1),
});

export const DEFAULT_IDEMPOTENCY_KEY = '__gengageWidgetsInit';

const GTMSchema = z.object({
  idempotencyKey: z.string().default(DEFAULT_IDEMPOTENCY_KEY),
  requireDomReady: z.boolean().default(true),
});

export const UnknownActionPolicySchema = z.enum(['log-and-ignore', 'throw', 'delegate']);

const ActionHandlingSchema = z.object({
  unknownActionPolicy: UnknownActionPolicySchema.default('log-and-ignore'),
  allowScriptCall: z.boolean().default(false),
});

export const AccountRuntimeConfigSchema = z.object({
  version: z.literal('1', { error: 'version must be "1"' }),
  accountId: z
    .string({ error: 'accountId must be a non-empty string' })
    .min(1, { error: 'accountId must be a non-empty string' }),
  middlewareUrl: z
    .string({ error: 'middlewareUrl must be a valid URL (e.g. "https://your-backend.example.com")' })
    .url({ error: 'middlewareUrl must be a valid URL (e.g. "https://your-backend.example.com")' }),
  locale: z.string().optional(),
  widgets: z.object({
    chat: WidgetToggleSchema.default({ enabled: true }),
    qna: WidgetToggleSchema.default({ enabled: true }),
    simrel: WidgetToggleSchema.default({ enabled: true }),
  }),
  mounts: MountSelectorsSchema.default({}),
  transport: TransportSchema.default({}),
  analytics: AnalyticsSchema.default({
    enabled: true,
    endpoint: '/analytics',
    auth: { mode: 'none', bodyField: 'api_key' },
    fireAndForget: true,
    useBeacon: true,
    keepaliveFetch: true,
    timeoutMs: 4000,
    maxRetries: 1,
  }),
  gtm: GTMSchema.default({
    idempotencyKey: '__gengageWidgetsInit',
    requireDomReady: true,
  }),
  actionHandling: ActionHandlingSchema.default({
    unknownActionPolicy: 'log-and-ignore',
    allowScriptCall: false,
  }),
});

export type AccountRuntimeConfig = z.infer<typeof AccountRuntimeConfigSchema>;
export type AnalyticsAuthMode = z.infer<typeof AnalyticsAuthModeSchema>;
export type UnknownActionPolicy = z.infer<typeof UnknownActionPolicySchema>;

export function parseAccountRuntimeConfig(input: unknown): AccountRuntimeConfig {
  debugLog('config', 'parsing account runtime config', input);
  const result = AccountRuntimeConfigSchema.parse(input);
  debugLog('config', 'config resolved', { accountId: result.accountId, middlewareUrl: result.middlewareUrl });
  return result;
}

export function safeParseAccountRuntimeConfig(input: unknown): ReturnType<typeof AccountRuntimeConfigSchema.safeParse> {
  return AccountRuntimeConfigSchema.safeParse(input);
}

export function createDefaultAccountRuntimeConfig(params: {
  accountId: string;
  middlewareUrl: string;
  locale?: string;
}): AccountRuntimeConfig {
  return parseAccountRuntimeConfig({
    version: '1',
    accountId: params.accountId,
    middlewareUrl: params.middlewareUrl,
    locale: params.locale,
    widgets: {
      chat: { enabled: true },
      qna: { enabled: true },
      simrel: { enabled: true },
    },
  });
}

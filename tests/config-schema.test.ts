import { describe, it, expect } from 'vitest';
import {
  parseAccountRuntimeConfig,
  safeParseAccountRuntimeConfig,
  createDefaultAccountRuntimeConfig,
} from '../src/common/config-schema.js';

const exampleConfig = {
  version: '1',
  accountId: 'examplecom',
  middlewareUrl: 'https://api.example.com',
  locale: 'tr',
  widgets: { chat: { enabled: true }, qna: { enabled: true }, simrel: { enabled: true } },
  mounts: { chat: 'body', qna: '#gengage-qna', simrel: '#gengage-simrel' },
  transport: {},
  analytics: {
    enabled: true,
    endpoint: '/analytics',
    auth: { mode: 'none' as const },
    fireAndForget: true,
    useBeacon: true,
    keepaliveFetch: true,
    timeoutMs: 4000,
    maxRetries: 1,
  },
  gtm: { idempotencyKey: '__gengageWidgetsInit', requireDomReady: true },
  actionHandling: { unknownActionPolicy: 'log-and-ignore' as const, allowScriptCall: true },
};

describe('AccountRuntimeConfigSchema', () => {
  it('parses the example config without error', () => {
    const config = parseAccountRuntimeConfig(exampleConfig);
    expect(config.version).toBe('1');
    expect(config.accountId).toBe('examplecom');
    expect(config.middlewareUrl).toBe('https://api.example.com');
    expect(config.widgets.chat.enabled).toBe(true);
    expect(config.widgets.qna.enabled).toBe(true);
    expect(config.widgets.simrel.enabled).toBe(true);
  });

  it('creates default config with required fields', () => {
    const config = createDefaultAccountRuntimeConfig({
      accountId: 'testaccount',
      middlewareUrl: 'https://api.test.com',
      locale: 'tr',
    });
    expect(config.version).toBe('1');
    expect(config.accountId).toBe('testaccount');
    expect(config.locale).toBe('tr');
    expect(config.widgets.chat.enabled).toBe(true);
    expect(config.analytics.enabled).toBe(true);
    expect(config.analytics.endpoint).toBe('/analytics');
    expect(config.gtm.idempotencyKey).toBe('__gengageWidgetsInit');
  });

  it('rejects missing accountId', () => {
    const result = safeParseAccountRuntimeConfig({
      version: '1',
      middlewareUrl: 'https://api.test.com',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid version', () => {
    const result = safeParseAccountRuntimeConfig({
      version: '2',
      accountId: 'test',
      middlewareUrl: 'https://api.test.com',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid middlewareUrl', () => {
    const result = safeParseAccountRuntimeConfig({
      version: '1',
      accountId: 'test',
      middlewareUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('applies defaults for optional fields', () => {
    const config = parseAccountRuntimeConfig({
      version: '1',
      accountId: 'test',
      middlewareUrl: 'https://api.test.com',
      widgets: { chat: { enabled: true }, qna: { enabled: true }, simrel: { enabled: true } },
    });
    expect(config.widgets.chat.enabled).toBe(true);
    expect(config.analytics.fireAndForget).toBe(true);
    expect(config.actionHandling.unknownActionPolicy).toBe('log-and-ignore');
    expect(config.actionHandling.allowScriptCall).toBe(false);
  });

  it('allows disabling individual widgets', () => {
    const config = parseAccountRuntimeConfig({
      version: '1',
      accountId: 'test',
      middlewareUrl: 'https://api.test.com',
      widgets: {
        chat: { enabled: true },
        qna: { enabled: false },
        simrel: { enabled: false },
      },
    });
    expect(config.widgets.chat.enabled).toBe(true);
    expect(config.widgets.qna.enabled).toBe(false);
    expect(config.widgets.simrel.enabled).toBe(false);
  });

  it('every enabled widget receives required fields', () => {
    const config = createDefaultAccountRuntimeConfig({
      accountId: 'test',
      middlewareUrl: 'https://api.test.com',
    });
    expect(config.accountId).toBeTruthy();
    expect(config.middlewareUrl).toBeTruthy();
  });
});

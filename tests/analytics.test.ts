import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnalyticsClient, createAnalyticsClient } from '../src/common/analytics.js';
import type { AnalyticsEnvelope, AnalyticsInput } from '../src/common/analytics.js';

describe('AnalyticsClient', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeInput(overrides: Partial<AnalyticsInput> = {}): AnalyticsInput {
    return {
      event_name: 'stream.start',
      account_id: 'testaccount',
      session_id: 'sess-123',
      correlation_id: 'corr-456',
      payload: { endpoint: '/chat/process_action' },
      ...overrides,
    };
  }

  it('tracks and flushes an event', async () => {
    const client = createAnalyticsClient({
      enabled: true,
      middlewareUrl: 'https://api.test.com',
      endpoint: '/analytics',
      batchSize: 1,
      useBeacon: false,
    });

    client.track(makeInput());
    // Allow microtask for flush
    await new Promise((r) => setTimeout(r, 50));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(body.events).toHaveLength(1);
    expect(body.events[0].event_name).toBe('stream.start');
    expect(body.events[0].event_version).toBe('1');
    expect(body.events[0].timestamp_ms).toBeTypeOf('number');
    expect(body.events[0].session_id).toBe('sess-123');
    expect(body.events[0].correlation_id).toBe('corr-456');

    client.destroy();
  });

  it('does not track when disabled', async () => {
    const client = createAnalyticsClient({ enabled: false, middlewareUrl: 'https://api.test.com' });
    client.track(makeInput());
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchSpy).not.toHaveBeenCalled();
    client.destroy();
  });

  it('envelope has required fields', () => {
    const client = createAnalyticsClient({
      enabled: true,
      middlewareUrl: 'https://api.test.com',
      batchSize: 1,
      useBeacon: false,
    });
    const input = makeInput({
      view_id: 'view-789',
      user_id: 'user-abc',
      widget: 'chat',
      page_type: 'pdp',
      sku: 'SKU001',
    });

    client.track(input);

    // Manually flush
    void client.flush();

    client.destroy();
  });

  it('batches multiple events', async () => {
    const client = createAnalyticsClient({
      enabled: true,
      middlewareUrl: 'https://api.test.com',
      batchSize: 3,
      useBeacon: false,
      flushIntervalMs: 10,
    });

    client.track(makeInput({ event_name: 'stream.start' }));
    client.track(makeInput({ event_name: 'stream.chunk' }));
    client.track(makeInput({ event_name: 'stream.done' }));

    // Batch size hit → immediate flush
    await new Promise((r) => setTimeout(r, 50));

    expect(fetchSpy).toHaveBeenCalled();
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(body.events.length).toBeGreaterThanOrEqual(2);

    client.destroy();
  });

  it('adds x-api-key header when configured', async () => {
    const client = createAnalyticsClient({
      enabled: true,
      middlewareUrl: 'https://api.test.com',
      auth: { mode: 'x-api-key-header', key: 'my-key', headerName: 'X-API-Key' },
      batchSize: 1,
      useBeacon: false,
    });

    client.track(makeInput());
    await new Promise((r) => setTimeout(r, 50));

    expect(fetchSpy).toHaveBeenCalled();
    const headers = fetchSpy.mock.calls[0][1].headers;
    expect(headers['X-API-Key']).toBe('my-key');

    client.destroy();
  });

  it('adds bearer auth header when configured', async () => {
    const client = createAnalyticsClient({
      enabled: true,
      middlewareUrl: 'https://api.test.com',
      auth: { mode: 'bearer-header', key: 'token-123' },
      batchSize: 1,
      useBeacon: false,
    });

    client.track(makeInput());
    await new Promise((r) => setTimeout(r, 50));

    expect(fetchSpy).toHaveBeenCalled();
    const headers = fetchSpy.mock.calls[0][1].headers;
    expect(headers['Authorization']).toBe('Bearer token-123');

    client.destroy();
  });

  it('resolves relative analytics endpoint', async () => {
    const client = createAnalyticsClient({
      enabled: true,
      middlewareUrl: 'https://api.test.com',
      endpoint: '/analytics',
      batchSize: 1,
      useBeacon: false,
    });

    client.track(makeInput());
    await new Promise((r) => setTimeout(r, 50));

    expect(fetchSpy.mock.calls[0][0]).toBe('https://api.test.com/analytics');

    client.destroy();
  });

  it('uses absolute analytics endpoint as-is', async () => {
    const client = createAnalyticsClient({
      enabled: true,
      middlewareUrl: 'https://unused.test.com',
      endpoint: 'https://custom.analytics.com/ingest',
      batchSize: 1,
      useBeacon: false,
    });

    client.track(makeInput());
    await new Promise((r) => setTimeout(r, 50));

    expect(fetchSpy.mock.calls[0][0]).toBe('https://custom.analytics.com/ingest');

    client.destroy();
  });
});

describe('analytics envelope shape', () => {
  it('session_id and correlation_id are always populated', () => {
    const input: AnalyticsInput = {
      event_name: 'test.event',
      account_id: 'acc1',
      session_id: 'sess',
      correlation_id: 'corr',
      payload: {},
    };

    expect(input.session_id).toBeTruthy();
    expect(input.correlation_id).toBeTruthy();
  });

  it('basket attribution events include required fields', () => {
    const basketEvent: AnalyticsInput = {
      event_name: 'basket.add',
      account_id: 'acc1',
      session_id: 'sess',
      correlation_id: 'corr',
      widget: 'simrel',
      payload: {
        attribution_source: 'simrel',
        attribution_action_id: 'add-123',
        cart_value: 149.99,
        currency: 'TRY',
        line_items: 1,
      },
    };

    expect(basketEvent.payload.attribution_source).toBe('simrel');
    expect(basketEvent.payload.cart_value).toBe(149.99);
    expect(basketEvent.payload.currency).toBe('TRY');
  });

  it('stream lifecycle events include required fields', () => {
    const streamEvent: AnalyticsInput = {
      event_name: 'stream.start',
      account_id: 'acc1',
      session_id: 'sess',
      correlation_id: 'corr',
      payload: {
        endpoint: '/chat/process_action',
        request_id: 'req-uuid',
        latency_ms: 0,
      },
    };

    expect(streamEvent.payload.endpoint).toBeTruthy();
    expect(streamEvent.payload.request_id).toBeTruthy();
  });

  it('llm.usage event includes required fields', () => {
    const usageEvent: AnalyticsInput = {
      event_name: 'llm.usage',
      account_id: 'acc1',
      session_id: 'sess',
      correlation_id: 'corr',
      payload: {
        model: 'gpt-4o',
        prompt_tokens: 500,
        completion_tokens: 200,
        total_tokens: 700,
      },
    };

    expect(usageEvent.payload.model).toBeTruthy();
    expect(usageEvent.payload.total_tokens).toBe(700);
  });
});

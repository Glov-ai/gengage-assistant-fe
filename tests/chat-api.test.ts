/**
 * Tests for chat API request body transformation.
 *
 * Validates that /chat/process_action gets flattened top-level fields
 * with action type mapping and payload wrapping.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test the public sendChatMessage function by intercepting fetch
import { sendChatMessage, enrichActionPayload } from '../src/chat/api.js';
import type { ProcessActionRequest, StreamCallbacks } from '../src/chat/api.js';

function makeRequest(): ProcessActionRequest {
  return {
    account_id: 'test',
    session_id: 'sess-1',
    correlation_id: 'corr-1',
    action: {
      title: 'Hello',
      type: 'user_message',
      payload: 'Hello',
    },
    sku: 'SKU-1',
    locale: 'tr',
  };
}

function makeCallbacks(): StreamCallbacks {
  return {
    onTextChunk: vi.fn(),
    onUISpec: vi.fn(),
    onAction: vi.fn(),
    onMetadata: vi.fn(),
    onError: vi.fn(),
    onDone: vi.fn(),
  };
}

describe('sendChatMessage — request body shaping', () => {
  let originalFetch: typeof globalThis.fetch;
  const capturedBodies: Array<{ url: string; body: unknown }> = [];

  beforeEach(() => {
    capturedBodies.length = 0;
    originalFetch = globalThis.fetch;

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      let body: unknown = null;
      if (init?.body instanceof FormData) {
        body = init.body;
      } else if (init?.body) {
        body = JSON.parse(init.body as string);
      }
      capturedBodies.push({ url, body });

      return new Response('Service Unavailable', { status: 503 });
    }) as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends flattened JSON format to /chat/process_action', async () => {
    const request = makeRequest();
    const callbacks = makeCallbacks();

    const controller = sendChatMessage(request, callbacks, { middlewareUrl: 'https://api.test.com' });

    await new Promise((r) => setTimeout(r, 50));
    controller.abort();

    expect(capturedBodies).toHaveLength(1);
    const body = capturedBodies[0]!.body as Record<string, unknown>;

    // Flattened shape: type mapped, payload (dict) at top level; title omitted (backend ignores it)
    expect(body.type).toBe('inputText');
    expect(body).not.toHaveProperty('title');
    // String payload is wrapped in a dict for backend compatibility
    expect(body.payload).toEqual({ text: 'Hello' });
    // No nested action object
    expect(body).not.toHaveProperty('action');
    // Envelope fields preserved
    expect(body.account_id).toBe('test');
    expect(body.session_id).toBe('sess-1');
    expect(body.sku).toBe('SKU-1');
  });

  it('uses /chat/process_action endpoint', async () => {
    const request = makeRequest();
    const callbacks = makeCallbacks();

    const controller = sendChatMessage(request, callbacks, { middlewareUrl: 'https://api.test.com' });

    await new Promise((r) => setTimeout(r, 100));
    controller.abort();

    expect(capturedBodies).toHaveLength(1);
    expect(capturedBodies[0]!.url).toContain('/chat/process_action');
    expect(capturedBodies[0]!.url).not.toContain('/v1/chat/');
  });

  it('omits payload from body when action.payload is undefined', async () => {
    const request = makeRequest();
    delete (request.action as Record<string, unknown>).payload;
    const callbacks = makeCallbacks();

    const controller = sendChatMessage(request, callbacks, { middlewareUrl: 'https://api.test.com' });

    await new Promise((r) => setTimeout(r, 50));
    controller.abort();

    expect(capturedBodies).toHaveLength(1);
    const body = capturedBodies[0]!.body as Record<string, unknown>;
    expect(body).not.toHaveProperty('payload');
    expect(body.type).toBe('inputText');
  });

  it('passes through unmapped action types unchanged', async () => {
    const request = makeRequest();
    request.action.type = 'custom_action';
    const callbacks = makeCallbacks();

    const controller = sendChatMessage(request, callbacks, { middlewareUrl: 'https://api.test.com' });

    await new Promise((r) => setTimeout(r, 50));
    controller.abort();

    expect(capturedBodies).toHaveLength(1);
    const body = capturedBodies[0]!.body as Record<string, unknown>;
    expect(body.type).toBe('custom_action');
  });

  it('sends FormData when attachment is provided', async () => {
    const request = makeRequest();
    const callbacks = makeCallbacks();
    const file = new File(['image-data'], 'photo.png', { type: 'image/png' });

    const controller = sendChatMessage(request, callbacks, {
      middlewareUrl: 'https://api.test.com',
      attachment: file,
    });

    await new Promise((r) => setTimeout(r, 50));
    controller.abort();

    expect(capturedBodies).toHaveLength(1);
    const body = capturedBodies[0]!.body;
    expect(body).toBeInstanceOf(FormData);

    const formData = body as FormData;
    const requestField = formData.get('request');
    expect(requestField).toBeTypeOf('string');
    const parsed = JSON.parse(requestField as string);
    expect(parsed.type).toBe('inputText');
    expect(parsed).not.toHaveProperty('title');
    expect(parsed.account_id).toBe('test');

    const attachmentField = formData.get('attachment');
    expect(attachmentField).toBeInstanceOf(File);
    expect((attachmentField as File).name).toBe('photo.png');

    // Content-Type header must NOT be set (browser sets multipart boundary)
    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      RequestInfo | URL,
      RequestInit | undefined,
    ];
    const headers = fetchCall[1]?.headers as Record<string, string> | undefined;
    expect(headers?.['Content-Type']).toBeUndefined();
  });

  it('sends JSON (not FormData) without attachment', async () => {
    const request = makeRequest();
    const callbacks = makeCallbacks();

    const controller = sendChatMessage(request, callbacks, { middlewareUrl: 'https://api.test.com' });

    await new Promise((r) => setTimeout(r, 50));
    controller.abort();

    expect(capturedBodies).toHaveLength(1);
    const body = capturedBodies[0]!.body;
    expect(body).not.toBeInstanceOf(FormData);
    expect((body as Record<string, unknown>).account_id).toBe('test');

    // Content-Type header must be set to application/json
    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      RequestInfo | URL,
      RequestInit | undefined,
    ];
    const headers = fetchCall[1]?.headers as Record<string, string> | undefined;
    expect(headers?.['Content-Type']).toBe('application/json');
  });

  it('accepts flat type/payload (without action wrapper)', async () => {
    const request: ProcessActionRequest = {
      account_id: 'test',
      session_id: 'sess-1',
      correlation_id: 'corr-1',
      type: 'user_message',
      payload: 'Flat hello',
      sku: 'SKU-1',
      locale: 'tr',
    };
    const callbacks = makeCallbacks();

    const controller = sendChatMessage(request, callbacks, { middlewareUrl: 'https://api.test.com' });

    await new Promise((r) => setTimeout(r, 50));
    controller.abort();

    expect(capturedBodies).toHaveLength(1);
    const body = capturedBodies[0]!.body as Record<string, unknown>;
    expect(body.type).toBe('inputText');
    expect(body.payload).toEqual({ text: 'Flat hello' });
    expect(body).not.toHaveProperty('action');
  });

  it('includes meta in JSON request body when present', async () => {
    const request = makeRequest();
    request.meta = {
      outputLanguage: 'TURKISH',
      parentUrl: 'https://example.com',
      windowWidth: '1024',
      windowHeight: '768',
      selfUrl: '',
      id: 'sess-1',
      userId: 'user-1',
      appId: 'test',
      threads: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      kvkkApproved: false,
      voiceEnabled: false,
      threadId: '019xxxxx-0001-7000-8000-000000000001',
      isControlGroup: false,
      isMobile: false,
    };
    const callbacks = makeCallbacks();

    const controller = sendChatMessage(request, callbacks, { middlewareUrl: 'https://api.test.com' });

    await new Promise((r) => setTimeout(r, 50));
    controller.abort();

    expect(capturedBodies).toHaveLength(1);
    const body = capturedBodies[0]!.body as Record<string, unknown>;
    expect(body.meta).toBeDefined();
    const meta = body.meta as Record<string, unknown>;
    expect(meta.outputLanguage).toBe('TURKISH');
    expect(meta.threadId).toBe('019xxxxx-0001-7000-8000-000000000001');
    expect(meta.appId).toBe('test');
  });
});

describe('enrichActionPayload', () => {
  it('adds is_launcher and is_suggested_text to inputText', () => {
    const action = { title: 'Hello', type: 'inputText', payload: { text: 'Hello' } };
    const result = enrichActionPayload(action, {});
    const payload = result.payload as Record<string, unknown>;
    expect(payload['is_launcher']).toBe(0);
    expect(payload['is_suggested_text']).toBe(0);
    expect(payload['text']).toBe('Hello');
  });

  it('does not overwrite existing is_suggested_text', () => {
    const action = { title: 'Hello', type: 'inputText', payload: { text: 'Hello', is_suggested_text: 1 } };
    const result = enrichActionPayload(action, {});
    const payload = result.payload as Record<string, unknown>;
    expect(payload['is_suggested_text']).toBe(1);
  });

  it('adds page_details from pageContext.extra', () => {
    const action = { title: 'Hello', type: 'inputText', payload: { text: 'Hello' } };
    const result = enrichActionPayload(action, { pageContext: { pageType: 'pdp', extra: { category: 'bath' } } });
    const payload = result.payload as Record<string, unknown>;
    expect(payload['page_details']).toEqual({ category: 'bath' });
  });

  it('adds text and input to findSimilar', () => {
    const action = { title: 'Find similar', type: 'findSimilar', payload: { sku: '123' } };
    const result = enrichActionPayload(action, {});
    const payload = result.payload as Record<string, unknown>;
    expect(payload['text']).toBe('Find similar');
    expect(payload['input']).toBe('Find similar');
    expect(payload['is_launcher']).toBe(0);
    expect(payload['sku']).toBe('123');
  });

  it('adds error_message to addToCart', () => {
    const action = { title: 'Add', type: 'addToCart', payload: { sku: 'S1', cartCode: 'C1' } };
    const result = enrichActionPayload(action, {});
    const payload = result.payload as Record<string, unknown>;
    expect(payload['error_message']).toBe('');
    expect(payload['sku']).toBe('S1');
  });

  it('adds sku to reviewSummary from pageContext', () => {
    const action = { title: 'Reviews', type: 'reviewSummary', payload: {} };
    const result = enrichActionPayload(action, { pageContext: { pageType: 'pdp', sku: 'SKU1' } });
    const payload = result.payload as Record<string, unknown>;
    expect(payload['sku']).toBe('SKU1');
  });

  it('does not overwrite existing sku in reviewSummary', () => {
    const action = { title: 'Reviews', type: 'reviewSummary', payload: { sku: 'EXISTING' } };
    const result = enrichActionPayload(action, { pageContext: { pageType: 'pdp', sku: 'SKU1' } });
    const payload = result.payload as Record<string, unknown>;
    expect(payload['sku']).toBe('EXISTING');
  });

  it('returns action unchanged for unknown types', () => {
    const action = { title: 'X', type: 'customAction', payload: { foo: 1 } };
    const result = enrichActionPayload(action, {});
    expect(result).toBe(action);
  });

  it('passes through getComparisonTable unchanged', () => {
    const action = { title: 'Compare', type: 'getComparisonTable', payload: { sku_list: ['A', 'B'] } };
    const result = enrichActionPayload(action, {});
    expect(result).toBe(action);
  });
});

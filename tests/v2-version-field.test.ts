/**
 * ma-v2-version regression test.
 *
 * Verifies that NDJSON lines carrying `"version": "v2"` fields pass through
 * the streaming parser and V1 adapter without errors or data loss.
 */

import { describe, it, expect } from 'vitest';
import { consumeStream } from '../src/common/streaming.js';
import { adaptV1Event } from '../src/common/v1-protocol-adapter.js';
import type { StreamEvent } from '../src/common/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStreamResponse(lines: string[]): Response {
  const body = lines.join('\n') + '\n';
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(body));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
}

// ---------------------------------------------------------------------------
// Streaming parser tests — version:"v2" in raw NDJSON
// ---------------------------------------------------------------------------

describe('streaming parser: version field passthrough', () => {
  it('parses NDJSON lines that include version:"v2" without error', async () => {
    const events: StreamEvent[] = [];
    const response = makeStreamResponse([
      '{"type":"text_chunk","content":"Hello","version":"v2","messageId":"msg-1","threadId":"t-1","from":"assistant"}',
      '{"type":"done","version":"v2"}',
    ]);

    await consumeStream(response, {
      onEvent: (e) => events.push(e),
    });

    expect(events).toHaveLength(2);
    expect(events[0]!.type).toBe('text_chunk');
    expect(events[1]!.type).toBe('done');
  });

  it('preserves the version field in the parsed event object', async () => {
    const events: StreamEvent[] = [];
    const response = makeStreamResponse([
      '{"type":"text_chunk","content":"V2 wire","version":"v2","messageId":"msg-2"}',
    ]);

    await consumeStream(response, {
      onEvent: (e) => events.push(e),
    });

    expect(events).toHaveLength(1);
    const raw = events[0] as Record<string, unknown>;
    expect(raw['version']).toBe('v2');
    expect(raw['messageId']).toBe('msg-2');
  });

  it('parses lines WITHOUT a version field (backwards compat)', async () => {
    const events: StreamEvent[] = [];
    const response = makeStreamResponse(['{"type":"text_chunk","content":"Legacy event"}', '{"type":"done"}']);

    await consumeStream(response, {
      onEvent: (e) => events.push(e),
    });

    expect(events).toHaveLength(2);
    expect(events[0]!.type).toBe('text_chunk');
    const raw = events[0] as Record<string, unknown>;
    expect(raw['version']).toBeUndefined();
  });

  it('only requires `type` field; extra V2 wire fields are ignored gracefully', async () => {
    const events: StreamEvent[] = [];
    const response = makeStreamResponse([
      '{"type":"metadata","sessionId":"s1","model":"gemini","version":"v2","messageId":"m-99","threadId":"t-42","from":"system","extra_field":"whatever"}',
    ]);

    await consumeStream(response, {
      onEvent: (e) => events.push(e),
    });

    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('metadata');
    const raw = events[0] as Record<string, unknown>;
    expect(raw['version']).toBe('v2');
    expect(raw['extra_field']).toBe('whatever');
  });

  it('handles a full V2-format stream with mixed event types', async () => {
    const events: StreamEvent[] = [];
    const response = makeStreamResponse([
      '{"type":"metadata","sessionId":"s1","model":"gemini","version":"v2","messageId":"m-1","threadId":"t-1","from":"system"}',
      '{"type":"text_chunk","content":"Merhaba!","version":"v2","messageId":"m-2","threadId":"t-1","from":"assistant"}',
      '{"type":"text_chunk","content":" Nasil yardimci olabilirim?","final":true,"version":"v2","messageId":"m-3","threadId":"t-1","from":"assistant"}',
      '{"type":"done","version":"v2","messageId":"m-4","threadId":"t-1","from":"system"}',
    ]);

    await consumeStream(response, {
      onEvent: (e) => events.push(e),
    });

    expect(events).toHaveLength(4);
    expect(events[0]!.type).toBe('metadata');
    expect(events[1]!.type).toBe('text_chunk');
    expect(events[2]!.type).toBe('text_chunk');
    expect(events[3]!.type).toBe('done');

    // All events should carry the version field
    for (const event of events) {
      expect((event as Record<string, unknown>)['version']).toBe('v2');
    }
  });
});

// ---------------------------------------------------------------------------
// V1 adapter tests — version:"v2" on backend event types
// ---------------------------------------------------------------------------

describe('V1 adapter: version field on V1-style events', () => {
  it('adapts outputText with version:"v2" to text_chunk', () => {
    const raw = {
      type: 'outputText',
      payload: { text: '<p>Hello from V2</p>' },
      version: 'v2',
      messageId: 'msg-1',
      threadId: 't-1',
      from: 'assistant',
    };
    const result = adaptV1Event(raw);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('text_chunk');
    expect((result as { content: string }).content).toBe('<p>Hello from V2</p>');
  });

  it('adapts chatStreamEnd with version:"v2" to done', () => {
    const raw = {
      type: 'chatStreamEnd',
      payload: {},
      version: 'v2',
      messageId: 'msg-end',
    };
    const result = adaptV1Event(raw);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('done');
  });

  it('adapts loading with version:"v2" to metadata', () => {
    const raw = {
      type: 'loading',
      payload: { text: 'Analyzing...' },
      version: 'v2',
      messageId: 'msg-load',
    };
    const result = adaptV1Event(raw);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('metadata');
    const meta = (result as { meta?: Record<string, unknown> }).meta;
    expect(meta?.['loading']).toBe(true);
    expect(meta?.['loadingText']).toBe('Analyzing...');
  });

  it('adapts suggestedActions with version:"v2"', () => {
    const raw = {
      type: 'suggestedActions',
      payload: {
        actions: [
          {
            title: 'Show details',
            requestDetails: { type: 'launchSingleProduct', payload: { sku: 'X1' } },
          },
        ],
      },
      version: 'v2',
    };
    const result = adaptV1Event(raw);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('ui_spec');
  });

  it('adapts comparisonTable with version:"v2"', () => {
    const raw = {
      type: 'comparisonTable',
      payload: {
        multiple_product_details: [
          { sku: 'A1', name: 'Product A', price: 100, url: 'https://example.com/a' },
          { sku: 'B1', name: 'Product B', price: 200, url: 'https://example.com/b' },
        ],
      },
      version: 'v2',
    };
    const result = adaptV1Event(raw);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('ui_spec');
    const spec = result as { spec: { elements: Record<string, { type: string }> } };
    expect(spec.spec.elements['root']!.type).toBe('ComparisonTable');
  });

  it('version:"v2" does not break events that have no payload', () => {
    const raw = {
      type: 'chatStreamEnd',
      version: 'v2',
    };
    const result = adaptV1Event(raw);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('done');
  });

  it('version field does not interfere with already-normalized events', () => {
    // Normalized events (text_chunk, metadata, etc.) with version should pass through
    const raw = {
      type: 'text_chunk',
      content: 'Already normalized',
      final: true,
      version: 'v2',
    };
    const result = adaptV1Event(raw);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('text_chunk');
    expect((result as { content: string }).content).toBe('Already normalized');
  });
});

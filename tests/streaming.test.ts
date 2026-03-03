import { describe, it, expect, vi, beforeEach } from 'vitest';
import { consumeStream } from '../src/common/streaming.js';
import type { StreamEvent } from '../src/common/types.js';

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

describe('consumeStream', () => {
  it('parses normalized NDJSON events', async () => {
    const events: StreamEvent[] = [];
    const response = makeStreamResponse([
      '{"type":"metadata","sessionId":"s1","model":"gpt-4o"}',
      '{"type":"text_chunk","content":"Hello "}',
      '{"type":"text_chunk","content":"world!","final":true}',
      '{"type":"done"}',
    ]);

    await consumeStream(response, {
      onEvent: (e) => events.push(e),
    });

    expect(events).toHaveLength(4);
    expect(events[0]!.type).toBe('metadata');
    expect(events[1]!.type).toBe('text_chunk');
    expect((events[1] as { content: string }).content).toBe('Hello ');
    expect(events[2]!.type).toBe('text_chunk');
    expect((events[2] as { final?: boolean }).final).toBe(true);
    expect(events[3]!.type).toBe('done');
  });

  it('handles SSE data: prefix lines', async () => {
    const events: StreamEvent[] = [];
    const response = makeStreamResponse(['data: {"type":"text_chunk","content":"SSE mode"}', 'data: {"type":"done"}']);

    await consumeStream(response, {
      onEvent: (e) => events.push(e),
    });

    expect(events).toHaveLength(2);
    expect(events[0]!.type).toBe('text_chunk');
  });

  it('skips SSE comment lines and empty lines', async () => {
    const events: StreamEvent[] = [];
    const response = makeStreamResponse([
      ': this is a comment',
      '',
      '{"type":"text_chunk","content":"after comment"}',
      '{"type":"done"}',
    ]);

    await consumeStream(response, {
      onEvent: (e) => events.push(e),
    });

    expect(events).toHaveLength(2);
  });

  it('handles [DONE] sentinel', async () => {
    const events: StreamEvent[] = [];
    const response = makeStreamResponse(['{"type":"text_chunk","content":"before done"}', 'data: [DONE]']);

    await consumeStream(response, {
      onEvent: (e) => events.push(e),
    });

    expect(events).toHaveLength(1);
  });

  it('skips malformed JSON lines', async () => {
    const events: StreamEvent[] = [];
    const response = makeStreamResponse([
      '{"type":"text_chunk","content":"ok"}',
      '{invalid json!!!}',
      '{"type":"done"}',
    ]);

    await consumeStream(response, {
      onEvent: (e) => events.push(e),
    });

    expect(events).toHaveLength(2);
    expect(events[0]!.type).toBe('text_chunk');
    expect(events[1]!.type).toBe('done');
  });

  it('calls onDone when done event is received', async () => {
    const onDone = vi.fn();
    const response = makeStreamResponse(['{"type":"done"}']);

    await consumeStream(response, {
      onEvent: () => {},
      onDone,
    });

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('calls onDone exactly once when done event is in trailing buffer (no trailing newline)', async () => {
    const onDone = vi.fn();
    // Build a stream where the last line has no trailing newline,
    // so the "done" event lands in the trailing buffer path.
    const body = '{"type":"text_chunk","content":"hello"}\n{"type":"done"}';
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(body));
        controller.close();
      },
    });
    const response = new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'application/x-ndjson' },
    });

    await consumeStream(response, {
      onEvent: () => {},
      onDone,
    });

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('calls onError for non-2xx responses', async () => {
    const onError = vi.fn();
    const response = new Response('Not Found', { status: 404, statusText: 'Not Found' });

    await consumeStream(response, {
      onEvent: () => {},
      onError,
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]![0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0]![0].message).toContain('404');
  });

  it('calls onError for null body', async () => {
    const onError = vi.fn();
    // Manually construct a response with null body
    const response = new Response(null, { status: 200 });
    Object.defineProperty(response, 'body', { value: null });

    await consumeStream(response, {
      onEvent: () => {},
      onError,
    });

    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('handles stream abort gracefully', async () => {
    const events: StreamEvent[] = [];
    const controller = new AbortController();

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async pull(streamController) {
        streamController.enqueue(encoder.encode('{"type":"text_chunk","content":"start"}\n'));
        // Abort after first chunk
        controller.abort();
        // Try to enqueue more (should be ignored after abort)
        await new Promise((r) => setTimeout(r, 10));
        try {
          streamController.close();
        } catch {
          // expected
        }
      },
    });

    const response = new Response(stream, { status: 200 });

    await consumeStream(response, {
      onEvent: (e) => events.push(e),
      signal: controller.signal,
    });

    // Should have at least the first event (or none if abort was immediate)
    expect(events.length).toBeLessThanOrEqual(1);
  });

  it('parses ui_spec events with full spec', async () => {
    const events: StreamEvent[] = [];
    const spec = {
      root: 'btn-1',
      elements: {
        'btn-1': {
          type: 'ActionButtons',
          props: {},
          children: ['btn-a'],
        },
        'btn-a': {
          type: 'ActionButton',
          props: { label: 'Test', action: { title: 'Test', type: 'user_message' } },
        },
      },
    };

    const response = makeStreamResponse([JSON.stringify({ type: 'ui_spec', widget: 'chat', spec }), '{"type":"done"}']);

    await consumeStream(response, {
      onEvent: (e) => events.push(e),
    });

    expect(events).toHaveLength(2);
    const uiEvent = events[0] as { type: string; spec: { root: string } };
    expect(uiEvent.type).toBe('ui_spec');
    expect(uiEvent.spec.root).toBe('btn-1');
  });

  it('parses error events', async () => {
    const events: StreamEvent[] = [];
    const response = makeStreamResponse(['{"type":"error","code":"QUOTA_EXCEEDED","message":"Monthly limit reached"}']);

    await consumeStream(response, {
      onEvent: (e) => events.push(e),
    });

    expect(events).toHaveLength(1);
    const err = events[0] as { type: string; code: string; message: string };
    expect(err.type).toBe('error');
    expect(err.code).toBe('QUOTA_EXCEEDED');
  });
});

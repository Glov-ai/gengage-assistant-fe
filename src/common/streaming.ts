/**
 * Wire protocol streaming utilities.
 *
 * The Gengage backend streams responses as Newline-Delimited JSON (NDJSON)
 * over a single HTTP response. This module provides utilities to consume
 * that stream and parse events in real time.
 *
 * Protocol shape:
 *   {"type":"metadata","sessionId":"...","model":"..."}
 *   {"type":"text_chunk","content":"Hello "}
 *   {"type":"text_chunk","content":"there!","final":true}
 *   {"type":"ui_spec","widget":"chat","spec":{...}}
 *   {"type":"action","action":{"kind":"navigate","url":"..."}}
 *   {"type":"done"}
 */

import type { StreamEvent } from './types.js';
import { debugLog } from './debug.js';

export type StreamEventHandler = (event: StreamEvent) => void;

/** Lightweight runtime check: parsed object must have a string `type` field. */
function isMinimalStreamEvent(value: unknown): value is StreamEvent {
  return typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>)['type'] === 'string';
}

/**
 * Split a string of concatenated JSON objects into individual JSON strings.
 * Handles nested braces and strings correctly.
 *
 * Example: '{"a":1}{"b":2}' → ['{"a":1}', '{"b":2}']
 */
function splitConcatenatedJson(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        parts.push(text.slice(start, i + 1));
        start = i + 1;
      }
    }
  }
  return parts.length > 0 ? parts : [text];
}

export interface StreamOptions {
  /** Called for each parsed StreamEvent. */
  onEvent: StreamEventHandler;
  /** Called once when the stream closes normally. */
  onDone?: () => void;
  /** Called if the stream errors or the response is non-2xx. */
  onError?: (err: Error) => void;
  /** AbortController signal to cancel mid-stream. */
  signal?: AbortSignal;
  /**
   * Max milliseconds to wait between chunks before treating the stream as dead.
   * Prevents the UI from hanging indefinitely when the backend stops sending
   * data without closing the connection. Default: 60_000 (60 s).
   */
  idleTimeoutMs?: number;
}

/**
 * Process a single line from the stream buffer. Returns true if 'done' event was received.
 * Handles SSE prefix, concatenated JSON, and malformed lines gracefully.
 */
function processLine(line: string, options: StreamOptions): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(':')) return false;

  const jsonStr = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed;
  if (jsonStr === '[DONE]') {
    options.onDone?.();
    return true;
  }

  // Try direct parse first (fast path for well-formed NDJSON)
  try {
    const event = JSON.parse(jsonStr) as StreamEvent;
    if (!isMinimalStreamEvent(event)) {
      if (import.meta.env?.DEV) {
        console.warn('[gengage] Skipping event without valid type:', jsonStr.slice(0, 100));
      }
      return false;
    }
    debugLog('stream', `event: ${event.type}`, event);
    options.onEvent(event);
    if (event.type === 'done') {
      options.onDone?.();
      return true;
    }
    return false;
  } catch {
    // Direct parse failed — try splitting concatenated JSON objects
    // (backend may send multiple objects without newline separators)
    const parts = splitConcatenatedJson(jsonStr);
    if (parts.length > 1) {
      for (const part of parts) {
        try {
          const event = JSON.parse(part) as StreamEvent;
          if (!isMinimalStreamEvent(event)) continue;
          options.onEvent(event);
          if (event.type === 'done') {
            options.onDone?.();
            return true;
          }
        } catch {
          if (import.meta.env?.DEV) {
            console.warn('[gengage] Skipping malformed stream fragment:', part.slice(0, 100));
          }
        }
      }
      return false;
    }

    if (import.meta.env?.DEV) {
      console.warn('[gengage] Skipping malformed stream line:', jsonStr.slice(0, 100));
    }
    return false;
  }
}

/**
 * Consume an NDJSON streaming response and call onEvent for each line.
 *
 * Usage:
 *   const controller = new AbortController();
 *   await consumeStream(response, {
 *     onEvent: (event) => { ... },
 *     signal: controller.signal,
 *   });
 */
export async function consumeStream(response: Response, options: StreamOptions): Promise<void> {
  if (!response.ok) {
    options.onError?.(new Error(`HTTP ${response.status}: ${response.statusText}`));
    return;
  }

  if (!response.body) {
    options.onError?.(new Error('Response body is null — streaming not supported'));
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  const idleTimeout = options.idleTimeoutMs ?? 60_000;

  const IDLE_TIMEOUT_SENTINEL = Symbol('idle-timeout');
  let readerCancelled = false;

  try {
    while (true) {
      // Race reader against an idle timeout so the UI never hangs indefinitely
      // when the backend stops sending data without closing the connection.
      const readPromise = reader.read();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const result = await (idleTimeout > 0
        ? Promise.race([
            readPromise.then((r) => {
              clearTimeout(timer);
              return r;
            }),
            new Promise<typeof IDLE_TIMEOUT_SENTINEL>((resolve) => {
              timer = setTimeout(() => resolve(IDLE_TIMEOUT_SENTINEL), idleTimeout);
            }),
          ])
        : readPromise);

      if (result === IDLE_TIMEOUT_SENTINEL) {
        // Timeout won the race — reader.read() is still pending.
        // Cancel the reader to release the underlying stream body.
        readerCancelled = true;
        await reader.cancel();
        break;
      }

      const { done, value } = result;
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process all complete lines in the buffer
      const lines = buffer.split('\n');
      // Last element may be an incomplete line — keep it in the buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (processLine(line, options)) return;
      }
    }

    // Process remaining buffer (final line without trailing newline).
    // Check return value — if a 'done' event was in the trailing buffer,
    // processLine already called onDone; returning here prevents a second fire.
    if (buffer.trim()) {
      if (processLine(buffer, options)) return;
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    options.onError?.(err instanceof Error ? err : new Error(String(err)));
  } finally {
    // reader.releaseLock() throws if a read is pending; cancel() above handles
    // the timeout case (cancel releases the lock implicitly).
    if (!readerCancelled) {
      reader.releaseLock();
    }
  }

  // Guard: only fire onDone if processLine didn't already fire it via a 'done' event.
  // processLine calls onDone for type:'done' events; if that happened, it returned true
  // and we exited via `return` above. Reaching here means no 'done' event was received,
  // so it's safe to fire onDone as a stream-completion fallback.
  options.onDone?.();
}

/**
 * Convenience: POST to a streaming endpoint and consume the response.
 *
 * @returns an AbortController that cancels the stream when aborted.
 */
export function streamPost(
  url: string,
  body: unknown,
  options: StreamOptions & { headers?: Record<string, string> },
): AbortController {
  const controller = new AbortController();
  const signal = options.signal ? anySignal([options.signal, controller.signal]) : controller.signal;

  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(body),
    signal,
  })
    .then((response) => consumeStream(response, { ...options, signal }))
    .catch((err) => {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      options.onError?.(err instanceof Error ? err : new Error(String(err)));
    });

  return controller;
}

/**
 * Merge multiple AbortSignals — fires when any one aborts.
 * (Native AbortSignal.any() not universally available yet.)
 */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  const cleanups: Array<() => void> = [];

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    const handler = () => controller.abort(signal.reason);
    signal.addEventListener('abort', handler, { once: true });
    cleanups.push(() => signal.removeEventListener('abort', handler));
  }

  // When the merged controller aborts, clean up listeners on all source signals
  controller.signal.addEventListener(
    'abort',
    () => {
      for (const cleanup of cleanups) cleanup();
    },
    { once: true },
  );

  return controller.signal;
}

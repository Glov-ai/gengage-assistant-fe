import { normalizeMiddlewareUrl } from './api-paths.js';
import type { AnalyticsAuthMode } from './config-schema.js';

export interface AnalyticsEnvelope {
  event_name: string;
  event_version: '1';
  timestamp_ms: number;
  account_id: string;
  session_id: string;
  correlation_id: string;
  view_id?: string;
  user_id?: string;
  widget?: 'chat' | 'qna' | 'simrel';
  page_type?: string;
  sku?: string;
  payload: Record<string, unknown>;
}

export interface AnalyticsAuthConfig {
  mode?: AnalyticsAuthMode;
  key?: string;
  headerName?: string;
  bodyField?: string;
}

export interface AnalyticsClientConfig {
  enabled?: boolean;
  middlewareUrl: string;
  endpoint?: string;
  auth?: AnalyticsAuthConfig;
  fireAndForget?: boolean;
  useBeacon?: boolean;
  keepaliveFetch?: boolean;
  timeoutMs?: number;
  maxRetries?: number;
  batchSize?: number;
  flushIntervalMs?: number;
}

export type AnalyticsInput = Omit<AnalyticsEnvelope, 'event_version' | 'timestamp_ms'> &
  Partial<Pick<AnalyticsEnvelope, 'event_version' | 'timestamp_ms'>>;

interface AnalyticsTransportBody {
  events: AnalyticsEnvelope[];
  [extra: string]: unknown;
}

const DEFAULT_ANALYTICS_CONFIG: Required<Omit<AnalyticsClientConfig, 'auth' | 'middlewareUrl'>> = {
  enabled: true,
  endpoint: '/analytics',
  fireAndForget: true,
  useBeacon: true,
  keepaliveFetch: true,
  timeoutMs: 4000,
  maxRetries: 0,
  batchSize: 10,
  flushIntervalMs: 250,
};

const DEFAULT_AUTH: Required<AnalyticsAuthConfig> = {
  mode: 'none',
  key: '',
  headerName: 'X-API-Key',
  bodyField: 'api_key',
};

/**
 * Fire-and-forget analytics client.
 *
 * All transport errors are silently suppressed — the backend analytics
 * endpoint is not yet implemented, so callers must never observe failures.
 */
export class AnalyticsClient {
  private readonly config: Required<Omit<AnalyticsClientConfig, 'auth'>> & { auth: Required<AnalyticsAuthConfig> };
  private readonly queue: AnalyticsEnvelope[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly onPageHideBound: () => void;

  constructor(config: AnalyticsClientConfig) {
    this.config = {
      ...DEFAULT_ANALYTICS_CONFIG,
      ...config,
      auth: {
        ...DEFAULT_AUTH,
        ...(config.auth ?? {}),
      },
    };

    this.onPageHideBound = () => {
      if (this.queue.length === 0) return;
      this.flushAllSync();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', this.onPageHideBound);
    }
  }

  track(input: AnalyticsInput): void {
    if (!this.config.enabled) return;
    const envelope = normalizeAnalyticsInput(input);
    this.queue.push(envelope);

    if (this.queue.length >= this.config.batchSize) {
      this.scheduleImmediateFlush();
      return;
    }

    this.scheduleFlush();
  }

  flush(): void {
    if (!this.config.enabled || this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.config.batchSize);
    const body = this.buildTransportBody(batch);
    const endpoint = resolveAnalyticsEndpoint(this.config.endpoint, this.config.middlewareUrl);

    this.send(endpoint, body);
  }

  /** Drain the entire queue synchronously (used on page hide). */
  flushAll(): void {
    while (this.queue.length > 0) {
      this.flush();
    }
  }

  destroy(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.queue.length > 0) {
      this.flushAllSync();
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.onPageHideBound);
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, this.config.flushIntervalMs);
  }

  private scheduleImmediateFlush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }

  private buildTransportBody(events: AnalyticsEnvelope[]): AnalyticsTransportBody {
    const body: AnalyticsTransportBody = { events };
    if (this.config.auth.mode === 'body-api-key' && this.config.auth.key) {
      body[this.config.auth.bodyField] = this.config.auth.key;
    }
    return body;
  }

  /** Best-effort send — all errors silently suppressed. */
  private send(endpoint: string, body: AnalyticsTransportBody): void {
    try {
      const payload = JSON.stringify(body);

      // Prefer sendBeacon (works during page unload, no response needed)
      if (
        this.config.useBeacon &&
        this.config.auth.mode !== 'x-api-key-header' &&
        this.config.auth.mode !== 'bearer-header' &&
        hasSendBeacon()
      ) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(endpoint, blob);
        return;
      }

      if (typeof fetch === 'undefined') return;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.config.auth.mode === 'x-api-key-header' && this.config.auth.key) {
        headers[this.config.auth.headerName] = this.config.auth.key;
      }
      if (this.config.auth.mode === 'bearer-header' && this.config.auth.key) {
        headers.Authorization = `Bearer ${this.config.auth.key}`;
      }

      // Fire-and-forget: no await, no error handling, keepalive for page unload
      void fetch(endpoint, {
        method: 'POST',
        headers,
        body: payload,
        keepalive: true,
      }).catch(() => {
        // Silently suppress — backend not implemented yet
      });
    } catch {
      // Silently suppress all errors
    }
  }

  /** Synchronous flush using sendBeacon only (for page unload). */
  private flushAllSync(): void {
    if (!this.config.enabled) return;
    const endpoint = resolveAnalyticsEndpoint(this.config.endpoint, this.config.middlewareUrl);
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.config.batchSize);
      const body = this.buildTransportBody(batch);
      try {
        const payload = JSON.stringify(body);
        if (hasSendBeacon()) {
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon(endpoint, blob);
        }
      } catch {
        // Silently suppress
      }
    }
  }
}

export function createAnalyticsClient(config: AnalyticsClientConfig): AnalyticsClient {
  return new AnalyticsClient(config);
}

function normalizeAnalyticsInput(input: AnalyticsInput): AnalyticsEnvelope {
  const envelope: AnalyticsEnvelope = {
    event_name: input.event_name,
    event_version: input.event_version ?? '1',
    timestamp_ms: input.timestamp_ms ?? Date.now(),
    account_id: input.account_id,
    session_id: input.session_id,
    correlation_id: input.correlation_id,
    payload: input.payload,
  };

  if (input.view_id !== undefined) envelope.view_id = input.view_id;
  if (input.user_id !== undefined) envelope.user_id = input.user_id;
  if (input.widget !== undefined) envelope.widget = input.widget;
  if (input.page_type !== undefined) envelope.page_type = input.page_type;
  if (input.sku !== undefined) envelope.sku = input.sku;

  return envelope;
}

function resolveAnalyticsEndpoint(endpoint: string, middlewareUrl: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  const baseUrl = normalizeMiddlewareUrl(middlewareUrl);
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${normalizedEndpoint}`;
}

function hasSendBeacon(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function';
}

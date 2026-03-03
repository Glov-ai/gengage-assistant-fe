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
  maxRetries: 1,
  batchSize: 10,
  flushIntervalMs: 250,
};

const DEFAULT_AUTH: Required<AnalyticsAuthConfig> = {
  mode: 'none',
  key: '',
  headerName: 'X-API-Key',
  bodyField: 'api_key',
};

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
      void this.flushAll({ preferBeacon: true });
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

  async flush(options: { preferBeacon?: boolean } = {}): Promise<void> {
    if (!this.config.enabled || this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.config.batchSize);
    const body = this.buildTransportBody(batch);
    const endpoint = resolveAnalyticsEndpoint(this.config.endpoint, this.config.middlewareUrl);
    const preferBeacon = options.preferBeacon ?? this.config.useBeacon;

    await this.sendWithRetry(endpoint, body, preferBeacon);
  }

  /** Drain the entire queue, flushing in batch-sized chunks. */
  async flushAll(options: { preferBeacon?: boolean } = {}): Promise<void> {
    while (this.queue.length > 0) {
      await this.flush(options);
    }
  }

  destroy(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    // Flush remaining events before tearing down the listener.
    if (this.queue.length > 0) {
      void this.flushAll({ preferBeacon: true });
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.onPageHideBound);
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, this.config.flushIntervalMs);
  }

  private scheduleImmediateFlush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    void this.flush();
  }

  private buildTransportBody(events: AnalyticsEnvelope[]): AnalyticsTransportBody {
    const body: AnalyticsTransportBody = { events };
    if (this.config.auth.mode === 'body-api-key' && this.config.auth.key) {
      body[this.config.auth.bodyField] = this.config.auth.key;
    }
    return body;
  }

  private async sendWithRetry(endpoint: string, body: AnalyticsTransportBody, preferBeacon: boolean): Promise<void> {
    let attempt = 0;
    while (attempt <= this.config.maxRetries) {
      attempt += 1;
      try {
        const sent = await this.send(endpoint, body, preferBeacon);
        if (sent) return;
      } catch {
        // fire-and-forget transport: swallow and continue retry cycle
      }
      // Exponential backoff: 100ms, 200ms, 400ms, 800ms, capped at 1s
      if (attempt <= this.config.maxRetries) {
        await new Promise<void>((r) => setTimeout(r, Math.min(1000, 100 * Math.pow(2, attempt - 1))));
      }
    }
  }

  private async send(endpoint: string, body: AnalyticsTransportBody, preferBeacon: boolean): Promise<boolean> {
    const payload = JSON.stringify(body);
    const canUseBeacon =
      preferBeacon &&
      this.config.useBeacon &&
      this.config.auth.mode !== 'x-api-key-header' &&
      this.config.auth.mode !== 'bearer-header' &&
      hasSendBeacon();

    if (canUseBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      const ok = navigator.sendBeacon(endpoint, blob);
      if (ok) return true;
    }

    if (typeof fetch === 'undefined') return false;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.auth.mode === 'x-api-key-header' && this.config.auth.key) {
      headers[this.config.auth.headerName] = this.config.auth.key;
    }
    if (this.config.auth.mode === 'bearer-header' && this.config.auth.key) {
      headers.Authorization = `Bearer ${this.config.auth.key}`;
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), this.config.timeoutMs) : null;

    try {
      const requestInit: RequestInit = {
        method: 'POST',
        headers,
        body: payload,
        keepalive: this.config.keepaliveFetch && this.config.fireAndForget,
      };
      if (controller) {
        requestInit.signal = controller.signal;
      }
      const response = await fetch(endpoint, requestInit);
      return response.ok;
    } finally {
      if (timeout) clearTimeout(timeout);
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

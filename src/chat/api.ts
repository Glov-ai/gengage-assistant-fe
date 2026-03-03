import { consumeStream } from '../common/streaming.js';
import { adaptV1Event } from '../common/v1-protocol-adapter.js';
import { buildChatEndpointUrl } from '../common/api-paths.js';
import type { StreamEvent, UISpec, PageContext } from '../common/types.js';
import type { ChatTransportConfig } from '../common/api-paths.js';

export interface BackendRequestMeta {
  outputLanguage: string;
  parentUrl: string;
  windowWidth: string;
  windowHeight: string;
  selfUrl: string;
  id: string;
  userId: string;
  appId: string;
  threads: unknown[];
  createdAt: string;
  kvkkApproved: boolean;
  voiceEnabled: boolean;
  threadId: string;
  isControlGroup: boolean;
  isMobile: boolean;
  viewId?: string;
}

export interface ProcessActionRequest {
  account_id: string;
  session_id: string;
  correlation_id: string;
  user_id?: string;
  view_id?: string;

  /**
   * @deprecated Use top-level `type` and `payload` instead.
   * Kept for one release cycle of backward compatibility.
   */
  action?: {
    title: string;
    type: string;
    payload?: unknown;
  };

  /** Backend action type identifier (preferred over `action.type`). */
  type?: string;
  /** Arbitrary action data passed to the backend (preferred over `action.payload`). */
  payload?: unknown;

  sku?: string;
  page_type?: string;
  locale?: string;
  meta?: BackendRequestMeta;
  context?: {
    messages?: Array<{ role: string; content: string }>;
    [key: string]: unknown;
  };
}

export interface ActionEnrichmentContext {
  pageContext?: PageContext | undefined;
  backendContext?: import('../common/types.js').BackendContext | null | undefined;
  isMobile?: boolean | undefined;
}

/**
 * Enriches action payloads with fields the v1 backend expects.
 * Only adds fields that are not already present in the payload.
 */
export function enrichActionPayload(
  action: { title: string; type: string; payload?: unknown },
  ctx: ActionEnrichmentContext,
): { title: string; type: string; payload?: unknown } {
  const type = action.type;
  const existing =
    action.payload != null && typeof action.payload === 'object' && !Array.isArray(action.payload)
      ? (action.payload as Record<string, unknown>)
      : {};

  // Helper: only set if not already present
  const merge = (additions: Record<string, unknown>): Record<string, unknown> => {
    const result = { ...existing };
    for (const [key, value] of Object.entries(additions)) {
      if (!(key in result)) {
        result[key] = value;
      }
    }
    return result;
  };

  switch (type) {
    case 'inputText': {
      const additions: Record<string, unknown> = {
        is_launcher: 0,
      };
      if (ctx.pageContext?.extra) additions['page_details'] = ctx.pageContext.extra;
      // is_suggested_text may already be set by adapter — don't overwrite
      if (!('is_suggested_text' in existing)) additions['is_suggested_text'] = 0;
      return { ...action, payload: merge(additions) };
    }

    case 'findSimilar': {
      const additions: Record<string, unknown> = {
        is_launcher: 0,
      };
      if (action.title) additions['text'] = action.title;
      if (action.title) additions['input'] = action.title;
      return { ...action, payload: merge(additions) };
    }

    case 'getComparisonTable': {
      // sku_list should already be set; no-op if present
      return action;
    }

    case 'addToCart': {
      const additions: Record<string, unknown> = {};
      if (!('error_message' in existing)) additions['error_message'] = '';
      return { ...action, payload: merge(additions) };
    }

    case 'reviewSummary': {
      const additions: Record<string, unknown> = {};
      if (ctx.pageContext?.sku && !('sku' in existing)) {
        additions['sku'] = ctx.pageContext.sku;
      }
      if (Object.keys(additions).length === 0) return action;
      return { ...action, payload: merge(additions) };
    }

    default:
      return action;
  }
}

export interface StreamCallbacks {
  onTextChunk: (
    content: string,
    isFinal: boolean,
    extra?: {
      productMentions?: Array<{ sku: string; short_name: string }> | undefined;
      skuToProductItem?: Record<string, Record<string, unknown>> | undefined;
      conversationMode?: string | undefined;
    },
  ) => void;
  onUISpec: (spec: UISpec, widget: string, panelHint?: 'panel') => void;
  onAction: (event: StreamEvent) => void;
  onMetadata: (event: StreamEvent) => void;
  onError: (err: Error) => void;
  onDone: () => void;
}

/**
 * Action type mapping.
 * The backend's ActionType enum uses `inputText` for user messages,
 * while the frontend uses `user_message`. Map at the boundary.
 */
const ACTION_TYPE_MAP: Record<string, string> = {
  user_message: 'inputText',
};

/**
 * Builds the request body for `/chat/process_action` (v1 backend).
 *
 * Backend expects `type` and `payload` at the top level —
 * matching chat_api.py's current schema.
 */
function buildRequestBody(request: ProcessActionRequest): string {
  const { action, type: flatType, payload: flatPayload, ...rest } = request;
  // Prefer top-level type/payload; fall back to deprecated action wrapper.
  const rawType = flatType ?? action?.type ?? 'inputText';
  const rawPayload = flatPayload ?? action?.payload;
  const mappedType = ACTION_TYPE_MAP[rawType] ?? rawType;
  const body: Record<string, unknown> = {
    ...rest,
    type: mappedType,
  };
  if (rawPayload !== undefined) {
    // Backend expects payload as an object. Wrap string payloads for compatibility.
    body.payload = typeof rawPayload === 'string' ? { text: rawPayload } : rawPayload;
  }
  return JSON.stringify(body);
}

/**
 * Builds the request body for ACAP backend (`/api/chat/:siteId/message`).
 *
 * ACAP expects: { message, session_id, user_id, output_language, screen_context }
 */
function buildAcapRequestBody(request: ProcessActionRequest): string {
  const rawType = request.type ?? request.action?.type ?? 'inputText';
  const rawPayload = request.payload ?? request.action?.payload;

  // Extract user message text from various payload shapes
  let message = request.action?.title ?? '';
  if (rawType === 'inputText' || rawType === 'user_message') {
    if (typeof rawPayload === 'string') {
      message = rawPayload;
    } else if (rawPayload && typeof rawPayload === 'object' && 'text' in rawPayload) {
      message = String((rawPayload as Record<string, unknown>).text);
    }
  }

  const body: Record<string, unknown> = {
    message,
    session_id: request.session_id,
  };

  if (request.user_id) body.user_id = request.user_id;
  if (request.locale) body.output_language = request.locale;
  if (request.meta?.outputLanguage) body.output_language = request.meta.outputLanguage;

  // Map page context to ACAP screen_context
  if (request.sku || request.page_type) {
    const screenContext: Record<string, unknown> = {};
    if (request.page_type) screenContext.screen_type = request.page_type;
    if (request.sku) screenContext.sku_list = [request.sku];
    body.screen_context = screenContext;
  }

  // For non-message actions, send the action type and payload
  if (rawType !== 'inputText' && rawType !== 'user_message') {
    body.action_type = rawType;
    if (rawPayload !== undefined) {
      body.action_payload = typeof rawPayload === 'string' ? { text: rawPayload } : rawPayload;
    }
  }

  return JSON.stringify(body);
}

export function sendChatMessage(
  request: ProcessActionRequest,
  callbacks: StreamCallbacks,
  transport: ChatTransportConfig,
): AbortController {
  const url = buildChatEndpointUrl('process_action', transport);
  const controller = new AbortController();

  const run = async (): Promise<void> => {
    try {
      const requestBody = transport.backendType === 'acap' ? buildAcapRequestBody(request) : buildRequestBody(request);

      // Use FormData only when an attachment is present; otherwise send JSON.
      const useFormData = transport.attachment !== undefined;

      let fetchInit: RequestInit;
      if (useFormData) {
        const formData = new FormData();
        formData.append('request', requestBody);
        if (transport.attachment !== undefined) {
          formData.append('attachment', transport.attachment);
        }
        fetchInit = {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        };
      } else {
        fetchInit = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
          signal: controller.signal,
        };
      }

      const response = await fetch(url, fetchInit);

      if (!response.ok) {
        let detail = response.statusText;
        try {
          const body = await response.json();
          const msg =
            (body as Record<string, unknown>).detail ??
            (body as Record<string, unknown>).message ??
            (body as Record<string, unknown>).error;
          if (typeof msg === 'string') detail = msg;
        } catch {
          /* body not JSON — keep statusText */
        }
        callbacks.onError(new Error(`HTTP ${response.status}: ${detail}`));
        return;
      }

      // Guard against double-fire: onDone must fire exactly once
      let doneFired = false;
      const fireDone = () => {
        if (doneFired) return;
        doneFired = true;
        callbacks.onDone();
      };

      await consumeStream(response, {
        onEvent: (event: StreamEvent) => {
          const normalized = adaptV1Event(event as unknown as Record<string, unknown>);

          if (!normalized) return;

          switch (normalized.type) {
            case 'text_chunk':
              callbacks.onTextChunk(normalized.content, normalized.final === true, {
                productMentions: normalized.productMentions,
                skuToProductItem: normalized.skuToProductItem,
                conversationMode: normalized.conversationMode,
              });
              break;
            case 'ui_spec':
              callbacks.onUISpec(normalized.spec, normalized.widget, normalized.panelHint);
              break;
            case 'action':
              callbacks.onAction(normalized);
              break;
            case 'metadata':
              callbacks.onMetadata(normalized);
              break;
            case 'error':
              callbacks.onError(new Error(normalized.message));
              break;
            case 'done':
              fireDone();
              break;
          }
        },
        onError: callbacks.onError,
        signal: controller.signal,
      });

      // Fallback: if stream completed without a chatStreamEnd event (backend
      // bug or truncated response), ensure onDone fires so the widget doesn't
      // get stuck with a spinning typing indicator.
      fireDone();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  void run();
  return controller;
}

export async function fetchProactiveAction(
  request: { account_id: string; sku?: string; page_type?: string; output_language?: string; mode?: string },
  transport: ChatTransportConfig,
): Promise<{ title?: string; question?: string; actions?: unknown[] } | null> {
  const url = buildChatEndpointUrl('proactive_action', transport);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!res.ok) return null;
    return (await res.json()) as { title?: string; question?: string; actions?: unknown[] };
  } catch {
    return null;
  }
}

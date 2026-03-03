/**
 * Endpoint path helpers.
 *
 * All endpoints use `/chat/*` prefix. API versioning is handled via
 * request-level compatibility params or feature-toggle params.
 */

export type ChatEndpointName =
  | 'process_action'
  | 'launcher_action'
  | 'similar_products'
  | 'product_groupings'
  | 'proactive_action';

export type BackendType = 'v1' | 'acap';

export interface ChatTransportConfig {
  middlewareUrl: string;
  attachment?: File;
  /** Backend type: 'v1' (default) or 'acap'. */
  backendType?: BackendType;
  /** Account ID — required for ACAP backend (used in URL path). */
  accountId?: string;
}

const CHAT_ENDPOINT_PATHS: Record<ChatEndpointName, `/${string}`> = {
  process_action: '/process_action',
  launcher_action: '/launcher_action',
  similar_products: '/similar_products',
  product_groupings: '/product_groupings',
  proactive_action: '/proactive_action',
};

/**
 * ACAP endpoint mapping.
 * ACAP uses /api/chat/:accountId/message for all actions.
 */
const ACAP_ENDPOINT_MAP: Partial<Record<ChatEndpointName, string>> = {
  process_action: '/message',
  launcher_action: '/message',
};

export function normalizeMiddlewareUrl(input?: string): string {
  if (input === undefined) {
    throw new Error('[gengage] middlewareUrl is required. Pass your Gengage backend URL in widget config.');
  }
  const raw = input.trim();
  if (raw === '') return '';
  return raw.replace(/\/+$/, '');
}

export function buildChatEndpointUrl(endpoint: ChatEndpointName, config: ChatTransportConfig): string {
  const baseUrl = normalizeMiddlewareUrl(config?.middlewareUrl);

  if (config.backendType === 'acap') {
    const accountId = config.accountId ?? '';
    const acapPath = ACAP_ENDPOINT_MAP[endpoint];
    if (acapPath) {
      return `${baseUrl}/api/chat/${accountId}${acapPath}`;
    }
    // Fallback: unsupported ACAP endpoints use v1 path
  }

  return `${baseUrl}/chat${CHAT_ENDPOINT_PATHS[endpoint]}`;
}

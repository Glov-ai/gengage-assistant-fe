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
  | 'beauty_consulting_init';

export interface ChatTransportConfig {
  middlewareUrl: string;
  attachment?: File;
  /** Account ID (used in URL path when needed). */
  accountId?: string;
}

const CHAT_ENDPOINT_PATHS: Record<ChatEndpointName, `/${string}`> = {
  process_action: '/process_action',
  launcher_action: '/launcher_action',
  similar_products: '/similar_products',
  product_groupings: '/product_groupings',
  beauty_consulting_init: '/beauty_consulting_init',
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
  return `${baseUrl}/chat${CHAT_ENDPOINT_PATHS[endpoint]}`;
}

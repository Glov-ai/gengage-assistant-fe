import { consumeStream } from '../common/streaming.js';
import { buildChatEndpointUrl } from '../common/api-paths.js';
import { adaptV1Event } from '../common/v1-protocol-adapter.js';
import type { StreamEvent, UISpec } from '../common/types.js';
import type { ChatTransportConfig } from '../common/api-paths.js';

export interface LauncherActionRequest {
  account_id: string;
  session_id: string;
  correlation_id: string;
  sku: string;
  page_type?: string;
  locale?: string;
  output_language?: string;
  mode?: string;
}

export interface LauncherActionResult {
  uiSpecs: UISpec[];
  actions: Array<{ title: string; type: string; payload?: unknown }>;
}

export async function fetchLauncherActions(
  request: LauncherActionRequest,
  transport: ChatTransportConfig,
  signal?: AbortSignal,
): Promise<LauncherActionResult> {
  const url = buildChatEndpointUrl('launcher_action', transport);
  const result: LauncherActionResult = { uiSpecs: [], actions: [] };

  const fetchInit: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  };
  if (signal !== undefined) fetchInit.signal = signal;
  const response = await fetch(url, fetchInit);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const streamOpts: import('../common/streaming.js').StreamOptions = {
    onEvent: (event: StreamEvent) => {
      const normalized = adaptV1Event(event as unknown as Record<string, unknown>);

      if (!normalized) return;

      if (normalized.type === 'ui_spec') {
        result.uiSpecs.push(normalized.spec);
      }

      if (normalized.type === 'ui_spec' && normalized.spec.elements) {
        for (const el of Object.values(normalized.spec.elements)) {
          if (el.type === 'ActionButton' && el.props?.['action']) {
            const action = el.props['action'] as { title: string; type: string; payload?: unknown };
            result.actions.push(action);
          }
        }
      }
    },
  };
  if (signal !== undefined) streamOpts.signal = signal;

  await consumeStream(response, streamOpts);

  return result;
}

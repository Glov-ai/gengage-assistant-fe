import type { AccountRuntimeConfig } from './config-schema.js';
import { safeParseAccountRuntimeConfig } from './config-schema.js';
import { initOverlayWidgets } from './overlay.js';
import type { OverlayWidgetsController, OverlayWidgetsOptions } from './overlay.js';
import { preflightDiagnostics } from './preflight.js';
import type { PageContext } from './types.js';

export interface HostActions {
  onAddToCart?: (params: import('./types.js').AddToCartParams) => void;
  onProductNavigate?: (url: string, sku: string, sessionId: string | null) => void;
  onScriptCall?: (params: { name: string; payload?: Record<string, unknown> }) => void;
}

export interface GengageClientOptions {
  runtimeConfig: AccountRuntimeConfig | unknown;
  contextResolver?: () => Partial<PageContext>;
  hostActions?: HostActions;
  preflight?: boolean;
}

function parseConfig(raw: AccountRuntimeConfig | unknown): AccountRuntimeConfig {
  const result = safeParseAccountRuntimeConfig(raw);
  if (!result.success) {
    const messages = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`[gengage] Invalid runtime config: ${messages}`);
  }
  return result.data;
}

function mapConfigToOverlayOptions(
  config: AccountRuntimeConfig,
  hostActions?: HostActions,
  initialContext?: Partial<PageContext>,
): OverlayWidgetsOptions {
  const options: OverlayWidgetsOptions = {
    accountId: config.accountId,
    middlewareUrl: config.middlewareUrl,
    idempotencyKey: config.gtm.idempotencyKey,
  };

  if (config.locale !== undefined) options.locale = config.locale;

  if (initialContext !== undefined) {
    options.pageContext = initialContext;
    if (initialContext.sku !== undefined) options.sku = initialContext.sku;
  }

  options.chat = {
    enabled: config.widgets.chat.enabled,
  };
  if (config.mounts.chat !== undefined) {
    options.chat.mountTarget = config.mounts.chat;
  }

  options.qna = {
    enabled: config.widgets.qna.enabled,
  };
  if (config.mounts.qna !== undefined) {
    options.qna.mountTarget = config.mounts.qna;
  }

  options.simrel = {
    enabled: config.widgets.simrel.enabled,
  };
  if (config.mounts.simrel !== undefined) {
    options.simrel.mountTarget = config.mounts.simrel;
  }

  if (hostActions?.onAddToCart !== undefined) {
    options.onAddToCart = hostActions.onAddToCart;
  }

  if (hostActions?.onProductNavigate !== undefined) {
    options.onProductNavigate = hostActions.onProductNavigate;
  }

  if (hostActions?.onScriptCall !== undefined) {
    options.onScriptCall = hostActions.onScriptCall;
  }

  return options;
}

export async function initGengageClient(options: GengageClientOptions): Promise<OverlayWidgetsController> {
  const config = parseConfig(options.runtimeConfig);

  if (options.preflight !== false) {
    const result = preflightDiagnostics(config);
    if (!result.ok) {
      const errors = result.warnings.filter((w) => w.severity === 'error');
      throw new Error(`[gengage] Preflight failed: ${errors.map((e) => e.message).join('; ')}`);
    }
  }

  const initialContext = options.contextResolver?.();

  const overlayOptions = mapConfigToOverlayOptions(config, options.hostActions, initialContext);
  const controller = await initOverlayWidgets(overlayOptions);

  if (options.contextResolver !== undefined) {
    const resolver = options.contextResolver;
    const listener = () => {
      const ctx = resolver();
      void controller.updateContext(ctx);
    };
    window.addEventListener('gengage:context:update', listener);

    // Wrap destroy to remove the listener and prevent a memory leak.
    const originalDestroy = controller.destroy.bind(controller);
    controller.destroy = () => {
      window.removeEventListener('gengage:context:update', listener);
      originalDestroy();
    };
  }

  return controller;
}

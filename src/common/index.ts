export type {
  PageContext,
  SessionContext,
  BaseWidgetConfig,
  WidgetTheme,
  GengageWidget,
  StreamEvent,
  StreamEventMetadata,
  StreamEventTextChunk,
  StreamEventUISpec,
  StreamEventAction,
  StreamEventError,
  StreamEventDone,
  UISpec,
  UIElement,
  ActionPayload,
  GengageEventName,
  GengageEventDetailMap,
} from './types.js';

export { BaseWidget } from './widget-base.js';
export type { ChatPublicAPI } from './widget-base.js';

export { consumeStream, streamPost } from './streaming.js';
export type { StreamOptions, StreamEventHandler } from './streaming.js';

export { dispatch, listen, wireQNAToChat, wireSimilarToChat } from './events.js';
export type { WireQNAToChatOptions } from './events.js';

export { bootstrapSession, getWindowPageContext, updatePageContext, resolveSession } from './context.js';
export { initOverlayWidgets, getOverlayWidgets, destroyOverlayWidgets, buildOverlayIdempotencyKey } from './overlay.js';
export type {
  OverlayWidgetsController,
  OverlayWidgetsOptions,
  OverlayChatOptions,
  OverlayQNAOptions,
  OverlaySimRelOptions,
  OverlaySimButOptions,
} from './overlay.js';
export {
  detectNativeEnvironment,
  applyNativeSession,
  createNativeWebViewBridge,
  initNativeOverlayWidgets,
} from './native-webview.js';
export type {
  NativeBridgeEnvironment,
  NativeSessionPayload,
  NativeBridgeMessage,
  NativeWebViewBridgeOptions,
  NativeWebViewBridge,
  NativeOverlayInitOptions,
  NativeOverlayInitResult,
} from './native-webview.js';

export { buildChatEndpointUrl, normalizeMiddlewareUrl } from './api-paths.js';
export type { ChatTransportConfig, ChatEndpointName } from './api-paths.js';

export {
  AccountRuntimeConfigSchema,
  AnalyticsAuthModeSchema,
  UnknownActionPolicySchema,
  parseAccountRuntimeConfig,
  safeParseAccountRuntimeConfig,
  createDefaultAccountRuntimeConfig,
} from './config-schema.js';
export type { AccountRuntimeConfig, AnalyticsAuthMode, UnknownActionPolicy } from './config-schema.js';

export { routeStreamAction } from './action-router.js';
export type { HostActionHandlers, ActionRouterOptions } from './action-router.js';

export { AnalyticsClient, createAnalyticsClient } from './analytics.js';
export type { AnalyticsEnvelope, AnalyticsInput, AnalyticsAuthConfig, AnalyticsClientConfig } from './analytics.js';

export {
  streamStartEvent,
  streamChunkEvent,
  streamUiSpecEvent,
  streamDoneEvent,
  streamErrorEvent,
  llmUsageEvent,
  meteringIncrementEvent,
  meteringSummaryEvent,
  chatHistorySnapshotEvent,
  widgetHistorySnapshotEvent,
  basketAddEvent,
  checkoutStartEvent,
  checkoutCompleteEvent,
} from './analytics-events.js';
export type { AnalyticsContext } from './analytics-events.js';

export { sanitizeHtml } from './safe-html.js';
export { renderUISpecWithRegistry, defaultUnknownUISpecRenderer } from './renderer/index.js';
export { mergeUISpecRegistry } from './renderer/index.js';
export type {
  UISpecRenderHelpers,
  UISpecRendererOverrides,
  UISpecDomComponentRenderParams,
  UISpecDomComponentRenderer,
  UISpecDomRegistry,
  UISpecDomUnknownRendererParams,
  UISpecDomUnknownRenderer,
  RenderUISpecWithRegistryOptions,
} from './renderer/index.js';
export { BASE_WIDGET_THEME, withBaseTheme } from './theme-utils.js';
export { DEFAULT_WIDGET_THEME_TOKENS, withDefaultWidgetTheme } from './ui-theme.js';
export {
  registerGlobalErrorToastListener,
  showGlobalErrorToast,
  dismissGlobalErrorToast,
  getGlobalErrorMessage,
} from './global-error-toast.js';
export { trackConnectionWarningRequest, configureConnectionWarning } from './connection-warning.js';
export type { ConnectionWarningRequestOptions } from './connection-warning.js';
export {
  DEFAULT_CUSTOMIZATION_LOCALE,
  createAccountIdentity,
  createFloatingChatConfig,
  createPdpQnaConfig,
  createPdpSimRelConfig,
  createDefaultAnalyticsConfig,
} from './customization-factories.js';
export type { AccountIdentityConfig, AccountIdentity } from './customization-factories.js';

export { initGengageClient } from './client.js';
export type { GengageClientOptions, HostActions } from './client.js';

export { preflightDiagnostics } from './preflight.js';
export type { PreflightResult, PreflightWarning } from './preflight.js';

export {
  adaptBackendEvent,
  productToNormalized,
  normalizeSimilarProductsResponse,
  normalizeProductGroupingsResponse,
} from './protocol-adapter.js';

export { wireGADataLayer } from './ga-datalayer.js';
export { isVoiceInputSupported, VoiceInput } from './voice-input.js';
export type { VoiceInputState, VoiceInputErrorCode, VoiceInputCallbacks, VoiceInputOptions } from './voice-input.js';
export { detectPageType, extractSkuFromUrl, autoDetectPageContext } from './page-detect.js';
export type { DetectablePageType, PageDetectionRule } from './page-detect.js';
export type {
  NormalizedProduct,
  SimilarProductsJsonResponse,
  ProductGroupingsJsonResponse,
} from './protocol-adapter.js';

export { getSuggestedSearchKeywords, getSuggestedSearchKeywordsText } from './suggested-search-keywords.js';
export type { SuggestedSearchKeywordSource } from './suggested-search-keywords.js';

export { makePillLauncher } from './pill-launcher.js';
export type { PillLauncherOptions, PillLauncherKit } from './pill-launcher.js';

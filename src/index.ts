/**
 * gengage-assistant-fe — top-level barrel export.
 *
 * Import the whole library:
 *   import { GengageChat, GengageQNA, GengageSimRel, bootstrapSession } from '@gengage/assistant-fe';
 *
 * Or import individual widgets for smaller bundles:
 *   import { GengageChat } from '@gengage/assistant-fe/chat';
 *   import { GengageQNA } from '@gengage/assistant-fe/qna';
 *   import { GengageSimRel } from '@gengage/assistant-fe/simrel';
 */

// Widgets
export { GengageChat, createChatWidget } from './chat/index.js';
export { GengageQNA, createQNAWidget } from './qna/index.js';
export { GengageSimRel, createSimRelWidget } from './simrel/index.js';
export { GengageSimBut, createSimButWidget } from './simbut/index.js';
export {
  renderUISpec as renderChatUISpec,
  createDefaultChatUISpecRegistry,
  defaultChatUnknownUISpecRenderer,
} from './chat/index.js';
export { renderQnaUISpec, createDefaultQnaUISpecRegistry, defaultQnaUnknownUISpecRenderer } from './qna/index.js';
export {
  renderSimRelUISpec,
  createDefaultSimRelUISpecRegistry,
  defaultSimRelUnknownUISpecRenderer,
} from './simrel/index.js';

// Common
export {
  bootstrapSession,
  updatePageContext,
  initOverlayWidgets,
  getOverlayWidgets,
  destroyOverlayWidgets,
  buildOverlayIdempotencyKey,
  detectNativeEnvironment,
  applyNativeSession,
  createNativeWebViewBridge,
  initNativeOverlayWidgets,
  wireQNAToChat,
  wireSimilarToChat,
  dispatch,
  listen,
  consumeStream,
  streamPost,
  buildChatEndpointUrl,
  normalizeMiddlewareUrl,
  routeStreamAction,
  createAnalyticsClient,
  renderUISpecWithRegistry,
  defaultUnknownUISpecRenderer,
  BASE_WIDGET_THEME,
  withBaseTheme,
  DEFAULT_WIDGET_THEME_TOKENS,
  withDefaultWidgetTheme,
  DEFAULT_CUSTOMIZATION_LOCALE,
  createAccountIdentity,
  createFloatingChatConfig,
  createPdpQnaConfig,
  createPdpSimRelConfig,
  createDefaultAnalyticsConfig,
  parseAccountRuntimeConfig,
  safeParseAccountRuntimeConfig,
  createDefaultAccountRuntimeConfig,
  AccountRuntimeConfigSchema,
  AnalyticsAuthModeSchema,
  UnknownActionPolicySchema,
  initGengageClient,
  preflightDiagnostics,
  wireGADataLayer,
  isVoiceInputSupported,
  VoiceInput,
  detectPageType,
  extractSkuFromUrl,
  autoDetectPageContext,
} from './common/index.js';

// Types (re-exported for consumers who want to type their own code)
export type {
  PageContext,
  SessionContext,
  BaseWidgetConfig,
  GengageWidget,
  StreamEvent,
  UISpec,
  UIElement,
  ActionPayload,
  GengageEventName,
  ChatPublicAPI,
  ChatTransportConfig,
  ChatEndpointName,
  AccountRuntimeConfig,
  AnalyticsAuthMode,
  UnknownActionPolicy,
  HostActionHandlers,
  ActionRouterOptions,
  AnalyticsEnvelope,
  AnalyticsInput,
  AnalyticsAuthConfig,
  AnalyticsClientConfig,
  UISpecDomComponentRenderParams,
  UISpecDomComponentRenderer,
  UISpecDomRegistry,
  UISpecDomUnknownRendererParams,
  UISpecDomUnknownRenderer,
  RenderUISpecWithRegistryOptions,
  OverlayWidgetsController,
  OverlayWidgetsOptions,
  OverlayChatOptions,
  OverlayQNAOptions,
  OverlaySimRelOptions,
  OverlaySimButOptions,
  NativeBridgeEnvironment,
  NativeSessionPayload,
  NativeBridgeMessage,
  NativeWebViewBridgeOptions,
  NativeWebViewBridge,
  NativeOverlayInitOptions,
  NativeOverlayInitResult,
  AccountIdentityConfig,
  AccountIdentity,
  GengageClientOptions,
  HostActions,
  PreflightResult,
  PreflightWarning,
  WireQNAToChatOptions,
  VoiceInputState,
  VoiceInputErrorCode,
  VoiceInputCallbacks,
  VoiceInputOptions,
  DetectablePageType,
  PageDetectionRule,
} from './common/index.js';

export type { ChatWidgetConfig, ChatMessage, ChatSession, ChatI18n, ChatRendererConfig } from './chat/index.js';
export type { ChatUISpecRegistry, UISpecRenderContext as ChatUISpecRenderContext } from './chat/index.js';

export type {
  QNAWidgetConfig,
  QNAI18n,
  QNAUISpecRenderContext,
  QNAUISpecRegistry,
  QNARendererConfig,
} from './qna/index.js';

export type {
  SimRelWidgetConfig,
  SimilarProduct,
  SimRelI18n,
  SimRelUISpecRenderContext,
  SimRelUISpecRegistry,
  SimRelRendererConfig,
} from './simrel/index.js';

export type { SimButWidgetConfig, SimButI18n } from './simbut/index.js';

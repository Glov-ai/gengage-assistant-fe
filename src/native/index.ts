export {
  DEFAULT_NATIVE_TRACKED_EVENTS,
  detectNativeEnvironment,
  applyNativeSession,
  createNativeWebViewBridge,
  initNativeOverlayWidgets,
} from '../common/native-webview.js';

export type {
  NativeBridgeEnvironment,
  NativeSessionPayload,
  NativeBridgeMessage,
  NativeInboundMessage,
  NativeTrackedEvent,
  NativeWebViewBridgeOptions,
  NativeWebViewBridge,
  NativeOverlayInitOptions,
  NativeOverlayInitResult,
} from '../common/native-webview.js';

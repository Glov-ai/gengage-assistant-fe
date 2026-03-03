/**
 * Gengage Native WebView Bridge
 *
 * Auto-initializing bridge between Gengage widgets and native iOS/Android apps.
 * Load this script synchronously BEFORE widget initialization.
 *
 * Outbound (widget -> native):
 *   - Intercepts gengage:bridge:message CustomEvents from CommunicationBridge
 *   - Intercepts typed gengage:* CustomEvents from the event bus
 *   - Routes through webkit.messageHandlers (iOS) or GengageNative (Android)
 *
 * Inbound (native -> widget):
 *   - Exposes window.gengageNative.receive(message) for evaluateJavaScript calls
 *   - Routes to window.gengage.overlay controller methods
 *
 * @see README.md for integration guide
 */
(function () {
  'use strict';

  // Prevent double-init
  if (window.gengageNative) return;

  // ---------------------------------------------------------------------------
  // Environment detection
  // ---------------------------------------------------------------------------

  function detectEnvironment() {
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.gengage) {
      return 'ios';
    }
    if (window.GengageNative && typeof window.GengageNative.postMessage === 'function') {
      return 'android';
    }
    return 'browser';
  }

  var env = detectEnvironment();

  // ---------------------------------------------------------------------------
  // Outbound: widget -> native
  // ---------------------------------------------------------------------------

  function sendToNative(type, payload) {
    var message = { type: type };
    if (payload !== undefined) {
      message.payload = payload;
    }

    if (env === 'ios') {
      window.webkit.messageHandlers.gengage.postMessage(message);
    } else if (env === 'android') {
      window.GengageNative.postMessage(JSON.stringify(message));
    } else {
      console.log('[gengage:native-bridge] ' + type, payload);
    }
  }

  // Intercept CommunicationBridge outbound events
  window.addEventListener('gengage:bridge:message', function (e) {
    var detail = e.detail;
    sendToNative('bridge_message', {
      namespace: detail.namespace,
      type: detail.type,
      payload: detail.payload,
    });
  });

  // Intercept typed gengage:* CustomEvents
  var TRACKED_EVENTS = [
    'gengage:chat:open',
    'gengage:chat:close',
    'gengage:chat:ready',
    'gengage:chat:add-to-cart',
    'gengage:qna:action',
    'gengage:qna:open-chat',
    'gengage:similar:product-click',
    'gengage:similar:add-to-cart',
    'gengage:global:error',
    'gengage:context:update',
  ];

  TRACKED_EVENTS.forEach(function (eventName) {
    window.addEventListener(eventName, function (e) {
      sendToNative('widget_event', {
        event: eventName,
        detail: e.detail,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Inbound: native -> widget
  // ---------------------------------------------------------------------------

  function getController() {
    return window.gengage && window.gengage.overlay ? window.gengage.overlay : null;
  }

  function receive(message) {
    if (!message || typeof message !== 'object') {
      console.warn('[gengage:native-bridge] Invalid message:', message);
      return;
    }

    // Accept string (from Android JSON) or object
    if (typeof message === 'string') {
      try {
        message = JSON.parse(message);
      } catch (e) {
        console.warn('[gengage:native-bridge] Failed to parse message:', message);
        return;
      }
    }

    var type = message.type;
    var payload = message.payload;
    var controller = getController();

    switch (type) {
      case 'openChat':
        if (controller) {
          controller.openChat(payload);
        } else {
          console.warn('[gengage:native-bridge] openChat: overlay not initialized');
        }
        break;

      case 'closeChat':
        if (controller) {
          controller.closeChat();
        } else {
          console.warn('[gengage:native-bridge] closeChat: overlay not initialized');
        }
        break;

      case 'updateContext':
        if (controller && payload) {
          controller.updateContext(payload);
        } else {
          console.warn('[gengage:native-bridge] updateContext: overlay not initialized or no payload');
        }
        break;

      case 'updateSku':
        if (controller && payload && payload.sku) {
          controller.updateSku(payload.sku, payload.pageType);
        } else {
          console.warn('[gengage:native-bridge] updateSku: overlay not initialized or missing sku');
        }
        break;

      case 'setSession':
        // Inject session identity before widget init (or update after)
        if (payload) {
          if (payload.sessionId) {
            window.__gengageSessionId = payload.sessionId;
            try {
              sessionStorage.setItem('gengage_session_id', payload.sessionId);
            } catch (_) {
              // sessionStorage may be unavailable in some WebView configs
            }
          }
          if (payload.userId) {
            if (!window.gengage) window.gengage = {};
            if (!window.gengage.session) window.gengage.session = {};
            window.gengage.session.userId = payload.userId;
          }
        }
        break;

      case 'destroy':
        if (controller) {
          controller.destroy();
        }
        break;

      default:
        // Forward unknown messages via postMessage for CommunicationBridge
        window.postMessage(
          { gengage: 'native', type: type, payload: payload },
          window.location.origin
        );
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  window.gengageNative = {
    env: env,
    sendToNative: sendToNative,
    receive: receive,
  };
})();

/**
 * Gengage Native WebView Bridge
 *
 * Auto-initializing bridge between Gengage widgets and native iOS/Android apps.
 * Load this script synchronously BEFORE widget initialization.
 *
 * Outbound (widget -> native):
 *   - Intercepts gengage:bridge:message CustomEvents from CommunicationBridge
 *   - Intercepts typed gengage:* CustomEvents from the event bus
 *   - Routes through webkit.messageHandlers (iOS), GengageNative (Android),
 *     or ReactNativeWebView (React Native)
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
    if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
      return 'react-native';
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
    } else if (env === 'react-native') {
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
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

  var queuedCommands = [];
  var MAX_QUEUED_COMMANDS = 32;
  var controllerRef = getController();

  function getController() {
    return window.gengage && window.gengage.overlay ? window.gengage.overlay : null;
  }

  function resolveController() {
    if (controllerRef) return controllerRef;
    controllerRef = getController();
    if (controllerRef) {
      flushQueued(controllerRef);
    }
    return controllerRef;
  }

  function parseMessage(raw) {
    if (typeof raw === 'string') {
      var trimmed = raw.trim();
      if (!trimmed) return null;
      if (trimmed[0] !== '{' && trimmed[0] !== '[') {
        return { type: trimmed };
      }
      try {
        raw = JSON.parse(trimmed);
      } catch (e) {
        console.warn('[gengage:native-bridge] Failed to parse message:', raw);
        return null;
      }
    }

    if (!raw || typeof raw !== 'object') return null;
    var type = raw.type || raw.command || raw.action || raw.event;
    if (!type || typeof type !== 'string') return null;
    var payload = raw.payload;
    if (payload === undefined && raw.data !== undefined) payload = raw.data;
    if (type === 'setSession' && payload === undefined && (raw.sessionId || raw.userId)) {
      payload = { sessionId: raw.sessionId, userId: raw.userId };
    }
    return payload === undefined ? { type: type } : { type: type, payload: payload };
  }

  function queueCommand(command) {
    if (queuedCommands.length >= MAX_QUEUED_COMMANDS) queuedCommands.shift();
    queuedCommands.push(command);
  }

  function flushQueued(controller) {
    if (!controller || queuedCommands.length === 0) return;
    var pending = queuedCommands.slice();
    queuedCommands = [];
    pending.forEach(function (cmd) {
      receive(cmd);
    });
  }

  function setController(controller) {
    controllerRef = controller || getController();
    flushQueued(controllerRef);
  }

  function receive(message) {
    var parsed = parseMessage(message);
    if (!parsed) {
      console.warn('[gengage:native-bridge] Invalid message:', message);
      return;
    }

    var type = parsed.type;
    var payload = parsed.payload;
    var controller = resolveController();

    switch (type) {
      case 'openChat':
        if (controller) {
          controller.openChat(payload);
        } else {
          queueCommand(parsed);
        }
        break;

      case 'closeChat':
        if (controller) {
          controller.closeChat();
        } else {
          queueCommand(parsed);
        }
        break;

      case 'updateContext':
        if (controller && payload) {
          controller.updateContext(payload);
        } else if (!controller) {
          queueCommand(parsed);
        } else {
          console.warn('[gengage:native-bridge] updateContext: missing payload');
        }
        break;

      case 'updateSku':
        if (controller && typeof payload === 'string' && payload.length > 0) {
          controller.updateSku(payload, 'pdp');
        } else if (controller && payload && payload.sku) {
          controller.updateSku(payload.sku, payload.pageType);
        } else if (!controller) {
          queueCommand(parsed);
        } else {
          console.warn('[gengage:native-bridge] updateSku: missing sku');
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

  // Flush queued native commands once chat is initialized and controller exists.
  window.addEventListener('gengage:chat:ready', function () {
    setController(getController());
  });

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  window.gengageNative = {
    env: env,
    sendToNative: sendToNative,
    receive: receive,
    setController: setController,
  };
})();

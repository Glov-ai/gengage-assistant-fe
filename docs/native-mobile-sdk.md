# Native Mobile SDK Guide

This guide covers direct Android/iOS app integration with `@gengage/assistant-fe/native`.

## What You Get

- One WebView overlay that hosts chat + QNA + simrel widgets.
- Inbound native commands (`openChat`, `closeChat`, `updateContext`, `updateSku`, `setSession`, `destroy`).
- Outbound widget/native events through JSON messages.
- Pre-ready command queue: native commands sent before overlay init are replayed after controller attach.
- Mobile-safe defaults in `initNativeOverlayWidgets(...)`:
  - `onAddToCart` and `onProductNavigate` auto-forward to native bridge messages.
  - QNA/SimRel auto-disable when no mount exists (avoids noisy mount warnings).
  - If QNA/SimRel are explicitly enabled but mount is missing, a default mount is auto-created.

## Runtime Bridge Targets

The bridge auto-detects these interfaces:

- iOS `window.webkit.messageHandlers.gengage.postMessage`
- Android `window.GengageNative.postMessage`
- React Native `window.ReactNativeWebView.postMessage`

## Typed SDK Exports

`@gengage/assistant-fe/native` also exports:

- `DEFAULT_NATIVE_TRACKED_EVENTS` for default outbound event subscription.
- `NativeInboundMessage` type for accepted app -> widget command names.
- `NativeTrackedEvent` type for `trackedEvents` override safety.

## WebView HTML Bootstrap

Use either:

- `demos/native/index.html` as a reference template, or
- your own HTML with `initNativeOverlayWidgets(...)`.

Minimal bootstrap:

```html
<div id="gengage-qna"></div>
<div id="gengage-simrel"></div>
<script type="module">
  import { initNativeOverlayWidgets } from 'https://cdn.jsdelivr.net/npm/@gengage/assistant-fe/dist/native.js';

  await initNativeOverlayWidgets({
    accountId: 'yatasbeddingcomtr',
    middlewareUrl: 'https://YOUR_MIDDLEWARE_URL',
    locale: 'tr',
    pageContext: { pageType: 'pdp', sku: '1066800' },
    qna: { mountTarget: '#gengage-qna' },
    simrel: { mountTarget: '#gengage-simrel' },
  });
</script>
```

## Native -> WebView Commands

Send JSON to `window.gengageNative.receive(...)`:

```json
{ "type": "openChat", "payload": { "state": "full" } }
```

Also supported (for simpler native integrations):

- Plain command string: `"openChat"`
- Envelope aliases: `{ "command": "updateSku", "data": "1066800" }`
- `updateSku` payload can be either object or string:
  - `{ "type": "updateSku", "payload": { "sku": "1066800", "pageType": "pdp" } }`
  - `{ "type": "updateSku", "payload": "1066800" }`
- `setSession` shorthand:
  - `{ "action": "setSession", "sessionId": "s1", "userId": "u1" }`

Supported `type` values:

- `openChat`
- `closeChat`
- `updateContext`
- `updateSku`
- `setSession`
- `destroy`

## WebView -> Native Events

Native receives JSON messages with shape:

```json
{
  "type": "widget_event",
  "payload": {
    "event": "gengage:chat:open",
    "detail": { "state": "full" }
  }
}
```

Bridge messages emitted by widgets:

- `widget_event` for typed `gengage:*` events
- `bridge_message` for `gengage:bridge:message` payloads
- `ready` after `initNativeOverlayWidgets(...)` completes

## Recommended App Flow

1. Create or restore app user/session IDs.
2. Inject `setSession` before opening chat.
3. Keep a single WebView instance across PDP navigations.
4. Call `updateSku` instead of recreating the full overlay on each PDP.
5. Listen for `addToCart` + `productNavigate` bridge messages (already forwarded by default).
6. Optionally listen to `widget_event` stream for analytics and behavior telemetry.

## iOS WKWebView (Swift)

Use `WKScriptMessageHandler` with the `gengage` message handler name.

```swift
import UIKit
import WebKit

final class GengageViewController: UIViewController, WKScriptMessageHandler {
  private var webView: WKWebView!

  override func viewDidLoad() {
    super.viewDidLoad()

    let contentController = WKUserContentController()
    contentController.add(self, name: "gengage")

    let config = WKWebViewConfiguration()
    config.userContentController = contentController

    webView = WKWebView(frame: .zero, configuration: config)
    webView.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(webView)
    NSLayoutConstraint.activate([
      webView.topAnchor.constraint(equalTo: view.topAnchor),
      webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
    ])

    // Load native demo or your own hosted WebView HTML.
    webView.load(URLRequest(url: URL(string: "https://YOUR_WEBVIEW_HTML_URL")!))
  }

  deinit {
    webView?.configuration.userContentController.removeScriptMessageHandler(forName: "gengage")
  }

  // Receives outbound messages from window.webkit.messageHandlers.gengage.postMessage(...)
  func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
    guard message.name == "gengage", let body = message.body as? [String: Any] else { return }
    let type = body["type"] as? String ?? ""
    let payload = body["payload"] as? [String: Any]

    switch type {
    case "ready":
      sendToWidget(["type": "setSession", "payload": ["sessionId": "ios-session", "userId": "ios-user"]])
      sendToWidget(["type": "openChat", "payload": ["state": "full"]])
    case "addToCart":
      // payload: { sku, quantity, cartCode }
      break
    case "productNavigate":
      // payload: { url, sku, sessionId }
      break
    case "widget_event":
      // payload: { event, detail }
      break
    default:
      break
    }
  }

  // Sends inbound commands to window.gengageNative.receive(...)
  private func sendToWidget(_ command: [String: Any]) {
    guard
      let data = try? JSONSerialization.data(withJSONObject: command),
      let json = String(data: data, encoding: .utf8)
    else { return }

    let js = "window.gengageNative && window.gengageNative.receive(\(json));"
    webView.evaluateJavaScript(js, completionHandler: nil)
  }

  // Example: update the PDP SKU without reloading the WebView.
  func updateSku(_ sku: String) {
    sendToWidget(["type": "updateSku", "payload": ["sku": sku, "pageType": "pdp"]])
  }
}
```

## Android WebView (Kotlin)

Use `addJavascriptInterface` with the default interface name: `GengageNative`.

```kotlin
import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject

class GengageActivity : AppCompatActivity() {
  private lateinit var webView: WebView

  @SuppressLint("SetJavaScriptEnabled")
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    webView = WebView(this)
    setContentView(webView)

    webView.settings.javaScriptEnabled = true
    webView.settings.domStorageEnabled = true
    webView.webViewClient = WebViewClient()
    webView.webChromeClient = WebChromeClient()

    webView.addJavascriptInterface(NativeBridge(), "GengageNative")
    webView.loadUrl("https://YOUR_WEBVIEW_HTML_URL")
  }

  override fun onDestroy() {
    webView.removeJavascriptInterface("GengageNative")
    super.onDestroy()
  }

  inner class NativeBridge {
    // Receives outbound messages from window.GengageNative.postMessage(...)
    @JavascriptInterface
    fun postMessage(raw: String) {
      val msg = JSONObject(raw)
      val type = msg.optString("type")
      val payload = msg.optJSONObject("payload")

      when (type) {
        "ready" -> {
          sendToWidget(
            JSONObject()
              .put("type", "setSession")
              .put("payload", JSONObject().put("sessionId", "android-session").put("userId", "android-user"))
          )
          sendToWidget(JSONObject().put("type", "openChat").put("payload", JSONObject().put("state", "full")))
        }
        "addToCart" -> {
          // payload: { sku, quantity, cartCode }
        }
        "productNavigate" -> {
          // payload: { url, sku, sessionId }
        }
        "widget_event" -> {
          // payload: { event, detail }
        }
      }
    }
  }

  // Sends inbound commands to window.gengageNative.receive(...)
  private fun sendToWidget(command: JSONObject) {
    runOnUiThread {
      val js = "window.gengageNative && window.gengageNative.receive(${command});"
      webView.evaluateJavascript(js, null)
    }
  }

  // Example: update the PDP SKU without recreating WebView.
  fun updateSku(sku: String) {
    sendToWidget(
      JSONObject()
        .put("type", "updateSku")
        .put("payload", JSONObject().put("sku", sku).put("pageType", "pdp"))
    )
  }
}
```

## Practical Notes

- You can safely send commands before initialization finishes; they are queued and replayed once overlay is ready.
- Keep one WebView instance alive across PDP navigation and call `updateSku` for fast transitions.
- `ready` is the best hook to send `setSession` and initial `openChat`/`updateSku`.

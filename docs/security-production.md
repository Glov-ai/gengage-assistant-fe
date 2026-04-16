# Production Security Guide

This guide covers security configuration for deploying the Gengage Assistant widgets in production. Follow these steps before going live.

## 1. postMessage Origin Restriction

The communication bridge (`CommunicationBridge`) accepts host ↔ widget messages via `window.postMessage`. **By default, it only accepts messages from the same origin (`location.origin`).** This is secure for the standard deployment where the widget runs directly on the host page.

### Cross-Origin Configuration

If your setup requires cross-origin iframe communication (e.g., a portal on a different
domain needs to control the chat widget), explicitly list the allowed origins:

```js
const chat = new GengageChat();
chat.init({
  accountId: 'your-account',
  middlewareUrl: 'https://chat.gengage.ai',
  allowedOrigins: [
    'https://www.yoursite.com',
    'https://portal.yoursite.com',
  ],
  // ...
});
```

For GTM deployments, add origins in the config object:

```html
<script>
window.gengageConfig = {
  version: '1',
  accountId: 'your-account',
  middlewareUrl: 'https://chat.gengage.ai',
  allowedOrigins: ['https://www.yoursite.com'],
};
</script>
```

> **Do not use `allowedOrigins: ['*']` in production.** Wildcard origins allow any
> cross-origin iframe (ads, trackers) to trigger widget actions including backend API calls.

### How It Works

- The bridge validates `event.origin` against the allowedOrigins array
- Default is `[location.origin]` — same-origin only
- Wildcard `*` disables origin checking entirely (not recommended for production)
- Messages with non-matching origins are silently dropped
- Shape validation (`{ gengage: string, type: string }`) provides a second layer of defense

## 2. Content Security Policy (CSP)

When loading the SDK via CDN script tags, your CSP headers must allow the SDK source and its API connections.

### Recommended CSP Headers

```http
Content-Security-Policy:
  script-src 'self' https://unpkg.com https://cdn.jsdelivr.net;
  connect-src 'self' https://chat.gengage.ai https://chatbe-dev.gengage.ai;
  style-src 'self' 'unsafe-inline';
  img-src 'self' https: data:;
  media-src 'self' blob:;
  font-src 'self';
```

#### Breakdown

| Directive | Value | Reason |
|-----------|-------|--------|
| `script-src` | CDN domains | SDK IIFE bundle loaded from CDN |
| `connect-src` | Backend domains | NDJSON streaming + analytics |
| `style-src` | `'unsafe-inline'` | Shadow DOM style injection (CSS is inlined) |
| `img-src` | `https: data:` | Product images from merchant CDNs + data URIs |
| `media-src` | `blob:` | TTS audio playback uses blob URLs |

### Self-hosted Alternative

If your CSP policy prohibits CDN domains, self-host the IIFE bundle:

```bash
npm install @gengage/assistant-fe
cp node_modules/@gengage/assistant-fe/dist/chat.iife.js public/js/
```

Then adjust CSP to only allow `'self'` for `script-src`.

## 3. HTML Sanitization Boundaries

The SDK sanitizes all backend-generated HTML before rendering. Understanding the boundaries helps with security review.

### Where innerHTML Is Used

| Location | Source | Sanitized? | How |
|----------|--------|-----------|-----|
| Bot text messages | Backend `outputText` | Yes | `sanitizeHtml()` via DOMParser |
| KVKK consent banner | Backend `outputText` | Yes | Extracted then sanitized |
| SimRel `renderCard` | Customer override | **No** | Customer-provided HTML is trusted |
| Suggested action icons | Hardcoded SVGs | N/A | Static strings, not user input |

### sanitizeHtml() Rules

The sanitizer (`src/common/safe-html.ts`) applies:

- **Allowed tags**: `p`, `br`, `a`, `strong`, `em`, `ul`, `ol`, `li`, `h1`–`h6`, `span`, `div`, `table`, `img`, etc.
- **Disallowed tags** (removed entirely with children): `script`, `iframe`, `object`, `embed`, `form`, `input`, `style`, `link`, `meta`, `template`
- **Unknown tags**: unwrapped (children promoted to parent)
- **`<a>` tags**: forced to `target="_blank" rel="noopener noreferrer"`, only `http://` / `https://` / `mailto:` protocols
- **`<img>` tags**: only `https://` sources allowed
- **`style` attributes**: allowlisted CSS properties only, dangerous values (`url()`, `expression()`, `javascript:`, `-moz-binding`) stripped
- **`javascript:` protocol**: stripped from all attribute values

### XSS Review Checklist

When adding new features that render dynamic content:

1. Does it use `innerHTML`? → Pass through `sanitizeHtml()` first
2. Does it set `img.src`? → Validate with `isSafeImageUrl()` first
3. Does it set `a.href`? → Validate with `isSafeUrl()` first
4. Does it accept customer HTML overrides? → Document the XSS risk in code and in `docs/customization.md`

## 4. Production Bridge Configuration

Complete example for a production deployment:

```js
import { GengageChat } from '@gengage/assistant-fe/chat';

const chat = new GengageChat();
await chat.init({
  accountId: 'your-account',
  middlewareUrl: 'https://chat.gengage.ai',

  // Security
  allowedOrigins: [
    'https://www.yoursite.com',
    'https://yoursite.com',
  ],

  // Mount
  mountTarget: '#gengage-chat',

  // Page context
  pageContext: {
    pageType: 'pdp',
    sku: '12345',
  },
});
```

### GTM Production Tag

```html
<script src="https://unpkg.com/@gengage/assistant-fe@latest/dist/chat.iife.js"></script>
<script>
(function() {
  var chat = new window.Gengage.GengageChat();
  chat.init({
    accountId: 'your-account',
    middlewareUrl: 'https://chat.gengage.ai',
    allowedOrigins: ['https://www.yoursite.com']
  });
})();
</script>
```

## 5. Security Checklist

Before going live, verify:

- [ ] `allowedOrigins` is not set to `['*']` (same-origin default is secure; only set explicit origins if cross-origin iframes need access)
- [ ] CSP headers allow the SDK source and API endpoints
- [ ] No custom `renderCard` overrides use unsanitized user input
- [ ] Backend middleware URL points to production (`chat.gengage.ai`), not dev
- [ ] HTTPS is enforced on all origins in `allowedOrigins`
- [ ] `img.src` values from your product catalog use HTTPS

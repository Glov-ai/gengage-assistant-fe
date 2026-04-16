# Gengage AI Assistant — Frontend SDK

[![npm](https://img.shields.io/npm/v/@gengage/assistant-fe)](https://www.npmjs.com/package/@gengage/assistant-fe)
[![tests](https://img.shields.io/badge/tests-passing-brightgreen)]()
[![license](https://img.shields.io/badge/license-source--available-blue)](LICENSE)

Embeddable AI shopping assistant widgets for e-commerce — **chat**, **contextual Q&A**, **similar products**, and an optional **find-similar PDP image overlay** — built with vanilla TypeScript, zero framework dependencies.

> Backend services require a [gengage.ai](https://gengage.ai) subscription.
> See [LEGAL.md](./LEGAL.md) and [TRADEMARKS.md](./TRADEMARKS.md).

---

## Choose Your Integration

### CDN Script Tag (fastest)

```html
<script src="https://unpkg.com/@gengage/assistant-fe/dist/chat.iife.js"></script>
<script>
  const chat = new window.Gengage.GengageChat();
  chat.init({
    accountId: 'YOUR_ACCOUNT_ID',
    middlewareUrl: 'https://YOUR_BACKEND_URL',
  });
</script>
```

### npm / ES Module

```bash
npm install @gengage/assistant-fe
```

```ts
import { GengageChat, bootstrapSession } from '@gengage/assistant-fe';

const chat = new GengageChat();
await chat.init({
  accountId: 'mystore',
  middlewareUrl: 'https://YOUR_BACKEND_URL',
  session: { sessionId: bootstrapSession() },
});
```

### Google Tag Manager

```html
<script type="module">
  import { initOverlayWidgets } from 'https://cdn.jsdelivr.net/npm/@gengage/assistant-fe/dist/index.js';

  await initOverlayWidgets({
    accountId: 'YOUR_ACCOUNT_ID',
    middlewareUrl: 'https://YOUR_BACKEND_URL',
    sku: window.productSku,
    pageContext: { pageType: 'pdp' },
    chat: { variant: 'floating' },
    qna: { mountTarget: '#qna-section' },
    simrel: { mountTarget: '#similar-products' },
    simbut: { mountTarget: '#product-gallery' },
  });
</script>
```

### Mobile WebView (Android / iOS / React Native)

```ts
import { initNativeOverlayWidgets, applyNativeSession } from '@gengage/assistant-fe/native';

applyNativeSession({ sessionId: 'native-session-id', userId: 'native-user-id' });

const { controller, bridge } = await initNativeOverlayWidgets({
  accountId: 'YOUR_ACCOUNT_ID',
  middlewareUrl: 'https://YOUR_BACKEND_URL',
  pageContext: { pageType: 'pdp', sku: '12345' },
  chat: { variant: 'floating', mobileInitialState: 'full' },
});
```

See [docs/native-mobile-sdk.md](docs/native-mobile-sdk.md) for iOS WKWebView, Android WebView, and React Native examples.

---

## Widgets

| Widget | Import | What it does |
|--------|--------|-------------|
| **Chat** | `@gengage/assistant-fe/chat` | Floating AI drawer with streaming responses, product cards, comparison tables |
| **QNA** | `@gengage/assistant-fe/qna` | Contextual action buttons for product pages |
| **SimRel** | `@gengage/assistant-fe/simrel` | AI-powered similar/related product grid |
| **SimBut** | `@gengage/assistant-fe/simbut` | PDP image-overlay pill that opens a `findSimilar` flow for the current product |
| **Native** | `@gengage/assistant-fe/native` | Android/iOS WebView bridge + overlay bootstrap |

---

## Customization

**Theme tokens** — no fork required:
```ts
chat.init({
  theme: { primaryColor: '#f27a1a', headerBg: '#1a1a2e' },
});
```

**Component overrides** — swap any UI component via the json-render registry.

**SimBut customization** — use theme tokens, `i18n.findSimilarLabel`, and `onFindSimilar` for the PDP image-overlay pill.

**Full fork** — replace `src/chat/components/` entirely; keep `catalog.ts` + `index.ts`.

See [docs/customization.md](docs/customization.md) for the fork and merchant-customization playbook.

---

## Development

```bash
npm install
npm run dev -- koctascomtr --sku=1000465056   # Local dev server with HMR
npm run typecheck                              # TypeScript strict check
npm run test                                   # Unit tests
npm run build                                  # Build to dist/
npm run catalog                                # Visual component catalog at :3002
npm run docs:build                             # Build contributor docs with VitePress
```

**Using a local backend:**

```bash
npm run dev -- koctascomtr --sku=1000465056 --backend-url=http://localhost:7860
```

The default backend is `https://chatbe-dev.gengage.ai`. You can also set it via the `MIDDLEWARE_URL` environment variable:

```bash
MIDDLEWARE_URL=http://localhost:7860 npm run dev -- koctascomtr --sku=1000465056
```

---

## Documentation

| Doc | Description |
|-----|-------------|
| [Docs Index](docs/index.md) | Full documentation map |
| [API Reference](docs/api-reference.md) | Public entry points and config surfaces |
| [Architecture](docs/architecture.md) | System design, widget lifecycle, data flows |
| [Wire Protocol](docs/wire-protocol.md) | Backend NDJSON streaming contract |
| [Customization](docs/customization.md) | CSS tokens, component overrides, XSS rules |
| [i18n](docs/i18n.md) | Locale resolution and string overrides |
| [Error Handling](docs/error-handling.md) | Offline, retry, and recovery behavior |
| [GTM Quickstart](docs/gtm-quickstart.md) | Copy-paste GTM embedding patterns |
| [Security](docs/security-production.md) | Production CSP, postMessage origins, sanitization |
| [Analytics](docs/analytics-contract.md) | Event taxonomy and attribution |
| [Mobile SDK](docs/native-mobile-sdk.md) | Android/iOS/React Native integration |
| [New Account](docs/new-account-guide.md) | Adding a new merchant demo |
| [AGENTS](AGENTS.md) | Coding-agent architecture and code-path index |
| [Contributing](CONTRIBUTING.md) | Shared SDK contribution workflow |

---

## Project Structure

```
src/
  common/     # Shared: types, NDJSON parser, event bus, sanitizer, utilities
  chat/       # Chat widget (GengageChat class + components)
  qna/        # QNA widget (GengageQNA class + components)
  simrel/     # Similar products widget (GengageSimRel class + components)
  simbut/     # PDP image overlay pill widget (GengageSimBut class)
  native/     # Native WebView bridge exports
demos/        # Merchant-branded demo pages and framework integration examples
catalog/      # Visual component catalog (mock data, no backend)
docs/         # Architecture, wire protocol, customization, analytics
tests/        # Vitest unit tests + Playwright E2E
```

---

## License

Licensed under the **GENGAGE FRONTEND SOURCE-AVAILABLE LICENSE v1.0** — see [LICENSE](LICENSE).

Backend services are proprietary and require a [gengage.ai](https://gengage.ai) subscription.

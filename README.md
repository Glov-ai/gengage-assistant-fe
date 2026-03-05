# gengage-assistant-fe

Source-available frontend widgets for the **Gengage AI Assistant** — embeddable chat,
contextual Q&A buttons, and a similar-products grid.

> **Note:** This repo contains UI and client-side logic only.
> Backend services are proprietary and require a [gengage.ai](https://gengage.ai) subscription.
> Use/deployment is intended for Registered Gengage customers connecting to their Gengage backend.

> **Legal:** See [LEGAL.md](./LEGAL.md) and [TRADEMARKS.md](./TRADEMARKS.md) for
> service-access restrictions, branding disclaimers, and license boundaries.

---

## Widgets

| Widget | Import path | Description |
|--------|------------|-------------|
| **Chat** | `@gengage/assistant-fe/chat` | Floating AI chat drawer with streaming responses |
| **QNA** | `@gengage/assistant-fe/qna` | Contextual action buttons for product pages |
| **SimRel** | `@gengage/assistant-fe/simrel` | Similar / related product grid |
| **Native Bridge** | `@gengage/assistant-fe/native` | Android/iOS WebView bridge + native-ready overlay bootstrap |

> **`middlewareUrl` is required.** Set it in your initialization script to point to your
> Gengage backend. The SDK has no built-in default — you must always provide it explicitly.

---

## Quick Start (CDN embed)

```html
<script>
  window.__gengageSessionId =
    sessionStorage.getItem('gengage_session_id') ?? crypto.randomUUID();
  sessionStorage.setItem('gengage_session_id', window.__gengageSessionId);
</script>
<script src="https://cdn.gengage.ai/widgets/latest/chat.iife.js"></script>
<script>
  const chat = new GengageChat();
  chat.init({
    accountId: 'YOUR_ACCOUNT_ID',
    middlewareUrl: 'https://YOUR_MIDDLEWARE_URL',
    session: { sessionId: window.__gengageSessionId },
    theme: { primaryColor: '#3b82f6' },
  });
</script>
```

## Quick Start (ES module)

```bash
npm install @gengage/assistant-fe
```

```ts
import { GengageChat, GengageQNA, GengageSimRel, bootstrapSession, wireQNAToChat } from '@gengage/assistant-fe';

const sessionId = bootstrapSession();
const middlewareUrl = 'https://YOUR_MIDDLEWARE_URL';

const chat = new GengageChat();
await chat.init({
  accountId: 'mystore',
  middlewareUrl,
  session: { sessionId },
});

// On PDP pages — mount QNA buttons and similar products
const qna = new GengageQNA();
await qna.init({
  accountId: 'mystore',
  middlewareUrl,
  mountTarget: '#qna-section',
  pageContext: { pageType: 'pdp', sku: currentSku },
  session: { sessionId },
});

const simrel = new GengageSimRel();
await simrel.init({
  accountId: 'mystore',
  middlewareUrl,
  sku: currentSku,
  mountTarget: '#similar-section',
  session: { sessionId },
  onAddToCart: ({ sku }) => myCart.add(sku),
});

wireQNAToChat();   // auto-wires QNA button clicks → chat.openWithAction()
```

## GTM / Overlay Bootstrap (idempotent, no iframe)

```html
<script type="module">
  import { initOverlayWidgets } from 'https://cdn.jsdelivr.net/npm/@gengage/assistant-fe/dist/index.js';

  await initOverlayWidgets({
    accountId: 'koctascomtr',
    middlewareUrl: '<ASSISTANT-BACKEND-URL>',
    sku: window.productSku,
    pageContext: { pageType: 'pdp' },
    chat: {
      variant: 'floating',
      mobileBreakpoint: 992,
      mobileInitialState: 'half',
    },
    qna: {
      mountTarget: '#koctas-qna-section',
    },
    simrel: {
      mountTarget: '#koctas-similar-products',
    },
  });
</script>
```

`initOverlayWidgets()` is safe to call multiple times from GTM; it de-duplicates by idempotency key.

## Native WebView SDK (Android / iOS)

Use the native helper package to bridge widget events with:
- iOS WKWebView (`webkit.messageHandlers`)
- Android `JavascriptInterface` (`window.GengageNative.postMessage`)
- React Native WebView (`window.ReactNativeWebView.postMessage`)

```ts
import { initNativeOverlayWidgets, applyNativeSession } from '@gengage/assistant-fe/native';

applyNativeSession({
  sessionId: 'native-session-id',
  userId: 'native-user-id',
});

const { controller, bridge } = await initNativeOverlayWidgets({
  accountId: 'yatasbeddingcomtr',
  middlewareUrl: 'https://YOUR_MIDDLEWARE_URL',
  locale: 'tr',
  pageContext: { pageType: 'pdp', sku: '1066800' },
  chat: {
    variant: 'floating',
    mobileInitialState: 'full',
  },
  qna: { mountTarget: '#gengage-qna' },
  simrel: { mountTarget: '#gengage-simrel' },
});

// Optional manual command from JS side:
bridge.receive({ type: 'openChat', payload: { state: 'full' } });
```

Inbound native commands supported by `bridge.receive(...)`:
`openChat`, `closeChat`, `updateContext`, `updateSku`, `setSession`, `destroy`.

Mobile SDK defaults (out-of-box):
- Commands received before overlay init are queued and replayed after controller is ready.
- `onAddToCart` and `onProductNavigate` auto-forward to native bridge messages if not provided.
- QNA/SimRel are auto-disabled when no mount exists (no noisy mount warnings).
- If QNA/SimRel are explicitly enabled but mount is missing, a default mount is auto-created.

Supported shorthand command envelopes:

```ts
bridge.receive('openChat');
bridge.receive({ command: 'updateSku', data: '1066800' } as unknown as { type: string });
bridge.receive({ action: 'setSession', sessionId: 's1', userId: 'u1' } as unknown as { type: string });
```

### React Native (`react-native-webview`) host example

```tsx
import React, { useMemo } from 'react';
import { WebView } from 'react-native-webview';

const NATIVE_HTML = `
<!doctype html>
<html>
  <body>
    <div id="gengage-qna"></div>
    <div id="gengage-simrel"></div>
    <script type="module">
      import { initNativeOverlayWidgets } from 'https://cdn.jsdelivr.net/npm/@gengage/assistant-fe/dist/native.js';
      await initNativeOverlayWidgets({
        accountId: 'yatasbeddingcomtr',
        middlewareUrl: 'https://YOUR_MIDDLEWARE_URL',
        pageContext: { pageType: 'pdp', sku: '1066800' },
      });
    </script>
  </body>
</html>`;

export function GengageNativeOverlay() {
  const injectedJavaScript = useMemo(
    () =>
      `window.gengageNative && window.gengageNative.receive(${JSON.stringify({
        type: 'setSession',
        payload: { sessionId: 'native-session-id', userId: 'native-user-id' },
      })}); true;`,
    [],
  );

  return (
    <WebView
      originWhitelist={['*']}
      source={{ html: NATIVE_HTML }}
      injectedJavaScript={injectedJavaScript}
      onMessage={(event) => {
        // event.nativeEvent.data is JSON from window.ReactNativeWebView.postMessage(...)
        const message = JSON.parse(event.nativeEvent.data);
        console.log('gengage-native-event', message);
      }}
    />
  );
}
```

---

## Repository Structure

```
gengage-assistant-fe/
├── src/
│   ├── common/            # Shared types, NDJSON stream parser, event bus, BaseWidget
│   ├── chat/              # Chat widget
│   │   ├── catalog.ts     # json-render component schemas (Zod)
│   │   ├── types.ts       # Config interface + domain types
│   │   ├── index.ts       # Public class GengageChat
│   │   └── components/    # Vanilla TS renderers (ChatDrawer, AITopPicks, etc.)
│   ├── qna/               # QNA widget (same structure)
│   ├── simrel/            # Similar Products widget (same structure)
│   ├── native/            # Native WebView bridge helper exports
│   └── index.ts           # Barrel export
├── demos/
│   ├── koctascomtr/       # Koçtaş branded PDP (inline config)
│   ├── arcelikcomtr/      # Arçelik branded PDP
│   ├── n11com/            # N11 branded PDP
│   ├── yatasbeddingcomtr/ # Yataş Bedding branded PDP
│   ├── hepsiburadacom/    # Hepsiburada branded PDP
│   ├── vanilla-script/    # IIFE script tags, no bundler
│   ├── vanilla-esm/       # ESM import, Vite-served
│   ├── react/             # React CDN + IIFE bundles
│   ├── nextjs/            # Next.js integration guide
│   └── native/            # Mobile WebView overlay
├── catalog/                # Visual component catalog (no backend needed)
│   ├── index.html          # SPA shell
│   ├── vite.config.ts      # Resolves @gengage/assistant-fe → src/
│   └── src/                # Router, layout, mock data, sections
├── scripts/
│   └── dev.ts             # Dev server entry point (npm run dev)
├── docs/
│   ├── architecture.md    # System design and data flows
│   ├── wire-protocol.md   # Backend ↔ frontend NDJSON contract
│   ├── config-files.md    # File-based account configuration contract
│   └── analytics-contract.md # Analytics + attribution event contract
└── tests/                 # Vitest unit tests + Playwright E2E
```

---

## npm Scripts

| Command | Description |
|---------|-------------|
| `npm run dev -- <demo> [--sku=SKU] [--port=3000] [--backend-url=URL]` | Start local dev server for any demo |
| `npm run dev -- --client=<demo> [--sku=SKU] [--port=3000] [--backend-url=URL]` | Same as above, using named demo flag |
| `npm run kill` | Kill zombie listeners on ports 3000-3010 |
| `npm run format` | Prettier + ESLint fix + `typecheck` + `typecheck:catalog` |
| `npm run dev -- koctascomtr --sku=1000465056` | Example: Koçtaş PDP with SKU 1000465056 |
| `npm run dev -- n11com --sku=ABC123 --port=3005` | Custom port |
| `npm run dev -- --client=yatasbeddingcomtr --sku=1066800 --backend-url=https://staging.example.com` | Demo alias + backend override |
| `npm run build` | Build all widgets to `dist/` |
| `npm run typecheck` | TypeScript strict check (no emit) |
| `npm run typecheck:catalog` | TypeScript check for `catalog/` |
| `npm run lint` | ESLint `src/` |
| `npm run test` | Vitest unit tests |
| `npm run test:e2e` | Playwright smoke tests |
| `npm run catalog` | Visual component catalog at `http://localhost:3002` |
| `npm run docs:dev` | VitePress docs server |

### `npm run dev` — Local Widget Test Server

The dev server serves `demos/<demo>/index.html` with HMR and supports optional query
injection via CLI flags (`--sku`, `--backend-url`). It also supports `--client=<demo>`
as an alias for the positional demo argument.

```
── Gengage Dev Server ──────────────────────────────
  Demo:     koctascomtr
  SKU:        1234567
  Backend:  https://staging.example.com
  URL:      http://localhost:3000?sku=1234567&middlewareUrl=https%3A%2F%2Fstaging.example.com
────────────────────────────────────────────────────
```

The page shows:
- A dev info banner with all context values
- A realistic PDP scaffold (gallery, summary, tabs, recommendation rails)
- The QNA widget mounted at the account's expected selector (for example `#koctas-qna-section`, `#arcelik-qna-section`, `#n11-qna-section`)
- The SimRel widget mounted at the account's expected selector (for example `#koctas-similar-products`, `#arcelik-similar-products`, `#n11-similar-products`)
- The Chat floating launcher

HMR is active — editing `src/` files updates the page without a full reload.

> The dev server serves the selected demo page from `demos/<demo>/index.html`,
> and keeps query options sticky if you open `/` directly.

### Component Catalog (`npm run catalog`)

A visual catalog that renders every component with mock data — no backend needed.
`npm run catalog` already runs `npm run build` first.

```bash
npm run catalog    # Serves at :3002 (and builds first)
```

Open `http://localhost:3002` to see:

- **25+ components** grouped by widget (Chat, QNA, SimRel) in realistic frames
- **Global theme selector** — switch between 12 merchant color presets (Koçtaş, n11, Hepsiburada, Trendyol, etc.)
- **Chat components** shown inside a chat-drawer frame (dark header, avatar, message area)
- **QNA components** shown inside a PDP-like frame (product title, price)
- **SimRel components** shown inside a product section frame ("Benzer Ürünler" header)
- **Full Widgets** section with mock fetch backend (NDJSON interception)
- **Theme Comparison** — same component rendered across all 12 merchant themes
- **Responsive Preview** — mobile / tablet / desktop viewport frames

The catalog lives in `catalog/` and is excluded from npm publish (`files` publishes `dist/`, `README.md`, and `LICENSE`).

---

## Customization

Three levels — no fork required for themes, fork required for components:

1. **Theme tokens** — pass a `theme` object to `init()` (CSS custom properties)
2. **Component overrides** — replace entries in `components/registry.tsx`
3. **Full replacement** — replace all of `components/` (keep `catalog.ts` + `index.ts`)

See [CUSTOMIZATION-GUIDE.md](CUSTOMIZATION-GUIDE.md) for details, examples, and fork/customize/deploy guidance.

Reference account implementations are in `demos/`. Koçtaş (`demos/koctascomtr/`)
is the fully-wired reference. Copy it as a starting point for a new account.

---

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/architecture.md](docs/architecture.md) | System design, data flows, json-render integration |
| [docs/wire-protocol.md](docs/wire-protocol.md) | Backend ↔ frontend NDJSON contract |
| [docs/config-files.md](docs/config-files.md) | File-driven self-service account configuration |
| [docs/analytics-contract.md](docs/analytics-contract.md) | Stream/token/metering/history/checkout analytics contract |
| [docs/native-mobile-sdk.md](docs/native-mobile-sdk.md) | Android/iOS/React Native WebView integration guide |
| [CUSTOMIZATION-GUIDE.md](CUSTOMIZATION-GUIDE.md) | Fork/customize/deploy playbook for integrators and coding agents |
| [CONTRIBUTION-GUIDE.md](CONTRIBUTION-GUIDE.md) | SDK/core development guide for contributors and coding agents |

---

## License

Licensed under the **GENGAGE FRONTEND SOURCE-AVAILABLE LICENSE v1.0** — see [LICENSE](LICENSE).

Backend services are proprietary and require a separate [gengage.ai](https://gengage.ai) subscription.
They are not covered by this license.

For trademark and account-design disclaimers, see [TRADEMARKS.md](./TRADEMARKS.md).

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

const chat = new GengageChat();
await chat.init({ accountId: 'mystore', session: { sessionId } });

// On PDP pages — mount QNA buttons and similar products
const qna = new GengageQNA();
await qna.init({
  accountId: 'mystore',
  mountTarget: '#qna-section',
  pageContext: { pageType: 'pdp', sku: currentSku },
  session: { sessionId },
});

const simrel = new GengageSimRel();
await simrel.init({
  accountId: 'mystore',
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
│   ├── vite.config.ts      # Resolves @gengage/assistant-fe → dist/
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
| `npm run dev -- <accountId> <sku>` | Start local dev server in PDP mode for an account + SKU |
| `npm run kill` | Kill zombie listeners on ports 3000-3010 |
| `npm run prerequisites:check` | Validate kickoff prerequisites (docs/config/schema/action routing) |
| `npm run dev -- koctascomtr --sku=1000465056` | Example: Koçtaş PDP with SKU 1000465056 |
| `npm run dev -- n11com --sku=ABC123 --port=3005` | Custom port |
| `npm run build` | Build all widgets to `dist/` |
| `npm run typecheck` | TypeScript strict check (no emit) |
| `npm run lint` | ESLint `src/` |
| `npm run test` | Vitest unit tests |
| `npm run test:e2e` | Playwright smoke tests |
| `npm run catalog` | Visual component catalog at `http://localhost:3002` |
| `npm run docs:dev` | VitePress docs server |

### `npm run dev` — Local Widget Test Server

The dev server spins up an account-aware PDP host shell with all three widgets initialised
for the given account and SKU. Every invocation generates fresh UUIDs printed to the console:

Current focus is PDP mode (`product details`) with a concrete SKU.
PLP mode (`category / sku-list`) is planned and will be added as a separate harness flow.

```
── Gengage Dev Server ──────────────────────────────
  Account:    koctascomtr
  SKU:        1234567
  Page type:  pdp
  Session ID: 550e8400-e29b-41d4-a716-446655440000
  User ID:    6ba7b810-9dad-11d1-80b4-00c04fd430c8
  View ID:    6ba7b811-9dad-11d1-80b4-00c04fd430c8
  URL:        http://localhost:3000
────────────────────────────────────────────────────
```

The page shows:
- A dev info banner with all context values
- A realistic PDP scaffold (gallery, summary, tabs, recommendation rails)
- The QNA widget mounted at the account's expected selector (for example `#koctas-qna-section`, `#arcelik-qna-section`, `#n11-qna-section`)
- The SimRel widget mounted at the account's expected selector (for example `#koctas-similar-products`, `#arcelik-similar-products`, `#n11-similar-products`)
- The Chat floating launcher

HMR is active — editing `src/` files updates the page without a full reload.

> The dev server serves the account's demo page from `demos/<accountId>/index.html`,
> generating fresh session/user/view IDs on each start.

### Component Catalog (`npm run catalog`)

A visual catalog that renders every component with mock data — no backend needed.
Imports from `dist/` (validates the npm package as consumers would see it).

```bash
npm run build && npm run catalog    # Build first, then serve at :3002
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

The catalog lives in `catalog/` and is excluded from npm publish (`files: ["dist/"]`).

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
| [CUSTOMIZATION-GUIDE.md](CUSTOMIZATION-GUIDE.md) | Fork/customize/deploy playbook for integrators and coding agents |
| [CONTRIBUTION-GUIDE.md](CONTRIBUTION-GUIDE.md) | SDK/core development guide for contributors and coding agents |

---

## License

Licensed under the **GENGAGE FRONTEND SOURCE-AVAILABLE LICENSE v1.0** — see [LICENSE](LICENSE).

Backend services are proprietary and require a separate [gengage.ai](https://gengage.ai) subscription.
They are not covered by this license.

For trademark and account-design disclaimers, see [TRADEMARKS.md](./TRADEMARKS.md).

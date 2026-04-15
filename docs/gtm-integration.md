# GTM Embedding Prerequisites

This checklist is for client sites that inject widgets via GTM/custom script tags.

## Recommended Runtime API

Use `initOverlayWidgets()` from `@gengage/assistant-fe` as the GTM entry point.
It is idempotent and safe across repeated tag executions.

```ts
import { initOverlayWidgets } from '@gengage/assistant-fe';

await initOverlayWidgets({
  accountId: 'your-account',
  middlewareUrl: '<ASSISTANT-BACKEND-URL>',
  pageContext: { pageType: 'pdp', sku: '12345' },
  chat: { variant: 'floating', mobileBreakpoint: 992, mobileInitialState: 'half' },
  qna: { mountTarget: '#gengage-qna' },
  simrel: { mountTarget: '#gengage-simrel' },
   simbut: { mountTarget: '#product-gallery' },
});
```

## Required Before Hydration

1. Define where each widget mounts:
   - chat launcher target (or body-floating),
   - qna container selector,
   - simrel container selector,
   - optional simbut image-wrapper selector (`position: relative` wrapper around the PDP image).
2. Define load order and idempotency:
   - script may execute multiple times in GTM,
   - widget init must be guarded against duplicate mount,
   - use config-driven `idempotencyKey` when multiple accounts share a page (default: `__gengageWidgetsInit`).
3. Define context source:
   - page type,
   - sku,
   - optional price/category/url metadata.
4. Define session bootstrap strategy shared by all injected pieces:
   - `session_id`, `correlation_id`, `view_id`, optional `user_id`.
5. Confirm CORS and CSP allow backend and analytics domains from production origin(s).

## NDJSON Action/Event Handling Contract

Some streamed events are not renderable widgets and should trigger host actions.

Minimum host-handled actions:
- route-to-url/navigation,
- add-to-basket/add-to-cart (callback receives `{ sku, cartCode, quantity }` — quantity is user-selectable via stepper, default 1),
- open/close chat.

Optional (recommended when you own wishlist/favorites):
- favorites header + product heart via `onFavoritesClick`, `addCallback('gengage-product-favorite', …)`, and/or `gengage:chat:product-favorite` / bridge `productFavorite` — see **Customization → Favorites integration**.

Recommended:
- generic script-call handler registry keyed by action name,
- fallback handler for unknown actions (log + no-op, never crash stream).

## GTM Runtime Safeguards

1. Initialization should be resilient to delayed DOM mount targets.
2. Re-init on SPA route change should update context, not duplicate widgets.
3. Failures in one widget should not block others.
4. Analytics calls must be fire-and-forget and never block user interaction.

## Analytics (Planned Endpoint)

Treat analytics ingestion as available during implementation:
- default planned path: `/analytics` (or account-configured equivalent),
- transport: `sendBeacon` preferred, `fetch keepalive` fallback,
- non-blocking, retry-limited behavior,
- if endpoint fails, do not affect chat/qna/simrel/simbut UX.

## GA Data Layer Integration

`wireGADataLayer()` from `src/common/ga-datalayer.ts` connects Gengage widget events
to `window.dataLayer` in GA4 format. Call it once after widgets are initialized:

```ts
import { wireGADataLayer } from '@gengage/assistant-fe';

const unsubscribe = wireGADataLayer();

// Later, if you need to tear down:
unsubscribe();
```

All 19 event names are `gengage-` prefixed for easy filtering in GA dashboards:

| Event | Trigger |
|-------|---------|
| `gengage-on-init` | Widget icon/avatar displayed |
| `gengage-show` | Widget opened |
| `gengage-hide` | Widget closed |
| `gengage-suggested-question` | User clicked a suggested action |
| `gengage-find-similars` | User clicked "Find Similar" |
| `gengage-compare-preselection` | User pre-selected a product for comparison |
| `gengage-compare-selected` | User submitted comparison |
| `gengage-compare-clear` | User cleared comparison |
| `gengage-compare-received` | Comparison results rendered |
| `gengage-like-product` | User liked/favorited a product |
| `gengage-like-list` | User clicked favorites list |
| `gengage-search` | Product list / search results displayed |
| `gengage-product-detail` | User clicked a product to view details |
| `gengage-cart-add` | User added a product to cart |
| `gengage-message-sent` | User sent a chat message |
| `gengage-message-received` | Assistant responded |
| `gengage-conversation-start` | User started a new conversation |
| `gengage-voice-input` | User used voice input |
| `gengage-error` | Widget or stream error |

When `window.dataLayer` is not available (GA not loaded), events fall back to
`console.debug` for local debugging. The return value is an unsubscribe function
that removes all event listeners — use it for cleanup in SPA unmount or test teardown.

## Session Persistence in GTM

IndexedDB-based session persistence works in GTM context. Session IDs are stable
across page loads as long as the same origin is used. GTM tags that inject widgets
should not reset or override `session_id` between navigations — the SDK handles
session continuity automatically via IndexedDB.

## Acceptance Signals

1. GTM tag can be published without manual page-code edits.
2. Widgets initialize exactly once per page view.
3. NDJSON streams render widgets and execute host actions correctly.
4. Unknown action events are observed and safely ignored or delegated.
5. Analytics dispatch does not impact rendering or interaction latency.

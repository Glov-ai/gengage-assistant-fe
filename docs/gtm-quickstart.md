# GTM Quickstart

Three copy-paste patterns to get Gengage widgets running on your site.
All three use `initGengageClient()` — a single function that validates your config,
runs preflight checks, and initialises all enabled widgets.

> **Power-user API:** `initOverlayWidgets()` is still available for callers
> who build options programmatically. `initGengageClient()` is a convenience
> wrapper that reads a JSON runtime config and calls `initOverlayWidgets()`
> internally.

---

## Pattern 1: GTM Custom HTML Tag

Paste this into a **Custom HTML** tag in Google Tag Manager.
Set the trigger to **DOM Ready** (or **All Pages** if your config sets
`gtm.requireDomReady: true` — the SDK handles idempotency either way).

```html
<script type="module">
  import { initGengageClient } from 'https://cdn.jsdelivr.net/npm/@gengage/assistant-fe/dist/index.js';

  await initGengageClient({
    runtimeConfig: {
      version: '1',
      accountId: 'YOUR_ACCOUNT_ID',
      middlewareUrl: '<ASSISTANT-BACKEND-URL>',
      widgets: {
        chat:   { enabled: true },
        qna:    { enabled: true },
        simrel: { enabled: true },
      },
      mounts: {
        chat:   'body',
        qna:    '#gengage-qna',
        simrel: '#gengage-simrel',
      },

      // Optional: heartbeat polling
      enableHeartbeat: true,

      // Optional: price formatting
      pricing: { currencySymbol: 'TL', currencyPosition: 'suffix' },
    },
  });

  // Optional: GA data layer wiring — pushes all widget events to window.dataLayer
  // import { wireGADataLayer } from 'https://cdn.jsdelivr.net/npm/@gengage/assistant-fe/dist/index.js';
  // const unsubGA = wireGADataLayer(); // call after widgets init
</script>
```

That is the absolute minimum. The SDK fills in sensible defaults for every
field not shown above (transport, analytics, GTM guards, action handling).

> **DOM-ready requirement:** When injected via GTM, the mount-target elements
> (`#gengage-qna`, `#gengage-simrel`) must exist in the DOM before the tag
> fires. Use a DOM Ready trigger, or place `<div id="gengage-qna"></div>` and
> `<div id="gengage-simrel"></div>` in your page template.

---

## Pattern 2: Direct Script Embed

Add this to your page HTML (outside GTM). Place the mount targets wherever
you want the QNA and SimRel widgets to appear.

```html
<!-- Mount targets — place these where you want the widgets -->
<div id="gengage-qna"></div>
<div id="gengage-simrel"></div>

<script type="module">
  import { initGengageClient } from 'https://cdn.jsdelivr.net/npm/@gengage/assistant-fe/dist/index.js';

  await initGengageClient({
    runtimeConfig: {
      version: '1',
      accountId: 'YOUR_ACCOUNT_ID',
      middlewareUrl: '<ASSISTANT-BACKEND-URL>',
      widgets: {
        chat:   { enabled: true },
        qna:    { enabled: true },
        simrel: { enabled: true },
      },
      mounts: {
        chat:   'body',
        qna:    '#gengage-qna',
        simrel: '#gengage-simrel',
      },

      // Optional: heartbeat polling
      enableHeartbeat: true,

      // Optional: price formatting
      pricing: { currencySymbol: 'TL', currencyPosition: 'suffix' },
    },

    // SPA context resolver (optional — see below)
    contextResolver: () => ({
      pageType: 'pdp',
      sku: document.querySelector('[data-sku]')?.dataset.sku,
    }),

    // Host-action callbacks (optional — see below)
    hostActions: {
      onAddToCart: ({ sku, quantity, cartCode }) => {
        // quantity is user-selectable via stepper (default: 1)
        console.log('Add to cart:', sku, quantity);
        // wire into your cart system
      },
      onProductNavigate: (url, sku, sessionId) => {
        window.location.href = url;
      },
    },
  });

  // Optional: GA data layer wiring
  // import { wireGADataLayer } from 'https://cdn.jsdelivr.net/npm/@gengage/assistant-fe/dist/index.js';
  // const unsubGA = wireGADataLayer(); // call after widgets init
</script>
```

---

## Pattern 3: npm / ES Module Import

```bash
npm install @gengage/assistant-fe
```

```ts
import { initGengageClient, wireGADataLayer } from '@gengage/assistant-fe';
import runtimeConfig from './gengage-config.json';

const controller = await initGengageClient({
  runtimeConfig,
  // runtimeConfig can include optional fields:
  //   enableHeartbeat: true,
  //   pricing: { currencySymbol: 'TL', currencyPosition: 'suffix' },

  contextResolver: () => ({
    pageType: router.currentRoute.meta.pageType,
    sku: router.currentRoute.params.sku,
  }),

  hostActions: {
    onAddToCart: ({ sku, quantity, cartCode }) => {
      // quantity is user-selectable via stepper (default: 1)
      store.dispatch('cart/add', { sku, quantity, cartCode });
    },
    onProductNavigate: (url, sku, sessionId) => {
      router.push(url);
    },
    onScriptCall: (name, payload) => {
      console.log('Backend script-call action:', name, payload);
    },
  },
});

// Optional: wire GA data layer after init
const unsubGA = wireGADataLayer();

// After SPA navigation, tell widgets the context changed:
router.afterEach(() => {
  window.dispatchEvent(new CustomEvent('gengage:context:update'));
});
```

When `contextResolver` is provided, the SDK listens for
`gengage:context:update` events on `window` and calls your resolver to get
the latest page context. This keeps widget state in sync with SPA routing
without manual `controller.updateContext()` calls.

---

## Context Resolver (SPA support)

On single-page apps, pages change without a full reload. Provide a
`contextResolver` function that returns the current page context:

```ts
contextResolver: () => ({
  pageType: router.currentRoute.meta.pageType ?? 'other',
  sku: router.currentRoute.params.sku,
  price: productStore.currentPrice,
  categoryTree: productStore.breadcrumbs,
}),
```

Then dispatch the update event on every route change:

```ts
router.afterEach(() => {
  window.dispatchEvent(new CustomEvent('gengage:context:update'));
});
```

The SDK calls your resolver, diffs the context, and tells each widget to
re-fetch data for the new page.

---

## Host Actions

Host actions let the SDK call back into your site for cart, navigation, and
custom backend-triggered actions:

```ts
hostActions: {
  // Called when the user clicks "Add to Cart" on a product card.
  // quantity is user-selectable via the stepper UI (default: 1).
  onAddToCart: ({ sku, quantity, cartCode }) => {
    myCart.add(sku, quantity);
  },

  // Called when the user clicks a product card to navigate
  onProductNavigate: (url, sku, sessionId) => {
    window.location.href = url;
  },

  // Called for backend-initiated script-call actions
  onScriptCall: (name, payload) => {
    if (name === 'track_conversion') analytics.track(payload);
  },
}
```

All three callbacks are optional. When omitted, the SDK uses safe defaults
(navigation via `window.location.href`, no-op for cart and script calls).

---

## Preflight Diagnostics

By default (`preflight: true`), `initGengageClient()` runs checks before
mounting widgets:

| Check | Severity | What it means |
|-------|----------|---------------|
| **INVALID_SELECTOR** | error | A mount selector is not valid CSS. Init aborts. |
| **MOUNT_NOT_FOUND** | warn | A mount target element is not in the DOM yet. The widget skips or waits. |
| **DUPLICATE_IDEMPOTENCY** | warn | `window["__gengageWidgetsInit"]` already exists — widgets may have already initialized. |

Errors throw. Warnings are logged to the console but do not block init.

To skip preflight (e.g. in a controlled SSR environment):

```ts
await initGengageClient({
  runtimeConfig: config,
  preflight: false,
});
```

---

## Idempotency

`initGengageClient()` is safe to call multiple times. The underlying overlay
system uses an idempotency key (default: `__gengageWidgetsInit`) to detect
duplicate initializations. On the second call with the same config, the SDK
returns the existing controller instance without re-mounting widgets.

This is critical for GTM where tags can fire multiple times per page view.

---

## Full Runtime Config Reference

The snippets above show minimal configs. For complete working examples with
inline configs (transport, analytics, GTM guards, action handling, theme
tokens), see any account demo:

- `demos/koctascomtr/index.html` — reference implementation
- `demos/vanilla-esm/index.html` — minimal ESM embed

The runtime config schema is validated by `src/common/config-schema.ts`.

---

## Related Docs

- [gtm-integration.md](gtm-integration.md) — GTM prerequisites and action-handling contract
- [config-files.md](config-files.md) — File-driven account configuration
- [customization.md](customization.md) — Theme tokens and component overrides
- [wire-protocol.md](wire-protocol.md) — Backend NDJSON streaming contract

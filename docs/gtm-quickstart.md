# GTM Quickstart

Three copy-paste patterns to get Gengage widgets running on your site.
All three use `initGengageClient()` — a single function that validates your config,
runs preflight checks, and initialises all enabled widgets, including optional SimBut mounts.

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
        simbut: { enabled: true },
      },
      mounts: {
        chat:   'body',
        qna:    '#gengage-qna',
        simrel: '#gengage-simrel',
        simbut: '#product-gallery',
      },

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
> (`#gengage-qna`, `#gengage-simrel`, `#product-gallery`) must exist in the DOM before the tag
> fires. Use a DOM Ready trigger, or place `<div id="gengage-qna"></div>` and
> `<div id="gengage-simrel"></div>` in your page template. `#product-gallery`
> should be the existing, relatively positioned PDP image wrapper.

---

## Pattern 2: Direct Script Embed

Add this to your page HTML (outside GTM). Place the mount targets wherever
you want the QNA and SimRel widgets to appear, and point SimBut at the PDP image wrapper.

```html
<!-- Mount targets — place these where you want the widgets -->
<div id="gengage-qna"></div>
<div id="gengage-simrel"></div>
<div id="product-gallery" style="position: relative; width: 320px;">
  <img src="https://placehold.co/640x640/f5f5f5/1d1d1f?text=Product+Image" alt="Product" style="display: block; width: 100%; height: auto;" />
</div>

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
        simbut: { enabled: true },
      },
      mounts: {
        chat:   'body',
        qna:    '#gengage-qna',
        simrel: '#gengage-simrel',
        simbut: '#product-gallery',
      },

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

## Opening Chat with a SKU or Initial Text

By default, the chat widget opens empty and waits for user input. You can
optionally auto-open with a specific product or pre-filled query.

### Auto-open on a product page (SKU init)

When the page context includes a `sku`, the widget automatically sends a
`launchSingleProduct` request on first open:

```ts
await initGengageClient({
  runtimeConfig: { /* ... */ },
  contextResolver: () => ({
    pageType: 'pdp',
    sku: '1000465056',  // product SKU from your page data
  }),
});
```

### Send an initial text message on open

To pre-fill and auto-send a message when the chat opens:

```ts
const controller = await initGengageClient({
  runtimeConfig: { /* ... */ },
});

// Open the chat and send an initial query
controller.chat?.open();
controller.chat?.sendMessage('Show me kitchen tables');
```

### Open via event bus (loose coupling)

If you don't have a reference to the controller, use the event bus:

```ts
// Open the chat drawer
window.dispatchEvent(new CustomEvent('gengage:chat:open'));

// Send a message programmatically
window.dispatchEvent(new CustomEvent('gengage:chat:send', {
  detail: { text: 'I need help choosing a product' }
}));
```

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

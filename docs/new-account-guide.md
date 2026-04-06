# Build Your Own Account Demo

Step-by-step guide for creating a new account demo in `gengage-assistant-fe`.

Each account demo is a single self-contained HTML file in `demos/<accountId>/index.html`.
It contains inline CSS for host-page branding, inline JS that calls `initOverlayWidgets()`
with all configuration, and HTML mount points for the QNA and SimRel widgets. No separate
config files, no factory functions, no build step.

---

## Prerequisites

- Node.js 18+ and npm installed
- A Gengage API key (get one at https://gengage.ai)
- Your account ID (e.g. `mystorecom`)

```bash
git clone https://github.com/nicespace/gengage-assistant-fe.git
cd gengage-assistant-fe
npm install
npm run typecheck  # Verify the build is clean
```

---

## Step 1: Copy an Existing Demo

The recommended template is `demos/koctascomtr/index.html`. Copy its directory:

```bash
mkdir -p demos/mystorecom
cp demos/koctascomtr/index.html demos/mystorecom/index.html
```

You now have a working demo. The rest of the steps customize it for your brand.

---

## Step 2: Update the `<style>` Block (Brand Colors)

Open `demos/mystorecom/index.html` and find the `:root` CSS custom properties near
the top of the `<style>` block. These control the host-page shell appearance (not the
widget theme — that is set in the `<script>` block):

```css
:root {
  --brand-primary: #2563eb;        /* Your primary brand color */
  --brand-secondary: #3b82f6;      /* Accent / hover shade */
  --brand-bg: #f6f6f6;             /* Page background */
  --brand-surface: #ffffff;         /* Card / panel background */
  --brand-text: #222222;            /* Primary text color */
  --brand-muted: #636363;           /* Secondary / muted text */
  --brand-border: #e6e6e6;          /* Card borders */
  --brand-font: "Inter", "Helvetica Neue", Arial, sans-serif;
}
```

These CSS variables are consumed by the host shell classes (`.host-topbar`, `.gallery-card`,
`.summary-card`, etc.) to give the demo page your brand look. The widget components
themselves are themed separately via the `theme` object in step 3.

Also update:

- The `<html lang="...">` attribute to match your locale (`tr`, `en`, etc.)
- The `<title>` to `Gengage Dev — mystorecom`

---

## Step 3: Update the `<script>` Block (Widget Configuration)

Find the `<script type="module">` at the bottom of the file. All widget configuration
lives here in a single `initOverlayWidgets()` call:

```html
<script type="module">
  import { initOverlayWidgets } from '@gengage/assistant-fe';

  const params = new URLSearchParams(location.search);
  const sku = params.get('sku') ?? undefined;

  // Populate dev header / breadcrumb with SKU
  const skuDisplay = sku ?? '—';
  document.getElementById('dev-sku').textContent = skuDisplay;
  document.getElementById('breadcrumb-sku').textContent = skuDisplay;
  document.getElementById('summary-sku').textContent = skuDisplay;

  const controller = await initOverlayWidgets({
    // ── Required ──
    accountId: 'mystorecom',
    middlewareUrl: '<ASSISTANT-BACKEND-URL>',

    // ── Locale ──
    locale: 'en',

    // ── Page context ──
    sku,
    pageContext: { pageType: sku ? 'pdp' : 'other', sku },

    // ── Widget theme ──
    theme: {
      // Standard WidgetTheme tokens
      primaryColor: '#2563eb',
      primaryForeground: '#ffffff',
      backgroundColor: '#ffffff',
      foregroundColor: '#1f2937',
      borderRadius: '8px',
      fontFamily: '"Inter", system-ui, sans-serif',
      fontSize: '14px',
      zIndex: '1000',

      // Additional CSS custom properties (passed through as-is)
      '--client-primary': 'hsl(221, 83%, 53%)',
      '--surface-page': '#F6F6F6',
      '--surface-card': '#fff',
      '--surface-shell': '#515151',
      '--text-inverse': '#e9ecf2',
      '--border-default': '#cccccc',
      '--text-primary': '#222',
    },

    // ── Chat widget ──
    chat: {
      variant: 'floating',
      mobileBreakpoint: 768,
      i18n: {
        inputPlaceholder: 'Search products, ask questions',
        poweredBy: 'MyStore AI Assistant',
      },
    },

    // ── QNA widget ──
    qna: {
      mountTarget: '#mystore-qna-section',
      ctaText: 'Ask something else',
    },

    // ── SimRel widget ──
    simrel: {
      mountTarget: '#mystore-similar-products',
    },

    // ── Optional: price formatting (defaults to Turkish) ──
    // pricing: { currencySymbol: 'TL', currencyPosition: 'suffix' },

    // ── Optional: KVKK consent (Turkish accounts) ──
    // kvkk: { message: 'Kişisel verileriniz...', linkUrl: '/kvkk', linkText: 'KVKK Aydınlatma Metni' },

    // ── Callbacks ──
    onAddToCart: (p) => {
      console.log('[mystore] add-to-cart', p);
      alert(`Added to cart: ${p.sku} (qty: ${p.quantity})`);
    },
    onProductNavigate: (url, prodSku, sid) => {
      controller.chat?.saveSession(sid ?? '', prodSku);
      window.location.href = url;
    },
  });

  document.getElementById('dev-session').textContent = controller.session.sessionId;
</script>
```

### Key options reference

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `accountId` | `string` | Yes | Your Gengage account identifier |
| `middlewareUrl` | `string` | Yes | Backend API base URL |
| `locale` | `string` | No | Language code (`'tr'`, `'en'`). Defaults to `'tr'` |
| `sku` | `string` | No | Current product SKU (from URL query string) |
| `pageContext` | `Partial<PageContext>` | No | Page type, SKU, price, category tree |
| `theme` | `WidgetTheme` | No | Standard tokens + arbitrary CSS custom properties |
| `chat` | `OverlayChatOptions` | No | Chat variant, breakpoint, i18n strings |
| `qna` | `OverlayQNAOptions` | No | Mount target selector, CTA text |
| `simrel` | `OverlaySimRelOptions` | No | Mount target selector, discount display type |
| `onAddToCart` | `(params) => void` | No | Callback when user adds a product from SimRel |
| `onProductNavigate` | `(url, sku, sessionId) => void` | No | Callback when user clicks a product card |

### WidgetTheme standard tokens

| Token | Example | Description |
|-------|---------|-------------|
| `primaryColor` | `'#2563eb'` | Brand primary color |
| `primaryForeground` | `'#ffffff'` | Text on primary color |
| `backgroundColor` | `'#ffffff'` | Widget background |
| `foregroundColor` | `'#1f2937'` | Primary text color |
| `borderRadius` | `'8px'` | Card/button corner radius |
| `fontFamily` | `'"Inter", sans-serif'` | Widget font stack |
| `fontSize` | `'14px'` | Base font size |
| `zIndex` | `'1000'` | Widget z-index layer |

Any additional keys on the `theme` object are passed through as CSS custom properties
(e.g. `'--client-primary': '#ec6e00'`). See `demos/koctascomtr/index.html` and
`demos/arcelikcomtr/index.html` for real-world examples of which `--client-*` and
`--surface-*` variables the renderer uses.

---

## Step 4: Update the HTML Body

### Dev header

Update the account name in the dev header:

```html
<p class="dev-header__title">Gengage Dev — mystorecom</p>
...
<span class="dev-header__item"><strong>account:</strong> <span>mystorecom</span></span>
```

### Host shell branding

Customize the store name, navigation items, breadcrumb, product title, and description
to match your brand. This is purely cosmetic — it makes the demo page look like your
real PDP so you can see the widgets in context.

### Widget mount points

The QNA and SimRel widgets need DOM elements to mount into. Their `id` attributes
must match the `mountTarget` selectors in the script block:

```html
<!-- QNA widget mount point -->
<div id="mystore-qna-section" class="qna-section"></div>

<!-- SimRel widget mount point -->
<section class="simrel-card">
  <h2 class="section-title">Similar Products</h2>
  <div id="mystore-similar-products" class="simrel-mount"></div>
</section>
```

The chat widget uses `variant: 'floating'` by default and renders its own launcher
button — it does not need a mount point in the HTML.

---

## Step 5: Preview Components (optional)

Before testing with a live backend, preview all widget components with the visual catalog:

```bash
npm run catalog    # http://localhost:3002 (builds first)
```

Use the global theme selector to see how your merchant's theme tokens look on every
component type (product cards, action buttons, comparison tables, etc.).

---

## Step 6: Test Locally

```bash
npm run dev -- mystorecom --sku=YOUR-SKU-123
```

This starts a Vite dev server with HMR at `http://localhost:3000`. You will see:

- The dev header at the top with session/account/SKU info
- Your branded PDP page shell
- The chat launcher in the bottom-right corner
- QNA and SimRel widgets in their mount points (on PDP pages with a valid SKU)

### Dev server options

```bash
npm run dev -- mystorecom --sku=ABC123              # Default port 3000
npm run dev -- mystorecom --sku=ABC123 --port=3005  # Custom port
npm run dev -- mystorecom                           # No SKU (non-PDP page)
npm run dev -- --client=mystorecom --sku=ABC123     # Named alias for demo
```

When no `--sku` is provided, the page loads as a non-PDP page and the QNA/SimRel
widgets will not render (they are PDP-only).

---

## Step 7: Embed on Your Production Site

The demo HTML shows exactly how the widgets are configured. When embedding on a real
site, you only need the `<script type="module">` block — the host page CSS and HTML
are already your existing site.

### Option A: Script Tag (simplest)

```html
<script type="module">
  import { initOverlayWidgets } from 'https://cdn.example.com/gengage-assistant-fe/dist/index.js';

  const controller = await initOverlayWidgets({
    accountId: 'mystorecom',
    middlewareUrl: '<ASSISTANT-BACKEND-URL>',
    locale: 'en',
    sku: '{{ product.sku }}',
    pageContext: { pageType: 'pdp', sku: '{{ product.sku }}' },
    theme: { /* your theme tokens */ },
    chat: { variant: 'floating', i18n: { inputPlaceholder: 'Ask a question...' } },
    qna: { mountTarget: '#mystore-qna' },
    simrel: { mountTarget: '#mystore-simrel' },
    onAddToCart: (params) => {
      yourCartAPI.add(params.sku, params.quantity, params.cartCode);
    },
  });
</script>
```

### Option B: GTM Container

See [gtm-integration.md](gtm-integration.md) for GTM-specific embedding patterns.

### Option C: SPA Router Hook

```js
import { initOverlayWidgets } from '@gengage/assistant-fe';

let controller = null;

router.afterEach(async (to) => {
  if (controller) {
    await controller.updateSku(to.params.sku, to.meta.pageType);
  } else {
    controller = await initOverlayWidgets({
      accountId: 'mystorecom',
      middlewareUrl: '<ASSISTANT-BACKEND-URL>',
      sku: to.params.sku,
      pageContext: { pageType: to.meta.pageType, sku: to.params.sku },
      theme: { /* ... */ },
      chat: { /* ... */ },
      qna: { mountTarget: '#mystore-qna' },
      simrel: { mountTarget: '#mystore-simrel' },
      onAddToCart: (params) => yourCartAPI.add(params.sku, params.quantity),
    });
  }
});
```

---

## Step 8: Customize Further

### Override widget rendering

Pass custom component renderers via the chat config:

```js
chat: {
  variant: 'floating',
  actionHandling: {
    registry: {
      ProductCard: ({ element, context }) => {
        const card = document.createElement('div');
        // Your custom product card rendering
        return card;
      },
    },
  },
},
```

### Disable a widget

Set `enabled: false` on any widget to skip it entirely:

```js
qna: { enabled: false },
simrel: { enabled: false },
```

### Listen for widget events on the host page

```js
// Add-to-cart from chat
window.addEventListener('gengage:chat:add-to-cart', (e) => {
  const { sku, cartCode, quantity } = e.detail;
  yourCartAPI.add(sku, quantity, cartCode);
});

// Open/close chat programmatically
controller.openChat();
controller.closeChat();

// Update SKU on SPA navigation
await controller.updateSku('NEW-SKU-789');
```

### Additional customization notes

- **Share button:** The share button appears automatically when a product has a URL. On
  desktop it copies the URL to clipboard; on mobile it invokes the native share sheet.
- **Voice input:** Enable voice input on the chat widget with `voiceEnabled: true` in
  the top-level config. Requires microphone permission from the user.
- **Theme defaults:** Define your account's theme tokens (primary color, font, border radius)
  directly in the demo's `initOverlayWidgets()` call. See existing demos for reference.

---

## File Reference

```
demos/mystorecom/
  index.html     # Single self-contained demo file:
                 #   - <style> block: host-page brand CSS vars
                 #   - <body>: mock PDP layout + widget mount divs
                 #   - <script>: initOverlayWidgets() with all config inline
```

Existing account demos to reference:

| Demo | Brand Colors | Notes |
|------|-------------|-------|
| `demos/koctascomtr/` | Orange `#ec6e00` | Best starting template. Turkish locale. |
| `demos/arcelikcomtr/` | Red `#d93131` | Shows `discountType: 'strike-through'` in SimRel. |
| `demos/n11com/` | Magenta `#ff44ef` | Marketplace layout variant. |
| `demos/hepsiburadacom/` | Orange | High-traffic marketplace demo. |
| `demos/yatasbeddingcomtr/` | Blue | Furniture e-commerce demo. |

See [customization.md](customization.md) for the full customization API reference.

# Customization Guide

This repo is designed to be forked. Customers own the frontend experience while Gengage owns the backend contract and assistant behavior.

## Who This Guide Is For

Use this guide when you are:

- adapting a merchant fork
- changing theme tokens, selectors, labels, or host callbacks
- wiring the SDK into GTM, a storefront shell, or a merchant demo
- implementing account-specific work while keeping shared logic centralized

If you are changing shared SDK architecture rather than merchant customization, use the root contributor guides and the docs index.

## Account Customization Workflow

1. Start from the closest existing demo under `demos/` or the current overlay config.
2. Change theme tokens, locale, mount selectors, widget options, and host callbacks first.
3. Only fork widget renderers when tokens and stable part selectors are not enough.
4. Move anything reusable into `src/common/` or the relevant widget core.
5. Validate in both the account dev shell and the component catalog.

Recommended commands:

```bash
npm run dev -- <accountId> --sku=<sku>
npm run catalog
```

## Where To Change What

| Path | Change Here When... |
|------|----------------------|
| `src/common/` | You are adding shared transport, overlay, analytics, config, or utility logic |
| `src/chat/`, `src/qna/`, `src/simrel/`, `src/simbut/` | You are changing shared widget behavior or reusable UI implementation |
| `demos/<accountId>/index.html` | You are changing merchant theme tokens, mount selectors, or host callback wiring |
| `catalog/` | You are validating or exposing components in the visual catalog |
| `tests/` | You are protecting shared behavior against regressions |

Rule: if two or more accounts need the same behavior, move it out of `demos/` and into shared SDK code.

## Centralization Rules

1. Shared abstractions go in `src/common/` or widget core first.
2. Do not add merchant-specific branching to core widget code.
3. Keep per-account files limited to brand tokens, mount selectors, i18n copy, widget overrides, and host callback wiring.
4. Export reusable additions through the public barrels when they are part of the supported API.

## Three Levels Of Customization

The safest customization path is tokens first, stable part selectors second, and renderer overrides only when structure or behavior must change.

### Recommended Public Styling Surface

Clients should treat the SDK styling API as:

1. `theme` tokens first
2. stable `data-gengage-part` selectors second
3. full renderer overrides only when structure or behavior must change

The SDK is gradually adopting an internal shared primitive layer (`.gds-*` classes), but those classes are not the preferred client-facing API and may continue to evolve.

### Use tokens first

Prefer overriding semantic and client tokens like:

```js
theme: {
  '--client-primary': '#b7102a',
  '--surface-card': '#ffffff',
  '--surface-card-soft': '#f8fafc',
  '--text-primary': '#111827',
  '--text-secondary': '#4b5563',
  '--border-default': 'rgba(17, 24, 39, 0.10)',
  '--radius-control': '12px',
  '--radius-card': '16px',
}
```

### Use stable part selectors when tokens are not enough

Supported hooks include selectors such as:

```css
[data-gengage-part='product-summary-card'] { ... }
[data-gengage-part='comparison-view-button'] { ... }
[data-gengage-part='qna-quick-question'] { ... }
[data-gengage-part='simrel-product-card'] { ... }
```

These selectors are intended to remain stable even if internal DOM composition changes.

### Avoid targeting implementation details

Avoid building customer themes around:

- `.gds-*` primitive classes
- deep widget-local classes inside widget CSS files
- exact internal DOM nesting

### Level 1 — Theme tokens (CSS custom properties)

No fork required. Pass a `theme` object to any widget's `init()`:

```js
await chatWidget.init({
  accountId: 'mystore',
  // ...
  theme: {
    primaryColor: '#e63946',
    primaryForeground: '#ffffff',
    borderRadius: '12px',
    fontFamily: '"Inter", sans-serif',
    backgroundColor: '#1a1a2e',
    foregroundColor: '#eaeaea',
  },
});
```

These are applied as CSS custom properties on the widget root element:

```css
--gengage-primary-color: #e63946;
--gengage-border-radius: 12px;
/* etc. */
```

The SDK also injects shared layout defaults (`DEFAULT_WIDGET_THEME_TOKENS`) so Chat, QNA, SimRel, and SimBut stay consistent across accounts unless you override them.

### Level 2 — Component overrides via json-render registry

Pass renderer overrides through widget config. No React is required.

```ts
await chatWidget.init({
  accountId: 'mystore',
  // ...
  renderer: {
    registry: {
      ProductCard: ({ element, context }) => {
        const card = document.createElement('article');
        card.className = 'my-chat-product-card';
        card.textContent = String((element.props?.product as { name?: string } | undefined)?.name ?? '');

        card.addEventListener('click', () => {
          const product = element.props?.product as { sku?: string; url?: string } | undefined;
          if (product?.sku && product.url) {
            context.onProductClick?.({ sku: product.sku, url: product.url });
          }
        });

        return card;
      },
    },
  },
});
```

The same renderer API exists for UISpec-driven widgets:

- `chat.init({ renderer })`
- `qna.init({ renderer })`
- `simrel.init({ renderer })`

`simbut` is a direct DOM overlay widget and does not expose `renderer.registry` or `renderUISpec`.

Each `renderer` supports:

- `registry`: override individual component renderers
- `unknownRenderer`: custom fallback for unknown component types
- `renderUISpec`: replace rendering methodology entirely

Use `createDefaultChatUISpecRegistry()`, `createDefaultQnaUISpecRegistry()`, and `createDefaultSimRelUISpecRegistry()` as baseline registries for partial overrides.

> **Beauty consulting components:** `PhotoAnalysisCard` and `BeautyPhotoStep` are registered in the default chat registry but are not overridable via `renderer.registry` during live streaming. The stream handler intercepts them for timing-critical rendering before the registry is consulted. Use i18n overrides or fork the feature module at `src/chat/features/beauty-consulting/` when you need deeper changes.

### Level 3 — Full widget replacement

Replace the entire visual layer while keeping API contracts stable:

- keep `catalog.ts` contracts compatible with backend responses
- keep widget lifecycle (`init`, `update`, `show`, `hide`, `destroy`) and transport semantics
- replace default renderer implementation, DOM output, and CSS as needed

## Component Catalog (Visual Preview)

Before customizing components, browse the visual catalog to see every component rendered with mock data. No backend is needed.

```bash
npm run catalog    # http://localhost:3002 (builds first)
```

The catalog shows all Chat, QNA, and SimRel UISpec components plus a live SimBut preview in realistic frames. Use it to validate overrides against the merchant presets shipped with the catalog.

## Demo Pages

The `demos/` directory contains self-contained merchant pages and integration examples. Each demo is a single `index.html` file with inline config, so teams can adjust real-world wiring without setting up a separate config system.

### Example merchant demos

```text
demos/
  koctascomtr/index.html
  arcelikcomtr/index.html
  n11com/index.html
  trendyolcom/index.html
  yatasbeddingcomtr/index.html
```

### Framework and integration demos

```text
demos/
  vanilla-script/index.html
  vanilla-esm/index.html
  react/index.html
  nextjs/index.html
  native/index.html
```

Each demo can embed Chat, QNA, SimRel, and, when needed, the optional SimBut PDP image overlay. `demos/n11com/index.html` shows the SimBut mount pattern.

Example inline configuration:

```html
<script type="module">
  import { initOverlayWidgets } from '@gengage/assistant-fe';

  initOverlayWidgets({
    accountId: 'koctascomtr',
    sku: '1000465056',
    locale: 'tr',
    theme: {
      primaryColor: '#ff6600',
      borderRadius: '8px',
    },
  });
</script>
```

## Validation Workflow

For merchant-specific work, validate in both environments:

1. Account shell: `npm run dev -- <accountId> --sku=<sku>`
2. Catalog: `npm run catalog`

Add `npm run test:e2e` when the change affects layout, interaction, or navigation behavior.

---

## HTML Sanitization in Chat Messages

The backend may send HTML markup in `text_chunk` content (e.g. KVKK notices with styled
`<div>`, `<p>`, and `<a>` tags). The chat widget renders assistant messages through a
DOMParser-based sanitizer (`src/common/safe-html.ts`) that:

- **Preserves** safe formatting tags: `p`, `br`, `a`, `strong`, `b`, `em`, `i`, `u`,
  `ul`, `ol`, `li`, `h1`-`h6`, `span`, `div`, `table`, `thead`, `tbody`, `tr`, `th`,
  `td`, `hr`, `code`, `pre`, `blockquote`, `img`, `sup`, `sub`.
- **Removes entirely** (children not promoted): `script`, `iframe`, `object`, `embed`,
  `form`, `input`, `textarea`, `select`, `button`, `style`, `link`, `meta`.
- **Unwraps** unknown elements (children promoted to parent).
- **Forces** `target="_blank"` and `rel="noopener noreferrer"` on all `<a>` tags.
- **Validates URLs:** `href` must start with `http://`, `https://`, or `mailto:`;
  `img src` must be `https://` only.
- **Strips** `javascript:` from any attribute value.
- **Allows** `style` only on `div`, `span`, `p`; `class` on any allowed tag.

**User messages** are always rendered with `textContent` (no HTML interpretation), so
typing `<b>test</b>` shows the literal tags.

To use the sanitizer in custom components:

```ts
import { sanitizeHtml } from '@gengage/assistant-fe';

element.innerHTML = sanitizeHtml(untrustedHtmlString);
```

> **Security:** `sanitizeHtml` is designed for backend-sourced assistant content.
> For user-generated content displayed outside the chat widget, consider additional
> measures such as DOMPurify.

---

## SimRel `renderCard` (Advanced / Vanilla JS)

For non-React environments, the SimRel widget supports a `renderCard` callback that
returns a raw HTML string:

```js
const simrel = new GengageSimRel();
await simrel.init({
  // ...
  renderCard: (product, index) => {
    // ⚠️ XSS WARNING: sanitize ALL user-controlled fields.
    // Product data comes from the Gengage backend but names/descriptions
    // may contain characters that could cause issues if not escaped.
    return `
      <article class="my-product-card">
        <img src="${escapeHtml(product.imageUrl ?? '')}" alt="${escapeHtml(product.name)}">
        <h3>${escapeHtml(product.name)}</h3>
        <p class="price">${escapeHtml(product.price ?? '')}</p>
        <a href="${escapeHtml(product.url)}">İncele</a>
      </article>
    `;
  },
});

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
```

> **Security:** Gengage provides no sanitization for `renderCard` output. You are
> responsible for escaping all dynamic content. Using `DOMPurify` is strongly recommended.

---

## i18n / Localization

The chat widget ships with Turkish (`tr`) and English (`en`) built in.
Override any string via the `i18n` config:

```js
await chatWidget.init({
  locale: 'tr',
  i18n: {
    inputPlaceholder: 'Sorunuzu yazın...',
    sendButton: 'Gönder',
    poweredBy: 'Gengage AI ile güçlendirildi',
  },
});
```

Beauty and watch consultant strings are also localizable:

```js
await chatWidget.init({
  locale: 'tr',
  i18n: {
    // Style variation picker
    beautyStylesPreparedTitle: 'Sizin için {count} farklı stil hazırladım',
    watchStylesPreparedTitle: 'Sizin için {count} farklı stil yönü hazırladım',
    consultingFallbackGroupLabel: 'Öneri',
    consultingFallbackStyleLabel: 'Stil {index}',
    consultingStyleLoadingDescription: 'Bu stil için ürünleri toplamaya devam ediyorum.',
    consultingStyleUnavailableDescription: 'Bu stil için şu anda yeterli ürün eşleşmesi çıkaramadım.',
    consultingStyleLoadingBadge: 'Yükleniyor',
    consultingStyleUnavailableBadge: 'Hazır değil',

    // BeautyPhotoStep — selfie upload prompt card
    beautyPhotoStepTitle: 'Selfie Paylaşın',
    beautyPhotoStepDescription: 'Cilt analizi için bir selfie yükleyin.',
    beautyPhotoStepUpload: 'Fotoğraf Yükle',
    beautyPhotoStepProcessing: 'Analiz ediliyor...',
    beautyPhotoStepSkip: 'Geç',

    // PhotoAnalysisCard — skin analysis badge
    photoAnalysisBadge: 'Cilt Analizi',
    photoAnalysisStrengthsLabel: 'One Cikanlar',
    photoAnalysisFocusLabel: 'Odak Noktalari',
    photoAnalysisCelebStyleLabel: 'Celeb Vibe Eslesmesi',
  },
});
```

`{count}` placeholder is replaced at runtime with the number of generated styles.

When `assistant_mode = beauty_consulting`, the floating compare prompt (`choicePrompter`) is intentionally suppressed to reduce distraction during guided consulting.

For full i18n replacement, add the locale to the relevant widget locale module (`src/chat/locales/`, `src/qna/locales/`, `src/simrel/locales/`, or `src/simbut/locales.ts`). See [i18n.md](./i18n.md) for the per-widget model.

---

## CSS Custom Properties Reference

| Property | Default | Description |
|----------|---------|-------------|
| `--gengage-primary-color` | `#3b82f6` | Buttons, links, accents |
| `--gengage-primary-foreground` | `#ffffff` | Text on primary color |
| `--gengage-background-color` | `#ffffff` | Widget background |
| `--gengage-foreground-color` | `#111827` | Primary text color |
| `--gengage-border-radius` | `0.75rem` | Border radius for cards/buttons |
| `--gengage-font-family` | `system-ui, sans-serif` | Font stack |
| `--gengage-font-size` | `14px` | Base font size |
| `--gengage-z-index` | `1000` | Chat widget z-index (CSS fallback: max-int if theme not applied) |
| `--gengage-chat-width` | `400px` | Floating chat drawer width |
| `--gengage-chat-launcher-size` | `56px` | Launcher button diameter |
| `--gengage-chat-launcher-bottom` | `20px` | Launcher distance from viewport bottom |
| `--gengage-chat-launcher-right` | `20px` | Launcher distance from viewport right |
| `--gengage-chat-shell-radius` | `1rem` | Floating chat drawer radius |
| `--gengage-chat-header-height` | `72px` | Chat header min-height |
| `--gengage-chat-conversation-width` | `396px` | Right rail width in panel mode |
| `--gengage-chat-panel-min-width` | `320px` | Left panel min width in panel mode |
| `--gengage-chat-panel-max-width` | `1200px` | Left panel max width in panel mode |
| `--gengage-chat-input-height` | `48px` | Chat input row control height |
| `--gengage-qna-pill-radius` | `999px` | QNA quick-action pill radius |
| `--gengage-qna-input-radius` | `0.75rem` | QNA input + send button radius |
| `--gengage-qna-pill-bg` | `var(--ds-button-primary-bg)` | QNA quick-action pill background |
| `--gengage-qna-pill-bg-hover` | `var(--ds-button-primary-bg-hover)` | QNA quick-action pill hover background |
| `--gengage-qna-pill-fg` | `var(--ds-button-primary-fg)` | QNA quick-action pill text color |
| `--gengage-qna-pill-border` | `var(--ds-button-primary-border)` | QNA quick-action pill border color |
| `--gengage-qna-pill-border-hover` | `var(--gengage-qna-pill-border)` | QNA quick-action pill hover border color |
| `--gengage-qna-input-bg` | `var(--ds-input-bg)` | QNA input shell background |
| `--gengage-qna-input-border` | `var(--ds-input-border)` | QNA input shell border color |
| `--gengage-qna-icon-color` | `var(--text-muted)` | QNA search icon color |
| `--gengage-qna-clear-color` | `var(--text-muted)` | QNA clear icon color |
| `--gengage-qna-send-color` | `var(--client-primary)` | QNA send icon active color |
| `--gengage-qna-send-color-disabled` | `color-mix(in srgb, var(--text-muted) 60%, transparent)` | QNA send icon inactive color |
| `--gengage-qna-action-icon-bg-hover` | `color-mix(in srgb, var(--client-primary) 10%, transparent)` | QNA icon button hover background |
| `--gengage-qna-action-icon-size` | `20px` | QNA clear/send icon size |
| `--gengage-simrel-card-radius` | `0.75rem` | Similar product card radius |
| `--gengage-keyboard-offset` | `0px` | iOS virtual keyboard offset (set via JS internally) |
| `--gengage-chat-header-bg` | `var(--surface-card)` → `#ffffff` | Chat header background (light by default; falls through design-system tokens) |
| `--gengage-chat-header-foreground` | `var(--text-primary)` → `#111827` | Chat header text (dark by default; falls through design-system tokens) |
| `--gengage-chat-panel-bg` | `#fff` | Product detail panel background color |
| `--gengage-chat-shadow` | `var(--shadow-3)` → `0 10px 24px rgba(16,24,40,.12)` | Floating drawer box-shadow |
| `--gengage-chat-offset` | `20px` | General spacing offset for the chat drawer |
| `--gengage-simrel-columns` | `4` | Number of columns in the similar products grid |

#### Semantic Color Tokens

These tokens provide fine-grained control over semantic colors used throughout the widgets.
They are optional — if not set, each falls back to a sensible default.

| Property | Default | Description |
|----------|---------|-------------|
| `--gengage-primary` | `#2563eb` | Alternate primary accent (active tabs, selected states) |
| `--gengage-primary-hover` | `#2563eb` | Primary color hover state |
| `--gengage-accent-primary` | `#3b82f6` | Accent color (blockquote borders, loading spinners) |
| `--gengage-text` | `#374151` | Body text color (category labels, grouping cards) |
| `--gengage-text-color` | `#1e293b` | Text color variant (search cards, comparison items) |
| `--gengage-text-primary` | `#1f2937` | Primary text emphasis |
| `--gengage-text-secondary` | `#64748b` | Secondary/muted text |
| `--gengage-text-muted` | `#64748b` | De-emphasized text (hints, timestamps) |
| `--gengage-bg` | `#fff` | Category/grouping card backgrounds |
| `--gengage-bg-hover` | `#f3f4f6` | Hover state backgrounds |
| `--gengage-bg-secondary` | `#f9fafb` | Secondary backgrounds (pros/cons panels) |
| `--gengage-surface-color` | `#f8fafc` | Card surfaces (search, comparison, grouping) |
| `--gengage-surface-secondary` | `#f3f4f6` | Secondary surface (assistant message bubbles) |
| `--gengage-surface-muted` | `#f8fafc` | Muted surface (skeleton loaders) |
| `--gengage-surface-dark` | `#1e293b` | Dark surface (offline bar) |
| `--gengage-border` | `#e2e8f0` | Generic border (loading spinners) |
| `--gengage-border-color` | `#e5e7eb` | Border color (cards, dividers, inputs) |
| `--gengage-hover-color` | `#f1f5f9` | Hover background for interactive cards |
| `--gengage-success-color` | `#16a34a` | Success state (in-stock, add-to-cart confirmation) |
| `--gengage-discount-color` | `#ef4444` | Discount text color |
| `--gengage-discount-bg` | `#ef4444` | Discount badge background |
| `--gengage-rating-color` | `#d97706` | Star rating color |
| `--gengage-chat-pill-bg` | `rgba(0,0,0,0.7)` | "Find Similar" pill background |
| `--gengage-chat-pill-text` | `#fff` | "Find Similar" pill text color |
| `--gengage-chat-promo-bg` | `#e8f5e9` | Promotional badge background |
| `--gengage-chat-promo-text` | `#2e7d32` | Promotional badge text |
| `--gengage-chat-launcher-mobile-bottom` | `16px` | Mobile launcher bottom offset |
| `--gengage-chat-launcher-mobile-right` | `16px` | Mobile launcher right offset |
### Share Button

The share button appears on the product detail panel. It copies the product URL to the
clipboard and shows a confirmation tooltip.

| Selector | Description |
|----------|-------------|
| `.gengage-chat-product-details-share` | Ghost icon button (36x36) |
| `.gengage-chat-product-details-share--copied::after` | Tooltip overlay showing a checkmark after clipboard copy |

### ProductSummaryCard

A compact horizontal card used for inline product mentions in assistant messages.

| Selector | Description |
|----------|-------------|
| `.gengage-chat-product-summary` | Compact horizontal card container |
| `.gengage-chat-product-summary__image` | Product thumbnail (64x64) |
| `.gengage-chat-product-summary__content` | Text content wrapper |
| `.gengage-chat-product-summary__name` | Product name |
| `.gengage-chat-product-summary__rating` | Star rating row |
| `.gengage-chat-product-summary__price` | Price container |
| `.gengage-chat-product-summary__price-original` | Strikethrough original price |
| `.gengage-chat-product-summary__price-current` | Current / discounted price |
| `.gengage-chat-product-summary__cta` | Call-to-action link |

### HandoffNotice

An alert banner rendered when the assistant hands off the conversation to a human agent.

| Selector | Description |
|----------|-------------|
| `.gengage-chat-handoff-notice` | Alert container |
| `.gengage-chat-handoff-notice-icon` | Leading icon element |
| `.gengage-chat-handoff-notice-heading` | Heading text (e.g. "Transferring to agent") |
| `.gengage-chat-handoff-notice-summary` | Summary / detail text |

---

## Component Override Cookbook

### Example 1: Custom product card with brand styling

```ts
await chatWidget.init({
  renderer: {
    registry: {
      ProductCard: ({ element, context }) => {
        const product = element.props?.product as Record<string, unknown> | undefined;
        const card = document.createElement('div');
        card.className = 'brand-product-card';
        card.innerHTML = `
          <img src="${product?.imageUrl ?? ''}" alt="" />
          <h4>${product?.name ?? ''}</h4>
          <span class="price">${product?.price ?? ''}</span>
        `;
        card.addEventListener('click', () => {
          const sku = product?.sku as string | undefined;
          const url = product?.url as string | undefined;
          if (sku && url) context.onProductClick?.({ sku, url });
        });
        return card;
      },
    },
  },
});
```

### Example 2: Custom action button with analytics

```ts
await chatWidget.init({
  renderer: {
    registry: {
      ActionButtons: ({ element, context }) => {
        const row = document.createElement('div');
        row.className = 'my-action-buttons';
        const buttons = (element.props?.buttons ?? []) as Array<{
          label: string;
          action: { title: string; type: string; payload?: unknown };
        }>;
        for (const btn of buttons) {
          const el = document.createElement('button');
          el.textContent = btn.label;
          el.addEventListener('click', () => {
            // Custom analytics before action
            myAnalytics.track('button_click', { label: btn.label });
            context.onAction(btn.action);
          });
          row.appendChild(el);
        }
        return row;
      },
    },
  },
});
```

### Example 3: Replace the typing indicator

```ts
await chatWidget.init({
  renderer: {
    registry: {
      TypingIndicator: () => {
        const el = document.createElement('div');
        el.className = 'my-typing';
        el.textContent = 'AI is thinking...';
        return el;
      },
    },
  },
});
```

### Example 4: Registering a new component type

```ts
import { createDefaultChatUISpecRegistry } from '@gengage/assistant-fe';

const registry = createDefaultChatUISpecRegistry();
// Add a custom component alongside defaults
registry.CustomBanner = ({ element }) => {
  const div = document.createElement('div');
  div.className = 'my-banner';
  div.textContent = String(element.props?.text ?? '');
  return div;
};

await chatWidget.init({
  renderer: { registry },
});
```

---

## Communication Bridge

The `CommunicationBridge` class (`src/common/communication-bridge.ts`) enables two-way
messaging between the host page and embedded widgets. The chat widget creates a bridge
automatically on init.

### Host → Widget (postMessage)

The host page sends commands to the widget via `window.postMessage`:

```js
// Open the chat drawer programmatically
window.postMessage({ gengage: 'chat', type: 'openChat' }, '*');

// Close the chat drawer programmatically
window.postMessage({ gengage: 'chat', type: 'closeChat' }, '*');
```

The message must have `{ gengage: '<namespace>', type: '<command>' }` shape. The `gengage`
field selects the target widget namespace (e.g. `'chat'`), and `type` selects the command.
An optional `payload` field carries additional data.

### Widget → Host (CustomEvent)

When the widget needs to communicate outward, it dispatches a `gengage:bridge:message`
CustomEvent on `window`:

```js
window.addEventListener('gengage:bridge:message', (e) => {
  const { namespace, type, payload } = e.detail;
  // namespace: 'chat' | 'qna' | etc.
  // type: 'addToCart' | 'navigate' | etc.
  // payload: action-specific data
  if (type === 'addToCart') {
    addToCart(payload.sku, payload.cartCode, payload.quantity);
  }
  if (type === 'productFavorite') {
    // sku, product, favorited, sessionId — mirror your REST API / wishlist here
  }
  if (type === 'navigate') {
    window.location.href = payload.url;
  }
});
```

The bridge automatically sends `'addToCart'` messages when a user clicks "Add to Cart"
in the chat panel, and `'navigate'` messages when the action router triggers navigation.

### Origin Security

By default the bridge accepts messages from any origin (`['*']`). To restrict accepted
origins, pass `allowedOrigins` when constructing the bridge:

```ts
new CommunicationBridge({
  namespace: 'chat',
  allowedOrigins: ['https://mystore.com'],
  onMessage: (msg) => { /* ... */ },
});
```

---

## Add-to-Cart Integration

Products displayed in the chat panel and in the SimRel widget can show "Add to Cart"
buttons. The add-to-cart event is delivered through three channels simultaneously.

### Chat Widget

When a user clicks "Add to Cart" on a product in the chat panel, the widget:

1. Dispatches a `gengage:chat:add-to-cart` CustomEvent on `window`:
   ```js
   window.addEventListener('gengage:chat:add-to-cart', (e) => {
     const { sku, cartCode, quantity, sessionId } = e.detail;
     // Add product to cart in your store
   });
   ```

2. Sends an `'addToCart'` message through the CommunicationBridge (see above).

3. Fires an analytics event internally for attribution tracking.

### SimRel Widget

The SimRel widget supports an `onAddToCart` callback:

```js
await simrelWidget.init({
  // ...
  onAddToCart: (params) => {
    // params: { sku: string; cartCode: string; quantity: number }
    addProductToCart(params.sku, params.cartCode, params.quantity);
  },
});
```

It also dispatches a `gengage:similar:add-to-cart` CustomEvent on `window`.

The "Add to Cart" button only appears on product cards that have a `cartCode` value
in their product data. Products without a `cartCode` show only the product link.

### SimBut Widget

The SimBut widget supports a lightweight `onFindSimilar` callback and optional label override:

```js
await simbutWidget.init({
  // ...
  mountTarget: productImageWrapper,
  sku: currentSku,
  imageUrl: currentImageUrl,
  i18n: { findSimilarLabel: 'Find Similar' },
  onFindSimilar: ({ sku, imageUrl }) => {
    openYourOwnSimilarFlow({ sku, imageUrl });
  },
});
```

If you pass `chat` instead of `onFindSimilar`, SimBut opens the chat drawer and forwards a
`findSimilar` action automatically.

---

## Favorites integration

Favorites are delegated to the merchant (same idea as cart): you open your own favorites page from the header and persist toggles via your API. GA4 alignment uses existing dataLayer events **`gengage-like-list`** (header) and **`gengage-like-product`** (card heart when adding); `wireGADataLayer()` listens to `gengage:chat:product-favorite` for the latter — see **Analytics Contract → GA Data Layer Integration**.

### Chat `init` and header button

The header heart is shown when you pass **`onFavoritesClick`** and/or legacy **`headerFavoritesToggle: true`** (built-in IDB list only). With **`onFavoritesClick`**, the widget does not open an internal favorites panel — only your callback runs (navigate to your site).

```js
await chatWidget.init({
  // ...
  onFavoritesClick: () => {
    window.location.href = '/favorilerim'; // your favorites URL
  },
});
```

### Product card heart — callback + CustomEvent

On each heart click the widget dispatches **`gengage:chat:product-favorite`** on `window` and sends bridge type **`productFavorite`**. Register **`gengage-product-favorite`** to integrate with your backend (return `false` or throw on failure to revert the UI and show an error message):

```js
window.gengage.chat.addCallback('gengage-product-favorite', async (detail) => {
  // detail.sku, detail.product, detail.favorited, detail.sessionId
  const res = await fetch('/api/favorites', {
    method: detail.favorited ? 'POST' : 'DELETE',
    body: JSON.stringify({ sku: detail.sku }),
    headers: { 'Content-Type': 'application/json' },
  });
  return res.ok;
});
```

If you do **not** register this callback, the widget keeps the previous behavior: IndexedDB favorites plus optional backend `like` action when adding.

### Header badge count (host → widget)

To sync the red badge on the header heart after your server state changes, send a bridge message from the host page:

```js
window.postMessage(
  { gengage: 'chat', type: 'favoritesCountHandler', payload: { count: 3 } },
  location.origin,
);
```

Use `count: 0` to hide the badge.

---

## Product Detail Panel

Clicking a product card in the chat stream shows a compact `ProductSummaryCard`
inline. When `productDetailsExtended: true` is set, a full `ProductDetailsPanel`
also opens in the left-side panel area. The panel shows detailed product information:

- **Image** — full product image at the top.
- **Name** — product title as an `<h3>`.
- **Brand** — brand name (if available).
- **Rating** — star rating with review count (e.g. "4.5 (128)").
- **Prices** — current price and strikethrough original price when discounted.
- **Stock status** — in-stock / out-of-stock indicator.
- **Variants** — clickable product variants from `variants`; falls back to variant-like
  `facet_hits` / `features` such as color and size when sibling variants are not
  present.
- **Product link** — link to the product URL (opens in a new tab).
- **Add to Cart** — add-to-cart button (shown when `cartCode` is present).
- **Find Similar** — triggers a `findSimilar` action for the product's SKU.

Clicking the rating chip triggers the review summary action for the product SKU.
`description_html` is preferred over flattened `description` text and is sanitized
before rendering so merchant paragraphs, headings, and lists can keep their
structure in the panel.

The panel is rendered by the `ProductDetailsPanel` component in the chat UISpec
registry (`src/chat/components/renderUISpec.ts`). Override it via Level 2
customization:

```ts
await chatWidget.init({
  renderer: {
    registry: {
      ProductDetailsPanel: ({ element, context }) => {
        // Build your own product detail view
        const div = document.createElement('div');
        const product = element.props?.product;
        // ...
        return div;
      },
    },
  },
});
```

---

## Price Formatting

The `formatPrice` function (`src/common/price-formatter.ts`) formats raw numeric strings
into locale-appropriate price displays. All product cards use this internally; you can
also import it for custom components.

```ts
import { formatPrice } from '@gengage/assistant-fe';

formatPrice('17990');                          // "17.990 TL" (default Turkish)
formatPrice('17990.5');                        // "17.990,50 TL"
formatPrice('17990', {
  currencySymbol: '£',
  currencyPosition: 'prefix',
  thousandsSeparator: ',',
  decimalSeparator: '.',
});                                            // "£17,990"
```

### PriceFormatConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `currencySymbol` | `string` | `'TL'` | Currency symbol to display |
| `currencyPosition` | `'prefix' \| 'suffix'` | `'suffix'` | Symbol placement relative to the number |
| `thousandsSeparator` | `string` | `'.'` | Character between thousands groups |
| `decimalSeparator` | `string` | `','` | Decimal point character |
| `alwaysShowDecimals` | `boolean` | `false` | Show `.00` even for whole numbers |

Returns the input string as-is if it is not a valid non-negative number.

Pass pricing config through widget init:

```ts
await chatWidget.init({
  pricing: {
    currencySymbol: '€',
    currencyPosition: 'prefix',
    thousandsSeparator: '.',
    decimalSeparator: ',',
  },
});
```

---

## Voice Input

The `VoiceInput` class (`src/common/voice-input.ts`) provides browser-native
speech-to-text using the Web Speech API. The chat widget uses it for the microphone
button. No audio is sent to the backend; transcription happens entirely in the browser.

### Browser Support

| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| Chrome | 33+ | Full support |
| Edge | 79+ | Full support |
| Safari | 14.1+ | Via `webkitSpeechRecognition` |
| Firefox | -- | **Not supported** (no SpeechRecognition API) |

### Feature Detection

```ts
import { isVoiceInputSupported } from '@gengage/assistant-fe';

if (isVoiceInputSupported()) {
  // Show microphone button
}
```

### Usage

```ts
import { VoiceInput } from '@gengage/assistant-fe';

const voice = new VoiceInput(
  {
    onInterim: (text) => { /* Show partial transcript in input */ },
    onFinal: (text) => { /* Update input with finalized text */ },
    onAutoSubmit: (text) => { /* Send message after silence timeout */ },
    onStateChange: (state) => { /* 'idle' | 'listening' | 'error' */ },
    onError: (code, message) => { /* Handle error */ },
  },
  {
    lang: 'tr-TR',          // BCP 47 tag. Default: 'tr-TR'
    silenceTimeoutMs: 1500,  // ms of silence before auto-submit. Default: 1500
    autoSubmit: true,        // Submit on silence. Default: true
  },
);

voice.start();    // Begin listening (requests microphone permission on first call)
voice.stop();     // Stop and return accumulated transcript
voice.abort();    // Stop and discard transcript
voice.destroy();  // Release all resources
```

Supported languages: `tr-TR` (Turkish) and `en-US` (English). HTTPS is required.

---

## Text-to-Speech Playback

The `playTtsAudio` function (`src/common/tts-player.ts`) plays base64-encoded audio
clips returned by the backend for TTS responses.

```ts
import { playTtsAudio } from '@gengage/assistant-fe';

const handle = playTtsAudio(base64String, 'audio/ogg');
if (handle) {
  // Later: stop playback
  handle.stop();
}
```

### API

`playTtsAudio(base64: string, contentType?: string): AudioHandle | null`

- `base64` — base64-encoded audio data.
- `contentType` — MIME type. Default: `'audio/ogg'`.
- Returns an `AudioHandle` with a `stop()` method, or `null` if playback could not start
  (e.g. autoplay blocked by the browser, or unsupported environment).

Supported audio types: `audio/ogg`, `audio/mpeg`, `audio/mp3`, `audio/wav`,
`audio/webm`, `audio/aac`, `audio/mp4`.

---

## Merchant Customization

The SDK does not ship merchant-specific configurations. Each integration provides its
own theme, locale, and i18n when initializing the widgets:

```ts
import { initOverlayWidgets } from '@gengage/assistant-fe';

const controller = await initOverlayWidgets({
  accountId: 'your-account-id',
  middlewareUrl: 'https://your-backend.example.com',
  locale: 'tr',
  sku: '1000465056',
  theme: {
    primaryColor: '#ec6e00',
    primaryForeground: '#ffffff',
    backgroundColor: '#ffffff',
    foregroundColor: '#222222',
    borderRadius: '8px',
    fontFamily: 'sans-serif',
    fontSize: '14px',
  },
  chat: {
    i18n: { inputPlaceholder: 'Search products or ask a question' },
  },
  onAddToCart: (params) => { /* site-specific */ },
});
```

The `middlewareUrl` should be set in your integration script where you initialize the SDK.
See `demos/` for complete brand-customized integration examples.

### Connectivity Probe URL

The SDK performs a background connectivity check by fetching `https://www.google.com/favicon.ico`.
In environments where Google is blocked (certain corporate networks, China, etc.) this probe will
silently fail and connection warnings may not work correctly.

Call `configureConnectionWarning` once at init to point the probe at a URL that is always
reachable in your deployment environment:

```ts
import { configureConnectionWarning } from '@gengage/assistant-fe';

configureConnectionWarning({
  probeUrl: 'https://cdn.mystore.com/favicon.ico',
});
```

Any small, cacheable asset on a domain your users can always reach is a good choice.

---

## Page Auto-Detection

The `autoDetectPageContext` function (`src/common/page-detect.ts`) infers the current
page type from URL patterns and DOM signals. Use it as a fallback when the host page
does not set `pageContext` explicitly.

```ts
import { autoDetectPageContext } from '@gengage/assistant-fe';

const ctx = autoDetectPageContext();
// ctx: { pageType: 'pdp', sku: '1000465056', url: 'https://...' }

await chatWidget.init({
  ...ctx,
  accountId: 'koctascomtr',
});
```

### How Detection Works

1. URL pathname is tested against an ordered list of regex rules.
2. Optional `queryParam` check (e.g. `?q=` for search pages).
3. Optional DOM `selector` check (e.g. presence of a product schema element).
4. First matching rule wins. Falls back to `'other'`.
5. On PDP pages, `extractSkuFromUrl()` attempts to pull the SKU from the path.

### Default Rules

| Page Type | URL Patterns |
|-----------|-------------|
| `home` | `^/$`, `^/index.html?$`, `^/anasayfa$` |
| `search` | `/arama`, `/search`, `/ara?` (+ `?q=` param) |
| `cart` | `/sepet`, `/cart`, `/basket`, `/sepetim` |
| `plp` | `/kategori/`, `/category/`, `/c/`, `/koleksiyon/`, `/collection/` |
| `pdp` | `/urun/`, `/product/`, `/p/`, `-p-`, `-pm-` |

### Custom Rules

Pass your own rules array to override the defaults:

```ts
import { autoDetectPageContext } from '@gengage/assistant-fe';
import type { PageDetectionRule } from '@gengage/assistant-fe';

const rules: PageDetectionRule[] = [
  { pageType: 'pdp', urlPatterns: ['/item/\\d+'], selector: '[itemtype="https://schema.org/Product"]' },
  { pageType: 'plp', urlPatterns: ['/shop/'] },
  { pageType: 'home', urlPatterns: ['^/$'] },
];

const ctx = autoDetectPageContext(rules);
```

---

## Accessibility

The chat widget follows WAI-ARIA patterns for dialog and live-region content.

### ARIA Roles and Labels

| Element | Attribute | Value |
|---------|-----------|-------|
| Chat drawer root | `role` | `dialog` |
| Chat drawer root | `aria-label` | Header title (from i18n) |
| Chat drawer root | `aria-modal` | `false` (non-modal; host page remains interactive) |
| Messages area | `role` | `log` |
| Messages area | `aria-live` | `polite` |
| Messages area | `aria-label` | `Chat messages` |
| Suggestion pills row | `role` | `toolbar` |
| Suggestion pills row | `aria-label` | `Suggestions` |
| Panel divider | `role` | `separator` |
| Close / attach / send buttons | `aria-label` | Localized from i18n |

### Focus Management

- **Focus trap:** Tab / Shift+Tab cycles through focusable elements within the chat
  drawer. The trap uses `getRootNode()` to resolve `activeElement` correctly inside
  Shadow DOM.
- **Escape key:** Pressing Escape closes the chat drawer.
- **Auto-focus:** `focusInput()` is called after the drawer opens so the user can
  start typing immediately.
- **Focus-visible outlines:** All interactive elements (buttons, links, inputs) display
  a visible focus ring when navigated via keyboard (`:focus-visible`). The outline uses
  `--gengage-primary-color` so it adapts to the brand theme.

### Reduced Motion

All four widgets (chat, QNA, SimRel, SimBut) include a `@media (prefers-reduced-motion: reduce)`
block that disables animations and transitions:

```css
@media (prefers-reduced-motion: reduce) {
  .gengage-chat-drawer,
  .gengage-chat-bubble,
  .gengage-chat-launcher,
  /* ... and other animated elements */ {
    animation: none !important;
    transition: none !important;
    transform: none !important;
  }
}
```

This covers the chat drawer slide-in, typing indicator animation,
launcher hover effects, pill scroll, and skeleton loading shimmer.

### Minimum Touch Targets

On mobile viewports, all interactive controls meet the WCAG 2.5.5 minimum of 44x44 CSS
pixels. This applies to:

- Chat launcher button
- Send / attach / close buttons in the chat input area
- Suggestion pills in the toolbar row
- Product card CTA buttons

### iOS Safe Area and Virtual Keyboard

On mobile, the chat input area respects `env(safe-area-inset-bottom)` so it does not
overlap the home indicator on notched devices. The `--gengage-keyboard-offset` CSS
property is set dynamically via the Visual Viewport API to shift the input area above
the virtual keyboard when it opens.

---

## Host-Facing Events

### Script Call Events

When the backend sends a `script_call` action, the chat widget dispatches a `gengage:chat:script-call` CustomEvent on `window` and calls the `onScriptCall` config callback:

```js
// Option A: Event bus listener
window.addEventListener('gengage:chat:script-call', (e) => {
  const { name, payload } = e.detail;
  // name: string — the script function name
  // payload?: Record<string, unknown> — optional params
  if (name === 'showPromoModal') {
    showPromo(payload);
  }
});

// Option B: Config callback
await chatWidget.init({
  // ...
  onScriptCall: ({ name, payload }) => {
    if (name === 'showPromoModal') showPromo(payload);
  },
});
```

The `actionHandling.allowScriptCall` config (default: `true`) gates whether `script_call` actions are dispatched. Set to `false` to block all script calls.

### Checkout Attribution Events

Track checkout attribution by calling `trackCheckout()` on the widget instance or via the public API proxy on `window.gengage.chat`:

```js
// Via widget instance (if you have a direct reference)
chatWidget.trackCheckout('start', {
  attribution_source: 'chat',
  attribution_action_id: 'action-uuid-from-session',
  cart_value: 249.99,
  currency: 'TRY',
  line_items: 3,
});

// Via public API proxy (GTM / loosely-coupled host pages)
window.gengage.chat.trackCheckout('start', {
  attribution_source: 'chat',
  attribution_action_id: 'action-uuid-from-session',
  cart_value: 249.99,
  currency: 'TRY',
  line_items: 3,
});

// Host page calls this when checkout completes
chatWidget.trackCheckout('complete', {
  attribution_source: 'chat',
  attribution_action_id: 'action-uuid-from-session',
  cart_value: 249.99,
  currency: 'TRY',
  line_items: 3,
});
```

### Metering Summary

For session-level metering aggregation, call `flushMeteringSummary()` on the widget instance or via `window.gengage.chat`:

```js
chatWidget.flushMeteringSummary({
  meter_key: 'chat_request',
  quantity: 12,
  unit: 'request',
});

// Or via public API proxy
window.gengage.chat.flushMeteringSummary({
  meter_key: 'chat_request',
  quantity: 12,
  unit: 'request',
});
```

---

## What You Cannot Customize

- Core endpoint semantics and payload shapes (`/chat/*` paths), not per-widget custom logic.
- NDJSON event types and shapes — changing these requires a backend release.
- The session/correlation ID mechanism — required for analytics.
- Analytics auth model — account-configured, not customizable per-widget.

These constraints are what make the system predictable across all customer deployments.

# V2 Migration Guide

This guide covers breaking changes and new features when upgrading from V1 to V2
of the Gengage widget frontend.

---

## Breaking Changes

### 1. `allowScriptCall` default changed to `false`

**V1:** `allowScriptCall` defaulted to `true`, allowing the backend to execute
arbitrary JavaScript via `script_call` action events.

**V2:** `allowScriptCall` defaults to `false`. Script call actions are silently
ignored unless explicitly opted in.

**Migration:**
```typescript
// If your integration relies on script_call actions, opt in explicitly:
window.gengage = {
  config: {
    actionHandling: {
      allowScriptCall: true,
    },
  },
};
```

### 2. Request Format: Flat `type`/`payload`

**V1:** Requests wrapped the action in a nested `action` property:
```typescript
{
  account_id: "acme",
  action: { title: "User input", type: "inputText", payload: { text: "hello" } },
}
```

**V2:** Actions use top-level `type` and `payload`:
```typescript
{
  account_id: "acme",
  type: "inputText",
  payload: { text: "hello" },
}
```

The backend accepts both formats. The `action` wrapper is deprecated but still
functional for backward compatibility.

---

## New Features

### Heartbeat Polling

V2 introduces a heartbeat mechanism for proactive engagement. The frontend
periodically polls `/v2/heartbeat` with session state, and the backend may
return a message to show the user (e.g., idle nudge, cart abandonment reminder).

**Enable it:**
```typescript
const chat = new GengageChat({
  // ...
  enableHeartbeat: true,
  heartbeatIntervalMs: 30_000, // default: 30s
});
```

See [wire-protocol.md](./wire-protocol.md#heartbeat-endpoint) for the full
request/response schema.

### Lifecycle Events

Widgets now emit lifecycle events that host pages can listen to:

| Event            | Payload             | Fired when                    |
|------------------|---------------------|-------------------------------|
| `open`           | —                   | Chat drawer opens             |
| `close`          | —                   | Chat drawer closes            |
| `ready`          | —                   | Widget initialization done    |
| `message`        | `ChatMessage`       | Bot message received          |
| `error`          | `Error`             | Stream or API error           |
| `context-update` | `PageContext`       | `widget.update()` called      |
| `destroy`        | —                   | Widget teardown begins        |

```typescript
const chat = window.gengage.chat;
const off = chat.on('message', (msg) => console.log('Bot said:', msg));
// later: off() to unsubscribe
```

### Programmatic Message API

Send messages or trigger actions without user interaction:

```typescript
// Send a text message as if the user typed it
window.gengage.chat.sendMessage('Show me wireless drills');

// Trigger a specific action
window.gengage.chat.sendAction({ title: 'Find similar', type: 'findSimilar', payload: { sku: 'SKU123' } });

// Silent action (no user-facing message bubble)
window.gengage.chat.sendAction(
  { title: 'Track', type: 'analytics_ping', payload: {} },
  { silent: true }
);
```

### CategoriesContainer Accessibility

The grouped product tabs now implement the WAI-ARIA tablist pattern with full
keyboard navigation (Arrow keys, Home, End).

### Communication Bridge Origin Warning

In development mode (`import.meta.env.DEV`), the `CommunicationBridge` now logs
a console warning when using the wildcard origin `"*"`. Set explicit
`allowedOrigins` in production.

### Exposed Analytics Client

`window.gengage.analyticsClient` is now available on the overlay controller,
allowing host pages to send custom analytics events through the same pipeline.

### Quantity Stepper on Add-to-Cart

All add-to-cart buttons now display a `[-] [1] [+]` quantity stepper instead of
a plain button. This changes the ATC interaction from single-click to
stepper + click. The `onAddToCart` callback now receives a `quantity` parameter:

```typescript
onAddToCart: (sku: string, quantity: number) => {
  // quantity defaults to 1 if the user does not adjust the stepper
  cart.add(sku, quantity);
};
```

Not a breaking change (defaults to 1 if the callback ignores the parameter), but
a significant UI change worth noting during upgrade.

### Like/ATC Backend Communication

Heart (favorite) and cart buttons now send actions to the backend instead of
operating locally. When a user clicks heart or add-to-cart, the widget sends an
action request; the backend responds with text and suggested actions rendered in
the chat pane. The product panel is preserved across these interactions via the
`preservePanel` flag, so the user stays on the same product view.

### Session Persistence (IndexedDB)

New opt-in IndexedDB-based session persistence. Messages, panel snapshots, and
favorites survive page navigations and browser refreshes. Enabled automatically
when `session.userId` is provided in the config:

```typescript
const chat = new GengageChat({
  session: {
    userId: 'user-abc-123', // triggers IndexedDB persistence
  },
  // ...
});
```

### Accessibility Enhancements

V2 adds several WCAG improvements:

- `:focus-visible` outlines on all interactive elements (buttons, links, inputs).
- `aria-live="polite"` on the quantity stepper so screen readers announce value changes.
- `prefers-reduced-motion` media query — animations are suppressed when the user has requested reduced motion.
- 44x44px minimum touch targets on mobile for all buttons and interactive elements (WCAG 2.5.5).

### New Utility Modules

Several new shared modules were added under `src/common/`:

| Module | Description |
|--------|-------------|
| `quantity-stepper.ts` | Reusable `[-][n][+]` stepper component for ATC buttons |
| `tts-player.ts` | Text-to-speech audio playback for bot responses |
| `price-formatter.ts` | Locale-aware price formatting (currency, separators) |
| `product-utils.ts` | Product data helpers (image URL resolution, badge logic) |
| `voice-input.ts` | Speech-to-text input via Web Speech API |
| `page-detect.ts` | Auto-detect page type (PDP, PLP, homepage) from URL/DOM |
| `ga-datalayer.ts` | Google Analytics dataLayer event helpers |

---

## i18n Improvements

All previously hardcoded Turkish strings are now configurable through the i18n
system. New keys added to `ChatI18n`:

| Key                      | Turkish Default              | English Default           |
|--------------------------|------------------------------|---------------------------|
| `addToCartButton`        | Sepete Ekle                  | Add to Cart               |
| `productInfoTab`         | Ürün Bilgileri               | Product Info              |
| `specificationsTab`      | Teknik Özellikler            | Specifications            |
| `recommendedChoiceLabel` | Önerilen Seçim               | Recommended Choice        |
| `highlightsLabel`        | Öne Çıkan Özellikler         | Key Highlights            |
| `keyDifferencesLabel`    | Temel Farklar                | Key Differences           |
| `specialCasesLabel`      | Özel Durumlar İçin           | For Special Cases         |
| `emptyReviewsMessage`    | Yorum özeti bulunamadı.      | No review summary found.  |
| `closeAriaLabel`         | Kapat                        | Close                     |
| `startChatLabel`         | Sohbete Başla                | Start Chat                |

Override any key via `config.i18n`:
```typescript
const chat = new GengageChat({
  locale: 'en',
  i18n: {
    addToCartButton: 'Add to Basket',
  },
});
```

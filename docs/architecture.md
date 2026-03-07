# Architecture

## Overview

`gengage-assistant-fe` is a collection of three independent, embeddable frontend widgets
that connect to the Gengage AI backend. The widgets are decoupled —
a customer can embed just the chat, just the QNA buttons, or all three together.

```
┌─────────────────────────────────────────────────────────┐
│                     Customer Website                     │
│                                                          │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────────┐ │
│  │ GengageQNA│   │GengageSimRel│      GengageChat      │ │
│  │  (qna/)  │   │ (simrel/)│   │     (chat/)          │ │
│  └────┬─────┘   └────┬─────┘   └──────────┬───────────┘ │
│       │              │                    │              │
│       └──────────────┴──── event bus ─────┘              │
│                    (gengage:* CustomEvents)               │
└─────────────────────────────────────────────────────────┘
             │                         │
             ▼                         ▼
  POST /chat/launcher_action       POST /chat/process_action
  POST /chat/similar_products      POST /chat/product_groupings
             │                         │
             └───────────┬─────────────┘
                         │
              ┌──────────▼──────────┐
              │       Backend       │  (Gengage SaaS backend)
              │   NDJSON streaming  │  (stateless/serverless)
              └─────────────────────┘
```

> **Note:** All endpoints use `/chat/*` paths. The backend is stateless —
> all conversation state lives in the browser and is sent with every request.

---

## Widget Anatomy

Each widget follows the same pattern:

```
src/<widget>/
  index.ts       → Public class extending BaseWidget (init/update/show/hide/destroy)
  types.ts       → Widget config interface + domain types
  catalog.ts     → json-render component schemas (Zod)
  components/    → Vanilla TS renderers (per-component files)
```

Current migration status:
- Chat, QNA, and SimRel use the shared `src/common/renderer/` UISpec DOM renderer foundation.
- Each widget can override component renderers via `config.renderer.registry` or replace rendering entirely via `config.renderer.renderUISpec`.

### Why json-render?

json-render lets the **backend drive the UI structure** while the **frontend controls the look**.

1. Backend streams a `ui_spec` event containing a flat element map.
2. The widget feeds it into json-render's `<Renderer>` using the widget's `registry`.
3. json-render resolves each element `type` to a vanilla DOM renderer (or any custom renderer).
4. The customer forks the repo and replaces registry components with their own.

The **catalog** (Zod schemas) is the contract between backend and frontend. Component names
and prop shapes are fixed for a given API version. The **registry** (implementations) is
fully customer-controlled.

---

## Chat Two-Pane Layout (Production)

The chat widget uses a two-pane layout on desktop:

```
┌─────────────────────────────────────────────────────────────┐
│                    Chat Widget (Shadow DOM)                   │
│                                                              │
│  ┌─────────── MainPane ──────────┬──── ChatPane ────────┐   │
│  │  (Desktop only — left side)   │  (Right side/mobile)  │   │
│  │                               │                       │   │
│  │  TopBar (title + nav arrows)  │  ChatHeader           │   │
│  │  ┌─────────────────────────┐  │  ┌─────────────────┐  │   │
│  │  │ ProductDetailsPanel     │  │  │ Messages         │  │   │
│  │  │   OR                    │  │  │   (threaded)     │  │   │
│  │  │ ProductGrid             │  │  │   UserMsg        │  │   │
│  │  │   OR                    │  │  │   BotText        │  │   │
│  │  │ ComparisonTable         │  │  │   AITopPicks     │  │   │
│  │  │   OR                    │  │  │   Suggestions    │  │   │
│  │  │ GroupedTabs             │  │  │   ...            │  │   │
│  │  └─────────────────────────┘  │  └─────────────────┘  │   │
│  └───────────────────────────────┴───────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Desktop**: Both panes visible. Panel content in MainPane; chat in ChatPane.
**Mobile**: Only ChatPane visible. Panel content types render inline in ChatPane.

MainPane renders these response types: `productDetails`, `productList`, `groupList`, `comparisonTable`.
All other types render exclusively in ChatPane.

## Data Flow: Chat Widget

```
User types message
      │
      ▼
GengageChat._sendAction(action)
      │
      ├── Generate UUIDv7 threadId for this request-response cycle
      ├── Build BackendRequestMeta (outputLanguage, parentUrl, threadId, isMobile, ...)
      ├── Build context from last backend context response
      │
      ▼
POST /chat/process_action  →  NDJSON stream (backend event types)
      │
      ├── {type:"loading"}           → update loading indicator
      ├── {type:"panelLoading"}      → show panel skeleton
      ├── {type:"productDetails"}    → render in MainPane + ChatPane card
      ├── {type:"context"}           → save conversation state (multiple per request)
      ├── {type:"outputText"}        → sanitize HTML, append to ChatMessage bubble
      ├── {type:"suggestedActions"}  → render as pills + input area chips
      ├── {type:"aiProductSuggestions"} → render AI Top Picks cards
      ├── {type:"chatStreamEnd"}     → mark stream complete
      │
      │   wire protocol adapter normalizes all above to:
      │   text_chunk, ui_spec, action, metadata, done
      │
      └── json-render resolves each ui_spec to:
               ProductCard / ActionButtons / AITopPicks / ComparisonTable / etc.
```

## Data Flow: QNA Widget

```
Page load (or SKU change)
      │
      ▼
GengageQNA.init() / .update({ sku })
      │
      ▼
POST /chat/launcher_action  →  NDJSON stream
      │
      ├── {type:"text"}        → launcher text
      ├── {type:"productItem"} → trimmed product data
      ├── {type:"text_image"}  → action with image
      └── {type:"quick_qna"}   → question buttons
               └── adapter normalizes to ui_spec: ButtonRow > ActionButton[]
                      │
                      ▼ (user clicks)
              dispatch('gengage:qna:action', action)
              config.onActionSelected(action)
                      │
                      ▼
              window.gengage.chat.openWithAction(action)
```

## Data Flow: SimRel Widget

```
PDP page load (or SKU change)
      │
      ▼
GengageSimRel.init({ sku })
      │
      ├── POST /chat/similar_products   → JSON payload (not NDJSON)
      └── POST /chat/product_groupings  → JSON payload (not NDJSON)
               │
               └── JSON payload with results/product_groupings
                        └── ProductGrid > ProductCard[]
                                │
                                ▼ (user taps card)
                     dispatch('gengage:similar:product-click', {...})
                     config.onProductNavigate(url, sku, sessionId)
```

---

## Cross-Widget Communication

Widgets never import each other. They communicate through:

1. **Window CustomEvents** (`gengage:*`) — fire-and-forget, loosely coupled.
2. **`window.gengage.chat`** — the Chat widget's public API, available after `chat.init()`.
3. **Callback props** in widget config — for tight integration without event listeners.

```js
// After init, wire widgets together with one helper:
import { wireQNAToChat, wireSimilarToChat } from '@gengage/assistant-fe';

wireQNAToChat();    // gengage:qna:action → window.gengage.chat.openWithAction()
wireSimilarToChat(); // gengage:similar:product-click → saveSession + navigate
```

---

## Thread Model

Every request-response cycle creates a new **UUIDv7** `threadId` (lexicographically sortable).
Messages are grouped into threads. The `currentThreadId` acts as a visibility cursor —
messages with `threadId > currentThreadId` are hidden but not deleted.

Users can navigate history via:
- **Rollback-on-click**: Clicking a past user message rewinds to that thread
- **TopBar arrows**: Back/forward navigation in MainPane (managed by `PanelManager`)
- **Branching**: Typing from a rewound position deletes future messages and creates a new branch

## Session Persistence

The `SessionPersistence` class (`src/chat/session-persistence.ts`) wraps IndexedDB via
`GengageIndexedDB` to persist chat state across page navigations:

- **Messages**: Serialized to `SerializableChatMessage[]` (streaming status normalized to `done`).
- **Panel snapshots**: Serialized as HTML strings (loading skeletons are excluded).
- **UISpec payloads**: Stored separately in IndexedDB per thread/message. After persistence
  the in-memory `uiSpec` reference is deleted to free memory.
- **Favorites**: Per-user/per-account product SKU set, loaded on init and toggled via
  `toggleFavorite()`.
- **Backend context**: Latest `BackendContext` snapshot saved per session/thread.

Restoration trigger: `sessionStorage.setItem('gengage_restore_session_id', sessionId)` is
set after each persist. On next widget init within the same browser session, the widget
checks for this key and restores from IndexedDB.

`saveAndOpenURL()` persists the session before navigating away (product links, bot HTML
links), so state survives the navigation.

## Panel Manager

The `PanelManager` (`src/chat/panel-manager.ts`) owns the two-pane panel state for the
chat widget. It manages:

- **Content snapshots** keyed by bot message ID. After each stream completes, the current
  panel content is deep-cloned and stored. Loading skeletons are never snapshot.
- **Snapshot types** per message ID, so the topbar title can be restored correctly (e.g.
  `ProductDetailsPanel` -> i18n `panelTitleProductDetails`).
- **Message-to-panel routing**: Clicking a bot message bubble restores its associated panel
  snapshot, highlights the active message, and de-highlights the previous one.
- **Thread navigation**: Back/forward navigation through `panelThreads[]` via `navigateBack()`
  / `navigateForward()`, which internally calls `rollbackToThread()`.
- **Extended mode coordination**: Maps UISpec component types to `PanelContentType` for the
  `ExtendedModeManager`.
- **Panel route shaping**: Transforms `ProductCard` UISpecs into `ProductDetailsPanel` specs
  for the left-hand panel via `toPanelSpec()`.

## Merchant Customization

The SDK does **not** ship merchant-specific configurations. Each integration (demo, embed,
or customer deployment) defines its own theme tokens, locale, and i18n strings in the
`initOverlayWidgets()` call. See `demos/` for examples.

The component catalog (`catalog/`) has its own local merchant configs for visual testing
— these are not part of the published package.

## Voice Input

`src/common/voice-input.ts` wraps the browser-native Web Speech API for real-time
speech-to-text. No audio is sent to the backend — only the transcribed text string.

- **Languages**: Turkish (`tr-TR`) and English (`en-US`).
- **Auto-submit**: Configurable silence timeout (default 1500ms). When the user stops
  speaking, the accumulated transcript is automatically submitted via `onAutoSubmit`.
- **Interim results**: `onInterim` callback fires with partial transcripts during speech.
- **Auto-restart**: If the browser stops recognition arbitrarily (Chrome does this after ~60s),
  the class automatically restarts while still in `listening` state.
- **Browser support**: Chrome 33+, Edge 79+, Safari 14.1+ (via `webkitSpeechRecognition`).
  Firefox is not supported (no SpeechRecognition API).

## TTS Audio Playback

`src/common/tts-player.ts` plays base64-encoded audio from backend `voice` stream events.

- `playTtsAudio(base64, contentType)` creates an `Audio` element with a data URI and
  returns an `AudioHandle` with a `stop()` method for playback control.
- Allowlisted content types: `audio/ogg`, `audio/mpeg`, `audio/mp3`, `audio/wav`,
  `audio/webm`, `audio/aac`, `audio/mp4`.
- Returns `null` if playback cannot be initiated (autoplay blocked, unsupported environment).

## GA Data Layer

`src/common/ga-datalayer.ts` pushes widget activity events to the Google Analytics 4
`window.dataLayer` array. Event names are prefixed with `gengage-` for dashboard filtering.

Tracked events include: `gengage-on-init`, `gengage-show`, `gengage-hide`,
`gengage-suggested-question`, `gengage-find-similars`, `gengage-compare-selected`,
`gengage-like-product`, `gengage-search`, `gengage-product-detail`, `gengage-cart-add`,
`gengage-message-sent`, `gengage-message-received`, `gengage-voice-input`, `gengage-error`.

`wireGADataLayer()` subscribes to cross-widget `gengage:*` CustomEvents and maps them to
the corresponding GA push calls. Returns an unsubscribe function. Falls back to
`console.debug` when `window.dataLayer` is not present.

## Page Auto-Detection

`src/common/page-detect.ts` detects page type and SKU from URL patterns and optional DOM
selectors. Useful as a fallback when the host page does not set `pageContext` explicitly.

- `detectPageType(rules?, url?)` — matches against configurable `PageDetectionRule[]`.
  Default rules cover common Turkish e-commerce URL patterns: `/urun/` (pdp), `/kategori/`
  (plp), `/sepet` (cart), `/arama` (search), `/anasayfa` (home).
- `extractSkuFromUrl(url?)` — extracts SKU from path segments like `/p/SKU`, `/urun/SKU`,
  or Trendyol-style `-p-SKU`.
- `autoDetectPageContext(rules?)` — combines both to return a partial `PageContext`.

## Quantity Stepper

`src/common/quantity-stepper.ts` renders a `[−][value][+][Submit]` component for
add-to-cart interactions. Used on product cards (compact mode with cart icon) and the
product details panel (full mode with label).

- Configurable min/max range (default 1–99), initial value, labels, and symbols.
- Compact mode renders a cart icon button; full mode renders a labeled "Sepete Ekle" button.
- All click events call `stopPropagation()` to prevent card-level click handlers from firing.
- `aria-live="polite"` on the value display for screen reader announcements.

## Price Formatter

`src/common/price-formatter.ts` provides locale-aware currency formatting via the
`formatPrice(raw, config?)` function.

- Defaults to Turkish format: dot thousands separator, comma decimal separator, `TL` suffix.
- Configurable via `PriceFormatConfig`: currency symbol, position (prefix/suffix), separators.
- Returns the input as-is for non-numeric or negative values.
- Example: `formatPrice("17990")` -> `"17.990 TL"`;
  with GBP config `{ currencySymbol: '£', currencyPosition: 'prefix' }` -> `"£17,990"`.

## Product Utilities

`src/common/product-utils.ts` contains shared product rendering helpers extracted from
chat and simrel to eliminate duplication:

- `clampRating(value)` — clamps to 0–5 range, returns 0 for NaN.
- `clampDiscount(value)` — clamps to 0–100%, rounded to integer.
- `renderStarRating(rating, halfStars?)` — returns Unicode star string (e.g. "★★★½☆").
- `addImageErrorHandler(img)` — hides the image element on load failure (one-time handler).

## KVKK Consent

`src/chat/kvkk.ts` handles Turkish data protection (KVKK — Kişisel Verilerin Korunması
Kanunu) consent notices that arrive in bot responses.

- `containsKvkk(html)` — detects KVKK markers in HTML content.
- `stripKvkkBlock(html)` — removes the first KVKK-containing block element from bot text.
- `extractKvkkBlock(html)` — extracts the KVKK block for banner display.
- `isKvkkShown(accountId)` / `markKvkkShown(accountId)` — localStorage-based per-account
  "shown" flag to avoid repeat banners.

## Like/ATC Backend Integration

Heart (favorite) and cart buttons on product cards now send actions to the backend:

- **Like**: `_sendAction({ type: 'like', payload: { sku } }, { preservePanel: true })`
- **Add to Cart**: `_sendAction({ type: 'addToCart', payload: { sku, cart_code, quantity } }, { preservePanel: true })`

The `preservePanel` option keeps the current product grid visible during the action:
- Skips panel loading skeleton (the product list stays in place).
- Skips aborting concurrent streams (the like/ATC stream runs alongside any active stream).

This lets users heart or add multiple products without the panel flickering or resetting.

---

## Session & Analytics

A single `sessionId` (UUID v4) is shared across all widgets on the same page/tab.
It is stored in `sessionStorage` so it survives soft navigations but not new tabs.
Full session state (messages, panel snapshots, UISpec payloads, favorites) is persisted
to IndexedDB via `SessionPersistence` (see above) for cross-navigation restoration.

All backend requests include:
- `session_id` → ties requests to a user journey
- `correlation_id` → same as `session_id` (used for cross-event analytics joins)
- `meta` → comprehensive frontend metadata (see `docs/wire-protocol.md`)
- `context` → conversation state from previous response (stateless backend pattern)

Bootstrap once at page load:
```js
import { bootstrapSession } from '@gengage/assistant-fe';
const sessionId = bootstrapSession();
// Then pass to all widget configs: session: { sessionId }
```

---

## Shadow DOM

The Chat widget renders inside a Shadow DOM to prevent CSS bleed from the host page.
QNA and SimRel render into a normal div (they are expected to fit the page's design).

---

## SPA Support

All widgets handle SPA navigation via `widget.update(context)`. Additionally, widgets
listen to the `gengage:context:update` CustomEvent so host-page code can broadcast
context changes without holding widget references:

```js
// Broadcast to all widgets at once:
import { updatePageContext } from '@gengage/assistant-fe';
updatePageContext({ pageType: 'pdp', sku: newSku });
```

---

## Shadow DOM Decision

The Chat widget uses Shadow DOM for CSS isolation. This decision lives entirely inside
`src/chat/` — it has no impact on QNA or SimRel.

**Why Shadow DOM for Chat:**
- Chat has a rich, fully-custom UI that must not be affected by host-page stylesheets.

**Why NOT for QNA and SimRel:**
- These widgets are expected to blend with the host page's design.
- Customers style them via CSS custom properties and their own stylesheets.
- Shadow DOM would complicate that without benefit.

---

## Component Catalog

The `catalog/` directory contains a visual component catalog that renders every widget
component with mock data — no backend needed. It resolves package aliases directly to
`src/` so component changes are visible immediately during development.

```bash
npm run catalog    # http://localhost:3002 (builds first)
```

Key details:
- **Hash-based SPA** with sidebar navigation for all 25+ components
- **Global theme selector** applies any of the 12 merchant presets catalog-wide
- **Realistic frames**: chat components in a chat-drawer frame, QNA in a PDP frame, SimRel in a product section
- **Isolated rendering** via `renderUISpecWithRegistry()` with stub contexts (no widget lifecycle)
- **CSS loading**: Chat CSS is `?inline` (bundled for Shadow DOM), so the catalog imports it via TypeScript (`import '../../src/chat/components/chat.css'`). HTML `<link>` tags won't work.

---

## Key New Files

| File | Role |
|------|------|
| `src/chat/session-persistence.ts` | IndexedDB persistence for messages, panels, favorites, UISpec payloads |
| `src/chat/panel-manager.ts` | Panel snapshot management, thread navigation, message-to-panel routing |
| `src/chat/kvkk.ts` | Turkish data protection (KVKK) consent notice filtering and banner |
| `src/common/voice-input.ts` | Web Speech API voice input with auto-submit |
| `src/common/tts-player.ts` | Base64 audio playback for backend TTS events |
| `src/common/ga-datalayer.ts` | Google Analytics 4 dataLayer event integration |
| `src/common/page-detect.ts` | URL/DOM-based page type and SKU auto-detection |
| `src/common/quantity-stepper.ts` | `[−][value][+][Submit]` component for ATC buttons |
| `src/common/price-formatter.ts` | Locale-aware currency formatting |
| `src/common/product-utils.ts` | Shared product rendering helpers (stars, ratings, image errors) |

---

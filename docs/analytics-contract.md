# Analytics Contract

This document defines required frontend analytics events for attribution, metering, and observability.

## Goals

1. Every event is joinable across widgets and backend logs.
2. Stream lifecycle and usage costs are measurable.
3. Basket and checkout outcomes can be attributed to assistant interactions.
4. Event payloads are typed and stable.

## Required Envelope

All analytics events must include:

```ts
interface AnalyticsEnvelope {
  event_name: string;
  event_version: '1';
  timestamp_ms: number;
  account_id: string;
  session_id: string;
  correlation_id: string;
  view_id?: string;
  user_id?: string;
  widget?: 'chat' | 'qna' | 'simrel';
  page_type?: string;
  sku?: string;
  payload: Record<string, unknown>;
}
```

Rules:
- `correlation_id` must map to the same journey identifier used in backend requests.
- `event_name` is lowercase snake-case with dot namespaces (example: `stream.start`).

Implementation note: the current typed stream and widget lifecycle helpers in code use `chat | qna | simrel` as the first-class widget union. SimBut currently contributes through GA `gengage-find-similars` events and host callbacks rather than a dedicated stream analytics family.

## Event Families

### Stream Lifecycle

- `stream.start`
- `stream.chunk`
- `stream.ui_spec`
- `stream.done`
- `stream.error`

Minimum payload fields:
- `endpoint`
- `request_id` (frontend-generated stream id)
- `latency_ms` (where applicable)
- `chunk_index` (for chunk/ui events)

### LLM Usage

- `llm.usage`

Minimum payload fields:
- `model`
- `prompt_tokens`
- `completion_tokens`
- `total_tokens`
- `provider` (if known)

### Metering

- `metering.increment`
- `metering.summary`

Minimum payload fields:
- `meter_key`
- `quantity`
- `unit` (example: `request`, `token`)

### Chat and Widget Histories

- `chat.history.snapshot`
- `widget.history.snapshot`

Minimum payload fields:
- `message_count` (or item count)
- `history_ref` (storage key or checksum)
- `redaction_level`

### Commerce Attribution

- `basket.add`
- `basket.like`
- `basket.like_list`
- `checkout.start`
- `checkout.complete`

Minimum payload fields:
- `attribution_source` (chat/qna/simrel)
- `attribution_action_id`
- `cart_value`
- `currency`
- `line_items` (count or IDs based on policy)

Additional payload fields for `basket.add`:
- `sku`
- `quantity` (always 1)

Additional payload fields for `basket.like`:
- `sku` (sends a `like` action to the backend as a side effect)

Additional payload fields for `basket.like_list`:
- `skus` (array of favorited product SKUs)

### Voice and TTS

- `voice.input`
- `voice.tts`

Minimum payload fields:
- `widget` (always `chat`)

`voice.input` is emitted when the user activates speech-to-text input in the chat widget.
`voice.tts` is emitted when the backend returns a TTS audio response.

The event bus dispatches `gengage:chat:voice` with a `{ payload }` detail when the backend
sends TTS audio data during a stream.

### Session

- `session.save`
- `session.restore`

Session persistence events (`src/chat/session-persistence.ts`) are emitted when the
chat session state is saved to IndexedDB (after each stream completion) or restored
on re-open. These are useful for debugging session continuity across page navigations.

### KVKK Consent

- `consent.kvkk_shown`
- `consent.kvkk_accepted`

Emitted when the KVKK (Turkish data protection law) consent banner is shown to the user
for the first time per account, and when the user accepts it. Acceptance state is persisted
in `localStorage` under `gengage_kvkk_shown_<accountId>`. See `src/chat/kvkk.ts`.

## Transport Requirements

Implement shared transport in `src/common/analytics.ts`.

1. Primary: `navigator.sendBeacon` when page is unloading.
2. Fallback: `fetch(..., { keepalive: true })`.
3. Buffer and batch small events.
4. Retry transient failures with capped backoff.
5. Do not block UI on analytics transport.

## Backend Alignment
1. Do not hardcode a backend analytics write route in core widgets.
2. Support account-configured analytics ingestion endpoint (default planned path: `/analytics`).
3. If calling dashboard analytics reads (`/analytics/*`), authenticate with `X-API-Key`.
4. Keep event emission working even when no HTTP ingest endpoint is configured (callback/event-bus mode).

## GA Data Layer Integration

`src/common/ga-datalayer.ts` provides a Google Analytics 4 integration layer. Calling
`wireGADataLayer()` subscribes to Gengage CustomEvents and pushes them to `window.dataLayer`
in GA4-compatible format. When `window.dataLayer` is not available (GA not loaded), events
fall back to `console.debug` for local debugging.

Call `wireGADataLayer()` once after widgets are initialized. It returns an unsubscribe
function that removes all listeners.

### GA Event Names

The SDK emits two parallel naming conventions for every legacy event so dashboards can be
migrated without losing data:

- **Legacy hyphen-separated** (`gengage-on-init`, `gengage-cart-add`, …) — kept for backward
  compatibility with existing GA setups.
- **Canonical camelCase** (`gengageOnInit`, `gengageCartAdd`, …) — automatically pushed in
  addition to the legacy event by `pushEvent()`. New dashboards should standardize on this
  form.

A small set of newer events (`gengageChatbotOpened`, `gengageChatbotMaximized`,
`gengageQnaInput`, `gengageQnaButton`, `gengageSimilarProductsImpression`,
`gengageSimilarGroupingClick`, `gengageSimilarProductClick`,
`gengageSimilarProductAddToCart`, `gengageCompareProduct`,
`gengageInterfaceNotReady`, and the special `GLOV_ON`) are emitted **only** under their
canonical name — no hyphenated mirror exists for these.

| Canonical (camelCase) | Legacy (hyphenated) | Description | Key Parameters |
|-----------------------|---------------------|-------------|----------------|
| `gengageOnInit` | `gengage-on-init` | Widget initialized (chat ready signal) | `gengage_widget` |
| `gengageShow` | `gengage-show` | Widget shown (any open path) | `gengage_widget` |
| `gengageHide` | `gengage-hide` | Widget hidden / closed | `gengage_widget` |
| `gengageChatbotOpened` | — | Chatbot opened from any source | `gengage_source` (`launcher`, `qna-button`, `qna-input`, `simbut`, …) |
| `gengageChatbotMaximized` | — | Chat panel switched to full / split layout | — |
| `GLOV_ON` | — | Robot eligibility passed; bootstrap started | `gengage_account_id` |
| `gengageInterfaceNotReady` | — | Bootstrap retry budget exhausted | `gengage_reason`, `gengage_attempts` |
| `gengageSearch` | `gengage-search` | Product list / search results displayed | `gengage_search_query`, `gengage_result_count` |
| `gengageProductDetail` | `gengage-product-detail` | Product card click / PDP open | `gengage_sku`, `gengage_product_name` |
| `gengageCartAdd` | `gengage-cart-add` | Product added to cart | `gengage_sku`, `gengage_quantity` |
| `gengageLikeProduct` | `gengage-like-product` | Favorite heart toggled | `gengage_sku` |
| `gengageLikeList` | `gengage-like-list` | Favorites list opened | — |
| `gengageFindSimilars` | `gengage-find-similars` | Find-similar requested (chat / SimBut) | `gengage_sku` |
| `gengageSimilarProductsImpression` | — | Similar products widget rendered | `gengage_product_count`, `gengage_sku` |
| `gengageSimilarGroupingClick` | — | Similar products group/filter tab clicked | `gengage_group_name`, `gengage_group_index` |
| `gengageSimilarProductClick` | — | Similar product card clicked | `gengage_sku`, `gengage_product_name` |
| `gengageSimilarProductAddToCart` | — | Add-to-cart on a similar product card | `gengage_sku`, `gengage_quantity` |
| `gengageCompareProduct` | — | Comparison toggle activated | `gengage_source` (`toggle`, `dock`, `choice-prompter`) |
| `gengageComparePreselection` | `gengage-compare-preselection` | Product picked for compare | `gengage_sku` |
| `gengageCompareSelected` | `gengage-compare-selected` | "Compare selected" submitted | `gengage_skus`, `gengage_product_count` |
| `gengageCompareClear` | `gengage-compare-clear` | Comparison selection cleared | — |
| `gengageCompareReceived` | `gengage-compare-received` | Comparison table rendered | `gengage_product_count` |
| `gengageSuggestedQuestion` | `gengage-suggested-question` | Suggested action clicked | `gengage_question_title`, `gengage_action_type` |
| `gengageQnaInput` | — | QNA free-text input submitted | `gengage_question_title` |
| `gengageQnaButton` | — | QNA quick-action button clicked | `gengage_question_title`, `gengage_action_type` |
| `gengageMessageSent` | `gengage-message-sent` | User sent a chat message | — |
| `gengageMessageReceived` | `gengage-message-received` | Assistant responded | — |
| `gengageConversationStart` | `gengage-conversation-start` | New conversation started | — |
| `gengageVoiceInput` | `gengage-voice-input` | Voice speech-to-text used | — |
| `gengageError` | `gengage-error` | Widget or stream error | `gengage_widget`, `gengage_error` |

### Event Bus Listeners

`wireGADataLayer()` subscribes to the following Gengage CustomEvents on `window`. Every
listed `gengage-*` event is automatically mirrored to its canonical camelCase form (e.g.
`gengage-on-init` → also pushes `gengageOnInit`).

| CustomEvent | GA Event Fired |
|-------------|---------------|
| `gengage:chat:ready` | `gengage-on-init` / `gengageOnInit` (widget: chat) |
| `gengage:chat:open` | `gengage-show` / `gengageShow` (widget: chat) |
| `gengage:chat:close` | `gengage-hide` / `gengageHide` (widget: chat) |
| `gengage:similar:add-to-cart` | `gengage-cart-add` / `gengageCartAdd` (sku, quantity) |
| `gengage:similar:product-click` | `gengage-product-detail` / `gengageProductDetail` (sku) |
| `gengage:qna:action` | `gengage-suggested-question` / `gengageSuggestedQuestion` (title, type) |
| `gengage:qna:open-chat` | `gengage-show` / `gengageShow` (widget: chat) |
| `gengage:chat:voice` | `gengage-voice-input` / `gengageVoiceInput` |
| `gengage:global:error` | `gengage-error` / `gengageError` (source, message) |

The widget-specific events listed in the canonical-only block above
(`gengageChatbotOpened`, `gengageChatbotMaximized`, `gengageQnaInput`, `gengageQnaButton`,
`gengageSimilarProductsImpression`, `gengageSimilarGroupingClick`,
`gengageSimilarProductClick`, `gengageSimilarProductAddToCart`, `gengageCompareProduct`,
`gengageInterfaceNotReady`, `GLOV_ON`) are dispatched directly from inside the widget
controllers via `track*` helpers and do not require the CustomEvent bridge.

### Usage

```ts
import { wireGADataLayer } from 'gengage-assistant-fe/common/ga-datalayer';

// After widget initialization
const unsubscribe = wireGADataLayer();

// To tear down (e.g. SPA route change)
unsubscribe();
```

Individual track functions (`trackCartAdd`, `trackShow`, `trackError`, etc.) can also be
called directly for custom integration points outside the event bus.

## Privacy and Safety

1. Do not send raw PII by default.
2. Gate raw free-text capture behind explicit config.
3. Support redaction before enqueue.
4. Keep payload size bounded.

## Validation Requirements

1. Unit tests for envelope shape and required fields.
2. Tests for each event family payload contract.
3. Tests that `session_id` and `correlation_id` are always populated.
4. Smoke test that basket/checkout events include attribution metadata.

## Backward Compatibility

- Additive payload fields are allowed.
- Breaking changes require `event_version` bump and migration notes.
- Do not silently rename event names.

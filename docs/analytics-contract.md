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

All events are lowercase, hyphen-separated, and prefixed with `gengage-` for easy filtering
in GA dashboards:

| GA Event | Description | Key Parameters |
|----------|-------------|----------------|
| `gengage-on-init` | Widget initialized | `gengage_widget` |
| `gengage-show` | Chat opened / widget shown | `gengage_widget` |
| `gengage-hide` | Chat closed / widget hidden | `gengage_widget` |
| `gengage-search` | User search query | `gengage_search_query`, `gengage_result_count` |
| `gengage-product-detail` | Product detail viewed | `gengage_sku`, `gengage_product_name` |
| `gengage-cart-add` | Product added to cart | `gengage_sku`, `gengage_quantity` |
| `gengage-like-product` | Favorite heart toggled | `gengage_sku` |
| `gengage-like-list` | Favorites list opened | — |
| `gengage-find-similars` | Find-similar requested from chat or SimBut | `gengage_sku` |
| `gengage-compare-selected` | Compare selected products | `gengage_skus`, `gengage_product_count` |
| `gengage-compare-preselection` | Product pre-selected for compare | `gengage_sku` |
| `gengage-compare-clear` | Comparison selection cleared | — |
| `gengage-compare-received` | Comparison results rendered | `gengage_product_count` |
| `gengage-suggested-question` | Suggested action clicked | `gengage_question_title`, `gengage_action_type` |
| `gengage-message-sent` | User sent a chat message | — |
| `gengage-message-received` | Assistant responded | — |
| `gengage-conversation-start` | New conversation started | — |
| `gengage-voice-input` | Voice speech-to-text used | — |
| `gengage-error` | Error occurred | `gengage_widget`, `gengage_error` |

### Event Bus Listeners

`wireGADataLayer()` subscribes to the following Gengage CustomEvents on `window`:

| CustomEvent | GA Event Fired |
|-------------|---------------|
| `gengage:chat:ready` | `gengage-on-init` (widget: chat) |
| `gengage:chat:open` | `gengage-show` (widget: chat) |
| `gengage:chat:close` | `gengage-hide` (widget: chat) |
| `gengage:similar:add-to-cart` | `gengage-cart-add` (sku, quantity) |
| `gengage:similar:product-click` | `gengage-product-detail` (sku) |
| `gengage:qna:action` | `gengage-suggested-question` (title, type) |
| `gengage:qna:open-chat` | `gengage-show` (widget: chat) |
| `gengage:chat:voice` | `gengage-voice-input` |
| `gengage:global:error` | `gengage-error` (source, message) |

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

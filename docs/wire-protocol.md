# Wire Protocol

The Gengage backend streams responses as **Newline-Delimited JSON (NDJSON)**
over a single HTTP response. This document is the authoritative contract between frontend widgets
and the backend.

> **Stability:** All endpoints use `/chat/*` paths. The wire protocol adapter
> normalizes backend event types to the canonical frontend model.

---

## Transport

- **Method:** `POST`
- **Content-Type request:** `multipart/form-data` (with `"request"` JSON field) **or** `application/json`
- **Content-Type response:** `application/x-ndjson; charset=utf-8`
- **Auth:** Integration-configured. Chat commonly uses no auth for process_action.
  Analytics endpoint auth is account-configured (see Analytics Transport/Auth section below).

### Request Body Format

**Primary format (with file attachment)**:
```
multipart/form-data:
  field "request": JSON string of BackendRequestFormat
  field "attachment": File upload for image similarity or voice input
```

**Standard format (no attachment)**:
```
application/json:
  Body is the JSON object of BackendRequestFormat directly
```

Our implementation uses `application/json` for non-attachment requests and `multipart/form-data`
only when an attachment (file) is present. Both formats are accepted by the backend.

---

## Base URLs

| Environment | Base URL | Notes |
|---|---|---|
| Your Backend | `<ASSISTANT-BACKEND-URL>` | Provided during Gengage onboarding |

The `middlewareUrl` is required when initializing any widget. There is no built-in default —
pass it explicitly via widget config or `initOverlayWidgets()`.

---

## Endpoints

| Endpoint | Method | Request | Response | Purpose |
|---|---|---|---|---|
| `/chat/process_action` | POST | `multipart/form-data` or `application/json` | `application/x-ndjson` | **Primary chat action** — all user interactions |
| `/chat/launcher_action` | POST | `application/json` | `application/x-ndjson` | Launcher widget content (product survey/questions) |
| `/chat/similar_products` | POST | `application/json` | JSON payload (not NDJSON) | Similar products for SimRel widget |
| `/chat/product_groupings` | POST | `application/json` | JSON payload (not NDJSON) | Grouped products for SimRel widget |

**Note:** All endpoints use `/chat/*` paths.

---

## Request Format

### BackendRequestFormat

```typescript
{
  account_id: string;        // Account identifier (e.g., "koctascomtr", "arcelikcomtr")
  type: string;              // Action type (e.g., "inputText", "launchSingleProduct")
  payload: Record<string, unknown>;  // Action-specific data — MUST be an object, never a string
  title: string;             // User-facing action title
  context?: ChatContext;     // Conversation state from previous backend response
  meta?: BackendRequestMeta; // Frontend metadata
  session_id?: string;       // Session identifier
  correlation_id?: string;   // Correlation identifier
  sku?: string;              // Current product SKU (convenience field)
  locale?: string;           // Locale code
}
```

**Critical:** `payload` MUST always be an object (`Record<string, unknown>`), never a raw string.
For user text messages, wrap as `{ text: "user message here" }`. Raw string payloads cause HTTP 500.

### BackendRequestMeta

Comprehensive metadata sent with every request:

```typescript
{
  outputLanguage: string;   // "TURKISH" | "ENGLISH" — controls response language
  parentUrl: string;        // Host page URL (from ?location= param)
  windowWidth: string;      // Viewport width as string
  windowHeight: string;     // Viewport height as string
  selfUrl: string;          // Widget URL (empty string if not applicable)
  id: string;               // Session ID
  userId: string;           // User ID
  appId: string;            // Account ID
  threads: unknown[];       // Thread metadata (currently empty array)
  createdAt: string;        // ISO timestamp of chat creation
  kvkkApproved: boolean;    // GDPR/KVKK consent status
  voiceEnabled?: boolean;   // Whether to generate TTS audio (from ?voice=true)
  threadId: string;         // Current thread ID (UUIDv7)
  isControlGroup: boolean;  // A/B test control group flag (from ?control_group=true)
  isMobile: boolean;        // Mobile viewport flag
  viewId?: string;          // Page view UUID
}
```

### ChatContext (sent by frontend, returned by backend)

The backend is **stateless/serverless**. All conversation state lives in the browser.
The frontend sends the full `context` object with every request.

```typescript
{
  panel: {
    screen_summary: string;           // Text description of current panel content
    screen_type: string;              // "product_details" | "product_list" | "comparison_table"
    screen_sku_list: string[];        // SKUs currently displayed (max 200)
    reviews_summary_skus: string[];   // SKUs for which reviews were shown (max 20)
    chat_mentioned_skus: string[];    // SKUs mentioned in chat by AI (max 20)
    ai_plist_summary: string;         // Summary of last AI-suggested products
    search_suggestions_skus: string[];// SKUs from search suggestions
  };
  messages: Array<{                   // Chat history (last 50 messages)
    role: "user" | "model";
    content: string;
  }>;
  message_id: string;                 // Previous backend message ID
}
```

**First request**: `context` is `{}`. Backend initializes `panel: {}` and `messages: []`.

**Subsequent requests**: Frontend sends back the last `context` received from the backend's
`type: "context"` response.

### Backend Request Parsing (Python)

```python
class ActionRequest(BaseModel):
    account_id: str
    context: dict = {}
    type: ActionType          # StrEnum
    payload: dict = {}
    meta: dict = {}
```

Normalizations applied by the backend:
- `"accountId"` aliased to `"account_id"`
- `"launchPDP"` normalized to `"launchSingleProduct"`
- `null` context/payload/meta become `{}`

---

## Action Types — Request Payloads

### `inputText` — User typed a message

```json
{
  "type": "inputText",
  "payload": {
    "text": "string",
    "page_details": { "page_title": "string", "page_description": "string" },
    "sku_list": ["string"],
    "is_launcher": 0,
    "is_suggested_text": 0,
    "cache_key": "string"
  }
}
```

- `is_launcher: 1` when triggered from the launcher widget
- `is_suggested_text: 1` when triggered by a suggested action chip click
- `cache_key` optional, used for cache tracking

### `launchSingleProduct` — Open product detail

```json
{ "type": "launchSingleProduct", "payload": { "sku": "string" } }
```

Also the **init action** — sent automatically when the chatbot opens on a PDP.
On silent init, `userText` is empty. Alias `launchPDP` is normalized to `launchSingleProduct`.

### `findSimilar` — Find similar products

```json
{
  "type": "findSimilar",
  "payload": {
    "sku": "string",
    "image_url": "string",
    "text": "string",
    "input": "string",
    "is_launcher": 0,
    "last_search_max_budget": null,
    "group_skus": ["string"]
  }
}
```

Either `sku` or `image_url` must be provided. If `image_url` is a short string without `://`,
it is treated as a SKU. `input` is the AI grouping feature name (from `aiProductGroupings` click).

### `getComparisonTable` — Compare products

```json
{ "type": "getComparisonTable", "payload": { "sku_list": ["string"] } }
```

Falls back to `screen_sku_list` from context if `sku_list` is empty.

### `addToCart` — Product added to cart

```json
{
  "type": "addToCart",
  "payload": {
    "sku": "string",
    "cart_code": "string",
    "quantity": 3,
    "error_message": "string"
  }
}
```

- `cart_code` — the merchant's internal cart/basket code for the product.
- `quantity` — always 1 (sent by the direct buy button).
- `error_message` — optional. When present, the backend generates error resolution suggestions
  instead of complementary product suggestions.

Backend responds with `outputText` + `suggestedActions` (cross-sell recommendations).
The backend does **not** send `panelLoading` or panel products for addToCart actions. The frontend
sends this with `preservePanel: true` (see [preservePanel Behavior](#preservepanel-behavior)).

### `reviewSummary` — Generate review summary

```json
{ "type": "reviewSummary", "payload": { "sku": "string" } }
```

### `launchVariant` — View product variant

```json
{ "type": "launchVariant", "payload": { "sku": "string" } }
```

No suggested actions in response.

### `like` — User liked a product

```json
{ "type": "like", "payload": { "sku": "string" } }
```

Backend responds with `outputText` + `suggestedActions` (e.g., "find similar to liked products").
The backend does **not** send `panelLoading` or panel products for like actions. The frontend
sends this with `preservePanel: true` (see [preservePanel Behavior](#preservepanel-behavior)).

### `moreProductList` — Load more products (pagination)

```json
{ "type": "moreProductList", "payload": {} }
```

Currently a no-op on the backend (end of list is always true).

### `launchDiscovery` — Discovery mode

> **Note**: `launchDiscovery` is **not** in the backend `ActionType` enum. It exists only
> in the frontend's `isInputAreaAction()` classifier for suggested-action chip placement.
> Use `exploreTogetherV2` for backend requests.

```json
{
  "type": "launchDiscovery",
  "payload": { "category_names": ["string"], "search_product": "string" }
}
```

### `exploreTogetherV2` — Discovery mode (backend)

```json
{
  "type": "exploreTogetherV2",
  "payload": { "category_names": ["string"], "search_product": "string" }
}
```

### `compareWithEngine` — Compare current product with alternatives

```json
{ "type": "compareWithEngine", "payload": { "sku": "string" } }
```

### `compareSelected` — Compare user-selected products

```json
{ "type": "compareSelected", "payload": { "sku_list": ["string"] } }
```

### `expandSimilar` — Expand similarity search

```json
{ "type": "expandSimilar", "payload": { "sku_list": ["string"] } }
```

### `reviewActions` — Review-related action

```json
{ "type": "reviewActions", "payload": { "sku": "string", "text": "string" } }
```

### `searchDiscovery` — Semantic search

```json
{
  "type": "searchDiscovery",
  "payload": {
    "category-keywords": "string",
    "include-keywords": "string",
    "query-en": "string"
  }
}
```

### `quickAnswer` — Quick Q&A

> **Note**: `quickAnswer` is **not** in the backend `ActionType` enum. It exists only in
> the frontend's `isInputAreaAction()` classifier. The backend uses `generateQnA` instead.

```json
{ "type": "quickAnswer", "payload": { "sku": "string" } }
```

### `generateQnA` — Generate Q&A for launcher

```json
{ "type": "generateQnA", "payload": { "sku": "string" } }
```

No suggested actions in response.

### `inputVoice` — Voice input (with audio attachment)

```json
{ "type": "inputVoice", "payload": {} }
```

Sent with `attachment` field in FormData. Backend transcribes the audio, then processes
the result as `inputText`.

### `redirect` — Redirect signal

```json
{ "type": "redirect", "payload": { "to": "voiceLead" } }
```

### `show` / `close` / `log` — Control actions

These produce only a `dummy` response and are logged. No content processing.

### `launcherQuestionClick` — Launcher question click

```json
{
  "type": "launcherQuestionClick",
  "payload": {
    "text": "string",
    "sku_list": ["string"],
    "is_suggested_text": 1,
    "is_launcher": 1,
    "cache_key": "string"
  }
}
```

Backend increments the click counter for cache tracking, then processes as `inputText`.

---

## Response Types — NDJSON Schemas

The backend streams these types. Each line is a complete JSON object followed by `\n`.

### Core response types

| Type | Description | Where rendered |
|------|-------------|----------------|
| `loading` | Loading/thinking indicator with optional thinking steps | Chat loading state |
| `panelLoading` | Panel skeleton loader trigger | MainPane skeleton |
| `similarLoading` | Similar products sub-panel loading state | Similar products skeleton |
| `context` | Conversation state update (emitted multiple times per request) | Not rendered — saved |
| `outputText` | Bot HTML text message with product mentions | ChatPane bubble |
| `productDetails` | Full product detail with images, variants, similars | MainPane + ChatPane card |
| `productDetailsSimilars` | Similar products for PDP sidebar (patches productDetails in-flight) | Patched into productDetails |
| `productList` | Product grid with LLM ranking | MainPane grid |
| `productListPreview` | Preview products before full list (triggers analyze animation) | ChatPane preview |
| `groupList` | Products organized into labeled groups/tabs | MainPane tabbed grid |
| `comparisonTable` | Product comparison with framework analysis | MainPane table |
| `suggestedActions` | Action buttons/chips | ChatPane pills + input area |
| `reviewHighlights` | Review highlights with sentiment classification | ChatPane cards |
| `aiProductSuggestions` | AI top picks (evaluate mode) — winner/compact cards | ChatPane rich cards |
| `aiProductGroupings` | AI product groups (explore/hybrid mode) | ChatPane cards |
| `aiSuggestedSearches` | Upsell search suggestions | ChatPane cards |
| `getGroundingReview` | Review grounding prompt card | ChatPane clickable card |
| `voice` | TTS audio (base64) | Audio playback |
| `redirect` | URL redirect signal | Bridge to host |
| `error` | Error response | Error display |
| `dummy` | No-op response | Not rendered |
| `chatStreamEnd` | End of stream — always last | Stream completion |
| `visitorDataResponse` | Visitor engagement data (only for launchSingleProduct) | Bridge to host |
| `formGetInfo` / `formTestDrive` / `formServiceRequest` / `launchFormPage` | Automotive form triggers | Bridge to host |
| `launcherContent` | Launcher widget content (forwarded to host bridge) | Host bridge |

---

### `loading` — Loading/thinking indicator

```json
{
  "type": "loading",
  "payload": {
    "text": "Analyzing product details...",
    "is_dynamic": false,
    "thinking_messages": ["Step 1...", "Step 2..."]
  }
}
```

- `is_dynamic: true` — meaningful content being streamed (AI thinking steps)
- `thinking_messages` — accumulating array of thinking step strings, emitted incrementally
- Frontend forwards as `loadingMessage` to host bridge

### `panelLoading` — Panel loading state

```json
{
  "type": "panelLoading",
  "payload": {
    "pending_type": "productDetails"
  }
}
```

`pending_type` values: `"productDetails"` | `"productList"` | `"comparisonTable"`

### `similarLoading` — Similar products sub-panel loading

```json
{
  "type": "similarLoading",
  "payload": {
    "pending_type": "productDetailsSimilars"
  }
}
```

### `context` — Conversation state update

Emitted **multiple times per request**: after panel-affecting responses (`productDetails`,
`productList`, `comparisonTable`) and always at stream end.

```json
{
  "type": "context",
  "payload": {
    "panel": {
      "screen_summary": "Product you are viewing...: SKU123: 'Brand - Product Name'",
      "screen_type": "product_details",
      "screen_sku_list": ["SKU123"],
      "reviews_summary_skus": [],
      "chat_mentioned_skus": [],
      "ai_plist_summary": "",
      "search_suggestions_skus": []
    },
    "messages": [
      { "role": "user", "content": "Show me similar products" },
      { "role": "model", "content": "Here are some similar products..." }
    ],
    "message_id": "abc123hex"
  }
}
```

### `outputText` — Bot text message

```json
{
  "type": "outputText",
  "payload": {
    "text": "<p>HTML formatted response with <strong>markup</strong></p>",
    "plain_text": "Plain text version",
    "product_mentions": [
      {
        "sku": "SKU123",
        "short_name": "Product Short Name",
        "reason": "Why this product",
        "reason_whyselect": "Why select",
        "reason_bestfor": "Best for...",
        "label": [{ "label": "Budget-friendly", "sentiment": "positive" }],
        "label_with_sentiment": [{ "label": "Budget-friendly", "sentiment": "positive" }]
      }
    ],
    "sku_to_product_item": {
      "SKU123": { /* full Product object — see Appendix A */ }
    },
    "conversation_mode": "EVALUATE",
    "is_error": false,
    "complete_form": false,
    "form_type": "getInfo"
  }
}
```

- `text` is HTML — must be sanitized before rendering (use `safe-html.ts`)
- `product_mentions` triggers inline product cards/links in chat
- `conversation_mode` values: `"EVALUATE"` | `"HYBRID"` | `"EXPLORE"` | `"REDIRECT"`
- If `voice_enabled`, a `voice` response follows immediately after each `outputText`

### `productDetails` — Full product detail

```json
{
  "type": "productDetails",
  "payload": {
    "productDetails": { /* Product object — see Appendix A */ }
  }
}
```

### `productDetailsSimilars` — Similar products for PDP sidebar

```json
{
  "type": "productDetailsSimilars",
  "payload": {
    "similarProducts": [ /* array of Product objects */ ]
  }
}
```

**Special frontend handling**: When received, the frontend fetches the `productDetails`
message payload from the same thread in storage, patches `productDetails.similars` with
the new data, re-saves to storage, and dispatches `invalidateMessage` to trigger re-render.

### `productList` — Product list/grid

```json
{
  "type": "productList",
  "payload": {
    "product_list": [ /* array of Product objects */ ],
    "llm_ranked_skus": ["SKU1", "SKU2"],
    "title": "Similar Products",
    "offset": 0,
    "end_of_list": true,
    "source": "search"
  }
}
```

- `source` values: `"search"` | `"similars"` | `"ai_response"`
- Backend re-orders `product_list` by `llm_ranked_skus` if present (max 20)
- Empty `product_list` is silently dropped (not sent to frontend)

### `productListPreview` — Preview products before full list

```json
{
  "type": "productListPreview",
  "payload": {
    "product_list": [ /* array of Product objects */ ]
  }
}
```

Frontend enables "analyze animation" and stores preview products before the full list arrives.

### `groupList` — Product groups/categories

```json
{
  "type": "groupList",
  "payload": {
    "group_list": [
      {
        "group_name": "Category Name",
        "product_list": [ /* array of Product objects */ ]
      }
    ],
    "filter_tags": [
      {
        "title": "Filter Label",
        "requestDetails": { "type": "...", "payload": {} }
      }
    ]
  }
}
```

### `comparisonTable` — Product comparison

```json
{
  "type": "comparisonTable",
  "payload": {
    "table": {
      "SKU123": { "Processor": "Intel i7", "RAM": "16GB" },
      "SKU456": { "Processor": "AMD Ryzen 7", "RAM": "32GB" }
    },
    "features_list": ["Processor", "RAM", "Storage"],
    "winner_product": [
      {
        "sku": "SKU456",
        "product_detail": { /* Product object */ },
        "selection_group": "string",
        "selection_group_name": "string",
        "selection_reason": "string"
      }
    ],
    "winner_hits": [
      {
        "sku": "SKU456",
        "positive_facets": ["Better RAM"],
        "negative_facets": ["Higher price"],
        "positive_facets_en": [],
        "negative_facets_en": [],
        "neutral_facets_en": []
      }
    ],
    "product_comparison_framework": {
      "introduction": "string",
      "key_differences": { "Processor": "<p>The AMD...</p>" },
      "key_differences_overview": {},
      "recommended_choice": { "SKU456": "<p>Best overall...</p>" },
      "recommended_choice_sku": "SKU456",
      "special_considerations": { "SKU123": "<p>Consider if...</p>" },
      "conclusion": "string",
      "criteria": {},
      "criteria_en": {},
      "criteria_view": {},
      "criteria_view_en": {},
      "criteria_view_short": {},
      "criteria_view_en_short": {},
      "compared_field_names": ["Processor", "RAM"]
    },
    "multiple_product_details": [ /* array of full Product objects */ ],
    "user_preferences": [],
    "sku_url_list": [{ "SKU123": "https://..." }, { "SKU456": "https://..." }],
    "sku_cart_code_list": [{ "SKU123": "CART123" }],
    "launch_product_object": {
      "SKU123": { "type": "launchSingleProduct", "payload": { "sku": "SKU123" } }
    }
  }
}
```

### `suggestedActions` — Action buttons

```json
{
  "type": "suggestedActions",
  "payload": {
    "actions": [
      {
        "title": "Show reviews",
        "icon": "review",
        "image": null,
        "requestDetails": { "type": "reviewSummary", "payload": { "sku": "SKU123" } }
      },
      {
        "title": "Find similar",
        "icon": "similar",
        "image": "https://...",
        "requestDetails": { "type": "findSimilar", "payload": { "sku": "SKU123" } }
      }
    ]
  }
}
```

**Icon types**: `"search"` | `"review"` | `"info"` | `"similar"` | `"other"` | `null`

Actions are split by `isInputAreaAction()`:
- **Input area chips** (near text input): icon `search`|`info`|`review`|`similar`, or type
  `launchDiscovery`|`exploreTogetherV2`|`quickAnswer`|`reviewSummary`|`searchDiscovery`
- **Chat actions** (in message flow): everything else

Only shown for the current thread and only if `!hideSuggestedActions`.

### `reviewHighlights` — Review highlights

```json
{
  "type": "reviewHighlights",
  "payload": {
    "reviews": [
      {
        "review_class": "positive",
        "review_text": "Great battery life, lasts all day",
        "review_rating": "5",
        "review_tag": "Battery"
      }
    ],
    "sku": "SKU123"
  }
}
```

`review_class` values: `"positive"` | `"negative"` | `"neutral"`

### `aiProductSuggestions` — AI Top Picks

```json
{
  "type": "aiProductSuggestions",
  "payload": {
    "product_suggestions": [
      {
        "sku": "SKU1",
        "role": "winner",
        "short_name": "Product A",
        "labels": [{ "label": "Best Overall", "sentiment": "positive" }],
        "reason": "This product offers the best combination of features...",
        "expert_quality_score": 8.5,
        "review_highlight": "Users love the battery life",
        "product_item": { /* Product object */ },
        "requestDetails": { "type": "launchSingleProduct", "payload": { "sku": "SKU1" } }
      }
    ]
  }
}
```

`role` values: `"winner"` | `"best_value"` | `"best_alternative"`

### `aiProductGroupings` — AI product groups (explore/hybrid mode)

```json
{
  "type": "aiProductGroupings",
  "payload": {
    "product_groupings": [
      {
        "name": "Budget-Friendly Options",
        "image": "https://...",
        "labels": ["Under 5000 TL", "Good value"],
        "sku": "SKU123",
        "requestDetails": {
          "type": "findSimilar",
          "payload": {
            "sku": "SKU123",
            "input": "Budget-Friendly Options",
            "last_search_max_budget": 5000,
            "group_skus": ["SKU123", "SKU456", "SKU789"]
          }
        }
      }
    ]
  }
}
```

### `aiSuggestedSearches` — Upsell search suggestions

```json
{
  "type": "aiSuggestedSearches",
  "payload": {
    "suggested_searches": [
      {
        "chosen_attribute": "string",
        "short_name": "Premium Models",
        "detailed_user_message": "Looking for higher-end options?",
        "why_different": "Optional long copy — not used for the compact card keyword line",
        "display_keywords": ["Keyword one", "Keyword two"],
        "representative_product_sku": "SKU789",
        "group_skus": ["SKU789", "SKU101"],
        "image": "https://..."
      }
    ]
  }
}
```

Each `suggested_searches` item should provide `short_name`, `detailed_user_message`,
`representative_product_sku`, `group_skus`, and may also include `image`, `chosen_attribute`,
`requestDetails`, `why_different`, and `display_keywords`.

**`display_keywords`**: Optional string array. When present, the client builds the tertiary browse line
from these values (joined with ` • `). If omitted, the UI derives short fragments from
`chosen_attribute` and `short_name` only — never full-sentence `why_different`.

Suggestions follow a strict superiority filter — only upgrade/upsell direction, never lateral or cheaper alternatives.

### `getGroundingReview` — Review grounding prompt

```json
{
  "type": "getGroundingReview",
  "payload": {
    "title": "What do customers say?",
    "text": "123 reviews available",
    "review_count": "123",
    "requestDetails": { "type": "reviewSummary", "payload": { "sku": "SKU123" } }
  }
}
```

Rendered as a clickable card in chat that triggers `reviewSummary` when clicked.

### `voice` — Text-to-speech audio

```json
{
  "type": "voice",
  "payload": {
    "text": "transcribed text",
    "audio_base64": "base64-encoded-audio-data",
    "content_type": "audio/ogg"
  }
}
```

- `text` — the transcribed/source text that was converted to speech.
- `audio_base64` — base64-encoded audio data.
- `content_type` — MIME type of the audio (e.g., `"audio/ogg"`, `"audio/mpeg"`). Defaults to
  `"audio/ogg"` if absent.

Only generated when `meta.voiceEnabled = true`. Emitted immediately after each `outputText`.

**Frontend playback:** The frontend plays `audio_base64` automatically via `playTtsAudio()`
from `src/common/tts-player.ts`. Before built-in playback, a cancelable `gengage:chat:voice`
CustomEvent is dispatched with `{ detail: { payload } }`. Hosts can call `preventDefault()`
to suppress the built-in player and substitute their own audio handling.

### `redirect` — URL redirect signal

```json
{
  "type": "redirect",
  "payload": { "to": "voiceLead" }
}
```

Frontend forwards to host bridge as `{ type: 'redirect', payload: { to: 'voiceLead' } }`.

### `error` — Error response

```json
{
  "type": "error",
  "payload": { "text": "Error message string" }
}
```

### `dummy` — No-op response

```json
{ "type": "dummy", "payload": {} }
```

Returned for `show`, `close`, `log` actions and control group requests. No `chatStreamEnd` follows.

### `chatStreamEnd` — End of stream

```json
{ "type": "chatStreamEnd", "payload": {} }
```

Always the last message in the stream (except for `dummy` responses).

### `visitorDataResponse` — Visitor engagement data

```json
{
  "type": "visitorDataResponse",
  "payload": {
    "message": {
      "type": "plain_text",
      "data": "string"
    },
    "action": {
      "type": "string",
      "payload": {}
    }
  }
}
```

`message.type` values: `"plain_text"` | `"comment"` | `"quick_search"` | `"text_with_action"`

Only present when the action was `launchSingleProduct`. Forwarded to host bridge as `engagingMessage`.

### Form responses

```json
{
  "type": "formGetInfo",
  "payload": {
    "redirect": true,
    "...": "form-specific fields"
  }
}
```

Types: `"formGetInfo"` | `"formTestDrive"` | `"formServiceRequest"` | `"launchFormPage"`

Frontend forwards to host as `{ type: 'glovOtokoc', payload: { type: 'getInfo'|'testDrive'|..., data: payload } }`.
If `redirect: true`, also closes the chat.

---

## Response Sequences

> **Note:** Sequences below show the typical happy-path order. Actual sequences depend on
> intent analysis, account type, cache hits, and product data availability.

### `launchSingleProduct` (PDP init)

```
panelLoading → loading → productDetails → context → getGroundingReview →
similarLoading → loading → outputText → productDetailsSimilars →
suggestedActions → context → chatStreamEnd
```

### `inputText` (user message)

```
loading → productList → context → loading(thinking) → outputText →
aiProductGroupings OR aiProductSuggestions → loading → productList →
context → outputText → suggestedActions → outputText(blog) →
context → chatStreamEnd
```

### `findSimilar`

```
loading → panelLoading → productList → context → loading(thinking) →
outputText → aiProductSuggestions → suggestedActions → context → chatStreamEnd
```

### `getComparisonTable`

```
loading → loading → loading(winner, is_dynamic: true) → panelLoading →
comparisonTable → context → suggestedActions → context → chatStreamEnd
```

### `addToCart`

```
loading → loading → outputText → suggestedActions → context → chatStreamEnd
```

### `reviewSummary`

```
loading → loading(thinking) → outputText → reviewHighlights →
suggestedActions → context → chatStreamEnd
```

### `like`

```
outputText → suggestedActions → context → chatStreamEnd
```

### `launchVariant`

```
panelLoading → productDetails → context → context → chatStreamEnd
```

### `show` / `close` / `log` (control actions)

```
dummy
```

No `context`, no `chatStreamEnd`.

### KVKK/Consent pre-check

If `meta.kvkkApproved === false` and the account has a consent message:

```
outputText(consent message) → [normal action sequence]
```

### Control group circuit break

If `meta.isControlGroup === true`:

```
dummy
```

Logged, no further processing.

---

## preservePanel Behavior

The `like` and `addToCart` actions use `preservePanel: true` on the frontend. This is a
frontend-only flag passed to `_sendAction()` that changes how the request is dispatched:

| Behavior | Normal action | `preservePanel: true` |
|---|---|---|
| Panel cleared before request | Yes (loading skeleton shown) | **No** — current panel stays visible |
| Previous streams aborted | Yes (`AbortController.abort()`) | **No** — concurrent streams allowed |
| Bot response renders in | Chat pane + panel (if panel data) | **Chat pane only** (text + suggested actions) |

This means `like` and `addToCart` actions run as lightweight concurrent streams alongside
any active panel content. The backend cooperates by not sending `panelLoading` or
panel-level response types (`productDetails`, `productList`, `comparisonTable`) for these
action types — only `outputText`, `suggestedActions`, `context`, and `chatStreamEnd`.

---

## Context Object Lifecycle

```
Frontend                                    Backend
────────                                    ───────

1. First request:
   context: {}              ──────────►     Initializes panel: {}, messages: []

2. Backend processes:
                                            After productDetails / productList / comparisonTable:
                            ◄──────────     { type: "context", payload: { panel, messages } }
                                            At stream end (always):
                            ◄──────────     { type: "context", payload: { panel, messages } }

3. Frontend saves:
   context persisted to storage keyed by threadId

4. Next request:
   context loaded from storage for currentThreadId
   → sends in request.context     ──────►  Backend reads context.panel, context.messages
```

### Persistent panel keys (survive across requests)

Only these keys are included in the context panel the backend sends back and the frontend stores:

| Key | Description |
|-----|-------------|
| `screen_summary` | Text description of current panel |
| `screen_type` | `"product_details"` \| `"product_list"` \| `"comparison_table"` |
| `screen_sku_list` | SKUs on screen (max 200) |
| `reviews_summary_skus` | Reviewed SKUs (max 20) |
| `chat_mentioned_skus` | AI-mentioned SKUs (max 20) |
| `ai_plist_summary` | Summary of AI product recommendations |
| `search_suggestions_skus` | Suggested search SKUs |

### Panel update points

| After yielding | Panel updates |
|---|---|
| `productDetails` | `screen_type = "product_details"`, `screen_summary`, `screen_sku_list = [sku]` |
| `productList` | `screen_type = "product_list"`, `screen_summary`, `screen_sku_list` (all SKUs) |
| `comparisonTable` | `screen_type = "comparison_table"`, `screen_summary`, `screen_sku_list` |
| `reviewHighlights` | Append to `reviews_summary_skus` (max 20) |
| `outputText` | Update `ai_plist_summary`, extend `chat_mentioned_skus` if product_mentions |
| `aiProductSuggestions` | Update `ai_plist_summary`, extend `chat_mentioned_skus` (max 20) |
| `aiProductGroupings` | Extend `chat_mentioned_skus` with group SKUs (max 20) |

### Context load fallback chain

1. Try exact match for `currentThreadId`
2. If empty: get latest non-null context in the session
3. If still empty: use empty context `{}`

---

## Thread Model

Every request-response cycle creates a new **UUIDv7** `threadId`. Messages are grouped into
threads. The `currentThreadId` acts as a visibility cursor:

```typescript
// A message is visible if:
message.threadId <= currentThreadId  // OR message has no threadId
```

UUIDv7 is time-ordered and lexicographically sortable, enabling string comparison for
temporal ordering: `threadA < threadB` means A happened before B.

### Navigation

| Action | Behavior |
|---|---|
| **Back** | Find last navigatable thread with `threadId < currentThreadId`, move cursor |
| **Forward** | Find first navigatable thread with `threadId > currentThreadId`, move cursor |
| **Jump to latest** | Set cursor to the last navigatable thread |

Navigatable thread types: `comparisonTable`, `groupList`, `productDetails`, `productDetailsSimilars`, `productList`

### Branching (typing from a rewound position)

When a user types while the cursor is rewound (`lastThreadId > currentThreadId`):

1. Messages where `currentThreadId < threadId <= lastThreadId` are deleted
2. Contexts after `currentThreadId` are deleted from storage
3. Context is loaded from the rewound position
4. New branch continues from there

```
Timeline:  A ── B ── C ── D ── E     (user rewinds to B, types new message)
                  ↑ cursor

After branch:  A ── B ── F           (C, D, E deleted; F is new branch)
```

---

## Launcher Endpoints

### `POST /chat/launcher_action`

Request: `{ account_id, sku, output_language, mode }` where `mode` is `"survey"` (default)
or `"questions"` (buying-hesitation questions).

Response (NDJSON stream) — four launcher response types:

**`text`** — Text announcement:
```json
{ "type": "text", "payload": { "type": "launcherAction", "text": "Let's examine this product together", "payload": { "theme": "light" } } }
```

**`productItem`** — Product info:
```json
{ "type": "productItem", "payload": { "sku": "SKU123", "name": "Product Name", "price": 1299.99, "image_url": "https://...", "url": "/product/SKU123" } }
```

**`text_image`** — Text with image action:
```json
{ "type": "text_image", "payload": { "type": "launcherAction", "text": "Find similar products", "image_url": "https://...", "theme": "dark", "action": { "type": "findSimilar", "payload": { "sku": "SKU123", "is_launcher": 1 } } } }
```

**`quick_qna`** — Quick Q&A questions:
```json
{ "type": "quick_qna", "payload": { "type": "launcherAction", "theme": "dark", "action_list": [{ "title": "Question text", "icon": "other", "requestDetails": { "type": "launcherQuestionClick", "payload": { "text": "...", "sku_list": ["SKU123"] } } }] } }
```

---

## Wire Protocol Adapter

The backend streams the event types listed above. The wire protocol adapter
(`src/common/protocol-adapter.ts`) normalizes these to the canonical frontend model:

| Backend Type | Frontend Normalized Type |
|---|---|
| `outputText` | `text_chunk` (with `final: true`) |
| `suggestedActions` | `ui_spec` (ActionButtons) |
| `productList` | `ui_spec` (ProductGrid) |
| `groupList` | `ui_spec` (ProductGrid with groups) |
| `productDetails` | `ui_spec` (ProductDetailsPanel) with `panelHint: 'panel'` |
| `productDetailsSimilars` | `ui_spec` (SimilarProducts) — patches in-flight |
| `comparisonTable` | `ui_spec` (ComparisonTable) with `panelHint: 'panel'` |
| `reviewHighlights` | `ui_spec` (ReviewHighlights) |
| `aiProductSuggestions` | `ui_spec` (AITopPicks) |
| `aiProductGroupings` | `ui_spec` (ActionButtons) |
| `aiSuggestedSearches` | `ui_spec` (ActionButtons) |
| `getGroundingReview` | `ui_spec` (ActionButton) |
| `prosAndCons` | `ui_spec` (ProsAndCons) |
| `loading` | `metadata` (loading state) |
| `context` | `metadata` (context update) |
| `chatStreamEnd` | `done` |
| `error` | `error` |
| `redirect` | `action` (navigate) |

Unknown event types are logged and safely ignored.

---

## Analytics Transport/Auth

Analytics write transport is account-configured:
1. Default planned write endpoint: `/analytics` (or configured override).
2. Fire-and-forget transport: `sendBeacon` preferred, `fetch keepalive` fallback.
3. Auth mode is config-driven (header/body/query as required by account backend).

Dashboard analytics reads use account-configured auth (header/body/query).

---

## Correlation ID

All requests include `session_id` and `correlation_id` (typically the same value).
This ties analytics events across widgets into a single user journey.

---

## Appendix A: Product Object Schema

```typescript
{
  sku: string;
  name: string;
  brand: string;
  rating: number;
  review_count: number;
  cart_code: string;
  description: string;
  description_html: string;
  images: string[];
  price_currency: string;          // e.g., "TRY"
  price: number;
  price_discounted: number;
  price_discount_rate: number;
  price_async?: number;            // Async price (fetched separately)
  price_async_discounted?: number;
  price_async_discount_rate?: number;
  facet_tags: string[];
  features: Array<{ name: string; value: string }>;
  url: string;
  variants?: Array<{
    name: string;
    sku: string;
    value: string;
    price: number;
    price_currency: string;
    price_discounted: number;
    image: string;
    in_stock: boolean;
  }>;
  selection_reasons: Record<string, { text: string }>;
  similars: Product[] | null;
  discount_reason: string;
  short_name: string;
  in_stock: boolean;
  promotions: string[];
  reviews: Array<{ content: string; star: number }>;
  has_no_online_reviews?: boolean;
  // Present in full ProductDetail responses:
  category_ids?: string[];
  category_names?: string[];
  documents?: Array<{ title: string; url: string; image_url: string; snippet: string }>;
}
```

---

## Appendix B: ActionType Enum (Backend)

```python
class ActionType(StrEnum):
    LAUNCH_PDP = "launchSingleProduct"
    MORE_PRODUCT_LIST = "moreProductList"
    LAUNCH_VARIANT = "launchVariant"
    ADD_TO_CART = "addToCart"
    LIKE = "like"
    FIND_SIMILAR = "findSimilar"
    TEXT_INPUT = "inputText"
    VOICE_INPUT = "inputVoice"
    COMPARE = "getComparisonTable"
    SHOW = "show"
    CLOSE = "close"
    LOG = "log"
    LAUNCHER_QUESTION_CLICK = "launcherQuestionClick"
    GENERATE_REVIEW_SUMMARY = "reviewSummary"
    GENERATE_QUICK_QNA = "generateQnA"
    V2_COMPARE_WITH_ENGINE = "compareWithEngine"
    V2_COMPARE_SELECTED = "compareSelected"
    V2_EXPAND_SIMILAR = "expandSimilar"
    V2_SEARCH_DISCOVERY = "searchDiscovery"
    V2_EXPLORE_TOGETHER = "exploreTogetherV2"
    V2_LAUNCH_FORM_PAGE = "launchFormPage"
    V2_REVIEW_ACTIONS = "reviewActions"
    REDIRECT = "redirect"
```

Note: `launchDiscovery` and `quickAnswer` are frontend-only classifier types that do not
appear in this enum. The backend never routes them as distinct actions.

---

## Appendix C: ResponseType Enum (Backend)

```python
class ResponseType(StrEnum):
    LOADING = "loading"
    PANEL_LOADING = "panelLoading"
    SIMILAR_SUBPANEL_LOADING = "similarLoading"
    CHAT_END = "chatStreamEnd"
    CONTEXT = "context"
    NOOP = "dummy"
    ERROR = "error"
    PRODUCT_ITEM = "productItem"
    PRODUCT_DETAILS = "productDetails"
    PRODUCT_DETAILS_SIMILARS = "productDetailsSimilars"
    PRODUCT_LIST = "productList"
    COMPARISON_TABLE = "comparisonTable"
    TEXT = "outputText"
    SUGGESTED_ACTION = "suggestedActions"
    REVIEWS_HIGHLIGHTS = "reviewHighlights"
    AI_PRODUCT_SUGGESTIONS = "aiProductSuggestions"
    AI_PRODUCT_GROUPINGS = "aiProductGroupings"
    AI_SUGGESTED_SEARCHES = "aiSuggestedSearches"
    GET_GROUNDING_REVIEW = "getGroundingReview"
    VOICE = "voice"
    LOG = "log"                          # Internal only, never sent to frontend
    LAUNCHER_ACTION = "launcherAction"
    LAUNCHER_TEXT = "text"
    LAUNCHER_TEXT_IMAGE = "text_image"
    LAUNCHER_QUICK_QNA = "quick_qna"
    REDIRECT = "redirect"
```

---

> **Note:** This repo contains UI and client-side logic only.
> Backend services are proprietary and require a [gengage.ai](https://gengage.ai) subscription.

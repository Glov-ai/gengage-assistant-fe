# Widget Definitions

This document maps every NDJSON response type from the backend to its frontend rendering —
where it appears (chat pane vs panel), what the UI looks like, and how users interact with it.

> **Tip:** Run `npm run catalog` to see every component rendered live
> with mock data at `http://localhost:3002`.

---

## Two-Pane Layout

```
┌─────────────────────────────────────────────────────────────┐
│                    Chat Widget                               │
│                                                              │
│  ┌─────────── Panel ─────────────┬──── Chat Pane ────────┐  │
│  │  (Desktop only — left side)   │  (Right side/mobile)  │  │
│  │                               │                       │  │
│  │  TopBar (title + nav arrows)  │  ChatHeader           │  │
│  │  ┌─────────────────────────┐  │  ┌─────────────────┐  │  │
│  │  │ ProductDetails          │  │  │ Messages         │  │  │
│  │  │   OR                    │  │  │   Thread 1:      │  │  │
│  │  │ ProductGrid             │  │  │    UserMsg       │  │  │
│  │  │   OR                    │  │  │    BotText       │  │  │
│  │  │ ComparisonTable         │  │  │    Suggestions   │  │  │
│  │  │   OR                    │  │  │   Thread 2:      │  │  │
│  │  │ CategoriesGrid          │  │  │    UserMsg       │  │  │
│  │  │   OR                    │  │  │    BotText       │  │  │
│  │  │ PanelLoading skeleton   │  │  │    AITopPicks    │  │  │
│  │  └─────────────────────────┘  │  │    ReviewCards   │  │  │
│  │                               │  └─────────────────┘  │  │
│  │  ComparisonSelectButton       │  ChatInput            │  │
│  └───────────────────────────────┴───────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Desktop**: Both panes visible. Panel content on the left; chat messages on the right.

**Mobile**: Only the chat pane is visible. Panel-type content (product lists, comparison tables)
renders as inline mobile variants inside the chat pane.

### Panel Response Types

These response types render in the Panel (desktop) or as compact mobile variants in the chat pane:

```
comparisonTable, groupList, productDetails, productDetailsSimilars, productList
```

All other response types render exclusively in the chat pane.

---

## Response Type → UI Component Map

| NDJSON `type` | Chat Pane | Panel | Mobile Behavior |
|---|---|---|---|
| `outputText` | Text bubble | — | Same |
| `prosAndCons` | Pros & Cons card | — | Same |
| `reviewHighlights` | Review cards | — | Same |
| `suggestedActions` | Action chips/buttons | — | Same |
| `productDetails` | ProductSummaryCard (inline) | Full detail view | Chat pane only |
| `productList` | Horizontal scroll (mobile only) | Product grid | Chat pane only |
| `groupList` | Horizontal scroll (mobile only) | Tabbed category grid | Chat pane only |
| `comparisonTable` | Compact compare (mobile only) | Full comparison table | Chat pane only |
| `aiProductSuggestions` | AI Top Picks cards | — | Same |
| `aiProductGroupings` | Category group cards | — | Same |
| `aiSuggestedSearches` | Upsell suggestion cards | — | Same |
| `getGroundingReview` | Clickable review prompt | — | Same |
| `loading` | Loading indicator (conditional) | — | Same |
| `panelLoading` | — | Skeleton loader | — |
| `context` | Not rendered (saved to storage) | — | — |
| `chatStreamEnd` | Not rendered | — | — |
| `dummy` | Not rendered | — | — |
| `error` | Error banner | — | Same |
| `voice` | TTS audio playback (no visual) | — | Same |
| `handoffNotice` | Handoff alert card | — | Same |
| `redirect` | Bridge message to host | — | Same |
| `ui_spec:PhotoAnalysisCard` | Skin analysis card (beauty) | — | Same |
| `ui_spec:BeautyPhotoStep` | Selfie upload prompt (beauty) | — | Same |
| `productDetailsSimilars` | Not rendered directly — patches `productDetails` | — | — |
| `productListPreview` | Analyze animation overlay | — | Same |
| `visitorDataResponse` | Bridge message to host | — | Same |
| `launcherContent` | Bridge message to host | — | Same |
| `formGetInfo` / `formTestDrive` / `formServiceRequest` / `launchFormPage` | Bridge to host | — | Same |

---

## Render Specs per Response Type

### `outputText` — Text bubble

**Payload fields used**: `text` (HTML), `plain_text`, `product_mentions`, `sku_to_product_item`, `conversation_mode`

```
┌─────────────────────────────────┐
│  [User avatar]  "User message"   │  ← right-aligned user bubble
│                                   │
│  [Bot avatar]                     │  ← left-aligned bot bubble
│  HTML rendered text with          │
│  product cards inline             │
│  [SKU123 mini card] [SKU456]      │
└─────────────────────────────────┘
```

**Bot messages**: Render `payload.text` as sanitized HTML. Use `safe-html.ts` — never inject
raw backend HTML directly.

**Typewriter effect** (last message in latest thread):
- HTML is chunked at block-level elements (`p`, `div`, `h1–h6`, `li`, `ul`, `ol`, etc.)
- One block revealed at a time, ~30ms per chunk
- Skipped if the HTML contains a `<table>` — full content shown immediately
- Mobile auto-scroll: checks if user is within 300px of bottom every 100ms while typing

**Product mentions**: If `product_mentions` is populated, product names in the text become
clickable links that dispatch `launchSingleProduct` for the referenced SKU.

**Rollback**: Clicking a past user message rolls back the thread cursor to that point.
Only enabled when the user message is from a previous thread.

---

### `productDetails` — Full product detail

**Payload fields used**: `productDetails` (see [Appendix A in wire-protocol.md](wire-protocol.md#appendix-a-product-object-schema))

**Panel (full detail view)**:
```
┌─────────────────────────────────┐
│  [Image Gallery — swipeable]     │
│  ┌───┐ ┌───┐ ┌───┐  thumbnails  │
│                                  │
│  Brand Name                      │
│  Product Full Name               │
│  ★★★★½ (123 reviews)            │
│                                  │
│  ₺1.499  ~~₺1.999~~  %25 off   │
│  [Promotions badges]             │
│                                  │
│  [−][1][+][Add to Cart] [♡] [↗]  │
│                                  │
│  Variants:                       │
│  [Red ₺1499] [Blue ₺1599]       │
│                                  │
│  Features:                       │
│  Color: Red | Size: Large        │
│                                  │
│  Similar Products:               │
│  ┌────┐ ┌────┐ ┌────┐           │
└─────────────────────────────────┘
```

**Chat pane (ProductSummaryCard)** — inline compact card rendered when `productDetails` arrives,
mirroring production LaunchSingleProduct behavior. CSS class: `.gengage-chat-product-summary`.
```
┌─────────────────────────────────┐
│  [64×64 img] Brand - Product Name│
│              ★★★★½ · ₺1.499     │
│              [View Details →]    │
└─────────────────────────────────┘
```

Source: `src/chat/components/ProductSummaryCard.ts`

**Image gallery**: Main image + thumbnail row. Hovering the main image shows a
"Find Similar" button (top-right) that dispatches `findSimilar` with the product image URL.

**Async pricing**: If `price_async` is present, shows a skeleton for ~300ms then updates
with the async price fields (`price_async_discounted`, `price_async_discount_rate`).

**Buy button**: All Add to Cart buttons are direct buy buttons that send `quantity: 1`.
In compact mode (product cards in grids), the button displays a cart icon only.

**Share button**: An icon-button in the action row, shown only when the product has a URL.
Uses `navigator.share()` when available (mobile), falls back to `navigator.clipboard.writeText()`
with a brief checkmark tooltip. Shares the product URL and name.

**Interactions**:
- Image swipe/click — cycle through images
- Variant click → `launchVariant` with the variant's SKU
- Add to Cart → sends action to backend via `_sendAction({ preservePanel: true })`, then
  dispatches host bridge `glovAddToBasket` with `{ sku, quantity, cart_code }`.
  The panel stays visible while the backend processes. Backend responds with `outputText`
  and `suggestedActions` (cross-sell recommendations) in the chat pane.
- Add to Favorites (heart) → sends action to backend via `_sendAction({ preservePanel: true })`
  and saves to local storage favorites. The panel stays visible while the backend processes.
  Backend may respond with cross-sell suggestions in the chat pane.
- Share → `navigator.share()` / clipboard fallback (see Share button above)
- Similar product click → `launchSingleProduct`

---

### `productDetailsSimilars` — Similar products patch

**No direct UI component.** When received:
1. Fetch the `productDetails` payload for the current thread from storage
2. Patch `productDetails.similars = payload.similarProducts`
3. Re-save to storage and invalidate the message to trigger re-render
4. The "Similar Products" section in the full detail view now populates

---

### `productList` — Product grid

**Payload fields used**: `product_list`, `title`, `offset`, `end_of_list`, `source`, `llm_ranked_skus`

**Panel (full grid)**:
```
┌─────────────────────────────────┐
│  [Sort: Related ▼] [Price ▲▼]   │
│                                  │
│  ┌──────┐ ┌──────┐ ┌──────┐     │
│  │[img] │ │[img] │ │[img] │     │
│  │Name  │ │Name  │ │Name  │     │
│  │★★★★  │ │★★★½  │ │★★★★★ │     │
│  │₺799  │ │₺999  │ │₺1199 │     │
│  │[−1+🛒]│ │[−1+🛒]│ │[−1+🛒]│     │
│  └──────┘ └──────┘ └──────┘     │
│                                  │
│  [Compare Selected (2)]          │  ← shown when ≥2 selected
└─────────────────────────────────┘
```

**Mobile (horizontal scroll in chat)**:
```
◄ [card1] [card2] [card3] ►
```

**Sort options**:
- `related` — backend order (`llm_ranked_skus`)
- `price asc` — cheapest first; items with `price=0` pushed to end
- `price desc` — most expensive first

**Comparison selection**: Each card has a checkbox. When 2+ products are selected, a
floating "Compare Selected" button appears and dispatches `compareSelected` with the SKU list.

**Interactions**:
- Product card click → `launchSingleProduct`
- Cart button → host bridge `glovAddToBasket` with quantity 1.
- Find Similar → `findSimilar`
- View More → `moreProductList`

---

### `groupList` — Tabbed category grid

**Payload fields used**: `group_list` (array of `{ group_name, product_list }`), `filter_tags`

**Panel**:
```
┌─────────────────────────────────┐
│  [Tab: Electronics] [Tab: Home]  │
│                                  │
│  Electronics:                    │
│  ┌──────┐ ┌──────┐ ┌──────┐     │
│  │prod1 │ │prod2 │ │prod3 │     │
│  └──────┘ └──────┘ └──────┘     │
│                                  │
│  Filter Tags:                    │
│  [Under ₺1000] [Premium]        │
└─────────────────────────────────┘
```

**Interactions**:
- Tab click — switches visible category
- Product card click → `launchSingleProduct`
- Filter tag click → dispatches the tag's `requestDetails` action

---

### `comparisonTable` — Product comparison

**Payload fields used**: `table`, `features_list`, `winner_product`, `winner_hits`,
`product_comparison_framework`, `multiple_product_details`, `sku_url_list`, `launch_product_object`

**Panel**:
```
┌─────────────────────────────────────────────┐
│  Comparison Results                          │
│                                              │
│  ★ Winner: Product B (Recommended)           │
│  "Best overall value..."                     │
│                                              │
│  ┌──────────┬──────────┬──────────┐          │
│  │ Feature  │ Prod A   │ Prod B ★ │          │
│  ├──────────┼──────────┼──────────┤          │
│  │ Price    │ ₺1999    │ ₺1499    │          │
│  │ RAM      │ 16GB     │ 32GB     │          │
│  │ Storage  │ 512GB    │ 1TB      │          │
│  └──────────┴──────────┴──────────┘          │
│                                              │
│  Key Differences:                            │
│  [HTML formatted analysis per field]          │
│                                              │
│  Special Considerations:                     │
│  [Collapsible, amber border]                 │
│                                              │
│  [View Product A] [View Product B]           │
└─────────────────────────────────────────────┘
```

**Winner column**: Product matching `product_comparison_framework.recommended_choice_sku`
gets a visual emphasis (border, badge). The winner column header shows a check-circle icon.

**Key Differences**: Rendered from `product_comparison_framework.key_differences` (HTML).

**Special Considerations**: Collapsible section per product, rendered from
`product_comparison_framework.special_considerations` (HTML per SKU).

**Interactions**:
- "View Product" → `launchSingleProduct`
- Product image click → `launchSingleProduct`

---

### `suggestedActions` — Action chips/buttons

**Payload fields used**: `actions` (array of `{ title, icon, image, requestDetails }`)

```
┌─────────────────────────────────┐
│  [🔍 Show reviews]              │  ← input area chip
│  [🔍 Compare products]          │  ← input area chip
│                                  │
│  [📷 Find similar to this]      │  ← chat action with image
│  [Find similar]                  │  ← chat action text-only
└─────────────────────────────────┘
```

Actions are split into two groups by `isInputAreaAction()`:

**Input area chips** (shown near the text input, horizontal scroll):
- Icon is `search`, `info`, `review`, or `similar`, **or**
- Action type is `launchDiscovery`, `exploreTogetherV2`, `quickAnswer`, `reviewSummary`, `searchDiscovery`

**Chat actions** (shown in the message flow as buttons/chips):
- Everything else
- Actions with images render first (max 3), then text-only actions

Only shown for the current/latest thread and hidden while a new request is in flight.

**Click**: dispatches the action's `requestDetails` as a `sendAction` call with `userText = action.title`.

---

### `reviewHighlights` — Review cards

**Payload fields used**: `reviews` (array of `{ review_class, review_text, review_rating, review_tag }`), `sku`

```
┌─────────────────────────────────┐
│  Customer Reviews                │
│                                  │
│  ✅ Battery (★★★★★)             │  ← positive (green)
│  "Great battery life..."         │
│                                  │
│  ❌ Display (★★)                │  ← negative (red)
│  "Screen could be better..."     │
│                                  │
│  ⚪ Performance (★★★)           │  ← neutral (gray)
│  "Average performance..."        │
└─────────────────────────────────┘
```

Color coding: `positive` → green, `negative` → red, `neutral` → gray.

---

### `aiProductSuggestions` — AI Top Picks

**Payload fields used**: `product_suggestions` (array of `{ sku, role, short_name, labels,
reason, expert_quality_score, review_highlight, product_item, requestDetails }`)

```
┌─────────────────────────────────┐
│  AI Top Picks                    │
│                                  │
│  🏆 Winner: Product A (large)   │  ← TopPickCard variant
│  ┌────────────────────────────┐  │
│  │ [img 28x28]                 │  │
│  │ Score: 8.5/10               │  │
│  │ [Best Overall] [Premium $]  │  │  ← label chips: green/red/gray
│  │ "Offers the best combo..."  │  │
│  │ 💬 "Users love the battery" │  │  ← review_highlight
│  │ [View Details]              │  │
│  └────────────────────────────┘  │
│                                  │
│  💰 Best Value: Product B        │  ← CompactCard variant
│  ┌────────────────────────────┐  │
│  │ [img 20x20]  Name  role    │  │  ← horizontal layout
│  └────────────────────────────┘  │
└─────────────────────────────────┘
```

**Card variants**:
- **Top Pick card** (first/winner): Vertical layout, primary border, large image (28×28), "TOP MATCH" badge
- **Compact card** (others): Horizontal flex, smaller image (20×20), role label inline

**Roles**: `winner` → "My Favorite" / "TOP MATCH", `best_value` → "Best Value",
`best_alternative` → "Best Alternative"

**Label chips**: `positive` sentiment → green, `negative` → red, `neutral` → gray.

**Discount badge**: Shows `%{discountPercent}` when discount > 0 and account config enables it.

**Mobile**: Horizontal scroll with snap, cards fixed at 280px width.
**Desktop**: Vertical stack, full-width cards.

**Interaction**: Card click dispatches `requestDetails` (usually `launchSingleProduct`).

---

### `aiProductGroupings` — Category group cards

**Payload fields used**: `product_groupings` (array of `{ name, image, labels, sku, requestDetails }`)

```
┌─────────────────────────────────┐
│  Explore Categories              │
│                                  │
│  ┌──────────┐ ┌──────────┐      │
│  │ [image]  │ │ [image]  │      │
│  │ Budget-  │ │ Premium  │      │
│  │ Friendly │ │ Options  │      │
│  │ tag1·tag2│ │ tag1·tag2│      │
│  └──────────┘ └──────────┘      │
└─────────────────────────────────┘
```

**Desktop**: Card with image (20×20), first 3 labels joined with " · ", blue hover effect.

**Mobile**: Text button list with "↳" prefix icon, no images.

**Interaction**: Click dispatches `requestDetails` (`findSimilar` with `group_skus`).

---

### `aiSuggestedSearches` — Upsell search suggestions

**Payload fields used**: `suggested_searches` (array of entries with `short_name`, `detailed_user_message`,
`representative_product_sku`, `image`, `group_skus`, optional `requestDetails`, and optional
**`display_keywords`**.)

**Browse card compact line**: The tertiary line on each card is built from `display_keywords` / short
fragments of `chosen_attribute` / `short_name` (see `getSuggestedSearchKeywords` in the SDK). The
backend field `why_different` is **not** shown on the card — it is reserved for non-UI or legacy
uses; long explanatory sentences must not appear in that slot.

```
┌─────────────────────────────────┐
│  You might also like...          │
│                                  │
│  ┌──────────────────────────┐    │
│  │ [img] Premium Models      │    │
│  │ "Looking for higher-end?" │    │
│  │ "These offer better perf."│    │
│  └──────────────────────────┘    │
└─────────────────────────────────┘
```

Only shows upgrade/upsell options — never cheaper or lateral alternatives.

**Interaction**: Click dispatches `findSimilar` with the item's `sku` and `group_skus`.

---

### `getGroundingReview` — Review prompt card

**Payload fields used**: `title`, `text`, `review_count`, `requestDetails`

```
┌─────────────────────────────────┐
│  📝 What do customers say?       │
│  123 reviews available           │
│  [Read Reviews →]                │
└─────────────────────────────────┘
```

**Interaction**: Click dispatches `requestDetails` (usually `reviewSummary`).

---

### `prosAndCons` — Pros & Cons card

**Payload fields used**: `pros`, `cons`, `product_name`

```
┌─────────────────────────────────┐
│  Pros & Cons: Product A          │
│                                  │
│  ✅ Great battery                │
│  ✅ Good display                 │
│                                  │
│  ❌ Heavy                        │
│  ❌ Expensive                    │
└─────────────────────────────────┘
```

---

### `productListPreview` — Analyze animation

**Payload fields used**: `product_list`

Shows an animated "analyzing" overlay on the preview products before the full `productList`
arrives. Cleared when `productList` or `groupList` is received.

---

### `loading` — Loading indicator

**Payload fields used**: `text`, `is_dynamic`, `thinking_messages`

```
┌─────────────────────────────────┐
│  [Bot avatar]                    │
│  ● ● ● (animated dots)          │  ← when no loading text
│  "Analyzing product details..."  │  ← when text exists
│                                  │
│  Thinking steps:                 │  ← when thinking_messages exists
│  ✓ Found 15 products             │
│  ✓ Analyzing specifications      │
│  Ranking by relevance...         │  ← last item: bold (in progress)
└─────────────────────────────────┘
```

**Shown when**: The backend is responding AND the thread has no bot text output yet.

`thinking_messages` items render as a step list. The last item in the array is styled
as "in progress" (bold); previous items are shown as completed steps.

---

### `panelLoading` — Panel skeleton

Shown in the panel while content is being fetched. Skeleton type varies by `pending_type`:

| `pending_type` | Skeleton shown |
|---|---|
| `productDetails` | Product detail skeleton (image + text blocks) |
| `productList` | Grid skeleton (multiple card outlines) |
| `comparisonTable` | Table skeleton (column outlines) |

---

### `error` — Error state

```
┌─────────────────────────────────┐
│  ⚠ Connection error             │
│  Something went wrong. Try again.│
└─────────────────────────────────┘
```

---

### `voice` — TTS audio playback

**Payload fields used**: `audio_base64` (base64-encoded audio data)

No visual component. When the backend sends a `voice` event with `audio_base64`, the widget
decodes and plays it automatically via `playTtsAudio()` from `src/common/tts-player.ts`.
Playback uses the Web Audio API.

A `gengage:chat:voice` CustomEvent is dispatched so hosts can intercept or override playback
(e.g., pause their own media, show a speaking indicator, or substitute a different audio player).

---

### `handoffNotice` — Human agent handoff

**Payload fields used**: `heading`, `summary`

Rendered when the backend escalates the conversation to a human agent. CSS class:
`.gengage-chat-handoff-notice`. Uses `role="alert"` for assistive technology announcement.

```
┌─────────────────────────────────┐
│  👤 Transferring to an agent     │  ← heading (role="alert")
│  "A specialist will help you     │  ← optional summary
│   with your return request."     │
└─────────────────────────────────┘
```

Source: `src/chat/components/HandoffNotice.ts`

---

### `ui_spec:PhotoAnalysisCard` — Photo analysis card (beauty consulting)

**Delivered as**: `ui_spec` event with root element type `PhotoAnalysisCard`.

**Props**: `summary` (string), `strengths` (string[], optional), `focus_points` (string[], optional), `celeb_style` (string, optional), `celeb_style_reason` (string, optional), `next_question` (string, optional), `style_images` (string[], optional)

```
┌─────────────────────────────────┐
│  🔬 Skin Analysis               │  ← badge (i18n: photoAnalysisBadge)
│                                  │
│  "Soft contrast with polished    │  ← summary
│   evening potential."            │
│                                  │
│  Strengths                        │  ← strengths
│  • Defined eye frame             │
│  • Balanced lip line             │
│                                  │
│  Focus points                     │  ← focus_points
│  • T-zone shine control          │
│  • Light tone evening on cheeks  │
│                                  │
│  Celeb style match                │  ← celeb_style + reason
│  "Zendaya red carpet balance"    │
│                                  │
│  "Shall we build a routine?"     │  ← next_question (optional)
└─────────────────────────────────┘
```

The backend emits this UISpec during the beauty consulting flow when the user uploads a selfie.
The `PhotoAnalysisCard` is intercepted by the chat widget and attached as structured data on
the bot message (not rendered in the panel). The `ChatDrawer` renders it inline using the
`_renderPhotoAnalysisCard()` method.

Source: `src/chat/components/PhotoAnalysisCard.ts`

---

### `ui_spec:BeautyPhotoStep` — Selfie upload prompt (beauty consulting)

**Delivered as**: `ui_spec` event with root element type `BeautyPhotoStep`.

**Props**: `processing` (boolean), `title` (string, optional), `description` (string, optional), `upload_label` (string, optional), `skip_label` (string, optional)

```
┌─────────────────────────────────┐
│  ✦  Upload a Photo              │  ← title (i18n: beautyPhotoStepTitle)
│     Share a selfie so we can     │  ← description
│     analyze your skin...         │
│                                  │
│  [Upload Photo]  [Skip]          │  ← upload + skip buttons
└─────────────────────────────────┘
```

Rendered as a transient card above the chat input area (not in the message stream or panel).
The backend sends this UISpec during the beauty consulting init flow. When `processing` is
`true`, the upload button is disabled and shows a "processing" label.

**Interactions**:
- Upload click → opens the attachment file picker
- Skip click → hides the card and sends a skip message to the backend

Source: `src/chat/components/BeautyPhotoStep.ts`

---

## Accessibility

All widgets follow these accessibility patterns:

**Focus management**: All interactive elements (buttons, cards, links, stepper controls) have
`:focus-visible` outlines. CSS selectors include `.gengage-simrel-card:focus-visible`,
`.gengage-chat-action:focus-visible`, `.gengage-qna-button:focus-visible`, and others.

**Live regions**: The handoff notice uses `role="alert"` for immediate announcement.

**Reduced motion**: All widgets respect `prefers-reduced-motion: reduce`. When enabled,
CSS transitions and animations (typewriter effect, loading dots, card hover transforms,
analyze overlay) are disabled or reduced to instant state changes.

**Color contrast**: Interactive elements and text meet WCAG 2.1 AA contrast ratios. Status
indicators (positive/negative/neutral) use both color and icon to avoid relying on color alone.

**Keyboard navigation**: All interactive elements are reachable via Tab. Cards are focusable
with `tabindex="0"`. Stepper buttons have descriptive `aria-label` attributes ("Decrease quantity",
"Increase quantity").

---

## Loading States

### Chat loading

Shown when the backend is streaming AND the current thread has no bot message yet.
Disappears when the first `outputText`, `productDetails`, or similar content arrives.

The animated dots (`● ● ●`) are replaced by loading text if `loading.text` is set.
When `loading.is_dynamic = true`, the thinking steps list is shown instead.

### Panel loading

Shown when `panelLoading` is received. Cleared when a panel-type message
(`productDetails`, `productList`, `comparisonTable`, `groupList`) arrives.

### Analyze animation

Shown when `productListPreview` arrives. An animated overlay on the preview cards
signals that the AI is analyzing products. Cleared when `productList` arrives.

---

## History Navigation UI

### Navigation arrows (Panel top bar)

```
┌─────────────────────────────────┐
│  [◄ Back] Product Details [► Fwd]│
└─────────────────────────────────┘
```

- **Back** — move cursor to previous navigatable thread
- **Forward** — move cursor to next navigatable thread
- Title updates based on content type: "Product Details", "Similar Products",
  "Comparison Results", "Suggested Categories"

**Navigatable thread types**: `productDetails`, `productList`, `groupList`,
`comparisonTable`, `productDetailsSimilars`

### What happens on navigation

1. Thread cursor (`currentThreadId`) moves
2. Messages with `threadId > currentThreadId` are hidden (but not deleted)
3. Panel shows content for the navigated-to thread
4. Chat pane shows messages up to the cursor
5. Suggested actions only show for the latest (`currentThreadId`) thread

### Rollback via message click

User messages have a rollback affordance. Clicking a past user message moves
the cursor back to that thread position. Only enabled when the user message
belongs to a previous thread (not the current one).

### Typing from a rewound position

When the user types while the cursor is rewound (there are hidden "future" messages):
1. Future messages and their stored contexts are permanently deleted
2. A new thread branches from the rewound position
3. The new response continues from the context at the rewind point

```
Timeline:  A ── B ── C ── D ── E     (user rewinds to B, types new message)
                  ↑ cursor

After branch:  A ── B ── F           (C, D, E deleted; F is new branch)
```

---

## Chat Input Component

```
┌─────────────────────────────────────────────┐
│  [Input Area Chips — horizontal scroll]      │
│  ◄ [Chip1] [Chip2] [Chip3] ►                │
├─────────────────────────────────────────────┤
│  [📎] [Text input area............] [Send]   │
│  [🎙]                                        │
└─────────────────────────────────────────────┘
```

**Mobile**: Single-line input (fixed height, no auto-expand).
**Desktop**: Textarea that auto-expands with content.

**Submit priority** when send is activated: voice recording > image attachment > text.

**Input area chips**: Filtered subset of `suggestedActions` via `isInputAreaAction()`.
Shown as a horizontal scrollable row above the text input. Each chip click sends
`{ userText: action.title, userAction: action.requestDetails }`.

**Voice**: When voice recording ends, the audio file is sent as a multipart attachment
with action type `inputVoice`. The backend transcribes it and responds as if it were text.

**Image**: Selected image is previewed as a user message bubble (`imagePreview` type).
The file is sent as a multipart attachment alongside a `findSimilar` action payload.

---

## Host Bridge Messages

These are internal messages between the widget and the host page. They are triggered
by NDJSON processing or user interactions — not by backend responses directly.

### Widget → Host

| Message type | When sent | Payload |
|---|---|---|
| `ready` | Widget loaded and initialized | `{}` |
| `isResponding` | Request starts or ends | `true` / `false` |
| `loadingMessage` | On each `loading` response | `string` (loading text) |
| `previewImages` | On `productList` response | `{ previewImages: string[], products: SimplifiedProduct[] }` |
| `engagingMessage` | On `visitorDataResponse` (for `launchSingleProduct` only) | `{ message, action }` |
| `redirect` | On `redirect` response | `{ type: 'redirect', payload: { to: 'voiceLead' } }` |
| `glovOtokoc` | On automotive form responses | `{ type: 'getInfo'|'testDrive'|'serviceRequest'|'launchFormPage', data: payload }` |
| `launcherContent` | On `launcherContent` response | Passthrough payload |
| `glovAddToBasket` | User clicks cart button | `{ sku, cart_code, quantity }` |
| `saveSessionAndOpenURL` | User clicks product link (session-safe navigation) | `{ sessionId, url, sku? }` |
| `openURLInNewTab` | User clicks external link in chat HTML | `{ url }` |
| `close` | User closes the chat widget | `{}` |
| `maximize-pdp` | Panel opens (extended mode activated) | `{}` |
| `minify-pdp` | Panel closes (extended mode deactivated) | `{}` |

### Host → Widget

| Message type | When sent | Payload |
|---|---|---|
| `init_config` | On widget initialization | Remote config object |
| `show` | Host triggers chat open | `{}` |
| `requestClose` | Host requests chat close | `{}` |
| `startNewChatWithLauncherAction` | Launcher question clicked on host page | `{ action }` |
| `startNewChatWithDetailContext` | PDP init with product context | `{ sku, action }` |
| `launcherAction` | Launcher action forwarded from host | `{ action }` |
| `formSubmit` | Form submitted from host (automotive) | `{ data }` |
| `formEdit` | Form edit requested from host | `{ data }` |
| `scrollToBottom` | Host requests scroll to bottom | `{}` |
| `addToCardHandler` | Cart add result from host page | `{ success, error_message? }` |
| `cartQuantityHandler` | Cart quantity update from host | `{ quantity, items }` |

---

## Scroll Behavior

| Event | Scroll action |
|---|---|
| User sends a message | Scroll to last thread after 200ms, smooth |
| Stream ends | Scroll to last thread after 200ms, smooth |
| Last bot text message renders | Scroll to that message after 50ms |
| Chat first opens | 500ms scroll lockout (prevents jump on history restore) |
| History navigation (back/forward) | No explicit scroll — visibility change handles it |

**Mobile auto-scroll during typewriter**: Every 100ms, check if the user is within 300px
of the bottom. Stop if they scroll up more than 10px manually; resume if they return near bottom.

**Panel scroll reset**: When `productList`, `groupList`, or `comparisonTable` arrives,
the panel content scrolls to the top.

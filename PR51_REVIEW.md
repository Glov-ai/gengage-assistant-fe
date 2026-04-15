# PR #51 — Beauty Mode — Architecture Review

**Frontend:** `gengage-assistant-fe` PR #51 (`beauty-mode` → `main`)
**Backend:** `micro-abilities` PR #911 (`agent_redirect_modes_clean`)
**Reviewer:** @muskirac | **Date:** 2025-04-15

---

## Executive Summary

PR #51 adds beauty consulting features (photo-based skin analysis, style recommendations,
mode switching, selfie upload flow) to the chat widget. The style variation rendering in
`renderProductGrid` and the protocol adapter additions are clean. However, the PR introduces
a **frontend-driven orchestration layer** that violates the SDK's core architecture: the
frontend should agnostically render what the backend streams — it should not make business
decisions, maintain parallel state machines, or classify message content via NLP heuristics.

**7 blockers** — all rooted in business logic that belongs in the backend.
**5 warnings** — i18n gaps, type safety, consistency.
**Remedy plan** below for both repos.

---

## Architecture Principle

> The frontend renders and handles interactions. The backend decides.
> Widgets are streamed from the backend — the frontend agnostically renders them.

Every existing widget follows this: backend sends NDJSON → protocol adapter normalizes →
frontend renders. The beauty mode breaks this by adding a frontend control plane that
interprets content, manages session state, fabricates messages, and suppresses UI features.

`_assistantMode` as a vertical adapter is fine — it adapts transport and layout behavior
across verticals (shopping, beauty, watch). What's not fine is the frontend using that mode
to make business decisions that only the backend should make.

---

## BLOCKERS

### B1 — `_isPhotoAnalysisMessage`: Frontend NLP on message content

**Files:** `src/chat/components/ChatDrawer.ts:243-258`, `:1222-1230`, `:2470-2476`

The frontend performs **natural language classification** on every assistant message to decide
how to render it:

```typescript
private _isPhotoAnalysisMessage(content: string): boolean {
  const normalized = content.toLocaleLowerCase('tr-TR');
  const hasPhotoCue = normalized.includes('fotoğraf') || normalized.includes('selfie');
  const hasBeautyCue = normalized.includes('analiz') || normalized.includes('cilt') || ...;
  return hasPhotoCue && hasBeautyCue && normalized.length > 80;
}
```

**Why this is wrong:**
- The backend knows exactly when it's sending a photo analysis response (it builds the
  message in `_build_photo_analysis_message` at `text_action_beauty_consulting.py:970-986`).
  The frontend shouldn't guess.
- Runs on **every** message in **every** mode — no `assistantMode` guard. A Turkish cosmetics
  site in shopping mode will hit false positives (any product description mentioning `fotoğraf`
  + `cilt` in 80+ chars).
- English-only messages never match (Turkish keywords only).
- The sentence-splitting heuristic (`split(/(?<=[.!?])\s+/)`) assumes backend text structure.
  If the backend changes phrasing, the card silently breaks.

**Downstream:** `_renderPhotoAnalysisMessageCard` (`:260-309`) is also a frontend-built
component with structure decisions (summary + bullets + question extraction). This should be
a UISpec component streamed from the backend.

#### Remedy

| Repo | Change |
|------|--------|
| **Backend** | Add `render_hint: "photo_analysis"` to the `outputText` event payload when emitting photo analysis messages (around `text_action_beauty_consulting.py:970-986`). Or better: send the analysis as a structured UISpec component (`PhotoAnalysisCard`) with `summary`, `clues[]`, and `next_question` fields. |
| **Frontend** | Remove `_isPhotoAnalysisMessage` heuristic entirely. In the `outputText` rendering path, check `event.payload.render_hint === 'photo_analysis'` and route to the card renderer. Or register a `PhotoAnalysisCard` component in the UISpec catalog. |

---

### B2 — `_syncBeautyUiHints`: Frontend implements form-field business logic

**File:** `src/chat/index.ts:1538-1590`

The frontend decides **when to show the selfie upload card** based on domain rules:

```typescript
const hasSkinProfile = typeof fields['skin_profile'] === 'string' && ...;
const needsSkinProfile = missingFields.includes('skin_profile') || !hasSkinProfile;
const isVisible =
  status === 'collecting' && needsSkinProfile && !photoFindings &&
  !hasUploadedPhoto && photoStepState !== 'skipped';
```

This is a **data collection flow decision**: the frontend knows about `skin_profile` as a
named field, knows that `collecting` means "still gathering info", and uses field presence
to control UI. If the backend changes the flow (adds a field, changes when photos are
needed), the frontend breaks silently.

#### Remedy

| Repo | Change |
|------|--------|
| **Backend** | Stream a `suggestedActions` or UISpec component for the selfie prompt when appropriate. The backend already controls the flow state (`status`, `missing_fields`). When it determines a selfie would help, it should stream a `BeautyPhotoStep` UISpec component with `{ visible: true, processing: false }`. When the state changes, stream an updated component. |
| **Frontend** | Remove `_syncBeautyUiHints` field-checking logic. Render the `BeautyPhotoStep` component when the backend streams it. The `setBeautyPhotoStepCard` DOM builder can stay as a UISpec catalog renderer — it just shouldn't decide when to show itself. |

---

### B3 — `_handleAttachment` in beauty mode: Frontend fabricates user intent

**File:** `src/chat/index.ts:1442-1454`

```typescript
if (this._assistantMode === 'beauty_consulting') {
  this._sendMessage('Fotoğrafımı analiz edebilir misiniz?', file);
  return;
}
```

When a photo is attached in beauty mode, the frontend invents a hardcoded Turkish message
(`"Fotoğrafımı analiz edebilir misiniz?"`) and sends it as if the user typed it. The user
never typed this. The normal attachment path (`stageAttachment` → user adds text → `findSimilar`)
is completely bypassed.

#### Remedy

| Repo | Change |
|------|--------|
| **Backend** | Already handles `inputText` with image attachment in beauty mode (PR #911: `action_processor.py:307`, `text_action_beauty_consulting.py:141`). The backend extracts `image_bytes`/`image_mime` from the multipart request. No change needed on the backend — it doesn't need the frontend to fabricate text. |
| **Frontend** | Remove the beauty-mode special case in `_handleAttachment`. Send the attachment through the normal `_sendAction` path with `type: 'user_message'` and empty/user-provided text. The backend already knows it's beauty mode from `context.panel.assistant_mode` and will route to the photo analysis handler. |

---

### B4 — `_sendMessage` rewrites action payload based on mode

**File:** `src/chat/index.ts:1486-1490`

```typescript
const action: ActionPayload = isBeautyMode
  ? { title: text, type: 'user_message', payload: beautyPayload }
  : attachment !== undefined
    ? { title: text, type: 'findSimilar', payload: ... }
    : { title: text, type: 'user_message', payload: text };
```

The frontend injects `scenario`, `redirected_agent_state`, `beauty_consulting_state` into
every beauty-mode request payload via `_buildBeautyInputPayload`. This means the frontend
maintains and forwards session state that the backend should own.

**Related:** `_buildBeautyInputPayload` (`:1507-1520`) packs 4 state fields into every
request. The frontend is acting as a state machine relay.

#### Remedy

| Repo | Change |
|------|--------|
| **Backend** | The backend already maintains `redirected_agent_state` in the panel context via `PERSISTENT_CONTEXT_KEYS` (`response_processor.py:69-81`). It round-trips through `last_panel` on every request. The frontend should NOT inject state — the backend reads it from the panel context it sent on the previous turn. **Fix the REDIRECT → CONTEXT gap** (see Backend Fixes B-1 below) so the frontend receives the updated panel with `assistant_mode` and state. |
| **Frontend** | Remove `_buildBeautyInputPayload`. Send `{ type: 'user_message', payload: text }` for all modes. The backend reads `assistant_mode` and state from `context.panel` (which the frontend already sends as `_lastBackendContext`). |

---

### B5 — `_resolveLoadingTextForUi` overrides backend loading text

**File:** `src/chat/index.ts:1527-1535`

```typescript
const isBeautyPhotoFlow = this._assistantMode === 'beauty_consulting'
  && this._beautyConsultingState?.photoStepState === 'processing';
if (!isBeautyPhotoFlow) return text;
return fallbackBeautyText; // hardcoded Turkish/English string, ignores backend
```

The backend sends `loadingText` in metadata events. The frontend **discards it** and
substitutes a hardcoded string when it decides a photo is being processed.

#### Remedy

| Repo | Change |
|------|--------|
| **Backend** | Send appropriate `loadingText` in the metadata event during photo analysis (e.g. `"Fotoğrafınızı analiz ediyorum..."`). The backend controls the flow — it knows when photo analysis is happening. |
| **Frontend** | Remove `_resolveLoadingTextForUi`. Pass through `event.meta.loadingText` as-is (the existing behavior before this PR). |

---

### B6 — `_initBeautyConsultingSession`: Parallel non-streaming control plane

**Files:** `src/chat/index.ts:1762-1915`, `src/chat/api.ts:335-376`

The beauty init uses a **separate REST endpoint** (`/beauty_consulting_init`) returning JSON
(not NDJSON). The frontend then: parses the response to extract `scenario`/`fields`/`missing_fields`,
creates a synthetic assistant message from `result.assistant_reply`, updates the internal state
machine, and renders the message + selfie card.

This is a parallel control plane alongside the existing streaming protocol. Every other
interaction goes: backend streams NDJSON → protocol adapter normalizes → frontend renders.

**Also:** No `AbortController` on the fetch (unlike every other fetch in the SDK). The
stale-request guard prevents state corruption but the HTTP request stays open after widget
destroy.

#### Remedy

| Repo | Change |
|------|--------|
| **Backend** | The init endpoint (`/beauty_consulting_init`) should be called from the existing `process_action` flow, not from a separate frontend-initiated REST call. When the backend receives a REDIRECT action that transitions to beauty mode, it should: (1) call `prepare_beauty_consulting_handoff` internally, (2) stream the welcome message as an `outputText` event, (3) stream the selfie prompt as a UISpec component, (4) send the updated panel context with `assistant_mode` and state. This keeps everything in the NDJSON stream. |
| **Frontend** | Remove `_initBeautyConsultingSession`, `sendBeautyConsultingInit`, and `BeautyConsultingInitRequest/Response` types. The beauty init becomes just another stream response that the frontend renders agnostically. The `/beauty_consulting_init` API path can remain for potential direct-invoke use cases but should not be called by the widget. |

---

### B7 — Frontend suppresses UI features based on mode (7 locations)

The frontend hides/disables features based on `_assistantMode` checks that should be
backend-driven:

| Decision | File:Line | What the backend should do instead |
|----------|-----------|-------------------------------------|
| Hide attachment controls | `index.ts:1540` | Stream a `ui_hint` event with `{ attachmentControls: false }` |
| Remove choice prompter | `index.ts:1541-1544` | Don't send comparison prompt in beauty mode |
| Skip "unavailable product" short-circuit | `index.ts:2044` | Backend handles product availability |
| Suppress comparison prompter for beauty grids | `index.ts:2610` | Backend controls via `panelHint` or a flag on the ProductGrid |
| Keep typing indicator after stream end | `index.ts:2903, 3053` | Backend should stream a `loading` event that persists |
| Reset photo step state on stream end | `index.ts:2906-2913, 3056-3063` | Backend sends updated state in context event |
| Override loading text | `index.ts:1527-1535` | See B5 above |

#### Remedy

| Repo | Change |
|------|--------|
| **Backend** | Add an optional `ui_hints` field to the `context` event metadata: `{ hideAttachmentControls?: boolean, hideComparisonPrompt?: boolean, hideChoicePrompter?: boolean }`. The backend sets these based on mode. Or: use the existing `panelHint` mechanism on ProductGrid to suppress comparison. |
| **Frontend** | Read `ui_hints` from context metadata and apply them. Remove the 7 `_assistantMode === 'beauty_consulting'` conditional checks in the stream handler. |

---

## WARNINGS

### W1 — `BeautyConsultingSessionState`: 14-field frontend state machine

**File:** `src/chat/index.ts:121-136` + `_syncBeautyStateFromPanel` (`:1596-1628`)

The frontend maintains `scenario`, `status`, `photoFindings`, `photoStepState`, `missingFields`,
`knownFields`, etc. and synchronizes with backend panel metadata. This is the frontend
running a parallel state machine — the backend already tracks this state.

**Fix:** After B4/B6 remedies, this state object becomes unnecessary. The backend sends
updated state in the context event panel. The frontend reads and forwards it opaquely.

### W2 — Hardcoded Turkish strings bypass i18n (7 strings)

| String | Location |
|--------|----------|
| `'Fotoğrafımı analiz edebilir misiniz?'` | `_handleAttachment` |
| `'Cilt Analizi'` | `_renderPhotoAnalysisMessageCard` badge |
| `'Selfie ile kişiselleştir'` | `setBeautyPhotoStepCard` title |
| `'İstersen net bir profil fotoğrafı yükle...'` | `setBeautyPhotoStepCard` desc |
| `'Fotoğraf Yükle'` / `'Fotoğraf işleniyor...'` | `setBeautyPhotoStepCard` buttons |
| `'Geç'` | `setBeautyPhotoStepCard` skip |
| `'Güzellik danışmanını hazırlıyorum...'` | `_initBeautyConsultingSession` |

These have no `ChatI18n` key. `_resolveLoadingTextForUi` and `_beautyInputPlaceholder` DO
have locale branching — those are fine.

**Fix:** If the selfie card becomes a backend-streamed UISpec component (B2 remedy), the
backend sends localized text. The remaining strings disappear with B3/B5/B6 remedies.

### W3 — `BackendRequestMeta` type bypass

**File:** `src/chat/index.ts:1806, 2167`

```typescript
(meta as unknown as Record<string, unknown>)['assistantMode'] = this._assistantMode;
```

Double-cast through `unknown` to inject `assistantMode` into a typed interface. Violates
TypeScript strict mode conventions.

**Fix:** Add `assistantMode?: string` to `BackendRequestMeta` in `src/chat/api.ts:8-25`.

### W4 — Hardcoded CDN domain `configs.gengage.ai`

**File:** `src/chat/components/renderUISpec.ts:1739`

`toConsultingImageUrls` always resolves image paths to `https://configs.gengage.ai/assets/`.
This is the only hardcoded external domain in the render path. A customer forking the SDK
with their own backend would need to find-and-replace this.

**Fix:** Derive the CDN base URL from `middlewareUrl` config or add a `cdnBaseUrl` config
option. Or better: the backend should send fully-qualified image URLs in `style_variations`
so the frontend doesn't need to resolve paths.

### W5 — `sendBeautyConsultingInit` has no `AbortController`

**File:** `src/chat/api.ts:335-376`

Every other fetch in the SDK uses `AbortController`. The beauty init fetch can't be cancelled.
Stale-request guard and null-safe optional chaining prevent crashes, but the HTTP request
stays open after widget destroy.

**Fix:** Resolved by B6 remedy (remove the endpoint call entirely). If retained for any
reason, add `AbortSignal` parameter matching `sendChatMessage` pattern.

---

## What's Clean (Ship As-Is)

These parts of the PR follow the architecture correctly:

- **Protocol adapter additions** (`style_variations`, `recommendation_groups`) — wire protocol
  extensions, properly normalized through `productRecordToNormalized`, agnostically rendered.
- **`renderProductGrid` style variation picker** — renders what the backend sends. No business
  logic. Tab switching, image loading, product card rendering all work correctly.
- **`toConsultingImageUrls` image resolver** — transport concern (aside from W4 CDN hardcoding).
- **`beautyStylesPreparedTitle` / `watchStylesPreparedTitle` i18n keys** — properly added to
  both `tr.ts` and `en.ts` locale files, surfaced through `ChatI18n`.
- **`ChatEndpointName` union extension** — additive, no breaking change.
- **`OverlayChatOptions.isDemoWebsite` passthrough** — config forwarding, correct pattern.
- **CSS for beauty components** — styling is frontend's job, well-scoped class names.
- **Beymen demo page** — follows existing demo pattern.

---

## Backend Fixes Required (micro-abilities PR #911)

These backend changes are needed to support the frontend remedies above. PR #911's own
`KNOWN_ISSUES.md` already identifies the P1 issue.

### B-1 — Emit CONTEXT after REDIRECT (P1 from KNOWN_ISSUES.md)

**Problem:** When `text_action_ecom_with_modes.py:539` emits `ResponseType.REDIRECT`, the
response loop breaks at `response_processor.py:559` and the CONTEXT event is gated out at
`response_processor.py:585`. The frontend never receives the updated panel with
`assistant_mode` set.

**Fix:** Remove the `redirect_emitted` gate at `response_processor.py:585` or yield a
CONTEXT event after the REDIRECT break. This is the single most critical backend fix — it
closes the contract gap that forced the frontend to maintain its own mode state.

### B-2 — Stream beauty init through NDJSON (not separate REST)

**Problem:** `/beauty_consulting_init` is a separate REST endpoint returning JSON. The
frontend has to orchestrate the call, parse the response, synthesize messages, and manage
state — all things the streaming protocol already handles.

**Fix:** When the backend resolves a REDIRECT to beauty mode in the `process_action` flow:
1. Call `prepare_beauty_consulting_handoff` internally
2. Yield the welcome message as an `outputText` response
3. Yield the selfie prompt as a `suggestedActions` response (or new UISpec type)
4. Yield the CONTEXT with `assistant_mode` and `redirected_agent_state` set
5. The existing `/beauty_consulting_init` endpoint can remain for API consumers but the
   frontend widget should not call it.

### B-3 — Add `render_hint` to photo analysis `outputText`

**Problem:** The backend builds a structured photo analysis message in
`_build_photo_analysis_message` (`text_action_beauty_consulting.py:970-986`) but sends it as
plain `outputText`. The frontend has to guess from content keywords whether it's a photo
analysis message.

**Fix:** Add a `render_hint` field to the `outputText` payload:
```python
ActionResponse(
    type=ResponseType.ASSISTANT_REPLY,
    payload={"text": analysis_message, "render_hint": "photo_analysis"}
)
```

Or better: send it as a structured UISpec component with `summary`, `clues[]`,
`next_question` fields so the frontend renders it from structured data, not by parsing
sentences.

### B-4 — Stream `ui_hints` in context metadata

**Problem:** The frontend suppresses attachment controls, choice prompter, and comparison
prompt via hardcoded `assistantMode` checks because the backend doesn't signal these.

**Fix:** Add optional `ui_hints` to the context/metadata events:
```python
"ui_hints": {
    "hide_attachment_controls": True,   # beauty mode owns attachment flow
    "hide_comparison_prompt": True,     # not relevant in consulting
    "hide_choice_prompter": True,       # not relevant in consulting
}
```

The frontend reads these and applies them generically — no mode-specific conditionals.

### B-5 — Send loading text during photo analysis

**Problem:** The frontend overrides `loadingText` with a hardcoded string because the backend
doesn't send appropriate loading text during photo analysis turns.

**Fix:** In the photo analysis flow, emit a `loading` event with appropriate text:
```python
ActionResponse(type=ResponseType.LOADING, payload={
    "text": "Fotoğrafınızı analiz ediyor, cilt ihtiyaçlarınızı çıkarıyorum..."
})
```

### B-6 — Other PR #911 issues from KNOWN_ISSUES.md

These are not blocking the frontend but should be addressed:

| Issue | Priority | Summary |
|-------|----------|---------|
| ecom handler duplication (~70%) | P2 | `text_action_ecom_with_modes.py` duplicates `text_action_ecom.py`. Extract shared logic. |
| Image MIME allowlist ×6 | P2 | Rename to `SUPPORTED_IMAGE_MIME_TYPES`, share from one location. |
| TRACE logs at info level | P2 | Move 7 of 8 `[TRACE]` logs from info to debug. |
| Stale mode-state keys | P2 | Clear sibling state keys on mode change. |
| `watch_expert_init` reuses `BeautyConsultingInitRequest` | P2 | Create shared `ConsultantInitRequest` base model. |
| Duplicate `COMMON_PREFIX` in beymencom.py | P3 | Remove duplicate dict key. |
| Docs typo "beatury" | P3 | Fix 3 references in `action-handlers.md`. |

---

## Implementation Plan

### Phase 1 — Backend contract fixes (micro-abilities)

1. **B-1:** Emit CONTEXT after REDIRECT — fixes the mode state gap
2. **B-3:** Add `render_hint: "photo_analysis"` to outputText payload
3. **B-5:** Send loading text during photo analysis
4. **B-4:** Add `ui_hints` to context metadata

### Phase 2 — Frontend cleanup (gengage-assistant-fe)

Once backend ships Phase 1:

1. **B1:** Remove `_isPhotoAnalysisMessage` heuristic. Check `render_hint` instead.
2. **B3:** Remove hardcoded text in `_handleAttachment`. Send attachment normally.
3. **B4:** Remove `_buildBeautyInputPayload`. Send plain `user_message` payload.
4. **B5:** Remove `_resolveLoadingTextForUi`. Pass through backend loading text.
5. **B7:** Remove mode-conditional UI suppression. Read `ui_hints` from context.
6. **W3:** Add `assistantMode?: string` to `BackendRequestMeta`.
7. **W1/B2:** Remove `BeautyConsultingSessionState`. Read state from panel context.

### Phase 3 — Streaming init (both repos)

1. **B-2 (backend):** Route beauty init through `process_action` stream
2. **B6 (frontend):** Remove `sendBeautyConsultingInit` and REST init flow
3. **B2 (frontend):** Remove `_syncBeautyUiHints`. Render selfie prompt from UISpec.

---

## Cross-Cutting: Redirect Contract Issues

The `redirect` wire protocol event is used by multiple services:
- **Otokoc (booking):** `text_action_auto_booking.py` — automotive appointment scheduling
- **Beauty consulting:** `text_action_ecom_with_modes.py` — cosmetics consultation handoff
- **Watch expert:** same handler — watch specialist handoff
- **Generic redirects:** `{ to: "voiceLead" }` — forwarded to host via bridge

### R1 — `_handleRedirectMetadata` only handles beauty — all other redirects are dropped

**File:** `src/chat/index.ts:1638-1644`

```typescript
private async _handleRedirectMetadata(redirectPayload: unknown): Promise<void> {
  const payload = asRecord(redirectPayload);
  if (!payload) return;
  const mode = firstString(payload['assistant_mode'], payload['assistantMode']);
  if (mode !== 'beauty_consulting') return;  // ← watch_expert, booking silently dropped
```

PR #51 adds `_handleRedirectMetadata` which is called on **every** redirect event
(line 2824). The handler only processes `beauty_consulting` and returns early for
everything else. This means:

- **`watch_expert` redirects:** The `AssistantMode` type includes `watch_expert`, the
  backend PR #911 emits REDIRECT with `assistant_mode: "watch_expert"` for saatvesaat,
  but the frontend never switches to watch mode. The `gengage:chat:redirect` CustomEvent
  still fires (host-side consumers like Otokoc work), but the widget's internal mode stays
  `shopping`.
- **`booking` redirects:** Same issue. The `AssistantMode` type includes `booking` but
  no code path enters it from a redirect.
- **Existing `{ to: "voiceLead" }` redirects:** Unaffected — they have no `assistant_mode`
  field, so `firstString(...)` returns undefined, the guard fires, and the handler bails.
  The pre-existing `dispatch('gengage:chat:redirect', ...)` at line 2817 still works.

**Severity:** HIGH for watch_expert (dead code path in this PR), MEDIUM for booking (was
already handled externally by Otokoc's host listener, not by the widget).

#### Remedy

| Repo | Change |
|------|--------|
| **Frontend** | If `_handleRedirectMetadata` is kept, it should handle all `AssistantMode` values, not just beauty. Ideally, call `_switchAssistantMode(mode)` for any recognized mode. If the mode is unknown, ignore it (don't break the existing event dispatch). |
| **Backend** | Ensure the REDIRECT payload always includes `assistant_mode` so the frontend can route generically. |

### R2 — Backend REDIRECT suppresses CONTEXT for all modes (not just beauty)

**Backend file:** `response_processor.py:559, 585` (PR #911)

When **any** `ResponseType.REDIRECT` is emitted, the response loop `break`s and the
CONTEXT event is gated:

```python
if redirect_emitted:
    break
# ...
if not redirect_emitted:
    yield ActionResponse(type=ResponseType.CONTEXT, ...)
```

This affects all redirect consumers:
- Beauty consulting: frontend compensates with `_initBeautyConsultingSession` REST call
- Watch expert: no compensation — widget never gets updated panel
- Booking (Otokoc): if the booking handler emits REDIRECT, the next turn won't have
  `assistant_mode: "booking"` in the context panel unless the host manually injects it

**This is the root cause of most frontend business logic leaks.** The frontend had to build
its own state management because the backend doesn't send the updated context after a
redirect.

**Severity:** P1 — already identified in PR #911's `KNOWN_ISSUES.md`.

#### Remedy

Already documented in B-1 above. Emit CONTEXT after REDIRECT (or at least include
`assistant_mode` in the REDIRECT payload AND ensure the next turn's context panel carries it).

### R3 — `void` fire-and-forget on async redirect handler

**File:** `src/chat/index.ts:2824`

```typescript
void this._handleRedirectMetadata(event.meta.redirect);
```

The `void` prefix discards the promise. If `_handleRedirectMetadata` throws (e.g. during
`_initBeautyConsultingSession` fetch failure), it becomes an unhandled rejection. The handler
has a try/catch internally for the fetch, but any bug in the parsing logic (e.g. a
`TypeError` on unexpected payload shape) would be silently swallowed.

**Severity:** LOW — defensive but not crash-causing. The `gengage:global:error` dispatch
in the catch block covers the fetch failure case.

#### Remedy

Add `.catch()` to surface unexpected errors:
```typescript
this._handleRedirectMetadata(event.meta.redirect).catch((err) => {
  debugLog('beauty', 'redirect handler error', { error: String(err) });
});
```

---

## Pre-Existing Technical Debt (not from this PR)

These patterns predate PR #51 but follow the same anti-pattern of frontend business logic:

### D1 — KVKK content detection via keyword scan

**File:** `src/chat/kvkk.ts:12-17`

```typescript
const KVKK_TEXT_MARKERS = ['kvkk', 'kişisel veri', 'kisisel veri'];
const KVKK_LAW_NUMBER_RE = /\b6698\b/;

export function containsKvkk(html: string): boolean {
  const lower = html.toLowerCase();
  return KVKK_TEXT_MARKERS.some((m) => lower.includes(m)) || KVKK_LAW_NUMBER_RE.test(lower);
}
```

**Called at:** `src/chat/index.ts:2279` — scans final bot text for Turkish legal keywords,
strips the KVKK block, and shows a consent banner.

**Same pattern as B1** — frontend scanning content to make rendering decisions. The backend
embeds a legal notice inside `outputText` HTML, and the frontend parses it out. The backend
should send KVKK as a separate event type or with a metadata flag.

### D2 — Unavailable product context short-circuit

**File:** `src/chat/index.ts:2042-2059`

The frontend blocks requests from reaching the backend when it decides the product context
is stale, and generates a synthetic fallback message:

```typescript
if (this._hasUnavailableProductContext() && (action.type === 'user_message' || ...)) {
  const fallback = this._i18n.productNotFoundMessage;
  // ... creates bot message, never sends to backend
}
```

The backend may have fresher product data. The frontend should send the request and let the
backend decide how to handle unavailable products.

---

### What can merge now

The following parts of PR #51 are clean and could be split into a separate PR:
- Protocol adapter: `style_variations` + `recommendation_groups` normalization
- `renderProductGrid`: style variation picker rendering
- CSS for beauty components
- `beautyStylesPreparedTitle` / `watchStylesPreparedTitle` i18n keys
- `ChatEndpointName` union extension
- `OverlayChatOptions.isDemoWebsite` passthrough
- Beymen demo page

---

## Appendix: Files Changed

### Frontend (PR #51) — 20 files, +2213 / -28

| File | Role in review |
|------|---------------|
| `src/chat/components/ChatDrawer.ts` | B1 (heuristic), W2 (Turkish strings) |
| `src/chat/index.ts` | B2-B7, W1, W3 (all orchestration logic) |
| `src/chat/api.ts` | B6 (init endpoint), W3, W5 |
| `src/chat/components/renderUISpec.ts` | Clean — style variation rendering |
| `src/chat/components/chat.css` | Clean — styling |
| `src/common/protocol-adapter.ts` | Clean — wire protocol extension |
| `src/common/api-paths.ts` | Clean — endpoint addition |
| `src/common/overlay.ts` | Clean — config passthrough |
| `src/chat/types.ts` | Clean — i18n type extension |
| `src/chat/locales/en.ts`, `tr.ts` | Clean — i18n strings |
| `docs/customization.md` | Clean — documentation |
| `demos/beymencom/index.html` | Clean — demo page |
| `demos/index.html` | Clean — demo index |
| `tests/*` | 4 test files — need updating after remedies |

### Backend (PR #911) — 18 files, +4016 / -45

| File | Key concern |
|------|-------------|
| `src/flow/response_processor.py` | B-1 (REDIRECT skips CONTEXT) |
| `src/action/text_action_beauty_consulting.py` | B-3 (no render_hint), B-2 (init endpoint) |
| `src/action/text_action_ecom_with_modes.py` | P2 (duplication with ecom.py) |
| `src/action/text_action.py` | Clean — routing |
| `src/flow/action_processor.py` | P2 (MIME duplication) |
| `src/app.py` | B-2 (init endpoint definition) |
| `src/accounts/beymencom.py` | P3 (duplicate key) |
| `KNOWN_ISSUES.md` | Self-identified P1 matches our B-1 |

# PR #51 — Beauty Mode Remaining Work

**Repos:** `gengage-assistant-fe` (branch `beauty-mode`) + `micro-abilities` (branch `agent_redirect_modes_clean`)

Each item below includes the exact files, line numbers, current state, and what to
change. Items are independent unless noted in the dependency graph at the bottom.

---

## What's already implemented

The original beauty mode review identified 7 blockers (B1–B7), 5 warnings (W1–W5),
and 6 backend fixes (B-1 through B-6). All blockers and high-priority items are
resolved. The summary below lists what was done so a future implementer can verify
without needing any prior session context.

### Backend (micro-abilities — `agent_redirect_modes_clean`)

| ID | What was done | Key file(s) |
|----|---------------|-------------|
| B-1 | CONTEXT always emits after REDIRECT; stale `ui_hints` cleared for shopping | `response_processor.py:585` — removed `redirect_emitted` gate |
| B-2 | Beauty init streamed through NDJSON (welcome `outputText` + `BeautyPhotoStep` UISpec), not separate REST | `response_processor.py:615–636` |
| B-3 | `render_hint: "photo_analysis"` added to photo analysis `outputText` | `text_action_beauty_consulting.py` |
| B-4 | `ui_hints` in CONTEXT panel for all 3 consultant modes | `response_processor.py:124–137` (`_build_ui_hints`) |
| B-5 | Loading text yielded before photo analysis | `text_action_beauty_consulting.py` |
| B-6a | `SUPPORTED_IMAGE_MIME_TYPES` shared constant (7 sites) | `chat_api.py`, all account files |
| B-6b | TRACE logs moved to debug (2 info-level retained) | Various |
| B-6c | `_clear_sibling_mode_state` on redirect | `response_processor.py` |
| B-6d | `ConsultantInitRequest` base model | `chat_api.py` |
| B-6e | `CONSULTANT_CONFIG` → `CONSULTANT_MODE` rename | `config_types.py` |
| B-6f | Duplicate `COMMON_PREFIX` removed | `beymencom.py` |
| B-6g | "beatury" typo fixed | `action-handlers.md` |
| Fix | `hide_attachment_controls` corrected to `True` for all consultant modes | `response_processor.py:128` |
| Fix | Redirect event ordering: redirect → outputText → uiSpec → context | `response_processor.py:591–636` |

### Frontend (gengage-assistant-fe — `beauty-mode`)

| ID | What was done | Key file(s) |
|----|---------------|-------------|
| B1 | Photo-analysis **detection** heuristic `_isPhotoAnalysisMessage` deleted; rendering now triggered by `renderHint === 'photo_analysis'` (sentence-splitting renderer remains — see F3) | `ChatDrawer.ts`, `index.ts` |
| B2 | `_syncBeautyUiHints` field-checking logic deleted; UI hints read from backend CONTEXT | `index.ts` |
| B3 | Fabricated message in `_handleAttachment` removed; attachment sent as `user_message` | `index.ts` |
| B4 | `_buildBeautyInputPayload` deleted; mode read from `_lastBackendContext.panel.assistant_mode` | `index.ts` |
| B5 | `_resolveLoadingTextForUi` deleted; backend loading text passed through | `index.ts` |
| B6 | REST init flow deleted (`sendBeautyConsultingInit`, types); beauty init via NDJSON | `api.ts`, `index.ts` |
| B7 | Mode-conditional UI suppression replaced by `_uiHints` from backend CONTEXT | `index.ts` |
| W1 | `BeautyConsultingSessionState` deleted; all sync methods deleted | `index.ts` |
| W2 | 7 hardcoded Turkish strings replaced with i18n keys (`photoAnalysisBadge`, `beautyPhotoStep*`) | `types.ts`, `tr.ts`, `en.ts`, `ChatDrawer.ts` |
| W3 | `assistantMode` added to `BackendRequestMeta`; double-cast removed | `api.ts` |
| R1 | `_handleRedirectMetadata` handles all 3 modes generically (beauty, watch, booking) | `index.ts:1476–1486` |
| R3 | Redirect handler made sync (no promise to mishandle) | `index.ts` |
| Fix | `adaptUiSpec()` added to protocol adapter — maps `type: "uiSpec"` → `type: "ui_spec"` with `{ root, elements }` shape | `protocol-adapter.ts:1945` |
| Fix | BeautyPhotoStep end-to-end: UISpec → card rendering, onDone/onError slot clearing | `index.ts:1939–1955`, `index.ts:2658–2668` |
| Fix | BeautyPhotoStep skip sends `inputText` to backend; queued if stream active, flushed on done/error | `index.ts:1948–1954`, `index.ts:2665–2668`, `index.ts:2524–2528` |

### Tests (13 contract tests)

**`tests/beauty-consulting-migration.test.ts`** (11 tests):
1. Beauty redirect sets `_assistantMode`
2. Beauty attachment → `inputText` (not `findSimilar`)
3. Staging doesn't auto-send (no fabricated message)
4. All 3 modes recognized (beauty, watch, booking)
5. Unknown redirect ignored (mode unchanged)
6. `_uiHints` null initially
7. CONTEXT derives mode from `panel.assistant_mode`
8. `_uiHints` cleared when CONTEXT lacks them
9. Booking host redirect ignored (no `assistant_mode`)
10. Shopping attachment → `findSimilar`
11. Skip → `inputText` request shape

**`tests/protocol-adapter.test.ts`** (2 beauty-related):
12. `adaptUiSpec()` produces `{ root, elements }` shape
13. `render_hint` → `renderHint` passthrough

---

## F1 — Backend: Extract shared ecom handler logic

**Priority:** P2 — reduces maintenance burden, no functional impact
**Effort:** Large (1–2 days)

### Problem

`micro-abilities/src/action/text_action_ecom_with_modes.py` (710 lines) duplicates ~70%
of `text_action_ecom.py` (584 lines). Intent analysis, search dispatch, blog handling,
and RAG routing are copied verbatim. Any bug fix to the shopping flow must be applied in
two places.

### What to change

Extract shared intent-analysis + dispatch into a common module. Let `ecom_with_modes`
call it with consultant fields injected via a config dict.

| Section | ecom.py lines | ecom_with_modes.py lines | Action |
|---------|--------------|------------------------|--------|
| Intent system prompt setup | 288–387 | 336–392 | Extract to shared function |
| Blog search task creation | 453–464 | 579–590 | Extract to shared function |
| Search dispatch logic | 469–519 | 595–600+ | Extract to shared function |
| Consultant prompt injection | — | 393–440 | Keep in modes handler |
| Consultant redirect logic | — | 519–543 | Keep in modes handler |

### How to validate

1. Run the backend test suite — existing shopping/consultant flows must produce identical results.
2. Manually test: send a shopping query on a with-modes account (e.g. `flormarcomtr`),
   verify product results match. Then trigger a beauty redirect, verify consultant flow.

---

## F2 — Frontend: CDN hardcoding in `toConsultingImageUrls`

**Priority:** P3 — affects SDK forkability, not functionality
**Effort:** Small (30 min)

### Problem

`src/chat/components/renderUISpec.ts:1716` defines `toConsultingImageUrls`, which
hardcodes:
```typescript
return [`https://configs.gengage.ai/assets/${path}`];
```

Called at `renderUISpec.ts:2101` to resolve style variation image URLs. Customers forking
the SDK must find-and-replace this URL.

### Options (pick one)

1. Add `cdnBaseUrl?: string` to `ChatWidgetConfig` in `src/chat/types.ts`. Default to
   `https://configs.gengage.ai`. Thread it through the render context.
2. Derive from `middlewareUrl` (strip path, append `/assets/`).
3. **Preferred:** Backend sends fully-qualified image URLs in `style_variations` payloads
   instead of relative paths.

### What the frontend does after option 3

1. At the call site (`renderUISpec.ts:2101`), use `variation.image_url` directly after
   passing it through `isSafeUrl()` (already imported in this file).
2. Replace `toConsultingImageUrls` (`renderUISpec.ts:1716–1742`) with a smaller temporary
   fallback helper: if `image_url` is a relative path (no `://`), prepend
   `https://configs.gengage.ai/assets/` and log a deprecation warning. This gives
   existing backend deployments time to update. Remove the fallback helper entirely in
   the next minor version.
3. Run `npm run typecheck` to verify no dangling references.

### How to validate

- With updated backend: verify style variation images load from absolute URLs.
- With old backend: verify the fallback prepends the CDN domain and images still load.

---

## F3 — Frontend: Convert `_renderPhotoAnalysisMessageCard` to UISpec component

**Priority:** P3 — the current `render_hint` approach works, but UISpec is cleaner
**Effort:** Medium (2–3 hours)
**Depends on:** F2 (CDN fix simplifies image URL handling)

### Problem

`src/chat/components/ChatDrawer.ts:243` defines `_renderPhotoAnalysisMessageCard`, which
parses HTML content using sentence-splitting heuristics:
```typescript
const parts = content.split(/(?<=[.!?])\s+/).map(part => part.trim()).filter(Boolean);
```

It extracts a summary (first sentence), bullet points (non-question sentences), and a
follow-up question (last sentence with `?`). This is fragile — the backend already has
structured data at build time. Note: the **detection** heuristic (`_isPhotoAnalysisMessage`)
was already deleted — this is about the **rendering** heuristic that parses sentences.

Called from:
- `ChatDrawer.ts:1210` — message rendering for `renderHint === 'photo_analysis'`
- `ChatDrawer.ts:2465` — typewriter completion for photo analysis messages

### What to change

1. **Backend** (`micro-abilities`): Send photo analysis as a `PhotoAnalysisCard` UISpec
   component with structured fields: `summary: string`, `clues: string[]`,
   `next_question: string`, `style_images?: string[]`. Send alongside (not replacing)
   `outputText` for backward compatibility.
2. **Frontend** — register `PhotoAnalysisCard` in the UISpec catalog:
   - Add Zod schema to `src/chat/catalog.ts`
   - Add renderer to `src/chat/components/renderUISpec.ts` (reuse the existing card CSS
     classes: `gengage-chat-photo-analysis-card`, `-badge`, `-body`, `-summary`, `-points`)
3. **Frontend** — extract the sentence-splitting logic from `_renderPhotoAnalysisMessageCard`
   into a standalone fallback function (e.g. `renderPhotoAnalysisFallback` in
   `ChatDrawer.ts` or a new utility). This function is called **only** when
   `render_hint === "photo_analysis"` AND no `PhotoAnalysisCard` UISpec was received in
   the same stream. Then delete the original `_renderPhotoAnalysisMessageCard` method
   and update its two call sites (lines 1210, 2465) to use the UISpec renderer with the
   fallback path.
4. This preserves backward compatibility with old backends that don't send the UISpec
   component, while new backends get structured rendering.

### How to validate

- Stream a beauty photo analysis response from updated backend. Verify the card renders
  from structured data (no sentence splitting).
- Stream from old backend (no UISpec, just `render_hint`). Verify the fallback renderer
  still produces the same card.

---

## F4 — Pre-existing debt: KVKK content detection

**Priority:** P3 — pre-existing, same heuristic pattern as the now-fixed photo analysis
**Effort:** Small (backend: add flag; frontend: read flag)

### Problem

`src/chat/kvkk.ts` scans bot text for Turkish legal keywords to detect KVKK consent
notices:
```typescript
// kvkk.ts:12
const KVKK_TEXT_MARKERS = ['kvkk', 'kişisel veri', 'kisisel veri'];
const KVKK_LAW_NUMBER_RE = /\b6698\b/;
```

`containsKvkk()` (line 15) matches against these markers. If matched, the KVKK block is
stripped from visible text and shown in a consent banner. This is the same NLP heuristic
pattern as the now-deleted `_isPhotoAnalysisMessage`.

### What to change

1. **Backend**: Add `kvkk: true` to the outputText metadata (same pattern as
   `render_hint: "photo_analysis"`) when the response includes KVKK content. Or send
   KVKK as a separate event type (`type: "kvkk"`).
2. **Frontend**: Check the metadata flag instead of keyword scanning. Keep
   `containsKvkk()` as a fallback for old backends.

### How to validate

- Trigger a KVKK response (first message on a Turkish account). Verify the consent
  banner shows. Verify keyword scanning is bypassed when the flag is present.

---

## F5 — Pre-existing debt: Unavailable product context short-circuit

**Priority:** P3 — pre-existing, frontend blocks requests the backend should handle
**Effort:** Medium (backend flow change)

### Problem

`src/chat/index.ts:1613–1619`:
```typescript
const shouldShortCircuitUnavailableContext =
  !options?.silent &&
  this._assistantMode === 'shopping' &&
  this._hasUnavailableProductContext() &&
  (action.type === 'user_message' || action.type === 'inputText');
if (shouldShortCircuitUnavailableContext) {
  const fallback = this._i18n.productNotFoundMessage;
  // ... shows fallback locally, never reaches backend
}
```

`_hasUnavailableProductContext()` (line 3030) checks if the current SKU was previously
marked unavailable. If so, user messages are blocked from reaching the backend. But the
backend may have fresher product data, or the user may be asking about something else
entirely.

Also referenced at:
- `index.ts:2594` — error recovery path
- `index.ts:2866` — PDP prime suggested UI guard

### What to change

1. Remove the short-circuit at lines 1613–1619. Send all requests to the backend.
2. **Backend**: Return a user-friendly fallback when the product is unavailable, instead
   of an error.
3. Keep `_markUnavailableProductContext()` / `_clearUnavailableProductContext()` for the
   PDP auto-launch error recovery path (line 2594), which is a different concern.

### How to validate

- Navigate to a PDP with an invalid/unavailable SKU. Send a text message. Verify the
  backend receives it and returns a graceful fallback. Verify no frontend short-circuit.

---

## F6 — Booking redirect clarification (backend comment only — no frontend/runtime change)

**Priority:** P3
**Effort:** Trivial

### Context

`micro-abilities/src/action/text_action_auto_warmup.py:409` emits:
```python
yield ActionResponse(
    type=ResponseType.REDIRECT,
    payload={
        "to": "bookingMode",
        "booking_intent": booking_intent,
        "handoff_summary": "...",
        "prefill": { ... },
    },
)
```

This has no `assistant_mode` field. It is a **host page redirect** — the frontend
dispatches it as `gengage:chat:redirect` (index.ts event dispatch) for the host page to
consume (e.g., Otokoc's booking form). The frontend's `_handleRedirectMetadata` correctly
ignores it because `assistant_mode` is absent.

The `booking` entry in `_handleRedirectMetadata`'s recognized modes list (index.ts:1482)
is for the separate `ecom_with_modes` handler's explicit `assistant_mode: "booking"`
redirect — a different code path.

### What to do

1. Add a comment in `text_action_auto_warmup.py` near line 409 clarifying this is a host
   redirect, not an internal assistant mode switch.
2. Update `docs/action-handlers.md:82–90` — the "Consultant Redirect Flow" section still
   documents the old flow: "Frontend initializes expert mode state" and lists
   `/chat/beauty_consulting_init` and `/chat/watch_expert_init` as init endpoints. Rewrite
   to describe the current flow: redirect → streamed `outputText` (welcome) →
   `BeautyPhotoStep` UISpec → final CONTEXT with `assistant_mode` and state.

No frontend or runtime change needed.

---

## F7 — Additional test coverage

**Priority:** P2 — validates remaining edge cases
**Effort:** Small (1 hour)

### Current test inventory (13 tests)

**`tests/beauty-consulting-migration.test.ts`** (11 tests):
| # | Test name | What it validates |
|---|-----------|-------------------|
| 1 | switches to beauty mode on redirect metadata | `_handleRedirectMetadata` sets `_assistantMode` |
| 2 | sends attachment as user_message in beauty mode | Attachment → `inputText` (not `findSimilar`) |
| 3 | stages attachment normally (no fabricated message) | Staging doesn't auto-send |
| 4 | handles watch_expert and booking redirects | All 3 recognized modes |
| 5 | ignores unknown redirect payloads | Unknown `to` → mode unchanged |
| 6 | applies ui_hints from CONTEXT panel | `_uiHints` null initially |
| 7 | derives _assistantMode from CONTEXT panel | Mode from `panel.assistant_mode` |
| 8 | clears _uiHints on mode transition | ui_hints → null when CONTEXT lacks them |
| 9 | ignores bookingMode redirect | Host redirect → mode unchanged |
| 10 | shopping image attachment uses findSimilar | Shopping attachment → `findSimilar` |
| 11 | BeautyPhotoStep skip sends message to backend | Skip → `inputText` request shape |

**`tests/protocol-adapter.test.ts`** (2 beauty-related tests):
| # | Test name | What it validates |
|---|-----------|-------------------|
| 12 | adapts uiSpec (BeautyPhotoStep) to ui_spec | `adaptUiSpec()` produces `{ root, elements }` |
| 13 | adapts outputText with render_hint | `render_hint` → `renderHint` passthrough |

### Tests to add

These require ChatDrawer DOM rendering or stream lifecycle mocking:

| Test | What it validates |
|------|-------------------|
| BeautyPhotoStep UISpec → selfie card rendered in DOM | Full UISpec → card rendering path |
| BeautyPhotoStep absent on next stream → slot cleared | `onDone` clears `_beautyPhotoStepEl` |
| Skip button click → `onSkip` fires, message queued/sent | Full callback path (not just request shape) |
| Skip during active stream → queued, flushed on `onDone` | Race safety: `pendingPhotoStepSkip` flag |
| Skip during errored stream → flushed on `onError` | Error path flush |
| Photo analysis card rendered from structured data or fallback | Structured `PhotoAnalysisCard` renders; old `render_hint` fallback renders |
| Watch expert redirect → mode + ui_hints applied | Edge case for non-beauty consultant |

### How to implement

The simplest approach: create a test helper that initializes `GengageChat` with
`variant: 'inline'`, mounts it, and provides access to the Shadow DOM. Then simulate
stream events by feeding NDJSON lines through the streaming callback. This avoids
needing a real backend.

---

## Dependency Graph

```
Independent (can be done in any order):
├── F1: Extract shared ecom handler logic (backend, large)
├── F2: CDN hardcoding (frontend+backend, small)
├── F4: KVKK content detection (both, small)
├── F5: Unavailable product short-circuit (both, medium)
├── F6: Booking redirect clarification (backend comment/docs, trivial)
└── F7: Additional test coverage (frontend, small)

Sequential:
F2 → F3 (CDN fix first, then photo analysis UISpec uses clean image URLs)
```

---

## Priority Summary

| Priority | Items | Effort |
|----------|-------|--------|
| **P2** | F1, F7 | ~1.5 days |
| **P3** | F2, F3, F4, F5, F6 | ~1 day |
| **Total** | 7 items | ~2.5 days |

None of these items block the beauty mode from functioning correctly in production.
The current implementation is architecturally sound — the backend drives all business
logic and state, the frontend renders what it receives. These items reduce code
duplication, eliminate remaining heuristics, and improve SDK forkability.

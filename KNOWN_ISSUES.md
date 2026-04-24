# Known Issues & Verification Report

Last verified: 2026-04-24 against `main` branch (updated same day with fixes).

This file keeps only concerns that are still open after the current frontend fixes. Items removed from here were either fixed, superseded, or no longer describe the current codebase accurately.

## 1. Backend / Account Integration Gaps

- **Broken chat on `hepsiburadacom` and `penticom`:** Chat still falls back to the product-unavailable message for effectively every query. Frontend retry and recovery UI exists, but the account behavior is still broken until the backend stops treating general chat as blocked on PDP product context.
- **Empty SimRel responses on `n11com`, `hepsiburadacom`, `arcelikcomtr`, and `penticom`:** `/chat/similar_products` still returns empty payloads for affected accounts, so the inline SimRel widget can only show its retry / degraded state while equivalent discovery flows in chat may still return cards.
- **Missing QNA questions on `hepsiburadacom`, `arcelikcomtr`, and `penticom`:** The QNA widget still receives no contextual questions for these accounts, so the question-pill row remains empty. The frontend can only render its fallback input path; this is still a backend/data issue.
- **Missing PDP context on `arcelikcomtr`:** Chat responses remain generic because the backend/account integration does not reliably honor the SKU context for product-specific prompts.

## 2. CTA & Interaction Consistency

- **Data-driven CTA asymmetry:** Product cards and product-details panels only render the primary add-to-cart path when `cartCode && sku && inStock !== false` is present in the payload (`src/chat/components/renderUISpec.ts:549-551`, `src/chat/components/renderUISpec.ts:1389-1402`). Neighbouring items in the same result set can therefore show different CTAs (`Sepete Ekle` vs `İncele` / `View on Site`) purely because backend fields are incomplete.
- ~~**Demo-mode product name omission in chat bubble:**~~ **FIXED.** All four `onProductClick` call sites now pass `name` when available (AITopPicks card click, AITopPicks findSimilar CTA, ProductCard URL CTA, ProductDetailsPanel View on Site). Regression tests added in `tests/ai-top-picks.test.ts` and `tests/render-uispec.test.ts`.

## 3. Responsive Constraints

- ~~**Header overflow on ultra-mobile widths (<375px):**~~ **FIXED.** Added `@media (max-width: 374px)` breakpoint in `src/chat/components/chat.css` that reduces header gap/padding, allows `.gengage-chat-header-right` to shrink (`flex-shrink: 1; min-width: 0`), and scales action buttons from 42px to 34px.

## 4. Frontend Business / Client Logic Leaks (Architecture Debt)

The SDK principle is still "frontend renders, backend/host decides." These pre-existing patterns remain open debt:

- **Automotive/Otokoc bridge contract leaks into the core SDK (`src/common/protocol-adapter.ts:379`, `src/common/protocol-adapter.ts:508-511`, `src/chat/index.ts:2573`):** Automotive-only action types (`formGetInfo`, `formTestDrive`, `formServiceRequest`, `launchFormPage`) are still first-class in the shared protocol adapter, and the chat widget still forwards them through the merchant-branded bridge event name `glovOtokoc`.
- **PDP shell control is hard-coded in shared panel management (`src/chat/panel-manager.ts:118-127`):** The generic panel manager still sends `maximize-pdp` / `minify-pdp` bridge messages with fixed delays, which bakes a specific host-shell contract into shared SDK logic.
- **KVKK handling still has a frontend text-scan fallback (`src/common/protocol-adapter.ts:591-597`, `src/chat/index.ts:1932-1953`, `src/chat/kvkk.ts:12-17`):** The backend flag path now exists (`kvkk` and `render_hint` are parsed), but the frontend still falls back to keyword scanning and block stripping for older backends. That compatibility path remains frontend policy / parsing debt until all backends send explicit metadata.
- **Unavailable product context still short-circuits shopping chat requests (`src/chat/index.ts:1692-1697`, `src/chat/index.ts:2960`):** Once a SKU is marked unavailable, subsequent `user_message` / `inputText` actions in shopping mode are still intercepted locally and replaced with a synthetic fallback message instead of being forwarded to the backend; PDP prime suggestions are likewise suppressed client-side.
- **Panel title inference still falls back to frontend action classification (`src/chat/panel-manager.ts:143`, `src/chat/panel-manager.ts:178`, `src/chat/panel-manager.ts:263`):** `isSearchLikeActionType(...)` still decides whether the panel title should read as search results or similar products when the backend omits a title.

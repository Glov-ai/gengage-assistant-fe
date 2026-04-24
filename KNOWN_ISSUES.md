# Known Issues & Verification Report

Last verified: 2026-04-24 against `main` branch.

This file keeps only concerns that are still open **and cannot be resolved in this frontend repo**. Items removed from here were either fixed, are addressable in this repo (see git history / backlog), or no longer describe the current codebase accurately.

## 1. Backend / Account Integration Gaps

- **Broken chat on `hepsiburadacom` and `penticom`:** Chat still falls back to the product-unavailable message for effectively every query. Frontend retry and recovery UI exists, but the account behavior is still broken until the backend stops treating general chat as blocked on PDP product context.
- **Empty SimRel responses on `n11com`, `hepsiburadacom`, `arcelikcomtr`, and `penticom`:** `/chat/similar_products` still returns empty payloads for affected accounts, so the inline SimRel widget can only show its retry / degraded state while equivalent discovery flows in chat may still return cards.
- **Missing QNA questions on `hepsiburadacom`, `arcelikcomtr`, and `penticom`:** The QNA widget still receives no contextual questions for these accounts, so the question-pill row remains empty. The frontend can only render its fallback input path; this is still a backend/data issue.
- **Missing PDP context on `arcelikcomtr`:** Chat responses remain generic because the backend/account integration does not reliably honor the SKU context for product-specific prompts.

## 2. CTA & Interaction Consistency

- **Data-driven CTA asymmetry:** Product cards and product-details panels only render the primary add-to-cart path when `cartCode && sku && inStock !== false` is present in the payload. Neighbouring items in the same result set can therefore show different CTAs (`Sepete Ekle` vs `İncele` / `View on Site`) purely because backend fields are incomplete. The frontend renders what it receives — the fix is for backends to send complete product payloads.

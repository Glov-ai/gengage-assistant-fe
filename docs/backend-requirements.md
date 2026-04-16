# Backend Requirements — Frontend UX Gap Fixes

This file tracks verified UX gaps that cannot be fully solved in the frontend alone. The SDK already adds retries, fallbacks, and degraded states where possible, but the issues below still require backend work for full parity.

## 1. Broken Chat (P0)

**Merchants:** hepsiburadacom, penticom
**Issue:** Every query returns "Bu ürün bilgisi şu an kullanılamıyor" — chat is non-functional.
**Test:** `npm run dev -- hepsiburadacom --sku=5002998547` → open chat → ask any question
**Expected:** General queries (recommendations, comparisons, shipping) should work without PDP product data dependency.
**Frontend mitigation:** Error recovery pills with retry + "ask something else" (Sprint 2).

## 2. Empty SimRel Responses (P0)

**Merchants:** n11com, hepsiburadacom, arcelikcomtr, penticom
**Issue:** `/chat/similar_products` returns empty payload — no similar products render. The SimRel widget can only show its inline retry state.
**Working merchants:** koctascomtr, yatasbeddingcomtr return valid product arrays.
**Test:** `npm run dev -- n11com --sku=5002998547` → check SimRel widget area
**Expected:** 4-8 similar products per SKU.
**Frontend mitigation:** Inline retry state plus shared connectivity warning / error toast.

## 3. Missing PDP Context (P1)

**Merchant:** arcelikcomtr
**Issue:** Chat ignores SKU in request payload — responses are generic, not product-specific.
**Test:** `npm run dev -- arcelikcomtr --sku=1000465056` → ask "bu ürün hakkında ne düşünüyorsun?"
**Expected:** Response references the specific product (model, specs, reviews).

## 4. Missing QNA Questions (P1)

**Merchants:** hepsiburadacom, arcelikcomtr, penticom
**Issue:** No contextual questions returned for QNA widget — the question pills area is empty.
**Working merchants:** koctascomtr, yatasbeddingcomtr, n11com return questions.
**Expected:** 3-5 product-specific questions per SKU.

## 5. Zero-Value Data (P2)

**Merchant:** n11com
**Issue:** `points: 0.0` sent in product data payload.
**Frontend mitigation:** Already hidden when value ≤ 0 (Sprint 1, GAP-042).
**Suggestion:** Omit zero-value fields from response payload to reduce transfer size.

## 6. Grouping Card Errors (P1)

**Merchant:** koctascomtr
**Issue:** Category drill-down requests from `suggestedActions` fail with backend error. User clicks a category card → backend returns an error instead of sub-category products.
**Test:** `npm run dev -- koctascomtr --sku=1000465056` → chat → click category grouping cards
**Expected:** Sub-category products load successfully.

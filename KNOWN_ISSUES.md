# Known Issues & Verification Report

Last verified: 2026-04-14 against `main` branch.

## 1. Layout & Integration Gaps

- **Arçelik QNA (arcelikcomtr):** Demo HTML is correctly wired (`mountTarget: '#arcelik-qna-section'`). When the QNA widget receives no response from the backend, the UI shows zero state changes. This is a backend-side issue for the arcelikcomtr account — frontend error handling is in place but the backend returns an empty response.
- **Simrel "Benzer Ürünler" disconnect:** The inline SimRel widget regularly fetches zero results for similar products, while the same query via the Chat Assistant returns product cards. This is a P0 backend empty-response bug affecting n11com, hepsiburadacom, arcelikcomtr, and penticom. Frontend retry UI is in place (connection warning system); underlying cause is backend-side.

## 2. Button Action Reliability

- **Comparison dock — retest pending:** The old comparison "modal" was replaced with a floating bottom-docked bar (`src/chat/components/FloatingComparisonButton.ts`). The first-click failures reported against the modal are considered superseded by this refactor — the dock fires `getComparisonTable` synchronously on click with no DOM-attachment race. Live testing against the new dock has not been formally recorded; treat as unverified green.
- **Asymmetrical Quick-Actions:** Product search grid cards show "Sepete Ekle" only when the backend provides `cartCode` and `inStock` for that product (`renderUISpec.ts:390`). Products missing either field fall through to a "İncele" CTA or a link. This produces visible CTA inconsistency between neighbouring cards in the same grid. The condition is data-driven; fixing it requires the backend to supply `cartCode` on all in-stock products.

## 3. Responsive Constraints

- **Header overflow on ultra-mobile (<375px):** The chat header renders with `flex-shrink: 0` on `.gengage-chat-header-right` and has no breakpoint below the general mobile rules. At viewports narrower than ~360px (e.g. iPhone SE at 320px CSS width) the right-side button cluster can force the title section to zero width or overflow the container. No `flex-wrap` or min-width reduction is applied at this breakpoint.

## 4. Inconsistent Product Name in Chat Bubble (Demo Mode)

After the `ComparisonTable` fix (PR #35), clicking a comparison-table product in demo mode correctly shows the product name in the chat bubble. Four other `onProductClick` call sites still omit `name` and fall back to SKU:

- `src/chat/components/AITopPicks.ts:223` — card click
- `src/chat/components/AITopPicks.ts:337` — findSimilar CTA
- `src/chat/components/renderUISpec.ts:436` — product card CTA
- `src/chat/components/renderUISpec.ts:1240` — product details panel CTA

The product name is in scope at each site (available as `product['name']`). On production sites this is a non-issue (same-origin URLs trigger navigation instead of `launchSingleProduct`), but on demo sites (`isDemoWebsite: true`) the chat bubble still shows the raw SKU for these four entry points.

## 5. Frontend Business Logic Leaks (Architecture Debt)

The SDK's architecture principle is "frontend renders, backend decides." These pre-existing patterns violate that by having the frontend make business decisions:

- **KVKK content detection via keyword scan (`src/chat/kvkk.ts:12-17`):** The frontend scans every final bot message for Turkish legal keywords (`'kvkk'`, `'kişisel veri'`, `'6698'`) to detect a data protection notice, then strips it from the message and shows a consent banner. The backend should send KVKK as a separate event type or with a metadata flag (e.g. `render_hint: "kvkk"` on the `outputText` payload), not as hidden markup for the frontend to parse.
- **Unavailable product context short-circuit (`src/chat/index.ts:2042-2059`):** When the frontend marks a product SKU as unavailable (after a prior empty response), subsequent `user_message`/`inputText` actions are blocked from reaching the backend entirely. The frontend generates a synthetic fallback message without consulting the backend, which may have fresher product data. The backend should handle product availability; the frontend should always forward the request.
- **Panel title inference from action type (`src/chat/panel-manager.ts:262-264`):** `isSearchLikeActionType` classifies the user's intent to choose between "Search Results" vs "Similar Products" panel titles when the backend omits a title. Low severity since the backend title takes priority when present.

## 6. Accessibility

- **Screen reader coverage not verified:** Launcher button is keyboard-accessible (Tab/Enter/Space), focus-visible styling is applied, and Escape-to-close is implemented. Full screen reader testing (NVDA, JAWS, VoiceOver) for WCAG 2.1 AA compliance has not been performed.

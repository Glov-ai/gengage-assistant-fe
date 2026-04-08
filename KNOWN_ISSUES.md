# Known Issues & Verification Report

Despite fixes to the happy path, deep structured testing unveiled that the following items remain functionally broken or inconsistent:

## 1. Layout & Integration Gaps
- **Dead Layouts on Subsidiary Demos:** The `arcelikcomtr` layout exhibits a broken QNA integration (submitting text triggers zero response state changes).
- **Simrel Disconnect:** The "Benzer Ürünler" widget placed natively across page bodies regularly fails to inline fetch similar elements, yet querying the Chat Assistant manually for the same item successfully populates products. Frontend error handling with retry UI is in place (Sprint 2+). Underlying issue is a P0 backend empty-response bug on n11com, hepsiburadacom, arcelikcomtr, and penticom.

## 2. Button Action Reliability
- **Comparison Modal Failures:** On desktop grids, selecting 2 items via checkboxes and clicking "Karşılaştır" repeatedly fails on the first click, requiring 2–3 attempts before the modal attaches.
- **Asymmetrical Quick-Actions:** Product search grid cards omit the "Add-to-cart" quick icon inconsistently. Some cards force users into an "İncele" modal while neighbors offer instant 1-click additions.

## 3. Responsive Constraints
- **Header Overflow on Ultra-Mobile:** Extreme viewports matching iPhone SE (<375px) break header bars, causing horizontal scrolling. Modern flex-wrapping collapses are not applied at this breakpoint.

## 4. Inconsistent Product Name in Chat Bubble (Demo Mode)

- **`onProductClick` passes `name` only from ComparisonTable:** After PR #35, clicking a comparison table product in demo mode (`isDemoWebsite: true`) correctly shows the product name in the chat bubble. However, four other call sites do not pass `name` and fall back to SKU: `AITopPicks.ts:223` (card click), `AITopPicks.ts:337` (findSimilar CTA), `renderUISpec.ts:436` (product card CTA), `renderUISpec.ts:1240` (product details panel CTA). The product name is in scope at each site. On production sites this is a non-issue (same-origin URLs trigger navigation instead of `launchSingleProduct`), but on demo sites the chat bubble still shows raw SKU for these entry points.

## 5. Accessibility
- **Keyboard Navigation (partially resolved):** Launcher button is now keyboard-accessible (Tab/Enter/Space working). Focus-visible styling and Escape-to-close are implemented. Remaining gap: full screen reader testing (NVDA, JAWS, VoiceOver) for WCAG compliance verification has not been performed.

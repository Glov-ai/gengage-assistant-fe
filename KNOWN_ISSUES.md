# Known Issues & Verification Report

Despite the fixes to the happy path, deep structured testing unveiled that the following items remain functionally broken or wildly inconsistent:

## 1. Architectural & Form Factor Failures
- **Q&A Context Rip-out:** Typing inside the embedded Q&A input directly on the product page (`koctascomtr`) fails to provide a polite inline answer sequence. Instead, the layout radically shifts by forcing the full Chat Assistant window to instantly maximize onscreen.
- **Dead Layouts on Subsidiary Demos:** The alternative `arcelikcomtr` layout exhibits a completely broken integration. Crucially, its own Q&A widget is functionally dead (submitting text triggers zero response state changes). Additionally, its custom red native "Sepete Ekle" buttons completely lack the visual checkmark UX feedback logic implemented in the Koçtaş demo.
- **Simrel Disconnect:** The "Benzer Ürünler" widget placed natively across page bodies regularly fails to inline fetch similar elements, yet questioning the Chat Assistant manually regarding the identical item successfully populates products inside conversational bounds.

## 2. Button Action Reliability
- **Comparison Modal Failures:** On desktop grids, a user successfully selects 2 items using the checkboxes. However, clicking the final overarching "Karşılaştır" trigger button in the interface repeatedly fails to snap the modal into action on the exact first click, demanding 2-to-3 repetitious strikes before the DOM attaches the modal.
- **Asymmetrical Quick-Actions:** While testing the product search grid, cards omit the "Add-to-cart" quick icon inconsistently. Forcing certain users into a sluggish "İncele" (Examine modal) layout purely to add an item creates high checkout friction when paired with neighboring products boasting instant 1-click additions.

## 3. Responsive Constraints
- **Header Overflow on Ultra-Mobile:** Extreme limits matching the iPhone SE sizes (< 375px) breaks the underlying layout header bars natively across demos (breaking words like "Kampanyalar" into causing terrible horizontal body scrolling because modern flex-wrapping collapses were overlooked).

## 4. Codebase Accessibility Deficiencies
- **Keyboard (a11y) Barriers:** Tabbing extensively throughout the raw underlying SDK instances (`vanilla-script` variants) verifies terrible focus routing paths. The primary chat launcher sits severely far down the DOM. Crucially, even after forcefully tabbing to its focus halo, native accessibility triggers (hitting `Enter` or `Space` natively) do absolutely nothing. The chat strictly relies entirely on raw mouse-pointer `onClick` listeners blocking all keyboard workflows.

## 5. Data Contract Gaps
- **Listing promo badges silently dropped (PR#25):** The frontend now suppresses promotion badges (e.g. "Free Shipping", "Flash Sale") on listing-style product cards. Promotions still render on the product-details panel. However, the backend (`micro-abilities`) still computes and sends `promotions` on every listing item. The FE silently discards this data at the listing level. This is an intentional product decision for a cleaner catalog view, but means wasted backend compute for data that is never displayed. Consider either removing the upstream computation or re-enabling listing badges if merchandising needs change.

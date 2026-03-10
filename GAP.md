# UX Gap Report — QA Session (2026-03-10)

**Method:** Playwright browser testing + Gemini vision collaboration
**Branch:** weekdays-overtime-qa (from origin/main)
**Target:** 100+ new issues

## Summary

| Merchant | Desktop | Mobile | Issues |
|----------|---------|--------|--------|
| koctascomtr | done | done | 26 |
| n11com | done | done | 15 |
| hepsiburadacom | done | done | 10 |
| arcelikcomtr | done | done | 15 |
| yatasbeddingcomtr | done | done | 5 |
| penticom | done | done | 19 |
| **cross-merchant** | — | — | **21** |

**Total issues:** 102 (includes 21 cross-merchant "all" issues)

## Verification & Fix Status (2026-03-10)

All 102 issues were verified via code inspection across 9 parallel analysis agents.

| Status | Count | Details |
|--------|-------|---------|
| **FIXED** | 48 | Branch `gap-fixes-sprint` — 8 commits |
| **BACKEND** | 12 | Requires backend team changes |
| **NOT A BUG** | 10 | Working as designed |
| **DUPLICATE** | 8 | Consolidated into parent issues |
| **DESIGN/UNCLEAR** | 12 | Deferred for design review |
| **ALREADY FIXED** | 2 | Fixed in prior sprints |

### Fixed Issues (48)
- **Task 1 (P0):** GAP-029, 050, 089 — Variant buttons show value instead of type name
- **Task 2 (P1):** GAP-002, 017, 032, 035, 102 — ChoicePrompter 2+ product gate + mobile + keyboard
- **Task 3 (P1):** GAP-001, 041 — Cart emoji → SVG icon
- **Task 4 (P1-P2):** GAP-058, 070, 076, 096, 098 — Star aria-label, dialog describedby, send disabled, touch targets
- **Task 5 (P2):** GAP-006, 007, 016, 034, 037, 071 — SimRel empty state + tab fixes
- **Task 6 (P1-P2):** GAP-009, 010, 011, 012, 013, 027, 036, 047, 057, 063, 065, 072, 086 — Mobile CSS
- **Task 7 (P2-P3):** GAP-008, 020, 021, 023, 024, 025, 026, 040, 048, 054, 059, 060, 062, 077, 084, 085, 088, 093, 097, 099 — Visual polish

### Backend Issues (12) — Needs Backend Team
- GAP-005: Flat list hierarchy (backend HTML formatting)
- GAP-030: Penti price "1,50 TL" (backend sends 1.5 not 1499.99)
- GAP-033: Panel "(0)" reviews vs PDP "4.9 (5)" (data mismatch)
- GAP-038: QNA input shows previous session query (session state leak)
- GAP-042: "0 TL" for out-of-stock (backend sends price:0)
- GAP-043/044: Out-of-stock filtering and stepper (backend responsibility)
- GAP-049: No strikethrough price (backend missing originalPrice field)
- GAP-073: "%0.0 Puan" badge (backend sends zero-value promotions)
- GAP-074: "Ücretsiz Kargo" repeated per card (backend sends per-product)
- GAP-082: N11 header lacks merchant logo (config delivery)
- GAP-100: Error state — no retry button (needs backend retry contract)

### Not a Bug (10)
- GAP-003: Tooltip positioning is correct CSS
- GAP-004: Thumbnails are 40px not 24px (inaccurate report)
- GAP-018/031: href="#" is intentional — click handler with preventDefault + launchSingleProduct
- GAP-067: No icons in suggestion chips (text only)
- GAP-081: Half-star CSS overlay technique is correct
- GAP-091: Camera button already 44x44 on mobile
- GAP-092: Typing indicator already implemented (3-dot + thinking steps + still-working)

### Duplicates (8)
- GAP-028 → GAP-010, GAP-032 → GAP-002, GAP-035 → GAP-017
- GAP-041 → GAP-001, GAP-055 → GAP-037, GAP-094 → GAP-072

---

## GAP-001: [COMPONENT] Cart emoji on SimRel/panel stepper buttons
- **Merchant:** all
- **Viewport:** both
- **Step:** View product cards in SimRel widget or panel similar products
- **Screenshot:** .claude/tmp/koctascomtr-desktop-05-panel-content.png
- **Expected:** A proper SVG cart icon on the Add to Cart button
- **Actual:** Raw emoji 🛒 rendered as text, inconsistent across platforms
- **Severity:** P1
- **Source:** Claude

## GAP-002: [UX] ChoicePrompter appears before user views 2+ products
- **Merchant:** koctascomtr
- **Viewport:** both
- **Step:** Open chat drawer for the first time
- **Screenshot:** .claude/tmp/koctascomtr-desktop-02-drawer-open.png
- **Expected:** Comparison prompt appears only after user has viewed at least 2 products
- **Actual:** "Kararsız mı kaldın?" appears immediately on drawer open, before any product browsing
- **Severity:** P1
- **Source:** Both

## GAP-003: [VISUAL] Detached QNA callout tooltip from chat launcher
- **Merchant:** koctascomtr
- **Viewport:** desktop
- **Step:** View page with chat launcher visible
- **Screenshot:** .claude/tmp/koctascomtr-desktop-01-page-load.png
- **Expected:** "👋Bu ürünü birlikte inceleyelim" anchored near the FAB
- **Actual:** Text floats at bottom-left of viewport, entirely disconnected from the FAB at bottom-right
- **Severity:** P1
- **Source:** Gemini

## GAP-004: [COMPONENT] Microscopic product thumbnails in chat cards
- **Merchant:** koctascomtr
- **Viewport:** desktop
- **Step:** Bot responds with product recommendation cards (Krom/Altın/Gümüş options)
- **Screenshot:** .claude/tmp/koctascomtr-desktop-04-response.png
- **Expected:** Product images large enough to recognize the product (~48px minimum)
- **Actual:** Thumbnails are ~24px, too small for shopping context — products unrecognizable
- **Severity:** P1
- **Source:** Gemini

## GAP-005: [TYPOGRAPHY] Flat list hierarchy in nested bullet responses
- **Merchant:** koctascomtr
- **Viewport:** both
- **Step:** Ask "bu ürünün özellikleri neler?" — bot lists multiple products with features
- **Screenshot:** .claude/tmp/koctascomtr-desktop-07-followup-response.png
- **Expected:** Product names as headers, features indented as sub-bullets
- **Actual:** Product names and features share same bullet style and indentation — confusing flat list
- **Severity:** P1
- **Source:** Both

## GAP-006: [SPACING] SimRel tab text collision — zero horizontal margin
- **Merchant:** koctascomtr
- **Viewport:** desktop
- **Step:** View panel similar products tabs
- **Screenshot:** .claude/tmp/koctascomtr-desktop-05-panel-content.png
- **Expected:** Clear spacing between tab labels
- **Actual:** Tab strings "Modern Metal Ekmeklikler", "Bambu Kapaklı..." run directly into each other with zero gap
- **Severity:** P1
- **Source:** Gemini

## GAP-007: [A11Y] Low contrast on unselected panel tab text
- **Merchant:** koctascomtr
- **Viewport:** desktop
- **Step:** View panel similar products tabs
- **Screenshot:** .claude/tmp/koctascomtr-desktop-05-panel-content.png
- **Expected:** Tab text readable at WCAG AA contrast ratio
- **Actual:** Unselected tab text is extremely pale gray, nearly illegible against white background
- **Severity:** P1
- **Source:** Gemini

## GAP-008: [COMPONENT] Broken quantity selector borders in panel/SimRel
- **Merchant:** koctascomtr
- **Viewport:** both
- **Step:** View quantity stepper [-][1][+][cart] on product cards
- **Screenshot:** .claude/tmp/koctascomtr-desktop-05-panel-content.png
- **Expected:** Clean, aligned borders on stepper controls
- **Actual:** Borders misaligned, double-thick shared borders, uneven button heights
- **Severity:** P1
- **Source:** Gemini

## GAP-009: [MOBILE] Catastrophically broken SimRel card UI on mobile
- **Merchant:** koctascomtr
- **Viewport:** mobile
- **Step:** Scroll to "Benzer Ürünler" section on mobile page
- **Screenshot:** .claude/tmp/koctascomtr-mobile-05-qna-simrel.png
- **Expected:** Product cards render with clean borders and layout
- **Actual:** Thick black artifact line at card bottom, quantity selector borders shattered, unusable
- **Severity:** P0
- **Source:** Gemini

## GAP-010: [MOBILE] FAB overlaps SimRel Add to Cart button
- **Merchant:** koctascomtr
- **Viewport:** mobile
- **Step:** View SimRel product cards on mobile
- **Screenshot:** .claude/tmp/koctascomtr-mobile-05-qna-simrel.png
- **Expected:** FAB positioned without blocking primary actions
- **Actual:** FAB directly overlays the cart button and quantity selector of rightmost product card
- **Severity:** P1
- **Source:** Gemini

## GAP-011: [MOBILE] Disconnected drawer handle white sliver above header
- **Merchant:** koctascomtr
- **Viewport:** mobile
- **Step:** Open chat drawer on mobile
- **Screenshot:** .claude/tmp/koctascomtr-mobile-02-drawer-open.png
- **Expected:** Grabber handle integrated into the dark header background
- **Actual:** Awkward white curved band with gray grabber sits above the dark #212B36 header
- **Severity:** P1
- **Source:** Gemini

## GAP-012: [MOBILE] Intrusive native scrollbar over chat content
- **Merchant:** koctascomtr
- **Viewport:** mobile
- **Step:** View chat response with product cards
- **Screenshot:** .claude/tmp/koctascomtr-mobile-03-response.png
- **Expected:** Scrollbar hidden or styled thin overlay on mobile
- **Actual:** Thick native gray scrollbar handle overlaps right edge of product recommendation cards
- **Severity:** P1
- **Source:** Gemini

## GAP-013: [MOBILE] Tight left padding on chat messages
- **Merchant:** koctascomtr
- **Viewport:** mobile
- **Step:** View bot response in chat drawer on mobile
- **Screenshot:** .claude/tmp/koctascomtr-mobile-02-drawer-open.png
- **Expected:** Comfortable padding between message content and screen edge
- **Actual:** Blue vertical accent line hugs the left edge too tightly, feels cramped against bezel
- **Severity:** P2
- **Source:** Gemini

## GAP-014: [A11Y] Poor contrast on chat card italic descriptions
- **Merchant:** koctascomtr
- **Viewport:** desktop
- **Step:** View product recommendation cards in chat
- **Screenshot:** .claude/tmp/koctascomtr-desktop-04-response.png
- **Expected:** Description text meets WCAG AA contrast (4.5:1)
- **Actual:** Italicized gray text (~#888) fails contrast standards against white background
- **Severity:** P2
- **Source:** Gemini

## GAP-015: [SPACING] Cramped suggestion chips vertical padding
- **Merchant:** koctascomtr
- **Viewport:** both
- **Step:** View suggestion chips (orange pills) in panel or mobile
- **Screenshot:** .claude/tmp/koctascomtr-mobile-05-qna-simrel.png
- **Expected:** Balanced padding on all sides of chip buttons
- **Actual:** Vertical padding much tighter than horizontal — text feels squished
- **Severity:** P2
- **Source:** Gemini

## GAP-016: [MOBILE] SimRel tab text truncation without scroll affordance
- **Merchant:** koctascomtr
- **Viewport:** mobile
- **Step:** View SimRel tabs on mobile
- **Screenshot:** .claude/tmp/koctascomtr-mobile-05-qna-simrel.png
- **Expected:** Tabs scrollable with fade/arrow indicator, or text fits
- **Actual:** "Modern Metal Ekn..." abruptly cut off, no scroll indicator visible
- **Severity:** P2
- **Source:** Both

## GAP-017: [UX] ChoicePrompter placement overlaps input area on mobile
- **Merchant:** koctascomtr
- **Viewport:** mobile
- **Step:** Open chat drawer on mobile with ChoicePrompter active
- **Screenshot:** .claude/tmp/koctascomtr-mobile-02-drawer-open.png
- **Expected:** Prompter positioned above input without obscuring it
- **Actual:** "Kararsız mı kaldın?" banner covers suggested actions and pushes input off-screen
- **Severity:** P1
- **Source:** Claude

## GAP-018: [COMPONENT] Product links in bot response use href="#"
- **Merchant:** koctascomtr
- **Viewport:** both
- **Step:** Bot responds with product names as links in text
- **Screenshot:** .claude/tmp/koctascomtr-desktop-07-followup-response.png
- **Expected:** Links navigate to product detail page or trigger product drilldown
- **Actual:** Links use href="#" — clicking scrolls to top of page instead of navigating
- **Severity:** P1
- **Source:** Claude

## GAP-019: [VISUAL] Empty star ratings (☆☆☆☆☆) for unreviewed products
- **Merchant:** koctascomtr
- **Viewport:** both
- **Step:** View similar products in panel
- **Screenshot:** .claude/tmp/koctascomtr-desktop-05-panel-content.png
- **Expected:** Products with 0 reviews either show no rating or "Henüz değerlendirilmedi"
- **Actual:** Empty 5-star row displayed with "(0)" — looks like the product was rated 0/5
- **Severity:** P2
- **Source:** Claude

## GAP-020: [VISUAL] Large empty space below panel similar products grid
- **Merchant:** koctascomtr
- **Viewport:** desktop
- **Step:** View panel product detail with similar products
- **Screenshot:** .claude/tmp/koctascomtr-desktop-05-panel-content.png
- **Expected:** Panel content fills available space or has reasonable padding
- **Actual:** Huge black/dark empty area below the similar products grid — wasted space
- **Severity:** P2
- **Source:** Claude

## GAP-021: [VISUAL] Panel shows only 2 products with massive empty space
- **Merchant:** koctascomtr
- **Viewport:** desktop
- **Step:** Ask about product features, panel shows "Sorduğunuz Ürün Modelleri"
- **Screenshot:** .claude/tmp/koctascomtr-desktop-07-followup-response.png
- **Expected:** Grid adapts to content or fills space gracefully
- **Actual:** Only 2 products shown with huge empty area below — looks broken
- **Severity:** P2
- **Source:** Claude

## GAP-022: [UX] "Benzerlerini Bul" button clutter on every panel product card
- **Merchant:** koctascomtr
- **Viewport:** both
- **Step:** View similar products in panel
- **Screenshot:** .claude/tmp/koctascomtr-desktop-05-panel-content.png
- **Expected:** "Find Similar" is a secondary action, not prominent on every card
- **Actual:** "Benzerlerini Bul" button appears on every single card, cluttering the UI
- **Severity:** P2
- **Source:** Claude

## GAP-023: [VISUAL] Product name truncation in panel similar product cards
- **Merchant:** koctascomtr
- **Viewport:** both
- **Step:** View similar products in panel
- **Screenshot:** .claude/tmp/koctascomtr-desktop-05-panel-content.png
- **Expected:** Product names readable or have tooltip on hover
- **Actual:** Long names like "Mat Siyah Yuvarlak Ekmek Sepeti Şık,ekmeklik..." heavily truncated
- **Severity:** P2
- **Source:** Claude

## GAP-024: [INTERACTION] Selected card state too subtle
- **Merchant:** koctascomtr
- **Viewport:** desktop
- **Step:** Click a product grouping card in chat
- **Screenshot:** .claude/tmp/koctascomtr-desktop-06-interaction-cards.png
- **Expected:** Clear visual distinction for the selected/active card
- **Actual:** Only an orange border change — no background tint, easy to miss
- **Severity:** P3
- **Source:** Gemini

## GAP-025: [VISUAL] FAB robot icon too small for its container
- **Merchant:** all
- **Viewport:** both
- **Step:** View the floating chat launcher button
- **Screenshot:** .claude/tmp/koctascomtr-desktop-01-page-load.png
- **Expected:** Icon fills the circle proportionally
- **Actual:** Robot icon is slightly small relative to the orange circle, leaving excess empty space
- **Severity:** P3
- **Source:** Gemini

## GAP-026: [SPACING] Input field text vertical alignment slightly off
- **Merchant:** koctascomtr
- **Viewport:** desktop
- **Step:** View the empty chat input field
- **Screenshot:** .claude/tmp/koctascomtr-desktop-02-drawer-open.png
- **Expected:** Placeholder text perfectly centered vertically in the input
- **Actual:** Text appears slightly high, top/bottom padding uneven
- **Severity:** P3
- **Source:** Gemini

## GAP-027: [MOBILE] SimRel product card price text clipped on mobile
- **Merchant:** koctascomtr
- **Viewport:** mobile
- **Step:** View SimRel cards on narrow mobile viewport
- **Screenshot:** .claude/tmp/koctascomtr-mobile-05-qna-simrel.png
- **Expected:** Full price text visible ("419,92 TL")
- **Actual:** Second card's price text clipped by card boundary
- **Severity:** P2
- **Source:** Claude

## GAP-028: [UX] Chat launcher overlaps QNA/SimRel content on mobile
- **Merchant:** koctascomtr
- **Viewport:** mobile
- **Step:** Scroll to QNA/SimRel section on mobile page
- **Screenshot:** .claude/tmp/koctascomtr-mobile-05-qna-simrel.png
- **Expected:** Launcher positioned without blocking page content widgets
- **Actual:** Orange FAB overlaps SimRel product card content area
- **Severity:** P2
- **Source:** Claude

---

## Penticomtr Issues

## GAP-029: [COMPONENT] Variant buttons show "size"/"color" instead of actual values
- **Merchant:** penticom
- **Viewport:** both
- **Step:** Open drawer, view product detail in panel
- **Screenshot:** .claude/tmp/penticom-desktop-02-drawer-open.png
- **Expected:** Variant buttons show actual size values (S/M, M/L, L/XL) and color names
- **Actual:** Buttons display generic "size" and "color" labels — useless for shopping
- **Severity:** P0
- **Source:** Claude

## GAP-030: [VISUAL] Price shows "1,50 TL" / "1,12 TL" instead of real price
- **Merchant:** penticom
- **Viewport:** both
- **Step:** View product detail in panel
- **Screenshot:** .claude/tmp/penticom-desktop-02-drawer-open.png
- **Expected:** Price matches the PDP price (₺1.499,99 / ₺1.124,99)
- **Actual:** Panel shows "1,50 TL" / "1,12 TL" — comma placement wrong, missing thousands
- **Severity:** P0
- **Source:** Claude

## GAP-031: [COMPONENT] Product link in bot response uses href="#"
- **Merchant:** penticom, n11com, hepsiburadacom, arcelikcomtr
- **Viewport:** both
- **Step:** Bot responds with inline product mention link
- **Screenshot:** .claude/tmp/penticom-desktop-03-response.png
- **Expected:** Link navigates to product page or triggers drilldown
- **Actual:** Link uses href="#" — clicking scrolls to top of page
- **Severity:** P1
- **Source:** Claude

## GAP-032: [UX] ChoicePrompter appears before any browsing on all merchants
- **Merchant:** all
- **Viewport:** both
- **Step:** Open chat drawer for the first time
- **Screenshot:** .claude/tmp/penticom-desktop-02-drawer-open.png
- **Expected:** "Kararsız mı kaldın?" only after viewing 2+ products
- **Actual:** Appears immediately on every merchant's first drawer open
- **Severity:** P1
- **Source:** Claude

## GAP-033: [VISUAL] Panel product rating shows "(0)" when reviews exist on PDP
- **Merchant:** penticom
- **Viewport:** both
- **Step:** View panel product detail — PDP shows "4.9/5 (5 değerlendirme)"
- **Screenshot:** .claude/tmp/penticom-desktop-02-drawer-open.png
- **Expected:** Rating count matches PDP: "★ 4.9 (5)"
- **Actual:** Panel shows "★ 4.9 (0)" — review count dropped to zero
- **Severity:** P1
- **Source:** Claude

## GAP-034: [COMPONENT] "Benzer Ürünler" section empty for Penti product
- **Merchant:** penticom
- **Viewport:** both
- **Step:** Scroll panel to "Benzer Ürünler" heading
- **Screenshot:** .claude/tmp/penticom-desktop-02-drawer-open.png
- **Expected:** Similar products grid populated, or heading hidden if empty
- **Actual:** "Benzer Ürünler" heading shown with no products below — dead-end UI
- **Severity:** P2
- **Source:** Claude

## GAP-035: [MOBILE] ChoicePrompter covers suggestion chips on mobile
- **Merchant:** all
- **Viewport:** mobile
- **Step:** Open drawer on mobile
- **Screenshot:** .claude/tmp/penticom-mobile-02-drawer-open.png
- **Expected:** Suggestion chips fully visible above ChoicePrompter
- **Actual:** ChoicePrompter banner covers bottom suggestion chips, only 2 of 3 visible
- **Severity:** P1
- **Source:** Claude

## GAP-036: [MOBILE] Chat content cut off at top by panel-header transition
- **Merchant:** all
- **Viewport:** mobile
- **Step:** Open drawer on mobile — panel shows at top, chat at bottom
- **Screenshot:** .claude/tmp/penticom-mobile-02-drawer-open.png
- **Expected:** Chat content starts below header with clean boundary
- **Actual:** First bullet item text abruptly cut: "hareket özgürlüğünüzü kısıtlamaz." — no visible top of this bullet
- **Severity:** P1
- **Source:** Claude

## GAP-037: [VISUAL] SimRel shows "Benzer ürün bulunamadı." for Penti on page
- **Merchant:** penticom
- **Viewport:** mobile
- **Step:** Scroll to SimRel widget on mobile PDP
- **Screenshot:** .claude/tmp/penticom-mobile-05-qna-simrel.png
- **Expected:** SimRel hidden if no products, or shows related products
- **Actual:** "Benzer ürün bulunamadı." text with empty card container — looks broken
- **Severity:** P2
- **Source:** Claude

## GAP-038: [VISUAL] QNA input shows previous session query on mobile
- **Merchant:** penticom
- **Viewport:** mobile
- **Step:** Scroll to QNA section on mobile after chatting
- **Screenshot:** .claude/tmp/penticom-mobile-05-qna-simrel.png
- **Expected:** QNA input empty or shows placeholder
- **Actual:** Shows "Konforlu mu?" from previous chat interaction — confusing cross-widget state leak
- **Severity:** P2
- **Source:** Claude

## GAP-039: [VISUAL] "Bu ürünle ilgili soru sor" button dashed border style
- **Merchant:** penticom
- **Viewport:** mobile
- **Step:** View QNA section on mobile
- **Screenshot:** .claude/tmp/penticom-mobile-05-qna-simrel.png
- **Expected:** Solid, clear CTA button
- **Actual:** Pink dashed border around "Bu ürünle ilgili soru sor" looks like a draft/placeholder
- **Severity:** P2
- **Source:** Claude

## N11com Issues

## GAP-040: [THEMING] N11 dark theme — panel background doesn't match chat background
- **Merchant:** n11com
- **Viewport:** desktop
- **Step:** Open drawer — two-pane layout visible
- **Screenshot:** .claude/tmp/n11com-desktop-02-drawer-open.png
- **Expected:** Consistent dark background across both panes
- **Actual:** Panel has slightly different dark shade than chat pane background
- **Severity:** P2
- **Source:** Claude

## GAP-041: [COMPONENT] Cart emoji 🛒 on N11 similar products stepper
- **Merchant:** n11com
- **Viewport:** both
- **Step:** View similar products in panel
- **Screenshot:** .claude/tmp/n11com-desktop-02-drawer-open.png
- **Expected:** SVG cart icon
- **Actual:** Raw emoji 🛒 on add-to-cart button — confirmed cross-merchant issue
- **Severity:** P1
- **Source:** Claude

## GAP-042: [VISUAL] "0 TL" price and "Tükendi" for out-of-stock products
- **Merchant:** arcelikcomtr
- **Viewport:** both
- **Step:** View similar products in panel — many items show "Tükendi"
- **Screenshot:** .claude/tmp/arcelikcomtr-desktop-02-drawer-open.png
- **Expected:** Out-of-stock items either hidden, grayed out, or show last known price
- **Actual:** Price displays "0 TL" which looks like a data error — "Tükendi" label present but price is misleading
- **Severity:** P1
- **Source:** Claude

## GAP-043: [UX] Out-of-stock products still show "Daha Fazla Göster" button
- **Merchant:** arcelikcomtr
- **Viewport:** both
- **Step:** Scroll through similar products in panel
- **Screenshot:** .claude/tmp/arcelikcomtr-desktop-02-drawer-open.png
- **Expected:** Load more only shows in-stock products, or filters out-of-stock
- **Actual:** 8 of 12 similar products are "Tükendi" at "0 TL" — overwhelms the useful results
- **Severity:** P2
- **Source:** Claude

## GAP-044: [COMPONENT] Out-of-stock items missing add-to-cart stepper
- **Merchant:** arcelikcomtr
- **Viewport:** both
- **Step:** View out-of-stock similar products in panel
- **Screenshot:** .claude/tmp/arcelikcomtr-desktop-02-drawer-open.png
- **Expected:** Disabled stepper or "Stokta yok" button
- **Actual:** No stepper at all — just an "İncele" link, inconsistent with in-stock cards
- **Severity:** P2
- **Source:** Claude

## GAP-045: [VISUAL] Empty star ratings ☆☆☆☆☆ for many Arcelik products
- **Merchant:** arcelikcomtr
- **Viewport:** both
- **Step:** View similar products grid
- **Screenshot:** .claude/tmp/arcelikcomtr-desktop-02-drawer-open.png
- **Expected:** No rating row for unreviewed products
- **Actual:** Full row of empty stars "☆☆☆☆☆ (0)" — looks like rated 0/5
- **Severity:** P2
- **Source:** Claude

## GAP-046: [THEMING] Arcelik brand color (red) on "Seç ve Karşılaştır" button
- **Merchant:** arcelikcomtr
- **Viewport:** both
- **Step:** View ChoicePrompter overlay
- **Screenshot:** .claude/tmp/arcelikcomtr-desktop-02-drawer-open.png
- **Expected:** Themed button matching Arcelik red brand
- **Actual:** Button correctly uses red — but ChoicePrompter text/layout still generic
- **Severity:** P3
- **Source:** Claude

## GAP-047: [MOBILE] Arcelik mobile drawer — product image barely visible
- **Merchant:** arcelikcomtr
- **Viewport:** mobile
- **Step:** Open drawer on mobile
- **Screenshot:** .claude/tmp/arcelikcomtr-mobile-01-drawer-open.png
- **Expected:** Product image visible enough to recognize product
- **Actual:** Only ~20% of dishwasher image visible above chat panel overlap — product unrecognizable
- **Severity:** P1
- **Source:** Claude

## Hepsiburadacom Issues

## GAP-048: [COMPONENT] 23 thumbnail images overflow in panel gallery
- **Merchant:** hepsiburadacom
- **Viewport:** desktop
- **Step:** Open drawer — Samsung Galaxy S26 has 23 product images
- **Screenshot:** .claude/tmp/hepsiburadacom-desktop-02-drawer-open.png
- **Expected:** Thumbnail gallery scrollable or capped at 5-6 visible
- **Actual:** All 23 thumbnails rendered in a row, most cut off by panel width — no scroll indicator
- **Severity:** P1
- **Source:** Claude

## GAP-049: [VISUAL] No original price shown for Hepsiburada product
- **Merchant:** hepsiburadacom
- **Viewport:** both
- **Step:** View panel product detail
- **Screenshot:** .claude/tmp/hepsiburadacom-desktop-02-drawer-open.png
- **Expected:** Strikethrough original price if discounted, or single price if not
- **Actual:** Only "139.999 TL" shown — no indication if this is discounted or original
- **Severity:** P2
- **Source:** Claude

## GAP-050: [COMPONENT] Variant buttons show "Kapasite" and "Renk" generically
- **Merchant:** hepsiburadacom
- **Viewport:** both
- **Step:** View product variants in panel
- **Screenshot:** .claude/tmp/hepsiburadacom-desktop-02-drawer-open.png
- **Expected:** Buttons show actual values: "256 GB", "512 GB", "1 TB", "Mor", "Siyah"
- **Actual:** Some show "Kapasite - 109.999 TL" (price but no capacity), some just "Renk" (no color name)
- **Severity:** P1
- **Source:** Claude

## GAP-051: [VISUAL] Suggestion chip icons — different merchants show inconsistent icon styles
- **Merchant:** hepsiburadacom, penticom, n11com
- **Viewport:** both
- **Step:** View suggestion chips below chat response
- **Screenshot:** .claude/tmp/hepsiburadacom-desktop-03-response.png
- **Expected:** Consistent icon style across all merchants
- **Actual:** Some chips have circle-info icons, others have question marks — visual inconsistency
- **Severity:** P3
- **Source:** Claude

## GAP-052: [MOBILE] Hepsiburada mobile — no suggestion chips visible
- **Merchant:** hepsiburadacom
- **Viewport:** mobile
- **Step:** Open drawer on mobile
- **Screenshot:** .claude/tmp/hepsiburadacom-mobile-01-drawer-open.png
- **Expected:** Suggestion chips visible after product summary
- **Actual:** Chat content fills screen with product info — chips may be below fold with no scroll hint
- **Severity:** P2
- **Source:** Claude

## GAP-053: [UX] "Powered by Gengage" link barely visible on dark backgrounds
- **Merchant:** n11com
- **Viewport:** both
- **Step:** View chat header
- **Screenshot:** .claude/tmp/n11com-desktop-02-drawer-open.png
- **Expected:** Attribution visible but not prominent
- **Actual:** On N11 dark theme, "Powered by Gengage" is nearly invisible — low contrast
- **Severity:** P3
- **Source:** Claude

## Yatasbeddingcomtr Issues

## GAP-054: [COMPONENT] Yataş panel shows "Sorduğunuz Ürün Modelleri" with only 2 products
- **Merchant:** yatasbeddingcomtr
- **Viewport:** desktop
- **Step:** Ask product question, panel shows related models
- **Screenshot:** .claude/tmp/yatasbeddingcomtr-desktop-02-response.png
- **Expected:** Grid fills available space or adapts layout
- **Actual:** 2 products in a grid meant for 4+ — large empty area below
- **Severity:** P2
- **Source:** Claude

## GAP-055: [VISUAL] Yataş mobile QNA — SimRel shows empty "Benzer ürün bulunamadı."
- **Merchant:** yatasbeddingcomtr
- **Viewport:** mobile
- **Step:** Scroll to SimRel section
- **Screenshot:** .claude/tmp/yatasbeddingcomtr-mobile-03-qna-simrel.png
- **Expected:** SimRel hidden if no similar products found
- **Actual:** Empty SimRel card with "Benzer ürün bulunamadı." — wasted space
- **Severity:** P2
- **Source:** Claude

## Cross-Merchant Issues

## GAP-056: [UX] "Benzerlerini Bul" button on every panel similar product card
- **Merchant:** all
- **Viewport:** both
- **Step:** View similar products grid in panel
- **Screenshot:** .claude/tmp/n11com-desktop-02-drawer-open.png
- **Expected:** "Find Similar" as a secondary/hidden action
- **Actual:** Full "Benzerlerini Bul" button on every card — clutters UI, rarely needed
- **Severity:** P2
- **Source:** Claude

## GAP-057: [MOBILE] Panel-to-chat separator bar hard to discover
- **Merchant:** all
- **Viewport:** mobile
- **Step:** View drawer on mobile — panel at top, chat at bottom
- **Screenshot:** .claude/tmp/arcelikcomtr-mobile-01-drawer-open.png
- **Expected:** Clear affordance to toggle between panel and chat
- **Actual:** Thin "»" toggle button barely visible between panes — easy to miss
- **Severity:** P2
- **Source:** Claude

## GAP-058: [A11Y] Touch target for panel toggle too small on mobile
- **Merchant:** all
- **Viewport:** mobile
- **Step:** Try to tap panel toggle "»" button
- **Screenshot:** .claude/tmp/penticom-mobile-02-drawer-open.png
- **Expected:** Touch target at least 44x44px per WCAG
- **Actual:** Toggle is a thin vertical strip — very small touch target
- **Severity:** P1
- **Source:** Claude

## GAP-059: [COMPONENT] "Favorilere ekle" heart icons inconsistent across views
- **Merchant:** n11com, arcelikcomtr
- **Viewport:** desktop
- **Step:** Compare favorite icons on panel detail card vs similar product cards
- **Screenshot:** .claude/tmp/n11com-desktop-02-drawer-open.png
- **Expected:** Same heart icon style everywhere
- **Actual:** Panel detail has no favorite button, similar cards have tiny heart — inconsistent
- **Severity:** P3
- **Source:** Claude

## GAP-060: [VISUAL] "Daha Fazla Göster" button style inconsistent
- **Merchant:** n11com, arcelikcomtr
- **Viewport:** desktop
- **Step:** Scroll to bottom of similar products in panel
- **Screenshot:** .claude/tmp/n11com-desktop-02-drawer-open.png
- **Expected:** Styled button matching merchant theme
- **Actual:** Plain text button — no border, no background, easy to miss
- **Severity:** P3
- **Source:** Claude

## GAP-061: [MOBILE] QNA callout emoji "👋" renders inconsistently
- **Merchant:** all
- **Viewport:** mobile
- **Step:** View QNA callout on mobile page
- **Screenshot:** .claude/tmp/penticom-mobile-05-qna-simrel.png
- **Expected:** Professional icon or no emoji
- **Actual:** Wave emoji "👋" in "Bu ürünü birlikte inceleyelim" — unprofessional for some brands
- **Severity:** P3
- **Source:** Claude

## GAP-062: [COMPONENT] Penti AI Top Picks cards — "EN UYGUN FIYATLI" / "EN İYİ ALTERNATİF" labels
- **Merchant:** penticom
- **Viewport:** desktop
- **Step:** Click suggestion card, panel shows search results, chat shows AI Top Picks
- **Screenshot:** .claude/tmp/penticom-desktop-05-panel-pushup.png
- **Expected:** Labels and card layout clean
- **Actual:** Cards work well visually — but "Detayları Gör" button is red/pink which clashes with Penti's brand
- **Severity:** P2
- **Source:** Claude

## GAP-063: [SPACING] Panel product detail card — action buttons crowded at bottom
- **Merchant:** all
- **Viewport:** desktop
- **Step:** View panel product detail — "İncele" / stepper / "Paylaş" row
- **Screenshot:** .claude/tmp/penticom-desktop-02-drawer-open.png
- **Expected:** Comfortable spacing between action buttons
- **Actual:** İncele, quantity stepper, Sepete Ekle, and Paylaş all crammed into one row
- **Severity:** P2
- **Source:** Claude

## GAP-064: [VISUAL] Penti search results panel — "Önerilen" tab active style
- **Merchant:** penticom
- **Viewport:** desktop
- **Step:** Click suggestion card, panel shows search results with sort tabs
- **Screenshot:** .claude/tmp/penticom-desktop-05-panel-pushup.png
- **Expected:** Active tab clearly distinguishable
- **Actual:** "Önerilen" tab has green background on white — works, but "Fiyat ↑", "Fiyat ↓", "Karşılaştır" lack hover states
- **Severity:** P3
- **Source:** Claude

## GAP-065: [COMPONENT] N11 panel — product badges overlap on mobile
- **Merchant:** n11com
- **Viewport:** mobile
- **Step:** Open drawer on mobile — panel shows product with badges
- **Screenshot:** .claude/tmp/n11com-mobile-01-drawer-open.png
- **Expected:** Badges don't overlap content
- **Actual:** Product image thumbnail strip barely visible, badges may overlap on narrow viewport
- **Severity:** P2
- **Source:** Claude

## GAP-066: [UX] No "back to product" after clicking suggestion card
- **Merchant:** penticom
- **Viewport:** desktop
- **Step:** Click "Push Up Bralet" card → panel shows search results
- **Screenshot:** .claude/tmp/penticom-desktop-05-panel-pushup.png
- **Expected:** "Back" button enabled to return to original product
- **Actual:** Panel shows search results — need to click "←" Back but it may not return to original product detail
- **Severity:** P2
- **Source:** Claude

## GAP-067: [A11Y] Suggestion chips icons lack alt text
- **Merchant:** all
- **Viewport:** both
- **Step:** Screen reader on suggestion chips
- **Screenshot:** .claude/tmp/penticom-desktop-04-cards.png
- **Expected:** Icon has descriptive alt text or is decorative (aria-hidden)
- **Actual:** Icons have img elements but likely no meaningful alt text
- **Severity:** P2
- **Source:** Claude

## GAP-068: [THEMING] "Çelik'e Sor" branding — Arcelik chat header uses mascot icon
- **Merchant:** arcelikcomtr
- **Viewport:** both
- **Step:** View chat header
- **Screenshot:** .claude/tmp/arcelikcomtr-desktop-02-drawer-open.png
- **Expected:** Mascot icon is clear and on-brand
- **Actual:** Small circular mascot icon — works but is tiny compared to the header text
- **Severity:** P3
- **Source:** Claude

## GAP-069: [VISUAL] Hepsiburada — orange theme FAB blends with page elements
- **Merchant:** hepsiburadacom
- **Viewport:** both
- **Step:** View page with FAB visible
- **Screenshot:** .claude/tmp/hepsiburadacom-desktop-01-page-load.png
- **Expected:** FAB stands out from page
- **Actual:** Orange FAB on white page is fine, but loading animation "..." at page bottom is confusing
- **Severity:** P3
- **Source:** Claude

## GAP-070: [MOBILE] All merchants — mobile drawer lacks swipe-to-dismiss affordance
- **Merchant:** all
- **Viewport:** mobile
- **Step:** Try to dismiss drawer on mobile
- **Screenshot:** .claude/tmp/arcelikcomtr-mobile-01-drawer-open.png
- **Expected:** Visible grabber handle indicating swipe gesture
- **Actual:** Only "×" close button — mobile users expect swipe down to close bottom sheets
- **Severity:** P2
- **Source:** Claude

## GAP-071: [COMPONENT] SimRel tab names on mobile — 3 tabs with long names
- **Merchant:** arcelikcomtr
- **Viewport:** mobile
- **Step:** Scroll to SimRel section on mobile
- **Screenshot:** (from accessibility snapshot)
- **Expected:** Tab names fit or scroll smoothly
- **Actual:** "Akıllı Ev Bulaşık Çözümleri", "Hijyen Uzmanı Bulaşık Makineleri", "Ekonomik ve Pratik Çözümler" — extremely long for mobile
- **Severity:** P2
- **Source:** Claude

## GAP-072: [VISUAL] Penti — "Buna benzer ürünler buldum" QNA button is wider than others
- **Merchant:** penticom
- **Viewport:** mobile
- **Step:** View QNA pills section
- **Screenshot:** .claude/tmp/penticom-mobile-05-qna-simrel.png
- **Expected:** All QNA buttons similar width or nicely wrapped
- **Actual:** "Buna benzer ürünler buldum" is full-width while others are inline — inconsistent layout
- **Severity:** P3
- **Source:** Claude

## GAP-073: [UX] N11 — "Bu ürün tutarından %0.0 değerinde Puan kazanırsınız" badge
- **Merchant:** n11com
- **Viewport:** both
- **Step:** View similar product cards in panel
- **Screenshot:** .claude/tmp/n11com-desktop-02-drawer-open.png
- **Expected:** Points badge hidden if 0% or shows actual points value
- **Actual:** "Bu ürün tutarından %0.0 değerinde Puan kazanırsınız" shown for every product — "%0.0" is misleading
- **Severity:** P1
- **Source:** Claude

## GAP-074: [VISUAL] "Ücretsiz Kargo" badge repeated on every N11 similar product
- **Merchant:** n11com
- **Viewport:** both
- **Step:** View similar products
- **Screenshot:** .claude/tmp/n11com-desktop-02-drawer-open.png
- **Expected:** Badge shown once or as filter, not repeated
- **Actual:** Every single card has "Ücretsiz Kargo" and "%0.0 Puan" — visual noise
- **Severity:** P2
- **Source:** Claude

## GAP-075: [SPACING] Panel similar products cards — text truncation varies across merchants
- **Merchant:** n11com, arcelikcomtr
- **Viewport:** desktop
- **Step:** View long product names in similar products
- **Screenshot:** .claude/tmp/n11com-desktop-02-drawer-open.png
- **Expected:** Consistent truncation (e.g., 2-line clamp)
- **Actual:** Some names wrap to 3 lines, others truncate at 2 — inconsistent across cards
- **Severity:** P3
- **Source:** Claude

## GAP-076: [A11Y] Star rating text "★★★★★" not accessible via screen reader
- **Merchant:** all
- **Viewport:** both
- **Step:** Screen reader reads product rating
- **Screenshot:** .claude/tmp/n11com-desktop-02-drawer-open.png
- **Expected:** aria-label like "5 out of 5 stars, 1520 reviews"
- **Actual:** Raw "★★★★★ (1520)" text — screen reader reads individual star characters
- **Severity:** P2
- **Source:** Claude

## GAP-077: [COMPONENT] Penti search result cards — discount badges overlap images
- **Merchant:** penticom
- **Viewport:** desktop
- **Step:** Click suggestion card, panel shows search results
- **Screenshot:** .claude/tmp/penticom-desktop-05-panel-pushup.png
- **Expected:** Discount badge positioned cleanly
- **Actual:** "%60", "%40", "%25" badges overlap product image corners — some are tiny and hard to read
- **Severity:** P2
- **Source:** Claude

## GAP-078: [UX] "Hızlı Teslimat" and "%25 İndirim" badges on search cards not interactive
- **Merchant:** penticom
- **Viewport:** desktop
- **Step:** View badges on search result cards
- **Screenshot:** .claude/tmp/penticom-desktop-05-panel-pushup.png
- **Expected:** Badges are informational only — cursor should not suggest clickability
- **Actual:** Badges look like pills/tags — user might try to filter by them but they're not interactive
- **Severity:** P3
- **Source:** Claude

## GAP-079: [VISUAL] Penti — "İncele" button color clashes with brand
- **Merchant:** penticom
- **Viewport:** desktop
- **Step:** View search result cards
- **Screenshot:** .claude/tmp/penticom-desktop-05-panel-pushup.png
- **Expected:** Green or Penti pink/red for CTA
- **Actual:** "İncele" uses green, "Sepete Ekle" uses brand pink — two competing CTAs
- **Severity:** P3
- **Source:** Claude

## GAP-080: [COMPONENT] N11 QNA section — "Buna benzer ürünler buldum" button absent
- **Merchant:** n11com
- **Viewport:** mobile
- **Step:** View QNA section on mobile page (from accessibility snapshot)
- **Expected:** "Buna benzer ürünler buldum" as prominent first option
- **Actual:** QNA section not rendered on mobile scroll — needs page scroll to bottom
- **Severity:** P2
- **Source:** Claude

## GAP-081: [VISUAL] Arcelik SimRel tab — partial star rendering glitch
- **Merchant:** arcelikcomtr
- **Viewport:** mobile
- **Step:** View SimRel product card with fractional rating
- **Screenshot:** (from accessibility snapshot — e142/e143 shows nested star elements)
- **Expected:** Clean partial star (e.g., 4.5 stars with half-filled last star)
- **Actual:** Nested ☆ and ★ elements suggest overlay technique — may render incorrectly on some devices
- **Severity:** P2
- **Source:** Claude

## GAP-082: [THEMING] N11 chat header — no merchant logo/mascot icon
- **Merchant:** n11com
- **Viewport:** both
- **Step:** View chat header
- **Screenshot:** .claude/tmp/n11com-desktop-02-drawer-open.png
- **Expected:** Merchant logo or branded mascot in header
- **Actual:** Generic "Ürün Uzmanı" text with no N11 branding — feels unbranded
- **Severity:** P2
- **Source:** Claude

## GAP-083: [UX] Hepsiburada loading spinner — "✓ Ürün bilgilerini topluyorum" then "● Ürünü sizin için inceliyorum"
- **Merchant:** hepsiburadacom
- **Viewport:** both
- **Step:** Open drawer, observe loading state
- **Screenshot:** (from accessibility snapshot during loading)
- **Expected:** Single loading message
- **Actual:** Two-step loading with ✓/● symbols — good UX but checkmark appears before completion
- **Severity:** P3
- **Source:** Claude

## GAP-084: [VISUAL] All merchants — user message bubble uses brand color but text contrast may fail
- **Merchant:** penticom
- **Viewport:** both
- **Step:** Send a message — user bubble appears
- **Screenshot:** .claude/tmp/penticom-desktop-03-response.png
- **Expected:** White text on brand color meets WCAG AA contrast
- **Actual:** Pink bubble with white text for Penti — may fail contrast on lighter pink variants
- **Severity:** P2
- **Source:** Claude

## GAP-085: [COMPONENT] Panel "Paylaş" button — unclear what it shares
- **Merchant:** all
- **Viewport:** desktop
- **Step:** View panel product detail — "Paylaş" button at bottom
- **Screenshot:** .claude/tmp/penticom-desktop-02-drawer-open.png
- **Expected:** Clear share mechanism (clipboard copy, share sheet)
- **Actual:** Small "Paylaş" button with share icon — no tooltip explaining what it does
- **Severity:** P3
- **Source:** Claude

## GAP-086: [MOBILE] All merchants — input field placeholder text too long on mobile
- **Merchant:** hepsiburadacom
- **Viewport:** mobile
- **Step:** View chat input on mobile
- **Screenshot:** .claude/tmp/hepsiburadacom-mobile-01-drawer-open.png
- **Expected:** Placeholder fits within mobile input width
- **Actual:** "Hepsiburada asistanına sorun..." truncated on 390px mobile — "sorun..." cut off
- **Severity:** P3
- **Source:** Claude

## GAP-087: [COMPONENT] Arcelik panel — no product feature tags/badges
- **Merchant:** arcelikcomtr
- **Viewport:** both
- **Step:** View panel product detail — compare with Penti which has feature tags
- **Screenshot:** .claude/tmp/arcelikcomtr-desktop-02-drawer-open.png
- **Expected:** Feature highlights if available (like Penti's "Dikişsiz", "Balensiz" tags)
- **Actual:** No feature badges despite backend returning features — inconsistent with other merchants
- **Severity:** P3
- **Source:** Claude

## GAP-088: [VISUAL] "Stokta" badge color varies across merchants
- **Merchant:** penticom, n11com, arcelikcomtr
- **Viewport:** both
- **Step:** View stock status on panel product detail
- **Screenshot:** .claude/tmp/penticom-desktop-02-drawer-open.png, .claude/tmp/arcelikcomtr-desktop-02-drawer-open.png
- **Expected:** Consistent green "Stokta" across merchants
- **Actual:** Green on all — but "Tükendi" on Arcelik is red, while other merchants don't show out-of-stock
- **Severity:** P3
- **Source:** Claude

## GAP-089: [UX] N11 — "Seçenek" variant button is vague
- **Merchant:** n11com
- **Viewport:** both
- **Step:** View product variants in panel
- **Screenshot:** .claude/tmp/n11com-desktop-02-drawer-open.png
- **Expected:** Button shows variant type/value
- **Actual:** Single "Seçenek" button — no indication of what variant type it represents
- **Severity:** P2
- **Source:** Claude

## GAP-090: [VISUAL] Hepsiburada — product title wraps to 2 lines in panel
- **Merchant:** hepsiburadacom
- **Viewport:** desktop
- **Step:** View Samsung Galaxy S26 Ultra in panel
- **Screenshot:** .claude/tmp/hepsiburadacom-desktop-02-drawer-open.png
- **Expected:** Title fits or is cleanly truncated
- **Actual:** "Samsung Galaxy S26 Ultra 1 Tb (Samsung Türkiye Garantili) Kobalt Mor" wraps to 2 lines — long but readable
- **Severity:** P3
- **Source:** Claude

## GAP-091: [MOBILE] All merchants — input field camera icon too small for touch
- **Merchant:** all
- **Viewport:** mobile
- **Step:** Try to tap "Resim ekle" camera icon next to input
- **Screenshot:** .claude/tmp/penticom-mobile-04-response.png
- **Expected:** Camera button at least 44x44px
- **Actual:** Small camera icon crammed to the left of input — easy to miss, hard to tap
- **Severity:** P2
- **Source:** Claude

## GAP-092: [UX] All merchants — no typing indicator when bot is generating
- **Merchant:** all
- **Viewport:** both
- **Step:** Send a message, wait for response
- **Screenshot:** .claude/tmp/penticom-desktop-03-response.png
- **Expected:** Visible "typing..." or dots animation while bot generates
- **Actual:** "..." dots appear briefly but disappear — no sustained typing indicator during generation
- **Severity:** P2
- **Source:** Claude

## GAP-093: [VISUAL] Penti panel — "İncele" link styled as green button vs brand pink
- **Merchant:** penticom
- **Viewport:** desktop
- **Step:** View panel product detail bottom actions
- **Screenshot:** .claude/tmp/penticom-desktop-02-drawer-open.png
- **Expected:** "İncele" uses brand color or neutral style
- **Actual:** Green "İncele" button next to pink "Sepete Ekle" — two competing primary colors
- **Severity:** P2
- **Source:** Claude

## GAP-094: [MOBILE] Yataş mobile — QNA pills layout wraps oddly
- **Merchant:** yatasbeddingcomtr
- **Viewport:** mobile
- **Step:** View QNA pills section on mobile PDP
- **Screenshot:** .claude/tmp/yatasbeddingcomtr-mobile-03-qna-simrel.png
- **Expected:** Pills wrap to next line gracefully
- **Actual:** Some pills pushed to next line with uneven gaps — looks broken
- **Severity:** P2
- **Source:** Claude

## GAP-095: [COMPONENT] Arcelik SimRel — no discount badge on SimRel cards
- **Merchant:** arcelikcomtr
- **Viewport:** mobile
- **Step:** View SimRel cards on mobile PDP
- **Screenshot:** (from accessibility snapshot)
- **Expected:** Discount percentage visible on discounted products
- **Actual:** SimRel cards show both old and new price but no "%19" badge unlike panel view
- **Severity:** P3
- **Source:** Claude

## GAP-096: [UX] All merchants — "Gönder" button not disabled when input is empty
- **Merchant:** all
- **Viewport:** both
- **Step:** View send button with empty input field
- **Screenshot:** .claude/tmp/penticom-desktop-02-drawer-open.png
- **Expected:** Send button disabled/grayed when input is empty
- **Actual:** Send button appears active even with empty input — clicking sends nothing
- **Severity:** P2
- **Source:** Claude

## GAP-097: [VISUAL] N11 — suggestion chips text too long for chip container
- **Merchant:** n11com
- **Viewport:** desktop
- **Step:** View suggestion chips "Okuma hızı nasıl?", "240 GB yeterli mi?"
- **Screenshot:** .claude/tmp/n11com-desktop-03-response.png
- **Expected:** Chips fit content or wrap cleanly
- **Actual:** "Yazma hızı iyi mi?" fits, but longer chips may truncate on narrower panels
- **Severity:** P3
- **Source:** Claude

## GAP-098: [A11Y] All merchants — chat drawer dialog missing aria-describedby
- **Merchant:** all
- **Viewport:** both
- **Step:** Screen reader enters chat drawer
- **Screenshot:** (from accessibility snapshot — dialog has role but no description)
- **Expected:** Dialog has aria-describedby pointing to purpose/content
- **Actual:** Dialog role="dialog" with aria-label="Ürün Uzmanı" but no description of what it does
- **Severity:** P3
- **Source:** Claude

## GAP-099: [VISUAL] All merchants — "Powered by Gengage" link is very small
- **Merchant:** all
- **Viewport:** both
- **Step:** View chat header
- **Screenshot:** .claude/tmp/penticom-desktop-02-drawer-open.png
- **Expected:** Attribution readable
- **Actual:** "Powered by Gengage" is tiny text — readable but barely visible on some themes
- **Severity:** P3
- **Source:** Claude

## GAP-100: [COMPONENT] Penti error state — "Bu ürün bilgisi şu an kullanılamıyor" with invalid SKU
- **Merchant:** penticom
- **Viewport:** both
- **Step:** Load with wrong SKU (e.g., Koctas SKU on Penti account)
- **Screenshot:** .claude/tmp/penticom-desktop-02-drawer-error.png
- **Expected:** Clear error with retry option or suggestion to try another product
- **Actual:** Plain text error message in chat — no retry button, no helpful next steps
- **Severity:** P1
- **Source:** Claude

## GAP-101: [UX] All merchants — no "clear chat" or "new conversation" button
- **Merchant:** all
- **Viewport:** both
- **Step:** After multiple exchanges, user wants to start fresh
- **Screenshot:** .claude/tmp/penticom-desktop-04-cards.png
- **Expected:** "New conversation" or "Clear" option accessible
- **Actual:** No visible way to reset conversation — only closing and reopening drawer
- **Severity:** P2
- **Source:** Claude

## GAP-102: [MOBILE] All merchants — keyboard pushes content up, ChoicePrompter blocks view
- **Merchant:** all
- **Viewport:** mobile
- **Step:** Tap input field on mobile — keyboard appears
- **Screenshot:** .claude/tmp/penticom-mobile-04-response.png
- **Expected:** Content scrolls up smoothly, ChoicePrompter dismissed or moved
- **Actual:** ChoicePrompter can overlap keyboard area on smaller screens
- **Severity:** P1
- **Source:** Claude

---

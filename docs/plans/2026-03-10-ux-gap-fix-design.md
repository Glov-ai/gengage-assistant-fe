# UX Gap Fix Design — Theme-Based Sprints

**Date:** 2026-03-10
**Source:** GAP.md (104 verified issues across 6 merchants)
**Approach:** Theme-based sprints delivering coherent UX improvements
**Estimated effort:** ~360 lines of code across ~8.5 sessions

## Strategy

Fix 92 of 104 issues in 8 themed sprints. Each sprint ships a complete "experience story" — users feel a coherent improvement after each one. The remaining 12 issues are design decisions, edge cases, or low-value polish that can be deferred.

Backend-dependent issues (5 P0s) get a requirements doc shipped to the backend team. Frontend adds resilience so these merchants fail gracefully.

## Sprint 1: Quick Wins (~18 issues, ~40 lines, 1 session)

Trivial 1-3 line fixes. Establishes momentum.

### Accessibility atoms
| GAP | Fix | File | Lines |
|-----|-----|------|-------|
| 033 | `role="alert"` on error div | ChatDrawer.ts:799 | 1 |
| 066 | `role="dialog"` + `aria-label` on comparison table | ComparisonTable.ts | 2 |
| 067 | `aria-describedby` on suggested action buttons | ChatDrawer.ts (setPills) | 3 |
| 090 | `aria-pressed` on favorite button | ChatDrawer.ts | 3 |
| 084 | Full product name as SimRel card alt text | simrel/ProductCard.ts | 1 |

### i18n fixes
| GAP | Fix | File | Lines |
|-----|-----|------|-------|
| 065 | Turkish labels for SimRel stepper | simrel/ProductCard.ts + i18n | 3 |
| 104 | Variant "size" → "Beden" in Yataş config | yatasbeddingcomtr config | 1 |

### CSS micro-fixes
| GAP | Fix | File | Lines |
|-----|-----|------|-------|
| 045 | `gap: 8px` on QNA pill container | qna components CSS | 1 |
| 052 | Bot response left-border padding 4→12px | chat.css | 1 |
| 055 | Mobile bot text `line-height: 1.5` | chat.css | 1 |
| 060 | Stepper/ATC height alignment | chat.css | 1 |
| 117 | Center send button icon with flexbox | chat.css | 2 |
| 118 | KVKK close button contrast increase | chat.css | 1 |

### Data display guards
| GAP | Fix | File | Lines |
|-----|-----|------|-------|
| 042 | Hide loyalty points when value ≤ 0 | renderUISpec.ts | 2 |
| 017 | Normalize price decimal formatting | price-formatter.ts | 3 |

## Sprint 2: Resilient Errors (~12 issues, ~60 lines, 1 session)

Every failure path feels intentional. No dead ends.

### Retry deduplication (GAP-002)
In `index.ts:_sendAction()`, check if last message in `_messages` has identical text + role before calling `drawer.addMessage()`. Skip duplicate, just re-send the action. ~5 lines.

### Error visibility (GAP-009)
After `showError()` appends the error div, call `errEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })`. 1 line in ChatDrawer.ts.

### Error recovery paths (GAP-040, GAP-039)
Add `showErrorWithRecovery()` method that calls `showError()` then `setPills()` with recovery actions: "Tekrar dene", "Başka bir şey sor", optionally "Popüler ürünler". ~15 lines in ChatDrawer.ts + i18n keys.

### SimRel graceful failure (GAP-036, GAP-037, GAP-068)
In `simrel/index.ts` catch block, render error state div with retry button. Wrap fetch in `Promise.race` with 10s timeout. ~20 lines across index.ts and ProductGrid.ts.

### Grouping card error fallback (GAP-003)
Show error inline under the clicked card. Disable the card visually (opacity + pointer-events). ~10 lines in action handler.

### Consecutive error detection (GAP-038, GAP-106, GAP-114)
When chat returns same error 2+ times consecutively, show "Bu hesap şu an aktif değil" with merchant support link. ~10 lines in stream error handler.

## Sprint 3: Mobile-First (~10 issues, ~45 lines, 1 session)

Mobile feels native after this sprint.

### Panel height ratio (GAP-007, GAP-008)
Panel `max-height: 30vh` when both panel + chat visible on mobile. Product image `object-fit: contain` with fixed height. ~5 lines CSS.

### Panel separator touch target (GAP-096)
Increase drag handle to 44px height. Pill-shaped grab handle (40px × 4px rounded bar). ~10 lines CSS.

### Swipe gesture (GAP-101)
Extend existing vertical swipe detection to horizontal swipe on panel/chat panes. 50px threshold, `touch-action: pan-y`. ~25 lines in ChatDrawer.ts.

### iOS safe area (GAP-116)
Add `padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px))` to input area in mobile half-sheet context. ~2 lines CSS.

### User bubble overflow (GAP-054)
`max-width: calc(100% - 16px)` and `word-break: break-word` on mobile. ~2 lines CSS.

### Mobile drawer gap (GAP-091)
Full-sheet mode: `top: 0; border-radius: 0`. ~2 lines CSS.

### Response text clipping (GAP-077)
`overflow-wrap: break-word` and `padding-bottom: 12px` on bot bubbles. ~2 lines CSS.

### AI card scroll margin (GAP-078)
`scroll-margin-top: 60px` on AI cards. 1 line CSS.

## Sprint 4: Smart Comparison (~6 issues, ~40 lines, 1 session)

Comparison feels helpful, not intrusive.

### Timing — require 2+ viewed products (GAP-026)
Track `_viewedProductSkus: Set<string>`. Show prompter only after set size ≥ 2. ~8 lines in index.ts.

### Positioning — above grid, not over buttons (GAP-105, GAP-113)
Move prompter mount from `panel.appendChild()` to `panel.insertBefore(prompter, gridContainer)`. On mobile, render as slim banner at panel top. ~5 lines DOM + ~10 lines CSS.

### Context-aware dismissal (GAP-001)
Replace session-wide boolean with per-thread `Set<threadId>`. Modify `isChoicePrompterDismissed()` to accept threadId. ~10 lines.

### Compare pill alignment (GAP-051)
Change from user-message styling to bot-side outlined styling. ~3 lines CSS.

### Compare button timing (GAP-015)
Append compare CTA after `chatStreamEnd`, not during streaming. 500ms fade-in. ~5 lines.

### Popover close alignment (GAP-058)
Fix `×` padding: `top: 8px; right: 8px`. 2 lines CSS.

## Sprint 5: Accessibility (~8 issues, ~20 lines, 1 session)

WCAG 2.1 AA compliance. Net of Sprint 1 overlap.

| GAP | Fix | Lines |
|-----|-----|-------|
| 028 | `title` tooltip on panel toggle button | 1 |
| 048 | Stop button contrast: themed border + text color | 3 CSS |
| 018 | Normalize suggested action icon defaults | 3 |
| 023 | "Stokta" badge: font-weight 600, subtle background | 3 CSS |
| — | Comparison dialog focus trap (builds on 066) | 8 |
| — | `aria-atomic="false"` + `role="listitem"` on messages | 2 |

## Sprint 6: Visual Consistency (~25 issues, ~55 lines, 2 sessions)

Every pixel feels intentional.

### Sub-theme A: Card & Grid Polish
| GAP | Fix | Lines |
|-----|-----|-------|
| 013 | Title `-webkit-line-clamp: 2` | 1 CSS |
| 029 | SimRel: render full untruncated name | 5 |
| 049 | Grouping thumbnails min 48×48px | 2 CSS |
| 056 | AI card text `gap: 4px` | 1 CSS |
| 111 | Card height: flex + fixed promotion slot | 3 CSS |
| 103 | Promotion badge `title` + mobile 2-line wrap | 5 |
| 097 | Discount/favorite positioning separation | 3 CSS |

### Sub-theme B: Icons & Buttons
| GAP | Fix | Lines |
|-----|-----|-------|
| 031, 115 | Replace 🛒 emoji with inline SVG | 8 |
| 092 | SimRel "İncele" default to `--gengage-primary` | 5 |
| 076 | Share icon size 12→20px | 1 CSS |
| 093 | Close button touch target 32px | 2 CSS |

### Sub-theme C: Chat Pane Polish
| GAP | Fix | Lines |
|-----|-----|-------|
| 047 | Loading step flex alignment | 2 CSS |
| 012 | Star rating: simple ★/☆ string rendering | 5 |
| 063 | Review link underline: subtle accent color | 2 CSS |

### Sub-theme D: Theme Alignment
| GAP | Fix | Lines |
|-----|-----|-------|
| 043 | n11 header: `var(--gengage-header-bg)` | 1 CSS |
| 071 | Distinct `--gengage-error: #dc2626` token | 3 CSS |
| 081 | Bot avatar from `config.launcherImage` in header | 5 |
| 080 | n11 pill border: `var(--gengage-primary-light)` | 1 CSS |
| 100 | SimRel tab indicator: standardized underline | 2 CSS |
| 057 | n11 input placeholder vertical centering | 1 CSS |

## Sprint 7: Engagement Features (~8 issues, ~100 lines, 1 session)

Widget feels proactive and helpful.

### Welcome message (GAP-112)
Add `welcomeMessage?: string` and `welcomeActions?: string[]` to config. On first drawer open with empty messages, inject bot message + starter pills. ~20 lines.

### New conversation button (GAP-072)
"Yeni Sohbet" icon button in header. Clears messages, resets panel/comparison state, generates new threadId, persists to IndexedDB. 200ms fade-out animation. ~35 lines.

### Loading skeletons (GAP-020, GAP-083)
Shared `createSkeleton('card' | 'message')` utility. Show 3 skeleton cards in panel during streaming. Skeleton message on first drawer open. ~30 lines.

### Animated loading steps (GAP-027)
CSS `pulse` keyframe on active loading step bullet. Wrapped in `prefers-reduced-motion`. ~5 lines CSS.

### Panel scroll affordance (GAP-019)
Bottom fade gradient (40px) on scrollable panel grid. Remove on scroll-to-bottom. ~13 lines.

### Navigation tooltips (GAP-021)
`title` attributes on ←/→ buttons from panel history stack labels. ~5 lines.

### "Bu mesaja geri dön" tooltip (GAP-087)
Add `title="Bu paneli göster"`. 1 line.

### Panel product transition (GAP-089)
150ms opacity crossfade via `.gengage-chat-panel--transitioning` class. ~7 lines.

## Sprint 8: Backend Requirements Doc (5 P0s, 1 doc)

Document: `docs/backend-requirements.md`

### Section 1: Broken Chat (P0)
- hepsiburadacom, penticom: every query → "Bu ürün bilgisi şu an kullanılamıyor"
- Test: `npm run dev -- hepsiburadacom --sku=5002998547`
- Expected: general queries work without PDP product data

### Section 2: Empty SimRel (P0)
- n11com, hepsiburadacom, arcelikcomtr, penticom: `/simrel` returns empty
- Only koctascomtr and yatasbeddingcomtr have working similar products

### Section 3: Missing PDP Context (P1)
- arcelikcomtr: chat ignores SKU in request payload
- Test: `npm run dev -- arcelikcomtr --sku=1000465056`

### Section 4: Missing QNA Questions (P1)
- hepsiburadacom, arcelikcomtr, penticom: no contextual questions returned
- Expected: 3-5 product-specific questions per SKU

### Section 5: Zero-Value Data (P2)
- n11com: `points: 0.0` in product data (frontend hides it, backend should omit)

### Section 6: Grouping Card Errors (P1)
- koctascomtr: category drill-down requests from suggestedActions fail

## Deferred Issues (12)

Not fixing — design decisions, edge cases, or low value:

| GAP | Reason |
|-----|--------|
| 005 | Product summary persistence is expected chat history behavior |
| 010 | "Benzerlerini Bul" overlay is intentional quick-access design |
| 011 | Dense review text is backend content — not a frontend fix |
| 025 | Launcher proximity to page buttons depends on host page layout |
| 034 | QNA CTA intentionally styled differently (secondary action) |
| 035 | Mobile input height is standard and necessary |
| 050 | Scroll boundary clipping is normal scrollable container behavior |
| 064 | "AI Asistan" footer is branding placement decision |
| 069 | Loading step desync is timing issue in NDJSON stream order |
| 074 | "Benzerlerini Bul" presence depends on backend data |
| 085 | Drawer width is configurable via CSS custom property |
| 088 | "Powered by Gengage" is contractual branding requirement |

## Constraints

- Never modify wire protocol, NDJSON streaming, or `/chat/*` endpoint paths
- All new i18n keys need both `tr` and `en` entries
- Wrap animations in `@media (prefers-reduced-motion: no-preference)`
- Run `npm run typecheck && npm run test` after every sprint
- No `Co-Authored-By` trailers in commits

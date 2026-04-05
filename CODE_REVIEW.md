# Code Review

Branch reviewed against `origin/main` on `visual-updates`.

## Outcome

This branch contains substantial product and design-system improvements, but it is **not clean enough to merge as-is**.

What is green locally:

- `npm run typecheck` ✅
- `npm run build` ✅
- `git diff --check` ✅

What is still red locally:

- `npm test` ❌
  - `19` failed test files
  - `50` failed tests

The build is clean, but the current branch still has merge-blocking review findings.

## Review Summary

The branch successfully moves the frontend toward a shared token-based design system and a more coherent desktop shopping UX. The overall direction is strong:

- shared tokens/primitives are real and active
- chat/main-pane/listing/compare flows are significantly more systemized
- the global visual language is closer to the earlier design references
- client theming is more centralized than before

However, the current branch also changes several public-facing UI contracts and behaviors in ways that are either:

- not fully covered by tests
- not backward-compatible with existing expectations
- or still broader than the PR narrative currently communicates

## Findings

### High: Test suite is not green

Files / areas:

- `tests/ai-suggested-search-cards.test.ts`
- `tests/comparison-table.test.ts`
- `tests/simrel-components.test.ts`
- `tests/render-uispec.test.ts`
- `tests/auto-expand-textarea.test.ts`
- `tests/ux-features.test.ts`
- `tests/comparison-select.test.ts`
- `tests/promotions-badges.test.ts`
- `tests/ai-top-picks*.test.ts`
- `tests/ai-grouping*.test.ts`
- `tests/price-formatter.test.ts`
- `tests/simrel-renderer.test.ts`
- `tests/zero-value-guards.test.ts`
- plus related chat/simrel/comparison renderers

Why this matters:

- This is the clearest merge blocker.
- Some failures are stale test expectations after intentional UX changes.
- But several failures also expose real contract drift and regression risk:
  - placeholder/i18n behavior changed
  - comparison selection semantics changed
  - comparison results DOM contract changed
  - price formatting semantics changed
  - simrel add-to-cart behavior changed
  - promotion badge behavior changed

Concrete examples from the current run:

- `tests/auto-expand-textarea.test.ts`
  - English placeholder still expects locale-driven text, but the widget now hardcodes Turkish shared copy.
- `tests/price-formatter.test.ts`
  - formatter now removes decimals and rounds numeric inputs, which is a behavior change, not just a style change.
- `tests/comparison-select.test.ts`
  - comparison selector moved from checkbox semantics to button/docked-flow semantics.
- `tests/comparison-table.test.ts`
  - recommended-product and comparison-header DOM contract changed significantly.
- `tests/simrel-components.test.ts`
  - stepper-based add-to-cart path was removed.

Resolution plan:

1. Triage every failing test into one of two buckets:
   - stale test due to intentional product decision
   - genuine regression or public contract break
2. Fix genuine regressions in code first, especially:
   - locale/customization regressions
   - unsafe price rounding behavior
3. Rewrite only the tests that are outdated because the product behavior intentionally changed.
4. Re-run `npm test` until the suite is fully green before merge.
5. Update the PR description so the behavioral changes are called out explicitly where tests were intentionally changed.

### High: Shared input placeholder and header byline are hardcoded, bypassing locale and client configuration

Files:

- `src/chat/components/ChatDrawer.ts`
- `src/chat/locales/en.ts`
- `src/chat/locales/tr.ts`
- `src/chat/types.ts`

Why this matters:

- The chat input placeholder is now forced via `_getSharedInputPlaceholder()` to `Ürün ara, soru sor`.
- The byline under the title is now forced via `_getSharedBylineText()` to `Gengage ile`.
- This bypasses the existing locale/config model instead of using it.
- As a result:
  - English locale no longer renders the expected English placeholder
  - any client expecting to control `inputPlaceholder` or `poweredBy` through i18n/config no longer truly owns those strings

This is not just a test issue. It changes the public customization contract of the widget.

Resolution plan:

1. Keep the new default copy, but move it back into the locale/config system rather than hardcoding in `ChatDrawer`.
2. Use locale defaults as the source of truth:
   - TR default can be `Ürün ara, soru sor`
   - EN default can be the English equivalent
3. Let explicit client config/i18n overrides still win.
4. Remove the helper methods that bypass locale resolution.
5. Add focused tests for:
   - default TR copy
   - default EN copy
   - explicit client override

### High: `formatPrice()` now rounds fractional values, which can display inaccurate prices

Files:

- `src/common/price-formatter.ts`

Why this matters:

- The formatter now defaults to hiding decimals, which was an intentional UX direction.
- But the implementation does this by calling `Math.round(num)` whenever `alwaysShowDecimals` is `false`.
- That means:
  - `17990.5` becomes `17.991 TL`
  - `49.99` becomes `50 TL`
  - `149.99` becomes `150 TL`
- This is not just “hiding kuruş.” It changes the numeric value being shown.

For a shopping UI, that is risky and can be misleading.

Resolution plan:

1. Replace the current boolean-driven rounding logic with a clearer display policy:
   - preserve exact decimals when the source has a fractional component
   - hide decimals only when the value is effectively whole
2. If product wants integer-only visual formatting, add an explicit rounding mode:
   - `hide_zero_decimals`
   - `round_nearest_integer`
   - `floor_integer`
3. Keep Turkish defaults as “hide trailing `.00`” rather than “round all fractional values”.
4. Update tests to cover both:
   - whole-number TL display without kuruş
   - true fractional values remaining accurate

### Medium: Several behavioral changes are real product changes, but the PR currently reads as if this is mostly a styling/system PR

Files / areas:

- `src/chat/components/renderUISpec.ts`
- `src/chat/components/ComparisonTable.ts`
- `src/chat/components/ChatDrawer.ts`
- `src/simrel/components/ProductCard.ts`
- `src/common/price-formatter.ts`
- `src/chat/components/AITopPicks.ts`
- `src/chat/components/AIGroupingCards.ts`
- `src/chat/components/AISuggestedSearchCards.ts`

Why this matters:

- This branch does much more than introduce a design system.
- It also changes user behavior and product behavior, for example:
  - direct add-to-cart replaces stepper flow
  - comparison selection model changes
  - comparison results screen structure changes
  - top-picks/grouping cards change content density and interaction patterns
  - listing promo badges were removed in some flows
  - placeholder/byline defaults changed
  - price formatting changed

These may all be acceptable decisions, but they need to be presented honestly as behavior changes, not only design-system refactors.

Resolution plan:

1. Update the PR description to separate:
   - design-system foundation
   - UX/product behavior changes
   - client-theme defaults
2. Explicitly list the user-visible changes:
   - direct add-to-cart
   - compare flow changes
   - no-`.00` pricing
   - category/grouping/top-picks redesign
3. Ensure each behavior change either:
   - has passing coverage
   - or is called out as follow-up work

### Medium: PR scope is still broad for one merge

Files / areas:

- `src/design-system/**`
- `src/chat/**`
- `src/qna/**`
- `src/simrel/**`
- `src/simbut/**`
- `docs/**`
- `demos/arcelikcomtr/index.html`
- tests and supporting infra

Why this matters:

- The diff remains very large:
  - ~90 files changed
  - ~5.4k insertions
  - ~1.6k deletions
- The branch now mixes:
  - new design-system architecture
  - desktop UX redesign
  - product-flow changes
  - localization/default-copy changes
  - toast/error work
  - demo updates
  - docs
  - test changes

That increases review and rollback risk.

Resolution plan:

1. Keep this PR, but narrow its description around what truly shipped.
2. Avoid adding more unrelated cleanup to this branch.
3. If more work is needed, do it in follow-up PRs:
   - locale/customization cleanup
   - test debt cleanup
   - additional demo/client passes

### Medium: SimRel and comparison tests show that some public interaction contracts changed without a compatibility layer

Files / areas:

- `src/simrel/components/ProductCard.ts`
- `src/simrel/index.ts`
- `src/chat/components/FloatingComparisonButton.ts`
- `src/chat/components/renderUISpec.ts`
- `src/chat/index.ts`

Why this matters:

- SimRel used to expose stepper-based add-to-cart behavior in tests and UI flows; now that path is gone.
- Comparison selection also shifted from checkbox-style semantics to a button/dock flow.
- Those are legitimate UX changes, but they are still compatibility changes for any host code/tests that depended on the older model.

Resolution plan:

1. Confirm whether these are intended permanent contract changes.
2. If yes:
   - update docs and tests accordingly
   - call them out explicitly in the PR
3. If no:
   - add a compatibility layer or fallback behavior

### Low: Existing review document and PR body were stale and overstated validation status

Files:

- `CODE_REVIEW.md`
- PR `#25` body

Why this matters:

- The previous review doc stated that there were no blockers and that `npm test` was green.
- That is no longer true for the current branch state.

Resolution plan:

1. Keep this file honest and synchronized with the current branch state.
2. Update the PR body so it no longer claims green tests unless the suite is actually green.

## Fixed During Review Prep

These issues were already corrected on the branch before this review write-up:

- major chat/listing/panel surfaces were moved further onto shared tokens/primitives
- assistant message bubbles were migrated to a real primitive path
- the old first-message red rail was removed as the intended default
- progress/loading flows were redesigned around shared loading primitives
- comparison selection was capped at 5 products
- global error toast was moved toward token-driven styling
- Arçelik header branding was aligned more closely to the original reference

## Recommended Merge Path

This is the safest path from here:

1. Fix the blocking code issues first:
   - locale/config bypass
   - price rounding behavior
2. Make the test suite green.
3. Update the PR body to match the actual shipped behavior and actual validation state.
4. Merge only after the branch is again in a fully validated state.

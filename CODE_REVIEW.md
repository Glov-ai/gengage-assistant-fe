# Code Review

Branch reviewed against `origin/main` on `visual-updates`.

## Outcome

This branch is now in a mergeable state.

Validation completed locally:

- `npm test` ✅
- `npm run typecheck` ✅
- `npm run build` ✅
- `git diff --check` ✅

## Review Summary

The branch introduces a shared token-based design-system foundation and carries that system through the highest-traffic shopping surfaces:

- chat shell and message primitives
- main-pane panel/header/navigation patterns
- list/product cards
- AI top picks, grouping, suggested-search, and comparison flows
- QNA / SimRel / SimBut styling alignment

It also includes intentional product-behavior updates:

- direct add-to-cart instead of quantity stepper in listing-style contexts
- simplified comparison-selection flow with a docked compare bar
- comparison results redesign
- compact price formatting that hides trailing `,00`
- cleaner client-wide copy defaults and header byline handling

## Findings

No blocking defects remain after reconciliation.

## Resolved Blockers

### Locale and customization contract

Previously, the chat input placeholder and header byline had drifted into hardcoded component logic.

Resolved:

- `src/chat/components/ChatDrawer.ts` now uses locale/config-driven values again
- Turkish defaults remain aligned with the intended product copy
- client and locale overrides can still win cleanly

### Price formatting accuracy

Previously, hiding decimals also rounded fractional prices, which could misstate real values.

Resolved:

- `src/common/price-formatter.ts` now hides decimals only for effectively whole amounts
- true fractional prices stay accurate
- tests were updated to reflect the intended compact-price contract

### Test suite contract drift

Many tests were still asserting the old UI/interaction contract.

Resolved by reconciling tests with the intentionally shipped product behavior:

- compare selection now uses button/dock semantics instead of checkbox-only expectations
- comparison results now use clickable product headers instead of duplicate buttons/headings
- AI grouping and suggested-search cards now assert the compact visual contract
- AI top picks now assert the simplified label-first contract
- SimRel now asserts direct add-to-cart instead of stepper behavior
- listing promotion tests now reflect the deliberate removal of promo badges from list cards

## Residual Follow-Up Risks

These are not blockers for merge, but they are worth tracking:

1. The PR is still broad.
   The change set mixes design-system foundation, UX behavior changes, client defaults, and test reconciliation. It is coherent, but review and rollback remain higher-cost than a smaller PR.

2. Comparison and top-picks flows have intentionally changed user behavior.
   The new behavior is now covered by tests, but downstream teams should be aware that this is not a styling-only update.

3. JSDOM emits `Not implemented: navigation to another Document` during some tests.
   Tests still pass; this is a known environment limitation, not a branch regression.

## Recommended Merge Notes

When merging, call out the branch as:

- a design-system foundation PR
- a desktop shopping UX refresh
- a behavior update for compare / top-picks / add-to-cart / pricing presentation

That framing better matches what actually shipped than describing it as CSS cleanup alone.

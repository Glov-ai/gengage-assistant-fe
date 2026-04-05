# Design System Migration Audit

This audit captures the current state of the frontend design-system refactor after the first core migration passes.

It separates the codebase into three buckets:

1. fully on the new system
2. tokenized but still legacy-shaped
3. still needs migration

The goal is to keep the open-source customization story simple:

- clients should mainly edit tokens
- clients may optionally target stable `data-gengage-part` hooks
- clients should not need to patch deep widget CSS

## Current Snapshot

Repository-level indicators from the current frontend state:

- `62` hits for `gds-*` or `data-gengage-part`
- `323` hits for legacy `_gengage-*` or `--gengage-*`
- `298` direct color-literal hits across widget and design-system CSS

Interpretation:

- the new system is active and used
- the migration is real, but incomplete
- there is still a large middle layer where old selectors are tokenized but not yet primitive-driven

## Bucket 1: Fully On The New System

These areas now render with shared primitives and/or stable public hooks, and are meaningfully controlled by the new semantic/client/AI tokens.

- chat shell and drawer roots in `src/chat/components/ChatDrawer.ts`
- chat header shell and icon controls in `src/chat/components/ChatDrawer.ts`
- assistant and user message bubbles via `gds-message` in `src/chat/components/ChatDrawer.ts`
- qna panel/buttons/input shell in `src/qna/index.ts`, `src/qna/components/ButtonRow.ts`, `src/qna/components/TextInput.ts`
- simrel cards and tabs in `src/simrel/components/ProductCard.ts` and `src/simrel/components/GroupTabs.ts`
- ai top-pick cards and badges in `src/chat/components/AITopPicks.ts`
- handoff and evidence cards in `src/chat/components/HandoffNotice.ts` and `src/chat/components/GroundingReviewCard.ts`
- grouped suggestion cards in `src/chat/components/AISuggestedSearchCards.ts` and `src/chat/components/AIGroupingCards.ts`
- categories container shell/product cards in `src/chat/components/CategoriesContainer.ts`

## Bucket 2: Tokenized But Still Legacy-Shaped

These areas already consume new semantic/client/AI tokens, but the actual DOM contract and/or visual rules still live mostly in widget-local CSS.

- `src/chat/components/chat.css`
  - input area and composer shell
  - product sort trigger/menu
  - comparison toggle/select states
  - review tabs and review pills
  - shortcut chips above the input
  - former messages button
  - stop-generating button
  - various product detail and compare sub-surfaces
- `src/qna/components/qna.css`
  - mostly aligned, but still depends on local class styling rather than thin wrappers around primitives
- `src/simrel/components/simrel.css`
  - mixed state: some true primitive usage, some `_gengage-*` alias-driven styling

This is the main migration zone. It is where most of the visual inconsistency still comes from.

## Bucket 3: Still Needs Migration

These areas still rely heavily on legacy selectors, direct literals, or older design assumptions.

- old launcher/overlay/fallback states in `src/chat/components/chat.css`
- several mobile-only overrides in `src/chat/components/chat.css`
- older status/empty/loading variants that still use one-off values
- long-tail product detail sections with local-only styling
- legacy aliases and old token names still kept alive for compatibility

These should be migrated last, after the shared primitive contract is stable.

## Global Design Alignment Status

The current design-system architecture is directionally aligned with the target guide in:

- `src/design-system/tokens/semantic.css`
- `src/design-system/tokens/client.css`
- `src/design-system/tokens/ai.css`
- `src/design-system/primitives/*`

However, the attached global design is not yet fully reflected in runtime defaults.

Remaining gaps:

- too many widget surfaces still carry legacy visual assumptions
- some defaults are still slightly more brand-heavy than the target system
- old `--gengage-*` aliases still influence many components
- not all primitive classes are used directly in live DOM

## Recommended Migration Order

1. lock semantic defaults to the global design guide
2. move remaining high-frequency chat controls onto primitives
3. reduce legacy alias usage inside widget CSS
4. migrate the long tail of mobile and fallback states
5. simplify demos into token-first theme examples

## Success Criteria

The migration is considered complete when:

1. all high-frequency controls render through canonical primitives
2. widget CSS mainly handles layout/context, not component identity
3. client theming is mostly token-based
4. `data-gengage-part` becomes the preferred override surface
5. legacy `_gengage-*` usage becomes compatibility-only, not the main styling path

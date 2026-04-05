# Design System Refactor Blueprint

## Purpose

This repository is published for clients to customize and theme. The current rendering and widget architecture is solid, but the visual layer has grown organically and now mixes:

- shared infra
- local widget-specific CSS
- duplicated component patterns
- overlapping token names

The goal of this refactor is to create a **stable, elegant, client-facing design system** that:

- keeps the current widget behavior and backend-driven UI architecture
- makes styling predictable for open-source adopters
- allows most client branding via tokens instead of invasive CSS rewrites
- aligns the SDK with the design direction documented in:
  - `/Users/omerakkentli/oaworkspace/Gengage-space/robot-engine-lean/interface/DESIGN_SYSTEM_GLOBAL.md`
  - `/Users/omerakkentli/oaworkspace/Gengage-space/robot-engine-lean/interface/public/design-system-showcase.html`

## Target Design Direction

The target visual language is **Calm Material Intelligence**:

- structured, neutral, quietly premium surfaces
- brand color used as an accent, not as a page-filling strategy
- system and AI progress states clearly separated from tenant branding
- strong hierarchy through spacing, border, and restrained elevation
- one canonical appearance per component role

This SDK should inherit the older project's **discipline**, not its framework or implementation details.

## Current State Summary

### What already works

- Shared widget lifecycle and theming entry point in `src/common/widget-base.ts`
- Shared renderer/registry model in `src/common/renderer/`
- Shared token entry points in `src/common/ui-theme.ts` and `src/common/theme-utils.ts`
- A few real shared primitives, most notably `src/common/quantity-stepper.ts`

### What is broken from a design-system perspective

- No true shared component family for buttons, cards, chips, panels, tabs, and inputs
- Large widget-local CSS ownership:
  - `src/chat/components/chat.css`
  - `src/qna/components/qna.css`
  - `src/simrel/components/simrel.css`
  - `src/simbut/simbut.css`
- Duplicated CTA treatments across chat, QNA, product cards, AI cards, and compare controls
- Multiple card styles representing the same commerce role
- Existing tokens mix geometry, semantic usage, and client branding concerns
- Public styling API is implicit rather than documented and intentional

## Refactor Outcome

At the end of this refactor, the SDK should expose:

1. A clear token system
2. Shared visual primitives
3. Stable public selectors for key widget parts
4. Compatibility aliases for current token names
5. Demos that are examples of theming, not ad hoc local redesigns

## Public vs Internal Contract

This refactor must explicitly separate:

- the **public customization API** that clients are encouraged to use
- the **internal design-system implementation** that the SDK team is free to evolve

### Public customization API

Clients should customize the SDK primarily through:

1. theme tokens passed via `theme`
2. stable `data-gengage-part` selectors for scoped component overrides
3. existing high-level widget root selectors such as:
   - `[data-gengage-widget="gengagechat"]`
   - `[data-gengage-widget="gengageqna"]`
   - `[data-gengage-widget="gengagesimrel"]`

### Internal implementation API

The following are internal implementation details and should not be documented as the preferred client entrypoint:

- `.gds-*` primitive classes
- internal widget-local classes that exist only for layout or historical compatibility
- structural DOM details that may change as primitives are adopted

Rule: clients should not need to know the internal primitive class graph to brand the SDK well.

## Hybrid Adoption Strategy

The migration should proceed in a hybrid way:

1. Keep existing widget classes working
2. Add semantic token consumption under those classes
3. Add shared `.gds-*` primitive classes to component DOM gradually
4. Add stable `data-gengage-part` hooks at the same time
5. Document `data-gengage-part` and tokens as the public styling surface

This gives us:

- no breakage for current clients
- internal convergence on shared primitives
- a clean, intentional customization story for new adopters

## Public Styling Contract

### Primary public layer: tokens

Clients should be able to achieve most branding through:

- `--client-*`
- `--surface-*`
- `--text-*`
- `--border-*`
- `--shadow-*`
- `--radius-*`
- status and AI tokens where needed

### Secondary public layer: stable part selectors

For cases where tokens are not enough, clients should use stable part hooks such as:

- `data-gengage-part="product-summary-card"`
- `data-gengage-part="comparison-view-button"`
- `data-gengage-part="qna-quick-question"`
- `data-gengage-part="simrel-product-card"`

These selectors should be:

- human-readable
- role-based rather than layout-based
- stable across internal refactors
- documented as the supported override surface

### Non-goal

Clients should not need to:

- edit `src/chat/components/chat.css`
- understand `.gds-*` internals
- chase down dozens of widget-local selectors just to restyle cards, tabs, or buttons

## Architecture

## New Folder Structure

```text
src/design-system/
  index.css
  tokens/
    raw.css
    semantic.css
    client.css
    ai.css
    aliases.css
  primitives/
    panel.css
    button.css
    chip.css
    badge.css
    input.css
    tabs.css
    toolbar.css
    card.css
    loading.css
```

This layer will be imported by widget CSS entrypoints and serve as the shared styling foundation.

## Token Model

### 1. Raw Tokens

Raw tokens define scales only:

- neutral colors
- spacing scale
- radius scale
- shadow scale
- typography scale

These should not be used directly by product components unless absolutely necessary.

### 2. Semantic Tokens

Semantic tokens define usage and should be the main authoring surface.

Required semantic groups:

- surfaces
  - `--surface-page`
  - `--surface-shell`
  - `--surface-card`
  - `--surface-card-soft`
  - `--surface-elevated`
  - `--surface-input`
  - `--surface-overlay`
- text
  - `--text-primary`
  - `--text-secondary`
  - `--text-muted`
  - `--text-inverse`
- border
  - `--border-subtle`
  - `--border-default`
  - `--border-strong`
- elevation
  - `--shadow-1`
  - `--shadow-2`
  - `--shadow-3`
- radius
  - `--radius-control`
  - `--radius-card`
  - `--radius-panel`
  - `--radius-pill`

### 3. Client Brand Tokens

Clients should be able to theme the SDK through a small, explicit set of brand tokens:

- `--client-primary`
- `--client-primary-hover`
- `--client-primary-active`
- `--client-primary-subtle`
- `--client-primary-soft`
- `--client-on-primary`
- `--client-focus-ring`

### 4. AI/System Tokens

AI and system-progress states must not be visually conflated with tenant primary color.

Required:

- `--ai-accent-start`
- `--ai-accent-end`
- `--ai-accent-soft`

System colors should also include:

- `--success`
- `--warning`
- `--error`
- `--info`

## Compatibility Strategy

Current public styling must keep working while the new system lands.

### Backwards compatibility rules

1. Existing `--gengage-*` tokens remain supported
2. New semantic/client tokens are layered underneath
3. Existing class names remain functional during migration
4. Old tokens map into the new system through alias variables

### Required aliases

Examples:

- `--client-primary` should default to `--gengage-primary-color`
- `--client-on-primary` should default to `--gengage-primary-foreground`
- `--surface-card` should default to `--gengage-background-color`
- `--border-default` should default to `--gengage-border-color`
- `--text-primary` should default to `--gengage-foreground-color`

This allows current clients to keep working while new clients adopt the cleaner token API.

## Primitive Families

The older showcase gives us the correct primitive families to formalize.

### Panel Primitives

Canonical roles:

- shell panel
- card panel
- section panel
- elevated overlay panel
- AI/system panel

Shared qualities:

- subtle border
- restrained shadow
- canonical radii
- consistent internal spacing

### Button Primitives

Canonical roles:

- primary
- secondary
- ghost
- danger
- icon

Usage mapping:

- commerce CTA: primary or secondary
- utility controls: ghost or icon
- destructive actions: danger

### Chip / Pill Primitives

Canonical roles:

- neutral chip
- active chip
- brand chip
- filter chip
- suggestion chip

### Badge Primitives

Canonical roles:

- brand
- success
- warning
- error
- outline

### Input Primitives

Canonical roles:

- input shell
- composer shell
- inline search shell
- text area shell

### Tabs / Toolbar Primitives

Canonical roles:

- segmented control
- tab row
- compact toolbar
- comparison/sort control bar

### Card Primitives

Canonical roles:

- product card
- compact product card
- AI recommendation card
- evidence/review card
- comparison highlight card

### Loading / Progress Primitives

Canonical roles:

- skeleton block
- AI progress card
- staged analysis checklist
- muted inline loader

These should borrow from the older project's loader/AI cards instead of continuing ad hoc loading styles.

## Public Styling API

The public styling contract should include two layers:

### 1. Public tokens

Clients should primarily customize through tokens.

This should handle:

- brand color
- font family
- corner style
- base spacing feel
- shell width and panel geometry

### 2. Public structural selectors

Stable selectors should exist for major composition surfaces:

- launcher
- drawer shell
- drawer header
- conversation pane
- workspace pane
- product card
- AI recommendation card
- comparison table
- review highlights
- QNA panel
- SimRel grid

These selectors should be documented as public and stable enough for scoped client overrides.

Internal implementation-only selectors should stay undocumented.

## Migration Order

### Phase 1: Foundation

1. Add `src/design-system/`
2. Add raw, semantic, client, AI, and alias token files
3. Import the new design-system layer into widget CSS entrypoints
4. Keep behavior unchanged

### Phase 2: Core primitives

1. Normalize panel shells
2. Normalize buttons
3. Normalize chips
4. Normalize badges
5. Normalize input shells
6. Normalize tabs/toolbars

### Phase 3: Commerce primitives

1. Define a canonical product-card base
2. Align chat product cards and simrel product cards to one family
3. Normalize top-pick recommendation cards
4. Normalize review evidence cards
5. Normalize comparison emphasis cards

### Phase 4: AI/system states

1. Unify loader and progress styles
2. Introduce reserved AI accent treatment
3. Standardize “thinking”, “reviewing”, and “narrowing” surfaces

### Phase 5: Demo migration

1. Update `demos/` so they mostly use tokens
2. Minimize demo-local CSS
3. Treat demos as client theming references

### Phase 6: Documentation and catalog

1. Document token API
2. Document stable selectors
3. Add catalog sections for primitives and composed widget states

## File-by-File Migration Order

### Foundation

- `src/common/ui-theme.ts`
- `src/common/theme-utils.ts`
- `src/common/types.ts`
- `src/design-system/**`

### Widget CSS entrypoints

- `src/chat/components/chat.css`
- `src/qna/components/qna.css`
- `src/simrel/components/simrel.css`
- `src/simbut/simbut.css`

### Shared reusable primitive

- `src/common/quantity-stepper.ts`

### Chat surfaces

- `src/chat/components/ChatDrawer.ts`
- `src/chat/components/renderUISpec.ts`
- `src/chat/components/AITopPicks.ts`
- `src/chat/components/ReviewHighlights.ts`
- `src/chat/components/GroundingReviewCard.ts`
- `src/chat/components/ComparisonTable.ts`
- `src/chat/components/ChoicePrompter.ts`

### QNA surfaces

- `src/qna/components/ButtonRow.ts`
- `src/qna/components/renderUISpec.ts`

### SimRel surfaces

- `src/simrel/components/ProductCard.ts`
- `src/simrel/components/GroupTabs.ts`
- `src/simrel/components/renderUISpec.ts`

## What Should Become Canonical

These patterns should have exactly one canonical look per role:

- primary CTA
- secondary CTA
- ghost/icon utility button
- filter chip
- active chip
- input shell
- product card
- compact card
- panel shell
- AI progress card
- review evidence card

If two existing patterns solve the same problem, one must be deprecated.

## Risks

### 1. Regressions for current clients

Mitigation:

- use alias tokens
- do not remove current class names
- do not remove current `--gengage-*` contract in the first pass

### 2. Chat CSS remains too large

Mitigation:

- move visual primitives into design-system CSS
- keep widget CSS focused on layout and widget-specific states

### 3. Demos become misleading

Mitigation:

- update demos only after primitives and tokens are real
- document demos as examples, not source-of-truth styles

## Success Criteria

The refactor is successful when:

1. Most client branding can be done via tokens
2. Product cards look and behave like one system across widgets
3. Buttons, chips, and panels no longer drift visually
4. AI/system states have their own elegant, non-brand-dependent visual language
5. Demos require little local CSS
6. The SDK feels visually coherent even before client theming

## First Implementation Slice

The first safe slice should do the following:

1. Introduce the token and alias layer
2. Add shared CSS primitives for panels, buttons, chips, badges, inputs, and loading
3. Import the design-system layer into chat, QNA, SimRel, and SimBut
4. Re-skin the most duplicated controls first:
   - QNA buttons
   - chat action buttons
   - product CTAs
   - AI top-pick CTA
   - comparison toggle
   - input shell
   - panel shell

This provides immediate reuse without a dangerous full rewrite.

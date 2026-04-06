# Design System

The shared design system lives in `src/design-system/` and provides tokens, primitives, and a backward-compatible alias layer that all four widgets consume.

## Architecture

```text
src/design-system/
  index.css              # barrel import
  tokens/
    raw.css              # neutral colors, spacing, radius, shadow scales
    semantic.css         # surfaces, text, borders — wraps legacy --gengage-* tokens
    client.css           # brand primary family (color-mix derivatives)
    ai.css               # AI accent gradient tokens
    aliases.css          # component-level aliases (buttons, cards, headers, etc.)
  primitives/
    panel.css  button.css  chip.css  badge.css  input.css
    tabs.css   toolbar.css card.css  loading.css message.css
    header.css menu.css    table.css
```

Each widget imports `@import '../../design-system/index.css'` in its CSS entrypoint.

## Token Model

**Layer 1 — Raw tokens** (`raw.css`): scales only (neutral palette, spacing, radius, shadow). Not for direct use in components.

**Layer 2 — Semantic tokens** (`semantic.css`): usage-driven names (`--surface-card`, `--text-primary`, `--border-default`, etc.). Each wraps the corresponding legacy `--gengage-*` token as a fallback, so existing customer overrides keep working.

**Layer 3 — Client brand** (`client.css`): `--client-primary` and its derived states (`-hover`, `-active`, `-subtle`, `-soft`, `-on-primary`, `-focus-ring`). Defaults to `--gengage-primary-color` if set.

**Layer 4 — AI accent** (`ai.css`): `--ai-accent-start`, `--ai-accent-end`, `--ai-accent-soft`. Intentionally separate from brand color.

**Layer 5 — Aliases** (`aliases.css`): component-level tokens (`--ds-button-primary-bg`, `--ds-header-bg`, etc.) that reference the semantic/client layers. Used by primitives.

## Backward Compatibility

All legacy `--gengage-*` tokens remain supported through CSS `var()` fallback chains:

```
Customer sets: --gengage-primary-color: #e12629
  → client.css:  --client-primary: var(--gengage-primary-color, #b7102a)
  → Component:   background: var(--client-primary)
  → Result:      #e12629
```

Existing class names remain functional. Old tokens map into the new system through semantic.css alias variables.

## Public vs Internal Contract

**Public customization API** (documented, stable):
1. Theme tokens passed via `theme: { '--client-primary': '#...', '--surface-card': '#...' }`
2. Stable `data-gengage-part` selectors for scoped overrides
3. Widget root selectors (`[data-gengage-widget="gengagechat"]`, etc.)

**Internal implementation** (not for client use, may change):
- `.gds-*` primitive classes
- Widget-local layout classes
- Internal DOM structure details

## Primitives

All primitives use `:where()` selectors for zero specificity — any single-class override wins. No `!important` flags, no hardcoded color values. All geometric/color values come from tokens.

Key primitive families: buttons, cards, chips, badges, panels, inputs, tabs, toolbars, loading/progress, messages, tables, headers, menus.

## Migration Status

**Fully on the new system:**
- Chat shell, header, message bubbles
- QNA panel, buttons, input
- SimRel cards and tabs
- SimBut button
- AI top picks, grouping cards, suggested search cards
- Handoff notice, grounding review cards, categories container

**Tokenized but still legacy-shaped** (uses new tokens, but DOM/CSS still widget-local):
- Chat input area, sort trigger, comparison states, review tabs, shortcut chips
- Some QNA and SimRel CSS that depends on local classes rather than thin primitive wrappers

Canonical token defaults live in `src/common/theme-utils.ts` (`BASE_WIDGET_THEME`). All `color-mix()` derivatives (hover, active, subtle, soft, focus-ring) are computed from `--client-primary` at the CSS level.

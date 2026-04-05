# Global Design Compliance

This note compares the shared SDK design-system defaults against:

- [`DESIGN_SYSTEM_GLOBAL.md`](/Users/omerakkentli/oaworkspace/Gengage-space/robot-engine-lean/interface/DESIGN_SYSTEM_GLOBAL.md)
- [`design-system-showcase.html`](/Users/omerakkentli/oaworkspace/Gengage-space/robot-engine-lean/interface/public/design-system-showcase.html)

## Baseline Decision

The written spec in `DESIGN_SYSTEM_GLOBAL.md` is treated as the canonical source for shared tokens.

The showcase HTML is still valuable, but it contains a few literal-value differences from the markdown spec. Those are called out below so we do not accidentally chase two conflicting baselines.

## Updated Core Compliance

The shared SDK defaults now match the written global design spec for these core values:

- client token percentages:
  - `--client-primary-subtle: 12%`
  - `--client-primary-soft: 20%`
  - `--client-focus-ring: 32%`
- semantic color defaults:
  - `--surface-page: #f6f7fb`
  - `--surface-shell: #10131a`
  - `--surface-card: #ffffff`
  - `--surface-card-muted: #f8fafc`
  - `--text-primary: #111827`
  - `--text-secondary: #4b5563`
  - `--text-muted: #6b7280`
  - `--border-default: rgba(17, 24, 39, 0.10)`
- spacing scale now includes the missing `64px` step as `--ds-space-16`
- shadow scale now uses the written `shadow-1` value with the `0.06` second alpha
- shared button primitives now follow the intended canonical direction more closely:
  - primary/secondary/ghost actions use the shared token contract
  - secondary hover uses `client-primary-subtle`
  - ghost hover keeps the surface calm and shifts border/text emphasis instead of adding hover theatrics
  - base button height is now `46px`, which fits the global `44-48px` guidance and the showcase component size

## Reference Mismatches

These differences exist between the attached references themselves:

### Markdown spec vs showcase literals

- `--client-primary-soft`
  - markdown: `20%`
  - showcase: `18%`
- `--client-focus-ring`
  - markdown: `32%`
  - showcase: `28%`
- `--surface-card-soft`
  - markdown semantic direction: `#f8fafc`
  - showcase literal: `#f6f7f9`
- `--text-secondary`
  - markdown: `#4b5563`
  - showcase: `#475467`
- `--text-muted`
  - markdown: `#6b7280`
  - showcase: `#667085`
- `--border-default`
  - markdown: `rgba(17, 24, 39, 0.10)`
  - showcase: `rgba(17, 24, 39, 0.12)`

## Still Not Fully Aligned

These areas are directionally aligned, but not fully standardized yet:

- some widget-level legacy alias variables still exist for backward compatibility
- not every component family is primitive-first yet; some modules are still tokenized but widget-shaped
- a few component-level behaviors from the showcase remain looser in the SDK:
  - input-shell highlight treatment
  - some toolbar/tab sizing details
  - some comparison/review/product-card composition details

## Practical Outcome

Clients should keep customizing the SDK through:

1. shared semantic/client/AI tokens
2. stable `data-gengage-part` hooks
3. only minimal scoped overrides when truly necessary

They should not need to edit deep widget CSS to get brand-compliant styling.

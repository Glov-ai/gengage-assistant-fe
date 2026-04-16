# Code Review

Review target: working tree vs `origin/main`

Note: this repository currently has no `dev` branch on `origin`, so the review baseline is the default upstream branch.

## Findings

1. `src/chat/catalog.ts`, `docs/widget-defs.md`, `docs/customization.md`
   Issue: the frontend contract docs still described `PhotoAnalysisCard` as a summary-plus-clues widget, while the branch now renders strengths, focus points, celeb vibe, expandable details, and new i18n labels.
   Resolution plan:
   - update the catalog description
   - update widget and customization docs to describe the new props and locale keys
   - rebuild docs to ensure the markdown changes stay valid
   Status: resolved in this branch

2. `tests/protocol-adapter.test.ts`
   Issue: protocol adapter coverage only asserted the legacy `summary`, `clues`, and `next_question` fields, leaving the richer beauty card contract unverified.
   Resolution plan:
   - extend the adapter regression test to assert `strengths`, `focus_points`, `celeb_style`, `celeb_style_reason`, and `details`
   - rerun targeted Vitest coverage plus TypeScript checks
   Status: resolved in this branch

## Residual risk

- The photo card still depends on backend-provided structured fields for the full layout. When the backend emits only the legacy minimal payload, the frontend intentionally degrades to a simpler rendering.

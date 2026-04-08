# Code Review: PDP Ecommerce Redesign

## Baseline

- Reviewed branch: `codex/pdp-ecommerce-redesign`
- Requested baseline: `DEV`
- Actual baseline used: `origin/main`

No `dev`, `DEV`, `develop`, or `development` branch exists on this repository's remote at review time, so this review compares against `origin/main`.

## Scope Reviewed

- PDP renderer and responsive styling in the chat UI.
- Product protocol normalization for PDP-ready fields.
- Product detail schema acceptance for variants, merchant HTML descriptions, facet hits, and feature data.
- PDP test coverage for review click actions, HTML description rendering, variant rendering, and fallback variant data.
- Documentation for the product detail panel and product object contract.

## Findings And Resolution Plan

### P2: Merchant HTML descriptions were losing useful structure

**Finding:** The PDP initially converted `description_html` to safe plain text, which prevented merchant-provided paragraphs and lists from rendering cleanly. During final review, headings were also found to be flattened even though Flormar descriptions use heading tags for sections.

**Resolution plan:** Prefer `description_html`, sanitize it with an allowlist, keep safe structural tags, and fall back to plain text only when HTML parsing fails.

**Status:** Resolved. The renderer now keeps safe paragraphs, lists, emphasis, and `h2`/`h3`/`h4` headings while dropping blocked tags such as scripts. Tests assert paragraph rendering, heading preservation, and script removal.

### P2: PDP variants depended on a field that was sometimes empty

**Finding:** Some merchants, including Flormar for the original Color Master example, provide variant-like values through `facet_hits` or `features` even when `variants` is empty. Rendering only `variants` made the page look like variant support was missing.

**Resolution plan:** Render true sibling variants from `variants` when available. If true variants are not present, render a conservative selected-state fallback from variant-like facets/features such as color and size. Do not invent sibling colors client-side.

**Status:** Resolved in the frontend. A companion search-service change extracts true Flormar sibling colors when the merchant exposes them in Akinon `extra_data.variants`.

### P3: PDP renderer grew helper logic in a single file

**Finding:** The PDP renderer gained several normalization helpers for strings, numbers, features, images, variants, and HTML descriptions. This is more code in `renderUISpec.ts`, but the behavior is local to the PDP renderer and avoids creating abstractions before another component needs them.

**Resolution plan:** Keep helpers local for this PR. Extract to a shared product view-model module only if future product panels/cards reuse the same normalization.

**Status:** Accepted. The change remains scoped to the existing renderer surface and associated CSS/tests.

### P3: Full sibling color carousel requires backend variant data

**Finding:** The frontend can display variants it receives, but cannot discover sibling SKUs on its own. For Flormar products like the Puffy Liquid example, the merchant page exposes sibling colors in embedded Akinon data while the previous search-service adapter returned `variants: []`.

**Resolution plan:** Keep frontend rendering generic and pair this PR with the search-service adapter fix that maps Flormar Akinon `extra_data.variants` into the shared `Variant` shape.

**Status:** Resolved with companion backend PR. Residual deployment risk: sibling colors will appear in PDP only after the search-service change is deployed.

## Verification Results

- Passed: `npm run format`
- Passed: `npm run lint`
- Passed: `npm run typecheck`
- Passed: `npm run test:chat` (70 tests)
- Passed: `npm test` (121 files, 1248 tests)
- Passed: `npm run build`
- Passed: `npm run docs:build`
- Passed: `git diff --check`

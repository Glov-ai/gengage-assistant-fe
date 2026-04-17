# Code Review

## Scope

- Compared the Sephora demo work against `origin/main`.
- Review scope intentionally excluded unrelated local edits already present in:
  - `demos/saatvesaatcomtr/index.html`
  - `src/chat/components/ConsultingStylePicker.ts`
  - `src/chat/components/chat.css`

## Findings

### 1. Merchant registration needed full parity across demo surfaces

- Severity: Medium
- Area: `demos/`, `catalog/`, docs
- Risk:
  A new merchant demo is only truly usable when the dedicated demo shell, demo launcher, catalog theme preset, and contributor-facing docs all agree. Partial registration leads to confusing local behavior where `npm run dev <account>` may work but catalog/testing flows still miss the merchant.
- Resolution plan:
  1. Add `demos/sephoracomtr/index.html`.
  2. Register `sephoracomtr` in `demos/index.html`.
  3. Register the theme preset in `catalog/src/merchant-configs.ts`.
  4. Update README and live-testing docs with the new account and SKU.
- Status: Resolved in this branch.

### 2. Placeholder Sephora SKU was not representative of the real PDP

- Severity: High
- Area: `demos/sephoracomtr/index.html`
- Risk:
  The initial demo used placeholder product identifiers, which meant the shell looked correct but did not exercise a real Sephora PDP context. That weakens local debugging and makes backend validation unreliable.
- Resolution plan:
  1. Use the real Sephora TR PDP URL as `pageContext.url`.
  2. Set the default demo SKU/product code to `769798`.
  3. Align the visible demo product copy to the actual BADgal BANG! product page.
- Status: Resolved in this branch.

### 3. Dev-runner documentation was manually enumerated and stale-prone

- Severity: Low
- Area: `scripts/dev.ts`
- Risk:
  The dev runner discovers demos dynamically, but the file header still listed a manual account roster. That comment would drift again as soon as new demos were added.
- Resolution plan:
  1. Replace the manual list with a short note that demos are discovered from `demos/`.
- Status: Resolved in this branch.

## Validation

- `npm run typecheck`
- `npm run typecheck:catalog`
- `npm run test`
- `npm run build`
- `npm run build:demos`
- `npm run docs:build`

All passed.

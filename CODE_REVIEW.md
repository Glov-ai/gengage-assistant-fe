# Code Review

## Scope

- Requested comparison target: `DEV`
- Actual comparison basis used for this review: `origin/main`

`DEV` does not exist locally or on `origin` in this repository, so a literal review against that branch was not possible. This review therefore uses the closest valid shared base branch and calls out that assumption explicitly.

## Review Summary

The demo-shell changes are directionally strong and appropriately scoped: they remove brittle per-demo duplication, make direct `npm run <accountId>` flows predictable, and fix the most visible merchant-demo regressions without pushing demo-specific logic into the SDK runtime.

After the fixes in this branch, I did not find any open critical or high-severity defects in the changed surface. The main remaining risk is operational rather than code-correctness: the richer host shells now depend on middleware availability to replace their static placeholder markup at runtime.

## Findings And Resolution Plans

### 1. Resolved: Merchant PDP demos fell back to lorem placeholder content even when a valid sample SKU was available

- Severity: Medium
- Status: Resolved in this branch

#### Impact

Several merchant demos opened on a branded shell but did not show real product title, pricing, attributes, or hero imagery on first load. That made the demo look broken even though the chat widget itself was wired.

#### Resolution plan

1. Centralize demo-shell hydration in a shared helper instead of duplicating merchant-specific DOM patching.
2. Fetch `productDetails` from the demo middleware using the same account and SKU already used by the widget boot flow.
3. Replace only the placeholder host-shell fields that are presentation-only:
   - breadcrumb
   - title
   - SKU/meta
   - badge
   - prices
   - highlights
   - summary copy
   - hero/gallery images
4. Keep the fallback HTML shell in place so demos still render if hydration cannot complete.
5. Cover the helper with targeted unit tests.

#### Implemented changes

- Added `demos/shared/demo-shell.ts`
- Wired affected merchant demos to call `hydrateDemoPdpShell(...)`
- Added `tests/demo-shell.test.ts`

### 2. Resolved: Several demo launcher/header avatars depended on brittle remote logo URLs and rendered as broken images

- Severity: Medium
- Status: Resolved in this branch

#### Impact

Broken launcher or header logos reduce confidence in the demo immediately and make accounts like `trendyolcom` look partially wired even when the rest of the flow is working.

#### Resolution plan

1. Replace fragile remote-config image dependencies used only for demo chrome.
2. Generate deterministic brand avatars locally for demo-only surfaces.
3. Keep merchant-specific styling via brand colors to preserve quick visual recognition.
4. Avoid touching runtime widget image behavior; limit the fix to demo scaffolding.

#### Implemented changes

- Added `createBrandAvatarDataUrl(...)` in `demos/shared/demo-shell.ts`
- Repointed affected launcher/header avatar config to generated brand avatars

### 3. Resolved: The shared hydrator initially assumed Turkish storefront copy and would leak Turkish strings into English demos

- Severity: Low
- Status: Resolved in this branch

#### Impact

English demos such as `screwfixcom` could show mixed-language shell text, especially around breadcrumb labels, review copy, pricing badges, and gallery accessibility text.

#### Resolution plan

1. Move all demo-shell labels into a tiny locale-aware helper.
2. Support Turkish by default and English where demo accounts require it.
3. Add tests that assert English storefront rendering, not just Turkish.

#### Implemented changes

- Added locale-aware shell strings in `demos/shared/demo-shell.ts`
- Extended tests to cover English copy and gallery alt text

### 4. Open risk: Demo-shell hydration still depends on middleware availability

- Severity: Low
- Status: Open follow-up

#### Impact

If the configured middleware is unavailable, the host page keeps its static placeholder shell. The widgets can still initialize independently when their own runtime succeeds later, but the initial page impression is weaker than a fully offline-ready demo.

#### Resolution plan

1. Decide whether demo fidelity must hold when the middleware is offline.
2. If yes, add lightweight per-account snapshot fixtures for the default SKU only.
3. Attempt live hydration first, then fall back to the checked-in snapshot when the request fails.
4. Keep snapshot scope narrow to avoid catalog drift and maintenance overhead.

## Validation Checklist

- `npm run format`
- `npm run test:demo-shell`
- `npm run build`

## Minimality Review

The branch remains reasonably lean:

- Shared behavior was moved into one helper instead of copied across merchant demos.
- Merchant HTML files only changed where they needed a default SKU, hydrator call, or demo-avatar fallback.
- The new test coverage is focused on the shared helper rather than duplicating merchant-by-merchant tests.

The only deliberate tradeoff is that demo host shells now make a small extra product-details request for first-paint fidelity. Given that this logic is isolated to `demos/` and not the shipped SDK runtime, that tradeoff is acceptable.

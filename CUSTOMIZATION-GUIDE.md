# Coding-Agent Guide (Fork, Customize, Deploy)

This guide is for any coding agent (Codex, Claude, Cursor, Windsurf, etc.) working in a fork of this repository.
Use it as the default operating procedure when customizing widgets for a customer account.

## Objective

Build account-specific frontend customizations while keeping shared logic centralized in the SDK layer (`src/common` and widget core under `src/*`), so future account onboarding is mostly config/theme work.

## Hard Constraints

1. Keep backend contract compatibility with the Gengage backend.
2. Do not change stream/request protocol unless explicitly requested by Gengage.
3. Do not copy proprietary code from other repositories; keep clean-room behavior parity only.
4. Keep cross-account/shared logic in `src/common` (or relevant core widget modules), not duplicated in `demos/<accountId>/`.
5. Respect legal/trademark notices in [LICENSE](LICENSE), [LEGAL.md](LEGAL.md), and [TRADEMARKS.md](TRADEMARKS.md).

## First-Time Setup

```bash
npm install
npm run kill
```

Use this local workflow for PDP mode:

```bash
npm run dev -- <accountId> --sku=<sku>
```

Example:

```bash
npm run dev -- koctascomtr --sku=1000197232
```

## Where To Change What

1. `src/common/*`: cross-account primitives, shared factories, eventing, transport, analytics, overlay orchestration.
2. `src/chat/*`, `src/qna/*`, `src/simrel/*`: widget behavior and shared UI implementation.
3. `demos/<accountId>/index.html`: account-level demo with inline config.
4. `catalog/`: visual component catalog — browse all components with mock data at `:3002` (`npm run catalog`).
5. `scripts/dev.ts`: dev server entry point (serves demos directly).
6. `tests/*`: regression and parity checks.

Rule: if at least two accounts need the same behavior, move it to `src/common` or widget core.

## Account Customization Workflow

1. Copy the closest existing demo folder under `demos/` (e.g. `demos/koctascomtr/`).
2. Edit `demos/<accountId>/index.html` — set account ID, middleware URL, theme tokens, and mount selectors inline.
3. Configure widget options (chat, qna, simrel) directly in the HTML script block.
4. Add host-side callbacks (cart/navigation/script actions) inline in the demo page.
5. Validate with `npm run dev -- <accountId> --sku=<sku>` and confirm all widgets mount.

## Centralization Rulebook For Agents

When implementing features:

1. Add reusable abstractions in `src/common` first.
2. Export new shared helpers from `src/common/index.ts` and `src/index.ts`.
3. Refactor existing account folders to consume the shared helper.
4. Keep per-account files limited to brand tokens, mount selectors, i18n text, widget-level overrides, and host callback wiring.

Avoid adding new duplicated constants (middleware URL, analytics defaults, PDP pageContext scaffolding, session wiring) inside each account.

## Host-Shell / Parity Workflow

Use the account-aware dev shell for all accounts (not only Koctas):

```bash
npm run dev -- <accountId> --sku=<sku>
```

The shell is expected to provide:

1. realistic PDP spacing/layout context,
2. account-specific mount target IDs/selectors for QNA + SimRel,
3. floating chat launcher behavior.

If parity work is blocked by simplistic scaffolding, improve the account's `demos/<accountId>/index.html` or the shared dev server in `scripts/dev.ts`.

## Playwright Parity Gate

Use Playwright as a merge gate for high-risk UI changes:

1. Capture local snapshots from `http://localhost:<port>/`.
2. Capture reference snapshots from production customization URLs.
3. Compare key states: initial render, QNA button area, chat open animation, simrel card rail/grid, and mobile viewport behavior.

For visual regression across all components and themes, use the component catalog:

```bash
npm run catalog   # Serve catalog at :3002 (builds first)
npx playwright test --project=catalog   # Screenshot every component + theme grid
```

Recommended minimum commands:

```bash
npm run test:e2e
```

For manual local parity checks:

```bash
npm run dev -- <accountId> --sku=<sku> --port=3000
```

Then run Playwright against that URL.

## GTM / Overlay Deployment Notes

Default deployment target is host-page script/GTM integration with overlay widgets.

Agent checklist:

1. Ensure initialization is idempotent (`buildOverlayIdempotencyKey`, `initOverlayWidgets`).
2. Ensure shared session IDs persist across navigation where required.
3. Ensure host action handlers are wired for script calls, add-to-cart, and navigation.
4. Keep mount selectors configurable in account config, not hardcoded in core widget internals.
5. Validate mobile overlays on narrow viewports before release.

## Pre-PR Validation Checklist

Run before opening a PR:

```bash
npm run kill
npm run format
npm run build
npm run test
npm run test:e2e
```

If any step is intentionally skipped (for example, no browser in CI), document it explicitly in the PR description.

## Pull Request Expectations For Agents

Every PR should include:

1. summary of shared changes vs account-specific changes,
2. list of affected accounts,
3. screenshots or snapshots (desktop + mobile),
4. validation commands run and outcomes,
5. follow-up items that are intentionally deferred.

## Done Criteria

Customization work is considered done when:

1. account boots via `npm run dev -- <accountId> --sku=<sku>`,
2. widgets render in realistic host-shell context,
3. cross-account/shared logic is centralized in `src/common`/core,
4. account files contain only true overrides,
5. legal/trademark constraints remain intact,
6. validation gates pass (or documented exceptions exist).

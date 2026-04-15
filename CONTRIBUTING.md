# Contributing

This guide is for engineers changing the core SDK. Start with `AGENTS.md` for the repo overview and `docs/index.md` for the full document map.

If you are customizing a merchant fork rather than changing shared SDK behavior, use `docs/customization.md` instead.

## Architecture Summary

- The SDK currently ships four widget surfaces: chat, QNA, SimRel, and SimBut.
- Chat, QNA, and SimRel are UISpec/json-render widgets.
- SimBut is a lightweight direct-DOM PDP image overlay and is the current exception.
- Shared logic belongs in `src/common/` or the relevant widget core, not inside `demos/<accountId>/`.
- Backend compatibility is a hard requirement. Preserve `/chat/*` contract behavior unless the work is explicitly a breaking migration.

## Where To Change What

| Path | Change Here When... |
|------|----------------------|
| `src/common/` | You are adding shared transport, overlay, analytics, config, or renderer infrastructure |
| `src/chat/` | You are changing chat behavior, streaming UX, panel rendering, or chat-only feature modules |
| `src/qna/` | You are changing contextual launcher behavior or QNA UISpec rendering |
| `src/simrel/` | You are changing similar-product rendering or behavior |
| `src/simbut/` | You are changing the PDP image-overlay pill |
| `catalog/` | You are exposing a widget or component in the visual catalog |
| `demos/` | You are changing merchant-specific wiring, theme tokens, mount selectors, or host callbacks |
| `docs/` | You are updating contributor-facing contracts, guides, or references |

Rule: if two or more accounts need the same behavior, move it out of `demos/` and into shared SDK code.

## Required Contribution Patterns

1. Centralize reusable logic in `src/common/` or widget core modules.
2. Keep merchant behavior file-driven. Avoid account-specific branching in core code.
3. Register new widgets and major components in the catalog with realistic mock data.
4. Update docs and tests alongside code changes.
5. Keep new assistant modes inside `src/chat/features/<mode-name>/`.
6. Document any new XSS sink in `docs/customization.md`.

## Local Workflow

```bash
npm install
npm run dev -- <accountId> --sku=<sku>
npm run typecheck
npm run typecheck:catalog
npm run test
npm run build
npm run docs:build
```

Useful flows:

- `npm run catalog` for visual verification across widgets and themes
- `npm run test:e2e` for browser smoke coverage
- `npm run dev -- <accountId> --sku=<sku> --backend-url=http://localhost:7860` for local backend work

## Pull Request Checklist

Before opening a PR:

```bash
npm run kill
npm run format
npm run build
npm run test
npm run docs:build
```

Add `npm run test:e2e` when the change is UI- or interaction-heavy.

Every PR should include:

1. Shared SDK changes versus merchant-specific changes.
2. Affected widgets and accounts.
3. Screenshots or catalog snapshots for visible UI changes.
4. Validation commands run and outcomes.
5. Any intentional follow-up work or known gaps.
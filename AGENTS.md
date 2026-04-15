# AGENTS.md

This is the primary orientation guide for coding agents and maintainers working in this repository. Historical guide content from `.claude/CLAUDE.md`, `CONTRIBUTION-GUIDE.md`, and `CUSTOMIZATION-GUIDE.md` now lives here or in the docs linked below.

## What This Repo Is

- Source-available frontend SDK for Gengage AI Assistant.
- Customers fork and own the frontend; Gengage hosts the proprietary backend SaaS.
- Package name: `@gengage/assistant-fe`.
- Main surfaces: `chat`, `qna`, `simrel`, `simbut`, and the `native` WebView bridge.
- Primary goal: merchants can customize visuals, copy, and host wiring without forking backend logic or breaking protocol compatibility.

## Non-Negotiable Architecture Requirements

1. Backend owns assistant and business rules. Frontend may render, orchestrate, and recover, but should not invent recommendation logic, merchant policy, or protocol semantics that belong on the backend.
2. Preserve the `/chat/*` wire contract and required stream terminal behavior unless you are making an explicit breaking migration.
3. Prefer UISpec/json-render for any backend-driven widget or component. New widgets should be individually renderable from schemas plus registries and previewable in `npm run catalog`.
4. Register every widget and major component in the catalog app with realistic mock data and a route. If a widget is a direct-DOM exception, add a live preview frame and document why it is not UISpec-driven.
5. Keep account behavior file-driven in `demos/<accountId>/` and runtime config. Do not add merchant-specific branching to core widget code.
6. Never add framework dependencies to `src/common/`.
7. Keep mode-specific chat logic in `src/chat/features/<mode-name>/`. Central chat files get thin delegation hooks only.
8. Shared types live in `src/common/types.ts`; widget-specific types live in `src/<widget>/types.ts`.
9. Any new HTML injection point must carry an explicit XSS warning and must be documented in `docs/customization.md`.
10. Update docs, catalog coverage, and tests alongside code changes. A widget or component is not complete if it cannot be previewed and explained.

## Current Architecture, As Implemented

- `chat`, `qna`, and `simrel` are UISpec/json-render widgets built on the shared DOM renderer foundation in `src/common/renderer/`.
- `simbut` is a lightweight direct-DOM PDP image overlay pill. Treat it as a current exception, not a precedent for richer widgets.
- `native` is a bridge/bootstrap layer over overlay widgets rather than a standalone widget implementation.
- Chat uses Shadow DOM for CSS isolation. QNA, SimRel, and SimBut render in the host DOM.
- Overlay bootstrapping lives in `src/common/overlay.ts`.
- Runtime config parsing and account self-service wiring live in `src/common/config-schema.ts` and `src/common/client.ts`.

## Known Architecture Debt

- Merchant-specific bridge names such as `glovOtokoc` and `maximize-pdp` / `minify-pdp` are known debt. Prefer generic host-action or panel-state contracts when touching those areas.

## Documentation Index

### Start Here

- `README.md` for public package positioning and quick integration paths.
- `docs/index.md` for the full documentation map.
- `CONTRIBUTING.md` for SDK contribution workflow.
- `docs/customization.md` for fork and account-customization workflow.

### Contracts And Architecture

- `docs/architecture.md`
- `docs/wire-protocol.md`
- `docs/widget-defs.md`
- `docs/config-files.md`
- `docs/analytics-contract.md`
- `docs/security-production.md`

### Extension Guides

- `docs/adding-new-mode.md`
- `docs/adding-new-widget.md`
- `docs/component-override-cookbook.md`
- `docs/new-account-guide.md`

### Runtime Topics

- `docs/api-reference.md`
- `docs/i18n.md`
- `docs/error-handling.md`
- `docs/gtm-integration.md`
- `docs/gtm-quickstart.md`
- `docs/native-mobile-sdk.md`
- `docs/live-testing.md`
- `docs/design-system.md`
- `docs/backend-requirements.md`

## Code Path Index

| Path | Purpose |
|------|---------|
| `src/index.ts` | Top-level public barrel |
| `src/common/` | Shared types, transport, overlay orchestration, analytics, renderer foundation |
| `src/chat/` | Chat widget, stream handling, panel manager, feature modules |
| `src/qna/` | Contextual launcher / Q&A widget |
| `src/simrel/` | Similar products widget |
| `src/simbut/` | PDP image overlay pill |
| `src/native/` | Native WebView export surface |
| `catalog/src/` | Catalog routes, sections, frames, mock data |
| `demos/` | Merchant and framework integration examples |
| `tests/` | Vitest plus Playwright coverage |
| `docs/` | Contributor-facing docs and contracts |

## When Changing Specific Areas

- Backend event mapping: `src/common/protocol-adapter.ts`, `docs/wire-protocol.md`, `docs/widget-defs.md`
- Overlay and runtime config: `src/common/overlay.ts`, `src/common/config-schema.ts`, `src/common/client.ts`, `docs/config-files.md`
- Rendering contracts: `src/<widget>/catalog.ts`, `src/<widget>/components/renderUISpec.ts`, `catalog/src/mock-data/`, `catalog/src/sections/`
- Chat assistant modes: `src/chat/features/`, `docs/adding-new-mode.md`
- Merchant onboarding: `demos/<accountId>/`, `docs/new-account-guide.md`
- Styling and customization: `docs/customization.md`, `docs/design-system.md`
- Error and recovery behavior: `src/common/global-error-toast.ts`, `src/common/connection-warning.ts`, `docs/error-handling.md`

## Public Entry Points

| Import | Use |
|--------|-----|
| `@gengage/assistant-fe` | Full public barrel |
| `@gengage/assistant-fe/chat` | Chat widget bundle |
| `@gengage/assistant-fe/qna` | QNA widget bundle |
| `@gengage/assistant-fe/simrel` | SimRel widget bundle |
| `@gengage/assistant-fe/simbut` | SimBut widget bundle |
| `@gengage/assistant-fe/native` | Native WebView bridge and bootstrap |
| `@gengage/assistant-fe/common` | Advanced shared helpers and types |

## Conventions

- TypeScript strict mode plus `exactOptionalPropertyTypes`.
- Named exports only.
- No `any`; use `unknown` and narrow.
- ESM imports use `.js` extensions.
- `camelCase.ts` for modules, `PascalCase.ts` for component modules.
- Comments only where logic is non-obvious.
- Use `src/common/api-paths.ts` for endpoints.
- Use `gengage:<widget>:<action>` event names.
- Re-export public additions through `src/index.ts` and `package.json` exports when appropriate.

## Build And Verification

```bash
npm install
npm run typecheck
npm run typecheck:catalog
npm run test
npm run build
npm run catalog
npm run docs:build
npm run dev -- <accountId> --sku=<sku>
```

## Definition Of Done For Docs-Sensitive Changes

- Code, catalog coverage, and docs agree.
- New widgets and components are previewable in `npm run catalog`.
- Source-backed docs are updated for public APIs, customization surface, and extension steps.
- Relevant validation commands have been run or explicitly called out as skipped.
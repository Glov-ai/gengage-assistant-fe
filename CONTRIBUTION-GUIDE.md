# Contribution Guide (SDK & Core Development)

This guide is for developers contributing to the core SDK (`src/common/`, `src/chat/`, `src/qna/`, `src/simrel/`).
For fork/customize/deploy guidance, see [CUSTOMIZATION-GUIDE.md](CUSTOMIZATION-GUIDE.md).

## Architecture

Three independent vanilla-TypeScript widgets (chat, qna, simrel) consume streaming NDJSON
from the backend and render UI using json-render catalogs. See
[docs/architecture.md](docs/architecture.md) for data flows and design decisions.

## Key Directories

| Path | Role |
|------|------|
| `src/common/` | Shared types, utilities, base class — framework-agnostic |
| `src/chat/` | Chat widget: floating launcher + drawer |
| `src/qna/` | QNA widget: contextual action buttons |
| `src/simrel/` | Similar products widget: grid + tabs |
| `demos/` | Per-account demo pages with inline config |
| `catalog/` | Visual component catalog — renders all components with mock data |
| `tests/` | Vitest unit tests + Playwright E2E |
| `docs/` | Architecture, wire protocol, config, and analytics contract docs |

## Extension Patterns

### Adding shared logic

1. Add the module to `src/common/`.
2. Export from `src/common/index.ts`.
3. Re-export from `src/index.ts` if it's part of the public API.
4. Add unit tests in `tests/`.

### Adding a widget feature

1. Add types to `src/<widget>/types.ts`.
2. Implement in `src/<widget>/components/`.
3. If the feature needs shared infrastructure, put it in `src/common/` first.

### Adding a new account

1. Copy `demos/koctascomtr/` as a starting template.
2. Follow [CUSTOMIZATION-GUIDE.md](CUSTOMIZATION-GUIDE.md) for the full workflow.

## Centralization Rules

1. Reusable abstractions go in `src/common/` first.
2. Export new shared helpers from `src/common/index.ts` and `src/index.ts`.
3. Keep per-account files limited to brand tokens, mount selectors, i18n text,
   widget-level overrides, and host callback wiring.
4. If two or more accounts need the same behavior, move it to `src/common/` or widget core.

## Wire Protocol

The backend contract is documented in [docs/wire-protocol.md](docs/wire-protocol.md).

Key rule: never break the wire protocol. Preserve `/chat/*` endpoint support.

## Stream Event Normalization

The wire protocol adapter (`src/common/protocol-adapter.ts`) normalizes backend
event types to the canonical `StreamEvent` model.

See the event matrix in [docs/wire-protocol.md](docs/wire-protocol.md) for the full mapping.

## Testing

- **Unit tests:** Vitest (`npm run test`).
- **E2E tests:** Playwright (`npm run test:e2e`). Smoke-level currently.
- **Visual catalog:** `npm run catalog` — renders every component with mock data at `:3002` (builds first). Useful for verifying UI changes across all component types and merchant themes.
- **Type checking:** `npm run typecheck` and `npm run typecheck:catalog` (strict mode, `exactOptionalPropertyTypes: true`).

All tests must pass before opening a PR.

## Pre-PR Validation Checklist

Run before opening a PR:

```bash
npm run kill
npm run format
npm run build
npm run test
npm run test:e2e
```

If any step is intentionally skipped (for example, no browser in CI), document it in the PR description.

## Pull Request Expectations

Every PR should include:

1. Summary of shared changes vs account-specific changes.
2. List of affected accounts.
3. Screenshots or snapshots (desktop + mobile) for UI changes.
4. Validation commands run and outcomes.
5. Follow-up items that are intentionally deferred.

## Code Conventions

- TypeScript strict mode. `exactOptionalPropertyTypes: true`.
- Zod for all runtime schema validation.
- Named exports only (no default exports).
- No `any` — use `unknown` and narrow at runtime.
- File names: `camelCase.ts` for modules, `PascalCase.tsx` for React components.
- Imports: always use `.js` extensions (ESM resolution). `import type` when possible.
- Event names: `gengage:<widget>:<action>`.
- Endpoint paths: use `src/common/api-paths.ts` helpers; do not hardcode.

## Reference Docs

- [docs/architecture.md](docs/architecture.md) — system design and data flows
- [docs/wire-protocol.md](docs/wire-protocol.md) — NDJSON contract
- [docs/config-files.md](docs/config-files.md) — file-based account configuration
- [docs/analytics-contract.md](docs/analytics-contract.md) — analytics event taxonomy

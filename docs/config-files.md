# Config Files Contract

This document defines how account-level behavior is configured so clients can self-serve by editing files in this repo, without backend changes.

## Goals

1. No account-specific branching in core widget logic.
2. No runtime dependence on legacy global config contracts.
3. New accounts should be onboarded by adding files, not patching core source.
4. Configs are validated with schemas and fail fast.

## Required Account Structure

Each account demo under `demos/` is a single HTML file with inline configuration:

```text
demos/<accountId>/
  index.html          # Branded PDP with inline widget config
```

The HTML file contains all account-specific settings inline:
- Account ID and middleware URL
- Theme tokens (CSS custom properties)
- Widget options (chat, qna, simrel)
- Mount selectors and host-side callbacks
- Analytics overrides

Starter template: copy `demos/koctascomtr/index.html` and adjust the inline config.

## Canonical Config Model

Implement a shared schema in `src/common/config-schema.ts` (Zod).

```ts
export interface AccountConfig {
  version: '1';
  accountId: string;
  middlewareUrl: string;
  locale?: string;
  widgets: {
    chat: { enabled: boolean };
    qna: { enabled: boolean };
    simrel: { enabled: boolean };
  };
  theme?: Record<string, string>;
}
```

Additional optional fields:

| Field | Type | Description |
|-------|------|-------------|
| `enableHeartbeat` | `boolean` | Enable session keepalive polling via `/v2/heartbeat`. Default: `false`. |
| `pricing` | `PriceFormatConfig` | Locale-aware price formatting (currency symbol, position, separators). See `src/common/price-formatter.ts`. |
| `enableVoiceInput` | `boolean` | Enable speech-to-text input on the chat widget. Default: `false`. |
| `kvkk` | `{ message, linkUrl, linkText }` | Turkish data protection (KVKK) consent banner config. When set, a consent notice is displayed before the first user message. |

Include transport fields:
- optional analytics ingestion endpoint/auth settings.
- response compatibility mode toggles if needed (v1 wire protocol adapter and JSON similars/groupings handling).

Notes:
- Keep the schema versioned (`version`) to support future migrations.
- Reject unknown/malformed critical fields at startup.
- Default non-critical fields in code, not in ad-hoc per-account branches.

## Merchant Customization

The SDK does **not** include merchant-specific configurations. Each integration defines
its own theme, locale, pricing, and i18n directly in the `initOverlayWidgets()` call:

```ts
const controller = await initOverlayWidgets({
  accountId: 'your-account-id',
  middlewareUrl: 'https://your-backend.example.com',
  locale: 'tr',
  sku,
  theme: {
    primaryColor: '#ec6e00',
    primaryForeground: '#ffffff',
    // ... other WidgetTheme tokens
  },
  onAddToCart: (product) => { /* site-specific */ },
});
```

See `demos/` for complete account-branded integration examples.

## Account Init Orchestrator

The `initOverlayWidgets()` orchestrator provides concurrency-safe two-phase
initialization (Phase 1: Chat, Phase 2: QNA + SimRel).

Key config fields:

| Field | Interface | Description |
|-------|-----------|-------------|
| `idempotencyKey` | `AccountConfigs` | GTM idempotency window key (default: `__gengageWidgetsInit`). Use a unique key per account when multiple accounts share a page. |
| `idempotencyKey` | `AccountInitOptions` | Per-call override for the idempotency key. Takes precedence over `AccountConfigs.idempotencyKey`. |

Concurrency guarantees:
- **Phase 1** (Chat): concurrent calls coalesce on the same promise; failure clears the promise for retry.
- **Phase 2** (QNA + SimRel): if a newer SKU arrives while init is in-flight, the newer SKU re-initializes after the current one completes. If Phase 2 fails, `pdpSku` is reset to allow retry with the same SKU.

## Runtime Loading Rules

1. `demos/<accountId>/index.html` composes configs and initializes widgets inline.
2. Core widgets receive only explicit typed config values.
3. Page-dependent values (sku, page type, add-to-cart hooks) are injected via config callbacks or explicit update calls.
4. Core widgets must not import account folders directly.

## A/B and Experiment Policy

This repo should not carry hidden server-side experiment control logic.

If an account wants experimentation:
- keep experiment toggles in account config files,
- make routing explicit and auditable,
- avoid mutating protocol payload shapes.

## Migration Guidance

When migrating from legacy integrations:

1. Move static account constants (account ID, middleware URL) inline into `demos/<accountId>/index.html`.
2. Move visual tokens inline as `theme: { ... }` in the `initOverlayWidgets()` call.
3. Move per-widget behavior inline as `chat: { ... }`, `qna: { ... }`, `simrel: { ... }` options.
4. Move analytics overrides inline in the same config object.
5. Keep protocol fields (`session_id`, `correlation_id`, action payload shape) unchanged.

## Validation and Tests

Required checks:

1. Unit tests for config schema validation.
2. A test that loads each account config and asserts no throw.
3. A test that verifies every enabled widget receives required fields.

Recommended command:

```bash
npm run test
```

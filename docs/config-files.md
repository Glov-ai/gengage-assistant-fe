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
- Widget options (chat, qna, simrel, simbut)
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
    simbut: { enabled: boolean };
  };
  theme?: Record<string, string>;
}
```

`widgets.simbut` defaults to `false` in the runtime schema because it requires a merchant-provided PDP image-wrapper mount (`mounts.simbut`). Unlike QNA and SimRel, SimBut mounts directly into an existing host-page element and will not inject its own container.

Additional optional fields:

| Field | Type | Description |
|-------|------|-------------|
| `pricing` | `PriceFormatConfig` | Locale-aware price formatting (currency symbol, position, separators). See `src/common/price-formatter.ts`. |
| `voiceEnabled` | `boolean` | Enable speech-to-text input on the chat widget. Default: `false`. |
| `kvkk` | `{ message, linkUrl, linkText }` | Turkish data protection (KVKK) consent banner config. When set, a consent notice is displayed before the first user message. |

### Mount Selectors (`mounts`)

Override default mount targets for QNA, SimRel, and optional SimBut widgets:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `mounts.chat` | `string` | (auto-injected) | CSS selector for chat mount point |
| `mounts.qna` | `string` | (auto-injected) | CSS selector for QNA button row |
| `mounts.simrel` | `string` | (auto-injected) | CSS selector for similar products grid |
| `mounts.simbut` | `string` | **(merchant-provided, required)** | CSS selector for the relatively positioned PDP image wrapper. Must point to an existing element in the host page — unlike `qna`/`simrel`, SimBut does not inject its own mount node. `preflightDiagnostics` will report an error if SimBut is enabled but this is not set. |

### Analytics (`analytics`)

Controls the fire-and-forget analytics client:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `analytics.enabled` | `boolean` | `true` | Enable/disable analytics entirely |
| `analytics.endpoint` | `string` | `"/analytics"` | Analytics ingestion URL (relative to `middlewareUrl`) |
| `analytics.auth.mode` | `enum` | `"none"` | Auth mode: `none`, `x-api-key-header`, `bearer-header`, `body-api-key` |
| `analytics.auth.key` | `string` | — | API key or bearer token (when `mode` is not `none`) |
| `analytics.auth.headerName` | `string` | — | Custom header name (for `x-api-key-header` mode) |
| `analytics.auth.bodyField` | `string` | `"api_key"` | JSON body field name (for `body-api-key` mode) |
| `analytics.fireAndForget` | `boolean` | `true` | Don't await analytics responses |
| `analytics.useBeacon` | `boolean` | `true` | Use `navigator.sendBeacon` on page unload |
| `analytics.keepaliveFetch` | `boolean` | `true` | Use `fetch({ keepalive: true })` for reliable delivery |
| `analytics.timeoutMs` | `number` | `4000` | Request timeout in milliseconds |
| `analytics.maxRetries` | `number` | `1` | Max retry attempts (0–5) |

### GTM (`gtm`)

Controls GTM-based initialization behavior:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `gtm.idempotencyKey` | `string` | `"__gengageWidgetsInit"` | Window property key to prevent double-mount |
| `gtm.requireDomReady` | `boolean` | `true` | Wait for `DOMContentLoaded` before init |

### Action Handling (`actionHandling`)

Controls how the widget handles unknown or dangerous action types:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `actionHandling.unknownActionPolicy` | `enum` | `"log-and-ignore"` | Policy for unrecognized action types: `log-and-ignore`, `throw`, `delegate` |
| `actionHandling.allowScriptCall` | `boolean` | `false` | Allow `scriptCall` actions (executes host-page functions — security risk) |

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
initialization (Phase 1: Chat, Phase 2: PDP widgets such as QNA, SimRel, and optional SimBut).

Key config fields:

| Field | Interface | Description |
|-------|-----------|-------------|
| `idempotencyKey` | `AccountConfigs` | GTM idempotency window key (default: `__gengageWidgetsInit`). Use a unique key per account when multiple accounts share a page. |
| `idempotencyKey` | `AccountInitOptions` | Per-call override for the idempotency key. Takes precedence over `AccountConfigs.idempotencyKey`. |

Concurrency guarantees:
- **Phase 1** (Chat): concurrent calls coalesce on the same promise; failure clears the promise for retry.
- **Phase 2** (QNA + SimRel + optional SimBut): if a newer SKU arrives while init is in-flight, the newer SKU re-initializes after the current one completes. If Phase 2 fails, `pdpSku` is reset to allow retry with the same SKU.

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
3. Move per-widget behavior inline as `chat: { ... }`, `qna: { ... }`, `simrel: { ... }`, and optional `simbut: { ... }` options.
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

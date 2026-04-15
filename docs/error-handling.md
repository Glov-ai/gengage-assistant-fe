# Error Handling And Recovery

This document describes the failure and recovery behavior implemented in the frontend today.

## Recovery Layers

| Layer | Source Files | Behavior |
|-------|--------------|----------|
| Global error toast | `src/common/global-error-toast.ts` | Shows lightweight top-right warnings for shared non-chat failures |
| Connection warning watchdog | `src/common/connection-warning.ts` | Shows a sticky connectivity warning when QNA or SimRel requests stay active while the network looks unstable |
| Chat inline recovery | `src/chat/index.ts`, `src/chat/components/ChatDrawer.ts` | Inline offline bar, recovery pills, and stream-error strips inside the drawer |
| QNA degraded fallback | `src/qna/index.ts` | Falls back to a standalone text input when launcher fetch fails |
| SimRel inline retry | `src/simrel/index.ts` | Renders an inline error state with a retry button |

## Global Error Toast

All widgets inherit `BaseWidget`, which registers the global toast listener automatically.

Dispatch shape:

```ts
dispatch('gengage:global:error', {
  source: 'qna',
  code: 'FETCH_ERROR',
  message: 'Something went wrong. Please try again.',
});
```

The toast system:

- normalizes connectivity-related copy through `getGlobalErrorMessage(...)`
- picks Turkish copy when `locale` starts with `tr`
- inherits theme variables from the first mounted widget root
- supports sticky or auto-dismissed warnings

## Connectivity Warnings

`trackConnectionWarningRequest(...)` is currently used by QNA and SimRel requests.

Behavior:

1. when a tracked request starts, a watchdog timer begins
2. after 8 seconds, the SDK probes connectivity
3. if the network still looks bad, a sticky warning is shown
4. the SDK rechecks every 5 seconds while requests remain active
5. the warning clears once connectivity returns or the request finishes

Chat intentionally does not use this watchdog because it already shows its own inline offline bar and suppresses duplicate global offline messaging.

You can override the probe asset with `configureConnectionWarning({ probeUrl })`.

## Chat Behavior

Chat handles failures inline because they happen mid-stream and usually need conversational recovery.

Current behaviors include:

- offline suppression: if the browser is offline and the failure is clearly connectivity-related, chat avoids duplicate error bubbles and relies on the offline bar
- inline recovery actions: retry the last action or focus the input for a new question
- degraded product fallback: PDP auto-launch flows fall back to `productNotFoundMessage` instead of a raw generic error when product context is unavailable
- repeated stream failures: after consecutive failures, chat escalates to the stronger `accountInactiveMessage` recovery strip

## QNA Behavior

QNA dispatches a global `FETCH_ERROR` toast when launcher actions fail, but it tries to remain usable.

Fallback behavior:

- the fetched button row is skipped
- a standalone text input is still rendered
- configured placeholder or CTA copy is preserved where possible

This keeps the page from losing the QNA entry point during backend hiccups.

## SimRel Behavior

SimRel dispatches a global `FETCH_ERROR` toast and also renders an inline error state containing:

- localized `errorLoadingMessage`
- localized `retryButtonText`
- a retry button that reruns the current SKU fetch

This means users can retry directly in context instead of waiting for a full page refresh.

## Documenting New Failure Paths

When you add a new error surface:

1. decide whether it belongs in inline widget UI, the global toast layer, or both
2. add localized copy rather than hard-coded strings
3. make sure recovery is actionable where possible
4. update this file if the new behavior changes the runtime contract

## Related Docs

- [analytics-contract.md](./analytics-contract.md)
- [customization.md](./customization.md)
- [live-testing.md](./live-testing.md)
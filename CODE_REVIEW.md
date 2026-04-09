# CODE REVIEW (Feature Branch vs `origin/main`)

## Scope

- Repository: `gengage-assistant-fe`
- Reviewed against: `origin/main` (repo has no remote `dev` branch)
- Branch: `codex/expert-mode-packaging`
- Review date: 2026-04-09
- Focus: expert-mode redirect quality, beauty photo upload UX/transport, state persistence, and transcript stability.

## Findings (Ordered by Severity)

| ID | Severity | Area | Finding | Status |
|---|---|---|---|---|
| FE-01 | Critical | `src/chat/expert-mode/definitions/beauty.ts` | Beauty panel state key mismatched backend contract (`beauty_consulting_state` vs `redirected_agent_state`), causing state loss risk. | Fixed |
| FE-02 | Critical | `src/chat/index.ts`, `src/chat/api.ts` | Beauty image upload was sent in a shape that backend rejected (`inputText + attachment` path mismatch in practical flow). | Fixed |
| FE-03 | High | `src/chat/index.ts` | Transcript jumped upward on new responses in reused expert thread due forced `requestThreadFocus` (top anchoring older bubble). | Fixed |
| FE-04 | High | `tests/*` | Missing deterministic coverage for beauty upload normalization/progress and attachment send behavior. | Fixed |
| FE-05 | Medium | `src/chat/api.ts`, `src/chat/index.ts` | Beauty diagnostic logs are always-on (`console.warn/error`) and may leak noisy payload metadata in production consoles. | Open |
| FE-06 | Medium | docs | Migration docs drifted from actual backend naming and current beauty transfer behavior. | Fixed |

## Resolution Plan Per Finding

### FE-01 (Fixed): Beauty state key mismatch
1. Align beauty expert definition with backend context key `redirected_agent_state`.
2. Keep sync/build logic mode-aware to avoid cross-mode state contamination.
3. Lock with controller tests.

### FE-02 (Fixed): Beauty upload transport mismatch
1. Route beauty attachment send through `inputText` payload with multipart attachment.
2. Normalize beauty attachment file client-side (jpeg fallback + resize threshold).
3. Add explicit request-level logging to verify raw/mapped action type and attachment metadata during debugging.

### FE-03 (Fixed): Upward scroll jump
1. Detect whether current request reuses an existing thread.
2. For existing thread, request bottom scroll (`requestScrollToBottom`) instead of thread-top focus scroll.
3. Keep thread-focus behavior for first message of a new thread only.

### FE-04 (Fixed): Missing tests
1. Add tests for beauty attachment normalization behavior.
2. Add tests for beauty attachment send path + payload shape.
3. Add tests for beauty photo progress-step mapping.

### FE-05 (Open): Always-on beauty debug logs
Plan:
1. Gate beauty debug logs behind existing debug flag plumbing (e.g., `chat_debug` / localStorage switch).
2. Keep production default quiet, but preserve structured logs for troubleshooting.
3. Add one unit test validating logger no-op when debug is off.

### FE-06 (Fixed): Documentation drift
1. Update migration analysis to match backend file names and active beauty state contract.
2. Document current beauty upload + expert handoff behavior and integration expectations.

## Validation Completed

- `npm run lint` ✅
- `npm run test` ✅ (123 files, 1260 tests passed)
- `npm run build` ✅

## Additional Follow-Up (Non-blocking)

- Add one high-level integration test for complete redirect flow:
  - shopping user turn -> `redirect` -> expert init -> expert follow-up turn with persisted state and attachment.

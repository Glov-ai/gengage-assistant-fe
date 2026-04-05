# Code Review

Branch reviewed against `origin/main` on `visual-updates`.

## Outcome

No blocking defects remain after the pre-PR cleanup pass.

Validated locally after the refactor:

- `npm test` ✅
- `npm run typecheck` ✅
- `npm run build` ✅
- `git diff --check origin/main` ✅

The branch is mergeable, but there are still a few non-blocking risks worth calling out so they are not lost after merge.

## Findings

### Medium: Global toast theming is still source-order sensitive on pages with multiple differently themed widgets

Files:

- `src/common/global-error-toast.ts`

Why this matters:

- The global error toast is now token-driven and theme-aware, which is a big improvement.
- But it currently syncs theme variables from the first matching widget root found in the document:
  `.gengage-chat-root, .gengage-qna-container, .gengage-simrel-container, .gengage-simbut-root`.
- If a page ever mounts multiple Gengage widgets with different theme overrides, the toast can inherit the wrong theme based on DOM order rather than event source.

Current mitigation:

- The toast no longer hardcodes its visual palette.
- It now copies semantic/token vars from a mounted widget root before rendering.

Resolution plan:

1. Extend the global error event payload to include a stable source widget element or a resolved theme snapshot.
2. In `showGlobalErrorToast()`, prefer the source widget theme over a document-wide query.
3. Add a focused test that mounts two differently themed widgets and verifies the toast adopts the correct source theme.
4. Keep the current DOM-query fallback only as a last resort for backwards compatibility.

### Medium: PR scope is still broad for one merge

Files / areas:

- `src/design-system/**`
- `src/chat/**`
- `src/qna/**`
- `src/simrel/**`
- `src/simbut/**`
- `docs/**`
- `demos/arcelikcomtr/index.html`

Why this matters:

- This is not just a visual polish PR.
- It combines:
  - design-token architecture
  - primitive component rollout
  - chat shell migration
  - loader/progress redesign
  - qna/simrel token alignment
  - simbut styling alignment
  - docs/customization updates
  - demo theme updates
  - test rewrites for the new primitive model
- The branch is validated, but the review and rollback surface is still larger than ideal.

Resolution plan:

1. In the PR description, clearly group changes by subsystem instead of listing files.
2. Land this PR only with a very explicit “design-system foundation + widget migration” narrative.
3. Keep follow-up work out of this PR:
  - additional demo redesigns
  - further token renames
  - extra component rewrites
4. After merge, split remaining work into smaller follow-up PRs:
  - demo/theme simplification
  - additional primitive adoption
  - toast-source theming fix

### Low: Global error toast still keeps base-theme literal fallbacks in JS

Files:

- `src/common/global-error-toast.ts`

Why this matters:

- The toast now references tokens first, which is the right direction.
- But because it renders outside the widget shadow roots, it still carries JS-level fallback values from `BASE_WIDGET_THEME`.
- This is acceptable for resiliency, but it means the toast is not yet fully driven by the shared CSS bundle alone.

Resolution plan:

1. Introduce a tiny shared helper that can publish resolved theme vars to `document.documentElement` when widgets initialize.
2. Let the toast read only token vars from document/root scope.
3. Reduce the JS fallback literals to a minimal emergency fallback set.

## Fixed During Review Prep

These were caught and resolved before opening the PR:

- Chat, panel, qna, simrel, and simbut were moved further toward token/primitive-driven styling.
- The assistant message bubble was migrated to a real shared primitive path and the leftover red first-message rail was removed.
- The new progress loader now supports both:
  - backend `loadingText`
  - backend `thinking_messages`
- The old “still working” hint was removed.
- The global error toast was converted from hard-coded colors to semantic/token-driven styling.
- QnA search icon styling was moved out of an embedded hard-coded SVG color path.
- Remaining inline visual `cursor: pointer` assignments were replaced with shared primitive classes.
- Brittle tests that depended on exact pre-refactor class strings were updated to validate behavior/public hooks instead.

## Recommended Merge Follow-Up

After merge, the most valuable next slice is:

1. Finish narrowing the public customization API documentation around tokens + `data-gengage-part`.
2. Convert more composed chat modules to shared primitives where they still rely on legacy widget-local structure.
3. Simplify demo themes so they become clean examples of token overrides, not override-heavy mini forks.

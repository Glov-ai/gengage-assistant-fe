# Code Review: Branch vs `main`

Date: 2026-04-10
Reviewer: Codex
Scope: Working tree changes against `origin/main` for Teknosacom QNA transfer and styling polish.

## Files Reviewed
- `src/qna/components/TextInput.ts`
- `src/qna/components/qna.css`
- `demos/teknosacom/index.html`
- `docs/customization.md`

## Summary
The implementation is focused and mostly minimal for the requested behavior transfer (advanced input behavior, Teknosacom visual adaptation, and demo alignment). Two functional-quality issues were identified and fixed during this review. No remaining critical regressions were found in the reviewed scope.

## Findings (Ordered by Severity)

### 1) [P1] Hidden QNA icon buttons were still keyboard-focusable
- **Location:** `src/qna/components/qna.css` (`.gengage-qna-icon-btn--hidden`)
- **Impact:** Clear/send buttons were visually hidden with `opacity` but remained in tab order, causing confusing keyboard navigation and accessibility breakage.
- **Resolution Plan:**
  1. Change hidden state to remove the element from layout/interaction.
  2. Verify icon buttons are not focusable while hidden.
  3. Re-run QNA tests.
- **Status:** ✅ Resolved
- **Implemented Fix:** `.gengage-qna-icon-btn--hidden { display: none; }`

### 2) [P2] Teknosacom demo observer could duplicate in HMR/dev reruns
- **Location:** `demos/teknosacom/index.html` (QNA `MutationObserver` setup)
- **Impact:** Re-executed module code in dev/HMR could attach additional observers, causing repeated normalization work and potential jitter/perf issues.
- **Resolution Plan:**
  1. Track prior observer on `window`.
  2. Disconnect prior observer before creating a new one.
  3. Keep normalization idempotent.
- **Status:** ✅ Resolved
- **Implemented Fix:** Added `window.__teknosaQnaObserver` guard/disconnect before `observe()`.

### 3) [P3] Local snapshot artifacts risk accidental PR bloat
- **Location:** untracked local files in repo root
  - `Samsung Galaxy Tab S9 FE ... - Teknosa.html`
  - `Samsung Galaxy Tab S9 FE ... - Teknosa_files/`
- **Impact:** If accidentally staged, PR size/noise increases significantly and can include irrelevant assets.
- **Resolution Plan:**
  1. Keep these files untracked and out of commit.
  2. Validate staged file list before commit.
- **Status:** ✅ Resolved operationally (confirmed excluded from staging/commit scope)

## Minimality / Duplication Check
- Changes are constrained to QNA input behavior, QNA styling tokens, and Teknosacom demo overrides.
- Styling changes in `qna.css` are tokenized to avoid hard-coded client coupling.
- Teknosacom-specific structure fixes are isolated to the Teknosacom demo and do not alter shared runtime behavior globally.

## Validation Performed
- `npm run format` ✅
- Targeted QNA tests:
  - `npm test -- --run tests/qna-renderer.test.ts tests/qna-normalize-ui-specs.test.ts tests/global-error-dispatch.test.ts` ✅
- Clean build:
  - `npm run build` ✅

## Documentation Updates
- Updated `docs/customization.md` with newly supported QNA style tokens:
  - `--gengage-qna-pill-bg`
  - `--gengage-qna-pill-bg-hover`
  - `--gengage-qna-pill-fg`
  - `--gengage-qna-pill-border`
  - `--gengage-qna-pill-border-hover`
  - `--gengage-qna-input-bg`
  - `--gengage-qna-input-border`
  - `--gengage-qna-icon-color`
  - `--gengage-qna-clear-color`
  - `--gengage-qna-send-color`
  - `--gengage-qna-send-color-disabled`
  - `--gengage-qna-action-icon-bg-hover`
  - `--gengage-qna-action-icon-size`

## Final Recommendation
Proceed with PR after staging only the scoped source/doc changes listed above.

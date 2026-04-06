# PR #25 Fix Plan — visual-updates branch

16 verified findings from deep code review. Each section explains the bug, its impact,
the exact file/line, and the precise fix.

---

## Fix 1 — Timer leak in `ChatDrawer.destroy()` [BUG]

**File:** `src/chat/components/ChatDrawer.ts`
**Lines:** 2474-2485

**Bug:** Three `LoadingSequenceBinding` fields (`_typingLoadingBinding`, `_panelLoadingBinding`,
`_panelAiZoneLoadingBinding`) each hold a live `setInterval` created at line 2098. During normal
streaming they are cleaned up by various flow methods (L1187, L1450, L1523, L1611, L1833). But
if `destroy()` is called while a stream is active (user closes drawer mid-stream), none of those
flow methods run. `destroy()` itself has no cleanup for these bindings. The intervals fire
indefinitely against detached DOM nodes.

**Fix:** Add these lines inside `destroy()`, before the `_cleanups` loop (before line 2481):

```typescript
this._destroyLoadingBinding(this._typingLoadingBinding);
this._typingLoadingBinding = null;
this._destroyLoadingBinding(this._panelLoadingBinding);
this._panelLoadingBinding = null;
this._destroyLoadingBinding(this._panelAiZoneLoadingBinding);
this._panelAiZoneLoadingBinding = null;
```

---

## Fix 2 — Document listener leak from attach menu [BUG]

**File:** `src/chat/components/ChatDrawer.ts`
**Lines:** 1403-1410, 2474-2485

**Bug:** `_openAttachMenu()` registers two document-level listeners:
- `keydown` (L1406): added synchronously
- `click` (L1404): wrapped in `window.setTimeout(..., 0)` to avoid the opening click from
  immediately closing the menu

Both are stored in `_attachMenuCleanup` (L1407-1410). `_closeAttachMenu()` (L1383) removes them
correctly. But `destroy()` never calls `_closeAttachMenu()` or `_attachMenuCleanup`.

There is also a timer race: if `destroy()` runs before the `setTimeout` fires, calling
`_attachMenuCleanup` removes the `keydown` listener but the deferred `click` listener has not
been added yet. The `setTimeout` then fires after destroy, adding the click listener to document
permanently with no removal path.

**Fix:** Two-part:

1. Cancel the pending setTimeout by tracking its ID. Add a field:

```typescript
private _attachMenuClickTimerId: ReturnType<typeof setTimeout> | null = null;
```

2. In `_openAttachMenu()`, store the timer ID:

```typescript
this._attachMenuClickTimerId = window.setTimeout(() => {
  this._attachMenuClickTimerId = null;
  document.addEventListener('click', onDocCapture, true);
}, 0);
```

3. Update `_closeAttachMenu()` to also cancel the pending timer:

```typescript
private _closeAttachMenu(): void {
  if (!this._attachMenuEl) return;
  this._attachMenuEl.setAttribute('hidden', '');
  this._attachBtn?.setAttribute('aria-expanded', 'false');
  if (this._attachMenuClickTimerId !== null) {
    clearTimeout(this._attachMenuClickTimerId);
    this._attachMenuClickTimerId = null;
  }
  if (this._attachMenuCleanup) {
    this._attachMenuCleanup();
    this._attachMenuCleanup = null;
  }
}
```

4. In `destroy()`, call `_closeAttachMenu()`:

```typescript
this._closeAttachMenu();
```

---

## Fix 3 — Dead method `_destroyPdpWidgets()` [DEAD CODE]

**File:** `src/common/overlay.ts`
**Line:** 506-513

**Bug:** Method `_destroyPdpWidgets()` is defined but never called anywhere in the codebase.
`destroy()` at L260-276 performs identical cleanup inline (destroys qna, simrel, simbut, nulls them).

**Fix:** Delete lines 506-513 (the entire `_destroyPdpWidgets` method).

---

## Fix 4 — Connection warning not integrated with chat [INCONSISTENCY]

**File:** `src/common/connection-warning.ts`

**Bug:** `trackConnectionWarningRequest` is called in `src/qna/index.ts:160` and
`src/simrel/index.ts:209` but NOT in `src/chat/index.ts`. Chat is the longest-running
request (streaming NDJSON).

Chat's actual offline handling is different from QNA/SimRel:
- `ChatDrawer.ts:569-587`: a persistent offline bar that shows/hides via `window online/offline`
  events — purely reactive to `navigator.onLine`, no proactive detection
- `chat/index.ts:2159-2162`: suppresses the global error toast when a request fails and
  `navigator.onLine === false && isLikelyConnectivityIssue(err)` — avoids double-notification

Neither of these is equivalent to `trackConnectionWarningRequest`, which proactively detects
"slow/unreachable connection even when navigator says online" via the 8-second delay + fetch probe.

**Fix:** Add a comment at the top of `connection-warning.ts` that accurately describes what chat
does and does not cover, so future contributors understand the intentional gap:

```typescript
// Chat widget is intentionally not tracked here. It has its own offline bar
// (ChatDrawer.ts) driven by window online/offline events, and suppresses
// duplicate global toasts for offline errors (chat/index.ts). Adding
// trackConnectionWarningRequest to chat would double-report connectivity issues
// to users who are already seeing the inline offline bar.
```

---

## Fix 5 — Hardcoded `768` in `_setupHorizontalSwipe` [INCONSISTENCY]

**File:** `src/chat/components/ChatDrawer.ts`
**Lines:** 1961, 1969

**Bug:** `_setupHorizontalSwipe` checks `window.innerWidth > 768` directly. Most other callsites
in ChatDrawer (L394, L527, L534, L785) use the pattern
`this._options.getMobileViewport?.() ?? window.innerWidth <= 768`. L1803 uses
`getMobileViewport?.() ?? false` as its fallback. All callsites delegate to `getMobileViewport`
first; `_setupHorizontalSwipe` is the only one that bypasses it entirely. Accounts with a custom
`mobileBreakpoint` get inconsistent horizontal-swipe behavior.

**Fix:** Replace both occurrences in `_setupHorizontalSwipe`:

Line 1961 — change:
```typescript
if (window.innerWidth > 768) return;
```
to:
```typescript
if (!(this._options.getMobileViewport?.() ?? window.innerWidth <= 768)) return;
```

Line 1969 — same replacement.

---

## Fix 6 — Stale doc token names in `new-account-guide.md` [STALE DOCS]

**File:** `docs/new-account-guide.md`

**Bug (a):** Lines 113-121 show a template with dead token names (`--color-client-primary`,
`--root-background`, `--client-message-bubble`, `--client-card`, `--client-background`,
`--client-foreground`, `--client-border`, `--client-text`, `--client-primary-color`).
None of these resolve to anything in the design system. `var()` grep: zero matches in `src/`.

**Bug (b):** Line 196 references `--client-primary-color` as an example — also dead.

**Bug (c):** Line 416 describes n11com as "Green" but the demo uses `#ff44ef` (magenta/pink).

**Fix (a):** Replace lines 112-121 with the canonical token family:

```javascript
      // Client design tokens
      '--client-primary': 'hsl(221, 83%, 53%)',
      '--client-primary-hover': 'hsl(221, 83%, 45%)',
      '--client-primary-active': 'hsl(221, 83%, 40%)',
      '--client-primary-subtle': 'hsla(221, 83%, 53%, 0.08)',
      '--client-primary-soft': 'hsla(221, 83%, 53%, 0.14)',
      '--client-on-primary': '#ffffff',
      '--client-focus-ring': 'hsla(221, 83%, 53%, 0.4)',
```

**Fix (b):** Line 196 — change `--client-primary-color` to `--client-primary`.

**Fix (c):** Line 416 — change `Green` to `Pink/Magenta \`#ff44ef\``.

---

## Fix 7 — Turkish diacriticals missing in connection-warning [I18N]

**File:** `src/common/connection-warning.ts`
**Line:** 24

**Bug:** The Turkish message uses ASCII-only characters:
`'Internet baglantisinda sorun var gibi gorunuyor. Istek surerken yeniden deneyecegiz.'`

Compare with `global-error-toast.ts:58` which uses proper UTF-8:
`'Bağlantı sorunu oluştu. Lütfen tekrar deneyin.'`

**Fix:** Replace line 24 with proper Turkish:
```typescript
return 'İnternet bağlantısında sorun var gibi görünüyor. İstek sürerken yeniden deneyeceğiz.';
```

---

## Fix 8 — Hardcoded Google favicon connectivity probe [FRAGILITY]

**File:** `src/common/connection-warning.ts`
**Line:** 5

**Bug:** `CONNECTIVITY_PROBE_URL = 'https://www.google.com/favicon.ico'` silently fails in
environments where Google is blocked (e.g. China, certain corporate networks). The localhost
bypass at L58-62 protects dev environments but not production deployments in restricted networks.

Two approaches that won't work:
- A module-level "latest probeUrl" from `ConnectionWarningRequestOptions` is race-prone: concurrent
  requests from different sources could overwrite each other's probe URL mid-flight.
- Replacing the fetch entirely with `navigator.onLine` only is a behavior regression: the current
  code specifically handles the case where the browser reports "online" but actual internet is
  unreachable — `navigator.onLine` alone cannot detect that.

**Fix:** Replace the hardcoded Google constant with a configurable module-level default. The
probe URL should be set once at SDK initialization time, not per-request. Add a new exported
function `configureConnectionWarning` that lets the SDK host set the probe URL before any
requests start:

```typescript
// New module-level default (remove CONNECTIVITY_PROBE_URL constant)
let probeUrl = 'https://www.google.com/favicon.ico';

export function configureConnectionWarning(options: { probeUrl?: string }): void {
  if (options.probeUrl) probeUrl = options.probeUrl;
}
```

Update `checkConnectivity()` (L51) to use the mutable `probeUrl` variable instead of the
constant. No per-request races because `configureConnectionWarning` is called once at init time.

In `src/common/index.ts`, export `configureConnectionWarning`.

In `src/index.ts`, export `configureConnectionWarning` from the public API.

In `docs/customization.md`, add a note that customers in Google-restricted regions should call
`configureConnectionWarning({ probeUrl: '<their-own-always-reachable-url>' })` once at init.

**Tradeoff (intentional):** The default probe URL remains Google. This is correct because there
is no universal fallback URL that works in all merchant environments — the right probe URL is
always deployment-specific. The fix improves the situation for restricted-network merchants who
actively configure it; it does not regress anything for merchants who do not. The documentation
must make this explicit so integrators in restricted regions know to act.

---

## Fix 9 — Orphaned `@keyframes gengage-choice-prompter-in` [DEAD CSS]

**File:** `src/chat/components/chat.css`
**Lines:** 6033-6042

**Bug:** This keyframe is defined but never referenced by any `animation:` property. The choice
prompter uses CSS `transition:` for its reveal (L6022-6024) via the `.gengage-chat-panel--scrolled`
parent selector.

**Fix:** Delete lines 6033-6042 (the entire `@keyframes gengage-choice-prompter-in` block).

---

## Fix 10 — 3 orphaned selectors in `prefers-reduced-motion` block [DEAD CSS]

**File:** `src/chat/components/chat.css`
**Lines:** 4011-4013

**Bug:** Three class selectors in the reduced-motion media query target elements that don't exist:

- `.gengage-chat-panel-shimmer` (L4011) — no TS generates this class, no standalone CSS rule.
- `.gengage-chat-overlay` (L4012) — TS uses `.gengage-chat--overlay` (double dash BEM modifier at
  `chat/index.ts:302`). The single-dash form is a different selector that matches nothing.
- `.gengage-chat-product-details-skeleton-price` (L4013) — TS uses `gengage-skeleton-price`
  (in `common/skeleton.ts:24`), which is a different class name.

**Fix:** Remove these three lines from the comma-separated selector list. The surrounding selectors
(L4010 and L4014) remain. Ensure no trailing comma is left after removing L4011.

Before:
```css
  .gengage-chat-ai-toppick-spinner::after,
  .gengage-chat-panel-shimmer,
  .gengage-chat-overlay,
  .gengage-chat-product-details-skeleton-price,
  .gengage-skeleton-card,
```

After:
```css
  .gengage-chat-ai-toppick-spinner::after,
  .gengage-skeleton-card,
```

---

## Fix 11 — Orphaned `.gengage-chat-comparison-view-btn` focus selector [DEAD CSS]

**File:** `src/chat/components/chat.css`
**Line:** 6472

**Bug:** `.gengage-chat-comparison-view-btn:focus-visible` appears in the focus-visible selector
list. No TS component generates an element with this class. Leftover from a removed "View
Comparison" button.

**Fix:** Remove line 6472 from the comma-separated focus-visible selector list. Ensure no
trailing comma.

Before:
```css
.gengage-chat-ai-toppick-cta:focus-visible,
.gengage-chat-comparison-view-btn:focus-visible,
.gengage-chat-comparison-toggle-btn:focus-visible,
```

After:
```css
.gengage-chat-ai-toppick-cta:focus-visible,
.gengage-chat-comparison-toggle-btn:focus-visible,
```

---

## Fix 12 — Hardcoded `color: white` x3 [CSS]

**File:** `src/chat/components/chat.css`
**Lines:** 505, 5722, 6682

**Note:** `var(--ds-neutral-0)` = `#ffffff`, so replacing `white` with it is semantically
equivalent and does not fix any contrast issue. The real concern is whether these elements
remain legible if a merchant sets a light `--error` or `--success` color. However:
- These three elements (fav count badge, discount percentage badge, cart success toast)
  are expected to always render on vivid/saturated status backgrounds
- The design system does not currently provide an `--on-error` or `--on-success` paired token

**Fix:** Replace `color: white` with `color: var(--text-inverse)` on all three lines.
`--text-inverse` is defined in `semantic.css:14` as `var(--gengage-text-inverse, #f9fafb)`.
This makes the color overridable at the merchant level via `--gengage-text-inverse` if needed,
while defaulting to near-white. It also correctly expresses the semantic intent ("text on a
dark/inverted surface") rather than the literal color value.

---

## Fix 13 — All 10 `--ds-space-*` tokens unused [DEAD TOKENS]

**File:** `src/design-system/tokens/raw.css`
**Lines:** 13-22

**Bug:** `--ds-space-1` through `--ds-space-16` (10 tokens) are defined but `var(--ds-space`
returns zero matches across the entire `src/` directory. They add ~200 bytes of dead CSS to every
widget bundle.

**Fix:** Delete lines 13-22 from `raw.css`. Also update `docs/design-system.md` if it references
spacing tokens — remove or mark as "planned, not yet adopted."

---

## Fix 14 — Missing `prefers-reduced-motion` for spinner and dot-loader [A11Y]

**File:** `src/design-system/primitives/loading.css`
**Lines:** 169-179

**Bug:** The `@media (prefers-reduced-motion: reduce)` block (L169-179) covers `.gds-progress-loader`
and `.gds-progress-dot` but NOT:
- `.gds-ai-spinner` (L132) — uses `animation: gds-spin 0.72s linear infinite`
- `.gds-ai-dot-loader span` (L115) — uses `animation: gds-progress-dot-pulse 1.2s ease-in-out infinite`

Users with motion sensitivity preferences still see continuous spinning and pulsing animations.

**Fix:** Add these rules inside the existing `@media (prefers-reduced-motion: reduce)` block:

```css
  :where(.gds-ai-spinner) {
    animation: none;
  }

  :where(.gds-ai-dot-loader span) {
    animation: none;
    opacity: 0.85;
  }
```

---

## Fix 15 — SimBut imports chat locale modules [COUPLING]

**File:** `src/simbut/index.ts`
**Lines:** 14-15

**Bug:** SimBut imports `CHAT_I18N_TR` and `CHAT_I18N_EN` from `../chat/locales/`. It only uses
the `findSimilarLabel` string from each. This creates a build-time coupling: the simbut widget
cannot exist without the chat module in the source tree, and the simbut IIFE bundle tree-shakes
in the entire chat locale objects unnecessarily.

**Fix:** Create `src/simbut/locales.ts` to hold simbut-specific locale defaults (not `types.ts`,
which is for type definitions only):

```typescript
// src/simbut/locales.ts
export const SIMBUT_I18N_TR = {
  findSimilarLabel: 'Benzerlerini Bul',
} as const;

export const SIMBUT_I18N_EN = {
  findSimilarLabel: 'Find Similar',
} as const;
```

In `src/simbut/index.ts`, replace lines 14-15:

```typescript
// Remove:
import { CHAT_I18N_TR } from '../chat/locales/tr.js';
import { CHAT_I18N_EN } from '../chat/locales/en.js';

// Add:
import { SIMBUT_I18N_TR, SIMBUT_I18N_EN } from './locales.js';
```

Update `resolveLabel` (L21-26):

```typescript
function resolveLabel(locale: string | undefined, i18n: Partial<SimButI18n> | undefined): string {
  if (i18n?.findSimilarLabel) return i18n.findSimilarLabel;
  const key = (locale ?? 'tr').toLowerCase();
  if (key.startsWith('en')) return SIMBUT_I18N_EN.findSimilarLabel;
  return SIMBUT_I18N_TR.findSimilarLabel;
}
```

Update the private default on line 39:

```typescript
private _label = SIMBUT_I18N_TR.findSimilarLabel;
```

---

## Fix 16 — 10 redundant `as SimButWidgetConfig` casts [CODE SMELL]

**File:** `src/simbut/index.ts`
**Lines:** 58, 60 (x2), 66, 69, 75, 99, 100, 116, 118, 119

**Bug:** `GengageSimBut extends BaseWidget<SimButWidgetConfig>`. `BaseWidget<TConfig>` declares
`protected config!: TConfig` (widget-base.ts:34). So `this.config` is already typed as
`SimButWidgetConfig`. All 10 casts are redundant and mask future type errors.

**Fix:** Remove `as SimButWidgetConfig` from all 10 occurrences. Just use `this.config` directly.
For example:

```typescript
// Before:
const sku = effectiveSku(this.config as SimButWidgetConfig);
// After:
const sku = effectiveSku(this.config);
```

---

## Execution Order

All fixes are independent and can be executed in any order. Recommended grouping:

1. **ChatDrawer.ts** — Fixes 1, 2, 5 (all in the same file)
2. **overlay.ts** — Fix 3
3. **connection-warning.ts** — Fixes 4, 7, 8
4. **chat.css** — Fixes 9, 10, 11, 12
5. **loading.css** — Fix 14
6. **raw.css + design-system.md** — Fix 13
7. **simbut/index.ts + simbut/locales.ts (new file)** — Fixes 15, 16
8. **new-account-guide.md** — Fix 6

After all fixes: `npm run typecheck && npm test && npm run build`

---

## Verification Requirements

Two fixes require explicit test coverage beyond the existing test suite.

### Fix 2 — Timer race on attach-menu destroy

The existing test suite does not cover the case where `destroy()` is called between
`_openAttachMenu()` being called and its deferred `setTimeout` firing.

Write a unit test in `tests/chat-drawer.test.ts` (or equivalent) that:

1. Instantiates `ChatDrawer` and calls `_openAttachMenu()` (or triggers it via button click).
2. Calls `destroy()` synchronously — before the `setTimeout(0)` fires.
3. Advances fake timers (e.g. `vi.runAllTimers()` or `vi.advanceTimersByTime(10)`) so the
   deferred callback would have fired.
4. Asserts that no `click` listener was added to `document` after destroy — verify by asserting
   that a simulated `document` click does not trigger the `_closeAttachMenu` path, or by spying
   on `document.addEventListener` and confirming it was not called after `destroy()`.

### Fix 8 — Connection warning probe URL configuration

Add tests in `tests/connection-warning.test.ts` (or equivalent):

**Case A — default path:**
1. Do not call `configureConnectionWarning`.
2. Trigger a request via `trackConnectionWarningRequest`.
3. When `checkConnectivity()` runs internally, spy on `fetch` and confirm it is called with
   `'https://www.google.com/favicon.ico'`.

**Case B — configured non-Google probe:**
1. Call `configureConnectionWarning({ probeUrl: 'https://example.com/probe' })` before
   any requests.
2. Trigger a request via `trackConnectionWarningRequest`.
3. Spy on `fetch` and confirm it is called with `'https://example.com/probe'`, not Google.
4. After the test, reset the module state (re-import or call
   `configureConnectionWarning({ probeUrl: 'https://www.google.com/favicon.ico' })`) to avoid
   polluting other tests.

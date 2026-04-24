// Global test setup — polyfills for jsdom environment.

// CSS.escape is not available in jsdom. Provide a spec-compliant polyfill
// so tests that exercise querySelector with CSS.escape() work correctly.
if (typeof CSS === 'undefined' || !CSS.escape) {
  const g = globalThis as Record<string, unknown>;
  g.CSS = {
    ...(typeof CSS !== 'undefined' ? CSS : {}),
    escape: (v: string) => v.replace(/([^\w-])/g, '\\$1'),
  };
}

// Unit tests assert navigation intent, not browser navigation. Prevent the
// fallback location assignment so jsdom does not emit navigation errors.
window.addEventListener('gengage:navigate', (event) => {
  event.preventDefault();
});

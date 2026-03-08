/**
 * Debug logging for integrators.
 *
 * Enable with: `localStorage.setItem('gengage:debug', '1')`
 * Disable with: `localStorage.removeItem('gengage:debug')`
 *
 * When disabled, all debug calls are no-ops with zero overhead
 * (the check is a single localStorage read cached per page load).
 */

let _enabled: boolean | null = null;

function isEnabled(): boolean {
  if (_enabled !== null) return _enabled;
  try {
    _enabled = localStorage.getItem('gengage:debug') === '1';
  } catch {
    _enabled = false;
  }
  return _enabled;
}

/** Log a debug message (only when gengage:debug is enabled). */
export function debugLog(category: string, message: string, data?: unknown): void {
  if (!isEnabled()) return;
  const args: unknown[] = [`[gengage:${category}]`, message];
  if (data !== undefined) args.push(data);
  // eslint-disable-next-line no-console -- debug utility, gated by localStorage flag
  console.debug(...args);
}

/** Reset the cached enabled state (for testing). */
export function _resetDebugCache(): void {
  _enabled = null;
}

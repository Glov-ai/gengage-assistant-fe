import type { AccountRuntimeConfig } from './config-schema.js';

export interface PreflightWarning {
  code: string;
  message: string;
  severity: 'warn' | 'error';
}

export interface PreflightResult {
  ok: boolean;
  warnings: PreflightWarning[];
}

function isValidSelector(selector: string): boolean {
  try {
    document.querySelector(selector);
    return true;
  } catch {
    return false;
  }
}

export function preflightDiagnostics(
  config: AccountRuntimeConfig,
  options?: { skipCspCheck?: boolean },
): PreflightResult {
  const warnings: PreflightWarning[] = [];

  const mounts = config.mounts;
  const mountEntries: Array<[string, string | undefined]> = [
    ['qna', mounts.qna],
    ['simrel', mounts.simrel],
    ['simbut', mounts.simbut],
    ['chat', mounts.chat],
  ];

  for (const [widget, selector] of mountEntries) {
    if (selector === undefined) continue;

    if (!isValidSelector(selector)) {
      warnings.push({
        code: 'INVALID_SELECTOR',
        message: `[gengage preflight] ${widget} mount selector is invalid CSS: "${selector}"`,
        severity: 'error',
      });
      continue;
    }

    if (!document.querySelector(selector)) {
      warnings.push({
        code: 'MOUNT_NOT_FOUND',
        message: `[gengage preflight] ${widget} mount target not found: "${selector}" — widget will skip or wait for DOM`,
        severity: 'warn',
      });
    }
  }

  const idempotencyKey = config.gtm.idempotencyKey;
  if ((window as unknown as Record<string, unknown>)[idempotencyKey] !== undefined) {
    warnings.push({
      code: 'DUPLICATE_IDEMPOTENCY',
      message: `[gengage preflight] window["${idempotencyKey}"] already exists — widgets may have already initialized`,
      severity: 'warn',
    });
  }

  // CSP connect-src probe: detect if the middleware URL is blocked.
  // Uses a synchronous SecurityPolicyViolationEvent listener to catch CSP blocks.
  if (!options?.skipCspCheck) {
    let cspBlocked = false;
    const cspListener = (e: SecurityPolicyViolationEvent) => {
      if (e.blockedURI && config.middlewareUrl.startsWith(e.blockedURI)) {
        cspBlocked = true;
      }
    };
    document.addEventListener('securitypolicyviolation', cspListener);
    try {
      // A HEAD request with mode 'no-cors' is cheap and triggers CSP if connect-src blocks it.
      void fetch(config.middlewareUrl, { method: 'HEAD', mode: 'no-cors' }).catch(() => {
        /* swallow — we only care about CSP violations, not network errors */
      });
    } catch {
      // fetch itself may throw if CSP blocks it synchronously
      cspBlocked = true;
    }
    // Give the browser a tick to fire the violation event synchronously.
    // If it fired, cspBlocked is already true.
    document.removeEventListener('securitypolicyviolation', cspListener);
    if (cspBlocked) {
      warnings.push({
        code: 'CSP_BLOCKED',
        message: `[gengage preflight] middleware URL may be blocked by Content-Security-Policy: "${config.middlewareUrl}". Add it to connect-src.`,
        severity: 'warn',
      });
    }
  }

  for (const w of warnings) {
    if (w.severity === 'error') {
      console.error(w.message);
    } else {
      console.warn(w.message);
    }
  }

  return {
    ok: warnings.every((w) => w.severity !== 'error'),
    warnings,
  };
}

import { describe, it, expect, beforeEach } from 'vitest';
import { preflightDiagnostics } from '../src/common/preflight.js';
import { parseAccountRuntimeConfig } from '../src/common/config-schema.js';

function makeConfig(overrides: Record<string, unknown> = {}) {
  return parseAccountRuntimeConfig({
    version: '1',
    accountId: 'test',
    middlewareUrl: 'https://test.example.com',
    widgets: {
      chat: { enabled: true },
      qna: { enabled: true },
      simrel: { enabled: true },
    },
    ...overrides,
  });
}

describe('preflightDiagnostics', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns ok when config is valid and no mounts are specified', () => {
    const result = preflightDiagnostics(makeConfig());
    expect(result.ok).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('warns when QNA mount selector is not found in DOM', () => {
    const result = preflightDiagnostics(makeConfig({ mounts: { qna: '#missing-qna' } }));
    expect(result.ok).toBe(true);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'MOUNT_NOT_FOUND', severity: 'warn' }));
  });

  it('warns when SimRel mount selector is not found in DOM', () => {
    const result = preflightDiagnostics(makeConfig({ mounts: { simrel: '#missing-simrel' } }));
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'MOUNT_NOT_FOUND', severity: 'warn' }));
  });

  it('passes when mount selectors exist in DOM', () => {
    document.body.innerHTML = '<div id="qna"></div><div id="simrel"></div>';
    const result = preflightDiagnostics(makeConfig({ mounts: { qna: '#qna', simrel: '#simrel' } }));
    expect(result.ok).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('reports error for invalid CSS selector', () => {
    const result = preflightDiagnostics(makeConfig({ mounts: { qna: '##invalid' } }));
    expect(result.ok).toBe(false);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'INVALID_SELECTOR', severity: 'error' }));
  });

  it('warns when idempotency key already exists on window', () => {
    (window as unknown as Record<string, unknown>)['__gengageWidgetsInit'] = true;
    const result = preflightDiagnostics(makeConfig());
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: 'DUPLICATE_IDEMPOTENCY', severity: 'warn' }),
    );
    delete (window as unknown as Record<string, unknown>)['__gengageWidgetsInit'];
  });
});

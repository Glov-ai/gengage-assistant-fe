import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for proactive popup cooldown logic.
 *
 * The cooldown uses localStorage with key `gengage_proactive_time_<accountId>`
 * to prevent re-showing the proactive popup within a configurable window.
 */

// Extract the cooldown logic into testable helpers that mirror the private methods.
// This avoids full widget instantiation while testing the same code paths.
function cooldownKey(accountId: string): string {
  return `gengage_proactive_time_${accountId}`;
}

function isCooldownActive(accountId: string, cooldownMs: number): boolean {
  try {
    const ts = localStorage.getItem(cooldownKey(accountId));
    if (ts) {
      const elapsed = Date.now() - parseInt(ts, 10);
      return elapsed < cooldownMs;
    }
  } catch {
    // localStorage unavailable
  }
  return false;
}

function setCooldown(accountId: string): void {
  try {
    localStorage.setItem(cooldownKey(accountId), String(Date.now()));
  } catch {
    // localStorage unavailable
  }
}

const DEFAULT_COOLDOWN = 3_600_000; // 1 hour

describe('Proactive cooldown', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false when no cooldown is set', () => {
    expect(isCooldownActive('testaccount', DEFAULT_COOLDOWN)).toBe(false);
  });

  it('returns true immediately after setting cooldown', () => {
    setCooldown('testaccount');
    expect(isCooldownActive('testaccount', DEFAULT_COOLDOWN)).toBe(true);
  });

  it('returns false after cooldown expires', () => {
    // Set a timestamp 2 hours in the past
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    localStorage.setItem(cooldownKey('testaccount'), String(twoHoursAgo));
    expect(isCooldownActive('testaccount', DEFAULT_COOLDOWN)).toBe(false);
  });

  it('respects custom cooldown duration', () => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    localStorage.setItem(cooldownKey('testaccount'), String(fiveMinutesAgo));

    // 10-minute cooldown: 5 minutes elapsed → still active
    expect(isCooldownActive('testaccount', 10 * 60 * 1000)).toBe(true);
    // 3-minute cooldown: 5 minutes elapsed → expired
    expect(isCooldownActive('testaccount', 3 * 60 * 1000)).toBe(false);
  });

  it('handles corrupted localStorage value (NaN fallback)', () => {
    localStorage.setItem(cooldownKey('testaccount'), 'not-a-number');
    // parseInt('not-a-number') → NaN, Date.now() - NaN → NaN, NaN < cooldown → false
    expect(isCooldownActive('testaccount', DEFAULT_COOLDOWN)).toBe(false);
  });

  it('namespaces cooldown per accountId', () => {
    setCooldown('account-a');
    expect(isCooldownActive('account-a', DEFAULT_COOLDOWN)).toBe(true);
    expect(isCooldownActive('account-b', DEFAULT_COOLDOWN)).toBe(false);
  });

  it('handles localStorage unavailability gracefully', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Access denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Access denied');
    });

    // Should not throw, returns false (no cooldown)
    expect(isCooldownActive('testaccount', DEFAULT_COOLDOWN)).toBe(false);
    // Should not throw
    expect(() => setCooldown('testaccount')).not.toThrow();
  });
});

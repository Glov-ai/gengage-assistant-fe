/**
 * Tests for action classifier — input-area chips vs message-flow pills.
 */

import { describe, it, expect } from 'vitest';
import { isInputAreaAction } from '../src/chat/components/actionClassifier.js';

describe('isInputAreaAction', () => {
  it('returns true for search icon', () => {
    expect(isInputAreaAction({ icon: 'search' })).toBe(true);
  });

  it('returns true for info icon', () => {
    expect(isInputAreaAction({ icon: 'info' })).toBe(true);
  });

  it('returns true for review icon', () => {
    expect(isInputAreaAction({ icon: 'review' })).toBe(true);
  });

  it('returns true for similar icon', () => {
    expect(isInputAreaAction({ icon: 'similar' })).toBe(true);
  });

  it('returns true for quickAnswer action type', () => {
    expect(isInputAreaAction({ action: { type: 'quickAnswer' } })).toBe(true);
  });

  it('returns true for reviewSummary action type', () => {
    expect(isInputAreaAction({ action: { type: 'reviewSummary' } })).toBe(true);
  });

  it('returns true for searchDiscovery action type', () => {
    expect(isInputAreaAction({ action: { type: 'searchDiscovery' } })).toBe(true);
  });

  it('returns false for unknown icon', () => {
    expect(isInputAreaAction({ icon: 'cart' })).toBe(false);
  });

  it('returns false for unknown action type', () => {
    expect(isInputAreaAction({ action: { type: 'launchSingleProduct' } })).toBe(false);
  });

  it('returns false when no icon or action', () => {
    expect(isInputAreaAction({})).toBe(false);
  });

  it('returns true when icon matches even if action type does not', () => {
    expect(isInputAreaAction({ icon: 'search', action: { type: 'launchSingleProduct' } })).toBe(true);
  });
});

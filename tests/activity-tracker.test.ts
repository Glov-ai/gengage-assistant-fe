import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ActivityTracker } from '../src/common/activity-tracker.js';

describe('ActivityTracker', () => {
  let tracker: ActivityTracker;
  const onActivity = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    onActivity.mockClear();
  });

  afterEach(() => {
    tracker?.destroy();
    vi.useRealTimers();
  });

  it('emits pageview on construction', () => {
    tracker = new ActivityTracker({ onActivity });
    expect(onActivity).toHaveBeenCalledWith(expect.objectContaining({ type: 'pageview' }));
  });

  it('emits idle after threshold', () => {
    tracker = new ActivityTracker({ onActivity, idleThresholdMs: 1000 });
    onActivity.mockClear();

    vi.advanceTimersByTime(1000);
    expect(onActivity).toHaveBeenCalledWith(expect.objectContaining({ type: 'idle' }));
  });

  it('resets idle timer on mousemove', () => {
    tracker = new ActivityTracker({ onActivity, idleThresholdMs: 1000 });
    onActivity.mockClear();

    vi.advanceTimersByTime(500);
    window.dispatchEvent(new Event('mousemove'));
    vi.advanceTimersByTime(500);
    // Should NOT have fired idle yet (timer was reset)
    expect(onActivity).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'idle' }));

    vi.advanceTimersByTime(500);
    expect(onActivity).toHaveBeenCalledWith(expect.objectContaining({ type: 'idle' }));
  });

  it('resets idle timer on keydown', () => {
    tracker = new ActivityTracker({ onActivity, idleThresholdMs: 1000 });
    onActivity.mockClear();

    vi.advanceTimersByTime(900);
    window.dispatchEvent(new Event('keydown'));
    vi.advanceTimersByTime(900);
    expect(onActivity).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'idle' }));
  });

  it('emits blur on visibilitychange to hidden', () => {
    tracker = new ActivityTracker({ onActivity });
    onActivity.mockClear();

    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(onActivity).toHaveBeenCalledWith(expect.objectContaining({ type: 'blur' }));

    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  it('emits focus on visibilitychange to visible', () => {
    tracker = new ActivityTracker({ onActivity });
    onActivity.mockClear();

    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(onActivity).toHaveBeenCalledWith(expect.objectContaining({ type: 'focus' }));
  });

  it('maxScrollDepth starts at 0', () => {
    tracker = new ActivityTracker({ onActivity });
    expect(tracker.maxScrollDepth).toBe(0);
  });

  it('does not emit events after destroy', () => {
    tracker = new ActivityTracker({ onActivity, idleThresholdMs: 1000 });
    onActivity.mockClear();

    tracker.destroy();
    vi.advanceTimersByTime(1000);
    expect(onActivity).not.toHaveBeenCalled();
  });

  it('destroy is safe to call multiple times', () => {
    tracker = new ActivityTracker({ onActivity });
    tracker.destroy();
    expect(() => tracker.destroy()).not.toThrow();
  });

  it('uses default idleThreshold of 30000ms', () => {
    tracker = new ActivityTracker({ onActivity });
    onActivity.mockClear();

    vi.advanceTimersByTime(29999);
    expect(onActivity).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'idle' }));

    vi.advanceTimersByTime(1);
    expect(onActivity).toHaveBeenCalledWith(expect.objectContaining({ type: 'idle' }));
  });
});

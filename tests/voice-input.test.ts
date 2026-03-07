import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VoiceInput, isVoiceInputSupported } from '../src/common/voice-input.js';

// Mock SpeechRecognition
let onend: (() => void) | null = null;

class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = '';
  maxAlternatives = 1;
  onresult: (() => void) | null = null;
  onerror: ((event: { error: string; message: string }) => void) | null = null;
  onend: (() => void) | null = null;
  onstart: (() => void) | null = null;
  onspeechend: (() => void) | null = null;
  onaudiostart: (() => void) | null = null;

  constructor() {
    onend = null;
  }

  start(): void {
    onend = this.onend;
    // Simulate async start
    setTimeout(() => this.onstart?.(), 0);
  }

  stop(): void {
    setTimeout(() => this.onend?.(), 0);
  }

  abort(): void {
    setTimeout(() => this.onend?.(), 0);
  }

  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean {
    return false;
  }
}

describe('VoiceInput', () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition;
    (globalThis as Record<string, unknown>).isSecureContext = true;
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).SpeechRecognition;
  });

  it('detects support when SpeechRecognition is available', () => {
    expect(isVoiceInputSupported()).toBe(true);
  });

  it('detects no support when SpeechRecognition is missing', () => {
    delete (globalThis as Record<string, unknown>).SpeechRecognition;
    expect(isVoiceInputSupported()).toBe(false);
  });

  it('transitions to listening state on start', async () => {
    const onStateChange = vi.fn();
    const voice = new VoiceInput({ onStateChange });
    voice.start();
    await vi.waitFor(() => expect(onStateChange).toHaveBeenCalledWith('listening'));
  });

  it('transitions to idle state on stop', async () => {
    const onStateChange = vi.fn();
    const voice = new VoiceInput({ onStateChange });
    voice.start();
    await vi.waitFor(() => expect(voice.state).toBe('listening'));
    voice.stop();
    expect(voice.state).toBe('idle');
  });

  it('prevents rapid restart loop on Chrome (onend debounce)', async () => {
    const onStateChange = vi.fn();
    const voice = new VoiceInput({ onStateChange });
    voice.start();
    await vi.waitFor(() => expect(voice.state).toBe('listening'));

    // Simulate Chrome firing onend rapidly
    // First onend: should auto-restart (sets _lastRestartAt)
    onend?.();
    // State should still be listening (auto-restarted)
    expect(voice.state).toBe('listening');

    // Second onend immediately: should detect rapid restart and go idle
    onend?.();
    expect(voice.state).toBe('idle');
  });

  it('allows restart after sufficient delay', async () => {
    vi.useFakeTimers();
    const voice = new VoiceInput({});
    voice.start();
    await vi.advanceTimersByTimeAsync(10);

    // First restart (normal)
    onend?.();
    expect(voice.state).toBe('listening');

    // Advance past debounce window
    vi.advanceTimersByTime(600);

    // Second restart (after delay — should be allowed)
    onend?.();
    expect(voice.state).toBe('listening');

    voice.destroy();
    vi.useRealTimers();
  });

  it('does not restart after intentional stop', async () => {
    const voice = new VoiceInput({});
    voice.start();
    await vi.waitFor(() => expect(voice.state).toBe('listening'));

    voice.stop();
    expect(voice.state).toBe('idle');

    // onend fires after stop — should not restart
    onend?.();
    expect(voice.state).toBe('idle');
  });
});

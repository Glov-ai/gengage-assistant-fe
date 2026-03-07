import { describe, it, expect, vi, beforeEach } from 'vitest';
import { playTtsAudio, destroyAllTtsAudio } from '../src/common/tts-player.js';

interface MockAudioInstance {
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeAttribute: ReturnType<typeof vi.fn>;
  currentTime: number;
  src: string;
  _endedHandler: (() => void) | null;
}

function createMockAudioInstance(): MockAudioInstance {
  const instance: MockAudioInstance = {
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    load: vi.fn(),
    addEventListener: vi.fn(),
    removeAttribute: vi.fn(),
    currentTime: 0,
    src: '',
    _endedHandler: null,
  };
  instance.addEventListener.mockImplementation((event: string, handler: () => void) => {
    if (event === 'ended') instance._endedHandler = handler;
  });
  return instance;
}

describe('playTtsAudio', () => {
  let mockInstance: MockAudioInstance;

  beforeEach(() => {
    mockInstance = createMockAudioInstance();

    vi.stubGlobal('Audio', function MockAudio() {
      return mockInstance;
    });
  });

  it('plays allowed audio/ogg content type', () => {
    const handle = playTtsAudio('dGVzdA==', 'audio/ogg');
    expect(handle).not.toBeNull();
    expect(mockInstance.play).toHaveBeenCalled();
  });

  it('plays audio/mpeg content type', () => {
    const handle = playTtsAudio('dGVzdA==', 'audio/mpeg');
    expect(handle).not.toBeNull();
  });

  it('plays audio/wav content type', () => {
    const handle = playTtsAudio('dGVzdA==', 'audio/wav');
    expect(handle).not.toBeNull();
  });

  it('returns null for disallowed content type', () => {
    const handle = playTtsAudio('dGVzdA==', 'text/html');
    expect(handle).toBeNull();
  });

  it('returns null for empty content type', () => {
    const handle = playTtsAudio('dGVzdA==', '');
    expect(handle).toBeNull();
  });

  it('strips codec params when checking content type', () => {
    const handle = playTtsAudio('dGVzdA==', 'audio/ogg; codecs=opus');
    expect(handle).not.toBeNull();
  });

  it('stop() releases audio element', () => {
    const handle = playTtsAudio('dGVzdA==', 'audio/ogg')!;
    handle.stop();
    expect(mockInstance.pause).toHaveBeenCalled();
    expect(mockInstance.removeAttribute).toHaveBeenCalledWith('src');
    expect(mockInstance.load).toHaveBeenCalled();
  });

  it('defaults to audio/ogg content type', () => {
    const handle = playTtsAudio('dGVzdA==');
    expect(handle).not.toBeNull();
  });

  it('handles autoplay block gracefully and releases', async () => {
    mockInstance.play.mockRejectedValue(new DOMException('Autoplay blocked'));
    const handle = playTtsAudio('dGVzdA==', 'audio/ogg');
    expect(handle).not.toBeNull();
    // Wait for the catch to release
    await vi.waitFor(() => expect(mockInstance.load).toHaveBeenCalled());
  });

  it('registers ended listener for cleanup', () => {
    playTtsAudio('dGVzdA==', 'audio/ogg');
    expect(mockInstance.addEventListener).toHaveBeenCalledWith('ended', expect.any(Function), { once: true });
  });

  it('releases audio on ended event', () => {
    playTtsAudio('dGVzdA==', 'audio/ogg');
    // Simulate playback ending
    mockInstance._endedHandler?.();
    expect(mockInstance.pause).toHaveBeenCalled();
    expect(mockInstance.removeAttribute).toHaveBeenCalledWith('src');
    expect(mockInstance.load).toHaveBeenCalled();
  });

  it('destroyAllTtsAudio clears all active elements', () => {
    playTtsAudio('dGVzdA==', 'audio/ogg');
    const firstInstance = mockInstance;

    // Create a second instance
    mockInstance = createMockAudioInstance();
    playTtsAudio('dGVzdA==', 'audio/mpeg');
    const secondInstance = mockInstance;

    destroyAllTtsAudio();
    expect(firstInstance.pause).toHaveBeenCalled();
    expect(secondInstance.pause).toHaveBeenCalled();
  });

  it('returns null when Audio constructor throws', () => {
    vi.stubGlobal('Audio', function ThrowingAudio() {
      throw new Error('Not supported');
    });
    const handle = playTtsAudio('dGVzdA==', 'audio/ogg');
    expect(handle).toBeNull();
  });
});

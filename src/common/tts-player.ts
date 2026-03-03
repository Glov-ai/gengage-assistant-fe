const ALLOWED_AUDIO_TYPES = new Set([
  'audio/ogg',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/webm',
  'audio/aac',
  'audio/mp4',
]);

/** Returned by `playTtsAudio` on successful playback initiation. */
export interface AudioHandle {
  /** Stop playback immediately. Safe to call multiple times. */
  stop: () => void;
}

/**
 * Plays a base64-encoded audio clip.
 * Returns an `AudioHandle` that can stop playback, or `null` if playback
 * could not be initiated (blocked by browser, unsupported environment, etc.).
 */
export function playTtsAudio(base64: string, contentType = 'audio/ogg'): AudioHandle | null {
  // Strip parameters like '; codecs=opus' before checking allowlist
  const baseType = contentType.split(';')[0]!.trim();
  if (!ALLOWED_AUDIO_TYPES.has(baseType)) return null;
  try {
    const audio = new Audio(`data:${contentType};base64,${base64}`);
    audio.play().catch(() => {
      // Autoplay blocked by browser — silently ignore
    });
    return {
      stop: () => {
        audio.pause();
        audio.currentTime = 0;
      },
    };
  } catch {
    // Unsupported environment
    return null;
  }
}

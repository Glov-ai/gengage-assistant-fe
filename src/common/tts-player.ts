const ALLOWED_AUDIO_TYPES = new Set([
  'audio/ogg',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/webm',
  'audio/aac',
  'audio/mp4',
]);

/** Active audio elements tracked for bulk cleanup. */
const activeAudioElements = new Set<HTMLAudioElement>();

/** Release an audio element: pause, revoke, and remove from tracking set. */
function releaseAudio(audio: HTMLAudioElement): void {
  audio.pause();
  audio.removeAttribute('src');
  audio.load(); // Releases the media resource
  activeAudioElements.delete(audio);
}

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
    activeAudioElements.add(audio);
    audio.addEventListener('ended', () => releaseAudio(audio), { once: true });
    audio.play().catch(() => {
      // Autoplay blocked by browser — release immediately
      releaseAudio(audio);
    });
    return {
      stop: () => releaseAudio(audio),
    };
  } catch {
    // Unsupported environment
    return null;
  }
}

/** Stop and release all active TTS audio elements. */
export function destroyAllTtsAudio(): void {
  for (const audio of activeAudioElements) {
    releaseAudio(audio);
  }
}

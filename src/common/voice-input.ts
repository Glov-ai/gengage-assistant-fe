/**
 * Browser-native Web Speech API voice input.
 *
 * Uses the SpeechRecognition API for real-time speech-to-text.
 * The frontend sends transcribed text directly — no audio blobs
 * are sent to the backend. This replaces server-side Groq Whisper.
 *
 * Supports:
 *   - Real-time transcription with interim results
 *   - Turkish (`tr-TR`) and English (`en-US`) language support
 *   - Auto-submit on silence (configurable timeout)
 *   - Microphone permission handling with descriptive errors
 *
 * Browser support:
 *   - Chrome 33+, Edge 79+, Safari 14.1+ (via webkitSpeechRecognition)
 *   - Firefox: NOT SUPPORTED (no SpeechRecognition API)
 */

// ---------------------------------------------------------------------------
// Web Speech API types (not in lib.dom.d.ts for all TS targets)
// ---------------------------------------------------------------------------

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onaudiostart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type VoiceInputState = 'idle' | 'listening' | 'error';

export type VoiceInputErrorCode =
  | 'not-supported'
  | 'not-allowed'
  | 'no-microphone'
  | 'no-speech'
  | 'network'
  | 'aborted'
  | 'unknown';

export interface VoiceInputCallbacks {
  /** Called with interim transcript while the user speaks. */
  onInterim?: (text: string) => void;
  /** Called with final transcript when a phrase is recognized. */
  onFinal?: (text: string) => void;
  /** Called when auto-submit fires (silence timeout reached with final text). */
  onAutoSubmit?: (text: string) => void;
  /** Called when voice input state changes. */
  onStateChange?: (state: VoiceInputState) => void;
  /** Called on recognition error. */
  onError?: (code: VoiceInputErrorCode, message: string) => void;
}

export interface VoiceInputOptions {
  /** BCP 47 language tag. Default: 'tr-TR'. */
  lang?: string;
  /** Silence duration in ms before auto-submit. Default: 1500. */
  silenceTimeoutMs?: number;
  /** Whether to auto-submit on silence. Default: true. */
  autoSubmit?: boolean;
}

/**
 * Check whether the browser supports the Web Speech API.
 */
export function isVoiceInputSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  const w = globalThis as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as SpeechRecognitionConstructor | null;
}

export class VoiceInput {
  private recognition: SpeechRecognitionInstance | null = null;
  private _state: VoiceInputState = 'idle';
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private accumulatedTranscript = '';
  private readonly callbacks: VoiceInputCallbacks;
  private readonly lang: string;
  private readonly silenceTimeoutMs: number;
  private readonly autoSubmit: boolean;
  private intentionalStop = false;
  private _lastRestartAt = 0;

  constructor(callbacks: VoiceInputCallbacks, options?: VoiceInputOptions) {
    this.callbacks = callbacks;
    this.lang = options?.lang ?? 'tr-TR';
    this.silenceTimeoutMs = options?.silenceTimeoutMs ?? 1500;
    this.autoSubmit = options?.autoSubmit ?? true;
  }

  get state(): VoiceInputState {
    return this._state;
  }

  /**
   * Start listening. Requests microphone permission on first call.
   */
  start(): void {
    if (this._state === 'listening') return;

    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) {
      this.setState('error');
      this.callbacks.onError?.('not-supported', 'Web Speech API is not supported in this browser.');
      return;
    }

    // Require secure context (HTTPS)
    if (typeof globalThis.isSecureContext !== 'undefined' && !globalThis.isSecureContext) {
      this.setState('error');
      this.callbacks.onError?.('not-allowed', 'Voice input requires HTTPS.');
      return;
    }

    this.accumulatedTranscript = '';
    this.intentionalStop = false;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = this.lang;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      this.setState('listening');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      this.clearSilenceTimer();

      let interim = '';
      let latestFinal = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        const alt = result[0];
        if (!alt) continue;
        if (result.isFinal) {
          latestFinal += alt.transcript;
        } else {
          interim += alt.transcript;
        }
      }

      if (latestFinal) {
        this.accumulatedTranscript += latestFinal;
        this.callbacks.onFinal?.(this.accumulatedTranscript);
      }

      if (interim) {
        this.callbacks.onInterim?.(this.accumulatedTranscript + interim);
      }

      // Start silence timer for auto-submit
      if (this.autoSubmit && this.accumulatedTranscript) {
        this.startSilenceTimer();
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const code = mapErrorCode(event.error);
      // 'no-speech' and 'aborted' during intentional stop are not real errors
      if (this.intentionalStop && (event.error === 'no-speech' || event.error === 'aborted')) {
        return;
      }
      this.setState('error');
      this.callbacks.onError?.(code, event.message || event.error);
    };

    recognition.onend = () => {
      this.clearSilenceTimer();
      // Auto-restart if still in listening state (browser may stop recognition arbitrarily)
      if (this._state === 'listening' && !this.intentionalStop) {
        const now = Date.now();
        // Prevent rapid restart loop on Chrome — if onend fires within 500ms
        // of the last restart, the browser is refusing to stay active.
        if (now - this._lastRestartAt < 500) {
          this.setState('idle');
          return;
        }
        this._lastRestartAt = now;
        try {
          recognition.start();
        } catch {
          this.setState('idle');
        }
        return;
      }
      this.setState('idle');
    };

    this.recognition = recognition;

    try {
      recognition.start();
    } catch {
      this.setState('error');
      this.callbacks.onError?.('unknown', 'Failed to start speech recognition.');
    }
  }

  /**
   * Stop listening. Returns the accumulated transcript.
   */
  stop(): string {
    this.intentionalStop = true;
    this.clearSilenceTimer();
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Already stopped
      }
      this.recognition = null;
    }
    this.setState('idle');
    return this.accumulatedTranscript;
  }

  /**
   * Abort listening. Discards any accumulated transcript.
   */
  abort(): void {
    this.intentionalStop = true;
    this.clearSilenceTimer();
    this.accumulatedTranscript = '';
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // Already aborted
      }
      this.recognition = null;
    }
    this.setState('idle');
  }

  /** Destroy the instance and release resources. */
  destroy(): void {
    this.abort();
  }

  private setState(state: VoiceInputState): void {
    if (this._state !== state) {
      this._state = state;
      this.callbacks.onStateChange?.(state);
    }
  }

  private startSilenceTimer(): void {
    this.clearSilenceTimer();
    this.silenceTimer = setTimeout(() => {
      const text = this.stop();
      if (text.trim()) {
        this.callbacks.onAutoSubmit?.(text.trim());
      }
    }, this.silenceTimeoutMs);
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer !== null) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }
}

function mapErrorCode(error: string): VoiceInputErrorCode {
  switch (error) {
    case 'not-allowed':
      return 'not-allowed';
    case 'no-speech':
      return 'no-speech';
    case 'audio-capture':
      return 'no-microphone';
    case 'network':
      return 'network';
    case 'aborted':
      return 'aborted';
    default:
      return 'unknown';
  }
}

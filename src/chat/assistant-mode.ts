/**
 * Assistant-mode utilities for the chat widget.
 *
 * The chat widget can operate in multiple modes (shopping, beauty consulting,
 * watch expert, booking). This module contains the type, parsing helpers, and
 * recognised mode list so the main index.ts stays focused on orchestration.
 */

export type AssistantMode = 'shopping' | 'booking' | 'beauty_consulting' | 'watch_expert';

const RECOGNISED_MODES: readonly AssistantMode[] = ['beauty_consulting', 'watch_expert', 'booking'];

/** Safely cast an unknown value to a plain Record, or null. */
export function asRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Return the first non-empty string among the given values. */
export function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return undefined;
}

/**
 * Parse a redirect metadata payload and return the target assistant mode,
 * or `null` if the payload is not a valid mode-switch redirect.
 */
export function parseRedirectMode(redirectPayload: unknown): AssistantMode | null {
  const payload = asRecord(redirectPayload);
  if (!payload) return null;

  const mode = firstString(payload['assistant_mode'], payload['assistantMode']);
  if (!mode || !RECOGNISED_MODES.includes(mode as AssistantMode)) return null;

  return mode as AssistantMode;
}

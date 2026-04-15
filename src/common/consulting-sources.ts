/**
 * Wire-protocol source strings that indicate consulting-style product grids.
 *
 * Kept in `common/` because both the protocol adapter and chat-specific
 * renderers need to agree on which sources activate style-variation grids.
 */

export const CONSULTING_SOURCES: readonly string[] = ['beauty_consulting', 'watch_expert'];

/** Whether a wire-protocol source string is a consulting source. */
export function isConsultingSource(source: string | undefined): boolean {
  return typeof source === 'string' && CONSULTING_SOURCES.includes(source);
}

/**
 * Classifies suggested actions into input-area chips vs message-flow pills.
 *
 * Input-area chips: compact shortcuts above the input field (search, info, review, similar).
 * Message-flow pills: larger interactive cards in the suggestion row.
 */

const INPUT_AREA_ICONS = new Set(['search', 'info', 'review', 'similar']);
const INPUT_AREA_TYPES = new Set([
  'quickAnswer',
  'reviewSummary',
  'searchDiscovery',
  'launchDiscovery',
  'exploreTogetherV2',
]);

export function isInputAreaAction(btn: { icon?: string; action?: { type?: string } }): boolean {
  if (btn.icon && INPUT_AREA_ICONS.has(btn.icon)) return true;
  if (btn.action?.type && INPUT_AREA_TYPES.has(btn.action.type)) return true;
  return false;
}

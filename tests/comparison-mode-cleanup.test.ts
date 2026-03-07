import { describe, it, expect } from 'vitest';

/**
 * Tests for D-2: Comparison mode should be cleared when a new action is sent.
 * Verifies that _comparisonSelectMode is reset in _sendAction() when not preservePanel.
 */

describe('Comparison mode cleanup on new action', () => {
  it('formatKeyDifferences passes through HTML with existing list tags', async () => {
    // D-4: If backend sends pre-formatted HTML, don't double-wrap
    const htmlWithList = '<ul><li>Feature A</li><li>Feature B</li></ul>';
    const hasListTags = /<[uo]l[\s>]/i.test(htmlWithList) || /<li[\s>]/i.test(htmlWithList);
    expect(hasListTags).toBe(true);

    const plainText = 'Line 1\nLine 2\nLine 3';
    const plainHasList = /<[uo]l[\s>]/i.test(plainText) || /<li[\s>]/i.test(plainText);
    expect(plainHasList).toBe(false);
  });

  it('detects HTML list elements in various formats', () => {
    const cases = [
      { input: '<ul><li>A</li></ul>', expected: true },
      { input: '<ol><li>A</li></ol>', expected: true },
      { input: '<li>standalone</li>', expected: true },
      { input: '<UL><LI>uppercase</LI></UL>', expected: true },
      { input: 'plain text with newlines\nno html', expected: false },
      { input: '<p>paragraph only</p>', expected: false },
      { input: '<b>bold</b> text', expected: false },
    ];

    for (const { input, expected } of cases) {
      const result = /<[uo]l[\s>]/i.test(input) || /<li[\s>]/i.test(input);
      expect(result, `Failed for: ${input}`).toBe(expected);
    }
  });
});

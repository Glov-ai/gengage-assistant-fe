import { describe, it, expect } from 'vitest';
import { uuidv7 } from '../src/common/uuidv7.js';

describe('uuidv7', () => {
  it('returns a valid UUID format', () => {
    const id = uuidv7();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('sets version nibble to 7', () => {
    const id = uuidv7();
    // Version nibble is the 13th hex digit (first hex of byte 6)
    expect(id[14]).toBe('7');
  });

  it('sets variant bits to 10xx', () => {
    const id = uuidv7();
    // Variant nibble is the 17th hex digit (first hex of byte 8)
    const variantNibble = parseInt(id[19]!, 16);
    expect(variantNibble & 0xc).toBe(0x8); // top two bits are 10
  });

  it('generates unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(uuidv7());
    }
    expect(ids.size).toBe(100);
  });

  it('is lexicographically sortable by time', async () => {
    const id1 = uuidv7();
    // Ensure a different timestamp
    await new Promise((r) => setTimeout(r, 2));
    const id2 = uuidv7();
    expect(id1 < id2).toBe(true);
  });

  it('embeds timestamp in first 48 bits', () => {
    const before = Date.now();
    const id = uuidv7();
    const after = Date.now();

    // Extract timestamp from first 12 hex chars (48 bits)
    const hex = id.replace(/-/g, '').slice(0, 12);
    const timestamp = parseInt(hex, 16);

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });
});

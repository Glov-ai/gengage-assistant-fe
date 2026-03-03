import { describe, it, expect } from 'vitest';
import { validateImageFile, ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '../src/chat/attachment-utils.js';

describe('validateImageFile', () => {
  it('accepts a valid JPEG file', () => {
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
    expect(validateImageFile(file)).toEqual({ ok: true });
  });

  it('accepts a valid PNG file', () => {
    const file = new File(['data'], 'photo.png', { type: 'image/png' });
    expect(validateImageFile(file)).toEqual({ ok: true });
  });

  it('accepts a valid WebP file', () => {
    const file = new File(['data'], 'photo.webp', { type: 'image/webp' });
    expect(validateImageFile(file)).toEqual({ ok: true });
  });

  it('rejects a GIF file', () => {
    const file = new File(['data'], 'anim.gif', { type: 'image/gif' });
    const result = validateImageFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_type');
  });

  it('rejects a PDF file', () => {
    const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' });
    const result = validateImageFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_type');
  });

  it('rejects a file over 5 MB', () => {
    const bigData = new Uint8Array(MAX_FILE_SIZE + 1);
    const file = new File([bigData], 'big.jpg', { type: 'image/jpeg' });
    const result = validateImageFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('too_large');
  });

  it('accepts a file exactly at 5 MB', () => {
    const data = new Uint8Array(MAX_FILE_SIZE);
    const file = new File([data], 'exact.jpg', { type: 'image/jpeg' });
    expect(validateImageFile(file)).toEqual({ ok: true });
  });

  it('exports correct constants', () => {
    expect(ALLOWED_MIME_TYPES).toEqual(['image/jpeg', 'image/png', 'image/webp']);
    expect(MAX_FILE_SIZE).toBe(5 * 1024 * 1024);
  });
});

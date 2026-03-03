export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export type ValidationResult = { ok: true } | { ok: false; reason: 'invalid_type' | 'too_large' };

export function validateImageFile(file: File): ValidationResult {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, reason: 'invalid_type' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, reason: 'too_large' };
  }
  return { ok: true };
}

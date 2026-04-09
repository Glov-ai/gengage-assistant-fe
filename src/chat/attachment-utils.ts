export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const BEAUTY_ATTACHMENT_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
export const BEAUTY_ATTACHMENT_MAX_DIMENSION = 1600;
export const BEAUTY_ATTACHMENT_JPEG_QUALITY = 0.9;

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

function loadImageFromObjectUrl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

export async function normalizeBeautyAttachmentFile(file: File): Promise<File> {
  const mime = (file.type || '').toLowerCase();
  const needsMimeNormalization = mime !== 'image/jpeg' && mime !== 'image/jpg';
  const needsSizeNormalization = file.size > BEAUTY_ATTACHMENT_MAX_BYTES;
  if (!needsMimeNormalization && !needsSizeNormalization) {
    return file;
  }

  if (
    typeof document === 'undefined' ||
    typeof URL.createObjectURL !== 'function' ||
    typeof URL.revokeObjectURL !== 'function'
  ) {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageFromObjectUrl(objectUrl);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const longestEdge = Math.max(sourceWidth, sourceHeight);
    const scale = longestEdge > BEAUTY_ATTACHMENT_MAX_DIMENSION ? BEAUTY_ATTACHMENT_MAX_DIMENSION / longestEdge : 1;
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      return file;
    }
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const jpegBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', BEAUTY_ATTACHMENT_JPEG_QUALITY);
    });

    if (!jpegBlob) {
      return file;
    }

    const normalizedName = file.name.replace(/\.[^.]+$/, '') || 'beauty-upload';
    return new File([jpegBlob], `${normalizedName}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

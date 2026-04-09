import { describe, it, expect } from 'vitest';
import { getBeautyPhotoProgressMessage } from '../src/chat/expert-mode/beauty-photo-progress.js';

describe('getBeautyPhotoProgressMessage', () => {
  it('returns upload step text for upload-like pending types', () => {
    expect(getBeautyPhotoProgressMessage('attachment_upload')).toBe('Fotografiniz yukleniyor...');
  });

  it('returns analysis step text for vision-like pending types', () => {
    expect(getBeautyPhotoProgressMessage('image_analysis')).toBe('Fotografiniz analiz ediliyor...');
  });

  it('returns recommendation prep text for product list stage', () => {
    expect(getBeautyPhotoProgressMessage('productList')).toBe('Analiz tamamlandi, oneriler hazirlaniyor...');
  });

  it('returns null for unknown or empty values', () => {
    expect(getBeautyPhotoProgressMessage('unknown_stage')).toBeNull();
    expect(getBeautyPhotoProgressMessage(undefined)).toBeNull();
    expect(getBeautyPhotoProgressMessage(null)).toBeNull();
  });
});

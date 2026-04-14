import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const STYLE_ASSETS = [
  'natural_glow.png',
  'clean_girl.png',
  'no_makeup.png',
  'sun_kissed.png',
  'soft_glam.png',
  'rose_gold.png',
  'peach_blush.png',
  'bridal_soft.png',
  'matte_flawless.png',
  'contour_sculpt.png',
  'porcelain.png',
  'smokey_eye.png',
  'red_lip_classic.png',
  'glam_night.png',
  'cat_eye.png',
];

describe('beauty style assets', () => {
  it('includes all flormar beauty style images under public/remoteConfig/beauty-styles', () => {
    for (const fileName of STYLE_ASSETS) {
      const filePath = resolve(process.cwd(), 'public', 'remoteConfig', 'beauty-styles', fileName);
      expect(existsSync(filePath), `missing file: ${fileName}`).toBe(true);
    }
  });
});

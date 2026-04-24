import { describe, expect, it } from 'vitest';

describe('chat loading copy', () => {
  it('uses the revised neutral generic loading sequence in Turkish and English', async () => {
    const { CHAT_I18N_TR } = await import('../src/chat/locales/tr.js');
    const { CHAT_I18N_EN } = await import('../src/chat/locales/en.js');

    expect(CHAT_I18N_TR.loadingMessage).toBe('İsteğinizi inceliyorum...');
    expect(CHAT_I18N_TR.loadingSequenceGeneric).toEqual([
      'İsteğinizi inceliyorum...',
      'Ürün ve yorumlara bakıyorum...',
      'Detayları inceliyorum...',
    ]);

    expect(CHAT_I18N_EN.loadingMessage).toBe('Reviewing your request...');
    expect(CHAT_I18N_EN.loadingSequenceGeneric).toEqual([
      'Reviewing your request...',
      'Looking through products and reviews...',
      'Reviewing the details...',
    ]);
  });
});

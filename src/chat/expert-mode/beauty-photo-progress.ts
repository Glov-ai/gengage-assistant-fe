const STAGE_GROUPS: Array<{ hints: string[]; message: string }> = [
  {
    hints: ['upload', 'attachment', 'multipart'],
    message: 'Fotografiniz yukleniyor...',
  },
  {
    hints: ['vision', 'image', 'photo', 'analy', 'ocr'],
    message: 'Fotografiniz analiz ediliyor...',
  },
  {
    hints: ['productlist', 'group', 'search', 'recommend', 'retriev', 'catalog'],
    message: 'Analiz tamamlandi, oneriler hazirlaniyor...',
  },
];

export function getBeautyPhotoProgressMessage(
  pendingType: string | null | undefined,
): string | null {
  if (!pendingType) {
    return null;
  }

  const normalized = pendingType.toLowerCase();
  for (const group of STAGE_GROUPS) {
    if (group.hints.some((hint) => normalized.includes(hint))) {
      return group.message;
    }
  }

  return null;
}

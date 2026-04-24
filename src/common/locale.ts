export function resolveLocaleTag(locale: string | null | undefined): string {
  const trimmed = locale?.trim();
  return trimmed ? trimmed : 'tr';
}

/**
 * Applies a WidgetTheme as CSS custom properties on a container element.
 */

export interface ThemeTokens {
  primaryColor?: string;
  primaryForeground?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  borderRadius?: string;
  fontFamily?: string;
  fontSize?: string;
  [cssVar: string]: string | undefined;
}

const THEME_VAR_MAP: Record<string, string> = {
  primaryColor: '--gengage-primary-color',
  primaryForeground: '--gengage-primary-foreground',
  backgroundColor: '--gengage-background-color',
  foregroundColor: '--gengage-foreground-color',
  borderRadius: '--gengage-border-radius',
  fontFamily: '--gengage-font-family',
  fontSize: '--gengage-font-size',
};

export function applyTheme(container: HTMLElement, theme: ThemeTokens): void {
  for (const [key, value] of Object.entries(theme)) {
    if (value === undefined) continue;

    const cssVar = THEME_VAR_MAP[key];
    if (cssVar) {
      container.style.setProperty(cssVar, value);
    } else if (key.startsWith('--')) {
      container.style.setProperty(key, value);
    }
  }

  // Also set some direct styles for immediate visual effect in catalog cards
  if (theme.backgroundColor) {
    container.style.backgroundColor = theme.backgroundColor;
  }
  if (theme.foregroundColor) {
    container.style.color = theme.foregroundColor;
  }
  if (theme.fontFamily) {
    container.style.fontFamily = theme.fontFamily;
  }
  if (theme.fontSize) {
    container.style.fontSize = theme.fontSize;
  }
}

export function clearTheme(container: HTMLElement): void {
  for (const cssVar of Object.values(THEME_VAR_MAP)) {
    container.style.removeProperty(cssVar);
  }
  container.style.backgroundColor = '';
  container.style.color = '';
  container.style.fontFamily = '';
  container.style.fontSize = '';
}

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

/** Derive new design-system tokens from the 7 basic WidgetTheme properties. */
function deriveDesignTokens(theme: ThemeTokens): Record<string, string> {
  const tokens: Record<string, string> = {};
  const pc = theme.primaryColor;
  const pf = theme.primaryForeground ?? '#ffffff';
  if (pc) {
    tokens['--client-primary'] = pc;
    tokens['--client-primary-hover'] = `color-mix(in srgb, ${pc} 88%, black 12%)`;
    tokens['--client-primary-active'] = `color-mix(in srgb, ${pc} 78%, black 22%)`;
    tokens['--client-primary-subtle'] = `color-mix(in srgb, ${pc} 12%, white)`;
    tokens['--client-primary-soft'] = `color-mix(in srgb, ${pc} 20%, white)`;
    tokens['--client-on-primary'] = pf;
    tokens['--client-focus-ring'] = `color-mix(in srgb, ${pc} 32%, transparent)`;
  }
  if (theme.backgroundColor) tokens['--surface-card'] = theme.backgroundColor;
  if (theme.foregroundColor) tokens['--text-primary'] = theme.foregroundColor;
  return tokens;
}

export function applyTheme(container: HTMLElement, theme: ThemeTokens): void {
  // Derive design-system tokens first (explicit --* keys in theme override these)
  const derived = deriveDesignTokens(theme);
  for (const [k, v] of Object.entries(derived)) {
    container.style.setProperty(k, v);
  }

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

const DERIVED_VARS = [
  '--client-primary',
  '--client-primary-hover',
  '--client-primary-active',
  '--client-primary-subtle',
  '--client-primary-soft',
  '--client-on-primary',
  '--client-focus-ring',
  '--surface-card',
  '--text-primary',
];

export function clearTheme(container: HTMLElement): void {
  for (const cssVar of Object.values(THEME_VAR_MAP)) {
    container.style.removeProperty(cssVar);
  }
  for (const cssVar of DERIVED_VARS) {
    container.style.removeProperty(cssVar);
  }
  container.style.backgroundColor = '';
  container.style.color = '';
  container.style.fontFamily = '';
  container.style.fontSize = '';
}

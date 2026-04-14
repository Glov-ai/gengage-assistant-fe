/**
 * makePillLauncher — creates a pill-shaped chat launcher that combines an
 * avatar image with a text label, replacing the default circular FAB.
 *

 *   });
 *
 * Or call `makePillLauncher` + `apply()` manually when you need custom control.
 */

export interface PillLauncherOptions {
  /** Text label shown beside the avatar inside the pill */
  label: string;
  /** Avatar image URL — also used as `launcherImageUrl` to activate image-mode */
  avatarUrl: string;
  /** Brand primary color — used for border and hover effects */
  primaryColor: string;
  /** Dark text / shadow color for the label and drop shadow (default: '#111827') */
  secondaryColor?: string;
  /** CSS font-family string for the label text */
  fontFamily?: string;
  /** CSS class name injected on the label span (default: 'gengage-pill-launcher-label') */
  labelClassName?: string;
  /** id for the <style> tag injected into the shadow root (default: 'gengage-pill-launcher-style') */
  styleId?: string;
  /** Mobile breakpoint in px (default: 768) */
  mobileBreakpoint?: number;
  /** Desktop pill width (default: '188px') */
  desktopWidth?: string;
  /** Desktop pill height (default: '60px') */
  desktopHeight?: string;
  /** Avatar icon diameter (default: '46px') */
  iconSize?: string;
}

export interface PillLauncherKit {
  /**
   * Pass as `chat.launcherImageUrl` to `initOverlayWidgets`.
   * Equals `avatarUrl` — activates image-mode on the launcher button.
   */
  launcherImageUrl: string;
  /**
   * Call after `initOverlayWidgets` resolves.
   * Injects pill CSS into the widget shadow root, fixes the header avatar
   * class, and appends the text label span to the launcher button.
   * Retries via requestAnimationFrame for up to ~1.5 s.
   */
  apply(): Promise<void>;
}

export function makePillLauncher(options: PillLauncherOptions): PillLauncherKit {
  const {
    label,
    avatarUrl,
    primaryColor,
    secondaryColor = '#111827',
    fontFamily = 'inherit',
    labelClassName = 'gengage-pill-launcher-label',
    styleId = 'gengage-pill-launcher-style',
    mobileBreakpoint = 768,
    desktopWidth = '188px',
    desktopHeight = '60px',
    iconSize = '46px',
  } = options;

  const mobileWidth = `${parseInt(desktopWidth, 10) - 14}px`;
  const mobileHeight = `${parseInt(desktopHeight, 10) - 4}px`;
  const mobileIconSize = `${parseInt(iconSize, 10) - 4}px`;

  const css = `
:host {
  --pill-primary: ${primaryColor};
  --pill-secondary: ${secondaryColor};
  --pill-font: ${fontFamily};
}

button[data-gengage-part="chat-launcher-button"] {
  box-sizing: border-box;
  width: ${desktopWidth} !important;
  min-width: ${desktopWidth} !important;
  max-width: ${desktopWidth} !important;
  height: ${desktopHeight} !important;
  min-height: ${desktopHeight} !important;
  padding: 6px 7px 6px 22px !important;
  display: inline-flex !important;
  flex-direction: row-reverse !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 12px !important;
  border-radius: 999px !important;
  border: 1px solid color-mix(in srgb, var(--pill-secondary) 6%, white) !important;
  background: #ffffff !important;
  color: var(--pill-secondary) !important;
  box-shadow:
    0 18px 46px color-mix(in srgb, var(--pill-secondary) 17%, transparent),
    0 4px 14px color-mix(in srgb, var(--pill-secondary) 8%, transparent) !important;
  overflow: visible !important;
}

button[data-gengage-part="chat-launcher-button"]:hover {
  transform: translateY(-1px) !important;
  box-shadow:
    0 22px 52px color-mix(in srgb, var(--pill-secondary) 22%, transparent),
    0 6px 18px color-mix(in srgb, var(--pill-secondary) 12%, transparent) !important;
}

.${labelClassName} {
  color: var(--pill-secondary);
  font: 500 15px/1.05 var(--pill-font);
  letter-spacing: -0.02em;
  white-space: nowrap;
  flex: 0 0 auto;
  pointer-events: none;
}

button[data-gengage-part="chat-launcher-button"] img {
  width: ${iconSize} !important;
  height: ${iconSize} !important;
  flex: 0 0 ${iconSize} !important;
  border-radius: 999px;
  object-fit: cover;
  object-position: center;
  background: transparent;
  border: 0 !important;
  box-shadow: none !important;
}

@media (max-width: ${mobileBreakpoint}px) {
  button[data-gengage-part="chat-launcher-button"] {
    width: ${mobileWidth} !important;
    min-width: ${mobileWidth} !important;
    max-width: ${mobileWidth} !important;
    height: ${mobileHeight} !important;
    min-height: ${mobileHeight} !important;
    padding-left: 20px !important;
    padding-right: 7px !important;
  }

  .${labelClassName} {
    font-size: 14px;
  }

  button[data-gengage-part="chat-launcher-button"] img {
    width: ${mobileIconSize} !important;
    height: ${mobileIconSize} !important;
    flex-basis: ${mobileIconSize} !important;
  }
}
`.trim();

  const findShadowHost = (): HTMLElement | null => {
    for (const el of document.querySelectorAll('[data-gengage-widget]')) {
      if (!(el instanceof HTMLElement)) continue;
      const sr = el.shadowRoot;
      if (!sr) continue;
      if (sr.querySelector('[data-gengage-part="chat-launcher-button"]') || sr.querySelector('.gengage-chat-root')) {
        return el;
      }
    }
    return null;
  };

  const injectStyle = (root: ShadowRoot): void => {
    if (root.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = css;
    root.appendChild(style);
  };

  const applyOnce = (root: ShadowRoot): boolean => {
    injectStyle(root);

    const launcher = root.querySelector('[data-gengage-part="chat-launcher-button"]');
    if (!(launcher instanceof HTMLButtonElement)) return false;

    // When launcherImageUrl !== headerAvatarUrl the widget applies a logo class
    // that breaks circular treatment on the header avatar — remove it.
    const headerAvatar = root.querySelector('[data-gengage-part="chat-header-avatar"]');
    if (headerAvatar instanceof HTMLImageElement) {
      headerAvatar.classList.remove('gengage-chat-header-avatar--logo');
    }

    if (launcher.querySelector(`.${labelClassName}`)) return true;

    launcher.setAttribute('aria-label', label);
    const labelEl = document.createElement('span');
    labelEl.className = labelClassName;
    labelEl.textContent = label;
    launcher.appendChild(labelEl);
    return true;
  };

  const apply = async (): Promise<void> => {
    // Inject style early so the first paint never shows the default circle FAB
    const earlyHost = findShadowHost();
    if (earlyHost?.shadowRoot) injectStyle(earlyHost.shadowRoot);

    await Promise.resolve();

    for (let frame = 0; frame < 90; frame++) {
      const host = findShadowHost();
      const root = host?.shadowRoot ?? null;
      if (root) {
        injectStyle(root);
        if (applyOnce(root)) return;
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  };

  return { launcherImageUrl: avatarUrl, apply };
}

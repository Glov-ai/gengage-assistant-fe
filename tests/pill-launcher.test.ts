import { describe, it, expect, beforeEach } from 'vitest';
import { makePillLauncher } from '../src/common/pill-launcher.js';

function makeHost(): { host: HTMLElement; shadow: ShadowRoot; button: HTMLButtonElement } {
  const host = document.createElement('div');
  host.dataset['gengageWidget'] = 'gengagechat';
  const shadow = host.attachShadow({ mode: 'open' });
  const button = document.createElement('button');
  button.dataset['gengagePart'] = 'chat-launcher-button';
  shadow.appendChild(button);
  document.body.appendChild(host);
  return { host, shadow, button };
}

describe('makePillLauncher', () => {
  describe('return value', () => {
    it('launcherImageUrl equals avatarUrl', () => {
      const kit = makePillLauncher({
        label: 'Test',
        avatarUrl: 'https://example.com/logo.svg',
        primaryColor: '#f00',
      });
      expect(kit.launcherImageUrl).toBe('https://example.com/logo.svg');
    });

    it('exposes apply() function', () => {
      const kit = makePillLauncher({
        label: 'Test',
        avatarUrl: 'https://example.com/logo.svg',
        primaryColor: '#f00',
      });
      expect(typeof kit.apply).toBe('function');
    });
  });

  describe('apply(shadow) — targeted shadow root', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    it('targets only the provided shadow root, not the first in DOM order', async () => {
      const { shadow: shadow1, button: btn1 } = makeHost();
      const { shadow: shadow2, button: btn2 } = makeHost();

      const kit = makePillLauncher({
        label: 'Second Widget',
        avatarUrl: 'https://x.com/img.png',
        primaryColor: '#f00',
      });
      await kit.apply(shadow2);

      expect(shadow2.getElementById('gengage-pill-launcher-style')).not.toBeNull();
      expect(btn2.querySelector('.gengage-pill-launcher-label')?.textContent).toBe('Second Widget');
      expect(shadow1.getElementById('gengage-pill-launcher-style')).toBeNull();
      expect(btn1.querySelector('.gengage-pill-launcher-label')).toBeNull();
    });

    it('injects style and label when shadow is passed explicitly', async () => {
      const { shadow, button } = makeHost();
      const kit = makePillLauncher({
        label: 'Direct Shadow',
        avatarUrl: 'https://x.com/img.png',
        primaryColor: '#ff0000',
      });
      await kit.apply(shadow);
      expect(shadow.getElementById('gengage-pill-launcher-style')).not.toBeNull();
      expect(button.querySelector('.gengage-pill-launcher-label')?.textContent).toBe('Direct Shadow');
    });
  });

  describe('apply() — global scan fallback', () => {
    let shadow: ShadowRoot;
    let button: HTMLButtonElement;

    beforeEach(() => {
      document.body.innerHTML = '';
      ({ shadow, button } = makeHost());
    });

    it('injects a style tag into the shadow root', async () => {
      const kit = makePillLauncher({
        label: 'My Label',
        avatarUrl: 'https://x.com/img.png',
        primaryColor: '#123456',
      });
      await kit.apply();
      const style = shadow.getElementById('gengage-pill-launcher-style');
      expect(style).not.toBeNull();
      expect(style?.tagName.toLowerCase()).toBe('style');
    });

    it('style uses --pill-primary for border (primaryColor is not decorative)', async () => {
      const kit = makePillLauncher({
        label: 'Test',
        avatarUrl: 'https://x.com/img.png',
        primaryColor: '#abcdef',
      });
      await kit.apply();
      const style = shadow.getElementById('gengage-pill-launcher-style') as HTMLStyleElement | null;
      expect(style?.textContent).toContain('--pill-primary: #abcdef');
      expect(style?.textContent).toContain('var(--pill-primary)');
    });

    it('style tag contains the secondary color variable', async () => {
      const kit = makePillLauncher({
        label: 'Test',
        avatarUrl: 'https://x.com/img.png',
        primaryColor: '#f00',
        secondaryColor: '#112233',
      });
      await kit.apply();
      const style = shadow.getElementById('gengage-pill-launcher-style') as HTMLStyleElement | null;
      expect(style?.textContent).toContain('--pill-secondary: #112233');
    });

    it('appends label span to launcher button with correct text', async () => {
      const kit = makePillLauncher({
        label: "Koçtaş'a Sor",
        avatarUrl: 'https://x.com/img.png',
        primaryColor: '#f00',
      });
      await kit.apply();
      const label = button.querySelector('.gengage-pill-launcher-label');
      expect(label).not.toBeNull();
      expect(label?.textContent).toBe("Koçtaş'a Sor");
    });

    it('sets aria-label on launcher button', async () => {
      const kit = makePillLauncher({
        label: 'My Brand',
        avatarUrl: 'https://x.com/img.png',
        primaryColor: '#f00',
      });
      await kit.apply();
      expect(button.getAttribute('aria-label')).toBe('My Brand');
    });

    it('uses custom labelClassName', async () => {
      const kit = makePillLauncher({
        label: 'Test',
        avatarUrl: 'https://x.com/img.png',
        primaryColor: '#f00',
        labelClassName: 'flormar-launcher-label',
      });
      await kit.apply();
      const label = button.querySelector('.flormar-launcher-label');
      expect(label).not.toBeNull();
      expect(label?.textContent).toBe('Test');
    });

    it('uses custom styleId for the injected style tag', async () => {
      const kit = makePillLauncher({
        label: 'Test',
        avatarUrl: 'https://x.com/img.png',
        primaryColor: '#f00',
        styleId: 'flormar-pill-launcher-style',
      });
      await kit.apply();
      expect(shadow.getElementById('flormar-pill-launcher-style')).not.toBeNull();
      expect(shadow.getElementById('gengage-pill-launcher-style')).toBeNull();
    });

    it('does not append label span twice on repeated apply()', async () => {
      const kit = makePillLauncher({
        label: 'Test',
        avatarUrl: 'https://x.com/img.png',
        primaryColor: '#f00',
      });
      await kit.apply();
      await kit.apply();
      expect(button.querySelectorAll('.gengage-pill-launcher-label').length).toBe(1);
    });

    it('also discovers host via gengage-chat-root class', async () => {
      document.body.innerHTML = '';
      const altHost = document.createElement('div');
      altHost.dataset['gengageWidget'] = 'gengagechat';
      const altShadow = altHost.attachShadow({ mode: 'open' });
      const root = document.createElement('div');
      root.className = 'gengage-chat-root';
      altShadow.appendChild(root);
      const launcherBtn = document.createElement('button');
      launcherBtn.dataset['gengagePart'] = 'chat-launcher-button';
      altShadow.appendChild(launcherBtn);
      document.body.appendChild(altHost);

      const kit = makePillLauncher({
        label: 'Alt Test',
        avatarUrl: 'https://x.com/img.png',
        primaryColor: '#0f0',
      });
      await kit.apply();
      expect(altShadow.getElementById('gengage-pill-launcher-style')).not.toBeNull();
    });
  });

  describe('header avatar logo class — conditional removal', () => {
    let shadow: ShadowRoot;
    let button: HTMLButtonElement;

    beforeEach(() => {
      document.body.innerHTML = '';
      ({ shadow, button } = makeHost());
    });

    it('removes logo class when header and launcher show the same image', async () => {
      const img = document.createElement('img');
      img.src = 'https://x.com/same.svg';
      button.appendChild(img);

      const avatar = document.createElement('img');
      avatar.src = 'https://x.com/same.svg';
      avatar.dataset['gengagePart'] = 'chat-header-avatar';
      avatar.classList.add('gengage-chat-header-avatar--logo');
      shadow.appendChild(avatar);

      await makePillLauncher({
        label: 'Test',
        avatarUrl: 'https://x.com/same.svg',
        primaryColor: '#f00',
      }).apply(shadow);

      expect(avatar.classList.contains('gengage-chat-header-avatar--logo')).toBe(false);
    });

    it('preserves logo class when header avatar differs from launcher image (n11com pattern)', async () => {
      const img = document.createElement('img');
      img.src = 'https://x.com/launcher-icon.svg';
      button.appendChild(img);

      const avatar = document.createElement('img');
      avatar.src = 'https://x.com/header-logo.png';
      avatar.dataset['gengagePart'] = 'chat-header-avatar';
      avatar.classList.add('gengage-chat-header-avatar--logo');
      shadow.appendChild(avatar);

      await makePillLauncher({
        label: 'Test',
        avatarUrl: 'https://x.com/launcher-icon.svg',
        primaryColor: '#f00',
      }).apply(shadow);

      expect(avatar.classList.contains('gengage-chat-header-avatar--logo')).toBe(true);
    });

    it('removes logo class when no launcher img child exists', async () => {
      const avatar = document.createElement('img');
      avatar.dataset['gengagePart'] = 'chat-header-avatar';
      avatar.classList.add('gengage-chat-header-avatar--logo');
      shadow.appendChild(avatar);

      await makePillLauncher({
        label: 'Test',
        avatarUrl: 'https://x.com/img.png',
        primaryColor: '#f00',
      }).apply(shadow);

      expect(avatar.classList.contains('gengage-chat-header-avatar--logo')).toBe(false);
    });
  });

  describe('dimension derivation in CSS', () => {
    it('derives mobile dimensions from custom desktop values', async () => {
      document.body.innerHTML = '';
      const { shadow } = makeHost();

      const kit = makePillLauncher({
        label: 'Test',
        avatarUrl: 'https://x.com/img.png',
        primaryColor: '#f00',
        desktopWidth: '200px',
        desktopHeight: '64px',
        iconSize: '50px',
      });
      await kit.apply(shadow);

      const style = shadow.getElementById('gengage-pill-launcher-style') as HTMLStyleElement;
      // mobileWidth = 200 - 14 = 186px, mobileHeight = 64 - 4 = 60px, mobileIconSize = 50 - 4 = 46px
      expect(style.textContent).toContain('186px');
      expect(style.textContent).toContain('46px');
    });

    it('uses default desktop dimensions when none specified', async () => {
      document.body.innerHTML = '';
      const { shadow } = makeHost();

      const kit = makePillLauncher({
        label: 'Test',
        avatarUrl: 'https://x.com/img.png',
        primaryColor: '#f00',
      });
      await kit.apply(shadow);

      const style = shadow.getElementById('gengage-pill-launcher-style') as HTMLStyleElement;
      // defaults: desktopWidth=188px, desktopHeight=60px, iconSize=46px
      expect(style.textContent).toContain('188px');
      expect(style.textContent).toContain('60px');
      expect(style.textContent).toContain('46px');
    });
  });
});

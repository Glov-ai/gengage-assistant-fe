import { describe, it, expect, beforeEach } from 'vitest';
import { makePillLauncher } from '../src/common/pill-launcher.js';

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

  describe('apply() DOM injection', () => {
    let host: HTMLElement;
    let shadow: ShadowRoot;
    let button: HTMLButtonElement;

    beforeEach(() => {
      document.body.innerHTML = '';
      host = document.createElement('div');
      host.dataset['gengageWidget'] = 'gengagechat';
      shadow = host.attachShadow({ mode: 'open' });
      button = document.createElement('button');
      button.dataset['gengagePart'] = 'chat-launcher-button';
      shadow.appendChild(button);
      document.body.appendChild(host);
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

    it('style tag contains the primary color variable', async () => {
      const kit = makePillLauncher({
        label: 'Test',
        avatarUrl: 'https://x.com/img.png',
        primaryColor: '#abcdef',
      });
      await kit.apply();
      const style = shadow.getElementById('gengage-pill-launcher-style') as HTMLStyleElement | null;
      expect(style?.textContent).toContain('--pill-primary: #abcdef');
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

    it('removes logo class from header avatar if present', async () => {
      const avatar = document.createElement('img');
      avatar.dataset['gengagePart'] = 'chat-header-avatar';
      avatar.classList.add('gengage-chat-header-avatar--logo');
      shadow.appendChild(avatar);

      const kit = makePillLauncher({
        label: 'Test',
        avatarUrl: 'https://x.com/img.png',
        primaryColor: '#f00',
      });
      await kit.apply();
      expect(avatar.classList.contains('gengage-chat-header-avatar--logo')).toBe(false);
    });

    it('also discovers host via gengage-chat-root class', async () => {
      document.body.innerHTML = '';
      const altHost = document.createElement('div');
      altHost.dataset['gengageWidget'] = 'gengagechat';
      const altShadow = altHost.attachShadow({ mode: 'open' });
      // No launcher button — only the chat-root class
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

  describe('dimension derivation in CSS', () => {
    it('derives mobile dimensions from custom desktop values', async () => {
      document.body.innerHTML = '';
      const host = document.createElement('div');
      host.dataset['gengageWidget'] = 'gengagechat';
      const shadow = host.attachShadow({ mode: 'open' });
      const btn = document.createElement('button');
      btn.dataset['gengagePart'] = 'chat-launcher-button';
      shadow.appendChild(btn);
      document.body.appendChild(host);

      const kit = makePillLauncher({
        label: 'Test',
        avatarUrl: 'https://x.com/img.png',
        primaryColor: '#f00',
        desktopWidth: '200px',
        desktopHeight: '64px',
        iconSize: '50px',
      });
      await kit.apply();

      const style = shadow.getElementById('gengage-pill-launcher-style') as HTMLStyleElement;
      // mobileWidth = 200 - 14 = 186px, mobileHeight = 64 - 4 = 60px, mobileIconSize = 50 - 4 = 46px
      expect(style.textContent).toContain('186px');
      expect(style.textContent).toContain('46px');
    });

    it('uses default desktop dimensions when none specified', async () => {
      document.body.innerHTML = '';
      const host = document.createElement('div');
      host.dataset['gengageWidget'] = 'gengagechat';
      const shadow = host.attachShadow({ mode: 'open' });
      const btn = document.createElement('button');
      btn.dataset['gengagePart'] = 'chat-launcher-button';
      shadow.appendChild(btn);
      document.body.appendChild(host);

      const kit = makePillLauncher({
        label: 'Test',
        avatarUrl: 'https://x.com/img.png',
        primaryColor: '#f00',
      });
      await kit.apply();

      const style = shadow.getElementById('gengage-pill-launcher-style') as HTMLStyleElement;
      // defaults: desktopWidth=188px, desktopHeight=60px, iconSize=46px
      expect(style.textContent).toContain('188px');
      expect(style.textContent).toContain('60px');
      expect(style.textContent).toContain('46px');
    });
  });
});

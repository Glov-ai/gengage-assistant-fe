import { describe, it, expect } from 'vitest';
import {
  createAccountIdentity,
  createFloatingChatConfig,
  createPdpQnaConfig,
  createPdpSimRelConfig,
  createDefaultAnalyticsConfig,
  DEFAULT_CUSTOMIZATION_LOCALE,
} from '../src/common/customization-factories.js';

describe('customization-factories', () => {
  const baseInput = {
    accountId: 'test-account',
    middlewareUrl: 'https://example.com',
    sessionId: 'sess-123',
  };

  describe('createAccountIdentity', () => {
    it('maps fields and defaults locale to Turkish', () => {
      const identity = createAccountIdentity({
        accountId: 'acme',
        middlewareUrl: 'https://acme.com',
      });

      expect(identity.ACCOUNT_ID).toBe('acme');
      expect(identity.MIDDLEWARE_URL).toBe('https://acme.com');
      expect(identity.LOCALE).toBe(DEFAULT_CUSTOMIZATION_LOCALE);
    });

    it('respects explicit locale', () => {
      const identity = createAccountIdentity({
        accountId: 'acme',
        middlewareUrl: 'https://acme.com',
        locale: 'en',
      });

      expect(identity.LOCALE).toBe('en');
    });
  });

  describe('createFloatingChatConfig', () => {
    it('creates config with required fields', () => {
      const config = createFloatingChatConfig(baseInput);

      expect(config.accountId).toBe('test-account');
      expect(config.middlewareUrl).toBe('https://example.com');
      expect(config.session).toEqual({ sessionId: 'sess-123' });
      expect(config.variant).toBe('floating');
      expect(config.locale).toBe(DEFAULT_CUSTOMIZATION_LOCALE);
    });

    it('applies theme when provided', () => {
      const theme = { primaryColor: '#ff0000' };
      const config = createFloatingChatConfig({ ...baseInput, theme });

      expect(config.theme).toEqual(theme);
    });

    it('does not set theme when not provided', () => {
      const config = createFloatingChatConfig(baseInput);

      expect(config.theme).toBeUndefined();
    });

    it('applies overrides', () => {
      const config = createFloatingChatConfig(baseInput, {
        voiceEnabled: true,
      });

      expect(config.voiceEnabled).toBe(true);
    });

    it('respects explicit locale', () => {
      const config = createFloatingChatConfig({
        ...baseInput,
        locale: 'en',
      });

      expect(config.locale).toBe('en');
    });
  });

  describe('createPdpQnaConfig', () => {
    const mountTarget = document.createElement('div');

    it('creates config with sku and mount target', () => {
      const config = createPdpQnaConfig({
        ...baseInput,
        sku: 'SKU-1',
        mountTarget,
      });

      expect(config.accountId).toBe('test-account');
      expect(config.pageContext).toEqual({ pageType: 'pdp', sku: 'SKU-1' });
      expect(config.mountTarget).toBe(mountTarget);
    });

    it('applies theme when provided', () => {
      const theme = { primaryColor: '#00ff00' };
      const config = createPdpQnaConfig({
        ...baseInput,
        sku: 'SKU-1',
        mountTarget,
        theme,
      });

      expect(config.theme).toEqual(theme);
    });

    it('applies overrides', () => {
      const config = createPdpQnaConfig({ ...baseInput, sku: 'SKU-1', mountTarget }, { ctaText: 'Ask a question' });

      expect(config.ctaText).toBe('Ask a question');
    });
  });

  describe('createPdpSimRelConfig', () => {
    const mountTarget = document.createElement('div');

    it('creates config with sku and mount target', () => {
      const config = createPdpSimRelConfig({
        ...baseInput,
        sku: 'SKU-2',
        mountTarget,
      });

      expect(config.accountId).toBe('test-account');
      expect(config.sku).toBe('SKU-2');
      expect(config.mountTarget).toBe(mountTarget);
    });

    it('applies theme when provided', () => {
      const theme = { primaryColor: '#0000ff' };
      const config = createPdpSimRelConfig({
        ...baseInput,
        sku: 'SKU-2',
        mountTarget,
        theme,
      });

      expect(config.theme).toEqual(theme);
    });

    it('applies overrides', () => {
      const config = createPdpSimRelConfig({ ...baseInput, sku: 'SKU-2', mountTarget }, { discountType: 'badge' });

      expect(config.discountType).toBe('badge');
    });
  });

  describe('createDefaultAnalyticsConfig', () => {
    it('creates config with sensible defaults', () => {
      const config = createDefaultAnalyticsConfig('https://example.com');

      expect(config.enabled).toBe(true);
      expect(config.middlewareUrl).toBe('https://example.com');
      expect(config.endpoint).toBe('/analytics');
      expect(config.fireAndForget).toBe(true);
      expect(config.useBeacon).toBe(true);
    });

    it('applies overrides while keeping middlewareUrl', () => {
      const config = createDefaultAnalyticsConfig('https://example.com', {
        enabled: false,
        endpoint: '/custom-analytics',
      });

      expect(config.enabled).toBe(false);
      expect(config.endpoint).toBe('/custom-analytics');
      expect(config.middlewareUrl).toBe('https://example.com');
    });
  });
});

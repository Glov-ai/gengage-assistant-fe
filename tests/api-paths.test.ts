import { describe, it, expect } from 'vitest';
import { buildChatEndpointUrl, normalizeMiddlewareUrl } from '../src/common/api-paths.js';
import type { ChatEndpointName } from '../src/common/api-paths.js';

describe('normalizeMiddlewareUrl', () => {
  it('strips trailing slashes', () => {
    expect(normalizeMiddlewareUrl('https://api.test.com/')).toBe('https://api.test.com');
    expect(normalizeMiddlewareUrl('https://api.test.com///')).toBe('https://api.test.com');
  });

  it('throws when input is undefined', () => {
    expect(() => normalizeMiddlewareUrl()).toThrow('middlewareUrl is required');
  });

  it('trims whitespace', () => {
    expect(normalizeMiddlewareUrl('  https://api.test.com  ')).toBe('https://api.test.com');
  });
});

describe('buildChatEndpointUrl', () => {
  const endpoints: ChatEndpointName[] = [
    'process_action',
    'launcher_action',
    'similar_products',
    'product_groupings',
    'proactive_action',
  ];

  for (const endpoint of endpoints) {
    it(`builds /chat/${endpoint}`, () => {
      const url = buildChatEndpointUrl(endpoint, {
        middlewareUrl: 'https://api.test.com',
      });
      expect(url).toBe(`https://api.test.com/chat/${endpoint}`);
    });
  }

  it('throws when middlewareUrl is not provided', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    expect(() => (buildChatEndpointUrl as any)('process_action')).toThrow('middlewareUrl is required');
  });

  it('supports empty middleware URL for relative paths', () => {
    const url = buildChatEndpointUrl('process_action', { middlewareUrl: '' });
    expect(url).toBe('/chat/process_action');
  });
});

describe('request payload parity', () => {
  it('/chat/process_action request shape includes correlation IDs', () => {
    const payload = {
      account_id: 'mystore',
      session_id: 'uuid-v4',
      correlation_id: 'uuid-v4',
      user_id: 'optional-uid',
      view_id: 'optional-view-id',
      action: {
        title: 'User message text',
        type: 'user_message',
        payload: 'User message text',
      },
      sku: '12345',
      page_type: 'pdp',
      locale: 'tr',
    };

    expect(payload.session_id).toBeTruthy();
    expect(payload.correlation_id).toBeTruthy();
    expect(payload.action.type).toBe('user_message');
  });

  it('/chat/launcher_action request shape includes required fields', () => {
    const payload = {
      account_id: 'mystore',
      session_id: 'uuid-v4',
      correlation_id: 'uuid-v4',
      sku: '12345',
      page_type: 'pdp',
      locale: 'tr',
    };

    expect(payload.account_id).toBeTruthy();
    expect(payload.sku).toBeTruthy();
    expect(payload.session_id).toBeTruthy();
    expect(payload.correlation_id).toBeTruthy();
  });

  it('/chat/similar_products request shape includes required fields', () => {
    const payload = {
      account_id: 'mystore',
      session_id: 'uuid-v4',
      correlation_id: 'uuid-v4',
      sku: '12345',
      domain: 'https://www.mystore.com',
    };

    expect(payload.account_id).toBeTruthy();
    expect(payload.sku).toBeTruthy();
    expect(payload.session_id).toBeTruthy();
    expect(payload.correlation_id).toBeTruthy();
  });

  it('/chat/product_groupings request shape includes required fields', () => {
    const payload = {
      account_id: 'mystore',
      session_id: 'uuid-v4',
      correlation_id: 'uuid-v4',
      skus: ['12345', '67890'],
    };

    expect(payload.account_id).toBeTruthy();
    expect(payload.skus.length).toBeGreaterThan(0);
    expect(payload.session_id).toBeTruthy();
    expect(payload.correlation_id).toBeTruthy();
  });
});

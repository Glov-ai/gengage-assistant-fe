import { describe, it, expect, vi } from 'vitest';
import { ChatDrawer } from '../src/chat/components/ChatDrawer.js';
import { CHAT_I18N_EN } from '../src/chat/locales/en.js';

function createDrawer() {
  const container = document.createElement('div');
  return new ChatDrawer(container, {
    i18n: CHAT_I18N_EN,
    onSend: vi.fn(),
    onClose: vi.fn(),
  });
}

describe('Panel patching (Item 11)', () => {
  it('getPanelContentElement returns null when panel is empty', () => {
    const drawer = createDrawer();
    expect(drawer.getPanelContentElement()).toBeNull();
  });

  it('getPanelContentElement returns content element after setPanelContent', () => {
    const drawer = createDrawer();
    const content = document.createElement('div');
    content.className = 'test-panel-content';
    content.textContent = 'Product Details';
    drawer.setPanelContent(content);

    const result = drawer.getPanelContentElement();
    expect(result).not.toBeNull();
    expect(result!.className).toBe('test-panel-content');
  });

  it('appendPanelContent adds to panel without replacing existing content', () => {
    const drawer = createDrawer();

    // Set initial panel content
    const initial = document.createElement('div');
    initial.className = 'initial-content';
    initial.textContent = 'Product Details';
    drawer.setPanelContent(initial);

    // Append similar products
    const similars = document.createElement('div');
    similars.className = 'gengage-chat-product-details-similars';
    similars.textContent = 'Similar Products';
    drawer.appendPanelContent(similars);

    // Both should exist in the panel
    const el = drawer.getElement();
    expect(el.querySelector('.initial-content')).not.toBeNull();
    expect(el.querySelector('.gengage-chat-product-details-similars')).not.toBeNull();
  });

  it('similarsAppend flag is set in productDetailsSimilars adapter output', async () => {
    // This is tested in v1-adapter.test.ts, but verify the flag value
    const { adaptV1Event } = await import('../src/common/v1-protocol-adapter.js');
    const result = adaptV1Event({
      type: 'productDetailsSimilars',
      payload: {
        similarProducts: [{ sku: 'S1', name: 'Similar', price: 50, url: 'https://example.com' }],
      },
    })!;
    const uiSpec = result as { spec: { root: string; elements: Record<string, { props?: Record<string, unknown> }> } };
    const root = uiSpec.spec.elements[uiSpec.spec.root]!;
    expect(root.props?.['similarsAppend']).toBe(true);
  });
});

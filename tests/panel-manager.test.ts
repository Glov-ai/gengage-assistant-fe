import { describe, expect, it } from 'vitest';
import { PanelManager } from '../src/chat/panel-manager.js';
import { CHAT_I18N_TR } from '../src/chat/locales/index.js';

function createPanelManager(): PanelManager {
  return new PanelManager({
    drawer: () => null,
    shadow: () => null,
    currentThreadId: () => null,
    bridge: () => null,
    extendedModeManager: () => null,
    i18n: () => CHAT_I18N_TR,
    rollbackToThread: () => {},
  });
}

describe('PanelManager', () => {
  it('treats user text actions as search-result grids', () => {
    const panel = createPanelManager();

    panel.lastActionType = 'user_message';
    expect(panel.titleForComponent('ProductGrid')).toBe(CHAT_I18N_TR.panelTitleSearchResults);

    panel.lastActionType = 'inputText';
    expect(panel.titleForComponent('ProductGrid')).toBe(CHAT_I18N_TR.panelTitleSearchResults);
  });

  it('keeps similar-products title for explicit similar flows', () => {
    const panel = createPanelManager();
    panel.lastActionType = 'findSimilar';

    expect(panel.titleForComponent('ProductGrid')).toBe(CHAT_I18N_TR.panelTitleSimilarProducts);
  });
});

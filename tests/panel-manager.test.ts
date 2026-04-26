import { describe, expect, it } from 'vitest';
import { PanelManager } from '../src/chat/panel-manager.js';
import { ExtendedModeManager } from '../src/chat/extendedModeManager.js';
import { CHAT_I18N_TR } from '../src/chat/locales/index.js';

function createPanelManager(overrides: Partial<ConstructorParameters<typeof PanelManager>[0]> = {}): PanelManager {
  return new PanelManager({
    drawer: () => null,
    shadow: () => null,
    currentThreadId: () => null,
    bridge: () => null,
    extendedModeManager: () => null,
    i18n: () => CHAT_I18N_TR,
    rollbackToThread: () => {},
    ...overrides,
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

  it('treats CategoriesContainer as category panel content', () => {
    const changes: boolean[] = [];
    const extended = new ExtendedModeManager({ onChange: (extendedState) => changes.push(extendedState) });
    const panel = createPanelManager({ extendedModeManager: () => extended });

    expect(panel.titleForComponent('CategoriesContainer')).toBe(CHAT_I18N_TR.panelTitleCategories);

    extended.unlock();
    extended.setChatShown(true);
    panel.updateExtendedMode('CategoriesContainer');

    expect(changes).toEqual([true]);
  });
});

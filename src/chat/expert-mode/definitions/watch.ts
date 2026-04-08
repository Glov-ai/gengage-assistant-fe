import type { ExpertModeDefinition } from '../types.js';

export const WATCH_EXPERT_DEFINITION: ExpertModeDefinition = {
  modeId: 'watch_expert',
  contextPanelKey: 'watch_expert_state',
  sourceName: 'watch_expert',
  initEndpoint: '/chat/watch_expert_init',
  handoffLoadingText: 'Saat uzmanimiz ihtiyaciniza gore yonlendirmeyi hazirliyor.',
  headerTitle: 'Saat Uzmani',
  fallbackPrompt: () => 'Nasil bir saat aradiginizi biraz daha acar misiniz?',
  artifactPolicy: {
    blockShoppingPills: true,
    blockShoppingInputChips: true,
    blockShoppingThinkingSteps: false,
    blockShoppingPanelLoading: true,
  },
};

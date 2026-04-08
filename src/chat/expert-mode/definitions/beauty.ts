import type { ExpertModeDefinition } from '../types.js';

export const BEAUTY_EXPERT_DEFINITION: ExpertModeDefinition = {
  modeId: 'beauty_consulting',
  contextPanelKey: 'redirected_agent_state',
  sourceName: 'beauty_consulting',
  initEndpoint: '/chat/beauty_consulting_init',
  handoffLoadingText: 'Sizi Guzellik Danismanimiza aktariyorum.',
  headerTitle: 'Guzellik Danismani',
  fallbackPrompt: () => 'Nasil bir urun ya da gorunum aradiginizi biraz daha acar misiniz?',
  artifactPolicy: {
    blockShoppingPills: true,
    blockShoppingInputChips: true,
    blockShoppingThinkingSteps: false,
    blockShoppingPanelLoading: true,
  },
};

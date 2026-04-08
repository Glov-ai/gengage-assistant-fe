import { describe, it, expect } from 'vitest';
import { createDefaultExpertModeController } from '../src/chat/expert-mode/controller.js';

describe('ExpertModeController', () => {
  it('syncs beauty mode state from redirected_agent_state panel payload', () => {
    const controller = createDefaultExpertModeController();
    controller.enterSession({
      modeId: 'beauty_consulting',
      threadId: 'expert-thread',
      previousThreadId: 'shopping-thread',
      fields: {},
      missingFields: [],
      source: 'chat_intent',
    });

    const synced = controller.syncFromPanel({
      assistant_mode: 'beauty_consulting',
      redirected_agent_state: {
        scenario: 'routine_builder',
        status: 'collecting',
        handoff_summary: 'Birlikte hazirlayalim.',
        transfer_text: 'Yaza uygun bir makyaj istiyorum',
        fields: {
          goal_summary: 'Yaza uygun dogal gorunum',
        },
        missing_fields: ['clarifying_detail'],
        source: 'chat_intent',
        ready_for_grouping: false,
      },
    });

    expect(synced?.scenario).toBe('routine_builder');
    expect(synced?.status).toBe('collecting');
    expect(synced?.transferText).toBe('Yaza uygun bir makyaj istiyorum');
    expect(synced?.fields).toEqual({ goal_summary: 'Yaza uygun dogal gorunum' });
    expect(synced?.missingFields).toEqual(['clarifying_detail']);
    expect(synced?.extra).toMatchObject({ ready_for_grouping: false });
  });

  it('ignores panel sync when assistant mode does not match active expert mode', () => {
    const controller = createDefaultExpertModeController();
    controller.enterSession({
      modeId: 'beauty_consulting',
      threadId: 'expert-thread',
      previousThreadId: 'shopping-thread',
      fields: {},
      missingFields: [],
    });

    const synced = controller.syncFromPanel({
      assistant_mode: 'shopping',
      redirected_agent_state: {
        fields: { goal_summary: 'ignored' },
      },
    });

    expect(synced).toBeNull();
    expect(controller.getActiveSession()?.fields).toEqual({});
  });
});

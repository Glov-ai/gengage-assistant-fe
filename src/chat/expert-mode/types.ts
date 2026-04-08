export type ExpertModeId = 'beauty_consulting' | 'watch_expert';

export interface ExpertArtifactPolicy {
  blockShoppingPills: boolean;
  blockShoppingInputChips: boolean;
  blockShoppingThinkingSteps: boolean;
  blockShoppingPanelLoading: boolean;
}

export interface ExpertModeDefinition {
  modeId: ExpertModeId;
  contextPanelKey: string;
  sourceName: string;
  initEndpoint?: string | undefined;
  handoffLoadingText: string;
  headerTitle: string;
  fallbackPrompt: (missingFields: string[]) => string;
  artifactPolicy: ExpertArtifactPolicy;
}

export interface ExpertModeSessionState {
  modeId: ExpertModeId;
  threadId: string | null;
  previousThreadId: string | null;
  scenario?: string | null | undefined;
  status?: string | null | undefined;
  handoffSummary?: string | null | undefined;
  transferText?: string | null | undefined;
  fields: Record<string, unknown>;
  missingFields: string[];
  source?: string | null | undefined;
  extra?: Record<string, unknown> | undefined;
}

export interface PersistedExpertModeState {
  activeSession: ExpertModeSessionState | null;
}

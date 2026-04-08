import { BEAUTY_EXPERT_DEFINITION } from './definitions/beauty.js';
import { WATCH_EXPERT_DEFINITION } from './definitions/watch.js';
import type {
  ExpertModeDefinition,
  ExpertModeId,
  ExpertModeSessionState,
  PersistedExpertModeState,
} from './types.js';

const KNOWN_STATE_KEYS = new Set([
  'scenario',
  'status',
  'handoff_summary',
  'transfer_text',
  'fields',
  'missing_fields',
  'source',
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asStringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function cloneSession(session: ExpertModeSessionState | null): ExpertModeSessionState | null {
  if (!session) return null;
  return {
    ...session,
    fields: { ...session.fields },
    missingFields: [...session.missingFields],
    ...(session.extra ? { extra: { ...session.extra } } : {}),
  };
}

function normalizePersistedSession(value: unknown): ExpertModeSessionState | null {
  const record = asRecord(value);
  if (!record) return null;
  const modeId = asStringOrNull(record['modeId']);
  if (modeId !== 'beauty_consulting' && modeId !== 'watch_expert') return null;
  const fields = asRecord(record['fields']) ?? {};
  const extra = asRecord(record['extra']) ?? undefined;
  return {
    modeId,
    threadId: asStringOrNull(record['threadId']),
    previousThreadId: asStringOrNull(record['previousThreadId']),
    scenario: asStringOrNull(record['scenario']),
    status: asStringOrNull(record['status']),
    handoffSummary: asStringOrNull(record['handoffSummary']),
    transferText: asStringOrNull(record['transferText']),
    fields: { ...fields },
    missingFields: asStringArray(record['missingFields']),
    source: asStringOrNull(record['source']),
    ...(extra ? { extra: { ...extra } } : {}),
  };
}

export class ExpertModeController {
  private readonly _definitions = new Map<ExpertModeId, ExpertModeDefinition>();
  private _activeSession: ExpertModeSessionState | null = null;

  constructor(definitions: ExpertModeDefinition[]) {
    for (const definition of definitions) {
      this._definitions.set(definition.modeId, definition);
    }
  }

  getDefinitions(): ExpertModeDefinition[] {
    return [...this._definitions.values()];
  }

  getDefinition(modeId: ExpertModeId): ExpertModeDefinition | null {
    return this._definitions.get(modeId) ?? null;
  }

  getActiveSession(): ExpertModeSessionState | null {
    return cloneSession(this._activeSession);
  }

  getActiveDefinition(): ExpertModeDefinition | null {
    if (!this._activeSession) return null;
    return this.getDefinition(this._activeSession.modeId);
  }

  getActiveModeId(): ExpertModeId | null {
    return this._activeSession?.modeId ?? null;
  }

  isActive(): boolean {
    return this._activeSession !== null;
  }

  getAssistantModeMeta(): ExpertModeId | undefined {
    if (!this._activeSession?.threadId) return undefined;
    return this._activeSession.modeId;
  }

  getVisibleThreadId(): string | null {
    return this._activeSession?.threadId ?? null;
  }

  getActiveArtifactPolicy(): ExpertModeDefinition['artifactPolicy'] | null {
    return this.getActiveDefinition()?.artifactPolicy ?? null;
  }

  enterSession(session: ExpertModeSessionState): ExpertModeSessionState {
    this._activeSession = cloneSession(session);
    return this.getActiveSession()!;
  }

  updateActiveSession(
    patch:
      | Partial<ExpertModeSessionState>
      | ((current: ExpertModeSessionState) => Partial<ExpertModeSessionState> | null | undefined),
  ): ExpertModeSessionState | null {
    if (!this._activeSession) return null;
    const current = cloneSession(this._activeSession)!;
    const resolvedPatch = typeof patch === 'function' ? patch(current) : patch;
    if (!resolvedPatch) return this.getActiveSession();
    const next: ExpertModeSessionState = {
      ...current,
      ...resolvedPatch,
      fields:
        resolvedPatch.fields !== undefined
          ? { ...resolvedPatch.fields }
          : { ...current.fields },
      missingFields:
        resolvedPatch.missingFields !== undefined
          ? [...resolvedPatch.missingFields]
          : [...current.missingFields],
      extra:
        resolvedPatch.extra !== undefined
          ? { ...resolvedPatch.extra }
          : current.extra
            ? { ...current.extra }
            : undefined,
    };
    this._activeSession = next;
    return this.getActiveSession();
  }

  exitSession(): ExpertModeSessionState | null {
    const previous = this.getActiveSession();
    this._activeSession = null;
    return previous;
  }

  reset(): void {
    this._activeSession = null;
  }

  serialize(): PersistedExpertModeState {
    return {
      activeSession: this.getActiveSession(),
    };
  }

  hydrate(state: PersistedExpertModeState | null | undefined): ExpertModeSessionState | null {
    const session = normalizePersistedSession(state?.activeSession ?? null);
    this._activeSession = session;
    return this.getActiveSession();
  }

  syncFromPanel(panel: Record<string, unknown>): ExpertModeSessionState | null {
    const active = this._activeSession;
    if (!active) return null;

    const assistantMode = asStringOrNull(panel['assistant_mode']);
    if (assistantMode !== active.modeId) return null;

    const definition = this.getDefinition(active.modeId);
    if (!definition) return null;

    const rawState = asRecord(panel[definition.contextPanelKey]);
    if (!rawState) return null;

    const fields = asRecord(rawState['fields']) ?? active.fields;
    const extraEntries = Object.entries(rawState).filter(([key]) => !KNOWN_STATE_KEYS.has(key));

    const next: ExpertModeSessionState = {
      ...active,
      scenario: asStringOrNull(rawState['scenario']) ?? active.scenario ?? null,
      status: asStringOrNull(rawState['status']) ?? active.status ?? null,
      handoffSummary: asStringOrNull(rawState['handoff_summary']) ?? active.handoffSummary ?? null,
      transferText: asStringOrNull(rawState['transfer_text']) ?? active.transferText ?? null,
      fields: { ...fields },
      missingFields: asStringArray(rawState['missing_fields']),
      source: asStringOrNull(rawState['source']) ?? active.source ?? null,
      extra:
        extraEntries.length > 0
          ? Object.fromEntries(extraEntries)
          : active.extra
            ? { ...active.extra }
            : undefined,
    };
    this._activeSession = next;
    return this.getActiveSession();
  }
}

export function createDefaultExpertModeController(): ExpertModeController {
  return new ExpertModeController([BEAUTY_EXPERT_DEFINITION, WATCH_EXPERT_DEFINITION]);
}

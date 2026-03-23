/**
 * Centralized chat presentation state (focus thread, scroll requests, read hints).
 * Purpose-aligned with the legacy Redux presentation slice, without Redux.
 */

export type GroupReadState = 'seen' | 'unseen' | 'active_unread' | 'overflow_unread';

export type PresentationGroupMeta = {
  id: string;
  threadId: string;
  readState: GroupReadState;
  status: 'streaming' | 'complete';
  updatedAt: number;
};

export type ScrollRequest = {
  id: number;
  type: 'thread' | 'bottom';
  behavior: ScrollBehavior;
  threadId?: string;
};

const assistantGroupId = (threadId: string) => `${threadId}:assistant`;

export class ChatPresentationState {
  /** Per-assistant-thread read / streaming metadata */
  groups: Record<string, PresentationGroupMeta> = {};
  pinnedToBottom = true;
  userInteracting = false;
  /** When set, transcript UI may collapse other threads until released */
  focusedThreadId: string | null = null;
  /** Drawer / widget considered visible */
  shown = false;
  lastAutoAnchoredGroupId: string | null = null;
  scrollRequest: ScrollRequest | null = null;
  private _nextScrollId = 1;

  setShown(shown: boolean): void {
    this.shown = shown;
    if (!shown) {
      this.userInteracting = false;
      this.pinnedToBottom = true;
      this.focusedThreadId = null;
      this.scrollRequest = null;
    }
  }

  reset(): void {
    this.groups = {};
    this.pinnedToBottom = true;
    this.userInteracting = false;
    this.focusedThreadId = null;
    this.lastAutoAnchoredGroupId = null;
    this.scrollRequest = null;
  }

  registerAssistantActivity(threadId: string): void {
    const id = assistantGroupId(threadId);
    const existing = this.groups[id];
    const nextRead: GroupReadState =
      this.shown && this.pinnedToBottom && !this.userInteracting ? 'active_unread' : 'unseen';

    this.groups[id] = {
      id,
      threadId,
      readState: existing?.readState === 'seen' ? nextRead : existing?.readState ?? nextRead,
      status: 'streaming',
      updatedAt: Date.now(),
    };
    if (existing?.readState === 'seen' && this.lastAutoAnchoredGroupId === id) {
      this.lastAutoAnchoredGroupId = null;
    }
  }

  finalizeAssistantGroup(threadId: string): void {
    const id = assistantGroupId(threadId);
    const existing = this.groups[id];
    if (!existing) return;
    existing.status = 'complete';
    existing.updatedAt = Date.now();
  }

  setGroupReadStates(updates: Array<{ groupId: string; readState: GroupReadState }>): void {
    const t = Date.now();
    for (const { groupId, readState } of updates) {
      const g = this.groups[groupId];
      if (!g || g.readState === readState) continue;
      g.readState = readState;
      g.updatedAt = t;
    }
  }

  requestThreadFocus(threadId: string, behavior: ScrollBehavior = 'smooth'): void {
    this.focusedThreadId = threadId;
    this.scrollRequest = {
      id: this._nextScrollId++,
      type: 'thread',
      threadId,
      behavior,
    };
  }

  requestScrollToBottom(behavior: ScrollBehavior = 'smooth'): void {
    this.scrollRequest = {
      id: this._nextScrollId++,
      type: 'bottom',
      behavior,
    };
  }

  consumeScrollRequest(id: number): void {
    if (this.scrollRequest?.id === id) {
      this.scrollRequest = null;
    }
  }

  releaseFocusedThread(): void {
    this.focusedThreadId = null;
  }

  /** Align focus with rollback / thread without queuing scroll */
  setFocusedThreadId(threadId: string | null): void {
    this.focusedThreadId = threadId;
  }

  markGroupAutoAnchored(groupId: string): void {
    this.lastAutoAnchoredGroupId = groupId;
  }

  /** Block soft stream scroll when user pulled away from bottom */
  shouldBlockStreamAutoScroll(): boolean {
    return this.shown && this.userInteracting && !this.pinnedToBottom;
  }

  getAssistantReadState(threadId: string): GroupReadState | undefined {
    return this.groups[assistantGroupId(threadId)]?.readState;
  }
}

/**
 * Latest assistant “group” with unread semantics (for auto-anchor).
 */
export function getLatestUnreadAssistantThreadId(
  orderedThreadIds: string[],
  state: ChatPresentationState,
): string | null {
  for (let i = orderedThreadIds.length - 1; i >= 0; i--) {
    const tid = orderedThreadIds[i]!;
    const rs = state.getAssistantReadState(tid);
    if (rs !== undefined && rs !== 'seen') {
      return tid;
    }
  }
  return null;
}

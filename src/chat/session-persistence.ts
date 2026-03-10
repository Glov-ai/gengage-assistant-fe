/**
 * SessionPersistence — IndexedDB persistence helpers for the chat widget.
 *
 * Encapsulates session save/load, payload caching, favorite toggling,
 * and URL navigation with pre-save.
 *
 * Extracted from chat/index.ts to improve cohesion and reduce file size.
 */

import type { GengageIndexedDB, FavoriteData } from '../common/indexed-db.js';
import type { CommunicationBridge } from '../common/communication-bridge.js';
import { isSafeUrl } from '../common/safe-html.js';
import type { BackendContext, UISpec } from '../common/types.js';
import type { ChatMessage, SerializableChatMessage } from './types.js';
import type { ThumbnailEntry } from './components/ThumbnailsColumn.js';

export type { FavoriteData };

export interface PersistSessionParams {
  userId: string;
  appId: string;
  sessionId: string;
  messages: ChatMessage[];
  currentThreadId: string | null;
  lastThreadId: string | null;
  chatCreatedAt: string;
  panelSnapshots: Map<string, HTMLElement>;
  panelThreads: string[];
  thumbnailEntries: ThumbnailEntry[];
  lastBackendContext: BackendContext | null;
  sku?: string | undefined;
}

export class SessionPersistence {
  private _db: GengageIndexedDB | null;
  /** Favorited product SKUs (loaded from IDB). */
  readonly favoritedSkus: Set<string> = new Set();
  /** Full favorite data cache (loaded from IDB alongside favoritedSkus). */
  private _favoritesCache: Map<string, FavoriteData> = new Map();
  /** Async mutex: serializes persist() calls to prevent interleaved IDB writes. */
  private _persistLock: Promise<void> = Promise.resolve();

  constructor(db: GengageIndexedDB | null) {
    this._db = db;
  }

  get db(): GengageIndexedDB | null {
    return this._db;
  }

  set db(value: GengageIndexedDB | null) {
    this._db = value;
  }

  /**
   * Persist current session state to IndexedDB.
   * Called after each stream completion (onDone). Non-fatal on failure.
   */
  async persist(params: PersistSessionParams): Promise<void> {
    if (!this._db) return;
    // Serialize through mutex to prevent interleaved IDB writes
    const prev = this._persistLock;
    let unlock: () => void;
    this._persistLock = new Promise<void>((r) => {
      unlock = r;
    });
    await prev;
    try {
      await this._persistImpl(params);
    } finally {
      unlock!();
    }
  }

  private async _persistImpl(params: PersistSessionParams): Promise<void> {
    if (!this._db) return;

    const serializableMessages: SerializableChatMessage[] = params.messages.map((m) => {
      const sm: SerializableChatMessage = {
        id: m.id,
        role: m.role,
        timestamp: m.timestamp,
        status: m.status === 'streaming' ? 'done' : m.status,
      };
      if (m.threadId !== undefined) sm.threadId = m.threadId;
      if (m.content !== undefined) sm.content = m.content;
      if (m.silent) sm.silent = true;
      return sm;
    });

    // Serialize panel snapshots to HTML strings (never persist loading skeletons)
    const panelSnapshotHtml: Record<string, string> = {};
    for (const [msgId, el] of params.panelSnapshots) {
      if (el.querySelector('.gengage-chat-panel-skeleton')) continue;
      panelSnapshotHtml[msgId] = el.innerHTML;
    }

    await this._db.saveSession({
      userId: params.userId,
      appId: params.appId,
      sessionId: params.sessionId,
      messages: serializableMessages,
      currentThreadId: params.currentThreadId,
      lastThreadId: params.lastThreadId,
      createdAt: params.chatCreatedAt,
      panelThreads: params.panelThreads.length > 0 ? params.panelThreads : undefined,
      thumbnailEntries: params.thumbnailEntries.length > 0 ? params.thumbnailEntries : undefined,
      panelSnapshotHtml: Object.keys(panelSnapshotHtml).length > 0 ? panelSnapshotHtml : undefined,
      sku: params.sku,
    });

    // Save latest context snapshot for current thread
    if (params.lastBackendContext && params.currentThreadId) {
      await this._db.saveContext({
        sessionId: params.sessionId,
        threadId: params.currentThreadId,
        context: params.lastBackendContext,
      });
    }

    // Save UISpec payloads separately
    // Note: we intentionally do NOT delete m.uiSpec from the caller's live objects.
    // The caller's message array must remain intact for re-rendering and snapshot logic.
    for (const m of params.messages) {
      if (m.uiSpec && m.threadId) {
        await this._db.savePayload({
          threadId: m.threadId,
          messageId: m.id,
          uiSpec: m.uiSpec,
        });
      }
    }
  }

  /**
   * Persist session to IndexedDB, then navigate to the URL.
   * Sends an 'openURLInNewTab' bridge message so the host page can intercept
   * (e.g. for SPA routing), then navigates directly as fallback.
   *
   * Legacy compatibility: the prior engine navigated via window.location.href
   * after posting saveSessionAndOpenURL to the iframe. The clean-room runs in
   * the same window (Shadow DOM, not iframe), so it navigates directly.
   */
  async saveAndOpenURL(url: string, persistFn: () => Promise<void>, bridge: CommunicationBridge | null): Promise<void> {
    try {
      await persistFn();
    } catch {
      // Non-fatal — still navigate
    }
    // Notify host so SPAs can intercept (e.g. router.push instead of full reload).
    // NOTE: The bridge message is fire-and-forget. The subsequent location.href
    // assignment may trigger a page unload before the host processes the message.
    // This matches legacy behavior. SPAs that need to intercept
    // should handle the bridge event synchronously or call event.preventDefault()
    // on the gengage:navigate CustomEvent to suppress the fallback navigation.
    bridge?.send('openURLInNewTab', { url });
    if (isSafeUrl(url)) {
      window.location.href = url;
    }
  }

  /**
   * Load a UISpec payload from IndexedDB with retry logic.
   * Returns null if not found or all retries fail.
   */
  async loadPayload(threadId: string, messageId: string): Promise<UISpec | null> {
    if (!this._db) return null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const payload = await this._db.loadPayload(threadId, messageId);
        if (payload) return payload.uiSpec;
      } catch {
        // Retry after delay
      }
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    return null;
  }

  /**
   * Load favorited SKUs from IDB into the in-memory set.
   */
  async loadFavorites(userId: string, appId: string): Promise<void> {
    if (!this._db) return;
    try {
      const favs = await this._db.loadFavorites(userId, appId);
      for (const f of favs) {
        this.favoritedSkus.add(f.sku);
        this._favoritesCache.set(f.sku, f);
      }
    } catch {
      // Non-fatal — continue without favorites
    }
  }

  /** Returns favorited products ordered newest-first. */
  getFavoriteProducts(): FavoriteData[] {
    return [...this._favoritesCache.values()].sort((a, b) => {
      return (b.savedAt ?? '').localeCompare(a.savedAt ?? '');
    });
  }

  /**
   * Toggle a product's favorited state in IDB and in-memory set.
   */
  async toggleFavorite(userId: string, appId: string, sku: string, product: Record<string, unknown>): Promise<void> {
    // Always update in-memory state first — IDB is optional (persistence only)
    if (this.favoritedSkus.has(sku)) {
      this.favoritedSkus.delete(sku);
      this._favoritesCache.delete(sku);
      if (this._db) await this._db.removeFavorite(userId, appId, sku);
    } else {
      const data: FavoriteData = {
        userId,
        appId,
        sku,
        name: product['name'] as string | undefined,
        imageUrl: product['imageUrl'] as string | undefined,
        price: product['price'] as string | undefined,
        savedAt: new Date().toISOString(),
      };
      this.favoritedSkus.add(sku);
      this._favoritesCache.set(sku, data);
      if (this._db) await this._db.saveFavorite(data);
    }
  }

  close(): void {
    this._db?.close();
    this._db = null;
  }
}

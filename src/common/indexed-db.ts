/**
 * IndexedDB persistence for chat sessions, backend context, and message payloads.
 *
 * Three stores:
 *   - `sessions`  — full session state (messages, thread cursors, timestamps)
 *   - `context`   — per-thread backend context snapshots (compound key)
 *   - `payload`   — message UISpec payloads (lean message pattern)
 *
 * All operations are best-effort: IndexedDB unavailability is non-fatal.
 */

import type { SerializableChatMessage } from '../chat/types.js';
import type { PersistedExpertModeState } from '../chat/expert-mode/types.js';
import type { UISpec } from './types.js';

// ---------------------------------------------------------------------------
// Data shapes stored in each object store
// ---------------------------------------------------------------------------

export interface SessionData {
  userId: string;
  appId: string;
  sessionId: string;
  messages: SerializableChatMessage[];
  currentThreadId: string | null;
  lastThreadId: string | null;
  createdAt: string;
  /** Thread IDs that produced panel content, in creation order. */
  panelThreads?: string[] | undefined;
  /** Product thumbnails for ThumbnailsColumn. */
  thumbnailEntries?: Array<{ sku: string; imageUrl: string; threadId: string }> | undefined;
  /** Serialized panel HTML keyed by bot message ID (for panel snapshot restore). */
  panelSnapshotHtml?: Record<string, string> | undefined;
  /** SKU active when session was saved — prevents cross-SKU restore. */
  sku?: string | undefined;
  expertModeState?: PersistedExpertModeState | undefined;
}

export interface ContextData {
  sessionId: string;
  threadId: string;
  context: import('./types.js').BackendContext;
}

export interface PayloadData {
  threadId: string;
  messageId: string;
  uiSpec: UISpec;
}

export interface FavoriteData {
  userId: string;
  appId: string;
  sku: string;
  name?: string | undefined;
  imageUrl?: string | undefined;
  price?: string | undefined;
  savedAt: string;
}

// ---------------------------------------------------------------------------
// GengageIndexedDB
// ---------------------------------------------------------------------------

const DB_NAME = 'gengage_assistant';
const DB_VERSION = 3;

const STORE_SESSIONS = 'sessions';
const STORE_CONTEXT = 'context';
const STORE_PAYLOAD = 'payload';
const STORE_FAVORITES = 'favorites';

/**
 * Wrap an IDBRequest in a Promise.
 */
function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Wrap an IDBTransaction completion in a Promise.
 */
function transactionComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new DOMException('Transaction aborted'));
  });
}

export class GengageIndexedDB {
  private _db: IDBDatabase | null = null;
  private _dbName: string;
  private _version: number;

  constructor(dbName: string = DB_NAME, version: number = DB_VERSION) {
    this._dbName = dbName;
    this._version = version;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async open(): Promise<IDBDatabase> {
    if (this._db) return this._db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this._dbName, this._version);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        const oldVersion = (event as IDBVersionChangeEvent).oldVersion;

        if (oldVersion < 1) {
          // Fresh install — create stores with v3 schema directly
          db.createObjectStore(STORE_SESSIONS, { keyPath: ['userId', 'appId', 'sessionId'] });
          db.createObjectStore(STORE_CONTEXT, { keyPath: ['sessionId', 'threadId'] });
          const payloadStore = db.createObjectStore(STORE_PAYLOAD, {
            keyPath: ['threadId', 'messageId'],
          });
          payloadStore.createIndex('threadId', 'threadId', { unique: false });
          db.createObjectStore(STORE_FAVORITES, { keyPath: ['userId', 'appId', 'sku'] });
        }

        if (oldVersion >= 1 && oldVersion < 2) {
          // Upgrade from v1 — drop old stores, recreate with new keys
          if (db.objectStoreNames.contains(STORE_SESSIONS)) db.deleteObjectStore(STORE_SESSIONS);
          if (db.objectStoreNames.contains(STORE_PAYLOAD)) db.deleteObjectStore(STORE_PAYLOAD);
          db.createObjectStore(STORE_SESSIONS, { keyPath: ['userId', 'appId', 'sessionId'] });
          const payloadStore = db.createObjectStore(STORE_PAYLOAD, {
            keyPath: ['threadId', 'messageId'],
          });
          payloadStore.createIndex('threadId', 'threadId', { unique: false });
          // Ensure context store exists (may be absent in early v1 schemas)
          if (!db.objectStoreNames.contains(STORE_CONTEXT)) {
            db.createObjectStore(STORE_CONTEXT, { keyPath: ['sessionId', 'threadId'] });
          }
        }

        if (oldVersion < 3) {
          if (!db.objectStoreNames.contains(STORE_FAVORITES)) {
            db.createObjectStore(STORE_FAVORITES, { keyPath: ['userId', 'appId', 'sku'] });
          }
        }
      };

      request.onsuccess = () => {
        this._db = request.result;
        resolve(this._db);
      };

      request.onerror = () => reject(request.error);
    });
  }

  close(): void {
    this._db?.close();
    this._db = null;
  }

  // -------------------------------------------------------------------------
  // Sessions
  // -------------------------------------------------------------------------

  async saveSession(data: SessionData): Promise<void> {
    const db = this._requireDb();
    const tx = db.transaction(STORE_SESSIONS, 'readwrite');
    tx.objectStore(STORE_SESSIONS).put(data);
    await transactionComplete(tx);
  }

  async loadSession(userId: string, appId: string, sessionId: string): Promise<SessionData | null> {
    const db = this._requireDb();
    const tx = db.transaction(STORE_SESSIONS, 'readonly');
    const result = await requestToPromise(tx.objectStore(STORE_SESSIONS).get([userId, appId, sessionId]));
    return (result as SessionData | undefined) ?? null;
  }

  // -------------------------------------------------------------------------
  // Context (compound key: [sessionId, threadId])
  // -------------------------------------------------------------------------

  async saveContext(data: ContextData): Promise<void> {
    const db = this._requireDb();
    const tx = db.transaction(STORE_CONTEXT, 'readwrite');
    tx.objectStore(STORE_CONTEXT).put(data);
    await transactionComplete(tx);
  }

  async loadContext(sessionId: string, threadId: string): Promise<ContextData | null> {
    const db = this._requireDb();
    const tx = db.transaction(STORE_CONTEXT, 'readonly');
    const result = await requestToPromise(tx.objectStore(STORE_CONTEXT).get([sessionId, threadId]));
    return (result as ContextData | undefined) ?? null;
  }

  /**
   * Delete all context entries for a session whose threadId is lexicographically
   * greater than the given threadId. Used during rollback to prune future branches.
   *
   * Thread IDs are UUIDv7 (lexicographically sortable by time), so string
   * comparison is sufficient.
   */
  async deleteContextsAfterThread(sessionId: string, threadId: string): Promise<void> {
    const db = this._requireDb();
    const tx = db.transaction(STORE_CONTEXT, 'readwrite');
    const store = tx.objectStore(STORE_CONTEXT);

    // Open cursor over all entries and filter by sessionId + threadId comparison
    const request = store.openCursor();

    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve();
          return;
        }
        const entry = cursor.value as ContextData;
        if (entry.sessionId === sessionId && entry.threadId > threadId) {
          try {
            cursor.delete();
          } catch {
            // cursor.delete() may fail on read-only or version-change transactions — non-fatal
          }
        }
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });

    await transactionComplete(tx);
  }

  /**
   * Load the most recent context for a session (latest threadId).
   * Uses lexicographic ordering of UUIDv7 threadIds for chronological sort.
   */
  async loadLatestContext(sessionId: string): Promise<ContextData | null> {
    const db = this._requireDb();
    const tx = db.transaction(STORE_CONTEXT, 'readonly');
    const store = tx.objectStore(STORE_CONTEXT);

    // UUIDv7 thread IDs are ASCII hex+hyphens, so \uffff is a safe upper bound
    const range = IDBKeyRange.bound([sessionId, ''], [sessionId, '\uffff']);

    return new Promise((resolve, reject) => {
      const request = store.openCursor(range, 'prev');
      request.onsuccess = () => {
        const cursor = request.result;
        resolve(cursor ? (cursor.value as ContextData) : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // -------------------------------------------------------------------------
  // Payload
  // -------------------------------------------------------------------------

  async savePayload(data: PayloadData): Promise<void> {
    const db = this._requireDb();
    const tx = db.transaction(STORE_PAYLOAD, 'readwrite');
    tx.objectStore(STORE_PAYLOAD).put(data);
    await transactionComplete(tx);
  }

  async loadPayload(threadId: string, messageId: string): Promise<PayloadData | null> {
    const db = this._requireDb();
    const tx = db.transaction(STORE_PAYLOAD, 'readonly');
    const result = await requestToPromise(tx.objectStore(STORE_PAYLOAD).get([threadId, messageId]));
    return (result as PayloadData | undefined) ?? null;
  }

  async loadPayloadsByThread(threadId: string): Promise<PayloadData[]> {
    const db = this._requireDb();
    const tx = db.transaction(STORE_PAYLOAD, 'readonly');
    const index = tx.objectStore(STORE_PAYLOAD).index('threadId');
    const results: PayloadData[] = [];

    return new Promise((resolve, reject) => {
      const request = index.openCursor(IDBKeyRange.only(threadId));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(results);
          return;
        }
        results.push(cursor.value as PayloadData);
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // -------------------------------------------------------------------------
  // Favorites
  // -------------------------------------------------------------------------

  async saveFavorite(data: FavoriteData): Promise<void> {
    const db = this._requireDb();
    const tx = db.transaction(STORE_FAVORITES, 'readwrite');
    tx.objectStore(STORE_FAVORITES).put(data);
    await transactionComplete(tx);
  }

  async removeFavorite(userId: string, appId: string, sku: string): Promise<void> {
    const db = this._requireDb();
    const tx = db.transaction(STORE_FAVORITES, 'readwrite');
    tx.objectStore(STORE_FAVORITES).delete([userId, appId, sku]);
    await transactionComplete(tx);
  }

  async loadFavorites(userId: string, appId: string): Promise<FavoriteData[]> {
    const db = this._requireDb();
    const tx = db.transaction(STORE_FAVORITES, 'readonly');
    const all = await requestToPromise(tx.objectStore(STORE_FAVORITES).getAll());
    return (all as FavoriteData[]).filter((f) => f.userId === userId && f.appId === appId);
  }

  async isFavorite(userId: string, appId: string, sku: string): Promise<boolean> {
    const db = this._requireDb();
    const tx = db.transaction(STORE_FAVORITES, 'readonly');
    const result = await requestToPromise(tx.objectStore(STORE_FAVORITES).get([userId, appId, sku]));
    return result !== undefined;
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private _requireDb(): IDBDatabase {
    if (!this._db) {
      throw new Error('GengageIndexedDB: database not open. Call open() first.');
    }
    return this._db;
  }
}

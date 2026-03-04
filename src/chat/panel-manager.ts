/**
 * PanelManager — manages the two-pane panel state for the chat widget.
 *
 * Owns panel snapshots, snapshot types, active message highlighting,
 * panel thread navigation, topbar updates, and extended mode coordination.
 *
 * Extracted from chat/index.ts to improve cohesion and reduce file size.
 */

import type { ChatDrawer } from './components/ChatDrawer.js';
import type { CommunicationBridge } from '../common/communication-bridge.js';
import type { ExtendedModeManager, PanelContentType } from './extendedModeManager.js';
import type { ChatI18n } from './types.js';
import type { UISpec, UIElement } from '../common/types.js';

/** Minimal interface the panel manager needs from its host widget. */
export interface PanelManagerDeps {
  drawer: () => ChatDrawer | null;
  shadow: () => ShadowRoot | null;
  currentThreadId: () => string | null;
  bridge: () => CommunicationBridge | null;
  extendedModeManager: () => ExtendedModeManager | null;
  i18n: () => ChatI18n;
  rollbackToThread: (threadId: string) => void;
}

export class PanelManager {
  /** Panel content snapshots keyed by bot message ID for history navigation. */
  readonly snapshots = new Map<string, HTMLElement>();
  /** Component type for each panel snapshot (for topbar title restoration). */
  readonly snapshotTypes = new Map<string, string>();
  /** Currently active (highlighted) message ID in the chat pane. */
  activePanelMessageId: string | null = null;
  /** Current panel component type. */
  currentType: string | null = null;
  /** Thread IDs that have panel content, in order of creation. */
  threads: string[] = [];
  /** Action type that triggered the current stream (for panel title disambiguation). */
  lastActionType: string | null = null;

  constructor(private readonly deps: PanelManagerDeps) {}

  /**
   * Deep-clone the current panel content (excluding topbar/thumbnails) and store
   * it keyed by message ID. Called when a stream completes so panel content can
   * be restored later without duplicating the topbar.
   */
  snapshotForMessage(messageId: string): void {
    const drawer = this.deps.drawer();
    if (!drawer?.hasPanelContent()) return;
    // Never snapshot loading skeleton — it must not be persisted or restored
    if (drawer.isPanelLoading()) return;
    const contentEl = drawer.getPanelContentElement();
    if (!contentEl) return;
    const clone = contentEl.cloneNode(true) as HTMLElement;
    this.snapshots.set(messageId, clone);
    // Store the component type so topbar can be restored with the right title
    if (this.currentType) {
      this.snapshotTypes.set(messageId, this.currentType);
    }
  }

  /**
   * Attach a click handler to a bot message bubble so clicking it restores
   * the panel content that was active when that message was received.
   */
  attachClickHandler(messageId: string): void {
    const shadow = this.deps.shadow();
    const bubble = shadow?.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
    if (!bubble) return;
    (bubble as HTMLElement).style.cursor = 'pointer';
    bubble.addEventListener('click', () => this.restoreForMessage(messageId));
  }

  /**
   * Restore the panel content snapshot associated with a given message ID.
   * Highlights the active message and de-highlights the previous one.
   * Also restores the panel topbar title for the snapshot's component type.
   * Returns true if the snapshot was found and restored.
   */
  restoreForMessage(messageId: string): boolean {
    const snapshot = this.snapshots.get(messageId);
    if (!snapshot) return false;

    const shadow = this.deps.shadow();
    const drawer = this.deps.drawer();

    // De-highlight previous active message
    if (this.activePanelMessageId) {
      const prev = shadow?.querySelector(`[data-message-id="${CSS.escape(this.activePanelMessageId)}"]`);
      prev?.classList.remove('gengage-chat-bubble--active');
    }

    // Highlight the clicked message
    const current = shadow?.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
    current?.classList.add('gengage-chat-bubble--active');
    this.activePanelMessageId = messageId;

    // Restore panel content from snapshot clone
    drawer?.setPanelContent(snapshot.cloneNode(true) as HTMLElement);

    // Restore component type and topbar
    const snapshotType = this.snapshotTypes.get(messageId);
    if (snapshotType) {
      this.currentType = snapshotType;
      this.updateTopBar(snapshotType);
    }
    return true;
  }

  /**
   * Send maximize-pdp / minify-pdp bridge messages with production-matching delays.
   * Called by the extended mode manager when panel extension state changes.
   */
  notifyExtension(extended: boolean): void {
    const bridge = this.deps.bridge();
    if (extended) {
      setTimeout(() => bridge?.send('maximize-pdp', {}), 350);
    } else {
      setTimeout(() => bridge?.send('minify-pdp', {}), 200);
    }
  }

  /**
   * Derive panel title from UISpec root element type using i18n strings.
   * When the backend provides a `panelTitle` prop, it takes precedence.
   */
  titleForComponent(componentType: string, backendTitle?: string): string {
    if (backendTitle) return backendTitle;
    const i18n = this.deps.i18n();
    switch (componentType) {
      case 'ProductDetailsPanel':
        return i18n.panelTitleProductDetails;
      case 'ProductGrid':
        // User-typed queries produce search results; product actions produce similar products
        return this.lastActionType === 'user_message' ? i18n.panelTitleSearchResults : i18n.panelTitleSimilarProducts;
      case 'ComparisonTable':
        return i18n.panelTitleComparisonResults;
      case 'AIGroupingCards':
        return i18n.panelTitleCategories;
      default:
        return '';
    }
  }

  /**
   * Update the panel top bar navigation state and title.
   * When the backend provides a `panelTitle`, it takes precedence over i18n defaults.
   */
  updateTopBar(componentType: string, backendTitle?: string): void {
    const currentThreadId = this.deps.currentThreadId();
    if (!currentThreadId) return;
    const idx = this.threads.indexOf(currentThreadId);
    const canBack = idx > 0;
    const canForward = idx >= 0 && idx < this.threads.length - 1;
    const title = this.titleForComponent(componentType, backendTitle);
    this.deps.drawer()?.updatePanelTopBar(canBack, canForward, title);
  }

  /**
   * Set panel topbar title during loading (before actual panel content arrives).
   * Maps backend pending types to the same i18n titles used for final content.
   */
  updateTopBarForLoading(pendingType: string): void {
    const i18n = this.deps.i18n();
    const loadingTitleMap: Record<string, string> = {
      productDetails: i18n.panelTitleProductDetails,
      productList:
        this.lastActionType === 'user_message' ? i18n.panelTitleSearchResults : i18n.panelTitleSimilarProducts,
      comparisonTable: i18n.panelTitleComparisonResults,
      groupList: i18n.panelTitleCategories,
    };
    const title = loadingTitleMap[pendingType] ?? '';
    if (title) {
      const currentThreadId = this.deps.currentThreadId();
      const idx = currentThreadId ? this.threads.indexOf(currentThreadId) : -1;
      const canBack = idx > 0;
      const canForward = idx >= 0 && idx < this.threads.length - 1;
      this.deps.drawer()?.updatePanelTopBar(canBack, canForward, title);
    }
  }

  /**
   * Map UISpec component types to PanelContentType for the extended mode manager.
   */
  updateExtendedMode(componentType: string): void {
    const mapping: Record<string, PanelContentType> = {
      ComparisonTable: 'comparisonTable',
      AIGroupingCards: 'groupList',
      ProductDetailsPanel: 'productDetails',
      ProductGrid: 'productList',
    };
    const panelType = mapping[componentType] ?? null;
    this.deps.extendedModeManager()?.setPanelContentType(panelType);
  }

  /** Navigate to the previous panel thread. */
  navigateBack(): void {
    const currentThreadId = this.deps.currentThreadId();
    if (!currentThreadId) return;
    const idx = this.threads.indexOf(currentThreadId);
    if (idx > 0) {
      const target = this.threads[idx - 1];
      if (target) this.deps.rollbackToThread(target);
    }
  }

  /** Navigate to the next panel thread. */
  navigateForward(): void {
    const currentThreadId = this.deps.currentThreadId();
    if (!currentThreadId) return;
    const idx = this.threads.indexOf(currentThreadId);
    if (idx >= 0 && idx < this.threads.length - 1) {
      const target = this.threads[idx + 1];
      if (target) this.deps.rollbackToThread(target);
    }
  }

  /**
   * Panel route shaping:
   * - product details => expanded LHS panel (`ProductDetailsPanel`)
   * - all other panel-routed specs keep their original component types
   */
  toPanelSpec(spec: UISpec): UISpec {
    const root = spec.elements[spec.root];
    if (!root || root.type !== 'ProductCard') return spec;

    const panelRoot: UIElement = {
      ...root,
      type: 'ProductDetailsPanel',
    };

    return {
      root: spec.root,
      elements: {
        ...spec.elements,
        [spec.root]: panelRoot,
      },
    };
  }

  destroy(): void {
    this.snapshots.clear();
    this.snapshotTypes.clear();
    this.activePanelMessageId = null;
    this.currentType = null;
    this.threads = [];
  }
}

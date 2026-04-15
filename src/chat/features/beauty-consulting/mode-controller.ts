/**
 * Assistant mode controller — encapsulates mode state and UI hints.
 *
 * Extracted from GengageChat (index.ts) so the 3,900-line widget file
 * stays focused on stream orchestration and drawer coordination.
 */

import type { AssistantMode } from '../../assistant-mode.js';
import { asRecord, parseRedirectMode, toAssistantMode } from '../../assistant-mode.js';
import { debugLog } from '../../../common/debug.js';

/**
 * Minimal drawer interface consumed by the mode controller.
 * Keeps the controller decoupled from ChatDrawer internals.
 */
export interface ModeDrawerAdapter {
  setAttachmentControlsVisible(visible: boolean): void;
  setInputPlaceholder(text: string): void;
  setBeautyPhotoStepCard(options: { visible: boolean }): void;
}

export class AssistantModeController {
  private _mode: AssistantMode = 'shopping';
  private _uiHints: Record<string, unknown> | null = null;

  get mode(): AssistantMode {
    return this._mode;
  }

  set mode(value: AssistantMode) {
    this._mode = value;
  }

  get uiHints(): Record<string, unknown> | null {
    return this._uiHints;
  }

  set uiHints(value: Record<string, unknown> | null) {
    this._uiHints = value;
  }

  get isShopping(): boolean {
    return this._mode === 'shopping';
  }

  get isBeautyConsulting(): boolean {
    return this._mode === 'beauty_consulting';
  }

  /** Whether choice prompter is hidden by backend ui_hints. */
  get isChoicePrompterHidden(): boolean {
    return this._uiHints?.['hide_choice_prompter'] === true;
  }

  /**
   * Apply backend ui_hints to the drawer.
   *
   * @param drawer  Drawer adapter (null when drawer not yet created).
   * @param defaultPlaceholder  Default input placeholder for shopping mode.
   * @param removePersistentChoicePrompter  Callback to remove persistent choice prompter from Shadow DOM.
   */
  applyUiHints(
    drawer: ModeDrawerAdapter | null,
    defaultPlaceholder: string,
    removePersistentChoicePrompter?: () => void,
  ): void {
    const hide = (key: string): boolean => this._uiHints?.[key] === true;
    drawer?.setAttachmentControlsVisible(!hide('hide_attachment_controls'));
    if (hide('hide_choice_prompter')) {
      removePersistentChoicePrompter?.();
    }
    const placeholder =
      typeof this._uiHints?.['input_placeholder'] === 'string'
        ? (this._uiHints['input_placeholder'] as string)
        : undefined;
    if (placeholder) {
      drawer?.setInputPlaceholder(placeholder);
    } else {
      drawer?.setInputPlaceholder(defaultPlaceholder);
    }
  }

  /**
   * Handle redirect metadata from a backend metadata event.
   * Returns true if the mode actually switched.
   */
  handleRedirect(redirectPayload: unknown): boolean {
    debugLog('mode', 'redirect metadata received', redirectPayload);
    const mode = parseRedirectMode(redirectPayload);
    if (!mode) return false;
    this.switchMode(mode);
    return true;
  }

  /** Switch to a new assistant mode. */
  switchMode(mode: AssistantMode): void {
    const prevMode = this._mode;
    this._mode = mode;
    debugLog('mode', 'assistant mode switched', { from: prevMode, to: mode });
  }

  /**
   * Derive mode and ui_hints from a backend CONTEXT panel payload.
   * Missing `assistant_mode` field preserves current mode (old backends).
   * Explicit `null` resets to shopping.
   */
  updateFromContext(panel: Record<string, unknown>): void {
    const panelMode = panel['assistant_mode'];
    if (typeof panelMode === 'string' && panelMode) {
      const validated = toAssistantMode(panelMode);
      if (validated) {
        this._mode = validated;
      } else {
        debugLog('mode', 'ignoring unrecognised assistant_mode from context', panelMode);
      }
    } else if (panelMode === null) {
      this._mode = 'shopping';
    }
    this._uiHints = asRecord(panel['ui_hints']) ?? null;
  }

  /**
   * Reset to shopping mode. Returns true if mode was non-shopping before reset.
   */
  reset(): boolean {
    const wasNonShopping = this._mode !== 'shopping';
    this._mode = 'shopping';
    this._uiHints = null;
    return wasNonShopping;
  }

  /** Resolve attachment action type based on current mode. */
  resolveAttachmentActionType(): 'user_message' | 'findSimilar' {
    return this._mode === 'beauty_consulting' ? 'user_message' : 'findSimilar';
  }

  /** Non-shopping modes condense thinking step lists. */
  shouldCondenseThinking(): boolean {
    return this._mode !== 'shopping';
  }
}

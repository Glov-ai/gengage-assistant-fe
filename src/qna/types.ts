import type { BaseWidgetConfig, ActionPayload } from '../common/types.js';
import type { UISpecRendererOverrides } from '../common/renderer/index.js';

export interface QNAWidgetConfig extends BaseWidgetConfig {
  /** Where to mount the QNA buttons container. Required. */
  mountTarget: HTMLElement | string;

  /** CTA label for the "open chat" pill/button (default: 'Ask something else'). */
  ctaText?: string;

  /** Hide the CTA button inside the quick-question button row.
   *  Useful when a TextInput is already visible and the CTA would be redundant. */
  hideButtonRowCta?: boolean;

  /** Placeholder text cycling inside the free-text input.
   *  Set to `true` to use fetched action titles as rotating placeholders. */
  inputPlaceholder?: string | string[] | true;

  /** Locale key for SDK defaults (for example 'tr', 'en'). */
  locale?: string;
  i18n?: Partial<QNAI18n>;
  renderer?: QNARendererConfig;

  /** Show a static question above the rotating buttons. */
  showStaticQuestion?: boolean;
  staticQuestionText?: string;

  // -------------------------------------------------------------------------
  // Callbacks (alternative to event listeners)
  // -------------------------------------------------------------------------

  /** Called when a QNA action button is clicked. */
  onActionSelected?: (action: ActionPayload) => void;

  /** Called when the open-chat CTA is clicked. */
  onOpenChat?: () => void;
}

export interface QNAI18n {
  quickQuestionsAriaLabel: string;
  askQuestionAriaLabel: string;
  defaultInputPlaceholder: string;
  sendButton: string;
  sendQuestionAriaLabel: string;
  defaultCtaText: string;
  redirectingToChat: string;
  /**
   * Replaces the standalone backend “similar products” hero with this quick question pill
   * (user_message, not findSimilar).
   */
  productContextQuickPillLabel: string;
}

export interface QNAUISpecRenderContext {
  onAction: (action: ActionPayload) => void;
  onOpenChat?: () => void;
  ctaText?: string;
  inputPlaceholder?: string | string[];
  i18n: QNAI18n;
}

export type QNARendererConfig = UISpecRendererOverrides<QNAUISpecRenderContext>;

// ---------------------------------------------------------------------------
// json-render component types for QNA
// ---------------------------------------------------------------------------

export interface QNAUIComponents {
  /** A single QNA action button. */
  ActionButton: {
    label: string;
    action: ActionPayload;
    /** Visual variant for the button. */
    variant?: 'primary' | 'outline' | 'ghost';
  };

  /** The container holding all action buttons. */
  ButtonRow: {
    orientation?: 'horizontal' | 'vertical';
    wrap?: boolean;
  };

  /** Free-text input field with rotating placeholder text. */
  TextInput: {
    placeholder?: string | string[];
    ctaLabel?: string;
  };

  /** A heading or label above the buttons. */
  QuestionHeading: {
    text: string;
  };
}

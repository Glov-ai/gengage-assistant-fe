/**
 * Beauty consulting drawer extensions — DOM helpers for beauty-specific
 * elements in the chat drawer.
 *
 * Extracted from ChatDrawer so the 2,700-line drawer file doesn't grow
 * with each new consulting mode.
 */

import { renderBeautyPhotoStep } from '../../components/BeautyPhotoStep.js';
import type { ChatI18n, ChatUISpecRenderContext } from '../../types.js';

export interface BeautyPhotoStepCardOptions {
  visible: boolean;
  processing?: boolean;
  onSkip?: (() => void) | undefined;
  title?: string | undefined;
  description?: string | undefined;
  uploadLabel?: string | undefined;
  skipLabel?: string | undefined;
}

/**
 * Lazily create the beauty photo step slot element and insert it before
 * the input area. Returns the created or existing element.
 */
export function ensureBeautyPhotoStepSlot(
  existing: HTMLElement | null,
  conversationEl: HTMLElement | null,
): HTMLElement {
  if (existing) return existing;
  const slot = document.createElement('section');
  slot.className = 'gengage-chat-beauty-photo-step';
  slot.dataset['gengagePart'] = 'chat-beauty-photo-step';
  slot.hidden = true;
  const inputArea = conversationEl?.querySelector('.gengage-chat-input-area');
  if (inputArea) {
    inputArea.parentElement?.insertBefore(slot, inputArea);
  } else {
    conversationEl?.appendChild(slot);
  }
  return slot;
}

/**
 * Show or hide the beauty photo step card.
 * Returns the slot element (possibly newly created).
 */
export function applyBeautyPhotoStepCard(
  slotEl: HTMLElement | null,
  conversationEl: HTMLElement | null,
  options: BeautyPhotoStepCardOptions,
  i18n: ChatI18n,
  openAttachmentPicker: () => void,
): HTMLElement | null {
  if (!options.visible) {
    if (slotEl) {
      slotEl.hidden = true;
      slotEl.innerHTML = '';
    }
    return slotEl;
  }

  const slot = ensureBeautyPhotoStepSlot(slotEl, conversationEl);
  slot.hidden = false;
  slot.innerHTML = '';

  const card = renderBeautyPhotoStep(
    {
      type: 'BeautyPhotoStep',
      props: {
        processing: options.processing ?? false,
        title: options.title,
        description: options.description,
        upload_label: options.uploadLabel,
        skip_label: options.skipLabel,
      },
    },
    { i18n, onAction: () => undefined } as ChatUISpecRenderContext,
    {
      onUpload: openAttachmentPicker,
      onSkip: options.onSkip,
    },
  );

  slot.appendChild(card);
  return slot;
}

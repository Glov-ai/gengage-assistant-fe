/**
 * Beauty photo step card — a transient prompt rendered above the chat input
 * asking the user to upload a selfie for skin/beauty analysis.
 *
 * The backend sends a `BeautyPhotoStep` UISpec during the beauty consulting
 * init flow. The chat widget intercepts it and renders this component in a
 * dedicated slot (not in the message stream or panel).
 *
 * Props (from UISpec):
 *   processing  — boolean, disables upload button and shows processing label
 *   title       — override heading text
 *   description — override body text
 *   upload_label — override upload button text
 *   skip_label  — override skip button text
 */

import type { UIElement } from '../../common/types.js';
import { CHAT_I18N_TR } from '../locales/index.js';
import type { ChatUISpecRenderContext } from '../types.js';

export interface BeautyPhotoStepProps {
  processing: boolean;
  title?: string | undefined;
  description?: string | undefined;
  uploadLabel?: string | undefined;
  skipLabel?: string | undefined;
}

/** Extract typed props from a raw UISpec element props bag. */
export function parseBeautyPhotoStepProps(props: Record<string, unknown>): BeautyPhotoStepProps {
  return {
    processing: props['processing'] === true,
    title: typeof props['title'] === 'string' ? props['title'] : undefined,
    description: typeof props['description'] === 'string' ? props['description'] : undefined,
    uploadLabel: typeof props['upload_label'] === 'string' ? props['upload_label'] : undefined,
    skipLabel: typeof props['skip_label'] === 'string' ? props['skip_label'] : undefined,
  };
}

export interface BeautyPhotoStepCallbacks {
  onUpload?: (() => void) | undefined;
  onSkip?: (() => void) | undefined;
}

export function renderBeautyPhotoStep(
  element: UIElement,
  ctx: ChatUISpecRenderContext,
  callbacks?: BeautyPhotoStepCallbacks,
): HTMLElement {
  const props = element.props ?? {};
  const processing = props['processing'] === true;
  const i18n = { ...CHAT_I18N_TR, ...(ctx.i18n ?? {}) };

  const card = document.createElement('div');
  card.className = 'gengage-chat-beauty-photo-step-card';

  const icon = document.createElement('span');
  icon.className = 'gengage-chat-beauty-photo-step-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '✦';

  const content = document.createElement('div');
  content.className = 'gengage-chat-beauty-photo-step-content';

  const titleEl = document.createElement('div');
  titleEl.className = 'gengage-chat-beauty-photo-step-title';
  titleEl.textContent = (typeof props['title'] === 'string' ? props['title'] : undefined) ?? i18n.beautyPhotoStepTitle;

  const desc = document.createElement('p');
  desc.className = 'gengage-chat-beauty-photo-step-desc';
  desc.textContent = (typeof props['description'] === 'string' ? props['description'] : undefined) ?? i18n.beautyPhotoStepDescription;

  const actions = document.createElement('div');
  actions.className = 'gengage-chat-beauty-photo-step-actions';

  const uploadBtn = document.createElement('button');
  uploadBtn.type = 'button';
  uploadBtn.className = 'gengage-chat-beauty-photo-step-upload gds-btn gds-btn-primary';
  uploadBtn.textContent = processing
    ? i18n.beautyPhotoStepProcessing
    : ((typeof props['upload_label'] === 'string' ? props['upload_label'] : undefined) ??
      i18n.beautyPhotoStepUpload);
  uploadBtn.disabled = processing;
  if (callbacks?.onUpload) {
    uploadBtn.addEventListener('click', () => callbacks.onUpload!());
  }

  const skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.className = 'gengage-chat-beauty-photo-step-skip gds-btn gds-btn-ghost';
  skipBtn.textContent = (typeof props['skip_label'] === 'string' ? props['skip_label'] : undefined) ?? i18n.beautyPhotoStepSkip;
  if (callbacks?.onSkip) {
    skipBtn.addEventListener('click', () => callbacks.onSkip!());
  }

  actions.appendChild(uploadBtn);
  actions.appendChild(skipBtn);
  content.appendChild(titleEl);
  content.appendChild(desc);
  content.appendChild(actions);
  card.appendChild(icon);
  card.appendChild(content);

  return card;
}

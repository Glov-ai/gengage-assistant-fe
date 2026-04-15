/**
 * Beauty consulting stream handler — intercepts beauty-specific UISpec
 * components during NDJSON stream processing.
 *
 * Extracted from GengageChat._startStream() so index.ts only has thin
 * delegation calls for beauty-specific stream events.
 */

import { parsePhotoAnalysisProps } from '../../components/PhotoAnalysisCard.js';
import type { PhotoAnalysisData } from '../../components/PhotoAnalysisCard.js';
import { parseBeautyPhotoStepProps } from '../../components/BeautyPhotoStep.js';
import type { ChatMessage } from '../../types.js';

/** Per-stream state for beauty consulting features. */
export interface BeautyStreamState {
  streamIncludedBeautyPhotoStep: boolean;
  pendingPhotoStepSkip: boolean;
}

export function createBeautyStreamState(): BeautyStreamState {
  return {
    streamIncludedBeautyPhotoStep: false,
    pendingPhotoStepSkip: false,
  };
}

/** Callbacks needed by the beauty stream handler. */
export interface BeautyStreamContext {
  drawer: {
    updateBotMessage(messageId: string, html: string, renderHint?: string, photoAnalysis?: PhotoAnalysisData): void;
    setBeautyPhotoStepCard(options: {
      visible: boolean;
      processing?: boolean;
      onSkip?: (() => void) | undefined;
      title?: string | undefined;
      description?: string | undefined;
      uploadLabel?: string | undefined;
      skipLabel?: string | undefined;
    }): void;
  } | null;
  ensureRendered: () => void;
  cancelTypewriter: () => void;
  sendSkipMessage: () => void;
  streamDone: boolean;
}

/**
 * Handle a beauty-specific UISpec component during stream processing.
 * Returns true if the component was handled (caller should `return`).
 */
export function handleBeautyUISpec(
  componentType: string,
  rootElementProps: Record<string, unknown>,
  state: BeautyStreamState,
  ctx: BeautyStreamContext,
  botMsg: ChatMessage,
): boolean {
  if (componentType === 'PhotoAnalysisCard') {
    const parsed = parsePhotoAnalysisProps(rootElementProps);
    if (parsed) {
      botMsg.photoAnalysis = parsed;
      botMsg.renderHint = 'photo_analysis';
      ctx.ensureRendered();
      // Cancel any active typewriter — text may have arrived first and started animating
      // into the same bubble container that we are about to replace with the card.
      ctx.cancelTypewriter();
      ctx.drawer?.updateBotMessage(botMsg.id, botMsg.content ?? '', 'photo_analysis', botMsg.photoAnalysis);
    }
    return true;
  }

  if (componentType === 'BeautyPhotoStep') {
    state.streamIncludedBeautyPhotoStep = true;
    const stepProps = parseBeautyPhotoStepProps(rootElementProps);
    ctx.drawer?.setBeautyPhotoStepCard({
      visible: true,
      ...stepProps,
      onSkip: () => {
        ctx.drawer?.setBeautyPhotoStepCard({ visible: false });
        if (ctx.streamDone) {
          ctx.sendSkipMessage();
        } else {
          state.pendingPhotoStepSkip = true;
        }
      },
    });
    return true;
  }

  return false;
}

/** Returns true if the bot message should render as a photo analysis card. */
export function isPhotoAnalysisMessage(botMsg: ChatMessage): boolean {
  return botMsg.renderHint === 'photo_analysis';
}

/** Flush pending beauty photo step state on stream complete. */
export function flushBeautyStreamComplete(state: BeautyStreamState, ctx: BeautyStreamContext): void {
  if (!state.streamIncludedBeautyPhotoStep) {
    ctx.drawer?.setBeautyPhotoStepCard({ visible: false });
  }
  if (state.pendingPhotoStepSkip) {
    state.pendingPhotoStepSkip = false;
    ctx.sendSkipMessage();
  }
}

/** Flush pending beauty photo step skip on stream error. */
export function flushBeautyStreamError(state: BeautyStreamState, ctx: BeautyStreamContext): void {
  if (state.pendingPhotoStepSkip) {
    state.pendingPhotoStepSkip = false;
    ctx.sendSkipMessage();
  }
}

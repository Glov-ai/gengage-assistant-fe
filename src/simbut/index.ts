/**
 * SimBut — PDP ürün görselinin sağ üstüne "Benzerlerini Bul" düğmesi.
 * Tıklanınca chat üzerinden `findSimilar` aksiyonu gönderilir (paneldeki pill ile aynı protokol).
 *
 * Yerleşim: Düğme `position: absolute` ile mount köşesine sabitlenir; akışta yer kaplamaz.
 * Mount, `position: relative | absolute | fixed` (veya static ise otomatik `relative`) bir
 * görsel kapsayıcısı olmalıdır — böylece site düzeni ve görsel boyutu etkilenmez.
 */

import { BaseWidget } from '../common/widget-base.js';
import type { PageContext } from '../common/types.js';
import { isSafeUrl } from '../common/safe-html.js';
import * as ga from '../common/ga-datalayer.js';
import { CHAT_I18N_TR } from '../chat/locales/tr.js';
import { CHAT_I18N_EN } from '../chat/locales/en.js';
import type { GengageChat } from '../chat/index.js';
import type { SimButI18n, SimButWidgetConfig } from './types.js';

import './simbut.css';

function resolveLabel(locale: string | undefined, i18n: Partial<SimButI18n> | undefined): string {
  if (i18n?.findSimilarLabel) return i18n.findSimilarLabel;
  const key = (locale ?? 'tr').toLowerCase();
  if (key.startsWith('en')) return CHAT_I18N_EN.findSimilarLabel;
  return CHAT_I18N_TR.findSimilarLabel;
}

function effectiveSku(config: SimButWidgetConfig): string | undefined {
  const fromConfig = typeof config.sku === 'string' && config.sku.length > 0 ? config.sku : undefined;
  const fromCtx =
    typeof config.pageContext?.sku === 'string' && config.pageContext.sku.length > 0
      ? config.pageContext.sku
      : undefined;
  return fromConfig ?? fromCtx;
}

export class GengageSimBut extends BaseWidget<SimButWidgetConfig> {
  private _button: HTMLButtonElement | null = null;
  private _label = CHAT_I18N_TR.findSimilarLabel;

  protected async onInit(config: SimButWidgetConfig): Promise<void> {
    this._label = resolveLabel(config.locale, config.i18n);
    this.root.classList.add('gengage-simbut-root');

    // Mutlak pill için konum bağlamı; static bırakılırsa top/right görselin dışına kaçabilir.
    const pos = window.getComputedStyle(this.root).position;
    if (pos === 'static') {
      this.root.style.position = 'relative';
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gengage-chat-find-similar-pill';
    btn.textContent = this._label;
    this._button = btn;

    const refreshDisabled = (): void => {
      const sku = effectiveSku(this.config as SimButWidgetConfig);
      const canFire =
        !!sku &&
        (!!(this.config as SimButWidgetConfig).onFindSimilar ||
          !!(this.config as SimButWidgetConfig).chat);
      btn.disabled = !canFire;
    };

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sku = effectiveSku(this.config as SimButWidgetConfig);
      if (!sku) return;

      const rawUrl = (this.config as SimButWidgetConfig).imageUrl;
      const imageUrl = typeof rawUrl === 'string' && isSafeUrl(rawUrl) ? rawUrl : undefined;

      ga.trackSuggestedQuestion(this._label, 'findSimilar');
      ga.trackFindSimilars(sku);

      const cfg = this.config as SimButWidgetConfig;
      if (cfg.onFindSimilar) {
        cfg.onFindSimilar(imageUrl ? { sku, imageUrl } : { sku });
        return;
      }

      const chat = cfg.chat;
      if (!chat) return;

      const action = {
        title: this._label,
        type: 'findSimilar' as const,
        payload: imageUrl ? { sku, image_url: imageUrl } : { sku },
      };
      chat.openWithAction(action, { sku });
    });

    this.root.appendChild(btn);
    refreshDisabled();
    ga.trackInit('simbut');
  }

  protected onUpdate(_context: Partial<PageContext>): void {
    if (!this._button) return;
    const sku = effectiveSku(this.config as SimButWidgetConfig);
    const cfg = this.config as SimButWidgetConfig;
    const canFire = !!sku && (!!cfg.onFindSimilar || !!cfg.chat);
    this._button.disabled = !canFire;
  }

  protected onShow(): void {}

  protected onHide(): void {}

  protected onDestroy(): void {
    this._button?.remove();
    this._button = null;
  }

  /** Overlay chat bağlandıktan sonra çağrılabilir (isteğe bağlı). */
  setChat(chat: GengageChat | null): void {
    (this.config as SimButWidgetConfig).chat = chat;
    if (this._button) {
      const sku = effectiveSku(this.config as SimButWidgetConfig);
      const cfg = this.config as SimButWidgetConfig;
      const canFire = !!sku && (!!cfg.onFindSimilar || !!cfg.chat);
      this._button.disabled = !canFire;
    }
  }
}

export function createSimButWidget(): GengageSimBut {
  return new GengageSimBut();
}

export type { SimButWidgetConfig, SimButI18n } from './types.js';

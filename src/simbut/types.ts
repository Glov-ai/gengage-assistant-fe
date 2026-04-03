import type { BaseWidgetConfig } from '../common/types.js';
import type { GengageChat } from '../chat/index.js';

export interface SimButI18n {
  findSimilarLabel: string;
}

export interface SimButWidgetConfig extends BaseWidgetConfig {
  /**
   * Ürün görselinin (veya onun `position: relative` saran kutusunun) DOM öğesi.
   * Düğme bu kutuya göre `absolute` konumlanır; akışta ekstra yer kaplamaz.
   */
  mountTarget: HTMLElement | string;
  /**
   * Ürün SKU. Verilmezse `pageContext.sku` kullanılır (overlay güncellemeleriyle birlikte).
   */
  sku?: string;
  /** `findSimilar` isteğine eklenecek ürün görseli URL’si (opsiyonel). */
  imageUrl?: string;
  /**
   * Sohbeti açıp `findSimilar` göndermek için chat örneği. `initOverlayWidgets` bunu otomatik bağlar.
   */
  chat?: GengageChat | null;
  /**
   * Varsayılan tıklama davranışının yerine geçer (ör. özel entegrasyon).
   * Tanımlıysa `chat` kullanılmaz.
   */
  onFindSimilar?: (detail: { sku: string; imageUrl?: string }) => void;
  locale?: string;
  i18n?: Partial<SimButI18n>;
}

/**
 * Stub context factories for rendering components outside their widget lifecycle.
 * All callbacks log to console (visible in devtools).
 */

import type { ActionPayload } from '@gengage/assistant-fe/common';
import type { ChatUISpecRenderContext, ProductSortState } from '@gengage/assistant-fe/chat';
import type { QNAUISpecRenderContext } from '@gengage/assistant-fe/qna';
import type { SimRelUISpecRenderContext, SimilarProduct } from '@gengage/assistant-fe/simrel';

/** Noop chat context — logs all actions to console. */
export function createNoopChatContext(): ChatUISpecRenderContext {
  const i18n = {
    headerTitle: 'Urun Uzmani',
    inputPlaceholder: 'Urun ara, soru sor',
    sendButton: 'Gonder',
    closeButton: 'Kapat',
    openButton: 'Sohbeti ac',
    newChatButton: 'Yeni sohbet',
    poweredBy: 'Powered by Gengage',
    errorMessage: 'Bir hata olustu. Lutfen tekrar deneyin.',
    retryButton: 'Tekrar Dene',
    loadingMessage: 'Dusunuyorum...',
    productCtaLabel: 'Incele',
    viewOnSiteLabel: 'Sitede Gor',
    attachImageButton: 'Resim ekle',
    removeAttachmentButton: 'Resmi kaldir',
    invalidFileType: 'Sadece JPEG, PNG ve WebP dosyalari destekleniyor.',
    fileTooLarge: "Dosya boyutu 5 MB'dan kucuk olmalidir.",
    aiTopPicksTitle: 'Sizin Icin En Iyiler',
    roleWinner: 'En Begedigim',
    roleBestValue: 'En Uygun Fiyatli',
    roleBestAlternative: 'En Iyi Alternatif',
    viewDetails: 'Detaylari Gor',
    groundingReviewCta: 'Yorumlari Oku',
    groundingReviewSubtitle: '{count} yorum mevcut',
    variantsLabel: 'Varyantlar',
    sortRelated: 'Onerilen',
    sortPriceAsc: 'Fiyat \u2191',
    sortPriceDesc: 'Fiyat \u2193',
    sortToolbarAriaLabel: 'Urunleri sirala',
    compareSelected: 'Karsilastir',
    panelTitleProductDetails: 'Urun Detayi',
    panelTitleSimilarProducts: 'Benzer Urunler',
    panelTitleComparisonResults: 'Karsilastirma Sonuclari',
    panelTitleCategories: 'Kategoriler',
    panelTitleSearchResults: 'Arama Sonuclari',
    inStockLabel: 'Stokta',
    outOfStockLabel: 'Tukendi',
    findSimilarLabel: 'Benzerlerini Bul',
    galleryPrevAriaLabel: 'Onceki gorsel',
    galleryNextAriaLabel: 'Sonraki gorsel',
    choicePrompterHeading: 'Kararsiz mi kaldin?',
    choicePrompterSuggestion: 'Urunleri secip karsilastirabilirsin',
    choicePrompterCta: 'Sec ve Karsilastir',
    viewMoreLabel: 'Daha Fazla Goster',
    similarProductsLabel: 'Benzer Urunler',
    addToCartButton: 'Sepete Ekle',
    addedToCartToast: 'Sepete eklendi',
    shareButton: 'Paylas',
    productInfoTab: 'Urun Bilgileri',
    specificationsTab: 'Teknik Ozellikler',
    recommendedChoiceLabel: 'Onerilen Secim',
    highlightsLabel: 'One Cikan Ozellikler',
    keyDifferencesLabel: 'Temel Farklar',
    specialCasesLabel: 'Ozel Durumlar Icin',
    emptyReviewsMessage: 'Yorum ozeti bulunamadi.',
    closeAriaLabel: 'Kapat',
    startChatLabel: 'Sohbete Basla',
    voiceButton: 'Sesli giris',
    voiceListening: 'Dinleniyor...',
    voiceNotSupported: 'Sesli giris bu tarayicida desteklenmiyor.',
    voicePermissionDenied: 'Mikrofon erisimi reddedildi.',
    voiceError: 'Sesli giris hatasi.',
    handoffHeading: 'Destek temsilcisine aktariliyor',
  };

  return {
    onAction: (action: ActionPayload) => {
      console.log('[catalog] onAction:', action);
      appendToMiniConsole(`onAction: ${JSON.stringify(action)}`);
    },
    onProductClick: (params: { sku: string; url: string }) => {
      console.log('[catalog] onProductClick:', params);
      appendToMiniConsole(`onProductClick: ${JSON.stringify(params)}`);
    },
    onAddToCart: (params: { sku: string; cartCode: string; quantity: number }) => {
      console.log('[catalog] onAddToCart:', params);
      appendToMiniConsole(`onAddToCart: ${JSON.stringify(params)}`);
    },
    onProductSelect: (product: Record<string, unknown>) => {
      console.log('[catalog] onProductSelect:', product);
      appendToMiniConsole(`onProductSelect: ${JSON.stringify(product)}`);
    },
    pricing: {
      currencySymbol: 'TL',
      currencyPosition: 'suffix',
      thousandsSeparator: '.',
      decimalSeparator: ',',
    },
    i18n: i18n as unknown as ChatUISpecRenderContext['i18n'],
    productSort: { type: 'related' as const },
    onSortChange: (sort: ProductSortState) => {
      console.log('[catalog] onSortChange:', sort);
    },
  };
}

/** Noop QNA context. */
export function createNoopQnaContext(): QNAUISpecRenderContext {
  return {
    onAction: (action: ActionPayload) => {
      console.log('[catalog] qna onAction:', action);
      appendToMiniConsole(`qna onAction: ${JSON.stringify(action)}`);
    },
    onOpenChat: () => {
      console.log('[catalog] qna onOpenChat');
      appendToMiniConsole('qna onOpenChat');
    },
    i18n: {
      quickQuestionsAriaLabel: 'Hizli sorular',
      askQuestionAriaLabel: 'Soru sor',
      defaultInputPlaceholder: 'Sorunuzu yazin...',
      sendButton: 'Gonder',
      sendQuestionAriaLabel: 'Soruyu gonder',
      defaultCtaText: 'Baska bir sey sor',
      redirectingToChat: 'Sohbete yonlendiriliyor...',
    },
  };
}

/** Noop SimRel context. */
export function createNoopSimrelContext(): SimRelUISpecRenderContext {
  return {
    onClick: (product: SimilarProduct) => {
      console.log('[catalog] simrel onClick:', product);
      appendToMiniConsole(`simrel onClick: ${JSON.stringify(product)}`);
    },
    onAddToCart: (params: { sku: string; quantity: number; cartCode: string }) => {
      console.log('[catalog] simrel onAddToCart:', params);
      appendToMiniConsole(`simrel onAddToCart: ${JSON.stringify(params)}`);
    },
    onAction: (action: ActionPayload) => {
      console.log('[catalog] simrel onAction:', action);
      appendToMiniConsole(`simrel onAction: ${JSON.stringify(action)}`);
    },
    i18n: {
      similarProductsAriaLabel: 'Similar Products',
      emptyStateMessage: 'No similar products found.',
      addToCartButton: 'Add to Cart',
      ctaLabel: 'View',
      outOfStockLabel: 'Out of Stock',
      decreaseLabel: 'Decrease',
      increaseLabel: 'Increase',
      errorLoadingMessage: 'Could not load similar products.',
      retryButtonText: 'Try again',
      priceSuffix: ' TL',
      scrollTabsLeft: 'Sola kaydir',
      scrollTabsRight: 'Saga kaydir',
    },
    pricing: {
      currencySymbol: 'TL',
      currencyPosition: 'suffix',
      thousandsSeparator: '.',
      decimalSeparator: ',',
    },
  };
}

// ---------------------------------------------------------------------------
// Mini-console helper — appends log entries to the current card's console area
// ---------------------------------------------------------------------------
let _currentConsoleEl: HTMLElement | null = null;

export function setCurrentConsole(el: HTMLElement | null): void {
  _currentConsoleEl = el;
}

function appendToMiniConsole(text: string): void {
  if (!_currentConsoleEl) return;
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  const time = new Date().toLocaleTimeString();
  entry.textContent = `[${time}] ${text}`;
  _currentConsoleEl.appendChild(entry);
  _currentConsoleEl.scrollTop = _currentConsoleEl.scrollHeight;
}

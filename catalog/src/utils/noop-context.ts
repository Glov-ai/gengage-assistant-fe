/**
 * Stub context factories for rendering components outside their widget lifecycle.
 * All callbacks log to console (visible in devtools).
 */

/** Noop chat context — logs all actions to console. */
export function createNoopChatContext(): Record<string, unknown> {
  return {
    onAction: (action: unknown) => {
      console.log('[catalog] onAction:', action);
      appendToMiniConsole(`onAction: ${JSON.stringify(action)}`);
    },
    onProductClick: (params: unknown) => {
      console.log('[catalog] onProductClick:', params);
      appendToMiniConsole(`onProductClick: ${JSON.stringify(params)}`);
    },
    onAddToCart: (params: unknown) => {
      console.log('[catalog] onAddToCart:', params);
      appendToMiniConsole(`onAddToCart: ${JSON.stringify(params)}`);
    },
    onProductSelect: (product: unknown) => {
      console.log('[catalog] onProductSelect:', product);
      appendToMiniConsole(`onProductSelect: ${JSON.stringify(product)}`);
    },
    pricing: {
      currencySymbol: 'TL',
      currencyPosition: 'suffix',
      thousandsSeparator: '.',
      decimalSeparator: ',',
    },
    i18n: {
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
      attachImageButton: 'Resim ekle',
      removeAttachmentButton: 'Resmi kaldir',
      invalidFileType: 'Sadece JPEG, PNG ve WebP dosyalari destekleniyor.',
      fileTooLarge: 'Dosya boyutu 5 MB\'dan kucuk olmalidir.',
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
      compareSelected: 'Karsilastir',
      panelTitleProductDetails: 'Urun Detayi',
      panelTitleSimilarProducts: 'Benzer Urunler',
      panelTitleComparisonResults: 'Karsilastirma Sonuclari',
      panelTitleCategories: 'Kategoriler',
      inStockLabel: 'Stokta',
      outOfStockLabel: 'Tukendi',
      findSimilarLabel: 'Benzerlerini Bul',
      choicePrompterHeading: 'Kararsiz mi kaldin?',
      choicePrompterSuggestion: 'Urunleri secip karsilastirabilirsin',
      choicePrompterCta: 'Sec ve Karsilastir',
      viewMoreLabel: 'Daha Fazla Goster',
      similarProductsLabel: 'Benzer Urunler',
      addToCartButton: 'Sepete Ekle',
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
    },
    productSort: { type: 'related' as const },
    onSortChange: (sort: unknown) => {
      console.log('[catalog] onSortChange:', sort);
    },
  };
}

/** Noop QNA context. */
export function createNoopQnaContext(): Record<string, unknown> {
  return {
    onAction: (action: unknown) => {
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
    },
  };
}

/** Noop SimRel context. */
export function createNoopSimrelContext(): Record<string, unknown> {
  return {
    onClick: (product: unknown) => {
      console.log('[catalog] simrel onClick:', product);
      appendToMiniConsole(`simrel onClick: ${JSON.stringify(product)}`);
    },
    onAddToCart: (params: unknown) => {
      console.log('[catalog] simrel onAddToCart:', params);
      appendToMiniConsole(`simrel onAddToCart: ${JSON.stringify(params)}`);
    },
    onAction: (action: unknown) => {
      console.log('[catalog] simrel onAction:', action);
      appendToMiniConsole(`simrel onAction: ${JSON.stringify(action)}`);
    },
    i18n: {
      similarProductsAriaLabel: 'Benzer Urunler',
      emptyStateMessage: 'Bu urun icin benzer urun bulunamadi.',
      addToCartButton: 'Sepete Ekle',
      priceSuffix: ' TL',
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

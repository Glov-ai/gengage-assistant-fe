/**
 * Merchant configurations for the catalog's theme selector.
 *
 * These are NOT part of the published npm package — they live here
 * solely for the visual catalog to demonstrate components with
 * realistic merchant brand themes.
 *
 * SDK consumers define their own theme/locale in their integration code.
 */

import type { WidgetTheme } from '@gengage/assistant-fe/common';

export interface MerchantConfig {
  accountId: string;
  locale: string;
  theme: WidgetTheme;
  chatHeaderAvatarUrl?: string;
  pricing?: {
    currencySymbol: string;
    currencyPosition: 'prefix' | 'suffix';
    thousandsSeparator: string;
    decimalSeparator: string;
  };
  chatI18n?: {
    inputPlaceholder?: string;
    poweredBy?: string;
    headerTitle?: string;
  };
}

const MERCHANT_CONFIGS: Record<string, MerchantConfig> = {
  koctascomtr: {
    accountId: 'koctascomtr',
    locale: 'tr',
    theme: {
      primaryColor: '#ec6e00',
      primaryForeground: '#ffffff',
      backgroundColor: '#ffffff',
      foregroundColor: '#222222',
      borderRadius: '8px',
      fontFamily: '"Source Sans Pro", "Helvetica Neue", Arial, sans-serif',
      fontSize: '14px',
    },
    chatHeaderAvatarUrl: 'https://configs.glov.ai/remoteConfig/glov-koctascomtr-logo.svg',
    chatI18n: {
      inputPlaceholder: 'Ürün ara, soru sor',
      poweredBy: 'Koçtaş AI Asistan',
    },
  },

  n11com: {
    accountId: 'n11com',
    locale: 'tr',
    theme: {
      primaryColor: '#ff44ef',
      primaryForeground: '#ffffff',
      backgroundColor: '#ffffff',
      foregroundColor: '#222222',
      borderRadius: '8px',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '14px',
    },
    chatI18n: {
      inputPlaceholder: 'Ne aramıştınız?',
      poweredBy: 'Gengage',
    },
  },

  hepsiburadacom: {
    accountId: 'hepsiburadacom',
    locale: 'tr',
    theme: {
      primaryColor: '#ff6000',
      primaryForeground: '#ffffff',
      backgroundColor: '#ffffff',
      foregroundColor: '#333333',
      borderRadius: '8px',
      fontFamily: '"Open Sans", Arial, sans-serif',
      fontSize: '14px',
    },
    chatI18n: {
      inputPlaceholder: 'Ürün ara veya soru sor',
      poweredBy: 'Hepsiburada AI Asistan',
    },
  },

  arcelikcomtr: {
    accountId: 'arcelikcomtr',
    locale: 'tr',
    theme: {
      primaryColor: '#e4002b',
      primaryForeground: '#ffffff',
      backgroundColor: '#ffffff',
      foregroundColor: '#222222',
      borderRadius: '8px',
      fontFamily: '"Arcelik Sans", "Helvetica Neue", Arial, sans-serif',
      fontSize: '14px',
    },
    chatHeaderAvatarUrl: 'https://configs.glov.ai/remoteConfig/glov-arcelikcomtr-logo.png',
    chatI18n: {
      inputPlaceholder: 'Size nasıl yardımcı olabilirim?',
      poweredBy: 'Arçelik AI Asistan',
    },
  },

  yatasbeddingcomtr: {
    accountId: 'yatasbeddingcomtr',
    locale: 'tr',
    theme: {
      primaryColor: '#c8102e',
      primaryForeground: '#ffffff',
      backgroundColor: '#ffffff',
      foregroundColor: '#333333',
      borderRadius: '8px',
      fontFamily: '"Nunito Sans", Arial, sans-serif',
      fontSize: '14px',
    },
    chatHeaderAvatarUrl: 'https://configs.glov.ai/remoteConfig/glov-yatasbeddingcomtr-logo.svg',
    chatI18n: {
      inputPlaceholder: 'Yatak, baza veya ürün arayın',
      poweredBy: 'Yataş AI Asistan',
    },
  },

  trendyolcom: {
    accountId: 'trendyolcom',
    locale: 'tr',
    theme: {
      primaryColor: '#f27a1a',
      primaryForeground: '#ffffff',
      backgroundColor: '#ffffff',
      foregroundColor: '#333333',
      borderRadius: '6px',
      fontFamily: '"Source Sans Pro", Arial, sans-serif',
      fontSize: '14px',
    },
    chatI18n: {
      inputPlaceholder: 'Ne aramıştınız?',
      poweredBy: 'Trendyol AI Asistan',
    },
  },

  boynercomtr: {
    accountId: 'boynercomtr',
    locale: 'tr',
    theme: {
      primaryColor: '#EE403D',
      primaryForeground: '#ffffff',
      backgroundColor: '#ffffff',
      foregroundColor: '#333333',
      borderRadius: '4px',
      fontFamily: '"Montserrat", Arial, sans-serif',
      fontSize: '14px',
    },
    chatI18n: {
      inputPlaceholder: 'Moda, kozmetik veya ev ürünleri arayın',
      poweredBy: 'Boyner AI Asistan',
    },
  },

  evideacom: {
    accountId: 'evideacom',
    locale: 'tr',
    theme: {
      primaryColor: '#ff6a00',
      primaryForeground: '#ffffff',
      backgroundColor: '#ffffff',
      foregroundColor: '#2d3436',
      borderRadius: '8px',
      fontFamily: '"Poppins", Arial, sans-serif',
      fontSize: '14px',
    },
    chatI18n: {
      inputPlaceholder: 'Ev dekorasyon ürünleri arayın',
      poweredBy: 'Evidea AI Asistan',
    },
  },

  aygazcomtr: {
    accountId: 'aygazcomtr',
    locale: 'tr',
    theme: {
      primaryColor: '#e30613',
      primaryForeground: '#ffffff',
      backgroundColor: '#ffffff',
      foregroundColor: '#333333',
      borderRadius: '8px',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '14px',
    },
    chatI18n: {
      inputPlaceholder: 'Aygaz ürünleri hakkında sorun',
      poweredBy: 'Aygaz AI Asistan',
    },
  },

  divanpastanelericomtr: {
    accountId: 'divanpastanelericomtr',
    locale: 'tr',
    theme: {
      primaryColor: '#8b1a2d',
      primaryForeground: '#ffffff',
      backgroundColor: '#faf8f5',
      foregroundColor: '#3d2c2e',
      borderRadius: '8px',
      fontFamily: '"Georgia", serif',
      fontSize: '14px',
    },
    chatI18n: {
      inputPlaceholder: 'Ürün veya mağaza arayın',
      poweredBy: 'Divan AI Asistan',
    },
  },

  screwfixcom: {
    accountId: 'screwfixcom',
    locale: 'en',
    theme: {
      primaryColor: '#00539f',
      primaryForeground: '#ffffff',
      backgroundColor: '#ffffff',
      foregroundColor: '#333333',
      borderRadius: '4px',
      fontFamily: '"Arial", Helvetica, sans-serif',
      fontSize: '14px',
    },
    pricing: {
      currencySymbol: '£',
      currencyPosition: 'prefix',
      thousandsSeparator: ',',
      decimalSeparator: '.',
    },
    chatI18n: {
      inputPlaceholder: 'Search products or ask a question',
      poweredBy: 'Screwfix AI Assistant',
    },
  },

  flormarcomtr: {
    accountId: 'flormarcomtr',
    locale: 'tr',
    theme: {
      primaryColor: '#E45A80',
      primaryForeground: '#ffffff',
      backgroundColor: '#ffffff',
      foregroundColor: '#0f0f0f',
      borderRadius: '5px',
      fontFamily: '"Montserrat", "Helvetica Neue", Arial, sans-serif',
      fontSize: '14px',
    },
    chatI18n: {
      inputPlaceholder: 'Makyaj ürünleri ara veya soru sor',
      poweredBy: 'Flormar AI Asistan',
    },
  },

  saatvesaatcomtr: {
    accountId: 'saatvesaatcomtr',
    locale: 'tr',
    theme: {
      primaryColor: '#590e2b',
      primaryForeground: '#ffffff',
      backgroundColor: '#ffffff',
      foregroundColor: '#1a1a1a',
      borderRadius: '4px',
      fontFamily: '"Roboto", "Helvetica Neue", Arial, sans-serif',
      fontSize: '14px',
    },
    chatI18n: {
      inputPlaceholder: 'Saat ve takı ara veya soru sor',
      poweredBy: 'Saat & Saat AI Asistan',
    },
  },

  penticom: {
    accountId: 'penticom',
    locale: 'tr',
    theme: {
      primaryColor: '#E91E63',
      primaryForeground: '#ffffff',
      backgroundColor: '#ffffff',
      foregroundColor: '#333333',
      borderRadius: '8px',
      fontFamily: '"Nunito Sans", Arial, sans-serif',
      fontSize: '14px',
    },
    chatI18n: {
      inputPlaceholder: 'Ürün ara veya soru sor',
      poweredBy: 'Penti AI Asistan',
    },
  },

  pazaramacom: {
    accountId: 'pazaramacom',
    locale: 'tr',
    theme: {
      primaryColor: '#0039A6',
      primaryForeground: '#ffffff',
      backgroundColor: '#ffffff',
      foregroundColor: '#2B2422',
      borderRadius: '8px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '14px',
    },
    chatI18n: {
      inputPlaceholder: 'Ürün ara veya soru sor',
      poweredBy: 'Pazarama AI Asistan',
    },
  },

  lcwcom: {
    accountId: 'lcwcom',
    locale: 'tr',
    theme: {
      primaryColor: '#B82020',
      primaryForeground: '#ffffff',
      backgroundColor: '#ffffff',
      foregroundColor: '#0C0B37',
      borderRadius: '8px',
      fontFamily: '"Metropolis", Arial, sans-serif',
      fontSize: '14px',
    },
    chatI18n: {
      inputPlaceholder: 'Ürün ara veya soru sor',
      poweredBy: 'LC Waikiki AI Asistan',
    },
  },

  flocomtr: {
    accountId: 'flocomtr',
    locale: 'tr',
    theme: {
      primaryColor: '#FF6600',
      primaryForeground: '#ffffff',
      backgroundColor: '#ffffff',
      foregroundColor: '#000000',
      borderRadius: '8px',
      fontFamily: '"Roboto", sans-serif',
      fontSize: '14px',
    },
    chatI18n: {
      inputPlaceholder: 'Ayakkabı veya aksesuar arayın',
      poweredBy: 'FLO AI Asistan',
    },
  },

  defactocomtr: {
    accountId: 'defactocomtr',
    locale: 'tr',
    theme: {
      primaryColor: '#f28100',
      primaryForeground: '#ffffff',
      backgroundColor: '#ffffff',
      foregroundColor: '#22242a',
      borderRadius: '8px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '14px',
    },
    chatI18n: {
      inputPlaceholder: 'Ürün ara veya soru sor',
      poweredBy: 'DeFacto AI Asistan',
    },
  },

  avansascom: {
    accountId: 'avansascom',
    locale: 'tr',
    theme: {
      primaryColor: '#F07E01',
      primaryForeground: '#ffffff',
      backgroundColor: '#ffffff',
      foregroundColor: '#333333',
      borderRadius: '8px',
      fontFamily: '"Open Sans", sans-serif',
      fontSize: '14px',
    },
    chatI18n: {
      inputPlaceholder: 'Ofis malzemesi ara veya soru sor',
      poweredBy: 'Avansas AI Asistan',
    },
  },

  teknosacom: {
    accountId: 'teknosacom',
    locale: 'tr',
    theme: {
      primaryColor: '#F58220',
      primaryForeground: '#ffffff',
      backgroundColor: '#ffffff',
      foregroundColor: '#0C0B37',
      borderRadius: '8px',
      fontFamily: '"Metropolis", Arial, sans-serif',
      fontSize: '14px',
    },
    chatI18n: {
      inputPlaceholder: 'Ürün ara, soru sor',
      poweredBy: 'Gengage ile',
      headerTitle: "Teknosa'ya Sor",
    },
  },

  skecherscomtr: {
    accountId: 'skecherscomtr',
    locale: 'tr',
    theme: {
      primaryColor: '#003478',
      primaryForeground: '#ffffff',
      backgroundColor: '#ffffff',
      foregroundColor: '#1a1a2e',
      borderRadius: '8px',
      fontFamily: '"Helvetica Neue", Arial, sans-serif',
      fontSize: '14px',
    },
    chatI18n: {
      inputPlaceholder: 'Ayakkabı ara veya soru sor',
      poweredBy: 'Skechers AI Asistan',
    },
  },
};

/** Returns the config for a known merchant, or undefined. */
export function getMerchantConfig(accountId: string): MerchantConfig | undefined {
  return MERCHANT_CONFIGS[accountId];
}

/** Returns all known merchant account IDs. */
export function getMerchantIds(): string[] {
  return Object.keys(MERCHANT_CONFIGS);
}

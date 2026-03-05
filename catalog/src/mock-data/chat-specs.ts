/**
 * UISpec fixtures for all 16 chat catalog components.
 * Each spec uses the same flat { root, elements } shape the backend streams.
 */

import { PRODUCTS, productAsRecord } from './products.js';

const p = PRODUCTS;

export const CHAT_SPECS: Record<string, { spec: Record<string, unknown>; description: string }> = {
  ActionButtons: {
    description: 'A horizontal row of quick-reply action buttons.',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'ActionButtons',
          props: {
            buttons: [
              {
                label: 'Benzer urunler goster',
                action: { title: 'Benzer urunler goster', type: 'findSimilar', payload: { sku: p[0]!.sku } },
              },
              {
                label: 'Yorumlari oku',
                action: { title: 'Yorumlari oku', type: 'fetch_reviews', payload: { sku: p[0]!.sku } },
              },
              { label: 'Fiyat karsilastir', action: { title: 'Fiyat karsilastir', type: 'compare', payload: {} } },
            ],
          },
        },
      },
    },
  },

  ActionButton: {
    description: 'A single action button rendered inline.',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'ActionButton',
          props: {
            label: 'Detaylari Gor',
            action: { title: 'Detaylari Gor', type: 'viewDetails', payload: { sku: p[0]!.sku } },
          },
        },
      },
    },
  },

  ProductCard: {
    description: 'A product card rendered inline in the chat stream.',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'ProductCard',
          props: productAsRecord(p[0]!),
        },
      },
    },
  },

  ProductDetailsPanel: {
    description: 'Full product detail view with images, specs, variants, and purchase actions.',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'ProductDetailsPanel',
          props: {
            product: productAsRecord(p[0]!),
          },
        },
      },
    },
  },

  ProductGrid: {
    description: 'A scrollable grid of ProductCard children with optional "more" pagination.',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'ProductGrid',
          props: { endOfList: false },
          children: ['p0', 'p1', 'p2', 'p3'],
        },
        p0: { type: 'ProductCard', props: { product: productAsRecord(p[0]!) } },
        p1: { type: 'ProductCard', props: { product: productAsRecord(p[1]!) } },
        p2: { type: 'ProductCard', props: { product: productAsRecord(p[2]!) } },
        p3: { type: 'ProductCard', props: { product: productAsRecord(p[3]!) } },
      },
    },
  },

  ReviewHighlights: {
    description: 'A list of highlighted customer reviews with sentiment and ratings.',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'ReviewHighlights',
          props: {
            reviews: [
              {
                review_class: 'positive',
                review_text: 'Harika bir urun, cok memnun kaldim. Sik kullaniyorum.',
                review_rating: '5',
                review_tag: 'Kalite',
              },
              {
                review_class: 'positive',
                review_text: 'Fiyat/performans orani cok iyi. Tavsiye ederim.',
                review_rating: '4',
                review_tag: 'Deger',
              },
              {
                review_class: 'negative',
                review_text: 'Aku omru kisa, 2 saat sonra bitiyor.',
                review_rating: '2',
                review_tag: 'Aku',
              },
              {
                review_class: 'neutral',
                review_text: 'Fena degil ama bekledigimden hafif. Is goruyor.',
                review_rating: '3',
                review_tag: 'Genel',
              },
            ],
          },
        },
      },
    },
  },

  ComparisonTable: {
    description: 'A product comparison table with recommended pick, attribute rows, and highlights.',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'ComparisonTable',
          props: {
            recommended: {
              sku: p[0]!.sku,
              name: p[0]!.name,
              price: p[0]!.price,
              imageUrl: p[0]!.imageUrl,
              rating: p[0]!.rating,
              reviewCount: p[0]!.reviewCount,
            },
            products: [
              {
                sku: p[0]!.sku,
                name: p[0]!.name,
                price: p[0]!.price,
                imageUrl: p[0]!.imageUrl,
                rating: p[0]!.rating,
                reviewCount: p[0]!.reviewCount,
              },
              {
                sku: p[1]!.sku,
                name: p[1]!.name,
                price: p[1]!.price,
                imageUrl: p[1]!.imageUrl,
                rating: p[1]!.rating,
                reviewCount: p[1]!.reviewCount,
              },
              {
                sku: p[2]!.sku,
                name: p[2]!.name,
                price: p[2]!.price,
                imageUrl: p[2]!.imageUrl,
                rating: p[2]!.rating,
                reviewCount: p[2]!.reviewCount,
              },
            ],
            attributes: [
              { label: 'Marka', values: [p[0]!.brand, p[1]!.brand, p[2]!.brand] },
              { label: 'Fiyat', values: [p[0]!.price + ' TL', p[1]!.price + ' TL', p[2]!.price + ' TL'] },
              { label: 'Puan', values: [String(p[0]!.rating), String(p[1]!.rating), String(p[2]!.rating)] },
              {
                label: 'Yorum Sayisi',
                values: [String(p[0]!.reviewCount), String(p[1]!.reviewCount), String(p[2]!.reviewCount)],
              },
            ],
            highlights: ['En yuksek puan', 'En cok yorum', 'Profesyonel seri'],
            recommendedText: 'Genel performans ve deger acisindan en iyi secim.',
          },
        },
      },
    },
  },

  AITopPicks: {
    description: 'Rich AI-curated product suggestion cards with roles, sentiment labels, scores, and review quotes.',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'AITopPicks',
          props: {
            suggestions: [
              {
                product: productAsRecord(p[0]!),
                role: 'winner',
                reason: 'En yuksek puan ve en cok olumlu yorum.',
                labels: [
                  { label: 'Kaliteli', sentiment: 'positive' },
                  { label: 'Dayanikli', sentiment: 'positive' },
                ],
                expertQualityScore: 92,
                reviewHighlight: '"Profesyonel isler icin ideal, guclu ve hafif." — Mehmet A.',
                action: { title: 'Detaylari Gor', type: 'viewDetails', payload: { sku: p[0]!.sku } },
              },
              {
                product: productAsRecord(p[2]!),
                role: 'best_value',
                reason: 'En uygun fiyatli secim, temel isler icin yeterli.',
                labels: [
                  { label: 'Uygun Fiyat', sentiment: 'positive' },
                  { label: 'Hafif', sentiment: 'neutral' },
                ],
                expertQualityScore: 78,
                action: { title: 'Detaylari Gor', type: 'viewDetails', payload: { sku: p[2]!.sku } },
              },
              {
                product: productAsRecord(p[4]!),
                role: 'best_alternative',
                reason: 'Farkli bir marka arayanlar icin guclu alternatif.',
                labels: [
                  { label: 'Guclu Motor', sentiment: 'positive' },
                  { label: 'Agir', sentiment: 'negative' },
                ],
                expertQualityScore: 85,
                action: { title: 'Detaylari Gor', type: 'viewDetails', payload: { sku: p[4]!.sku } },
              },
            ],
          },
        },
      },
    },
  },

  GroundingReviewCard: {
    description: 'A card showing review grounding data with review count and CTA.',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'GroundingReviewCard',
          props: {
            title: 'Musteri Yorumlari',
            text: 'Bu urun hakkinda 342 yorum bulundu. Genel puan 4.7/5.',
            reviewCount: '342',
            action: { title: 'Tum Yorumlari Gor', type: 'fetch_reviews', payload: { sku: p[0]!.sku } },
          },
        },
      },
    },
  },

  AIGroupingCards: {
    description: 'Category grouping cards with images and labels for product discovery.',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'AIGroupingCards',
          props: {
            entries: [
              {
                name: 'Akulu Matkaplar',
                image: `https://placehold.co/200x200/0077cc/fff?text=Matkaplar`,
                description: 'Profesyonel ve hobi kullanimi icin akulu matkaplar.',
                action: { title: 'Akulu Matkaplar', type: 'search', payload: { query: 'akulu matkap' } },
              },
              {
                name: 'Daire Testereler',
                image: `https://placehold.co/200x200/00897b/fff?text=Testereler`,
                description: 'Ahsap ve metal kesim icin daire testereler.',
                action: { title: 'Daire Testereler', type: 'search', payload: { query: 'daire testere' } },
              },
              {
                name: 'Zimparalar',
                image: `https://placehold.co/200x200/FFB300/222?text=Zimparalar`,
                description: 'Yuzey hazirlama ve bitirme islemleri icin.',
                action: { title: 'Zimparalar', type: 'search', payload: { query: 'zimpara' } },
              },
            ],
          },
        },
      },
    },
  },

  AISuggestedSearchCards: {
    description: 'Suggested search cards with images, descriptions, and differentiation.',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'AISuggestedSearchCards',
          props: {
            entries: [
              {
                shortName: 'Akulu Matkap Seti',
                detailedMessage: 'Matkap + canta + sarj aleti + 2 aku iceren komple setler.',
                whyDifferent: 'Tek tek almaktan daha uygun.',
                image: `https://placehold.co/200x200/0077cc/fff?text=Set`,
                action: { title: 'Akulu Matkap Seti', type: 'search', payload: { query: 'akulu matkap seti' } },
              },
              {
                shortName: 'Darbeli Matkap',
                detailedMessage: 'Beton ve tugla delme ozelligi olan matkaplar.',
                whyDifferent: 'Duvar isleri icin darbe fonksiyonu sart.',
                action: { title: 'Darbeli Matkap', type: 'search', payload: { query: 'darbeli matkap' } },
              },
              {
                shortName: 'Mini Matkap',
                detailedMessage: 'Dar alanlar ve hassas isler icin kompakt matkaplar.',
                whyDifferent: 'Daha hafif ve kucuk govde.',
                action: { title: 'Mini Matkap', type: 'search', payload: { query: 'mini matkap' } },
              },
            ],
          },
        },
      },
    },
  },

  ProsAndCons: {
    description: 'A pros and cons list for a product.',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'ProsAndCons',
          props: {
            productName: p[0]!.name,
            pros: [
              'Guclu 55 Nm tork degeri',
              'Hafif govde (1.1 kg)',
              'LED aydinlatma karanlikta kullanimi kolaylastirir',
            ],
            cons: ['2.0 Ah aku ile calisma suresi kisitli', 'Sarj aleti pakete dahil degil'],
          },
        },
      },
    },
  },

  CategoriesContainer: {
    description: 'Tabbed product groups with optional filter tag buttons.',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'CategoriesContainer',
          props: {
            groups: [
              {
                groupName: 'Matkaplar',
                products: [productAsRecord(p[0]!), productAsRecord(p[3]!)],
              },
              {
                groupName: 'Testereler',
                products: [productAsRecord(p[1]!)],
              },
            ],
            filterTags: [
              {
                title: 'Tumunu Goster',
                action: { title: 'Tumunu Goster', type: 'filter', payload: { filter: 'all' } },
              },
              { title: 'Indirimli', action: { title: 'Indirimli', type: 'filter', payload: { filter: 'discount' } } },
              { title: 'Yeni', action: { title: 'Yeni', type: 'filter', payload: { filter: 'new' } } },
            ],
          },
        },
      },
    },
  },

  HandoffNotice: {
    description: 'A notice shown when the conversation is escalated to a human agent.',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'HandoffNotice',
          props: {
            summary:
              'Musterimiz akulu matkap arasindan karar veremiyor. Bosch ve Makita modelleri hakkinda karsilastirma istendi.',
            products_discussed: [p[0]!.name, p[1]!.name],
            user_sentiment: 'undecided',
          },
        },
      },
    },
  },

  ProductSummaryCard: {
    description: 'Compact inline product card in chat pane.',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'ProductSummaryCard',
          props: {
            product: productAsRecord(p[0]!),
          },
        },
      },
    },
  },

  Divider: {
    description: 'A horizontal rule with an optional label.',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'Divider',
          props: {
            label: 'Yeni Sohbet',
          },
        },
      },
    },
  },
};

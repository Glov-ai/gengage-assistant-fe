/**
 * UISpec fixtures for all QNA catalog components.
 */

export const QNA_SPECS: Record<string, { spec: Record<string, unknown>; description: string }> = {
  ButtonRow: {
    description: 'Container for a group of QNA action buttons.',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'ButtonRow',
          props: { orientation: 'horizontal' },
          children: ['b0', 'b1', 'b2', 'b3'],
        },
        b0: {
          type: 'ActionButton',
          props: {
            label: 'Bu urun hakkinda bilgi ver',
            action: { title: 'Bu urun hakkinda bilgi ver', type: 'product_info', payload: {} },
          },
        },
        b1: {
          type: 'ActionButton',
          props: {
            label: 'Benzer urunler goster',
            action: { title: 'Benzer urunler goster', type: 'findSimilar', payload: {} },
          },
        },
        b2: {
          type: 'ActionButton',
          props: {
            label: 'Kargo bilgisi',
            action: { title: 'Kargo bilgisi', type: 'shipping_info', payload: {} },
          },
        },
        b3: {
          type: 'ActionButton',
          props: {
            label: 'Musteri yorumlari',
            action: { title: 'Musteri yorumlari', type: 'reviews', payload: {} },
          },
        },
      },
    },
  },

  ActionButton: {
    description: 'A single clickable QNA action button.',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'ActionButton',
          props: {
            label: 'Baska bir sey sor',
            action: { title: 'Baska bir sey sor', type: 'open_chat', payload: {} },
            variant: 'primary',
          },
        },
      },
    },
  },

  TextInput: {
    description: 'Free-text input with rotating placeholder and CTA button.',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'TextInput',
          props: {
            placeholder: [
              'Bu urun hakkinda ne merak ediyorsunuz?',
              'Benzer urunleri gormek ister misiniz?',
              'Teknik ozellikler hakkinda sorun...',
            ],
            ctaLabel: 'Soru Sor',
          },
        },
      },
    },
  },

  QuestionHeading: {
    description: 'A heading displayed above the QNA button group.',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'QuestionHeading',
          props: {
            text: 'Bu urun hakkinda ne bilmek istiyorsunuz?',
          },
        },
      },
    },
  },
};

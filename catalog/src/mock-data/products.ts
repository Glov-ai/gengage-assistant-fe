/** 5 realistic product fixtures (Turkish locale, hardware/tools theme). */

export interface MockProduct {
  sku: string;
  name: string;
  brand: string;
  imageUrl: string;
  price: string;
  originalPrice: string;
  discountPercent: number;
  rating: number;
  reviewCount: number;
  url: string;
  cartCode: string;
  inStock: boolean;
  description: string;
  specifications: Array<{ key: string; value: string }>;
  variants: Array<{ name: string; sku: string; price: number }>;
  images: string[];
  promotions: string[];
}

const PLACEHOLDER = 'https://placehold.co';

export const PRODUCTS: MockProduct[] = [
  {
    sku: 'DRILL-001',
    name: 'Bosch Professional GSB 18V-55 Akulu Darbeli Matkap',
    brand: 'Bosch',
    imageUrl: `${PLACEHOLDER}/400x400/0077cc/fff?text=Matkap`,
    price: '4299.90',
    originalPrice: '5499.00',
    discountPercent: 22,
    rating: 4.7,
    reviewCount: 342,
    url: 'https://example.com/products/drill-001',
    cartCode: 'CART-DRILL-001',
    inStock: true,
    description: '18V Professional seri akulu darbeli matkap. 55 Nm tork, LED aydinlatma, ProCore akulu sistem uyumu.',
    specifications: [
      { key: 'Voltaj', value: '18V' },
      { key: 'Tork', value: '55 Nm' },
      { key: 'Devir', value: '0-1900 d/dk' },
      { key: 'Agirlik', value: '1.1 kg' },
    ],
    variants: [
      { name: '2.0 Ah Akulu', sku: 'DRILL-001-2AH', price: 4299.9 },
      { name: '4.0 Ah Akulu', sku: 'DRILL-001-4AH', price: 5199.9 },
      { name: 'Govde (Akusuz)', sku: 'DRILL-001-BARE', price: 3099.9 },
    ],
    images: [
      `${PLACEHOLDER}/600x600/0077cc/fff?text=Matkap+1`,
      `${PLACEHOLDER}/600x600/0077cc/fff?text=Matkap+2`,
      `${PLACEHOLDER}/600x600/0077cc/fff?text=Matkap+3`,
    ],
    promotions: ['Ucretsiz Kargo', 'Taksit Imkani'],
  },
  {
    sku: 'SAW-002',
    name: 'Makita DHS680Z 18V Li-Ion Daire Testere',
    brand: 'Makita',
    imageUrl: `${PLACEHOLDER}/400x400/00897b/fff?text=Testere`,
    price: '6749.00',
    originalPrice: '7999.00',
    discountPercent: 16,
    rating: 4.5,
    reviewCount: 189,
    url: 'https://example.com/products/saw-002',
    cartCode: 'CART-SAW-002',
    inStock: true,
    description: '165mm kesim capi, otomatik hiz ayari, toz kanali. LXT serisi ile uyumlu.',
    specifications: [
      { key: 'Kesim Capi', value: '165 mm' },
      { key: 'Kesim Derinligi', value: '57 mm' },
      { key: 'Devir', value: '5000 d/dk' },
      { key: 'Agirlik', value: '3.3 kg' },
    ],
    variants: [
      { name: 'Govde (Akusuz)', sku: 'SAW-002-BARE', price: 6749.0 },
      { name: '5.0 Ah Kit', sku: 'SAW-002-5AH', price: 8999.0 },
    ],
    images: [`${PLACEHOLDER}/600x600/00897b/fff?text=Testere+1`, `${PLACEHOLDER}/600x600/00897b/fff?text=Testere+2`],
    promotions: ['Ucretsiz Kargo'],
  },
  {
    sku: 'SAND-003',
    name: 'DeWalt DWE6423 Eksantrik Zimpara Makinesi',
    brand: 'DeWalt',
    imageUrl: `${PLACEHOLDER}/400x400/FFB300/222?text=Zimpara`,
    price: '2199.00',
    originalPrice: '2199.00',
    discountPercent: 0,
    rating: 4.3,
    reviewCount: 97,
    url: 'https://example.com/products/sand-003',
    cartCode: 'CART-SAND-003',
    inStock: true,
    description: '280W motor, 125mm taban, toz toplama sistemi. Degisken hiz kontrolu.',
    specifications: [
      { key: 'Guc', value: '280 W' },
      { key: 'Taban Capi', value: '125 mm' },
      { key: 'Titresim', value: '1.6 mm' },
      { key: 'Agirlik', value: '1.28 kg' },
    ],
    variants: [],
    images: [`${PLACEHOLDER}/600x600/FFB300/222?text=Zimpara`],
    promotions: [],
  },
  {
    sku: 'JIG-004',
    name: 'Milwaukee M18 FJS Dekupaj Testere',
    brand: 'Milwaukee',
    imageUrl: `${PLACEHOLDER}/400x400/DB0032/fff?text=Dekupaj`,
    price: '5899.00',
    originalPrice: '6999.00',
    discountPercent: 16,
    rating: 4.8,
    reviewCount: 64,
    url: 'https://example.com/products/jig-004',
    cartCode: 'CART-JIG-004',
    inStock: false,
    description: 'FUEL fircasiz motor teknolojisi. Orbital kesim, LED isik, titresim azaltma.',
    specifications: [
      { key: 'Voltaj', value: '18V' },
      { key: 'Strok', value: '25.4 mm' },
      { key: 'Ahsap Kesim', value: '135 mm' },
      { key: 'Agirlik', value: '2.6 kg' },
    ],
    variants: [
      { name: 'Govde', sku: 'JIG-004-BARE', price: 5899.0 },
      { name: '5.0 Ah Kit', sku: 'JIG-004-5AH', price: 7499.0 },
    ],
    images: [`${PLACEHOLDER}/600x600/DB0032/fff?text=Dekupaj+1`, `${PLACEHOLDER}/600x600/DB0032/fff?text=Dekupaj+2`],
    promotions: ['Stokta Yok - On Siparis'],
  },
  {
    sku: 'GRIND-005',
    name: 'Metabo WEV 850-125 Avuc Taslama',
    brand: 'Metabo',
    imageUrl: `${PLACEHOLDER}/400x400/2B7A2B/fff?text=Taslama`,
    price: '3450.00',
    originalPrice: '3950.00',
    discountPercent: 13,
    rating: 4.4,
    reviewCount: 215,
    url: 'https://example.com/products/grind-005',
    cartCode: 'CART-GRIND-005',
    inStock: true,
    description: '850W motor, degisken hiz 2800-11000 d/dk, restart koruma, Metabo S-automatic emniyet kavcagi.',
    specifications: [
      { key: 'Guc', value: '850 W' },
      { key: 'Disk Capi', value: '125 mm' },
      { key: 'Devir', value: '2800-11000 d/dk' },
      { key: 'Agirlik', value: '2.1 kg' },
    ],
    variants: [],
    images: [`${PLACEHOLDER}/600x600/2B7A2B/fff?text=Taslama`],
    promotions: ['Ucretsiz Kargo', '%10 Indirim Kodu'],
  },
];

/** Helper to get a product as a flat record (for UISpec props). */
export function productAsRecord(p: MockProduct): Record<string, unknown> {
  return {
    sku: p.sku,
    name: p.name,
    brand: p.brand,
    imageUrl: p.imageUrl,
    price: p.price,
    originalPrice: p.originalPrice,
    discountPercent: p.discountPercent,
    rating: p.rating,
    reviewCount: p.reviewCount,
    url: p.url,
    cartCode: p.cartCode,
    inStock: p.inStock,
    description: p.description,
    specifications: p.specifications,
    variants: p.variants,
    images: p.images,
    promotions: p.promotions,
  };
}

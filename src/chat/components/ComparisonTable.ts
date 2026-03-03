/**
 * ComparisonTable — renders a product comparison table with recommended pick,
 * attribute rows, highlights, and optional special cases.
 *
 * XSS safety: All text is set via textContent. Image URLs are validated
 * for safe protocols before being assigned to img.src.
 */

import { sanitizeHtml, isSafeImageUrl } from '../../common/safe-html.js';

/** Fallback display names for common Turkish e-commerce product attributes. */
const CRITERIA_DISPLAY_NAMES: Record<string, string> = {
  screen_size: 'Ekran Boyutu',
  weight: 'Ağırlık',
  battery_capacity: 'Batarya Kapasitesi',
  battery_life: 'Batarya Ömrü',
  storage: 'Depolama',
  memory: 'Bellek',
  ram: 'RAM',
  processor: 'İşlemci',
  camera: 'Kamera',
  resolution: 'Çözünürlük',
  display_type: 'Ekran Tipi',
  refresh_rate: 'Yenileme Hızı',
  color: 'Renk',
  material: 'Malzeme',
  dimensions: 'Boyutlar',
  warranty: 'Garanti',
  connectivity: 'Bağlantı',
  water_resistance: 'Su Dayanıklılığı',
  operating_system: 'İşletim Sistemi',
  brand: 'Marka',
  model: 'Model',
  price: 'Fiyat',
  energy_class: 'Enerji Sınıfı',
  noise_level: 'Gürültü Seviyesi',
  capacity: 'Kapasite',
  power: 'Güç',
  voltage: 'Voltaj',
  width: 'Genişlik',
  height: 'Yükseklik',
  depth: 'Derinlik',
};

/**
 * Map a raw criteria field name to a human-readable label.
 * Uses the Turkish fallback map first, then falls back to a simple
 * formatting heuristic (replace underscores, capitalize first letter).
 */
export function formatCriteriaName(rawName: string): string {
  return CRITERIA_DISPLAY_NAMES[rawName] ?? rawName.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export interface ComparisonProduct {
  sku: string;
  name: string;
  price: string;
  imageUrl?: string | undefined;
  rating?: number | undefined;
  reviewCount?: number | undefined;
}

export interface ComparisonAttribute {
  label: string;
  values: string[];
}

export interface ComparisonTableI18n {
  comparisonHeading?: string;
  recommendedChoiceLabel?: string;
  highlightsLabel?: string;
  keyDifferencesLabel?: string;
  specialCasesLabel?: string;
  addToCartButton?: string;
}

export interface ComparisonTableOptions {
  recommended: ComparisonProduct;
  products: ComparisonProduct[];
  attributes: ComparisonAttribute[];
  highlights: string[];
  specialCases?: string[] | undefined;
  onProductClick: (sku: string) => void;
  onAddToCart?: ((sku: string) => void) | undefined;
  recommendedText?: string | undefined;
  winnerHits?: Record<string, { positive?: string[]; negative?: string[] }> | undefined;
  productActions?: Record<string, { title: string; type: string; payload?: unknown }> | undefined;
  keyDifferencesHtml?: string | undefined;
  i18n?: ComparisonTableI18n | undefined;
}

export function renderComparisonTable(options: ComparisonTableOptions): HTMLElement {
  const { recommended, products, attributes, highlights, specialCases, onProductClick, i18n } = options;

  const container = document.createElement('div');
  container.className = 'gengage-chat-comparison';

  // Heading
  const heading = document.createElement('h3');
  heading.className = 'gengage-chat-comparison-heading';
  heading.textContent = i18n?.comparisonHeading ?? 'KARŞILAŞTIRMA SONUÇLARI';
  container.appendChild(heading);

  // Recommended card
  if (recommended) {
    const recCard = document.createElement('div');
    recCard.className = 'gengage-chat-comparison-recommended';

    const recLabel = document.createElement('div');
    recLabel.className = 'gengage-chat-comparison-recommended-label';
    recLabel.textContent = i18n?.recommendedChoiceLabel ?? 'Önerilen Seçim';
    recCard.appendChild(recLabel);

    const recBody = document.createElement('div');
    recBody.className = 'gengage-chat-comparison-recommended-body';

    if (recommended.imageUrl && isSafeImageUrl(recommended.imageUrl)) {
      const img = document.createElement('img');
      img.src = recommended.imageUrl;
      img.alt = recommended.name;
      img.loading = 'lazy';
      img.addEventListener(
        'error',
        () => {
          img.style.display = 'none';
        },
        { once: true },
      );
      recBody.appendChild(img);
    }

    const info = document.createElement('div');
    info.className = 'gengage-chat-comparison-recommended-info';
    const title = document.createElement('div');
    title.className = 'gengage-chat-comparison-recommended-title';
    title.textContent = recommended.name;
    info.appendChild(title);
    const price = document.createElement('div');
    price.className = 'gengage-chat-comparison-recommended-price';
    price.textContent = recommended.price;
    info.appendChild(price);
    recBody.appendChild(info);

    recBody.addEventListener('click', () => {
      onProductClick(recommended.sku);
    });
    recBody.style.cursor = 'pointer';

    recCard.appendChild(recBody);

    // Highlights
    if (highlights.length > 0) {
      const hlSection = document.createElement('div');
      hlSection.className = 'gengage-chat-comparison-highlights';
      const hlLabel = document.createElement('div');
      hlLabel.className = 'gengage-chat-comparison-highlights-label';
      hlLabel.textContent = i18n?.highlightsLabel ?? 'Öne Çıkan Özellikler';
      hlSection.appendChild(hlLabel);
      const ul = document.createElement('ul');
      for (const hl of highlights) {
        const li = document.createElement('li');
        li.textContent = hl;
        ul.appendChild(li);
      }
      hlSection.appendChild(ul);
      recCard.appendChild(hlSection);
    }

    // Recommended choice explanation
    if (options.recommendedText) {
      const recExplanation = document.createElement('div');
      recExplanation.className = 'gengage-chat-comparison-recommended-text';
      recExplanation.textContent = options.recommendedText;
      recCard.appendChild(recExplanation);
    }

    container.appendChild(recCard);
  }

  // Key Differences section
  if (options.keyDifferencesHtml) {
    const kdSection = document.createElement('div');
    kdSection.className = 'gengage-chat-comparison-key-differences';
    const kdHeading = document.createElement('h4');
    kdHeading.textContent = i18n?.keyDifferencesLabel ?? 'Temel Farklar';
    kdSection.appendChild(kdHeading);
    const kdContent = document.createElement('div');
    kdContent.className = 'gengage-chat-comparison-key-differences-content';
    kdContent.innerHTML = sanitizeHtml(formatKeyDifferences(options.keyDifferencesHtml));
    kdSection.appendChild(kdContent);
    container.appendChild(kdSection);
  }

  // Special cases (expandable)
  if (specialCases && specialCases.length > 0) {
    const special = document.createElement('details');
    special.className = 'gengage-chat-comparison-special';
    const summary = document.createElement('summary');
    summary.textContent = i18n?.specialCasesLabel ?? 'Özel Durumlar İçin';
    special.appendChild(summary);
    const list = document.createElement('ul');
    for (const sc of specialCases) {
      const li = document.createElement('li');
      li.textContent = sc;
      list.appendChild(li);
    }
    special.appendChild(list);
    container.appendChild(special);
  }

  // Comparison table
  if (products.length > 0 && attributes.length > 0) {
    const table = document.createElement('table');
    table.className = 'gengage-chat-comparison-table';

    // Header row: empty cell + product columns
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const emptyTh = document.createElement('th');
    headerRow.appendChild(emptyTh);
    for (const product of products) {
      const th = document.createElement('th');
      if (product.sku === recommended?.sku) {
        th.className = 'gengage-chat-comparison-selected';
      }
      if (product.imageUrl && isSafeImageUrl(product.imageUrl)) {
        const img = document.createElement('img');
        img.src = product.imageUrl;
        img.alt = product.name;
        img.loading = 'lazy';
        img.addEventListener(
          'error',
          () => {
            img.style.display = 'none';
          },
          { once: true },
        );
        th.appendChild(img);
      }
      const name = document.createElement('div');
      name.textContent = product.name;
      th.appendChild(name);
      const prc = document.createElement('div');
      prc.className = 'gengage-chat-comparison-table-price';
      prc.textContent = product.price;
      th.appendChild(prc);
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Attribute rows
    const tbody = document.createElement('tbody');
    for (const attr of attributes) {
      const row = document.createElement('tr');
      const labelTd = document.createElement('td');
      labelTd.className = 'gengage-chat-comparison-label';
      labelTd.textContent = formatCriteriaName(attr.label);
      row.appendChild(labelTd);
      for (let i = 0; i < attr.values.length; i++) {
        const td = document.createElement('td');
        if (products[i]?.sku === recommended?.sku) {
          td.className = 'gengage-chat-comparison-selected';
        }
        td.textContent = attr.values[i] ?? '';
        row.appendChild(td);
      }
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    container.appendChild(table);
  }

  // View product buttons
  if (options.productActions) {
    const btnRow = document.createElement('div');
    btnRow.className = 'gengage-chat-comparison-product-actions';
    for (const product of products) {
      const action = options.productActions[product.sku];
      if (action) {
        const btn = document.createElement('button');
        btn.className = 'gengage-chat-comparison-view-btn';
        btn.type = 'button';
        btn.textContent = product.name;
        btn.addEventListener('click', () => onProductClick(product.sku));
        btnRow.appendChild(btn);
      }
    }
    if (btnRow.childElementCount > 0) {
      container.appendChild(btnRow);
    }
  }

  return container;
}

function formatKeyDifferences(text: string): string {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length <= 1) return text;
  return '<ul>' + lines.map((l) => `<li>${l.trim()}</li>`).join('') + '</ul>';
}

/**
 * ComparisonTable — renders a product comparison table with recommended pick,
 * attribute rows, highlights, and optional special cases.
 *
 * XSS safety: All text is set via textContent. Image URLs are validated
 * for safe protocols before being assigned to img.src.
 */

import { sanitizeHtml, isSafeImageUrl } from '../../common/safe-html.js';
import { formatPrice } from '../../common/price-formatter.js';
import type { PriceFormatConfig } from '../../common/price-formatter.js';

/**
 * Fallback display names for common e-commerce product attributes.
 * Used when the backend sends raw field names (e.g., "screen_size")
 * and no locale-specific criteriaLabels map is provided via i18n.
 */
const CRITERIA_DISPLAY_NAMES: Record<string, string> = {
  screen_size: 'Screen Size',
  weight: 'Weight',
  battery_capacity: 'Battery Capacity',
  battery_life: 'Battery Life',
  storage: 'Storage',
  memory: 'Memory',
  ram: 'RAM',
  processor: 'Processor',
  camera: 'Camera',
  resolution: 'Resolution',
  display_type: 'Display Type',
  refresh_rate: 'Refresh Rate',
  color: 'Color',
  material: 'Material',
  dimensions: 'Dimensions',
  warranty: 'Warranty',
  connectivity: 'Connectivity',
  water_resistance: 'Water Resistance',
  operating_system: 'Operating System',
  brand: 'Brand',
  model: 'Model',
  price: 'Price',
  energy_class: 'Energy Class',
  noise_level: 'Noise Level',
  capacity: 'Capacity',
  power: 'Power',
  voltage: 'Voltage',
  width: 'Width',
  height: 'Height',
  depth: 'Depth',
};

/**
 * Map a raw criteria field name to a human-readable label.
 * Checks locale-specific `criteriaLabels` first (from i18n), then the
 * built-in fallback map, then applies a formatting heuristic.
 */
export function formatCriteriaName(rawName: string, criteriaLabels?: Record<string, string>): string {
  return (
    criteriaLabels?.[rawName] ??
    CRITERIA_DISPLAY_NAMES[rawName] ??
    rawName.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
  );
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
  /** Locale-specific attribute display names (e.g., { screen_size: 'Screen Size' }). */
  criteriaLabels?: Record<string, string>;
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
  pricing?: PriceFormatConfig | undefined;
}

export function renderComparisonTable(options: ComparisonTableOptions): HTMLElement {
  const { recommended, products, attributes, highlights, specialCases, onProductClick, i18n } = options;

  const container = document.createElement('div');
  container.className = 'gengage-chat-comparison';

  // Heading
  const heading = document.createElement('h3');
  heading.className = 'gengage-chat-comparison-heading';
  heading.textContent = i18n?.comparisonHeading ?? 'COMPARISON RESULTS';
  container.appendChild(heading);

  // Recommended card
  if (recommended) {
    const recCard = document.createElement('div');
    recCard.className = 'gengage-chat-comparison-recommended';

    const recLabel = document.createElement('div');
    recLabel.className = 'gengage-chat-comparison-recommended-label';
    recLabel.textContent = i18n?.recommendedChoiceLabel ?? 'Recommended Choice';
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
    price.textContent = formatPrice(recommended.price, options.pricing);
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
      hlLabel.textContent = i18n?.highlightsLabel ?? 'Key Highlights';
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
      recExplanation.innerHTML = sanitizeHtml(options.recommendedText);
      recCard.appendChild(recExplanation);
    }

    container.appendChild(recCard);
  }

  // Key Differences section
  if (options.keyDifferencesHtml) {
    const kdSection = document.createElement('div');
    kdSection.className = 'gengage-chat-comparison-key-differences';
    const kdHeading = document.createElement('h4');
    kdHeading.textContent = i18n?.keyDifferencesLabel ?? 'Key Differences';
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
    summary.textContent = i18n?.specialCasesLabel ?? 'For Special Cases';
    special.appendChild(summary);
    const list = document.createElement('ul');
    for (const sc of specialCases) {
      appendSpecialCaseListItems(list, sc);
    }
    if (list.childElementCount > 0) {
      special.appendChild(list);
    }
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
      prc.textContent = formatPrice(product.price, options.pricing);
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
      labelTd.textContent = formatCriteriaName(attr.label, i18n?.criteriaLabels);
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
  // If the backend already sent HTML with list elements, pass through as-is
  if (/<[uo]l[\s>]/i.test(text) || /<li[\s>]/i.test(text)) return text;
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length <= 1) return text;
  return '<ul>' + lines.map((l) => `<li>${l.trim()}</li>`).join('') + '</ul>';
}

function appendSpecialCaseListItems(list: HTMLUListElement, raw: string): void {
  const sanitized = sanitizeHtml(raw);
  if (!sanitized) return;

  const template = document.createElement('template');
  template.innerHTML = sanitized;
  const nestedItems = Array.from(template.content.querySelectorAll('li'));
  if (nestedItems.length > 0) {
    for (const nestedItem of nestedItems) {
      const li = document.createElement('li');
      li.innerHTML = sanitizeHtml(nestedItem.innerHTML);
      list.appendChild(li);
    }
    return;
  }

  const li = document.createElement('li');
  if (looksLikeHtml(raw)) {
    li.innerHTML = sanitized;
  } else {
    li.textContent = raw;
  }
  list.appendChild(li);
}

function looksLikeHtml(text: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(text);
}

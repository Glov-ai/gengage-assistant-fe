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
  viewMoreLabel?: string;
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

function hasRenderablePrice(raw: string | undefined): raw is string {
  if (typeof raw !== 'string') return false;
  const num = Number(raw);
  return Number.isFinite(num) && num > 0;
}

function hasRenderableRating(raw: number | string | undefined): raw is number | string {
  const num = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  return Number.isFinite(num) && num > 0;
}

function createRatingBadge(raw: number | string): HTMLElement {
  const value = typeof raw === 'number' ? raw : Number(raw);
  const badge = document.createElement('div');
  badge.className = 'gengage-chat-comparison-recommended-rating';
  badge.innerHTML =
    '<span class="gengage-chat-comparison-recommended-rating-icon" aria-hidden="true">' +
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.6l2.58 5.23 5.77.84-4.17 4.07.98 5.75L12 16.78l-5.16 2.71.99-5.75L3.66 9.67l5.76-.84L12 3.6z"/></svg>' +
    '</span>';
  const label = document.createElement('span');
  label.className = 'gengage-chat-comparison-recommended-rating-value';
  label.textContent = value.toFixed(1);
  badge.appendChild(label);
  return badge;
}

export function renderComparisonTable(options: ComparisonTableOptions): HTMLElement {
  const { recommended, products, attributes, highlights, specialCases, onProductClick, i18n } = options;

  const container = document.createElement('div');
  container.className = 'gengage-chat-comparison';
  container.dataset['gengagePart'] = 'comparison-dialog';
  container.setAttribute('role', 'dialog');
  container.setAttribute('aria-label', i18n?.comparisonHeading ?? 'Comparison Results');

  // Recommended card
  if (recommended) {
    const recCard = document.createElement('article');
    recCard.className = 'gengage-chat-comparison-recommended gds-card';
    recCard.dataset['gengagePart'] = 'comparison-recommended-card';

    const recLabel = document.createElement('div');
    recLabel.className = 'gengage-chat-comparison-recommended-label';
    recLabel.textContent = i18n?.recommendedChoiceLabel ?? 'Recommended Choice';
    recCard.appendChild(recLabel);

    const recBody = document.createElement('div');
    recBody.className = 'gengage-chat-comparison-recommended-body';
    recBody.classList.add('gds-clickable');
    recBody.tabIndex = 0;
    recBody.setAttribute('role', 'button');
    recBody.setAttribute('aria-label', recommended.name);

    const media = document.createElement('div');
    media.className = 'gengage-chat-comparison-recommended-media';
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
      media.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'gengage-chat-comparison-recommended-placeholder';
      placeholder.setAttribute('aria-hidden', 'true');
      media.appendChild(placeholder);
    }
    recBody.appendChild(media);

    const info = document.createElement('div');
    info.className = 'gengage-chat-comparison-recommended-info';
    const title = document.createElement('div');
    title.className = 'gengage-chat-comparison-recommended-title';
    title.textContent = recommended.name;
    info.appendChild(title);
    const meta = document.createElement('div');
    meta.className = 'gengage-chat-comparison-recommended-meta';
    if (hasRenderableRating(recommended.rating)) {
      meta.appendChild(createRatingBadge(recommended.rating!));
    }
    if (hasRenderablePrice(recommended.price)) {
      const price = document.createElement('div');
      price.className = 'gengage-chat-comparison-recommended-price';
      price.textContent = formatPrice(recommended.price, options.pricing);
      meta.appendChild(price);
    }
    if (meta.childElementCount > 0) info.appendChild(meta);
    if (options.recommendedText) {
      const recExplanation = document.createElement('p');
      recExplanation.className = 'gengage-chat-comparison-recommended-text';
      recExplanation.innerHTML = sanitizeHtml(options.recommendedText);
      info.appendChild(recExplanation);
    }
    recBody.appendChild(info);

    const openRecommended = (): void => {
      onProductClick(recommended.sku);
    };
    recBody.addEventListener('click', openRecommended);
    recBody.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      openRecommended();
    });

    recCard.appendChild(recBody);

    // Supporting bullets
    if (highlights.length > 0) {
      const hlSection = document.createElement('div');
      hlSection.className = 'gengage-chat-comparison-highlights';
      hlSection.dataset['gengagePart'] = 'comparison-highlights';
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

    container.appendChild(recCard);
  }

  // Key Differences section
  if (options.keyDifferencesHtml) {
    const kdSection = document.createElement('details');
    kdSection.className = 'gengage-chat-comparison-key-differences';
    kdSection.dataset['gengagePart'] = 'comparison-key-differences';
    const kdSummary = document.createElement('summary');
    kdSummary.className = 'gengage-chat-comparison-key-differences-summary';
    const kdLabel = document.createElement('span');
    kdLabel.className = 'gengage-chat-comparison-key-differences-summary-label';
    kdLabel.textContent = i18n?.keyDifferencesLabel ?? 'Key Differences';
    const kdMeta = document.createElement('span');
    kdMeta.className = 'gengage-chat-comparison-key-differences-summary-meta';
    kdMeta.textContent = i18n?.viewMoreLabel ?? 'Show More';
    kdSummary.appendChild(kdLabel);
    kdSummary.appendChild(kdMeta);
    kdSection.appendChild(kdSummary);
    const kdContent = document.createElement('div');
    kdContent.className = 'gengage-chat-comparison-key-differences-content';
    kdContent.innerHTML = sanitizeHtml(formatKeyDifferences(options.keyDifferencesHtml));
    kdSection.appendChild(kdContent);
    container.appendChild(kdSection);
  }

  // Special cases (expandable)
  if (specialCases && specialCases.length > 0) {
    const special = document.createElement('details');
    special.className = 'gengage-chat-comparison-special gds-evidence-card gds-evidence-card-warning';
    special.dataset['gengagePart'] = 'comparison-special-cases';
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
    table.className = 'gengage-chat-comparison-table gds-comparison-table';

    // Header row: empty cell + product columns
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const emptyTh = document.createElement('th');
    headerRow.appendChild(emptyTh);
    for (const product of products) {
      const th = document.createElement('th');
      if (product.sku === recommended?.sku) {
        th.className = 'gengage-chat-comparison-selected gds-comparison-table-winner-cell';
      }
      const headerCell = document.createElement('div');
      headerCell.className =
        'gengage-chat-comparison-table-header-cell gengage-chat-comparison-table-header-cell--clickable gds-clickable';
      headerCell.tabIndex = 0;
      headerCell.setAttribute('role', 'button');
      headerCell.setAttribute('aria-label', product.name);
      headerCell.title = product.name;
      const openProduct = (): void => {
        onProductClick(product.sku);
      };
      headerCell.addEventListener('click', openProduct);
      headerCell.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openProduct();
      });
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
        headerCell.appendChild(img);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'gengage-chat-comparison-table-header-img-placeholder';
        placeholder.setAttribute('aria-hidden', 'true');
        headerCell.appendChild(placeholder);
      }
      const name = document.createElement('div');
      name.className = 'gengage-chat-comparison-table-product-name';
      name.textContent = product.name;
      headerCell.appendChild(name);
      if (hasRenderablePrice(product.price)) {
        const prc = document.createElement('div');
        prc.className = 'gengage-chat-comparison-table-price';
        prc.textContent = formatPrice(product.price, options.pricing);
        headerCell.appendChild(prc);
      }
      th.appendChild(headerCell);
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
          td.className = 'gengage-chat-comparison-selected gds-comparison-table-winner-cell';
        }
        td.textContent = attr.values[i] ?? '';
        row.appendChild(td);
      }
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    // Wrap in a scrollable container so the table scrolls independently
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'gengage-chat-comparison-table-wrapper';
    tableWrapper.dataset['gengagePart'] = 'comparison-table-wrapper';
    tableWrapper.appendChild(table);
    container.appendChild(tableWrapper);
  }

  // Focus trap: keep Tab cycling within the comparison dialog
  container.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const focusables = container.querySelectorAll<HTMLElement>(
      'button, [href], input, [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

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

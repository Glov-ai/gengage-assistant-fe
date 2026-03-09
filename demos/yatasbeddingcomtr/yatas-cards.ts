/**
 * Yataş Bedding — Custom product card renderers.
 *
 * Matches the Yataş Figma prototype (Dekstop & Mobile & App, frame 23).
 * Single core card builder used across all contexts: SimRel cards, Chat
 * search results, and Chat product detail panels.
 *
 * This file is self-contained — it only depends on SDK types, not internals.
 */

import type {
  UISpecDomComponentRenderParams,
  SimRelUISpecRenderContext,
  ChatUISpecRenderContext,
  SimilarProduct,
} from '@gengage/assistant-fe';

// ---------------------------------------------------------------------------
// Yataş-specific extras shape (narrowed from product.extras)
// ---------------------------------------------------------------------------

interface YatasColorSwatch {
  color: string;
  label?: string;
}

interface YatasAttribute {
  icon?: string;
  label: string;
  value: string;
  indicators?: Array<{ color: string; active?: boolean }>;
}

interface YatasProductExtras {
  colorSwatches?: YatasColorSwatch[];
  attributes?: YatasAttribute[];
  features?: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HEART_OUTLINE_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`;

const HEART_FILLED_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`;

const RESIZE_ICON_SVG = `<svg class="yatas-card__attr-icon" viewBox="0 0 16 16" fill="none" stroke="#22d3ee" stroke-width="1.5"><path d="M2 6V2h4M14 10v4h-4M2 2l5 5M14 14l-5-5"/></svg>`;

function formatTurkishPrice(raw: string | undefined): string {
  if (!raw) return '';
  const num = parseFloat(raw);
  if (!Number.isFinite(num)) return raw;
  const [whole, dec] = num.toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${grouped},${dec} TL`;
}

function safeImgSrc(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url, location.href);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function getExtras(obj: Record<string, unknown>): YatasProductExtras {
  const extras = obj['extras'];
  if (extras && typeof extras === 'object') return extras as YatasProductExtras;
  return {};
}

// ---------------------------------------------------------------------------
// Wishlist state (closure-captured, demo-only)
// ---------------------------------------------------------------------------

const wishlistedSkus = new Set<string>();
const wishlistListeners: Array<(sku: string, active: boolean) => void> = [];

export function onWishlistChange(cb: (sku: string, active: boolean) => void): void {
  wishlistListeners.push(cb);
}

function toggleWishlist(sku: string, btn: HTMLButtonElement): void {
  const isActive = wishlistedSkus.has(sku);
  if (isActive) {
    wishlistedSkus.delete(sku);
  } else {
    wishlistedSkus.add(sku);
  }
  btn.classList.toggle('yatas-card__wishlist--active', !isActive);
  btn.innerHTML = !isActive ? HEART_FILLED_SVG : HEART_OUTLINE_SVG;
  for (const cb of wishlistListeners) cb(sku, !isActive);
}

// ---------------------------------------------------------------------------
// Shared DOM builders
// ---------------------------------------------------------------------------

function buildSwatches(swatches: YatasColorSwatch[], className: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = className;
  for (const sw of swatches) {
    const dot = document.createElement('span');
    dot.className = 'yatas-card__swatch';
    dot.style.backgroundColor = sw.color;
    if (sw.label) dot.title = sw.label;
    wrap.appendChild(dot);
  }
  return wrap;
}

function buildRating(rating: number, reviewCount?: number): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'yatas-card__rating';

  const star = document.createElement('span');
  star.className = 'yatas-card__rating-star';
  star.textContent = '\u2605';
  wrap.appendChild(star);

  const score = document.createElement('span');
  score.className = 'yatas-card__rating-score';
  score.textContent = rating.toFixed(1);
  wrap.appendChild(score);

  if (reviewCount != null) {
    const count = document.createElement('span');
    count.className = 'yatas-card__rating-count';
    count.textContent = `(${reviewCount})`;
    wrap.appendChild(count);
  }

  return wrap;
}

function buildAttributes(attrs: YatasAttribute[]): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'yatas-card__attributes';

  for (const attr of attrs) {
    const attrEl = document.createElement('div');
    attrEl.className = 'yatas-card__attr';

    if (attr.icon === 'resize') {
      const iconWrap = document.createElement('span');
      iconWrap.innerHTML = RESIZE_ICON_SVG;
      attrEl.appendChild(iconWrap.firstElementChild!);
    }

    const text = document.createElement('span');
    text.textContent = `${attr.label}${attr.value ? ' ' + attr.value : ''}`;
    attrEl.appendChild(text);

    if (attr.indicators && attr.indicators.length > 0) {
      const dots = document.createElement('span');
      dots.className = 'yatas-card__attr-indicators';
      for (const ind of attr.indicators) {
        const dot = document.createElement('span');
        dot.className = 'yatas-card__attr-dot';
        if (ind.active) dot.classList.add('yatas-card__attr-dot--active');
        dot.style.backgroundColor = ind.active ? ind.color : '';
        dots.appendChild(dot);
      }
      attrEl.appendChild(dots);
    }

    wrap.appendChild(attrEl);
  }

  return wrap;
}

function featureToString(feat: unknown): string | null {
  if (typeof feat === 'string') return feat;
  if (feat && typeof feat === 'object') {
    const obj = feat as Record<string, unknown>;
    // Common backend shapes: {title, description}, {label, value}, {text}
    const text = obj['title'] ?? obj['label'] ?? obj['text'] ?? obj['name'];
    if (typeof text === 'string') return text;
  }
  return null;
}

function buildFeatures(features: unknown[]): HTMLElement {
  const list = document.createElement('ul');
  list.className = 'yatas-card__features';
  for (const feat of features) {
    const text = featureToString(feat);
    if (!text) continue;
    const li = document.createElement('li');
    li.className = 'yatas-card__feature';
    li.textContent = text;
    list.appendChild(li);
  }
  return list;
}

function buildWishlistButton(sku: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'yatas-card__wishlist';
  const isActive = wishlistedSkus.has(sku);
  if (isActive) btn.classList.add('yatas-card__wishlist--active');
  btn.innerHTML = isActive ? HEART_FILLED_SVG : HEART_OUTLINE_SVG;
  btn.setAttribute('aria-label', 'Favorilere ekle');
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(sku, btn);
  });
  return btn;
}

// ---------------------------------------------------------------------------
// Core card builder — single source of truth for the Yataş product card
// ---------------------------------------------------------------------------

interface ProductFields {
  sku: string;
  name: string;
  url: string;
  imageUrl?: string;
  price?: string;
  originalPrice?: string;
  discountPercent?: number;
  brand?: string;
  rating?: number;
  reviewCount?: number;
  extras: YatasProductExtras;
}

function extractProductFields(raw: Record<string, unknown>): ProductFields | null {
  const sku = raw['sku'] as string;
  const name = raw['name'] as string;
  const url = raw['url'] as string;
  if (!sku || !name) return null;
  return {
    sku,
    name,
    url: url ?? '',
    imageUrl: raw['imageUrl'] as string | undefined,
    price: raw['price'] as string | undefined,
    originalPrice: raw['originalPrice'] as string | undefined,
    discountPercent: raw['discountPercent'] as number | undefined,
    brand: raw['brand'] as string | undefined,
    rating: raw['rating'] as number | undefined,
    reviewCount: raw['reviewCount'] as number | undefined,
    extras: getExtras(raw),
  };
}

function buildYatasProductCard(fields: ProductFields): HTMLElement {
  const { sku, name, imageUrl, price, originalPrice, discountPercent, brand, rating, reviewCount, extras } = fields;

  const card = document.createElement('article');
  card.className = 'yatas-card';
  card.setAttribute('role', 'listitem');
  card.dataset['sku'] = sku;

  // Image wrapper
  const imgWrap = document.createElement('div');
  imgWrap.className = 'yatas-card__img-wrap';

  if (extras.colorSwatches && extras.colorSwatches.length > 0) {
    imgWrap.appendChild(buildSwatches(extras.colorSwatches, 'yatas-card__swatches'));
  }

  imgWrap.appendChild(buildWishlistButton(sku));

  if (discountPercent && discountPercent > 0) {
    const badge = document.createElement('span');
    badge.className = 'yatas-card__discount-badge';
    badge.textContent = `%${Math.round(discountPercent)}`;
    imgWrap.appendChild(badge);
  }

  if (imageUrl && safeImgSrc(imageUrl)) {
    const img = document.createElement('img');
    img.className = 'yatas-card__img';
    img.src = imageUrl;
    img.alt = name;
    img.loading = 'lazy';
    img.addEventListener('error', () => {
      img.style.display = 'none';
    });
    imgWrap.appendChild(img);
  }

  card.appendChild(imgWrap);

  // Body
  const body = document.createElement('div');
  body.className = 'yatas-card__body';

  const header = document.createElement('div');
  header.className = 'yatas-card__header';

  const nameEl = document.createElement('h3');
  nameEl.className = 'yatas-card__name';
  nameEl.textContent = name;
  header.appendChild(nameEl);

  if (rating != null && rating > 0) {
    header.appendChild(buildRating(rating, reviewCount));
  }

  body.appendChild(header);

  if (extras.attributes && extras.attributes.length > 0) {
    body.appendChild(buildAttributes(extras.attributes));
  }

  if (extras.features && extras.features.length > 0) {
    body.appendChild(buildFeatures(extras.features));
  }

  // Price row
  const priceRow = document.createElement('div');
  priceRow.className = 'yatas-card__price-row';

  const prices = document.createElement('div');
  prices.className = 'yatas-card__prices';

  if (price) {
    const currentEl = document.createElement('span');
    currentEl.className = 'yatas-card__price-current';
    currentEl.textContent = formatTurkishPrice(price);
    prices.appendChild(currentEl);
  }

  if (originalPrice && originalPrice !== price) {
    const origEl = document.createElement('span');
    origEl.className = 'yatas-card__price-original';
    origEl.textContent = formatTurkishPrice(originalPrice);
    prices.appendChild(origEl);
  }

  priceRow.appendChild(prices);

  if (brand) {
    const brandEl = document.createElement('span');
    brandEl.className = 'yatas-card__brand';
    brandEl.textContent = brand;
    priceRow.appendChild(brandEl);
  }

  body.appendChild(priceRow);
  card.appendChild(body);

  return card;
}

// ---------------------------------------------------------------------------
// renderCardElement — direct path for SimRel (GroupTabs → ProductGrid)
// Also usable in any context that has (product, index) → HTMLElement | null
// ---------------------------------------------------------------------------

export function renderYatasCardElement(product: SimilarProduct, _index: number): HTMLElement | null {
  const fields = extractProductFields(product as unknown as Record<string, unknown>);
  if (!fields) return null;
  return buildYatasProductCard(fields);
}

// ---------------------------------------------------------------------------
// SimRel UISpec registry override (UISpec path)
// ---------------------------------------------------------------------------

export function renderYatasSimRelCard(
  params: UISpecDomComponentRenderParams<SimRelUISpecRenderContext>,
): HTMLElement | null {
  const { element, context } = params;
  const productRaw = (element.props?.['product'] ?? element.props) as Record<string, unknown> | undefined;
  if (!productRaw || typeof productRaw !== 'object') return null;

  const fields = extractProductFields(productRaw);
  if (!fields) return null;

  const card = buildYatasProductCard(fields);
  // Add simrel-specific class for grid layout
  card.classList.add('gengage-simrel-card');

  card.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('.yatas-card__wishlist')) return;
    context.onClick({
      sku: fields.sku,
      name: fields.name,
      url: fields.url,
      imageUrl: fields.imageUrl,
      price: fields.price,
      originalPrice: fields.originalPrice,
      brand: fields.brand,
      rating: fields.rating,
      reviewCount: fields.reviewCount,
    } as SimilarProduct);
  });

  return card;
}

// ---------------------------------------------------------------------------
// Chat ProductCard registry override — same card in chat search results
// ---------------------------------------------------------------------------

export function renderYatasChatProductCard(
  params: UISpecDomComponentRenderParams<ChatUISpecRenderContext>,
): HTMLElement | null {
  const { element, context } = params;
  const productRaw = (element.props?.['product'] ?? element.props) as Record<string, unknown> | undefined;
  if (!productRaw || typeof productRaw !== 'object') return null;

  const fields = extractProductFields(productRaw);
  if (!fields) return null;

  const card = buildYatasProductCard(fields);
  card.classList.add('gengage-chat-product-card');
  card.style.cursor = 'pointer';

  // CTA button — "İncele" / navigate to product
  const url = productRaw['url'] as string | undefined;
  if (url && fields.sku) {
    const cta = document.createElement('button');
    cta.className = 'yatas-card__cta';
    cta.type = 'button';
    cta.textContent = 'İncele';
    cta.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (context.onProductClick) {
        context.onProductClick({ sku: fields.sku, url });
      }
    });
    card.appendChild(cta);
  }

  // Add to cart button
  const cartCode = productRaw['cartCode'] as string | undefined;
  const inStock = productRaw['inStock'];
  if (cartCode && fields.sku && inStock !== false && context.onAddToCart) {
    const atcBtn = document.createElement('button');
    atcBtn.className = 'yatas-card__atc';
    atcBtn.type = 'button';
    atcBtn.textContent = 'Sepete Ekle';
    atcBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      context.onAddToCart!({ sku: fields.sku, cartCode, quantity: 1 });
    });
    card.appendChild(atcBtn);
  }

  // Card click → select product for detail panel
  card.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('.yatas-card__wishlist')) return;
    if (target.closest('.yatas-card__cta')) return;
    if (target.closest('.yatas-card__atc')) return;
    if (context.onProductSelect) {
      context.onProductSelect(productRaw);
    }
  });

  return card;
}

// ---------------------------------------------------------------------------
// Chat ProductDetailsPanel override
// ---------------------------------------------------------------------------

export function renderYatasProductDetailsPanel(
  params: UISpecDomComponentRenderParams<ChatUISpecRenderContext>,
): HTMLElement | null {
  const { element, context } = params;
  const productRaw = element.props?.['product'] as Record<string, unknown> | undefined;
  if (!productRaw || typeof productRaw !== 'object') return null;

  const fields = extractProductFields(productRaw);
  if (!fields) return null;

  const images = productRaw['images'] as string[] | undefined;
  const extras = fields.extras;

  const panel = document.createElement('article');
  panel.className = 'yatas-panel-product';

  // Gallery
  const gallery = document.createElement('div');
  gallery.className = 'yatas-panel-product__gallery';

  const primaryImage = images?.[0] ?? fields.imageUrl;
  if (primaryImage && safeImgSrc(primaryImage)) {
    const img = document.createElement('img');
    img.src = primaryImage;
    img.alt = fields.name;
    img.addEventListener('error', () => {
      img.style.display = 'none';
    });
    gallery.appendChild(img);
  }

  if (extras.colorSwatches && extras.colorSwatches.length > 0) {
    const sw = buildSwatches(extras.colorSwatches, 'yatas-panel-product__swatches');
    sw.style.position = 'absolute';
    sw.style.bottom = '10px';
    sw.style.left = '10px';
    gallery.appendChild(sw);
  }

  panel.appendChild(gallery);

  // Header: name + rating
  const header = document.createElement('div');
  header.className = 'yatas-panel-product__header';

  const nameEl = document.createElement('h2');
  nameEl.className = 'yatas-panel-product__name';
  nameEl.textContent = fields.name;
  header.appendChild(nameEl);

  if (fields.rating != null && fields.rating > 0) {
    header.appendChild(buildRating(fields.rating, fields.reviewCount));
  }

  panel.appendChild(header);

  // Attributes
  if (extras.attributes && extras.attributes.length > 0) {
    const attrsWrap = document.createElement('div');
    attrsWrap.className = 'yatas-panel-product__attributes';
    for (const attr of extras.attributes) {
      const attrEl = document.createElement('div');
      attrEl.className = 'yatas-panel-product__attr';
      attrEl.textContent = `${attr.label} ${attr.value}`;
      attrsWrap.appendChild(attrEl);
    }
    panel.appendChild(attrsWrap);
  }

  // Features
  if (extras.features && extras.features.length > 0) {
    const list = document.createElement('ul');
    list.className = 'yatas-panel-product__features';
    for (const feat of extras.features) {
      const text = featureToString(feat);
      if (!text) continue;
      const li = document.createElement('li');
      li.className = 'yatas-panel-product__feature';
      li.textContent = text;
      list.appendChild(li);
    }
    if (list.children.length > 0) panel.appendChild(list);
  }

  // Price row
  const priceRow = document.createElement('div');
  priceRow.className = 'yatas-panel-product__price-row';

  const prices = document.createElement('div');
  prices.className = 'yatas-card__prices';

  if (fields.price) {
    const currentEl = document.createElement('span');
    currentEl.className = 'yatas-panel-product__price-current';
    currentEl.textContent = formatTurkishPrice(fields.price);
    prices.appendChild(currentEl);
  }

  if (fields.originalPrice && fields.originalPrice !== fields.price) {
    const origEl = document.createElement('span');
    origEl.className = 'yatas-panel-product__price-original';
    origEl.textContent = formatTurkishPrice(fields.originalPrice);
    prices.appendChild(origEl);
  }

  priceRow.appendChild(prices);

  if (fields.brand) {
    const brandEl = document.createElement('span');
    brandEl.className = 'yatas-panel-product__brand';
    brandEl.textContent = fields.brand;
    priceRow.appendChild(brandEl);
  }

  panel.appendChild(priceRow);

  // CTA button
  const cta = document.createElement('button');
  cta.className = 'yatas-panel-product__cta';
  cta.type = 'button';
  cta.textContent = 'Ürünü İncele';
  cta.addEventListener('click', (e) => {
    e.preventDefault();
    if (context.onProductClick) {
      context.onProductClick({ sku: fields.sku, url: fields.url });
    }
  });
  panel.appendChild(cta);

  return panel;
}

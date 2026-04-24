import { bootstrapSession } from '../../src/common/context.js';
import { consumeStream } from '../../src/common/streaming.js';

interface DemoShellProduct {
  sku: string;
  name: string;
  brand?: string;
  images?: string[];
  price?: number;
  price_discounted?: number;
  price_currency?: string;
  promotions?: string[];
  rating?: number;
  review_count?: number;
  description?: string;
  features?: Array<{ name?: string; value?: string | number | boolean }>;
  facet_hits?: Record<string, unknown> | null;
  category_names?: string[];
}

export interface DemoShellOptions {
  accountId: string;
  sku: string;
  middlewareUrl: string;
  brandName: string;
  locale?: string;
  currencyLocale?: string;
}

interface BrandAvatarOptions {
  brandName: string;
  primaryColor: string;
  textColor?: string;
  backgroundColor?: string;
}

const DEMO_SHELL_FETCH_TIMEOUT_MS = 8000;

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function initialsForBrand(brandName: string): string {
  const words = brandName
    .split(/[^A-Za-z0-9]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (words.length >= 2) return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
  const compact = brandName.replace(/[^A-Za-z0-9]/g, '').slice(0, 2);
  return (compact || brandName.slice(0, 1) || 'G').toUpperCase();
}

export function createBrandAvatarDataUrl(options: BrandAvatarOptions): string {
  const label = initialsForBrand(options.brandName);
  const primaryColor = options.primaryColor;
  const textColor = options.textColor ?? '#ffffff';
  const backgroundColor = options.backgroundColor ?? '#ffffff';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" role="img" aria-label="${escapeXml(options.brandName)}">
      <rect width="128" height="128" rx="64" fill="${escapeXml(backgroundColor)}" />
      <circle cx="64" cy="64" r="58" fill="${escapeXml(primaryColor)}" />
      <circle cx="64" cy="64" r="49" fill="${escapeXml(primaryColor)}" opacity="0.15" />
      <text x="64" y="73" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="700" fill="${escapeXml(textColor)}">${escapeXml(label)}</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function injectSharedDemoShellStyles(): void {
  if (document.getElementById('gengage-demo-shell-style') != null) return;
  const style = document.createElement('style');
  style.id = 'gengage-demo-shell-style';
  style.textContent = `
    .gengage-demo-gallery-stage {
      position: relative;
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      gap: 10px;
      text-align: center;
    }

    .gengage-demo-gallery-image {
      max-width: 100%;
      max-height: min(100%, 420px);
      object-fit: contain;
      filter: drop-shadow(0 18px 36px rgba(17, 24, 39, 0.16));
    }

    .gengage-demo-gallery-caption {
      color: var(--brand-muted, #6b7280);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }

    .gallery-thumb img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
      padding: 6px;
    }
  `;
  document.head.append(style);
}

interface DemoShellI18n {
  home: string;
  productCode: string;
  ratingFallback: string;
  reviewsLabel: string;
  discountLabel: string;
  demoLabel: string;
  galleryCaption: string;
  mainImageAltSuffix: string;
  thumbnailAltPrefix: string;
}

function getDemoShellI18n(locale?: string): DemoShellI18n {
  const normalized = (locale ?? 'tr').toLowerCase();
  if (normalized.startsWith('en')) {
    return {
      home: 'Home',
      productCode: 'Product Code',
      ratingFallback: 'No rating yet',
      reviewsLabel: 'reviews',
      discountLabel: 'Off',
      demoLabel: 'Demo',
      galleryCaption: 'PDP Demo',
      mainImageAltSuffix: 'main product image',
      thumbnailAltPrefix: 'thumbnail',
    };
  }

  return {
    home: 'Anasayfa',
    productCode: 'Ürün Kodu',
    ratingFallback: 'Henüz değerlendirme yok',
    reviewsLabel: 'değerlendirme',
    discountLabel: 'İndirim',
    demoLabel: 'Demo',
    galleryCaption: 'PDP Demo',
    mainImageAltSuffix: 'ana ürün görseli',
    thumbnailAltPrefix: 'küçük görsel',
  };
}

function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function summarizeText(raw?: string): string {
  if (!raw) return '';
  const clean = stripHtml(raw);
  if (clean.length <= 320) return clean;
  return `${clean.slice(0, 317).trimEnd()}...`;
}

function collectHighlights(product: DemoShellProduct): string[] {
  const fromFeatures =
    product.features
      ?.map((feature) => {
        const name = `${feature.name ?? ''}`.trim();
        const value = `${feature.value ?? ''}`.trim();
        if (name === '' || value === '') return '';
        return `${name}: ${value}`;
      })
      .filter(Boolean) ?? [];

  if (fromFeatures.length > 0) return fromFeatures.slice(0, 5);

  const fromFacetHits =
    Object.entries(product.facet_hits ?? {})
      .map(([key, value]) => {
        const label = key.trim();
        const text = `${value ?? ''}`.trim();
        if (label === '' || text === '') return '';
        return `${label}: ${text}`;
      })
      .filter(Boolean) ?? [];

  if (fromFacetHits.length > 0) return fromFacetHits.slice(0, 5);
  return (product.promotions ?? []).slice(0, 5);
}

function priceLocale(currency?: string, preferred?: string): string {
  if (preferred) return preferred;
  if (currency === 'GBP') return 'en-GB';
  if (currency === 'USD') return 'en-US';
  return 'tr-TR';
}

function formatMoney(value: number | undefined, currency = 'TRY', preferredLocale?: string): string {
  if (value == null || Number.isNaN(value)) return '';
  return new Intl.NumberFormat(priceLocale(currency, preferredLocale), {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function productFromStreamEvent(event: unknown): DemoShellProduct | null {
  const candidate = event as {
    type?: string;
    payload?: { productDetails?: DemoShellProduct };
  };
  if (candidate.type === 'productDetails' && candidate.payload?.productDetails?.name) {
    return candidate.payload.productDetails;
  }
  return null;
}

async function fetchDemoProduct(options: DemoShellOptions): Promise<DemoShellProduct | null> {
  const url = `${options.middlewareUrl.replace(/\/+$/, '')}/chat/process_action`;
  const sessionId = bootstrapSession();
  const payload = {
    account_id: options.accountId,
    session_id: sessionId,
    correlation_id: sessionId,
    type: 'launchSingleProduct',
    payload: { sku: options.sku },
    sku: options.sku,
    page_type: 'pdp',
    locale: options.locale ?? 'tr',
  };

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), DEMO_SHELL_FETCH_TIMEOUT_MS);
  let product: DemoShellProduct | null = null;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    await consumeStream(response, {
      signal: controller.signal,
      idleTimeoutMs: DEMO_SHELL_FETCH_TIMEOUT_MS,
      onEvent: (event) => {
        const nextProduct = productFromStreamEvent(event);
        if (nextProduct == null) return;
        product = nextProduct;
        controller.abort();
      },
    });
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      throw error;
    }
  } finally {
    window.clearTimeout(timeoutId);
  }

  return product;
}

function renderFeatureItems(items: string[]): string {
  return items.map((item) => `<li>${escapeXml(item)}</li>`).join('');
}

function replaceGallery(
  main: HTMLElement,
  thumbs: HTMLElement | null,
  product: DemoShellProduct,
  options: DemoShellOptions,
): void {
  const safeImages = (product.images ?? []).filter((value) => /^https?:\/\//.test(value));
  if (safeImages.length === 0) return;
  const i18n = getDemoShellI18n(options.locale);

  injectSharedDemoShellStyles();

  main.textContent = '';
  const stage = document.createElement('div');
  stage.className = 'gengage-demo-gallery-stage';

  const image = document.createElement('img');
  image.className = 'gengage-demo-gallery-image';
  image.src = safeImages[0];
  image.alt = `${product.name} ${i18n.mainImageAltSuffix}`;
  stage.append(image);

  const caption = document.createElement('div');
  caption.className = 'gengage-demo-gallery-caption';
  caption.textContent = product.brand ? `${product.brand} ${i18n.galleryCaption}` : i18n.galleryCaption;
  stage.append(caption);
  main.append(stage);

  if (thumbs == null) return;
  thumbs.textContent = '';
  safeImages.slice(0, 4).forEach((imageUrl, index) => {
    const thumb = document.createElement('div');
    thumb.className = 'gallery-thumb';
    if (index === 0) thumb.style.borderColor = 'color-mix(in srgb, var(--brand-primary) 38%, white)';
    const thumbImage = document.createElement('img');
    thumbImage.src = imageUrl;
    thumbImage.alt = `${product.name} ${i18n.thumbnailAltPrefix} ${index + 1}`;
    thumb.append(thumbImage);
    thumbs.append(thumb);
  });
}

export function applyDemoProductToHostShell(product: DemoShellProduct, options: DemoShellOptions): void {
  const i18n = getDemoShellI18n(options.locale);
  const title = document.querySelector<HTMLElement>('.summary-title');
  if (title) title.textContent = product.name;

  const skuLabel = document.getElementById('summary-sku');
  if (skuLabel) skuLabel.textContent = product.sku || options.sku;

  const breadcrumb = document.querySelector<HTMLElement>('.host-breadcrumb');
  if (breadcrumb) {
    const categories = (product.category_names ?? []).filter(Boolean).slice(-3);
    const parts = [i18n.home, ...categories, product.sku || options.sku];
    const last = parts.pop() ?? product.sku ?? options.sku;
    breadcrumb.innerHTML = `${parts.map((part) => escapeXml(part)).join(' / ')} / <strong>${escapeXml(last)}</strong>`;
  }

  const meta = document.querySelector<HTMLElement>('.summary-meta');
  if (meta) {
    const ratingText =
      typeof product.rating === 'number' && typeof product.review_count === 'number'
        ? `${product.rating.toFixed(1)} / 5 (${product.review_count} ${i18n.reviewsLabel})`
        : i18n.ratingFallback;
    meta.innerHTML = `<span>${i18n.productCode}: <span id="summary-sku">${escapeXml(product.sku || options.sku)}</span></span><span>&bull;</span><span>${escapeXml(ratingText)}</span>${product.brand ? `<span>&bull;</span><span>${escapeXml(product.brand)}</span>` : ''}`;
  }

  const badge = document.querySelector<HTMLElement>('.badge-chip');
  const discountRate =
    product.price != null &&
    product.price_discounted != null &&
    product.price > product.price_discounted &&
    product.price > 0
      ? Math.round(((product.price - product.price_discounted) / product.price) * 100)
      : null;
  if (badge) {
    badge.textContent =
      product.promotions?.[0] ??
      (discountRate != null
        ? `%${discountRate} ${i18n.discountLabel}`
        : (product.brand ?? `${options.brandName} ${i18n.demoLabel}`));
  }

  const priceMain = document.querySelector<HTMLElement>('.price-main');
  if (priceMain) {
    priceMain.textContent = formatMoney(
      product.price_discounted ?? product.price,
      product.price_currency ?? 'TRY',
      options.currencyLocale,
    );
  }

  const priceOld = document.querySelector<HTMLElement>('.price-old');
  if (priceOld) {
    if (product.price != null && product.price_discounted != null && product.price > product.price_discounted) {
      priceOld.textContent = formatMoney(product.price, product.price_currency ?? 'TRY', options.currencyLocale);
      priceOld.style.display = '';
    } else {
      priceOld.textContent = '';
      priceOld.style.display = 'none';
    }
  }

  const featureList = document.querySelector<HTMLElement>('.feature-list');
  if (featureList) {
    const items = collectHighlights(product);
    featureList.innerHTML = renderFeatureItems(items);
  }

  const copy = document.querySelector<HTMLElement>('.content-card p');
  if (copy) {
    copy.textContent = summarizeText(product.description);
  }

  const galleryMain = document.querySelector<HTMLElement>('.gallery-main');
  const galleryThumbs = document.querySelector<HTMLElement>('.gallery-thumbs');
  if (galleryMain) replaceGallery(galleryMain, galleryThumbs, product, options);
}

export async function hydrateDemoPdpShell(options: DemoShellOptions): Promise<void> {
  try {
    const product = await fetchDemoProduct(options);
    if (product == null) return;
    applyDemoProductToHostShell(product, options);
  } catch (error) {
    console.warn('[gengage:demo-shell] Failed to hydrate demo PDP shell:', error);
  }
}

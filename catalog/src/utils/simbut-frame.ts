import type { MockProduct } from '../mock-data/products.js';

export function createSimbutPreviewFrame(params: {
  product: MockProduct;
  mountId?: string;
  title?: string;
  subtitle?: string;
  note?: string;
}): {
  frame: HTMLDivElement;
  mountTarget: HTMLDivElement;
} {
  const frame = document.createElement('div');
  frame.className = 'catalog-simbut-frame';

  const header = document.createElement('div');
  header.className = 'catalog-simbut-frame-header';

  const heading = document.createElement('h4');
  heading.textContent = params.title ?? 'PDP Image Overlay';
  header.appendChild(heading);

  if (params.subtitle) {
    const subtitle = document.createElement('p');
    subtitle.textContent = params.subtitle;
    header.appendChild(subtitle);
  }

  frame.appendChild(header);

  const body = document.createElement('div');
  body.className = 'catalog-simbut-frame-body';

  const visual = document.createElement('div');
  visual.className = 'catalog-simbut-visual';

  const imageWrap = document.createElement('div');
  imageWrap.className = 'catalog-simbut-image-wrap';
  if (params.mountId) {
    imageWrap.id = params.mountId;
  }

  const image = document.createElement('img');
  image.src = params.product.imageUrl;
  image.alt = params.product.name;
  image.loading = 'lazy';
  imageWrap.appendChild(image);

  const mountBadge = document.createElement('span');
  mountBadge.className = 'catalog-simbut-image-badge';
  mountBadge.textContent = 'Mount target';
  imageWrap.appendChild(mountBadge);

  visual.appendChild(imageWrap);
  body.appendChild(visual);

  const meta = document.createElement('div');
  meta.className = 'catalog-simbut-product-meta';

  const brand = document.createElement('p');
  brand.className = 'catalog-simbut-product-brand';
  brand.textContent = params.product.brand;
  meta.appendChild(brand);

  const name = document.createElement('h5');
  name.className = 'catalog-simbut-product-name';
  name.textContent = params.product.name;
  meta.appendChild(name);

  const price = document.createElement('p');
  price.className = 'catalog-simbut-product-price';
  price.textContent = `${params.product.price} TL`;
  meta.appendChild(price);

  const note = document.createElement('p');
  note.className = 'catalog-simbut-product-note';
  note.textContent =
    params.note ??
    'SimBut mounts into a relatively positioned product-image wrapper and renders an absolute overlay pill.';
  meta.appendChild(note);

  body.appendChild(meta);
  frame.appendChild(body);

  return { frame, mountTarget: imageWrap };
}
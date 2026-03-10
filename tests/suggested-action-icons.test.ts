import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChatDrawer, SUGGESTED_ACTION_ICONS } from '../src/chat/components/ChatDrawer.js';
import { CHAT_I18N_TR } from '../src/chat/locales/index.js';

function createDrawer() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const drawer = new ChatDrawer(container, {
    i18n: CHAT_I18N_TR,
    onSend: () => {},
    onClose: () => {},
  });
  return { container, drawer };
}

describe('SUGGESTED_ACTION_ICONS map', () => {
  it('has SVG for search', () => {
    expect(SUGGESTED_ACTION_ICONS['search']).toContain('<svg');
    expect(SUGGESTED_ACTION_ICONS['search']).toContain('circle');
  });

  it('has SVG for review', () => {
    expect(SUGGESTED_ACTION_ICONS['review']).toContain('<svg');
    expect(SUGGESTED_ACTION_ICONS['review']).toContain('polygon');
  });

  it('has SVG for info', () => {
    expect(SUGGESTED_ACTION_ICONS['info']).toContain('<svg');
    expect(SUGGESTED_ACTION_ICONS['info']).toContain('circle');
  });

  it('has SVG for similar', () => {
    expect(SUGGESTED_ACTION_ICONS['similar']).toContain('<svg');
    expect(SUGGESTED_ACTION_ICONS['similar']).toContain('rect');
  });

  it('returns undefined for unknown icon names', () => {
    expect(SUGGESTED_ACTION_ICONS['unknown']).toBeUndefined();
    expect(SUGGESTED_ACTION_ICONS['foobar']).toBeUndefined();
  });
});

describe('setInputAreaChips with icons', () => {
  let container: HTMLElement;
  let drawer: ChatDrawer;

  beforeEach(() => {
    document.body.innerHTML = '';
    ({ container, drawer } = createDrawer());
  });

  afterEach(() => {
    container.remove();
  });

  it('renders icon span with SVG when icon is provided', () => {
    drawer.setInputAreaChips([{ label: 'Search', onAction: () => {}, icon: 'search' }]);
    const chipIcon = container.querySelector('.gengage-chat-input-chip-icon');
    expect(chipIcon).not.toBeNull();
    expect(chipIcon!.querySelector('svg')).not.toBeNull();
    expect(chipIcon!.querySelector('svg')!.classList.contains('gengage-chat-icon')).toBe(true);
  });

  it('renders label text in a span element', () => {
    drawer.setInputAreaChips([{ label: 'Reviews', onAction: () => {}, icon: 'review' }]);
    const btn = container.querySelector('.gengage-chat-input-chip') as HTMLElement;
    const spans = btn.querySelectorAll('span');
    // First span: icon, second span: label text
    const labelSpan = spans[spans.length - 1];
    expect(labelSpan).not.toBeNull();
    expect(labelSpan!.textContent).toBe('Reviews');
  });

  it('does not render icon span when no icon is provided', () => {
    drawer.setInputAreaChips([{ label: 'Help', onAction: () => {} }]);
    const chipIcon = container.querySelector('.gengage-chat-input-chip-icon');
    expect(chipIcon).toBeNull();
  });

  it('renders default fallback icon for unknown icon name', () => {
    drawer.setInputAreaChips([{ label: 'Custom', onAction: () => {}, icon: 'nonexistent' }]);
    const chipIcon = container.querySelector('.gengage-chat-input-chip-icon');
    expect(chipIcon).not.toBeNull();
    const svg = chipIcon!.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.classList.contains('gengage-chat-icon')).toBe(true);
    expect(svg!.querySelector('path')).not.toBeNull();
  });
});

describe('setPills with icons', () => {
  let container: HTMLElement;
  let drawer: ChatDrawer;

  beforeEach(() => {
    document.body.innerHTML = '';
    ({ container, drawer } = createDrawer());
  });

  afterEach(() => {
    container.remove();
  });

  it('renders icon span with SVG when icon is provided', () => {
    drawer.setPills([{ label: 'Info', onAction: () => {}, icon: 'info' }]);
    const pillIcon = container.querySelector('.gengage-chat-pill-icon');
    expect(pillIcon).not.toBeNull();
    expect(pillIcon!.querySelector('svg')).not.toBeNull();
    expect(pillIcon!.querySelector('svg')!.classList.contains('gengage-chat-icon')).toBe(true);
  });

  it('does not render icon span when no icon is provided', () => {
    drawer.setPills([{ label: 'More', onAction: () => {} }]);
    const pillIcon = container.querySelector('.gengage-chat-pill-icon');
    expect(pillIcon).toBeNull();
  });

  it('renders both icon and image when both provided', () => {
    drawer.setPills([{ label: 'Similar', onAction: () => {}, icon: 'similar', image: 'https://example.com/img.jpg' }]);
    const pillIcon = container.querySelector('.gengage-chat-pill-icon');
    const pillImg = container.querySelector('.gengage-chat-pill-img');
    expect(pillIcon).not.toBeNull();
    expect(pillImg).not.toBeNull();
  });

  it('renders default fallback icon for unknown pill icon name', () => {
    drawer.setPills([{ label: 'Custom Action', onAction: () => {}, icon: 'unknown_icon' }]);
    const pillIcon = container.querySelector('.gengage-chat-pill-icon');
    expect(pillIcon).not.toBeNull();
    const svg = pillIcon!.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.classList.contains('gengage-chat-icon')).toBe(true);
    expect(svg!.querySelector('path')).not.toBeNull();
  });
});

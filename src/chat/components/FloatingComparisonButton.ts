/**
 * Slim bottom-docked comparison bar for the main panel.
 *
 * Keeps compare mode visible without the oversized floating prompt.
 */

import type { ChatUISpecRenderContext } from '../types.js';

export function renderFloatingComparisonButton(selectedSkus: string[], ctx: ChatUISpecRenderContext): HTMLElement {
  const canCompare = selectedSkus.length >= 2;
  const label = ctx.i18n?.compareSelected ?? 'Compare';
  const warning = ctx.comparisonSelectionWarning;

  const dock = document.createElement('div');
  dock.className = 'gengage-chat-comparison-floating-btn';
  dock.dataset['gengagePart'] = 'comparison-dock';

  const summary = document.createElement('div');
  summary.className = 'gengage-chat-comparison-floating-summary';

  const count = document.createElement('span');
  count.className = 'gengage-chat-comparison-floating-count';
  count.textContent = String(selectedSkus.length);
  summary.appendChild(count);

  const text = document.createElement('div');
  text.className = 'gengage-chat-comparison-floating-copy';

  const title = document.createElement('div');
  title.className = 'gengage-chat-comparison-floating-title';
  title.textContent = canCompare
    ? `${label} (${selectedSkus.length})`
    : (ctx.i18n?.compareMinHint ?? 'Select at least 2 products');
  text.appendChild(title);

  if (warning) {
    const warningEl = document.createElement('div');
    warningEl.className = 'gengage-chat-comparison-floating-warning';
    warningEl.setAttribute('role', 'status');
    warningEl.setAttribute('aria-live', 'polite');
    warningEl.textContent = warning;
    text.appendChild(warningEl);
  }

  summary.appendChild(text);
  dock.appendChild(summary);

  const action = document.createElement('button');
  action.className = 'gengage-chat-comparison-floating-action gds-btn gds-btn-primary';
  action.type = 'button';
  action.textContent = label;
  action.disabled = !canCompare;
  if (!canCompare) action.classList.add('gengage-chat-comparison-floating-action--disabled');
  action.addEventListener('click', () => {
    if (!canCompare) return;
    ctx.onAction({
      title: label,
      type: 'getComparisonTable',
      payload: { sku_list: [...selectedSkus] },
    });
  });
  dock.appendChild(action);

  if (ctx.onToggleComparisonSku) {
    const close = document.createElement('button');
    close.className = 'gengage-chat-comparison-floating-close gds-btn gds-btn-ghost gds-icon-btn';
    close.dataset['gengagePart'] = 'comparison-dock-close';
    close.type = 'button';
    close.setAttribute('aria-label', ctx.i18n?.closeAriaLabel ?? 'Close');
    close.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>';
    close.addEventListener('click', () => {
      ctx.onToggleComparisonSku?.('');
    });
    dock.appendChild(close);
  }

  return dock;
}

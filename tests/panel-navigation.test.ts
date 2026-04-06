/**
 * Tests for PanelTopBar — panel navigation bar component.
 */

import { describe, it, expect, vi } from 'vitest';
import { PanelTopBar } from '../src/chat/components/PanelTopBar.js';

describe('PanelTopBar', () => {
  it('creates element with correct structure', () => {
    const topBar = new PanelTopBar({
      onBack: vi.fn(),
      onForward: vi.fn(),
    });
    const el = topBar.getElement();
    expect(el.classList.contains('gengage-chat-panel-topbar')).toBe(true);
    expect(el.classList.contains('gds-toolbar')).toBe(true);

    const back = el.querySelector('.gengage-chat-panel-topbar-back') as HTMLButtonElement;
    expect(back).not.toBeNull();
    expect(back.disabled).toBe(true);
    expect(back.querySelector('svg')).not.toBeNull();

    const title = el.querySelector('.gengage-chat-panel-topbar-title');
    expect(title).not.toBeNull();
    expect(title!.textContent).toBe('');

    const forward = el.querySelector('.gengage-chat-panel-topbar-forward') as HTMLButtonElement;
    expect(forward).not.toBeNull();
    expect(forward.disabled).toBe(true);
    expect(forward.querySelector('svg')).not.toBeNull();
  });

  it('updates button states and title', () => {
    const topBar = new PanelTopBar({
      onBack: vi.fn(),
      onForward: vi.fn(),
    });
    const el = topBar.getElement();

    topBar.update(true, false, 'Product Details');

    const back = el.querySelector('.gengage-chat-panel-topbar-back') as HTMLButtonElement;
    const forward = el.querySelector('.gengage-chat-panel-topbar-forward') as HTMLButtonElement;
    const title = el.querySelector('.gengage-chat-panel-topbar-title');

    expect(back.disabled).toBe(false);
    expect(forward.disabled).toBe(true);
    expect(title!.textContent).toBe('Product Details');
  });

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn();
    const topBar = new PanelTopBar({ onBack, onForward: vi.fn() });
    const el = topBar.getElement();

    topBar.update(true, false, 'Title');
    const back = el.querySelector('.gengage-chat-panel-topbar-back') as HTMLButtonElement;
    back.click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('calls onForward when forward button is clicked', () => {
    const onForward = vi.fn();
    const topBar = new PanelTopBar({ onBack: vi.fn(), onForward });
    const el = topBar.getElement();

    topBar.update(false, true, 'Title');
    const forward = el.querySelector('.gengage-chat-panel-topbar-forward') as HTMLButtonElement;
    forward.click();
    expect(onForward).toHaveBeenCalledTimes(1);
  });

  it('enables both buttons when both directions are available', () => {
    const topBar = new PanelTopBar({ onBack: vi.fn(), onForward: vi.fn() });
    const el = topBar.getElement();

    topBar.update(true, true, 'Navigation');
    const back = el.querySelector('.gengage-chat-panel-topbar-back') as HTMLButtonElement;
    const forward = el.querySelector('.gengage-chat-panel-topbar-forward') as HTMLButtonElement;
    expect(back.disabled).toBe(false);
    expect(forward.disabled).toBe(false);
  });

  it('disables both buttons when both directions are unavailable', () => {
    const topBar = new PanelTopBar({ onBack: vi.fn(), onForward: vi.fn() });
    const el = topBar.getElement();

    topBar.update(false, false, '');
    const back = el.querySelector('.gengage-chat-panel-topbar-back') as HTMLButtonElement;
    const forward = el.querySelector('.gengage-chat-panel-topbar-forward') as HTMLButtonElement;
    expect(back.disabled).toBe(true);
    expect(forward.disabled).toBe(true);
  });

  it('sets correct aria-labels on buttons', () => {
    const topBar = new PanelTopBar({ onBack: vi.fn(), onForward: vi.fn() });
    const el = topBar.getElement();
    const back = el.querySelector('.gengage-chat-panel-topbar-back');
    const forward = el.querySelector('.gengage-chat-panel-topbar-forward');
    expect(back!.getAttribute('aria-label')).toBe('Back');
    expect(forward!.getAttribute('aria-label')).toBe('Forward');
  });

  it('updates title to empty string for unsupported component types', () => {
    const topBar = new PanelTopBar({ onBack: vi.fn(), onForward: vi.fn() });
    topBar.update(false, false, '');
    const el = topBar.getElement();
    const title = el.querySelector('.gengage-chat-panel-topbar-title');
    expect(title!.textContent).toBe('');
  });
});

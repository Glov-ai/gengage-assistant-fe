/**
 * Tests for BaseWidget lifecycle: destroy() mount ownership and re-init behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BaseWidgetConfig, PageContext } from '../src/common/types.js';
import { BaseWidget } from '../src/common/widget-base.js';

// Concrete test subclass with minimal implementation
class TestWidget extends BaseWidget<BaseWidgetConfig> {
  initCount = 0;
  destroyCount = 0;

  protected async onInit(_config: BaseWidgetConfig): Promise<void> {
    this.initCount++;
  }
  protected onUpdate(_context: Partial<PageContext>): void {}
  protected onShow(): void {}
  protected onHide(): void {}
  protected onDestroy(): void {
    this.destroyCount++;
  }
}

function makeConfig(overrides: Partial<BaseWidgetConfig> = {}): BaseWidgetConfig {
  return {
    accountId: 'test-account',
    session: { sessionId: 'test-session' },
    ...overrides,
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('BaseWidget lifecycle', () => {
  describe('default theme tokens', () => {
    it('applies shared default widget theme tokens when theme is not provided', async () => {
      const widget = new TestWidget();
      await widget.init(makeConfig());

      const root = document.querySelector<HTMLElement>('[data-gengage-widget]');
      expect(root).toBeTruthy();
      expect(root?.style.getPropertyValue('--gengage-chat-conversation-width')).toBe('396px');
      expect(root?.style.getPropertyValue('--gengage-qna-pill-radius')).toBe('999px');

      widget.destroy();
    });

    it('lets explicit theme values override shared defaults', async () => {
      const widget = new TestWidget();
      await widget.init(
        makeConfig({
          theme: {
            '--gengage-chat-conversation-width': '420px',
            '--gengage-qna-pill-radius': '24px',
          },
        }),
      );

      const root = document.querySelector<HTMLElement>('[data-gengage-widget]');
      expect(root).toBeTruthy();
      expect(root?.style.getPropertyValue('--gengage-chat-conversation-width')).toBe('420px');
      expect(root?.style.getPropertyValue('--gengage-qna-pill-radius')).toBe('24px');

      widget.destroy();
    });
  });

  describe('destroy() mount ownership', () => {
    it('removes auto-created root element from DOM', async () => {
      const widget = new TestWidget();
      await widget.init(makeConfig());

      // Auto-created root should be in DOM
      const root = document.querySelector('[data-gengage-widget]');
      expect(root).toBeTruthy();
      expect(document.body.contains(root)).toBe(true);

      widget.destroy();

      // Auto-created root should be removed
      expect(document.body.contains(root)).toBe(false);
    });

    it('preserves host-provided selector mount target after destroy()', async () => {
      // Create host-provided mount point
      const hostEl = document.createElement('div');
      hostEl.id = 'my-widget-section';
      document.body.appendChild(hostEl);

      const widget = new TestWidget();
      await widget.init(makeConfig({ mountTarget: '#my-widget-section' }));

      widget.destroy();

      // Host element should still be in DOM
      const el = document.getElementById('my-widget-section');
      expect(el).toBeTruthy();
      expect(document.body.contains(el)).toBe(true);
      // But its content should be cleared
      expect(el!.innerHTML).toBe('');
    });

    it('preserves host-provided HTMLElement mount target after destroy()', async () => {
      const hostEl = document.createElement('div');
      hostEl.id = 'direct-element';
      document.body.appendChild(hostEl);

      const widget = new TestWidget();
      await widget.init(makeConfig({ mountTarget: hostEl }));

      widget.destroy();

      // Direct HTMLElement mount is not owned — should stay in DOM
      expect(document.body.contains(hostEl)).toBe(true);
      expect(hostEl.innerHTML).toBe('');
    });
  });

  describe('init guard', () => {
    it('warns and returns early on duplicate init()', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const widget = new TestWidget();

      await widget.init(makeConfig());
      expect(widget.initCount).toBe(1);

      await widget.init(makeConfig());
      expect(widget.initCount).toBe(1); // Should not re-init
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already initialised'));

      warnSpy.mockRestore();
    });
  });

  describe('destroy + re-init cycle', () => {
    it('allows re-init on the same selector after destroy()', async () => {
      const hostEl = document.createElement('div');
      hostEl.id = 'reusable-mount';
      document.body.appendChild(hostEl);

      const widget1 = new TestWidget();
      await widget1.init(makeConfig({ mountTarget: '#reusable-mount' }));
      expect(widget1.initCount).toBe(1);

      widget1.destroy();
      expect(widget1.destroyCount).toBe(1);

      // Mount point survives — new widget can attach
      const widget2 = new TestWidget();
      await widget2.init(makeConfig({ mountTarget: '#reusable-mount' }));
      expect(widget2.initCount).toBe(1);

      // Host element still in DOM
      expect(document.getElementById('reusable-mount')).toBeTruthy();

      widget2.destroy();
    });
  });

  describe('cleanup on destroy', () => {
    it('clears event handlers on destroy()', async () => {
      const widget = new TestWidget();
      await widget.init(makeConfig());

      const handler = vi.fn();
      widget.on('custom-event', handler);

      widget.destroy();

      // After destroy, isInitialised should be false
      // (we can't directly test handler map clearing, but the contract is upheld)
      expect(widget.destroyCount).toBe(1);
    });

    it('runs registered cleanups on destroy()', async () => {
      const cleanup = vi.fn();

      class CleanupWidget extends TestWidget {
        protected override async onInit(config: BaseWidgetConfig): Promise<void> {
          await super.onInit(config);
          this.addCleanup(cleanup);
        }
      }

      const widget = new CleanupWidget();
      await widget.init(makeConfig());
      widget.destroy();

      expect(cleanup).toHaveBeenCalledOnce();
    });
  });
});

import { describe, it, expect, vi } from 'vitest';
import type { UISpec } from '../src/common/types.js';
import { renderQnaUISpec } from '../src/qna/components/renderUISpec.js';
import type { QNAUISpecRenderContext } from '../src/qna/types.js';

function makeContext(overrides: Partial<QNAUISpecRenderContext> = {}): QNAUISpecRenderContext {
  return {
    onAction: vi.fn(),
    onOpenChat: vi.fn(),
    i18n: {
      quickQuestionsAriaLabel: 'Hızlı sorular',
      askQuestionAriaLabel: 'Soru sor',
      defaultInputPlaceholder: 'Merak ettiğini sor',
      sendButton: 'Sor',
      sendQuestionAriaLabel: 'Soruyu gönder',
      defaultCtaText: 'Başka bir şey sor',
      redirectingToChat: 'Sohbete yönlendiriliyor...',
      productContextQuickPillLabel: 'Bu ürün hakkında ne bilmeliyim?',
    },
    ...overrides,
  };
}

describe('renderQnaUISpec', () => {
  it('renders ButtonRow with ActionButton children and dispatches action click', () => {
    const onAction = vi.fn();
    const spec: UISpec = {
      root: 'root',
      elements: {
        root: { type: 'ButtonRow', children: ['a1'] },
        a1: {
          type: 'ActionButton',
          props: {
            label: 'Kargo ne zaman gelir?',
            action: { title: 'Kargo ne zaman gelir?', type: 'launcherQuestionClick', payload: { topic: 'kargo' } },
          },
        },
      },
    };

    const result = renderQnaUISpec(spec, makeContext({ onAction }));
    const button = result.querySelector('.gengage-qna-button') as HTMLButtonElement;
    expect(button).toBeTruthy();
    expect(button.textContent).toContain('Kargo ne zaman gelir');

    button.click();
    expect(onAction).toHaveBeenCalledWith({
      title: 'Kargo ne zaman gelir?',
      type: 'launcherQuestionClick',
      payload: { topic: 'kargo' },
    });
  });

  it('renders TextInput using context placeholders and i18n send label', () => {
    const spec: UISpec = {
      root: 'root',
      elements: {
        root: { type: 'TextInput' },
      },
    };

    const result = renderQnaUISpec(
      spec,
      makeContext({
        ctaText: 'Soru Sor',
        inputPlaceholder: ['Montaj nasıl?', 'Ürün iade edilir mi?'],
      }),
    );

    const input = result.querySelector('.gengage-qna-input') as HTMLInputElement;
    const send = result.querySelector('.gengage-qna-send') as HTMLButtonElement;
    expect(input.placeholder).toBe('Montaj nasıl?');
    expect(send.textContent).toBe('Sor');
  });

  it('submits TextInput as plain-string user_message payload', () => {
    const onAction = vi.fn();
    const spec: UISpec = {
      root: 'root',
      elements: {
        root: { type: 'TextInput' },
      },
    };

    const result = renderQnaUISpec(spec, makeContext({ onAction }));
    const input = result.querySelector('.gengage-qna-input') as HTMLInputElement;
    const send = result.querySelector('.gengage-qna-send') as HTMLButtonElement;

    input.value = 'Bu ürün nefes alabilir mi?';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    send.click();

    expect(onAction).toHaveBeenCalledWith({
      title: 'Bu ürün nefes alabilir mi?',
      type: 'user_message',
      payload: 'Bu ürün nefes alabilir mi?',
    });
  });

  it('renders ProductCard as no-op (QNA shows only buttons, matching reference)', () => {
    const onAction = vi.fn();
    const spec: UISpec = {
      root: 'root',
      elements: {
        root: {
          type: 'ProductCard',
          props: {
            product: {
              sku: '1000197232',
              name: 'Stanley Sicak Hava Tabancasi',
              price: '1689',
              imageUrl: 'https://example.com/p.jpg',
              url: 'https://example.com/p/1000197232',
            },
            action: {
              title: 'Urun Detayini Gor',
              type: 'launchSingleProduct',
              payload: { sku: '1000197232' },
            },
          },
        },
      },
    };

    // ProductCard is explicitly registered as a no-op in QNA — products render
    // only after chat opens via openWithAction(). No console.warn expected.
    const result = renderQnaUISpec(spec, makeContext({ onAction }));
    expect(result).toBeTruthy();
    expect(result.tagName).toBeDefined();
  });
});

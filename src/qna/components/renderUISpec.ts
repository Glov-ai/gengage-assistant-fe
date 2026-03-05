import { renderUISpecWithRegistry } from '../../common/renderer/index.js';
import type { UISpecDomRegistry, UISpecDomUnknownRenderer } from '../../common/renderer/index.js';
import type { UISpec, UIElement, ActionPayload } from '../../common/types.js';
import type { QNAUISpecRenderContext } from '../types.js';
import { renderButtonRow } from './ButtonRow.js';
import { renderTextInput } from './TextInput.js';

export type QNAUISpecRegistry = UISpecDomRegistry<QNAUISpecRenderContext>;

function toActionPayload(raw: unknown, labelFallback?: string): ActionPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const type = obj['type'];
  if (typeof type !== 'string' || type.length === 0) return null;

  const titleRaw = obj['title'];
  const payload = obj['payload'];
  const title = typeof titleRaw === 'string' && titleRaw.length > 0 ? titleRaw : labelFallback;
  if (!title) return null;

  const action: ActionPayload = { title, type };
  if (payload !== undefined) action.payload = payload;
  return action;
}

function actionPayloadToRowAction(action: ActionPayload): { title: string; type: string; payload?: unknown } {
  const rowAction: { title: string; type: string; payload?: unknown } = {
    title: action.title,
    type: action.type,
  };
  if (action.payload !== undefined) rowAction.payload = action.payload;
  return rowAction;
}

function collectButtonRowActions(element: UIElement, spec: UISpec): ActionPayload[] {
  const actions: ActionPayload[] = [];

  const directActions = element.props?.['actions'];
  if (Array.isArray(directActions)) {
    for (const rawAction of directActions) {
      const normalized = toActionPayload(rawAction);
      if (normalized) actions.push(normalized);
    }
  }

  const directButtons = element.props?.['buttons'];
  if (Array.isArray(directButtons)) {
    for (const rawButton of directButtons) {
      if (!rawButton || typeof rawButton !== 'object') continue;
      const obj = rawButton as Record<string, unknown>;
      const label = typeof obj['label'] === 'string' ? obj['label'] : undefined;
      const action = toActionPayload(obj['action'], label);
      if (action) actions.push(action);
    }
  }

  if (element.children) {
    for (const childId of element.children) {
      const child = spec.elements[childId];
      if (!child || child.type !== 'ActionButton') continue;
      const label = typeof child.props?.['label'] === 'string' ? child.props['label'] : undefined;
      const action = toActionPayload(child.props?.['action'], label);
      if (action) actions.push(action);
    }
  }

  // Deduplicate by title — backend may provide same actions via props and children
  const seen = new Set<string>();
  return actions.filter((a) => {
    if (seen.has(a.title)) return false;
    seen.add(a.title);
    return true;
  });
}

const DEFAULT_QNA_UI_SPEC_REGISTRY: QNAUISpecRegistry = {
  ButtonRow: ({ element, spec, context }) => {
    const rowActions = collectButtonRowActions(element, spec).map(actionPayloadToRowAction);
    const orientation = element.props?.['orientation'];

    const options: import('./ButtonRow.js').ButtonRowOptions = {
      actions: rowActions,
      onAction: context.onAction,
      defaultCtaText: context.i18n.defaultCtaText,
      quickQuestionsAriaLabel: context.i18n.quickQuestionsAriaLabel,
    };
    if (context.onOpenChat !== undefined) options.onOpenChat = context.onOpenChat;
    if (context.ctaText !== undefined) options.ctaText = context.ctaText;
    if (orientation === 'horizontal' || orientation === 'vertical') options.orientation = orientation;
    return renderButtonRow(options);
  },

  ActionButtons: ({ element, spec, context }) => {
    const rowActions = collectButtonRowActions(element, spec).map(actionPayloadToRowAction);
    const options: import('./ButtonRow.js').ButtonRowOptions = {
      actions: rowActions,
      onAction: context.onAction,
      defaultCtaText: context.i18n.defaultCtaText,
      quickQuestionsAriaLabel: context.i18n.quickQuestionsAriaLabel,
    };
    if (context.onOpenChat !== undefined) options.onOpenChat = context.onOpenChat;
    if (context.ctaText !== undefined) options.ctaText = context.ctaText;
    return renderButtonRow(options);
  },

  ActionButton: ({ element, context }) => {
    const button = document.createElement('button');
    button.className = 'gengage-qna-button';
    button.type = 'button';

    const label = element.props?.['label'];
    if (typeof label === 'string') {
      button.textContent = label;
    } else {
      button.textContent = context.i18n.defaultCtaText;
    }

    const action = toActionPayload(element.props?.['action'], typeof label === 'string' ? label : undefined);
    if (action) {
      button.addEventListener('click', () => context.onAction(action));
    }
    return button;
  },

  TextInput: ({ element, context }) => {
    const placeholder = element.props?.['placeholder'];
    const placeholders =
      typeof placeholder === 'string' || Array.isArray(placeholder) ? placeholder : context.inputPlaceholder;
    // Keep input submit label independent from the quick-question CTA text.
    const ctaLabel = typeof element.props?.['ctaLabel'] === 'string' ? element.props['ctaLabel'] : undefined;

    const options: import('./TextInput.js').TextInputOptions = {
      onSubmit: context.onAction,
      askQuestionAriaLabel: context.i18n.askQuestionAriaLabel,
      defaultInputPlaceholder: context.i18n.defaultInputPlaceholder,
      sendButtonText: context.i18n.sendButton,
      sendQuestionAriaLabel: context.i18n.sendQuestionAriaLabel,
    };
    if (placeholders !== undefined) options.placeholders = placeholders;
    if (ctaLabel !== undefined) options.ctaLabel = ctaLabel;
    return renderTextInput(options);
  },

  QuestionHeading: ({ element }) => {
    const heading = document.createElement('h3');
    heading.className = 'gengage-qna-heading';
    const text = element.props?.['text'];
    heading.textContent = typeof text === 'string' ? text : '';
    return heading;
  },

  // ProductCard: no-op — QNA renders only question pills + text input.
  // Backend may send ProductCard but QNA intentionally skips it;
  // the product is shown once chat opens via openWithAction().
  ProductCard: () => null,
};

export const defaultQnaUnknownUISpecRenderer: UISpecDomUnknownRenderer<QNAUISpecRenderContext> = ({
  element,
  renderElement,
}) => {
  if (import.meta.env?.DEV) {
    console.warn(`[gengage:qna] Unknown ui_spec component type: ${element.type}`);
  }
  if (!element.children || element.children.length === 0) {
    return null;
  }
  const wrapper = document.createElement('div');
  for (const childId of element.children) {
    const rendered = renderElement(childId);
    if (rendered) wrapper.appendChild(rendered);
  }
  return wrapper;
};

export function createDefaultQnaUISpecRegistry(): QNAUISpecRegistry {
  return { ...DEFAULT_QNA_UI_SPEC_REGISTRY };
}

export function renderQnaUISpec(
  spec: UISpec,
  context: QNAUISpecRenderContext,
  registry = DEFAULT_QNA_UI_SPEC_REGISTRY,
  unknownRenderer: UISpecDomUnknownRenderer<QNAUISpecRenderContext> = defaultQnaUnknownUISpecRenderer,
): HTMLElement {
  return renderUISpecWithRegistry({
    spec,
    context,
    registry,
    containerClassName: 'gengage-qna-uispec',
    unknownRenderer,
  });
}

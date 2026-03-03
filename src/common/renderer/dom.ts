import type { UISpecDomUnknownRenderer, RenderUISpecWithRegistryOptions } from './types.js';

export const defaultUnknownUISpecRenderer: UISpecDomUnknownRenderer<unknown> = ({ element, renderElement }) => {
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

export function renderUISpecWithRegistry<TContext>(options: RenderUISpecWithRegistryOptions<TContext>): HTMLElement {
  const container = document.createElement('div');
  container.className = options.containerClassName;

  const rootEl = options.spec.elements[options.spec.root];
  if (!rootEl) return container;

  const unknownRenderer =
    options.unknownRenderer ?? (defaultUnknownUISpecRenderer as UISpecDomUnknownRenderer<TContext>);

  const renderElement = (elementId: string): HTMLElement | null => {
    const element = options.spec.elements[elementId];
    if (!element) return null;

    const renderer = options.registry[element.type];
    if (renderer) {
      return renderer({
        elementId,
        element,
        spec: options.spec,
        context: options.context,
        renderElement,
      });
    }

    return unknownRenderer({
      elementId,
      element,
      spec: options.spec,
      context: options.context,
      renderElement,
    });
  };

  const rendered = renderElement(options.spec.root);
  if (rendered) container.appendChild(rendered);
  return container;
}

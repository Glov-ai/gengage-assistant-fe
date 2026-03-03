import type { UISpec, UIElement } from '../types.js';

export interface UISpecDomComponentRenderParams<TContext> {
  elementId: string;
  element: UIElement;
  spec: UISpec;
  context: TContext;
  renderElement: (elementId: string) => HTMLElement | null;
}

export type UISpecDomComponentRenderer<TContext> = (
  params: UISpecDomComponentRenderParams<TContext>,
) => HTMLElement | null;

export type UISpecDomRegistry<TContext> = Record<string, UISpecDomComponentRenderer<TContext>>;

export type UISpecDomUnknownRendererParams<TContext> = UISpecDomComponentRenderParams<TContext>;

export type UISpecDomUnknownRenderer<TContext> = (
  params: UISpecDomUnknownRendererParams<TContext>,
) => HTMLElement | null;

export interface RenderUISpecWithRegistryOptions<TContext> {
  spec: UISpec;
  context: TContext;
  registry: UISpecDomRegistry<TContext>;
  containerClassName: string;
  unknownRenderer?: UISpecDomUnknownRenderer<TContext>;
}

import type { UISpec } from '../types.js';
import type { UISpecDomRegistry, UISpecDomUnknownRenderer } from './types.js';

export interface UISpecRenderHelpers<TContext> {
  registry: UISpecDomRegistry<TContext>;
  unknownRenderer?: UISpecDomUnknownRenderer<TContext>;
  defaultRender: (spec: UISpec, context: TContext) => HTMLElement;
}

export interface UISpecRendererOverrides<TContext> {
  /**
   * Component-level overrides. Merged on top of the widget's default registry.
   */
  registry?: Partial<UISpecDomRegistry<TContext>>;

  /**
   * Optional fallback for unknown component types.
   * Defaults to the widget's built-in unknown renderer.
   */
  unknownRenderer?: UISpecDomUnknownRenderer<TContext>;

  /**
   * Full UISpec rendering override.
   * Use this to replace the default rendering methodology entirely.
   */
  renderUISpec?: (spec: UISpec, context: TContext, helpers: UISpecRenderHelpers<TContext>) => HTMLElement;
}

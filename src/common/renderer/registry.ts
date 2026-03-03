import type { UISpecDomRegistry } from './types.js';

export function mergeUISpecRegistry<TContext>(
  base: UISpecDomRegistry<TContext>,
  overrides?: Partial<UISpecDomRegistry<TContext>>,
): UISpecDomRegistry<TContext> {
  if (!overrides) return base;

  const merged: UISpecDomRegistry<TContext> = { ...base };
  for (const [componentName, renderer] of Object.entries(overrides)) {
    if (!renderer) continue;
    merged[componentName] = renderer;
  }
  return merged;
}

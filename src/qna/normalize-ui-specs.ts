import type { ActionPayload, PageContext, UISpec, UIElement } from '../common/types.js';
import type { QNAI18n } from './types.js';

/** SKUs to send with the product-context quick pill (`user_message` + sku_list). */
export type MergeQuickPillsOptions = {
  skuList?: string[] | undefined;
};

/**
 * Resolve SKU list for QNA → chat payloads: current PDP sku, or `visible_skus` on listings.
 */
export function resolveQnaSkuListForPayload(pageContext: PageContext | undefined): string[] | undefined {
  if (!pageContext) return undefined;
  const extra = pageContext.extra;
  if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
    const raw = extra['visible_skus'] ?? extra['visibleSkus'];
    if (Array.isArray(raw)) {
      const list = raw
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((s) => s.trim())
        .slice(0, 200);
      if (list.length > 0) return list;
    }
  }
  const sku = typeof pageContext.sku === 'string' && pageContext.sku.trim() ? pageContext.sku.trim() : undefined;
  return sku ? [sku] : undefined;
}

function actionFromProps(props: Record<string, unknown> | undefined, labelFallback?: string): ActionPayload | null {
  if (!props) return null;
  const actionRaw = props['action'];
  if (!actionRaw || typeof actionRaw !== 'object') return null;
  const obj = actionRaw as Record<string, unknown>;
  const type = obj['type'];
  if (typeof type !== 'string' || type.length === 0) return null;
  const titleRaw = obj['title'];
  const title =
    typeof titleRaw === 'string' && titleRaw.length > 0
      ? titleRaw
      : typeof labelFallback === 'string' && labelFallback.length > 0
        ? labelFallback
        : '';
  if (!title) return null;
  const payload = obj['payload'];
  const out: ActionPayload = { title, type };
  if (payload !== undefined) out.payload = payload;
  return out;
}

function rowHasPillWithTitle(spec: UISpec, title: string): boolean {
  const root = spec.elements[spec.root];
  if (!root) return false;

  const checkElement = (el: UIElement): boolean => {
    if (el.type !== 'ActionButton') return false;
    const props = el.props;
    if (!props || typeof props !== 'object') return false;
    const label = typeof props['label'] === 'string' ? props['label'] : undefined;
    if (label === title) return true;
    const a = actionFromProps(props as Record<string, unknown>, label);
    return a?.title === title;
  };

  if (root.type === 'ActionButton') {
    return checkElement(root);
  }
  if (root.children) {
    for (const id of root.children) {
      const child = spec.elements[id];
      if (child && checkElement(child)) return true;
    }
  }
  if (root.type === 'ActionButtons' && Array.isArray(root.props?.['buttons'])) {
    for (const btn of root.props['buttons'] as Array<{ label?: string; action?: { title?: string } }>) {
      if (btn?.label === title) return true;
      if (btn?.action?.title === title) return true;
    }
  }
  return false;
}

let _mergeId = 0;
function nextMergeId(): string {
  _mergeId += 1;
  return `gengage-merge-${_mergeId}`;
}

function prependToButtonRow(spec: UISpec, action: ActionPayload): void {
  const root = spec.elements[spec.root];
  if (!root || root.type !== 'ButtonRow') return;
  const id = nextMergeId();
  spec.elements[id] = {
    type: 'ActionButton',
    props: {
      label: action.title,
      action: {
        title: action.title,
        type: action.type,
        ...(action.payload !== undefined ? { payload: action.payload } : {}),
      },
    },
  };
  root.children = root.children ? [id, ...root.children] : [id];
}

function prependToActionButtons(spec: UISpec, action: ActionPayload): void {
  const root = spec.elements[spec.root];
  if (!root || root.type !== 'ActionButtons') return;
  const id = nextMergeId();
  spec.elements[id] = {
    type: 'ActionButton',
    props: {
      label: action.title,
      action: {
        title: action.title,
        type: action.type,
        ...(action.payload !== undefined ? { payload: action.payload } : {}),
      },
    },
  };
  root.children = root.children ? [id, ...root.children] : [id];
  const buttons = (root.props?.['buttons'] as Array<Record<string, unknown>> | undefined) ?? [];
  const btnEntry = {
    label: action.title,
    action: {
      title: action.title,
      type: action.type,
      ...(action.payload !== undefined ? { payload: action.payload } : {}),
    },
  };
  root.props = { ...root.props, buttons: [btnEntry, ...buttons] };
}

function buildSingleButtonRowSpec(actions: ActionPayload[]): UISpec {
  const elements: Record<string, UIElement> = {};
  const childIds: string[] = [];
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i]!;
    const id = `action-${i}`;
    childIds.push(id);
    elements[id] = {
      type: 'ActionButton',
      props: {
        label: action.title,
        action: {
          title: action.title,
          type: action.type,
          ...(action.payload !== undefined ? { payload: action.payload } : {}),
        },
      },
    };
  }
  elements['root'] = {
    type: 'ButtonRow',
    children: childIds,
  };
  return { root: 'root', elements };
}

function findFirstPillRowSpec(specs: UISpec[]): UISpec | undefined {
  return specs.find((spec) => {
    const root = spec.elements[spec.root];
    return root?.type === 'ActionButtons' || root?.type === 'ButtonRow';
  });
}

function heroReplacementAction(i18n: QNAI18n, skuList?: string[]): ActionPayload {
  const text = i18n.productContextQuickPillLabel;
  const payload: Record<string, unknown> = { text };
  if (skuList && skuList.length > 0) {
    payload['sku_list'] = skuList;
  }
  return {
    title: text,
    type: 'user_message',
    payload,
  };
}

/**
 * Removes standalone hero `ActionButton` blocks for `findSimilar` (e.g. from `text_image`)
 * and merges a product-context quick question pill instead (same row as other questions).
 */
export function mergeStandaloneFindSimilarIntoQuickPills(
  specs: UISpec[],
  i18n: QNAI18n,
  options?: MergeQuickPillsOptions,
): UISpec[] {
  const skuList = options?.skuList;
  const extracted: ActionPayload[] = [];
  const filtered: UISpec[] = [];

  for (const spec of specs) {
    const root = spec.elements[spec.root];
    if (root?.type === 'ActionButton') {
      const props = root.props as Record<string, unknown> | undefined;
      const label = typeof props?.['label'] === 'string' ? props['label'] : undefined;
      const action = actionFromProps(props, label);
      if (action?.type === 'findSimilar') {
        extracted.push(heroReplacementAction(i18n, skuList));
        continue;
      }
    }
    filtered.push(spec);
  }

  if (extracted.length === 0) {
    return specs;
  }

  const replacement = heroReplacementAction(i18n, skuList);
  const target = findFirstPillRowSpec(filtered);

  if (!target) {
    return [...filtered, buildSingleButtonRowSpec([replacement])];
  }

  if (!rowHasPillWithTitle(target, replacement.title)) {
    const root = target.elements[target.root];
    if (root?.type === 'ActionButtons') {
      prependToActionButtons(target, replacement);
    } else if (root?.type === 'ButtonRow') {
      prependToButtonRow(target, replacement);
    }
  }

  return filtered;
}

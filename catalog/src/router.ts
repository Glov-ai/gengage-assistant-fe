export interface Route {
  path: string;
  label: string;
  section?: string;
  children?: Route[];
}

export const ROUTES: Route[] = [
  { path: '/', label: 'Overview' },
  {
    path: '/chat',
    label: 'Chat Components',
    section: 'chat',
    children: [
      { path: '/chat/ActionButtons', label: 'ActionButtons' },
      { path: '/chat/ActionButton', label: 'ActionButton' },
      { path: '/chat/ProductCard', label: 'ProductCard' },
      { path: '/chat/ProductDetailsPanel', label: 'ProductDetailsPanel' },
      { path: '/chat/ProductGrid', label: 'ProductGrid' },
      { path: '/chat/ReviewHighlights', label: 'ReviewHighlights' },
      { path: '/chat/ComparisonTable', label: 'ComparisonTable' },
      { path: '/chat/AITopPicks', label: 'AITopPicks' },
      { path: '/chat/GroundingReviewCard', label: 'GroundingReviewCard' },
      { path: '/chat/AIGroupingCards', label: 'AIGroupingCards' },
      { path: '/chat/AISuggestedSearchCards', label: 'AISuggestedSearchCards' },
      { path: '/chat/ProsAndCons', label: 'ProsAndCons' },
      { path: '/chat/CategoriesContainer', label: 'CategoriesContainer' },
      { path: '/chat/HandoffNotice', label: 'HandoffNotice' },
      { path: '/chat/ProductSummaryCard', label: 'ProductSummaryCard' },
      { path: '/chat/PhotoAnalysisCard', label: 'PhotoAnalysisCard' },
      { path: '/chat/BeautyPhotoStep', label: 'BeautyPhotoStep' },
      { path: '/chat/Divider', label: 'Divider' },
    ],
  },
  {
    path: '/qna',
    label: 'QNA Components',
    section: 'qna',
    children: [
      { path: '/qna/ButtonRow', label: 'ButtonRow' },
      { path: '/qna/ActionButton', label: 'ActionButton' },
      { path: '/qna/TextInput', label: 'TextInput' },
      { path: '/qna/QuestionHeading', label: 'QuestionHeading' },
    ],
  },
  {
    path: '/simrel',
    label: 'SimRel Components',
    section: 'simrel',
    children: [
      { path: '/simrel/ProductGrid', label: 'ProductGrid' },
      { path: '/simrel/ProductCard', label: 'ProductCard' },
      { path: '/simrel/AddToCartButton', label: 'AddToCartButton' },
      { path: '/simrel/QuickActions', label: 'QuickActions' },
      { path: '/simrel/EmptyState', label: 'EmptyState' },
      { path: '/simrel/GroupTabs', label: 'GroupTabs' },
    ],
  },
  {
    path: '/simbut',
    label: 'SimBut Widget',
    section: 'simbut',
    children: [{ path: '/simbut/FindSimilarPill', label: 'FindSimilarPill' }],
  },
  { path: '/full-widgets', label: 'Full Widgets' },
  { path: '/themes', label: 'Theme Comparison' },
  { path: '/responsive', label: 'Responsive Preview' },
];

export type RouteHandler = (path: string) => void;

let currentHandler: RouteHandler | null = null;

export function getCurrentPath(): string {
  return window.location.hash.slice(1) || '/';
}

export function navigate(path: string): void {
  window.location.hash = path;
}

export function onRouteChange(handler: RouteHandler): void {
  currentHandler = handler;
  window.addEventListener('hashchange', () => {
    handler(getCurrentPath());
  });
  handler(getCurrentPath());
}

export function findRoute(path: string): Route | undefined {
  for (const route of ROUTES) {
    if (route.path === path) return route;
    if (route.children) {
      const child = route.children.find((c) => c.path === path);
      if (child) return child;
    }
  }
  return undefined;
}

export function getBreadcrumb(path: string): string[] {
  if (path === '/') return ['Overview'];
  for (const route of ROUTES) {
    if (route.path === path) return [route.label];
    if (route.children) {
      const child = route.children.find((c) => c.path === path);
      if (child) return [route.label, child.label];
    }
  }
  return [path];
}

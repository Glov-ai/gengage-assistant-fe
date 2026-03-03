/**
 * Page context management.
 *
 * Best practice for passing page context to widgets:
 *
 * ## SSR / Static pages
 * Set window.gengage.pageContext before widget scripts load:
 *
 *   <script>
 *     window.gengage = {
 *       pageContext: {
 *         pageType: 'pdp',
 *         sku: '{{ product.sku }}',
 *         price: '{{ product.price }}',
 *         categoryTree: {{ product.categories | json }},
 *       }
 *     };
 *   </script>
 *   <script src="https://cdn.gengage.ai/widgets/latest/chat.iife.js"></script>
 *
 * ## CSR / SPA (React, Vue, Next.js, etc.)
 * Call widget.update() after each navigation:
 *
 *   router.afterEach((to) => {
 *     chatWidget.update({
 *       pageType: to.meta.pageType,
 *       sku: to.params.sku,
 *     });
 *   });
 *
 * ## Event-based (loosest coupling)
 * Dispatch 'gengage:context:update' from anywhere:
 *
 *   window.dispatchEvent(new CustomEvent('gengage:context:update', {
 *     detail: { pageType: 'pdp', sku: '12345' }
 *   }));
 */

import type { PageContext, SessionContext } from './types.js';

// ---------------------------------------------------------------------------
// Session bootstrap
// ---------------------------------------------------------------------------

/**
 * Returns the shared session ID for this browser tab session.
 * Creates and persists it on first call.
 *
 * Call this once at page load and share the result with all widget configs:
 *
 *   const sessionId = bootstrapSession();
 *   chatWidget.init({ ..., session: { sessionId } });
 *   qnaWidget.init({ ..., session: { sessionId } });
 */
export function bootstrapSession(): string {
  const existing = window.__gengageSessionId ?? sessionStorage.getItem('gengage_session_id') ?? null;

  const sessionId = existing ?? crypto.randomUUID();

  window.__gengageSessionId = sessionId;
  sessionStorage.setItem('gengage_session_id', sessionId);

  if (!window.gengage) window.gengage = {};
  window.gengage.sessionId = sessionId;

  return sessionId;
}

// ---------------------------------------------------------------------------
// Page context resolution
// ---------------------------------------------------------------------------

/**
 * Reads the current page context from window.gengage.pageContext.
 * Returns null if not set.
 */
export function getWindowPageContext(): PageContext | null {
  return window.gengage?.pageContext ?? null;
}

/**
 * Merges a partial context update into the current window.gengage.pageContext.
 * Dispatches 'gengage:context:update' so all listening widgets update.
 */
export function updatePageContext(patch: Partial<PageContext>): void {
  if (!window.gengage) window.gengage = {};
  window.gengage.pageContext = {
    pageType: 'other',
    ...window.gengage.pageContext,
    ...patch,
  };

  window.dispatchEvent(new CustomEvent('gengage:context:update', { detail: patch }));
}

/**
 * Resolves the session context, bootstrapping if necessary.
 * Merges provided overrides with auto-generated session ID.
 */
export function resolveSession(overrides?: Partial<SessionContext>): SessionContext {
  const sessionId = overrides?.sessionId ?? bootstrapSession();
  return {
    sessionId,
    ...overrides,
  };
}

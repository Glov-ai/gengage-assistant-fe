// Widget CSS — chat.css is ?inline in dist (Shadow DOM), so import source directly.
// Vite resolves these via the filesystem, not URL paths.
import '../../src/chat/components/chat.css';
import '../../dist/qna.css';
import '../../dist/simrel.css';

import { mountLayout, updateBreadcrumb, highlightActiveNav, getContentEl } from './layout.js';
import { onRouteChange, getCurrentPath } from './router.js';
import { renderOverview } from './sections/overview.js';
import { renderChatComponent, CHAT_COMPONENT_NAMES } from './sections/chat-components.js';
import { renderQnaComponent, QNA_COMPONENT_NAMES } from './sections/qna-components.js';
import { renderSimrelComponent, SIMREL_COMPONENT_NAMES } from './sections/simrel-components.js';
import { renderFullWidgets } from './sections/full-widgets.js';
import { renderThemeComparison } from './sections/theme-comparison.js';
import { renderResponsivePreview } from './sections/responsive-preview.js';

const root = document.getElementById('catalog-root');
if (!root) throw new Error('Missing #catalog-root');

mountLayout(root);

onRouteChange((path) => {
  const content = getContentEl();
  if (!content) return;

  updateBreadcrumb(path);
  highlightActiveNav(path);
  content.innerHTML = '';

  if (path === '/') {
    renderOverview(content);
    return;
  }

  if (path === '/full-widgets') {
    renderFullWidgets(content);
    return;
  }

  if (path === '/themes') {
    renderThemeComparison(content);
    return;
  }

  if (path === '/responsive') {
    renderResponsivePreview(content);
    return;
  }

  // Chat component routes
  if (path.startsWith('/chat/')) {
    const name = path.slice('/chat/'.length);
    if (CHAT_COMPONENT_NAMES.includes(name)) {
      renderChatComponent(content, name);
      return;
    }
  }

  // QNA component routes
  if (path.startsWith('/qna/')) {
    const name = path.slice('/qna/'.length);
    if (QNA_COMPONENT_NAMES.includes(name)) {
      renderQnaComponent(content, name);
      return;
    }
  }

  // SimRel component routes
  if (path.startsWith('/simrel/')) {
    const name = path.slice('/simrel/'.length);
    if (SIMREL_COMPONENT_NAMES.includes(name)) {
      renderSimrelComponent(content, name);
      return;
    }
  }

  // 404
  const notFound = document.createElement('div');
  notFound.innerHTML = `<h2>404 — Not Found</h2><p>Route <code>${path}</code> does not exist.</p>`;
  content.appendChild(notFound);
});

/**
 * Full widget showcase: Chat + QNA + SimRel running with mock fetch backend.
 */

import { installMockBackend } from '../utils/mock-backend.js';

type DestroyableWidget = { destroy: () => void };
type QnaBridgeAction = { title: string; type: string; payload?: unknown };

export function renderFullWidgets(container: HTMLElement): void {
  const h2 = document.createElement('h2');
  h2.textContent = 'Full Widgets (Mock Backend)';
  h2.style.marginBottom = '8px';
  container.appendChild(h2);

  const note = document.createElement('p');
  note.textContent = 'All widgets are running with an intercepted fetch() returning canned NDJSON. Open DevTools console to see action callbacks.';
  note.style.color = '#666';
  note.style.fontSize = '13px';
  note.style.marginBottom = '20px';
  container.appendChild(note);

  const layout = document.createElement('div');
  layout.className = 'catalog-full-widgets';

  // Chat column
  const chatCol = document.createElement('div');
  chatCol.className = 'catalog-full-widget-col';
  const chatHeader = document.createElement('h4');
  chatHeader.textContent = 'Chat Widget';
  chatCol.appendChild(chatHeader);
  const chatBody = document.createElement('div');
  chatBody.className = 'catalog-full-widget-body';
  chatBody.id = 'catalog-chat-mount';
  chatCol.appendChild(chatBody);
  layout.appendChild(chatCol);

  // QNA column
  const qnaCol = document.createElement('div');
  qnaCol.className = 'catalog-full-widget-col';
  const qnaHeader = document.createElement('h4');
  qnaHeader.textContent = 'QNA Widget';
  qnaCol.appendChild(qnaHeader);
  const qnaBody = document.createElement('div');
  qnaBody.className = 'catalog-full-widget-body';
  qnaBody.id = 'catalog-qna-mount';
  qnaCol.appendChild(qnaBody);
  layout.appendChild(qnaCol);

  // SimRel column
  const simrelCol = document.createElement('div');
  simrelCol.className = 'catalog-full-widget-col';
  const simrelHeader = document.createElement('h4');
  simrelHeader.textContent = 'SimRel Widget';
  simrelCol.appendChild(simrelHeader);
  const simrelBody = document.createElement('div');
  simrelBody.className = 'catalog-full-widget-body';
  simrelBody.id = 'catalog-simrel-mount';
  simrelCol.appendChild(simrelBody);
  layout.appendChild(simrelCol);

  container.appendChild(layout);

  // Install mock backend and init widgets
  const restoreFetch = installMockBackend();
  const widgets: Array<DestroyableWidget> = [];
  const routeCleanups: Array<() => void> = [];
  let cleanedUp = false;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    restoreFetch();
    for (const fn of routeCleanups) {
      try {
        fn();
      } catch (err) {
        console.warn('[catalog] Route cleanup failed:', err);
      }
    }
    for (const widget of widgets) {
      try {
        widget.destroy();
      } catch (err) {
        console.warn('[catalog] Widget destroy failed:', err);
      }
    }
    observer.disconnect();
  };

  void initWidgets(widgets, routeCleanups).catch((err) => {
    console.error('[catalog] Widget init error:', err);
  });

  // Cleanup when navigating away — observe container removal
  const observer = new MutationObserver(() => {
    if (!document.getElementById('catalog-chat-mount')) {
      cleanup();
    }
  });
  observer.observe(container.parentElement ?? document.body, { childList: true, subtree: true });
}

async function initWidgets(widgets: Array<DestroyableWidget>, routeCleanups: Array<() => void>): Promise<void> {
  // Dynamic imports so these only load when the section is visited
  const { GengageChat } = await import('@gengage/assistant-fe/chat');
  const { GengageQNA } = await import('@gengage/assistant-fe/qna');
  const { GengageSimRel } = await import('@gengage/assistant-fe/simrel');

  const baseConfig = {
    accountId: 'koctascomtr',
    middlewareUrl: 'https://mock.gengage.ai',
    session: {
      sessionId: 'catalog-session-' + Date.now(),
    },
    pageContext: {
      pageType: 'pdp' as const,
      sku: 'DRILL-001',
    },
  };

  let chatApi:
    | {
        open: () => void;
        openWithAction: (action: QnaBridgeAction) => void;
      }
    | null = null;

  // Init Chat (floating launcher + drawer)
  try {
    const chat = new GengageChat();
    await chat.init({
      ...baseConfig,
      locale: 'tr',
      variant: 'floating',
      i18n: {
        headerTitle: 'Ürün Uzmanı',
        inputPlaceholder: 'Ürün ara, soru sor',
      },
    });
    chatApi = chat;
    widgets.push(chat);
  } catch (err) {
    console.warn('[catalog] Chat init failed:', err);
    const mount = document.getElementById('catalog-chat-mount');
    if (mount) mount.textContent = `Chat init error: ${err instanceof Error ? err.message : String(err)}`;
  }

  // Init QNA
  try {
    const qna = new GengageQNA();
    await qna.init({
      ...baseConfig,
      mountTarget: '#catalog-qna-mount',
    });
    widgets.push(qna);
  } catch (err) {
    console.warn('[catalog] QNA init failed:', err);
    const mount = document.getElementById('catalog-qna-mount');
    if (mount) mount.textContent = `QNA init error: ${err instanceof Error ? err.message : String(err)}`;
  }

  // Wire QNA → Chat bridge for full widget interaction parity with demos.
  if (chatApi) {
    const onQnaAction = (ev: Event) => {
      const detail = (ev as CustomEvent<QnaBridgeAction>).detail;
      if (!detail) return;
      chatApi?.openWithAction(detail);
    };
    const onQnaOpenChat = () => chatApi?.open();
    window.addEventListener('gengage:qna:action', onQnaAction);
    window.addEventListener('gengage:qna:open-chat', onQnaOpenChat);
    routeCleanups.push(() => {
      window.removeEventListener('gengage:qna:action', onQnaAction);
      window.removeEventListener('gengage:qna:open-chat', onQnaOpenChat);
    });
  }

  // Init SimRel
  try {
    const simrel = new GengageSimRel();
    await simrel.init({
      ...baseConfig,
      sku: 'DRILL-001',
      mountTarget: '#catalog-simrel-mount',
    });
    widgets.push(simrel);
  } catch (err) {
    console.warn('[catalog] SimRel init failed:', err);
    const mount = document.getElementById('catalog-simrel-mount');
    if (mount) mount.textContent = `SimRel init error: ${err instanceof Error ? err.message : String(err)}`;
  }

  // Chat uses a floating launcher pattern, so we keep explanatory text in-column.
  const chatMount = document.getElementById('catalog-chat-mount');
  if (chatMount) {
    const info = document.createElement('div');
    info.style.cssText = 'padding: 20px; color: #666; font-size: 13px; text-align: center;';
    info.innerHTML =
      '<p>Chat widget is active in this preview.</p>' +
      '<p style="margin-top: 8px;">Use the floating launcher at the bottom-right to open it.</p>';
    chatMount.appendChild(info);
  }
}

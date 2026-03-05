/**
 * Overview / landing page: component inventory table + SDK version.
 */

import { CHAT_SPECS } from '../mock-data/chat-specs.js';
import { QNA_SPECS } from '../mock-data/qna-specs.js';
import { SIMREL_SPECS } from '../mock-data/simrel-specs.js';
import { navigate } from '../router.js';

export function renderOverview(container: HTMLElement): void {
  const wrapper = document.createElement('div');
  wrapper.className = 'catalog-overview';

  const h1 = document.createElement('h1');
  h1.textContent = 'Component Catalog';
  wrapper.appendChild(h1);

  const badge = document.createElement('span');
  badge.className = 'version-badge';
  badge.textContent = '@gengage/assistant-fe v0.1.2';
  wrapper.appendChild(badge);

  const intro = document.createElement('p');
  intro.textContent =
    'Visual catalog of all UI components across Chat, QNA, and SimRel widgets. Click a component name to see it rendered with mock data.';
  intro.style.marginBottom = '24px';
  intro.style.color = '#666';
  wrapper.appendChild(intro);

  // Chat components table
  wrapper.appendChild(createSectionTable('Chat Components', CHAT_SPECS, '/chat'));

  // QNA components table
  wrapper.appendChild(createSectionTable('QNA Components', QNA_SPECS, '/qna'));

  // SimRel components table
  wrapper.appendChild(createSectionTable('SimRel Components', SIMREL_SPECS, '/simrel'));

  container.appendChild(wrapper);
}

function createSectionTable(
  title: string,
  specs: Record<string, { description: string }>,
  basePath: string,
): HTMLElement {
  const section = document.createElement('div');
  section.style.marginBottom = '32px';

  const h2 = document.createElement('h2');
  h2.textContent = title;
  h2.style.fontSize = '18px';
  h2.style.marginBottom = '12px';
  section.appendChild(h2);

  const table = document.createElement('table');

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const label of ['Component', 'Description']) {
    const th = document.createElement('th');
    th.textContent = label;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const [name, entry] of Object.entries(specs)) {
    const row = document.createElement('tr');

    const nameCell = document.createElement('td');
    const link = document.createElement('a');
    link.href = `#${basePath}/${name}`;
    link.textContent = name;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(`${basePath}/${name}`);
    });
    nameCell.appendChild(link);
    row.appendChild(nameCell);

    const descCell = document.createElement('td');
    descCell.textContent = entry.description;
    row.appendChild(descCell);

    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  section.appendChild(table);

  return section;
}

/**
 * Renders a Pros & Cons list for a product.
 *
 * XSS safety: All text is set via textContent. No innerHTML.
 */

export function renderProsAndCons(element: { props?: Record<string, unknown> }): HTMLElement {
  const container = document.createElement('div');
  container.className = 'gengage-chat-pros-cons gds-card-soft';
  container.dataset['gengagePart'] = 'pros-cons';

  const productName = element.props?.['productName'] as string | undefined;
  if (productName) {
    const heading = document.createElement('h4');
    heading.className = 'gengage-chat-pros-cons-heading';
    heading.textContent = productName;
    container.appendChild(heading);
  }

  const pros = element.props?.['pros'] as string[] | undefined;
  const cons = element.props?.['cons'] as string[] | undefined;

  if (pros && pros.length > 0) {
    const prosList = document.createElement('ul');
    prosList.className = 'gengage-chat-pros-cons-list';
    prosList.dataset['gengagePart'] = 'pros-list';
    for (const pro of pros) {
      const li = document.createElement('li');
      li.className = 'gengage-chat-pros-cons-item';
      li.dataset['gengagePart'] = 'pros-item';
      const icon = document.createElement('span');
      icon.className = 'gengage-chat-pros-cons-icon gengage-chat-pros-cons-icon--pro';
      icon.textContent = '\u2713';
      li.appendChild(icon);
      const text = document.createElement('span');
      text.textContent = pro;
      li.appendChild(text);
      prosList.appendChild(li);
    }
    container.appendChild(prosList);
  }

  if (cons && cons.length > 0) {
    const consList = document.createElement('ul');
    consList.className = 'gengage-chat-pros-cons-list';
    consList.dataset['gengagePart'] = 'cons-list';
    for (const con of cons) {
      const li = document.createElement('li');
      li.className = 'gengage-chat-pros-cons-item';
      li.dataset['gengagePart'] = 'cons-item';
      const icon = document.createElement('span');
      icon.className = 'gengage-chat-pros-cons-icon gengage-chat-pros-cons-icon--con';
      icon.textContent = '\u2717';
      li.appendChild(icon);
      const text = document.createElement('span');
      text.textContent = con;
      li.appendChild(text);
      consList.appendChild(li);
    }
    container.appendChild(consList);
  }

  return container;
}

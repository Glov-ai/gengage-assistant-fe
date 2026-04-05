import { describe, it, expect } from 'vitest';
import { renderProsAndCons } from '../src/chat/components/ProsAndCons.js';

describe('renderProsAndCons', () => {
  it('renders heading with product name', () => {
    const el = renderProsAndCons({
      props: { productName: 'Bosch Matkap', pros: ['Güçlü'], cons: ['Ağır'] },
    });
    expect(el.classList.contains('gengage-chat-pros-cons')).toBe(true);
    expect(el.classList.contains('gds-card-soft')).toBe(true);
    const heading = el.querySelector('.gengage-chat-pros-cons-heading');
    expect(heading).not.toBeNull();
    expect(heading!.textContent).toBe('Bosch Matkap');
  });

  it('renders pro items with green checkmark icons', () => {
    const el = renderProsAndCons({
      props: { pros: ['Dayanıklı', 'Uygun fiyat'], cons: [] },
    });
    const items = el.querySelectorAll('.gengage-chat-pros-cons-icon--pro');
    expect(items).toHaveLength(2);
    expect(items[0]!.textContent).toBe('\u2713');
  });

  it('renders con items with red X icons', () => {
    const el = renderProsAndCons({
      props: { pros: [], cons: ['Ağır', 'Gürültülü'] },
    });
    const items = el.querySelectorAll('.gengage-chat-pros-cons-icon--con');
    expect(items).toHaveLength(2);
    expect(items[0]!.textContent).toBe('\u2717');
  });

  it('handles empty arrays gracefully', () => {
    const el = renderProsAndCons({
      props: { pros: [], cons: [] },
    });
    expect(el.querySelectorAll('.gengage-chat-pros-cons-list')).toHaveLength(0);
  });

  it('renders without product name', () => {
    const el = renderProsAndCons({
      props: { pros: ['İyi'], cons: ['Kötü'] },
    });
    expect(el.querySelector('.gengage-chat-pros-cons-heading')).toBeNull();
    expect(el.querySelectorAll('.gengage-chat-pros-cons-item')).toHaveLength(2);
  });

  it('renders with only pros', () => {
    const el = renderProsAndCons({
      props: { pros: ['Hızlı', 'Sessiz'] },
    });
    const lists = el.querySelectorAll('.gengage-chat-pros-cons-list');
    expect(lists).toHaveLength(1);
    expect(el.querySelectorAll('.gengage-chat-pros-cons-icon--pro')).toHaveLength(2);
    expect(el.querySelectorAll('.gengage-chat-pros-cons-icon--con')).toHaveLength(0);
  });

  it('renders with only cons', () => {
    const el = renderProsAndCons({
      props: { cons: ['Pahalı'] },
    });
    const lists = el.querySelectorAll('.gengage-chat-pros-cons-list');
    expect(lists).toHaveLength(1);
    expect(el.querySelectorAll('.gengage-chat-pros-cons-icon--con')).toHaveLength(1);
  });

  it('renders with no props', () => {
    const el = renderProsAndCons({});
    expect(el.classList.contains('gengage-chat-pros-cons')).toBe(true);
    expect(el.classList.contains('gds-card-soft')).toBe(true);
    expect(el.children).toHaveLength(0);
  });

  it('sets text via textContent (XSS-safe)', () => {
    const el = renderProsAndCons({
      props: {
        productName: '<script>alert(1)</script>',
        pros: ['<img onerror=alert(1)>'],
      },
    });
    const heading = el.querySelector('.gengage-chat-pros-cons-heading');
    expect(heading!.textContent).toBe('<script>alert(1)</script>');
    expect(heading!.innerHTML).not.toContain('<script>');
  });
});

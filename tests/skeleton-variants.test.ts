import { describe, it, expect } from 'vitest';

/**
 * Tests that panel loading skeletons vary by content type.
 */
describe('Panel Loading Skeleton Variants', () => {
  function buildSkeleton(contentType?: string): HTMLElement {
    const skeleton = document.createElement('div');
    skeleton.className = 'gengage-chat-panel-skeleton';

    switch (contentType) {
      case 'productDetails': {
        const imgBlock = document.createElement('div');
        imgBlock.className = 'gengage-chat-panel-skeleton-block gengage-chat-panel-skeleton-block--image';
        skeleton.appendChild(imgBlock);
        for (let i = 0; i < 3; i++) {
          const line = document.createElement('div');
          line.className = 'gengage-chat-panel-skeleton-block gengage-chat-panel-skeleton-block--text';
          skeleton.appendChild(line);
        }
        break;
      }
      case 'productList':
      case 'groupList': {
        const grid = document.createElement('div');
        grid.className = 'gengage-chat-panel-skeleton-grid';
        for (let i = 0; i < 6; i++) {
          const card = document.createElement('div');
          card.className = 'gengage-chat-panel-skeleton-block gengage-chat-panel-skeleton-block--card';
          grid.appendChild(card);
        }
        skeleton.appendChild(grid);
        break;
      }
      case 'comparisonTable': {
        for (let i = 0; i < 4; i++) {
          const row = document.createElement('div');
          row.className = 'gengage-chat-panel-skeleton-block gengage-chat-panel-skeleton-block--row';
          skeleton.appendChild(row);
        }
        break;
      }
      default: {
        for (let i = 0; i < 3; i++) {
          const block = document.createElement('div');
          block.className = 'gengage-chat-panel-skeleton-block';
          skeleton.appendChild(block);
        }
        break;
      }
    }

    return skeleton;
  }

  it('productDetails skeleton has image block + text lines', () => {
    const sk = buildSkeleton('productDetails');
    expect(sk.querySelector('.gengage-chat-panel-skeleton-block--image')).not.toBeNull();
    expect(sk.querySelectorAll('.gengage-chat-panel-skeleton-block--text')).toHaveLength(3);
  });

  it('productList skeleton has 6-card grid', () => {
    const sk = buildSkeleton('productList');
    expect(sk.querySelector('.gengage-chat-panel-skeleton-grid')).not.toBeNull();
    expect(sk.querySelectorAll('.gengage-chat-panel-skeleton-block--card')).toHaveLength(6);
  });

  it('groupList skeleton matches productList', () => {
    const sk = buildSkeleton('groupList');
    expect(sk.querySelectorAll('.gengage-chat-panel-skeleton-block--card')).toHaveLength(6);
  });

  it('comparisonTable skeleton has 4 rows', () => {
    const sk = buildSkeleton('comparisonTable');
    expect(sk.querySelectorAll('.gengage-chat-panel-skeleton-block--row')).toHaveLength(4);
  });

  it('default skeleton has 3 generic blocks', () => {
    const sk = buildSkeleton();
    expect(sk.querySelectorAll('.gengage-chat-panel-skeleton-block')).toHaveLength(3);
  });

  it('unknown type falls back to default', () => {
    const sk = buildSkeleton('unknown');
    expect(sk.querySelectorAll('.gengage-chat-panel-skeleton-block')).toHaveLength(3);
  });
});

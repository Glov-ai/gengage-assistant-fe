import { describe, it, expect, beforeEach } from 'vitest';
import { renderAITopPicks } from '../src/chat/components/AITopPicks.js';
import type { ChatUISpecRenderContext } from '../src/chat/types.js';

describe('AITopPicks reason rendering', () => {
  let ctx: ChatUISpecRenderContext;

  beforeEach(() => {
    ctx = {
      onAction: () => {},
      i18n: {
        aiTopPicksTitle: 'Top Picks',
        roleWinner: 'Winner',
        roleBestValue: 'Best Value',
        roleBestAlternative: 'Best Alternative',
        viewDetails: 'View Details',
        productCtaLabel: 'Go',
        groundingReviewCta: 'Reviews',
        variantsLabel: 'Variants',
        sortRelated: 'Related',
        sortPriceAsc: 'Lowest',
        sortPriceDesc: 'Highest',
        compareSelected: 'Compare',
        panelTitleProductDetails: 'Product Details',
        panelTitleSimilarProducts: 'Similar',
        panelTitleComparisonResults: 'Comparison',
        panelTitleCategories: 'Categories',
        inStockLabel: 'In Stock',
        outOfStockLabel: 'Out of Stock',
        findSimilarLabel: 'Find Similar',
        viewMoreLabel: 'View More',
        similarProductsLabel: 'Similar Products',
      },
    };
  });

  it('renders reason text on winner card', () => {
    const el = {
      type: 'AITopPicks' as const,
      props: {
        suggestions: [
          {
            product: { name: 'Product A', imageUrl: 'https://img/a.jpg', price: '100' },
            role: 'winner',
            reason: 'Best overall performance and value',
            action: { title: 'View', type: 'launchSingleProduct', payload: { sku: 'A' } },
          },
        ],
      },
    };

    const result = renderAITopPicks(el, ctx);
    const reasonEl = result.querySelector('.gengage-chat-ai-toppick-reason');
    expect(reasonEl).not.toBeNull();
    expect(reasonEl!.textContent).toBe('Best overall performance and value');
  });

  it('does not render reason text on compact card', () => {
    const el = {
      type: 'AITopPicks' as const,
      props: {
        suggestions: [
          {
            product: { name: 'Winner', price: '200' },
            role: 'winner',
            action: { title: 'V', type: 'launchSingleProduct', payload: { sku: 'W' } },
          },
          {
            product: { name: 'Product B', price: '150' },
            role: 'best_value',
            reason: 'Great price-to-performance ratio',
            action: { title: 'View', type: 'launchSingleProduct', payload: { sku: 'B' } },
          },
        ],
      },
    };

    const result = renderAITopPicks(el, ctx);
    const cards = result.querySelectorAll('.gengage-chat-ai-toppick-card');
    const compactCard = cards[1]!;
    const reasonEl = compactCard.querySelector('.gengage-chat-ai-toppick-reason');
    expect(reasonEl).toBeNull();
  });

  it('omits reason element when reason is not provided', () => {
    const el = {
      type: 'AITopPicks' as const,
      props: {
        suggestions: [
          {
            product: { name: 'Product C', price: '50' },
            role: 'winner',
            action: { title: 'V', type: 'launchSingleProduct', payload: { sku: 'C' } },
          },
        ],
      },
    };

    const result = renderAITopPicks(el, ctx);
    expect(result.querySelector('.gengage-chat-ai-toppick-reason')).toBeNull();
  });
});

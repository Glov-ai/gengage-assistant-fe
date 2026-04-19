import { describe, it, expect } from 'vitest';
import {
  adaptBackendEvent,
  productToNormalized,
  normalizeSimilarProductsResponse,
  normalizeProductGroupingsResponse,
} from '../src/common/protocol-adapter.js';
import similarFixture from './fixtures/ndjson/similar-products.json';
import groupingsFixture from './fixtures/ndjson/product-groupings.json';

describe('adaptBackendEvent', () => {
  it('passes through normalized events unchanged', () => {
    const event = { type: 'text_chunk', content: 'hello', final: true };
    const result = adaptBackendEvent(event);
    expect(result).toEqual(event);
  });

  it('passes through normalized metadata events', () => {
    const event = { type: 'metadata', sessionId: 's1', model: 'gpt-4o' };
    const result = adaptBackendEvent(event);
    expect(result).toEqual(event);
  });

  it('passes through normalized done events', () => {
    const event = { type: 'done' };
    const result = adaptBackendEvent(event);
    expect(result).toEqual(event);
  });

  it('adapts outputText to text_chunk', () => {
    const raw = {
      type: 'outputText',
      payload: { text: '<p>Hello</p>', plain_text: 'Hello' },
    };
    const result = adaptBackendEvent(raw)!;
    expect(result.type).toBe('text_chunk');
    expect((result as { content: string }).content).toBe('<p>Hello</p>');
    expect((result as { final?: boolean }).final).toBe(true);
  });

  it('adapts outputText with is_error to normalized error', () => {
    const raw = {
      type: 'outputText',
      payload: { text: 'Something went wrong', plain_text: 'Something went wrong', is_error: true },
    };
    const result = adaptBackendEvent(raw)!;
    expect(result.type).toBe('error');
    expect((result as { code: string }).code).toBe('BACKEND_ERROR');
    expect((result as { message: string }).message).toBe('Something went wrong');
  });

  it('adapts backend error payload shape to normalized error', () => {
    const raw = {
      type: 'error',
      payload: { text: 'Backend failed' },
    };
    const result = adaptBackendEvent(raw)!;
    expect(result).toEqual({
      type: 'error',
      code: 'BACKEND_ERROR',
      message: 'Backend failed',
    });
  });

  it('adapts suggestedActions to chat ui_spec', () => {
    const raw = {
      type: 'suggestedActions',
      payload: {
        actions: [
          {
            title: 'Kargo bilgisi',
            icon: 'info',
            requestDetails: { type: 'launcherQuestionClick', payload: { text: 'Kargo' } },
          },
          {
            title: 'Benzer urunler',
            icon: 'similar',
            requestDetails: { type: 'findSimilar', payload: { sku: '123' } },
          },
        ],
      },
    };
    const result = adaptBackendEvent(raw)!;
    expect(result.type).toBe('ui_spec');
    const uiSpec = result as {
      widget: string;
      spec: { root: string; elements: Record<string, unknown> };
    };
    expect(uiSpec.widget).toBe('chat');
    expect(uiSpec.spec.root).toBe('root');
    expect(Object.keys(uiSpec.spec.elements)).toContain('action-0');
    expect(Object.keys(uiSpec.spec.elements)).toContain('action-1');
  });

  it('adapts productList to panel ui_spec with ProductGrid', () => {
    const raw = {
      type: 'productList',
      payload: {
        product_list: [
          { sku: 'P1', name: 'Product 1', brand: 'B1', images: ['img.jpg'], price: 100, url: 'https://example.com' },
        ],
      },
    };
    const result = adaptBackendEvent(raw)!;
    expect(result.type).toBe('ui_spec');
    expect((result as { panelHint?: string }).panelHint).toBe('panel');
    const uiSpec = result as { spec: { elements: Record<string, { type: string; props?: Record<string, unknown> }> } };
    expect(uiSpec.spec.elements['root']!.type).toBe('ProductGrid');
    expect(uiSpec.spec.elements['product-0']!.props?.['action']).toEqual({
      title: 'B1 Product 1',
      type: 'launchSingleProduct',
      payload: { sku: 'P1' },
    });
  });

  it('preserves consulting variation status and replace_panel metadata on productList', () => {
    const raw = {
      type: 'productList',
      payload: {
        replace_panel: true,
        source: 'beauty_consulting',
        style_variations: [
          {
            style_label: 'Glow',
            style_mood: 'Soft focus glow',
            status: 'loading',
            product_list: [],
            recommendation_groups: [],
          },
        ],
      },
    };
    const result = adaptBackendEvent(raw)!;

    expect(result.type).toBe('ui_spec');
    const uiSpec = result as {
      spec: { elements: Record<string, { type: string; props?: Record<string, unknown> }> };
    };
    const rootProps = uiSpec.spec.elements['root']!.props!;
    expect(rootProps['replacePanel']).toBe(true);
    expect(rootProps['source']).toBe('beauty_consulting');
    expect(rootProps['styleVariations']).toEqual([
      {
        style_label: 'Glow',
        style_mood: 'Soft focus glow',
        status: 'loading',
        product_list: [],
        recommendation_groups: [],
      },
    ]);
  });

  it('adapts productDetails to panel ui_spec with ProductDetailsPanel', () => {
    const raw = {
      type: 'productDetails',
      payload: {
        productDetails: {
          sku: 'P1',
          name: 'Detail Product',
          price: 200,
          url: 'https://example.com',
          description: 'Long form description',
          specifications: { Color: 'Black' },
        },
      },
    };
    const result = adaptBackendEvent(raw)!;
    expect(result.type).toBe('ui_spec');
    expect((result as { panelHint?: string }).panelHint).toBe('panel');
    const uiSpec = result as { spec: { elements: Record<string, { type: string; props?: Record<string, unknown> }> } };
    expect(uiSpec.spec.elements['root']!.type).toBe('ProductDetailsPanel');
    const product = uiSpec.spec.elements['root']!.props?.['product'] as Record<string, unknown>;
    expect(product['description']).toBe('Long form description');
    expect(product['specifications']).toEqual({ Color: 'Black' });
  });

  it('ignores legacy hide_side_panel on productDetails (client uses productDetailsExtended)', () => {
    const raw = {
      type: 'productDetails',
      payload: {
        hide_side_panel: true,
        productDetails: {
          sku: 'P1',
          name: 'Detail Product',
          price: 200,
          url: 'https://example.com',
        },
      },
    };
    const result = adaptBackendEvent(raw)!;
    expect(result.type).toBe('ui_spec');
    expect((result as { panelHint?: string }).panelHint).toBe('panel');
    expect((result as { clearPanel?: boolean }).clearPanel).toBeUndefined();
    const uiSpec = result as { spec: { elements: Record<string, { type: string }> } };
    expect(uiSpec.spec.elements['root']!.type).toBe('ProductDetailsPanel');
  });

  it('adapts productDetailsSimilars to chat panel ui_spec', () => {
    const raw = {
      type: 'productDetailsSimilars',
      payload: {
        similarProducts: [{ sku: 'S1', name: 'Similar 1', price: 50, url: 'https://example.com/s1' }],
      },
    };
    const result = adaptBackendEvent(raw)!;
    expect(result.type).toBe('ui_spec');
    expect((result as { widget: string }).widget).toBe('chat');
    expect((result as { panelHint?: string }).panelHint).toBe('panel');
  });

  it('adapts comparisonTable to panel ComparisonTable ui_spec', () => {
    const raw = {
      type: 'comparisonTable',
      payload: {
        multiple_product_details: [
          { sku: 'C1', name: 'Compare 1', price: 100, url: 'https://example.com/c1' },
          { sku: 'C2', name: 'Compare 2', price: 200, url: 'https://example.com/c2' },
        ],
      },
    };
    const result = adaptBackendEvent(raw)!;
    expect(result.type).toBe('ui_spec');
    expect((result as { panelHint?: string }).panelHint).toBe('panel');
    const uiSpec = result as { spec: { elements: Record<string, { type: string; props?: Record<string, unknown> }> } };
    expect(uiSpec.spec.elements['root']!.type).toBe('ComparisonTable');
    const props = uiSpec.spec.elements['root']!.props!;
    expect(props['products']).toHaveLength(2);
    expect(props['recommended']).toBeDefined();
  });

  it('adapts comparisonTable with rich framework data', () => {
    const raw = {
      type: 'comparisonTable',
      payload: {
        multiple_product_details: [
          { sku: 'C1', name: 'Compare 1', price: 100, url: 'https://example.com/c1' },
          { sku: 'C2', name: 'Compare 2', price: 200, url: 'https://example.com/c2' },
        ],
        table: {
          brand: ['BrandA', 'BrandB'],
          weight: ['1kg', '2kg'],
        },
        product_comparison_framework: {
          key_differences: ['Price difference is significant', 'BrandA is lighter'],
          recommended_choice: 'BrandA offers better value for money',
          recommended_choice_sku: 'C1',
          special_considerations: ['If you need heavier items, choose C2'],
          criteria_view: { brand: 'Marka', weight: 'Ağırlık' },
          compared_field_names: ['brand', 'weight'],
          winner_hits: {
            C1: { positive: ['Lighter', 'Cheaper'] },
            C2: { positive: ['Heavier'], negative: ['More expensive'] },
          },
        },
      },
    };
    const result = adaptBackendEvent(raw)!;
    expect(result.type).toBe('ui_spec');
    const uiSpec = result as { spec: { elements: Record<string, { type: string; props?: Record<string, unknown> }> } };
    const props = uiSpec.spec.elements['root']!.props!;
    expect(props['attributes']).toEqual([
      { label: 'Marka', values: ['BrandA', 'BrandB'] },
      { label: 'Ağırlık', values: ['1kg', '2kg'] },
    ]);
    expect(props['highlights']).toEqual(['Price difference is significant', 'BrandA is lighter']);
    expect(props['specialCases']).toEqual(['If you need heavier items, choose C2']);
    expect(props['recommendedText']).toBe('BrandA offers better value for money');
    expect(props['winnerHits']).toBeDefined();
    const recommended = props['recommended'] as Record<string, unknown>;
    expect(recommended['sku']).toBe('C1');
  });

  it('adapts context to metadata', () => {
    const raw = {
      type: 'context',
      payload: {
        panel: { screen_type: 'product_list' },
        messages: [{ role: 'model', content: 'hi' }],
        message_id: 'msg-1',
      },
    };
    const result = adaptBackendEvent(raw)!;
    expect(result.type).toBe('metadata');
    const meta = result as { meta?: { panel: unknown } };
    expect(meta.meta?.panel).toEqual({ screen_type: 'product_list' });
  });

  it('adapts loading to metadata with loading flag', () => {
    const raw = {
      type: 'loading',
      payload: { text: 'Dusunuyorum...', is_dynamic: true },
    };
    const result = adaptBackendEvent(raw)!;
    expect(result.type).toBe('metadata');
    const meta = result as { meta?: Record<string, unknown> };
    expect(meta.meta?.['loading']).toBe(true);
    expect(meta.meta?.['dynamicLoading']).toBe(true);
    expect(meta.meta?.['loadingText']).toBe('Dusunuyorum...');
  });

  it('adapts panelLoading and similarLoading metadata flags', () => {
    const panelLoading = adaptBackendEvent({
      type: 'panelLoading',
      payload: { pending_type: 'productDetails' },
    }) as { type: string; meta?: Record<string, unknown> };
    expect(panelLoading.type).toBe('metadata');
    expect(panelLoading.meta?.['panelLoading']).toBe(true);

    const similarLoading = adaptBackendEvent({
      type: 'similarLoading',
      payload: { pending_type: 'productDetailsSimilars' },
    }) as { type: string; meta?: Record<string, unknown> };
    expect(similarLoading.type).toBe('metadata');
    expect(similarLoading.meta?.['panelLoading']).toBeUndefined();
    expect(similarLoading.meta?.['similarPanelLoading']).toBe(true);
  });

  it('adapts redirect with url to action(navigate)', () => {
    const raw = {
      type: 'redirect',
      payload: { url: 'https://example.com/page', new_tab: true },
    };
    const result = adaptBackendEvent(raw)!;
    expect(result.type).toBe('action');
    const action = result as { action: { kind: string; url: string; newTab: boolean } };
    expect(action.action.kind).toBe('navigate');
    expect(action.action.url).toBe('https://example.com/page');
    expect(action.action.newTab).toBe(true);
  });

  it('adapts redirect without url to metadata payload', () => {
    const result = adaptBackendEvent({
      type: 'redirect',
      payload: { to: 'voiceLead' },
    }) as { type: string; meta?: Record<string, unknown> };
    expect(result.type).toBe('metadata');
    expect(result.meta?.['redirectTarget']).toBe('voiceLead');
  });

  it('adapts launcher text and widgets to qna ui_spec', () => {
    const heading = adaptBackendEvent({
      type: 'text',
      payload: { text: 'Birlikte inceleyelim' },
    }) as { type: string; widget?: string; spec?: { elements: Record<string, { type: string }> } };
    expect(heading.type).toBe('ui_spec');
    expect(heading.widget).toBe('qna');
    expect(heading.spec?.elements['root']?.type).toBe('QuestionHeading');

    const quickQna = adaptBackendEvent({
      type: 'quick_qna',
      payload: {
        action_list: [
          {
            title: 'Kargo',
            requestDetails: { type: 'launcherQuestionClick', payload: { text: 'Kargo' } },
          },
        ],
      },
    }) as { type: string; widget?: string; spec?: { elements: Record<string, { type: string }> } };
    expect(quickQna.type).toBe('ui_spec');
    expect(quickQna.widget).toBe('qna');
    expect(quickQna.spec?.elements['root']?.type).toBe('ActionButtons');
  });

  it('adapts reviewHighlights to ui_spec', () => {
    const result = adaptBackendEvent({
      type: 'reviewHighlights',
      payload: {
        sku: 'SKU1',
        reviews: [{ review_class: 'positive', review_text: 'Harika urun', review_rating: '5/5', review_tag: 'Kalite' }],
      },
    }) as { type: string; spec?: { elements: Record<string, { type: string }> } };
    expect(result.type).toBe('ui_spec');
    expect(result.spec?.elements['root']?.type).toBe('ReviewHighlights');
  });

  it('adapts aiProductSuggestions to AITopPicks ui_spec', () => {
    const result = adaptBackendEvent({
      type: 'aiProductSuggestions',
      payload: {
        product_suggestions: [
          {
            sku: 'SKU1',
            short_name: 'Model 1',
            role: 'winner',
            reason: 'Best overall',
            labels: [{ label: 'Durable', sentiment: 'positive' }],
            expert_quality_score: 9,
            review_highlight: 'Great product',
            product_item: {
              sku: 'SKU1',
              name: 'Model 1',
              url: 'https://example.com/1',
              price: 1000,
            },
            requestDetails: { type: 'launchSingleProduct', payload: { sku: 'SKU1' } },
          },
        ],
      },
    }) as {
      type: string;
      spec?: { root: string; elements: Record<string, { type: string; props?: Record<string, unknown> }> };
    };
    expect(result.type).toBe('ui_spec');
    expect(result.spec?.elements['root']?.type).toBe('AITopPicks');

    // Verify rich data is preserved in suggestions
    const suggestions = result.spec?.elements['root']?.props?.['suggestions'] as
      | Array<Record<string, unknown>>
      | undefined;
    expect(suggestions).toHaveLength(1);
    const item = suggestions![0]!;
    expect(item['role']).toBe('winner');
    expect(item['reason']).toBe('Best overall');
    expect(item['labels']).toEqual([{ label: 'Durable', sentiment: 'positive' }]);
    expect(item['expertQualityScore']).toBe(9);
    expect(item['reviewHighlight']).toBe('Great product');
    expect(item['action']).toBeDefined();
  });

  it('merges aiProductSuggestions discount_reason into normalized product', () => {
    const result = adaptBackendEvent({
      type: 'aiProductSuggestions',
      payload: {
        product_suggestions: [
          {
            sku: 'SKU1',
            short_name: 'Model 1',
            role: 'winner',
            discount_reason: "Oliz'e Özel",
            product_item: {
              sku: 'SKU1',
              name: 'Model 1',
              url: 'https://example.com/1',
              price: 1000,
            },
            requestDetails: { type: 'launchSingleProduct', payload: { sku: 'SKU1' } },
          },
        ],
      },
    }) as {
      type: string;
      spec?: { elements: Record<string, { props?: Record<string, unknown> }> };
    };
    const suggestions = result.spec?.elements['root']?.props?.['suggestions'] as
      | Array<{ product?: { discountReason?: string } }>
      | undefined;
    expect(suggestions?.[0]?.product?.discountReason).toBe("Oliz'e Özel");
  });

  it('adapts aiProductGroupings to AIGroupingCards ui_spec', () => {
    const groupings = adaptBackendEvent({
      type: 'aiProductGroupings',
      payload: {
        product_groupings: [
          {
            name: 'Aile boyu',
            sku: 'SKU1',
            labels: ['Genis', 'Performans'],
            requestDetails: { type: 'findSimilar', payload: { sku: 'SKU1' } },
          },
        ],
      },
    }) as { type: string; spec?: { elements: Record<string, { type: string; props?: Record<string, unknown> }> } };
    expect(groupings.type).toBe('ui_spec');
    expect(groupings.spec?.elements['root']?.type).toBe('AIGroupingCards');

    // Verify entry data is preserved
    const entries = groupings.spec?.elements['root']?.props?.['entries'] as Array<Record<string, unknown>> | undefined;
    expect(entries).toHaveLength(1);
    expect(entries![0]!['name']).toBe('Aile boyu');
    expect(entries![0]!['labels']).toEqual(['Genis', 'Performans']);
    expect(entries![0]!['action']).toBeDefined();
  });

  it('adapts aiSuggestedSearches to AISuggestedSearchCards ui_spec', () => {
    const searches = adaptBackendEvent({
      type: 'aiSuggestedSearches',
      payload: {
        suggested_searches: [
          {
            short_name: 'Daha guclu',
            detailed_user_message: 'Daha guclu modelleri goster',
            why_different: 'Daha yuksek performans',
            sku: 'SKU2',
          },
        ],
      },
    }) as { type: string; spec?: { elements: Record<string, { type: string; props?: Record<string, unknown> }> } };
    expect(searches.type).toBe('ui_spec');
    expect(searches.spec?.elements['root']?.type).toBe('AISuggestedSearchCards');

    // Verify entry data is preserved
    const entries = searches.spec?.elements['root']?.props?.['entries'] as Array<Record<string, unknown>> | undefined;
    expect(entries).toHaveLength(1);
    expect(entries![0]!['shortName']).toBe('Daha guclu');
    expect(entries![0]!['detailedMessage']).toBe('Daha guclu modelleri goster');
    // Compact keyword line — not raw why_different; duplicates short name are omitted
    expect(entries![0]!['whyDifferent']).toBeUndefined();
  });

  it('maps display_keywords to AISuggestedSearchCards whyDifferent line', () => {
    const searches = adaptBackendEvent({
      type: 'aiSuggestedSearches',
      payload: {
        suggested_searches: [
          {
            short_name: 'Premium',
            detailed_user_message: 'Premium modelleri goster',
            why_different: 'Long sentence that must not appear on the card.',
            display_keywords: ['A', 'B'],
            sku: 'SKU1',
          },
        ],
      },
    }) as { type: string; spec?: { elements: Record<string, { type: string; props?: Record<string, unknown> }> } };
    const entries = searches.spec?.elements['root']?.props?.['entries'] as Array<Record<string, unknown>> | undefined;
    expect(entries?.[0]?.['whyDifferent']).toBe('A • B');
  });

  it('normalizes findSimilar suggested-search actions into inputText search actions when detailed text exists', () => {
    const searches = adaptBackendEvent({
      type: 'aiSuggestedSearches',
      payload: {
        suggested_searches: [
          {
            short_name: 'Beyaz Renkli Kurutma Makinesi',
            detailed_user_message: 'Beyaz renkli kurutma makinesi oner',
            requestDetails: {
              type: 'findSimilar',
              payload: { sku: '7188270150', input: 'Beyaz Model', group_skus: ['7188270150'] },
            },
          },
        ],
      },
    }) as { type: string; spec?: { elements: Record<string, { type: string; props?: Record<string, unknown> }> } };

    const entries = searches.spec?.elements['root']?.props?.['entries'] as Array<Record<string, unknown>> | undefined;
    const action = entries?.[0]?.['action'] as { type: string; payload?: Record<string, unknown> } | undefined;
    expect(action?.type).toBe('inputText');
    expect(action?.payload?.['text']).toBe('Beyaz renkli kurutma makinesi oner');
    expect(action?.payload?.['group_skus']).toEqual(['7188270150']);
  });

  it('adapts getGroundingReview to GroundingReviewCard ui_spec', () => {
    const result = adaptBackendEvent({
      type: 'getGroundingReview',
      payload: {
        title: 'Yorumlar',
        text: 'Yorumlari goster',
        review_count: '42',
        requestDetails: { type: 'reviewSummary', payload: { sku: 'SKU1' } },
      },
    }) as { type: string; spec?: { elements: Record<string, { type: string; props?: Record<string, unknown> }> } };
    expect(result.type).toBe('ui_spec');
    expect(result.spec?.elements['root']?.type).toBe('GroundingReviewCard');

    // Verify props are preserved
    const props = result.spec?.elements['root']?.props;
    expect(props?.['title']).toBe('Yorumlar');
    expect(props?.['text']).toBe('Yorumlari goster');
    expect(props?.['reviewCount']).toBe('42');
    expect(props?.['action']).toBeDefined();
  });

  it('adapts getGroundingReview with snake_case request_details and reviewCount', () => {
    const result = adaptBackendEvent({
      type: 'getGroundingReview',
      payload: {
        title: 'Kullanıcılar ne diyor:',
        reviewCount: 'Değerlendirmeler (986)',
        text: 'Değerlendirmeler',
        request_details: { type: 'reviewSummary', payload: { sku: '681747352' } },
      },
    }) as { type: string; spec?: { elements: Record<string, { type: string; props?: Record<string, unknown> }> } };
    expect(result.type).toBe('ui_spec');
    expect(result.spec?.elements['root']?.type).toBe('GroundingReviewCard');
    const act = result.spec?.elements['root']?.props?.['action'] as { type: string; payload?: { sku?: string } };
    expect(act?.type).toBe('reviewSummary');
    expect(act?.payload?.sku).toBe('681747352');
  });

  it('adapts prosAndCons to ProsAndCons ui_spec', () => {
    const result = adaptBackendEvent({
      type: 'prosAndCons',
      payload: {
        pros: ['Dayanıklı malzeme', 'Uygun fiyat'],
        cons: ['Ağır'],
        product_name: 'Test Ürün',
      },
    }) as {
      type: string;
      widget?: string;
      spec?: { elements: Record<string, { type: string; props?: Record<string, unknown> }> };
    };
    expect(result.type).toBe('ui_spec');
    expect(result.widget).toBe('chat');
    expect(result.spec?.elements['root']?.type).toBe('ProsAndCons');

    const props = result.spec?.elements['root']?.props;
    expect(props?.['pros']).toEqual(['Dayanıklı malzeme', 'Uygun fiyat']);
    expect(props?.['cons']).toEqual(['Ağır']);
    expect(props?.['productName']).toBe('Test Ürün');
  });

  it('adapts prosAndCons with missing fields', () => {
    const result = adaptBackendEvent({
      type: 'prosAndCons',
      payload: {},
    }) as { type: string; spec?: { elements: Record<string, { type: string; props?: Record<string, unknown> }> } };
    expect(result.type).toBe('ui_spec');
    const props = result.spec?.elements['root']?.props;
    expect(props?.['pros']).toBeUndefined();
    expect(props?.['cons']).toBeUndefined();
    expect(props?.['productName']).toBeUndefined();
  });

  it('adapts visitorDataResponse to metadata with visitorDataResponse key', () => {
    const result = adaptBackendEvent({
      type: 'visitorDataResponse',
      payload: { engagement_type: 'popup', message: 'Welcome!' },
    }) as { type: string; meta?: Record<string, unknown> };
    expect(result.type).toBe('metadata');
    expect(result.meta?.['visitorDataResponse']).toEqual({
      engagement_type: 'popup',
      message: 'Welcome!',
    });
  });

  it('adapts voice and dummy to metadata', () => {
    const voice = adaptBackendEvent({
      type: 'voice',
      payload: { text: 'Merhaba', audio_base64: 'abc', content_type: 'audio/mpeg' },
    }) as { type: string; meta?: Record<string, unknown> };
    expect(voice.type).toBe('metadata');
    expect(voice.meta?.['voice']).toEqual({ text: 'Merhaba', audio_base64: 'abc', content_type: 'audio/mpeg' });

    const noop = adaptBackendEvent({ type: 'dummy', payload: {} }) as { type: string; meta?: Record<string, unknown> };
    expect(noop.type).toBe('metadata');
    expect(noop.meta?.['noop']).toBe(true);
  });

  it('adapts chatStreamEnd to done', () => {
    const raw = { type: 'chatStreamEnd', payload: {} };
    const result = adaptBackendEvent(raw)!;
    expect(result.type).toBe('done');
  });

  it('returns null for unknown backend event types', () => {
    const result = adaptBackendEvent({ type: 'unknownType', payload: { foo: 'bar' } });
    expect(result).toBeNull();
  });

  it('returns null for events without type field', () => {
    const result = adaptBackendEvent({ data: 'no type field' });
    expect(result).toBeNull();
  });
});

describe('productToNormalized', () => {
  it('normalizes a full backend product', () => {
    const raw = {
      sku: 'P1',
      name: 'Test Product',
      brand: 'TestBrand',
      images: ['img1.jpg', 'img2.jpg'],
      price: 200,
      price_discounted: 150,
      price_currency: 'TRY',
      url: 'https://example.com/p1',
      rating: 4.5,
      review_count: 100,
      cart_code: 'CC1',
      in_stock: true,
      description: 'Long wearing color',
      description_html: '<p>Long wearing color</p>',
      features: [{ name: 'Renk', value: '003 ROSY GLOW' }],
      specifications: { Hacim: '12 ML' },
      facet_hits: { Renk: '003 ROSY GLOW' },
      short_name: 'Color Master',
    };

    const result = productToNormalized(raw);
    expect(result.sku).toBe('P1');
    expect(result.name).toBe('TestBrand Test Product');
    expect(result.imageUrl).toBe('img1.jpg');
    expect(result.price).toBe('150');
    expect(result.originalPrice).toBe('200');
    expect(result.discountPercent).toBe(25);
    expect(result.url).toBe('https://example.com/p1');
    expect(result.brand).toBe('TestBrand');
    expect(result.rating).toBe(4.5);
    expect(result.reviewCount).toBe(100);
    expect(result.cartCode).toBe('CC1');
    expect(result.inStock).toBe(true);
    expect(result.description).toBe('Long wearing color');
    expect(result.descriptionHtml).toBe('<p>Long wearing color</p>');
    expect(result.features).toEqual([{ name: 'Renk', value: '003 ROSY GLOW' }]);
    expect(result.specifications).toEqual({ Hacim: '12 ML' });
    expect(result.facetHits).toEqual({ Renk: '003 ROSY GLOW' });
    expect(result.shortName).toBe('Color Master');
  });

  it('does not duplicate brand in name if already present', () => {
    const raw = {
      sku: 'P2',
      name: 'BrandX Special Item',
      brand: 'BrandX',
      price: 100,
      url: 'https://example.com',
    };
    const result = productToNormalized(raw);
    expect(result.name).toBe('BrandX Special Item');
  });

  it('handles products without discount', () => {
    const raw = {
      sku: 'P3',
      name: 'No Discount',
      price: 100,
      price_discounted: 0,
      url: 'https://example.com',
    };
    const result = productToNormalized(raw);
    expect(result.price).toBe('100');
    expect(result.originalPrice).toBeUndefined();
    expect(result.discountPercent).toBeUndefined();
  });
});

describe('normalizeSimilarProductsResponse', () => {
  it('normalizes the JSON fixture', () => {
    const products = normalizeSimilarProductsResponse(similarFixture);
    expect(products).toHaveLength(2);
    expect(products[0]!.sku).toBe('SIM001');
    expect(products[0]!.price).toBe('249.99');
    expect(products[0]!.originalPrice).toBe('299.99');
    expect(products[1]!.sku).toBe('SIM002');
    expect(products[1]!.price).toBe('199.99');
    expect(products[1]!.originalPrice).toBeUndefined();
  });
});

describe('normalizeProductGroupingsResponse', () => {
  it('normalizes the JSON fixture', () => {
    const groups = normalizeProductGroupingsResponse(groupingsFixture);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.name).toBe('Aynı Marka');
    expect(groups[0]!.highlight).toBe('Marka güvencesi');
    expect(groups[0]!.products).toHaveLength(2);
    expect(groups[0]!.products[0]!.sku).toBe('GRP001');
  });
});

describe('product mentions in outputText', () => {
  it('passes through product_mentions from outputText payload', () => {
    const raw = {
      type: 'outputText',
      payload: {
        text: '<p>Check the Bosch Drill</p>',
        product_mentions: [{ sku: 'SKU-1', short_name: 'Bosch Drill' }],
        sku_to_product_item: { 'SKU-1': { name: 'Bosch Drill 500W' } },
      },
    };
    const result = adaptBackendEvent(raw)!;
    expect(result.type).toBe('text_chunk');
    const textChunk = result as {
      productMentions?: Array<{ sku: string; short_name: string }>;
      skuToProductItem?: Record<string, Record<string, unknown>>;
    };
    expect(textChunk.productMentions).toEqual([{ sku: 'SKU-1', short_name: 'Bosch Drill' }]);
    expect(textChunk.skuToProductItem).toEqual({ 'SKU-1': { name: 'Bosch Drill 500W' } });
  });

  it('omits product mentions when not present in payload', () => {
    const raw = {
      type: 'outputText',
      payload: { text: '<p>Hello</p>' },
    };
    const result = adaptBackendEvent(raw)!;
    expect(result.type).toBe('text_chunk');
    const textChunk = result as { productMentions?: unknown };
    expect(textChunk.productMentions).toBeUndefined();
  });
});

describe('adaptOutputText — sku_to_product_item & conversation_mode', () => {
  it('passes through sku_to_product_item when present', () => {
    const event = {
      type: 'outputText',
      payload: { text: 'hello', sku_to_product_item: { SKU1: { name: 'Product A' } } },
    };
    const result = adaptBackendEvent(event);
    expect(result!.type).toBe('text_chunk');
    if (result!.type === 'text_chunk') {
      expect(result.skuToProductItem).toEqual({ SKU1: { name: 'Product A' } });
    }
  });

  it('passes through conversation_mode when present', () => {
    const event = {
      type: 'outputText',
      payload: { text: 'hello', conversation_mode: 'product_search' },
    };
    const result = adaptBackendEvent(event);
    expect(result!.type).toBe('text_chunk');
    if (result!.type === 'text_chunk') {
      expect(result.conversationMode).toBe('product_search');
    }
  });

  it('omits conversation_mode when not present', () => {
    const event = { type: 'outputText', payload: { text: 'hello' } };
    const result = adaptBackendEvent(event);
    expect(result!.type).toBe('text_chunk');
    if (result!.type === 'text_chunk') {
      expect(result.conversationMode).toBeUndefined();
    }
  });

  it('omits conversation_mode when empty string', () => {
    const event = { type: 'outputText', payload: { text: 'hello', conversation_mode: '' } };
    const result = adaptBackendEvent(event);
    expect(result!.type).toBe('text_chunk');
    if (result!.type === 'text_chunk') {
      expect(result.conversationMode).toBeUndefined();
    }
  });

  it('omits conversation_mode when non-string', () => {
    const event = { type: 'outputText', payload: { text: 'hello', conversation_mode: 42 } };
    const result = adaptBackendEvent(event);
    expect(result!.type).toBe('text_chunk');
    if (result!.type === 'text_chunk') {
      expect(result.conversationMode).toBeUndefined();
    }
  });
});

describe('productListPreview event', () => {
  it('adapts productListPreview to metadata with analyzeAnimation', () => {
    const raw = {
      type: 'productListPreview',
      payload: {},
    };
    const result = adaptBackendEvent(raw)!;
    expect(result.type).toBe('metadata');
    const meta = (result as { meta?: Record<string, unknown> }).meta;
    expect(meta?.analyzeAnimation).toBe(true);
  });
});

describe('groupList event (Item 6)', () => {
  it('adapts groupList to CategoriesContainer UISpec', () => {
    const raw = {
      type: 'groupList',
      payload: {
        group_list: [
          {
            group_name: 'Electronics',
            product_list: [{ sku: 'P1', name: 'Phone', price: 100, url: 'https://example.com/p1' }],
          },
          {
            group_name: 'Clothing',
            product_list: [],
          },
        ],
        filter_tags: [
          { title: 'Budget', requestDetails: { type: 'filter', payload: { tag: 'budget' } } },
          { title: 'Premium' },
        ],
      },
    };
    const result = adaptBackendEvent(raw)!;
    expect(result.type).toBe('ui_spec');
    const uiSpec = result as {
      widget: string;
      panelHint?: string;
      spec: { root: string; elements: Record<string, { type: string; props?: Record<string, unknown> }> };
    };
    expect(uiSpec.widget).toBe('chat');
    expect(uiSpec.panelHint).toBe('panel');
    expect(uiSpec.spec.elements['root']!.type).toBe('CategoriesContainer');

    const props = uiSpec.spec.elements['root']!.props!;
    const groups = props['groups'] as Array<{ groupName: string; products: unknown[] }>;
    expect(groups).toHaveLength(2);
    expect(groups[0]!.groupName).toBe('Electronics');
    expect(groups[0]!.products).toHaveLength(1);
    expect(groups[1]!.groupName).toBe('Clothing');
    expect(groups[1]!.products).toHaveLength(0);

    const filterTags = props['filterTags'] as Array<{ title: string; action?: unknown }>;
    expect(filterTags).toHaveLength(2);
    expect(filterTags[0]!.title).toBe('Budget');
    expect(filterTags[0]!.action).toBeDefined();
    expect(filterTags[1]!.title).toBe('Premium');
  });

  it('handles empty groupList', () => {
    const result = adaptBackendEvent({
      type: 'groupList',
      payload: { group_list: [], filter_tags: [] },
    })!;
    const props = (result as { spec: { elements: Record<string, { props?: Record<string, unknown> }> } }).spec.elements[
      'root'
    ]!.props!;
    expect(props['groups']).toEqual([]);
    expect(props['filterTags']).toEqual([]);
  });
});

describe('productList pagination (Item 7)', () => {
  it('passes offset and endOfList props from productList payload', () => {
    const raw = {
      type: 'productList',
      payload: {
        product_list: [{ sku: 'P1', name: 'Product', price: 100, url: 'https://example.com' }],
        offset: 10,
        end_of_list: true,
      },
    };
    const result = adaptBackendEvent(raw)!;
    const uiSpec = result as { spec: { root: string; elements: Record<string, { props?: Record<string, unknown> }> } };
    const root = uiSpec.spec.elements[uiSpec.spec.root]!;
    expect(root.props?.['offset']).toBe(10);
    expect(root.props?.['endOfList']).toBe(true);
  });

  it('omits pagination props when not in payload', () => {
    const raw = {
      type: 'productList',
      payload: {
        product_list: [{ sku: 'P1', name: 'Product', price: 100, url: 'https://example.com' }],
      },
    };
    const result = adaptBackendEvent(raw)!;
    const uiSpec = result as { spec: { root: string; elements: Record<string, { props?: Record<string, unknown> }> } };
    const root = uiSpec.spec.elements[uiSpec.spec.root]!;
    expect(root.props?.['offset']).toBeUndefined();
    expect(root.props?.['endOfList']).toBeUndefined();
  });
});

describe('comparisonTable keyDifferencesHtml (Item 10)', () => {
  it('passes keyDifferencesHtml when key_differences is a string', () => {
    const raw = {
      type: 'comparisonTable',
      payload: {
        multiple_product_details: [
          { sku: 'C1', name: 'A', price: 100, url: 'https://example.com/c1' },
          { sku: 'C2', name: 'B', price: 200, url: 'https://example.com/c2' },
        ],
        product_comparison_framework: {
          key_differences: 'Price is the main factor\nBrand A is lighter',
          compared_field_names: [],
        },
      },
    };
    const result = adaptBackendEvent(raw)!;
    const uiSpec = result as { spec: { elements: Record<string, { props?: Record<string, unknown> }> } };
    const props = uiSpec.spec.elements['root']!.props!;
    expect(props['keyDifferencesHtml']).toBe('Price is the main factor\nBrand A is lighter');
  });

  it('does not add keyDifferencesHtml when key_differences is an array', () => {
    const raw = {
      type: 'comparisonTable',
      payload: {
        multiple_product_details: [
          { sku: 'C1', name: 'A', price: 100, url: 'https://example.com/c1' },
          { sku: 'C2', name: 'B', price: 200, url: 'https://example.com/c2' },
        ],
        product_comparison_framework: {
          key_differences: ['Difference 1', 'Difference 2'],
          compared_field_names: [],
        },
      },
    };
    const result = adaptBackendEvent(raw)!;
    const uiSpec = result as { spec: { elements: Record<string, { props?: Record<string, unknown> }> } };
    const props = uiSpec.spec.elements['root']!.props!;
    expect(props['keyDifferencesHtml']).toBeUndefined();
  });

  it('passes specialConsiderations when present', () => {
    const raw = {
      type: 'comparisonTable',
      payload: {
        multiple_product_details: [
          { sku: 'C1', name: 'A', price: 100, url: 'https://example.com/c1' },
          { sku: 'C2', name: 'B', price: 200, url: 'https://example.com/c2' },
        ],
        product_comparison_framework: {
          special_considerations: ['Consider X', 'Consider Y'],
          compared_field_names: [],
        },
      },
    };
    const result = adaptBackendEvent(raw)!;
    const uiSpec = result as { spec: { elements: Record<string, { props?: Record<string, unknown> }> } };
    const props = uiSpec.spec.elements['root']!.props!;
    expect(props['specialConsiderations']).toEqual(['Consider X', 'Consider Y']);
  });
});

describe('productDetailsSimilars similarsAppend (Item 11)', () => {
  it('adds similarsAppend flag to productDetailsSimilars', () => {
    const raw = {
      type: 'productDetailsSimilars',
      payload: {
        similarProducts: [{ sku: 'S1', name: 'Similar 1', price: 50, url: 'https://example.com/s1' }],
      },
    };
    const result = adaptBackendEvent(raw)!;
    const uiSpec = result as { spec: { root: string; elements: Record<string, { props?: Record<string, unknown> }> } };
    const root = uiSpec.spec.elements[uiSpec.spec.root]!;
    expect(root.props?.['similarsAppend']).toBe(true);
  });
});

describe('form events (Item 14)', () => {
  it.each(['formGetInfo', 'formTestDrive', 'formServiceRequest', 'launchFormPage'] as const)(
    'adapts %s to metadata with formType',
    (eventType) => {
      const raw = {
        type: eventType,
        payload: { formId: 'test-form', sku: 'SKU1' },
      };
      const result = adaptBackendEvent(raw)!;
      expect(result.type).toBe('metadata');
      const meta = (result as { meta?: Record<string, unknown> }).meta!;
      expect(meta['formType']).toBe(eventType);
      expect(meta['formPayload']).toEqual({ formId: 'test-form', sku: 'SKU1' });
    },
  );
});

describe('launcherContent event (Item 15)', () => {
  it('adapts launcherContent to metadata', () => {
    const raw = {
      type: 'launcherContent',
      payload: { title: 'Welcome', body: 'Hello world' },
    };
    const result = adaptBackendEvent(raw)!;
    expect(result.type).toBe('metadata');
    const meta = (result as { meta?: Record<string, unknown> }).meta!;
    expect(meta['launcherContent']).toEqual({ title: 'Welcome', body: 'Hello world' });
  });

  it('handles missing payload gracefully', () => {
    const raw = { type: 'launcherContent' };
    const result = adaptBackendEvent(raw)!;
    expect(result.type).toBe('metadata');
    const meta = (result as { meta?: Record<string, unknown> }).meta!;
    expect(meta['launcherContent']).toEqual({});
  });
});

describe('adaptBackendEvent — handoff', () => {
  it('adapts handoff to ui_spec with HandoffNotice', () => {
    const raw = {
      type: 'handoff',
      payload: {
        summary: 'Customer needs help with a return',
        products_discussed: ['SKU-1', 'SKU-2'],
        user_sentiment: 'frustrated',
      },
    };
    const result = adaptBackendEvent(raw)!;
    expect(result.type).toBe('ui_spec');
    const uiSpec = result as {
      spec: { root: string; elements: Record<string, { type: string; props?: Record<string, unknown> }> };
    };
    expect(uiSpec.spec.root).toBe('root');
    const root = uiSpec.spec.elements['root']!;
    expect(root.type).toBe('HandoffNotice');
    expect(root.props?.['summary']).toBe('Customer needs help with a return');
    expect(root.props?.['products_discussed']).toEqual(['SKU-1', 'SKU-2']);
    expect(root.props?.['user_sentiment']).toBe('frustrated');
  });

  it('handles handoff with empty payload', () => {
    const raw = { type: 'handoff' };
    const result = adaptBackendEvent(raw)!;
    expect(result.type).toBe('ui_spec');
    const uiSpec = result as {
      spec: { root: string; elements: Record<string, { type: string; props?: Record<string, unknown> }> };
    };
    const root = uiSpec.spec.elements['root']!;
    expect(root.type).toBe('HandoffNotice');
    expect(root.props).toEqual({});
  });

  it('handles handoff with partial payload', () => {
    const raw = { type: 'handoff', payload: { summary: 'Need help' } };
    const result = adaptBackendEvent(raw)!;
    expect(result.type).toBe('ui_spec');
    const uiSpec = result as {
      spec: { root: string; elements: Record<string, { type: string; props?: Record<string, unknown> }> };
    };
    const root = uiSpec.spec.elements['root']!;
    expect(root.props?.['summary']).toBe('Need help');
    expect(root.props?.['products_discussed']).toBeUndefined();
  });

  it('adapts uiSpec (BeautyPhotoStep) to ui_spec with { root, elements } shape', () => {
    const raw = {
      type: 'uiSpec',
      payload: {
        type: 'BeautyPhotoStep',
        title: 'Selfie ile kişiselleştir',
        description: 'Fotoğraf yükle',
        upload_label: 'Fotoğraf Yükle',
        skip_label: 'Geç',
        processing: false,
      },
    };
    const result = adaptBackendEvent(raw)!;
    expect(result.type).toBe('ui_spec');
    const uiSpec = result as {
      widget: string;
      spec: { root: string; elements: Record<string, { type: string; props?: Record<string, unknown> }> };
    };
    expect(uiSpec.widget).toBe('chat');
    expect(uiSpec.spec.root).toBe('root');
    const root = uiSpec.spec.elements['root']!;
    expect(root.type).toBe('BeautyPhotoStep');
    expect(root.props?.['title']).toBe('Selfie ile kişiselleştir');
    expect(root.props?.['processing']).toBe(false);
    // `type` field is stripped from props (used as component type)
    expect(root.props?.['type']).toBeUndefined();
  });

  it('adapts outputText with render_hint to text_chunk preserving renderHint', () => {
    const raw = {
      type: 'outputText',
      payload: {
        text: '<p>Photo analysis results</p>',
        plain_text: 'Photo analysis results',
        render_hint: 'photo_analysis',
      },
    };
    const result = adaptBackendEvent(raw)!;
    expect(result.type).toBe('text_chunk');
    expect((result as { renderHint?: string }).renderHint).toBe('photo_analysis');
  });

  it('adapts outputText with kvkk flag to text_chunk preserving kvkk', () => {
    const raw = {
      type: 'outputText',
      payload: {
        text: '<p>KVKK content</p>',
        plain_text: 'KVKK content',
        kvkk: true,
      },
    };
    const result = adaptBackendEvent(raw)!;
    expect(result.type).toBe('text_chunk');
    expect((result as { kvkk?: boolean }).kvkk).toBe(true);
  });

  it('adapts uiSpec (PhotoAnalysisCard) to ui_spec with structured fields', () => {
    const raw = {
      type: 'uiSpec',
      payload: {
        type: 'PhotoAnalysisCard',
        summary: 'Cildiniz kuru ve hassas görünüyor.',
        strengths: ['Belirgin goz hattı'],
        focus_points: ['T bolgesinde parlama'],
        celeb_style: 'Hailey Bieber temiz isiltisi',
        celeb_style_reason: 'Dogal parlakligi temiz bir tabanla destekliyor.',
        details: ['Kizariklik belirgin', 'Gozenekler genis', 'Dudak cevresi hafif kuru'],
        next_question: 'Hangi ürün grubunu tercih edersiniz?',
      },
    };
    const result = adaptBackendEvent(raw)!;
    expect(result.type).toBe('ui_spec');
    const uiSpec = result as {
      widget: string;
      spec: { root: string; elements: Record<string, { type: string; props?: Record<string, unknown> }> };
    };
    expect(uiSpec.widget).toBe('chat');
    const root = uiSpec.spec.elements['root']!;
    expect(root.type).toBe('PhotoAnalysisCard');
    expect(root.props?.['summary']).toBe('Cildiniz kuru ve hassas görünüyor.');
    expect(root.props?.['strengths']).toEqual(['Belirgin goz hattı']);
    expect(root.props?.['focus_points']).toEqual(['T bolgesinde parlama']);
    expect(root.props?.['celeb_style']).toBe('Hailey Bieber temiz isiltisi');
    expect(root.props?.['celeb_style_reason']).toBe('Dogal parlakligi temiz bir tabanla destekliyor.');
    expect(root.props?.['details']).toEqual(['Kizariklik belirgin', 'Gozenekler genis', 'Dudak cevresi hafif kuru']);
    expect(root.props?.['next_question']).toBe('Hangi ürün grubunu tercih edersiniz?');
  });
});

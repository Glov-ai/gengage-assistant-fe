/**
 * ma-v2-smoke: comprehensive smoke test for FE vs V2 backend.
 *
 * For EVERY event type the V2 backend can emit, this test:
 * 1. Creates a minimal valid payload
 * 2. Passes it through the V1 adapter
 * 3. Asserts the result is not null (adapter handles it)
 * 4. Asserts the result has the expected output type
 * 5. Repeats with version:"v2" to verify V2 wire format compatibility
 *
 * This is NOT an exhaustive feature test. It is a smoke test that ensures
 * every event type is recognized and adapted without crashes.
 */

import { describe, it, expect } from 'vitest';
import { adaptV1Event } from '../src/common/v1-protocol-adapter.js';
import type { StreamEvent } from '../src/common/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Each entry defines a V2 backend event type, a minimal valid payload,
 * and the expected canonical StreamEvent type after adaptation.
 */
interface SmokeTestCase {
  /** The `type` value the V2 backend sends. */
  v1Type: string;
  /** Minimal payload that should produce a non-null result. */
  payload: Record<string, unknown>;
  /** Expected `type` field on the adapted StreamEvent. */
  expectedType: StreamEvent['type'];
  /** Optional: expected component type if the result is a ui_spec. */
  expectedComponent?: string;
  /** Optional: expected widget target. */
  expectedWidget?: string;
}

const SMOKE_CASES: SmokeTestCase[] = [
  // ---- Text / content events ----
  {
    v1Type: 'outputText',
    payload: { text: '<p>Hello</p>' },
    expectedType: 'text_chunk',
  },
  {
    v1Type: 'suggestedActions',
    payload: {
      actions: [{ title: 'Option A', requestDetails: { type: 'inputText', payload: { text: 'Option A' } } }],
    },
    expectedType: 'ui_spec',
    expectedComponent: 'ActionButtons',
    expectedWidget: 'chat',
  },

  // ---- Product display events ----
  {
    v1Type: 'productList',
    payload: {
      product_list: [{ sku: 'P1', name: 'Product 1', price: 100, url: 'https://example.com/p1' }],
    },
    expectedType: 'ui_spec',
    expectedComponent: 'ProductGrid',
    expectedWidget: 'chat',
  },
  {
    v1Type: 'productDetails',
    payload: {
      productDetails: { sku: 'P1', name: 'Detail Product', price: 200, url: 'https://example.com/p1' },
    },
    expectedType: 'ui_spec',
    expectedComponent: 'ProductDetailsPanel',
    expectedWidget: 'chat',
  },
  {
    v1Type: 'productDetailsSimilars',
    payload: {
      similarProducts: [{ sku: 'S1', name: 'Similar 1', price: 50, url: 'https://example.com/s1' }],
    },
    expectedType: 'ui_spec',
    expectedComponent: 'ProductGrid',
    expectedWidget: 'chat',
  },
  {
    v1Type: 'comparisonTable',
    payload: {
      multiple_product_details: [
        { sku: 'C1', name: 'Compare 1', price: 100, url: 'https://example.com/c1' },
        { sku: 'C2', name: 'Compare 2', price: 200, url: 'https://example.com/c2' },
      ],
    },
    expectedType: 'ui_spec',
    expectedComponent: 'ComparisonTable',
    expectedWidget: 'chat',
  },

  // ---- Session / lifecycle events ----
  {
    v1Type: 'context',
    payload: {
      panel: { screen_type: 'product_list' },
      messages: [{ role: 'model', content: 'hi' }],
      message_id: 'msg-1',
    },
    expectedType: 'metadata',
  },
  {
    v1Type: 'chatStreamEnd',
    payload: {},
    expectedType: 'done',
  },
  {
    v1Type: 'loading',
    payload: { text: 'Thinking...' },
    expectedType: 'metadata',
  },
  {
    v1Type: 'panelLoading',
    payload: { text: 'Loading panel...', pending_type: 'productDetails' },
    expectedType: 'metadata',
  },

  // ---- Navigation / flow events ----
  {
    v1Type: 'redirect',
    payload: { url: 'https://example.com/redirect', new_tab: false },
    expectedType: 'action',
  },
  {
    v1Type: 'error',
    payload: { text: 'Something went wrong' },
    expectedType: 'error',
  },
  {
    // `noop` maps to type:'dummy' in the V1 wire
    v1Type: 'dummy',
    payload: {},
    expectedType: 'metadata',
  },

  // ---- Launcher / QNA events ----
  {
    v1Type: 'launcherAction',
    payload: { text: 'Welcome message' },
    expectedType: 'ui_spec',
    expectedComponent: 'QuestionHeading',
    expectedWidget: 'qna',
  },
  {
    // launcherText maps to type:'text' in the V1 wire
    v1Type: 'text',
    payload: { text: 'Header text' },
    expectedType: 'ui_spec',
    expectedComponent: 'QuestionHeading',
    expectedWidget: 'qna',
  },
  {
    // launcherTextImage maps to type:'text_image' in the V1 wire
    v1Type: 'text_image',
    payload: {
      text: 'Image button',
      image_url: 'https://cdn.example.com/img.jpg',
      action: { type: 'launcherQuestionClick', payload: { text: 'Click me' } },
    },
    expectedType: 'ui_spec',
    expectedWidget: 'qna',
  },
  {
    // launcherQuickQna maps to type:'quick_qna' in the V1 wire
    v1Type: 'quick_qna',
    payload: {
      action_list: [{ title: 'Q1', requestDetails: { type: 'launcherQuestionClick', payload: { text: 'Q1' } } }],
    },
    expectedType: 'ui_spec',
    expectedComponent: 'ActionButtons',
    expectedWidget: 'qna',
  },

  // ---- Review / analysis events ----
  {
    v1Type: 'reviewHighlights',
    payload: {
      sku: 'SKU1',
      reviews: [{ review_class: 'positive', review_text: 'Great!', review_rating: 5, review_tag: 'Quality' }],
    },
    expectedType: 'ui_spec',
    expectedComponent: 'ReviewHighlights',
    expectedWidget: 'chat',
  },
  {
    v1Type: 'prosAndCons',
    payload: { pros: ['Durable'], cons: ['Heavy'], product_name: 'Test' },
    expectedType: 'ui_spec',
    expectedComponent: 'ProsAndCons',
    expectedWidget: 'chat',
  },
  {
    v1Type: 'visitorDataResponse',
    payload: { engagement_type: 'popup', message: 'Hello!' },
    expectedType: 'metadata',
  },

  // ---- AI suggestion events ----
  {
    v1Type: 'aiProductSuggestions',
    payload: {
      product_suggestions: [
        {
          sku: 'AIS1',
          short_name: 'AI Pick 1',
          role: 'winner',
          product_item: { sku: 'AIS1', name: 'AI Pick 1', url: 'https://example.com/ais1', price: 500 },
          requestDetails: { type: 'launchSingleProduct', payload: { sku: 'AIS1' } },
        },
      ],
    },
    expectedType: 'ui_spec',
    expectedComponent: 'AITopPicks',
    expectedWidget: 'chat',
  },
  {
    v1Type: 'aiProductGroupings',
    payload: {
      product_groupings: [
        {
          name: 'Group A',
          sku: 'G1',
          requestDetails: { type: 'findSimilar', payload: { sku: 'G1' } },
        },
      ],
    },
    expectedType: 'ui_spec',
    expectedComponent: 'AIGroupingCards',
    expectedWidget: 'chat',
  },
  {
    v1Type: 'aiSuggestedSearches',
    payload: {
      suggested_searches: [
        {
          short_name: 'Budget option',
          detailed_user_message: 'Show me cheaper alternatives',
          sku: 'SS1',
        },
      ],
    },
    expectedType: 'ui_spec',
    expectedComponent: 'AISuggestedSearchCards',
    expectedWidget: 'chat',
  },
  {
    v1Type: 'getGroundingReview',
    payload: {
      title: 'Reviews',
      text: 'Show reviews',
      review_count: '42',
      requestDetails: { type: 'reviewSummary', payload: { sku: 'SKU1' } },
    },
    expectedType: 'ui_spec',
    expectedComponent: 'GroundingReviewCard',
    expectedWidget: 'chat',
  },

  // ---- Voice ----
  {
    v1Type: 'voice',
    payload: { text: 'Hello', audio_base64: 'AAAA', content_type: 'audio/mpeg' },
    expectedType: 'metadata',
  },

  // ---- Group / category display ----
  {
    v1Type: 'groupList',
    payload: {
      group_list: [
        {
          group_name: 'Electronics',
          product_list: [{ sku: 'G1', name: 'Phone', price: 100, url: 'https://example.com/g1' }],
        },
      ],
      filter_tags: [{ title: 'Budget', requestDetails: { type: 'filter', payload: { tag: 'budget' } } }],
    },
    expectedType: 'ui_spec',
    expectedComponent: 'CategoriesContainer',
    expectedWidget: 'chat',
  },

  // ---- Form events ----
  {
    v1Type: 'formGetInfo',
    payload: { formId: 'info-1' },
    expectedType: 'metadata',
  },

  // ---- Launcher content ----
  {
    v1Type: 'launcherContent',
    payload: { title: 'Welcome', body: 'Hello world' },
    expectedType: 'metadata',
  },

  // ---- Handoff ----
  {
    v1Type: 'handoff',
    payload: {
      summary: 'Customer needs help',
      products_discussed: ['SKU1'],
      user_sentiment: 'neutral',
    },
    expectedType: 'ui_spec',
    expectedComponent: 'HandoffNotice',
    expectedWidget: 'chat',
  },
];

// ---------------------------------------------------------------------------
// Smoke test: without version field (V1 compat)
// ---------------------------------------------------------------------------

describe('V2 smoke: every backend event type adapts correctly (V1 format)', () => {
  for (const tc of SMOKE_CASES) {
    it(`${tc.v1Type} -> ${tc.expectedType}`, () => {
      const raw: Record<string, unknown> = {
        type: tc.v1Type,
        payload: tc.payload,
      };

      const result = adaptV1Event(raw);
      expect(result).not.toBeNull();
      expect(result!.type).toBe(tc.expectedType);

      if (tc.expectedComponent && result!.type === 'ui_spec') {
        const uiSpec = result as {
          spec: { elements: Record<string, { type: string }> };
        };
        expect(uiSpec.spec.elements['root']!.type).toBe(tc.expectedComponent);
      }

      if (tc.expectedWidget && result!.type === 'ui_spec') {
        const uiSpec = result as { widget: string };
        expect(uiSpec.widget).toBe(tc.expectedWidget);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Smoke test: WITH version:"v2" field (V2 wire format)
// ---------------------------------------------------------------------------

describe('V2 smoke: every backend event type adapts correctly (V2 wire format)', () => {
  for (const tc of SMOKE_CASES) {
    it(`${tc.v1Type} + version:"v2" -> ${tc.expectedType}`, () => {
      const raw: Record<string, unknown> = {
        type: tc.v1Type,
        payload: tc.payload,
        version: 'v2',
        messageId: `smoke-${tc.v1Type}-v2`,
        threadId: 'smoke-thread',
        from: 'assistant',
      };

      const result = adaptV1Event(raw);
      expect(result).not.toBeNull();
      expect(result!.type).toBe(tc.expectedType);

      if (tc.expectedComponent && result!.type === 'ui_spec') {
        const uiSpec = result as {
          spec: { elements: Record<string, { type: string }> };
        };
        expect(uiSpec.spec.elements['root']!.type).toBe(tc.expectedComponent);
      }

      if (tc.expectedWidget && result!.type === 'ui_spec') {
        const uiSpec = result as { widget: string };
        expect(uiSpec.widget).toBe(tc.expectedWidget);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Additional form event subtypes
// ---------------------------------------------------------------------------

describe('V2 smoke: form event subtypes', () => {
  const formTypes = ['formGetInfo', 'formTestDrive', 'formServiceRequest', 'launchFormPage'] as const;

  for (const formType of formTypes) {
    it(`${formType} -> metadata (V1)`, () => {
      const result = adaptV1Event({
        type: formType,
        payload: { formId: 'test' },
      });
      expect(result).not.toBeNull();
      expect(result!.type).toBe('metadata');
      const meta = (result as { meta?: Record<string, unknown> }).meta!;
      expect(meta['formType']).toBe(formType);
    });

    it(`${formType} + version:"v2" -> metadata`, () => {
      const result = adaptV1Event({
        type: formType,
        payload: { formId: 'test' },
        version: 'v2',
      });
      expect(result).not.toBeNull();
      expect(result!.type).toBe('metadata');
    });
  }
});

// ---------------------------------------------------------------------------
// Edge: already-normalized events with version:"v2"
// ---------------------------------------------------------------------------

describe('V2 smoke: already-normalized events pass through with version field', () => {
  it('text_chunk with version:"v2" passes through', () => {
    const raw = { type: 'text_chunk', content: 'Normalized text', final: true, version: 'v2' };
    const result = adaptV1Event(raw);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('text_chunk');
    expect((result as { content: string }).content).toBe('Normalized text');
  });

  it('metadata with version:"v2" passes through', () => {
    const raw = { type: 'metadata', sessionId: 's1', model: 'gemini', version: 'v2' };
    const result = adaptV1Event(raw);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('metadata');
  });

  it('done with version:"v2" passes through', () => {
    const raw = { type: 'done', version: 'v2' };
    const result = adaptV1Event(raw);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('done');
  });

  it('error with version:"v2" passes through', () => {
    const raw = { type: 'error', code: 'RATE_LIMIT', message: 'Too many requests', version: 'v2' };
    const result = adaptV1Event(raw);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('error');
    expect((result as { code: string }).code).toBe('RATE_LIMIT');
  });

  it('ui_spec with version:"v2" passes through', () => {
    const raw = {
      type: 'ui_spec',
      widget: 'chat',
      spec: {
        root: 'root',
        elements: { root: { type: 'ActionButtons', props: { buttons: [] }, children: [] } },
      },
      version: 'v2',
    };
    const result = adaptV1Event(raw);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('ui_spec');
  });

  it('action with version:"v2" passes through', () => {
    const raw = {
      type: 'action',
      action: { kind: 'navigate', url: 'https://example.com' },
      version: 'v2',
    };
    const result = adaptV1Event(raw);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('action');
  });
});

// ---------------------------------------------------------------------------
// Completeness assertion
// ---------------------------------------------------------------------------

describe('V2 smoke: completeness check', () => {
  /**
   * The V2 backend event types from MEMORY.md / wire protocol docs.
   * This list is the source of truth for what the V2 backend can emit.
   *
   * NOTE: Some event type names differ between the "label" in docs and
   * the actual `type` field value sent over the wire:
   *   - noop -> type:'dummy'
   *   - launcherText -> type:'text'
   *   - launcherTextImage -> type:'text_image'
   *   - launcherQuickQna -> type:'quick_qna'
   *   - formEvent -> type:'formGetInfo'|'formTestDrive'|'formServiceRequest'|'launchFormPage'
   */
  const V2_BACKEND_WIRE_TYPES = [
    'outputText',
    'suggestedActions',
    'productList',
    'productDetails',
    'productDetailsSimilars',
    'comparisonTable',
    'context',
    'chatStreamEnd',
    'loading',
    'panelLoading',
    'redirect',
    'error',
    'dummy', // noop
    'launcherAction',
    'text', // launcherText
    'text_image', // launcherTextImage
    'quick_qna', // launcherQuickQna
    'reviewHighlights',
    'prosAndCons',
    'visitorDataResponse',
    'aiProductSuggestions',
    'aiProductGroupings',
    'aiSuggestedSearches',
    'getGroundingReview',
    'voice',
    'groupList',
    'formGetInfo', // formEvent subtype
    'formTestDrive', // formEvent subtype
    'formServiceRequest', // formEvent subtype
    'launchFormPage', // formEvent subtype
    'launcherContent',
    'handoff',
  ];

  it('all V2 backend event types are covered by smoke test cases', () => {
    const testedTypes = new Set<string>();
    for (const tc of SMOKE_CASES) {
      testedTypes.add(tc.v1Type);
    }
    // Add form event subtypes tested separately
    testedTypes.add('formTestDrive');
    testedTypes.add('formServiceRequest');
    testedTypes.add('launchFormPage');

    const missing = V2_BACKEND_WIRE_TYPES.filter((t) => !testedTypes.has(t));
    expect(missing).toEqual([]);
  });
});

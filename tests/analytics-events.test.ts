import { describe, it, expect } from 'vitest';
import type { AnalyticsContext } from '../src/common/analytics-events.js';
import {
  streamStartEvent,
  streamChunkEvent,
  streamUiSpecEvent,
  streamDoneEvent,
  streamErrorEvent,
  llmUsageEvent,
  meteringIncrementEvent,
  meteringSummaryEvent,
  chatHistorySnapshotEvent,
  widgetHistorySnapshotEvent,
  basketAddEvent,
  checkoutStartEvent,
  checkoutCompleteEvent,
} from '../src/common/analytics-events.js';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const minimalCtx: AnalyticsContext = {
  account_id: 'acc-001',
  session_id: 'sess-abc',
  correlation_id: 'corr-xyz',
};

const fullCtx: AnalyticsContext = {
  account_id: 'acc-001',
  session_id: 'sess-abc',
  correlation_id: 'corr-xyz',
  view_id: 'view-123',
  user_id: 'user-456',
  page_type: 'pdp',
  sku: 'SKU-789',
};

// ---------------------------------------------------------------------------
// Stream Lifecycle
// ---------------------------------------------------------------------------

describe('streamStartEvent', () => {
  it('returns correct event_name', () => {
    const event = streamStartEvent(minimalCtx, {
      endpoint: '/chat/process_action',
      request_id: 'req-1',
    });
    expect(event.event_name).toBe('stream.start');
  });

  it('includes required envelope fields', () => {
    const event = streamStartEvent(minimalCtx, {
      endpoint: '/chat/process_action',
      request_id: 'req-1',
    });
    expect(event.account_id).toBe('acc-001');
    expect(event.session_id).toBe('sess-abc');
    expect(event.correlation_id).toBe('corr-xyz');
  });

  it('includes endpoint and request_id in payload', () => {
    const event = streamStartEvent(minimalCtx, {
      endpoint: '/chat/process_action',
      request_id: 'req-1',
    });
    expect(event.payload.endpoint).toBe('/chat/process_action');
    expect(event.payload.request_id).toBe('req-1');
  });

  it('includes optional context fields when provided', () => {
    const event = streamStartEvent(fullCtx, {
      endpoint: '/chat/process_action',
      request_id: 'req-1',
      widget: 'chat',
    });
    expect(event.view_id).toBe('view-123');
    expect(event.user_id).toBe('user-456');
    expect(event.page_type).toBe('pdp');
    expect(event.sku).toBe('SKU-789');
    expect(event.widget).toBe('chat');
  });

  it('omits optional context fields when not provided', () => {
    const event = streamStartEvent(minimalCtx, {
      endpoint: '/chat/process_action',
      request_id: 'req-1',
    });
    expect(event).not.toHaveProperty('view_id');
    expect(event).not.toHaveProperty('user_id');
    expect(event).not.toHaveProperty('page_type');
    expect(event).not.toHaveProperty('sku');
    expect(event).not.toHaveProperty('widget');
  });
});

describe('streamChunkEvent', () => {
  it('returns correct event_name', () => {
    const event = streamChunkEvent(minimalCtx, {
      request_id: 'req-1',
      chunk_index: 0,
    });
    expect(event.event_name).toBe('stream.chunk');
  });

  it('includes chunk_index and request_id in payload', () => {
    const event = streamChunkEvent(minimalCtx, {
      request_id: 'req-1',
      chunk_index: 5,
    });
    expect(event.payload.request_id).toBe('req-1');
    expect(event.payload.chunk_index).toBe(5);
  });

  it('includes latency_ms in payload when provided', () => {
    const event = streamChunkEvent(minimalCtx, {
      request_id: 'req-1',
      chunk_index: 0,
      latency_ms: 42,
    });
    expect(event.payload.latency_ms).toBe(42);
  });

  it('omits latency_ms from payload when not provided', () => {
    const event = streamChunkEvent(minimalCtx, {
      request_id: 'req-1',
      chunk_index: 0,
    });
    expect(event.payload).not.toHaveProperty('latency_ms');
  });

  it('includes optional context fields when provided', () => {
    const event = streamChunkEvent(fullCtx, {
      request_id: 'req-1',
      chunk_index: 0,
      widget: 'qna',
    });
    expect(event.view_id).toBe('view-123');
    expect(event.user_id).toBe('user-456');
    expect(event.widget).toBe('qna');
    expect(event.page_type).toBe('pdp');
    expect(event.sku).toBe('SKU-789');
  });

  it('omits optional fields when not provided', () => {
    const event = streamChunkEvent(minimalCtx, {
      request_id: 'req-1',
      chunk_index: 0,
    });
    expect(event).not.toHaveProperty('view_id');
    expect(event).not.toHaveProperty('user_id');
    expect(event).not.toHaveProperty('widget');
    expect(event).not.toHaveProperty('page_type');
    expect(event).not.toHaveProperty('sku');
  });
});

describe('streamUiSpecEvent', () => {
  it('returns correct event_name', () => {
    const event = streamUiSpecEvent(minimalCtx, {
      request_id: 'req-1',
      chunk_index: 2,
      component_type: 'ProductCard',
    });
    expect(event.event_name).toBe('stream.ui_spec');
  });

  it('includes component_type in payload', () => {
    const event = streamUiSpecEvent(minimalCtx, {
      request_id: 'req-1',
      chunk_index: 2,
      component_type: 'ActionButtons',
    });
    expect(event.payload.component_type).toBe('ActionButtons');
    expect(event.payload.request_id).toBe('req-1');
    expect(event.payload.chunk_index).toBe(2);
  });

  it('includes optional context fields when provided', () => {
    const event = streamUiSpecEvent(fullCtx, {
      request_id: 'req-1',
      chunk_index: 0,
      component_type: 'ProductCard',
      widget: 'simrel',
    });
    expect(event.view_id).toBe('view-123');
    expect(event.widget).toBe('simrel');
  });

  it('omits optional fields when not provided', () => {
    const event = streamUiSpecEvent(minimalCtx, {
      request_id: 'req-1',
      chunk_index: 0,
      component_type: 'ProductCard',
    });
    expect(event).not.toHaveProperty('widget');
    expect(event).not.toHaveProperty('view_id');
  });
});

describe('streamDoneEvent', () => {
  it('returns correct event_name', () => {
    const event = streamDoneEvent(minimalCtx, {
      request_id: 'req-1',
      latency_ms: 1200,
      chunk_count: 10,
    });
    expect(event.event_name).toBe('stream.done');
  });

  it('includes latency_ms and chunk_count in payload', () => {
    const event = streamDoneEvent(minimalCtx, {
      request_id: 'req-1',
      latency_ms: 1200,
      chunk_count: 10,
    });
    expect(event.payload.request_id).toBe('req-1');
    expect(event.payload.latency_ms).toBe(1200);
    expect(event.payload.chunk_count).toBe(10);
  });

  it('includes optional context fields when provided', () => {
    const event = streamDoneEvent(fullCtx, {
      request_id: 'req-1',
      latency_ms: 500,
      chunk_count: 5,
      widget: 'chat',
    });
    expect(event.view_id).toBe('view-123');
    expect(event.user_id).toBe('user-456');
    expect(event.widget).toBe('chat');
  });

  it('omits optional fields when not provided', () => {
    const event = streamDoneEvent(minimalCtx, {
      request_id: 'req-1',
      latency_ms: 500,
      chunk_count: 5,
    });
    expect(event).not.toHaveProperty('view_id');
    expect(event).not.toHaveProperty('widget');
  });
});

describe('streamErrorEvent', () => {
  it('returns correct event_name', () => {
    const event = streamErrorEvent(minimalCtx, {
      request_id: 'req-1',
      error_code: 'TIMEOUT',
      error_message: 'Request timed out',
    });
    expect(event.event_name).toBe('stream.error');
  });

  it('includes error_code and error_message in payload', () => {
    const event = streamErrorEvent(minimalCtx, {
      request_id: 'req-1',
      error_code: 'NETWORK_ERROR',
      error_message: 'Failed to connect',
    });
    expect(event.payload.request_id).toBe('req-1');
    expect(event.payload.error_code).toBe('NETWORK_ERROR');
    expect(event.payload.error_message).toBe('Failed to connect');
  });

  it('includes optional context fields when provided', () => {
    const event = streamErrorEvent(fullCtx, {
      request_id: 'req-1',
      error_code: 'TIMEOUT',
      error_message: 'timeout',
      widget: 'qna',
    });
    expect(event.view_id).toBe('view-123');
    expect(event.widget).toBe('qna');
  });

  it('omits optional fields when not provided', () => {
    const event = streamErrorEvent(minimalCtx, {
      request_id: 'req-1',
      error_code: 'TIMEOUT',
      error_message: 'timeout',
    });
    expect(event).not.toHaveProperty('view_id');
    expect(event).not.toHaveProperty('widget');
  });
});

// ---------------------------------------------------------------------------
// LLM Usage
// ---------------------------------------------------------------------------

describe('llmUsageEvent', () => {
  it('returns correct event_name', () => {
    const event = llmUsageEvent(minimalCtx, {
      model: 'gpt-4o',
      prompt_tokens: 500,
      completion_tokens: 200,
      total_tokens: 700,
    });
    expect(event.event_name).toBe('llm.usage');
  });

  it('includes required token fields in payload', () => {
    const event = llmUsageEvent(minimalCtx, {
      model: 'gpt-4o',
      prompt_tokens: 500,
      completion_tokens: 200,
      total_tokens: 700,
    });
    expect(event.payload.model).toBe('gpt-4o');
    expect(event.payload.prompt_tokens).toBe(500);
    expect(event.payload.completion_tokens).toBe(200);
    expect(event.payload.total_tokens).toBe(700);
  });

  it('includes provider in payload when provided', () => {
    const event = llmUsageEvent(minimalCtx, {
      model: 'gpt-4o',
      prompt_tokens: 500,
      completion_tokens: 200,
      total_tokens: 700,
      provider: 'openai',
    });
    expect(event.payload.provider).toBe('openai');
  });

  it('omits provider from payload when not provided', () => {
    const event = llmUsageEvent(minimalCtx, {
      model: 'gpt-4o',
      prompt_tokens: 500,
      completion_tokens: 200,
      total_tokens: 700,
    });
    expect(event.payload).not.toHaveProperty('provider');
  });

  it('does not set widget field (llm.usage is widget-agnostic)', () => {
    const event = llmUsageEvent(fullCtx, {
      model: 'gpt-4o',
      prompt_tokens: 500,
      completion_tokens: 200,
      total_tokens: 700,
    });
    expect(event).not.toHaveProperty('widget');
  });

  it('includes optional context fields when provided', () => {
    const event = llmUsageEvent(fullCtx, {
      model: 'gpt-4o',
      prompt_tokens: 500,
      completion_tokens: 200,
      total_tokens: 700,
    });
    expect(event.view_id).toBe('view-123');
    expect(event.user_id).toBe('user-456');
    expect(event.page_type).toBe('pdp');
    expect(event.sku).toBe('SKU-789');
  });
});

// ---------------------------------------------------------------------------
// Metering
// ---------------------------------------------------------------------------

describe('meteringIncrementEvent', () => {
  it('returns correct event_name', () => {
    const event = meteringIncrementEvent(minimalCtx, {
      meter_key: 'stream_requests',
      quantity: 1,
      unit: 'request',
    });
    expect(event.event_name).toBe('metering.increment');
  });

  it('includes required metering fields in payload', () => {
    const event = meteringIncrementEvent(minimalCtx, {
      meter_key: 'tokens_used',
      quantity: 700,
      unit: 'token',
    });
    expect(event.payload.meter_key).toBe('tokens_used');
    expect(event.payload.quantity).toBe(700);
    expect(event.payload.unit).toBe('token');
  });

  it('includes optional context fields when provided', () => {
    const event = meteringIncrementEvent(fullCtx, {
      meter_key: 'stream_requests',
      quantity: 1,
      unit: 'request',
    });
    expect(event.view_id).toBe('view-123');
    expect(event.user_id).toBe('user-456');
  });

  it('omits optional fields when not provided', () => {
    const event = meteringIncrementEvent(minimalCtx, {
      meter_key: 'stream_requests',
      quantity: 1,
      unit: 'request',
    });
    expect(event).not.toHaveProperty('view_id');
    expect(event).not.toHaveProperty('user_id');
  });
});

describe('meteringSummaryEvent', () => {
  it('returns correct event_name', () => {
    const event = meteringSummaryEvent(minimalCtx, {
      meter_key: 'stream_requests',
      quantity: 15,
      unit: 'request',
    });
    expect(event.event_name).toBe('metering.summary');
  });

  it('includes required metering fields in payload', () => {
    const event = meteringSummaryEvent(minimalCtx, {
      meter_key: 'tokens_used',
      quantity: 5000,
      unit: 'token',
    });
    expect(event.payload.meter_key).toBe('tokens_used');
    expect(event.payload.quantity).toBe(5000);
    expect(event.payload.unit).toBe('token');
  });

  it('includes optional context fields when provided', () => {
    const event = meteringSummaryEvent(fullCtx, {
      meter_key: 'stream_requests',
      quantity: 15,
      unit: 'request',
    });
    expect(event.view_id).toBe('view-123');
    expect(event.page_type).toBe('pdp');
  });
});

// ---------------------------------------------------------------------------
// Chat and Widget Histories
// ---------------------------------------------------------------------------

describe('chatHistorySnapshotEvent', () => {
  it('returns correct event_name', () => {
    const event = chatHistorySnapshotEvent(minimalCtx, {
      message_count: 12,
      history_ref: 'sha256:abc123',
      redaction_level: 'none',
    });
    expect(event.event_name).toBe('chat.history.snapshot');
  });

  it('includes required history fields in payload', () => {
    const event = chatHistorySnapshotEvent(minimalCtx, {
      message_count: 12,
      history_ref: 'sha256:abc123',
      redaction_level: 'pii_stripped',
    });
    expect(event.payload.message_count).toBe(12);
    expect(event.payload.history_ref).toBe('sha256:abc123');
    expect(event.payload.redaction_level).toBe('pii_stripped');
  });

  it('includes optional context fields when provided', () => {
    const event = chatHistorySnapshotEvent(fullCtx, {
      message_count: 5,
      history_ref: 'ref-1',
      redaction_level: 'none',
    });
    expect(event.view_id).toBe('view-123');
    expect(event.user_id).toBe('user-456');
  });

  it('omits optional fields when not provided', () => {
    const event = chatHistorySnapshotEvent(minimalCtx, {
      message_count: 5,
      history_ref: 'ref-1',
      redaction_level: 'none',
    });
    expect(event).not.toHaveProperty('view_id');
    expect(event).not.toHaveProperty('user_id');
    expect(event).not.toHaveProperty('widget');
  });
});

describe('widgetHistorySnapshotEvent', () => {
  it('returns correct event_name', () => {
    const event = widgetHistorySnapshotEvent(minimalCtx, {
      message_count: 3,
      history_ref: 'ref-widget-1',
      redaction_level: 'none',
      widget: 'qna',
    });
    expect(event.event_name).toBe('widget.history.snapshot');
  });

  it('includes widget field from payload', () => {
    const event = widgetHistorySnapshotEvent(minimalCtx, {
      message_count: 3,
      history_ref: 'ref-widget-1',
      redaction_level: 'none',
      widget: 'simrel',
    });
    expect(event.widget).toBe('simrel');
  });

  it('includes required history fields in payload', () => {
    const event = widgetHistorySnapshotEvent(minimalCtx, {
      message_count: 8,
      history_ref: 'ref-2',
      redaction_level: 'full',
      widget: 'chat',
    });
    expect(event.payload.message_count).toBe(8);
    expect(event.payload.history_ref).toBe('ref-2');
    expect(event.payload.redaction_level).toBe('full');
  });

  it('includes optional context fields when provided', () => {
    const event = widgetHistorySnapshotEvent(fullCtx, {
      message_count: 3,
      history_ref: 'ref-1',
      redaction_level: 'none',
      widget: 'qna',
    });
    expect(event.view_id).toBe('view-123');
    expect(event.user_id).toBe('user-456');
    expect(event.page_type).toBe('pdp');
    expect(event.sku).toBe('SKU-789');
  });
});

// ---------------------------------------------------------------------------
// Commerce Attribution
// ---------------------------------------------------------------------------

describe('basketAddEvent', () => {
  it('returns correct event_name', () => {
    const event = basketAddEvent(minimalCtx, {
      attribution_source: 'simrel',
      attribution_action_id: 'add-btn-1',
      cart_value: 149.99,
      currency: 'TRY',
      line_items: 1,
      sku: 'PROD-001',
    });
    expect(event.event_name).toBe('basket.add');
  });

  it('includes attribution metadata in payload', () => {
    const event = basketAddEvent(minimalCtx, {
      attribution_source: 'chat',
      attribution_action_id: 'action-abc',
      cart_value: 299.5,
      currency: 'USD',
      line_items: 2,
      sku: 'SKU-XYZ',
    });
    expect(event.payload.attribution_source).toBe('chat');
    expect(event.payload.attribution_action_id).toBe('action-abc');
    expect(event.payload.cart_value).toBe(299.5);
    expect(event.payload.currency).toBe('USD');
    expect(event.payload.line_items).toBe(2);
    expect(event.payload.sku).toBe('SKU-XYZ');
  });

  it('sets widget field from attribution_source', () => {
    const event = basketAddEvent(minimalCtx, {
      attribution_source: 'simrel',
      attribution_action_id: 'add-1',
      cart_value: 100,
      currency: 'TRY',
      line_items: 1,
      sku: 'P-1',
    });
    expect(event.widget).toBe('simrel');
  });

  it('always includes required envelope fields', () => {
    const event = basketAddEvent(minimalCtx, {
      attribution_source: 'qna',
      attribution_action_id: 'add-1',
      cart_value: 50,
      currency: 'EUR',
      line_items: 1,
      sku: 'P-1',
    });
    expect(event.account_id).toBe('acc-001');
    expect(event.session_id).toBe('sess-abc');
    expect(event.correlation_id).toBe('corr-xyz');
  });

  it('includes optional context fields when provided', () => {
    const event = basketAddEvent(fullCtx, {
      attribution_source: 'simrel',
      attribution_action_id: 'add-1',
      cart_value: 100,
      currency: 'TRY',
      line_items: 1,
      sku: 'P-1',
    });
    expect(event.view_id).toBe('view-123');
    expect(event.user_id).toBe('user-456');
    expect(event.page_type).toBe('pdp');
    expect(event.sku).toBe('SKU-789');
  });

  it('omits optional context fields when not provided', () => {
    const event = basketAddEvent(minimalCtx, {
      attribution_source: 'simrel',
      attribution_action_id: 'add-1',
      cart_value: 100,
      currency: 'TRY',
      line_items: 1,
      sku: 'P-1',
    });
    expect(event).not.toHaveProperty('view_id');
    expect(event).not.toHaveProperty('user_id');
    expect(event).not.toHaveProperty('page_type');
    // Note: envelope sku is from context, not payload
    expect(event).not.toHaveProperty('sku');
  });
});

describe('checkoutStartEvent', () => {
  it('returns correct event_name', () => {
    const event = checkoutStartEvent(minimalCtx, {
      attribution_source: 'chat',
      attribution_action_id: 'checkout-1',
      cart_value: 500,
      currency: 'TRY',
      line_items: 3,
    });
    expect(event.event_name).toBe('checkout.start');
  });

  it('includes attribution metadata in payload', () => {
    const event = checkoutStartEvent(minimalCtx, {
      attribution_source: 'qna',
      attribution_action_id: 'co-start-1',
      cart_value: 250,
      currency: 'EUR',
      line_items: 2,
    });
    expect(event.payload.attribution_source).toBe('qna');
    expect(event.payload.attribution_action_id).toBe('co-start-1');
    expect(event.payload.cart_value).toBe(250);
    expect(event.payload.currency).toBe('EUR');
    expect(event.payload.line_items).toBe(2);
  });

  it('sets widget field from attribution_source', () => {
    const event = checkoutStartEvent(minimalCtx, {
      attribution_source: 'chat',
      attribution_action_id: 'co-1',
      cart_value: 100,
      currency: 'TRY',
      line_items: 1,
    });
    expect(event.widget).toBe('chat');
  });

  it('always includes required envelope fields', () => {
    const event = checkoutStartEvent(minimalCtx, {
      attribution_source: 'chat',
      attribution_action_id: 'co-1',
      cart_value: 100,
      currency: 'TRY',
      line_items: 1,
    });
    expect(event.account_id).toBe('acc-001');
    expect(event.session_id).toBe('sess-abc');
    expect(event.correlation_id).toBe('corr-xyz');
  });

  it('includes optional context fields when provided', () => {
    const event = checkoutStartEvent(fullCtx, {
      attribution_source: 'chat',
      attribution_action_id: 'co-1',
      cart_value: 100,
      currency: 'TRY',
      line_items: 1,
    });
    expect(event.view_id).toBe('view-123');
    expect(event.user_id).toBe('user-456');
  });

  it('omits optional fields when not provided', () => {
    const event = checkoutStartEvent(minimalCtx, {
      attribution_source: 'chat',
      attribution_action_id: 'co-1',
      cart_value: 100,
      currency: 'TRY',
      line_items: 1,
    });
    expect(event).not.toHaveProperty('view_id');
    expect(event).not.toHaveProperty('user_id');
  });
});

describe('checkoutCompleteEvent', () => {
  it('returns correct event_name', () => {
    const event = checkoutCompleteEvent(minimalCtx, {
      attribution_source: 'simrel',
      attribution_action_id: 'co-done-1',
      cart_value: 750,
      currency: 'TRY',
      line_items: 5,
    });
    expect(event.event_name).toBe('checkout.complete');
  });

  it('includes attribution metadata in payload', () => {
    const event = checkoutCompleteEvent(minimalCtx, {
      attribution_source: 'simrel',
      attribution_action_id: 'co-done-1',
      cart_value: 750,
      currency: 'TRY',
      line_items: 5,
    });
    expect(event.payload.attribution_source).toBe('simrel');
    expect(event.payload.attribution_action_id).toBe('co-done-1');
    expect(event.payload.cart_value).toBe(750);
    expect(event.payload.currency).toBe('TRY');
    expect(event.payload.line_items).toBe(5);
  });

  it('sets widget field from attribution_source', () => {
    const event = checkoutCompleteEvent(minimalCtx, {
      attribution_source: 'qna',
      attribution_action_id: 'co-done-1',
      cart_value: 100,
      currency: 'TRY',
      line_items: 1,
    });
    expect(event.widget).toBe('qna');
  });

  it('always includes required envelope fields', () => {
    const event = checkoutCompleteEvent(minimalCtx, {
      attribution_source: 'simrel',
      attribution_action_id: 'co-done-1',
      cart_value: 100,
      currency: 'TRY',
      line_items: 1,
    });
    expect(event.account_id).toBe('acc-001');
    expect(event.session_id).toBe('sess-abc');
    expect(event.correlation_id).toBe('corr-xyz');
  });

  it('includes optional context fields when provided', () => {
    const event = checkoutCompleteEvent(fullCtx, {
      attribution_source: 'simrel',
      attribution_action_id: 'co-done-1',
      cart_value: 100,
      currency: 'TRY',
      line_items: 1,
    });
    expect(event.view_id).toBe('view-123');
    expect(event.user_id).toBe('user-456');
    expect(event.page_type).toBe('pdp');
    expect(event.sku).toBe('SKU-789');
  });

  it('omits optional fields when not provided', () => {
    const event = checkoutCompleteEvent(minimalCtx, {
      attribution_source: 'simrel',
      attribution_action_id: 'co-done-1',
      cart_value: 100,
      currency: 'TRY',
      line_items: 1,
    });
    expect(event).not.toHaveProperty('view_id');
    expect(event).not.toHaveProperty('user_id');
    expect(event).not.toHaveProperty('page_type');
    expect(event).not.toHaveProperty('sku');
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting contract validation
// ---------------------------------------------------------------------------

describe('analytics contract compliance', () => {
  it('all event factories produce distinct event_name values', () => {
    const events = [
      streamStartEvent(minimalCtx, { endpoint: '/test', request_id: 'r' }),
      streamChunkEvent(minimalCtx, { request_id: 'r', chunk_index: 0 }),
      streamUiSpecEvent(minimalCtx, { request_id: 'r', chunk_index: 0, component_type: 'T' }),
      streamDoneEvent(minimalCtx, { request_id: 'r', latency_ms: 0, chunk_count: 0 }),
      streamErrorEvent(minimalCtx, { request_id: 'r', error_code: 'E', error_message: 'm' }),
      llmUsageEvent(minimalCtx, { model: 'm', prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }),
      meteringIncrementEvent(minimalCtx, { meter_key: 'k', quantity: 0, unit: 'u' }),
      meteringSummaryEvent(minimalCtx, { meter_key: 'k', quantity: 0, unit: 'u' }),
      chatHistorySnapshotEvent(minimalCtx, { message_count: 0, history_ref: 'r', redaction_level: 'n' }),
      widgetHistorySnapshotEvent(minimalCtx, {
        message_count: 0,
        history_ref: 'r',
        redaction_level: 'n',
        widget: 'chat',
      }),
      basketAddEvent(minimalCtx, {
        attribution_source: 'chat',
        attribution_action_id: 'a',
        cart_value: 0,
        currency: 'X',
        line_items: 0,
        sku: 's',
      }),
      checkoutStartEvent(minimalCtx, {
        attribution_source: 'chat',
        attribution_action_id: 'a',
        cart_value: 0,
        currency: 'X',
        line_items: 0,
      }),
      checkoutCompleteEvent(minimalCtx, {
        attribution_source: 'chat',
        attribution_action_id: 'a',
        cart_value: 0,
        currency: 'X',
        line_items: 0,
      }),
    ];

    const names = events.map((e) => e.event_name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it('all event_name values use lowercase dot-separated namespaces', () => {
    const events = [
      streamStartEvent(minimalCtx, { endpoint: '/test', request_id: 'r' }),
      streamChunkEvent(minimalCtx, { request_id: 'r', chunk_index: 0 }),
      streamUiSpecEvent(minimalCtx, { request_id: 'r', chunk_index: 0, component_type: 'T' }),
      streamDoneEvent(minimalCtx, { request_id: 'r', latency_ms: 0, chunk_count: 0 }),
      streamErrorEvent(minimalCtx, { request_id: 'r', error_code: 'E', error_message: 'm' }),
      llmUsageEvent(minimalCtx, { model: 'm', prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }),
      meteringIncrementEvent(minimalCtx, { meter_key: 'k', quantity: 0, unit: 'u' }),
      meteringSummaryEvent(minimalCtx, { meter_key: 'k', quantity: 0, unit: 'u' }),
      chatHistorySnapshotEvent(minimalCtx, { message_count: 0, history_ref: 'r', redaction_level: 'n' }),
      widgetHistorySnapshotEvent(minimalCtx, {
        message_count: 0,
        history_ref: 'r',
        redaction_level: 'n',
        widget: 'chat',
      }),
      basketAddEvent(minimalCtx, {
        attribution_source: 'chat',
        attribution_action_id: 'a',
        cart_value: 0,
        currency: 'X',
        line_items: 0,
        sku: 's',
      }),
      checkoutStartEvent(minimalCtx, {
        attribution_source: 'chat',
        attribution_action_id: 'a',
        cart_value: 0,
        currency: 'X',
        line_items: 0,
      }),
      checkoutCompleteEvent(minimalCtx, {
        attribution_source: 'chat',
        attribution_action_id: 'a',
        cart_value: 0,
        currency: 'X',
        line_items: 0,
      }),
    ];

    for (const event of events) {
      expect(event.event_name).toMatch(/^[a-z][a-z0-9_.]*$/);
    }
  });

  it('session_id and correlation_id are always present in every event', () => {
    const events = [
      streamStartEvent(minimalCtx, { endpoint: '/test', request_id: 'r' }),
      llmUsageEvent(minimalCtx, { model: 'm', prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }),
      meteringIncrementEvent(minimalCtx, { meter_key: 'k', quantity: 0, unit: 'u' }),
      chatHistorySnapshotEvent(minimalCtx, { message_count: 0, history_ref: 'r', redaction_level: 'n' }),
      basketAddEvent(minimalCtx, {
        attribution_source: 'chat',
        attribution_action_id: 'a',
        cart_value: 0,
        currency: 'X',
        line_items: 0,
        sku: 's',
      }),
      checkoutCompleteEvent(minimalCtx, {
        attribution_source: 'chat',
        attribution_action_id: 'a',
        cart_value: 0,
        currency: 'X',
        line_items: 0,
      }),
    ];

    for (const event of events) {
      expect(event.session_id).toBeTruthy();
      expect(event.correlation_id).toBeTruthy();
      expect(event.account_id).toBeTruthy();
    }
  });

  it('event_name values match the analytics contract document', () => {
    // Validate against docs/analytics-contract.md event families
    const expectedNames = [
      'stream.start',
      'stream.chunk',
      'stream.ui_spec',
      'stream.done',
      'stream.error',
      'llm.usage',
      'metering.increment',
      'metering.summary',
      'chat.history.snapshot',
      'widget.history.snapshot',
      'basket.add',
      'checkout.start',
      'checkout.complete',
    ];

    const actualNames = [
      streamStartEvent(minimalCtx, { endpoint: '/test', request_id: 'r' }).event_name,
      streamChunkEvent(minimalCtx, { request_id: 'r', chunk_index: 0 }).event_name,
      streamUiSpecEvent(minimalCtx, { request_id: 'r', chunk_index: 0, component_type: 'T' }).event_name,
      streamDoneEvent(minimalCtx, { request_id: 'r', latency_ms: 0, chunk_count: 0 }).event_name,
      streamErrorEvent(minimalCtx, { request_id: 'r', error_code: 'E', error_message: 'm' }).event_name,
      llmUsageEvent(minimalCtx, { model: 'm', prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }).event_name,
      meteringIncrementEvent(minimalCtx, { meter_key: 'k', quantity: 0, unit: 'u' }).event_name,
      meteringSummaryEvent(minimalCtx, { meter_key: 'k', quantity: 0, unit: 'u' }).event_name,
      chatHistorySnapshotEvent(minimalCtx, { message_count: 0, history_ref: 'r', redaction_level: 'n' }).event_name,
      widgetHistorySnapshotEvent(minimalCtx, {
        message_count: 0,
        history_ref: 'r',
        redaction_level: 'n',
        widget: 'chat',
      }).event_name,
      basketAddEvent(minimalCtx, {
        attribution_source: 'chat',
        attribution_action_id: 'a',
        cart_value: 0,
        currency: 'X',
        line_items: 0,
        sku: 's',
      }).event_name,
      checkoutStartEvent(minimalCtx, {
        attribution_source: 'chat',
        attribution_action_id: 'a',
        cart_value: 0,
        currency: 'X',
        line_items: 0,
      }).event_name,
      checkoutCompleteEvent(minimalCtx, {
        attribution_source: 'chat',
        attribution_action_id: 'a',
        cart_value: 0,
        currency: 'X',
        line_items: 0,
      }).event_name,
    ];

    expect(actualNames).toEqual(expectedNames);
  });
});

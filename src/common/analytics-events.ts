import type { AnalyticsInput } from './analytics.js';

// Context shared across all events in a page session
export interface AnalyticsContext {
  account_id: string;
  session_id: string;
  correlation_id: string;
  view_id?: string;
  user_id?: string;
  page_type?: string;
  sku?: string;
  ab_test_variant?: string;
  ab_test_experiment_id?: string;
}

// ---------------------------------------------------------------------------
// Stream Lifecycle
// ---------------------------------------------------------------------------

export function streamStartEvent(
  ctx: AnalyticsContext,
  payload: {
    endpoint: string;
    request_id: string;
    widget?: 'chat' | 'qna' | 'simrel';
  },
): AnalyticsInput {
  const event: AnalyticsInput = {
    event_name: 'stream.start',
    account_id: ctx.account_id,
    session_id: ctx.session_id,
    correlation_id: ctx.correlation_id,
    payload: {
      endpoint: payload.endpoint,
      request_id: payload.request_id,
    },
  };
  if (ctx.view_id !== undefined) event.view_id = ctx.view_id;
  if (ctx.user_id !== undefined) event.user_id = ctx.user_id;
  if (payload.widget !== undefined) event.widget = payload.widget;
  if (ctx.page_type !== undefined) event.page_type = ctx.page_type;
  if (ctx.sku !== undefined) event.sku = ctx.sku;
  return event;
}

export function streamChunkEvent(
  ctx: AnalyticsContext,
  payload: {
    request_id: string;
    chunk_index: number;
    latency_ms?: number;
    widget?: 'chat' | 'qna' | 'simrel';
  },
): AnalyticsInput {
  const eventPayload: Record<string, unknown> = {
    request_id: payload.request_id,
    chunk_index: payload.chunk_index,
  };
  if (payload.latency_ms !== undefined) eventPayload.latency_ms = payload.latency_ms;

  const event: AnalyticsInput = {
    event_name: 'stream.chunk',
    account_id: ctx.account_id,
    session_id: ctx.session_id,
    correlation_id: ctx.correlation_id,
    payload: eventPayload,
  };
  if (ctx.view_id !== undefined) event.view_id = ctx.view_id;
  if (ctx.user_id !== undefined) event.user_id = ctx.user_id;
  if (payload.widget !== undefined) event.widget = payload.widget;
  if (ctx.page_type !== undefined) event.page_type = ctx.page_type;
  if (ctx.sku !== undefined) event.sku = ctx.sku;
  return event;
}

export function streamUiSpecEvent(
  ctx: AnalyticsContext,
  payload: {
    request_id: string;
    chunk_index: number;
    component_type: string;
    widget?: 'chat' | 'qna' | 'simrel';
  },
): AnalyticsInput {
  const event: AnalyticsInput = {
    event_name: 'stream.ui_spec',
    account_id: ctx.account_id,
    session_id: ctx.session_id,
    correlation_id: ctx.correlation_id,
    payload: {
      request_id: payload.request_id,
      chunk_index: payload.chunk_index,
      component_type: payload.component_type,
    },
  };
  if (ctx.view_id !== undefined) event.view_id = ctx.view_id;
  if (ctx.user_id !== undefined) event.user_id = ctx.user_id;
  if (payload.widget !== undefined) event.widget = payload.widget;
  if (ctx.page_type !== undefined) event.page_type = ctx.page_type;
  if (ctx.sku !== undefined) event.sku = ctx.sku;
  return event;
}

export function streamDoneEvent(
  ctx: AnalyticsContext,
  payload: {
    request_id: string;
    latency_ms: number;
    chunk_count: number;
    widget?: 'chat' | 'qna' | 'simrel';
  },
): AnalyticsInput {
  const event: AnalyticsInput = {
    event_name: 'stream.done',
    account_id: ctx.account_id,
    session_id: ctx.session_id,
    correlation_id: ctx.correlation_id,
    payload: {
      request_id: payload.request_id,
      latency_ms: payload.latency_ms,
      chunk_count: payload.chunk_count,
    },
  };
  if (ctx.view_id !== undefined) event.view_id = ctx.view_id;
  if (ctx.user_id !== undefined) event.user_id = ctx.user_id;
  if (payload.widget !== undefined) event.widget = payload.widget;
  if (ctx.page_type !== undefined) event.page_type = ctx.page_type;
  if (ctx.sku !== undefined) event.sku = ctx.sku;
  return event;
}

export function streamErrorEvent(
  ctx: AnalyticsContext,
  payload: {
    request_id: string;
    error_code: string;
    error_message: string;
    widget?: 'chat' | 'qna' | 'simrel';
  },
): AnalyticsInput {
  const event: AnalyticsInput = {
    event_name: 'stream.error',
    account_id: ctx.account_id,
    session_id: ctx.session_id,
    correlation_id: ctx.correlation_id,
    payload: {
      request_id: payload.request_id,
      error_code: payload.error_code,
      error_message: payload.error_message,
    },
  };
  if (ctx.view_id !== undefined) event.view_id = ctx.view_id;
  if (ctx.user_id !== undefined) event.user_id = ctx.user_id;
  if (payload.widget !== undefined) event.widget = payload.widget;
  if (ctx.page_type !== undefined) event.page_type = ctx.page_type;
  if (ctx.sku !== undefined) event.sku = ctx.sku;
  return event;
}

// ---------------------------------------------------------------------------
// LLM Usage
// ---------------------------------------------------------------------------

export function llmUsageEvent(
  ctx: AnalyticsContext,
  payload: {
    model: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    provider?: string;
  },
): AnalyticsInput {
  const eventPayload: Record<string, unknown> = {
    model: payload.model,
    prompt_tokens: payload.prompt_tokens,
    completion_tokens: payload.completion_tokens,
    total_tokens: payload.total_tokens,
  };
  if (payload.provider !== undefined) eventPayload.provider = payload.provider;

  const event: AnalyticsInput = {
    event_name: 'llm.usage',
    account_id: ctx.account_id,
    session_id: ctx.session_id,
    correlation_id: ctx.correlation_id,
    payload: eventPayload,
  };
  if (ctx.view_id !== undefined) event.view_id = ctx.view_id;
  if (ctx.user_id !== undefined) event.user_id = ctx.user_id;
  if (ctx.page_type !== undefined) event.page_type = ctx.page_type;
  if (ctx.sku !== undefined) event.sku = ctx.sku;
  return event;
}

// ---------------------------------------------------------------------------
// Metering
// ---------------------------------------------------------------------------

export function meteringIncrementEvent(
  ctx: AnalyticsContext,
  payload: {
    meter_key: string;
    quantity: number;
    unit: string;
  },
): AnalyticsInput {
  const event: AnalyticsInput = {
    event_name: 'metering.increment',
    account_id: ctx.account_id,
    session_id: ctx.session_id,
    correlation_id: ctx.correlation_id,
    payload: {
      meter_key: payload.meter_key,
      quantity: payload.quantity,
      unit: payload.unit,
    },
  };
  if (ctx.view_id !== undefined) event.view_id = ctx.view_id;
  if (ctx.user_id !== undefined) event.user_id = ctx.user_id;
  if (ctx.page_type !== undefined) event.page_type = ctx.page_type;
  if (ctx.sku !== undefined) event.sku = ctx.sku;
  return event;
}

export function meteringSummaryEvent(
  ctx: AnalyticsContext,
  payload: {
    meter_key: string;
    quantity: number;
    unit: string;
  },
): AnalyticsInput {
  const event: AnalyticsInput = {
    event_name: 'metering.summary',
    account_id: ctx.account_id,
    session_id: ctx.session_id,
    correlation_id: ctx.correlation_id,
    payload: {
      meter_key: payload.meter_key,
      quantity: payload.quantity,
      unit: payload.unit,
    },
  };
  if (ctx.view_id !== undefined) event.view_id = ctx.view_id;
  if (ctx.user_id !== undefined) event.user_id = ctx.user_id;
  if (ctx.page_type !== undefined) event.page_type = ctx.page_type;
  if (ctx.sku !== undefined) event.sku = ctx.sku;
  return event;
}

// ---------------------------------------------------------------------------
// Chat and Widget Histories
// ---------------------------------------------------------------------------

export function chatHistorySnapshotEvent(
  ctx: AnalyticsContext,
  payload: {
    message_count: number;
    history_ref: string;
    redaction_level: string;
  },
): AnalyticsInput {
  const event: AnalyticsInput = {
    event_name: 'chat.history.snapshot',
    account_id: ctx.account_id,
    session_id: ctx.session_id,
    correlation_id: ctx.correlation_id,
    payload: {
      message_count: payload.message_count,
      history_ref: payload.history_ref,
      redaction_level: payload.redaction_level,
    },
  };
  if (ctx.view_id !== undefined) event.view_id = ctx.view_id;
  if (ctx.user_id !== undefined) event.user_id = ctx.user_id;
  if (ctx.page_type !== undefined) event.page_type = ctx.page_type;
  if (ctx.sku !== undefined) event.sku = ctx.sku;
  return event;
}

export function widgetHistorySnapshotEvent(
  ctx: AnalyticsContext,
  payload: {
    message_count: number;
    history_ref: string;
    redaction_level: string;
    widget: 'chat' | 'qna' | 'simrel';
  },
): AnalyticsInput {
  const event: AnalyticsInput = {
    event_name: 'widget.history.snapshot',
    account_id: ctx.account_id,
    session_id: ctx.session_id,
    correlation_id: ctx.correlation_id,
    widget: payload.widget,
    payload: {
      message_count: payload.message_count,
      history_ref: payload.history_ref,
      redaction_level: payload.redaction_level,
    },
  };
  if (ctx.view_id !== undefined) event.view_id = ctx.view_id;
  if (ctx.user_id !== undefined) event.user_id = ctx.user_id;
  if (ctx.page_type !== undefined) event.page_type = ctx.page_type;
  if (ctx.sku !== undefined) event.sku = ctx.sku;
  return event;
}

// ---------------------------------------------------------------------------
// Commerce Attribution
// ---------------------------------------------------------------------------

export function basketAddEvent(
  ctx: AnalyticsContext,
  payload: {
    attribution_source: 'chat' | 'qna' | 'simrel';
    attribution_action_id: string;
    cart_value: number;
    currency: string;
    line_items: number;
    sku: string;
  },
): AnalyticsInput {
  const event: AnalyticsInput = {
    event_name: 'basket.add',
    account_id: ctx.account_id,
    session_id: ctx.session_id,
    correlation_id: ctx.correlation_id,
    widget: payload.attribution_source,
    payload: {
      attribution_source: payload.attribution_source,
      attribution_action_id: payload.attribution_action_id,
      cart_value: payload.cart_value,
      currency: payload.currency,
      line_items: payload.line_items,
      sku: payload.sku,
    },
  };
  if (ctx.view_id !== undefined) event.view_id = ctx.view_id;
  if (ctx.user_id !== undefined) event.user_id = ctx.user_id;
  if (ctx.page_type !== undefined) event.page_type = ctx.page_type;
  if (ctx.sku !== undefined) event.sku = ctx.sku;
  return event;
}

export function checkoutStartEvent(
  ctx: AnalyticsContext,
  payload: {
    attribution_source: 'chat' | 'qna' | 'simrel';
    attribution_action_id: string;
    cart_value: number;
    currency: string;
    line_items: number;
  },
): AnalyticsInput {
  const event: AnalyticsInput = {
    event_name: 'checkout.start',
    account_id: ctx.account_id,
    session_id: ctx.session_id,
    correlation_id: ctx.correlation_id,
    widget: payload.attribution_source,
    payload: {
      attribution_source: payload.attribution_source,
      attribution_action_id: payload.attribution_action_id,
      cart_value: payload.cart_value,
      currency: payload.currency,
      line_items: payload.line_items,
    },
  };
  if (ctx.view_id !== undefined) event.view_id = ctx.view_id;
  if (ctx.user_id !== undefined) event.user_id = ctx.user_id;
  if (ctx.page_type !== undefined) event.page_type = ctx.page_type;
  if (ctx.sku !== undefined) event.sku = ctx.sku;
  return event;
}

export function checkoutCompleteEvent(
  ctx: AnalyticsContext,
  payload: {
    attribution_source: 'chat' | 'qna' | 'simrel';
    attribution_action_id: string;
    cart_value: number;
    currency: string;
    line_items: number;
  },
): AnalyticsInput {
  const event: AnalyticsInput = {
    event_name: 'checkout.complete',
    account_id: ctx.account_id,
    session_id: ctx.session_id,
    correlation_id: ctx.correlation_id,
    widget: payload.attribution_source,
    payload: {
      attribution_source: payload.attribution_source,
      attribution_action_id: payload.attribution_action_id,
      cart_value: payload.cart_value,
      currency: payload.currency,
      line_items: payload.line_items,
    },
  };
  if (ctx.view_id !== undefined) event.view_id = ctx.view_id;
  if (ctx.user_id !== undefined) event.user_id = ctx.user_id;
  if (ctx.page_type !== undefined) event.page_type = ctx.page_type;
  if (ctx.sku !== undefined) event.sku = ctx.sku;
  return event;
}

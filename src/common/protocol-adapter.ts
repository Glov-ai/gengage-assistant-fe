/**
 * Wire protocol adapter.
 *
 * Backend emits NDJSON events with `type` values like
 * `outputText`, `suggestedActions`, `productList`, etc.
 *
 * This module translates those backend events into the SDK's normalized
 * `StreamEvent` model.
 *
 * Also handles JSON-mode responses from `similar_products` and
 * `product_groupings` endpoints.
 */

import type {
  StreamEvent,
  StreamEventMetadata,
  StreamEventTextChunk,
  StreamEventUISpec,
  StreamEventAction,
  StreamEventDone,
  StreamEventError,
  UIElement,
} from './types.js';
import { getSuggestedSearchKeywordsText } from './suggested-search-keywords.js';

type WidgetName = 'chat' | 'qna' | 'simrel';

interface V1RequestDetails {
  type?: string;
  payload?: unknown;
  [key: string]: unknown;
}

interface V1ProductSuggestionsLabel {
  label?: string;
  sentiment?: string;
  [key: string]: unknown;
}

interface V1ReviewHighlightItem {
  review_class?: string;
  review_text?: string;
  review_rating?: string | number;
  review_tag?: string;
  [key: string]: unknown;
}

interface V1OutputText {
  type: 'outputText';
  payload: {
    text?: string;
    plain_text?: string;
    is_error?: boolean;
    [key: string]: unknown;
  };
}

interface V1SuggestedActionItem {
  title?: string;
  icon?: string;
  image?: string | null;
  requestDetails?: V1RequestDetails;
  [key: string]: unknown;
}

interface V1SuggestedActions {
  type: 'suggestedActions';
  payload: {
    actions?: V1SuggestedActionItem[];
    [key: string]: unknown;
  };
}

export interface V1Product {
  sku: string;
  name: string;
  brand?: string;
  images?: string[];
  price?: number;
  price_discounted?: number;
  price_discount_rate?: number;
  price_currency?: string;
  discount_reason?: string;
  url?: string;
  rating?: number;
  review_count?: number;
  cart_code?: string;
  in_stock?: boolean;
  description?: string;
  description_html?: string;
  features?: Array<{ name?: string; key?: string; value?: string | number | boolean; [key: string]: unknown }>;
  specifications?: Record<string, string> | Array<{ key: string; value: string }>;
  facet_tags?: string[];
  short_name?: string;
  category_ids?: string[];
  category_names?: string[];
  variants?: Array<Record<string, unknown>>;
  facet_hits?: Record<string, unknown> | null;
  promotions?: string[];
}

interface V1ProductList {
  type: 'productList';
  payload: {
    product_list?: V1Product[];
    source?: string;
    title?: string;
    offset?: number;
    page_size?: number;
    end_of_list?: boolean;
    [key: string]: unknown;
  };
}

interface V1ProductDetails {
  type: 'productDetails';
  payload: { productDetails?: V1Product; [key: string]: unknown };
}

interface V1ProductDetailsSimilars {
  type: 'productDetailsSimilars';
  payload: { similarProducts?: V1Product[]; [key: string]: unknown };
}

interface V1ComparisonTable {
  type: 'comparisonTable';
  payload: {
    multiple_product_details?: V1Product[];
    table?: Record<string, string[] | Record<string, unknown>>;
    features_list?: string[];
    product_comparison_framework?: {
      key_differences?: string[];
      recommended_choice?: string;
      recommended_choice_sku?: string;
      special_considerations?: string[];
      criteria_view?: Record<string, string>;
      criteria_view_short?: Record<string, string>;
      compared_field_names?: string[];
      winner_product?: Array<{ sku?: string; name?: string; product_detail?: { sku?: string } }>;
      winner_hits?: Record<string, { positive?: string[]; negative?: string[] }>;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}

interface V1Context {
  type: 'context';
  payload: {
    panel?: Record<string, unknown>;
    messages?: Array<{ role?: string; content?: string }>;
    message_id?: string;
    [key: string]: unknown;
  };
}

interface V1ChatStreamEnd {
  type: 'chatStreamEnd';
  payload?: Record<string, unknown>;
}

interface V1Loading {
  type: 'loading';
  payload: {
    text?: string;
    is_dynamic?: boolean;
    thinking_messages?: string[];
    [key: string]: unknown;
  };
}

interface V1PanelLoading {
  type: 'panelLoading';
  payload?: { text?: string; pending_type?: string; [key: string]: unknown };
}

interface V1SimilarLoading {
  type: 'similarLoading';
  payload?: { text?: string; pending_type?: string; [key: string]: unknown };
}

interface V1Redirect {
  type: 'redirect';
  payload: { url?: string; new_tab?: boolean; to?: string; [key: string]: unknown };
}

interface V1Error {
  type: 'error';
  payload?: {
    text?: string;
    message?: string;
    error?: string;
    [key: string]: unknown;
  };
}

interface V1Noop {
  type: 'dummy';
  payload?: Record<string, unknown>;
}

interface V1LauncherAction {
  type: 'launcherAction';
  payload?: Record<string, unknown>;
}

interface V1LauncherText {
  type: 'text';
  payload: {
    type?: string;
    text?: string;
    payload?: Record<string, unknown>;
    theme?: string;
    [key: string]: unknown;
  };
}

interface V1ProductItem {
  type: 'productItem';
  payload: V1Product & { group_id?: string; [key: string]: unknown };
}

interface V1LauncherTextImage {
  type: 'text_image';
  payload: {
    type?: string;
    text?: string;
    image_url?: string;
    theme?: string;
    action?: V1RequestDetails;
    [key: string]: unknown;
  };
}

interface V1LauncherQuickQna {
  type: 'quick_qna';
  payload: {
    type?: string;
    theme?: string;
    action_list?: V1SuggestedActionItem[];
    [key: string]: unknown;
  };
}

interface V1ReviewHighlights {
  type: 'reviewHighlights';
  payload: {
    sku?: string;
    reviews?: V1ReviewHighlightItem[];
    [key: string]: unknown;
  };
}

export interface V1ProsAndCons {
  type: 'prosAndCons';
  payload: { pros?: string[]; cons?: string[]; product_name?: string; [key: string]: unknown };
}

interface V1VisitorDataResponse {
  type: 'visitorDataResponse';
  payload: Record<string, unknown>;
}

interface V1AiProductSuggestion {
  sku?: string;
  short_name?: string;
  role?: string;
  labels?: V1ProductSuggestionsLabel[];
  reason?: string;
  expert_quality_score?: number;
  review_highlight?: string;
  /** Campaign / merchant discount label; merged into normalized product for price UI. */
  discount_reason?: string;
  product_item?: V1Product;
  requestDetails?: V1RequestDetails;
  [key: string]: unknown;
}

interface V1AiProductSuggestions {
  type: 'aiProductSuggestions';
  payload: {
    product_suggestions?: V1AiProductSuggestion[];
    [key: string]: unknown;
  };
}

interface V1AiProductGrouping {
  name?: string;
  image?: string;
  labels?: string[];
  sku?: string;
  requestDetails?: V1RequestDetails;
  [key: string]: unknown;
}

interface V1AiProductGroupings {
  type: 'aiProductGroupings';
  payload: {
    product_groupings?: V1AiProductGrouping[];
    [key: string]: unknown;
  };
}

interface V1AiSuggestedSearch {
  short_name?: string;
  detailed_user_message?: string;
  /** Long explanatory copy — not used for the compact browse keyword line */
  why_different?: string;
  /** Preferred compact keyword chips for the browse card (see suggested-search-keywords) */
  display_keywords?: string[];
  chosen_attribute?: string;
  representative_product_sku?: string;
  group_skus?: string[];
  sku?: string;
  image?: string;
  requestDetails?: V1RequestDetails;
  [key: string]: unknown;
}

interface V1AiSuggestedSearches {
  type: 'aiSuggestedSearches';
  payload: {
    suggested_searches?: V1AiSuggestedSearch[];
    [key: string]: unknown;
  };
}

interface V1GetGroundingReview {
  type: 'getGroundingReview';
  payload: {
    title?: string;
    text?: string;
    review_count?: string;
    requestDetails?: V1RequestDetails;
    [key: string]: unknown;
  };
}

interface V1Voice {
  type: 'voice';
  payload: {
    text?: string;
    audio_base64?: string;
    content_type?: string;
    [key: string]: unknown;
  };
}

interface V1GroupList {
  type: 'groupList';
  payload: {
    group_list?: Array<{ group_name?: string; product_list?: V1Product[] }>;
    filter_tags?: Array<{ title?: string; requestDetails?: V1RequestDetails }>;
    [key: string]: unknown;
  };
}

interface V1FormEvent {
  type: 'formGetInfo' | 'formTestDrive' | 'formServiceRequest' | 'launchFormPage';
  payload?: Record<string, unknown>;
}

interface V1LauncherContent {
  type: 'launcherContent';
  payload?: Record<string, unknown>;
}

interface V1Handoff {
  type: 'handoff';
  payload?: {
    summary?: string;
    products_discussed?: string[];
    user_sentiment?: string;
    [key: string]: unknown;
  };
}

type V1StreamEvent =
  | V1OutputText
  | V1SuggestedActions
  | V1ProductList
  | V1ProductDetails
  | V1ProductDetailsSimilars
  | V1ComparisonTable
  | V1Context
  | V1ChatStreamEnd
  | V1Loading
  | V1PanelLoading
  | V1SimilarLoading
  | V1Redirect
  | V1Error
  | V1Noop
  | V1LauncherAction
  | V1LauncherText
  | V1ProductItem
  | V1LauncherTextImage
  | V1LauncherQuickQna
  | V1ReviewHighlights
  | V1AiProductSuggestions
  | V1AiProductGroupings
  | V1AiSuggestedSearches
  | V1GetGroundingReview
  | V1Voice
  | V1GroupList
  | V1FormEvent
  | V1LauncherContent
  | V1Handoff
  | { type: string; payload?: unknown; [key: string]: unknown };

export function adaptBackendEvent(raw: Record<string, unknown>): StreamEvent | null {
  const type = raw['type'];
  if (typeof type !== 'string') return null;

  if (isNormalizedStreamEvent(raw)) {
    return raw as unknown as StreamEvent;
  }

  const event = raw as V1StreamEvent;

  switch (event.type) {
    case 'outputText':
      return adaptOutputText(event as V1OutputText);
    case 'suggestedActions':
      return adaptSuggestedActions(event as V1SuggestedActions);
    case 'productList':
      return adaptProductList(event as V1ProductList);
    case 'productDetails':
      return adaptProductDetails(event as V1ProductDetails);
    case 'productDetailsSimilars':
      return adaptProductDetailsSimilars(event as V1ProductDetailsSimilars);
    case 'comparisonTable':
      return adaptComparisonTable(event as V1ComparisonTable);
    case 'context':
      return adaptContext(event as V1Context);
    case 'chatStreamEnd':
      return adaptChatStreamEnd();
    case 'loading':
      return adaptLoading(event as V1Loading);
    case 'panelLoading':
      return adaptPanelLoading(event as V1PanelLoading);
    case 'similarLoading':
      return adaptSimilarLoading(event as V1SimilarLoading);
    case 'redirect':
      return adaptRedirect(event as V1Redirect);
    case 'error':
      return adaptV1Error(event as V1Error);
    case 'dummy':
      return adaptNoop(event as V1Noop);
    case 'launcherAction':
      return adaptLauncherAction(event as V1LauncherAction);
    case 'text':
      return adaptLauncherText(event as V1LauncherText);
    case 'productItem':
      return adaptProductItem(event as V1ProductItem);
    case 'text_image':
      return adaptLauncherTextImage(event as V1LauncherTextImage);
    case 'quick_qna':
      return adaptLauncherQuickQna(event as V1LauncherQuickQna);
    case 'reviewHighlights':
      return adaptReviewHighlights(event as V1ReviewHighlights);
    case 'aiProductSuggestions':
      return adaptAiProductSuggestions(event as V1AiProductSuggestions);
    case 'aiProductGroupings':
      return adaptAiProductGroupings(event as V1AiProductGroupings);
    case 'aiSuggestedSearches':
      return adaptAiSuggestedSearches(event as V1AiSuggestedSearches);
    case 'prosAndCons':
      return adaptProsAndCons(event as V1ProsAndCons);
    case 'getGroundingReview':
      return adaptGetGroundingReview(event as V1GetGroundingReview);
    case 'voice':
      return adaptVoice(event as V1Voice);
    case 'visitorDataResponse':
      return adaptVisitorDataResponse(event as V1VisitorDataResponse);
    case 'productListPreview':
      return adaptProductListPreview();
    case 'groupList':
      return adaptGroupList(event as V1GroupList);
    case 'formGetInfo':
    case 'formTestDrive':
    case 'formServiceRequest':
    case 'launchFormPage':
      return adaptFormEvent(event as V1FormEvent);
    case 'launcherContent':
      return adaptLauncherContent(event as V1LauncherContent);
    case 'handoff':
      return adaptHandoff(event as V1Handoff);
    default:
      if (import.meta.env?.DEV) {
        console.warn('[gengage:protocol] Unknown backend event type:', event.type);
      }
      return null;
  }
}

function isNormalizedStreamEvent(raw: Record<string, unknown>): boolean {
  const type = raw['type'];
  if (typeof type !== 'string') return false;

  switch (type) {
    case 'metadata':
      return typeof raw['sessionId'] === 'string' && typeof raw['model'] === 'string';
    case 'text_chunk':
      return typeof raw['content'] === 'string';
    case 'ui_spec': {
      const widget = raw['widget'];
      if (widget !== 'chat' && widget !== 'qna' && widget !== 'simrel') return false;
      const spec = asRecord(raw['spec']);
      if (!spec) return false;
      return typeof spec['root'] === 'string' && asRecord(spec['elements']) !== null;
    }
    case 'action': {
      const action = asRecord(raw['action']);
      return action !== null && typeof action['kind'] === 'string';
    }
    case 'error':
      return typeof raw['code'] === 'string' && typeof raw['message'] === 'string';
    case 'done':
      return true;
    default:
      return false;
  }
}

function adaptOutputText(event: V1OutputText): StreamEventTextChunk | StreamEventError {
  const renderText = firstNonEmptyString(event.payload.text, event.payload.plain_text) ?? '';
  const plainText = firstNonEmptyString(event.payload.plain_text, event.payload.text) ?? renderText;
  if (event.payload.is_error) {
    return {
      type: 'error',
      code: 'BACKEND_ERROR',
      message: plainText || 'Backend returned an error',
    };
  }
  const result: StreamEventTextChunk = {
    type: 'text_chunk',
    content: renderText,
    final: true,
  };

  // Pass through product mentions for in-text linking
  const mentions = event.payload['product_mentions'];
  if (Array.isArray(mentions) && mentions.length > 0) {
    result.productMentions = mentions.filter(
      (m): m is { sku: string; short_name: string } =>
        typeof m === 'object' && m !== null && typeof m['sku'] === 'string' && typeof m['short_name'] === 'string',
    );
  }

  const skuMap = event.payload['sku_to_product_item'];
  if (skuMap && typeof skuMap === 'object' && !Array.isArray(skuMap)) {
    result.skuToProductItem = skuMap as Record<string, Record<string, unknown>>;
  }

  const convMode = event.payload['conversation_mode'];
  if (typeof convMode === 'string' && convMode) {
    result.conversationMode = convMode;
  }

  return result;
}

function adaptSuggestedActions(event: V1SuggestedActions): StreamEventUISpec {
  const entries = (event.payload.actions ?? []).map((action) => {
    const label = firstNonEmptyString(action.title) ?? '';
    const actionPayload = requestDetailsToAction(action.requestDetails, label);
    const result: ButtonEntry | null = actionPayload
      ? {
          label,
          action: actionPayload,
        }
      : null;
    if (!result) return null;
    if (typeof action.icon === 'string') result.icon = action.icon;
    if (typeof action.image === 'string') result.image = action.image;
    return result;
  });
  return buildActionButtonsUISpec(entries.filter(isNonNullable), 'chat');
}

function adaptProductList(event: V1ProductList): StreamEventUISpec {
  const spec = buildProductGridUISpec(event.payload.product_list ?? [], 'chat');
  spec.panelHint = 'panel';
  // Pass pagination fields and backend-provided title
  const root = spec.spec.elements[spec.spec.root];
  if (root) {
    if (typeof event.payload.offset === 'number') root.props = { ...root.props, offset: event.payload.offset };
    if (typeof event.payload.end_of_list === 'boolean')
      root.props = { ...root.props, endOfList: event.payload.end_of_list };
    if (typeof event.payload.title === 'string') root.props = { ...root.props, panelTitle: event.payload.title };
  }
  return spec;
}

function adaptProductDetails(event: V1ProductDetails): StreamEventUISpec {
  const product = event.payload.productDetails;
  if (!product) {
    return buildEmptyUISpec('chat');
  }
  const normalized = productToNormalized(product) as unknown as Record<string, unknown>;
  const detailProduct = {
    ...(product as unknown as Record<string, unknown>),
    ...normalized,
  };
  return {
    type: 'ui_spec',
    widget: 'chat',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'ProductDetailsPanel',
          props: { product: detailProduct },
        },
      },
    },
    panelHint: 'panel',
  };
}

function adaptProductDetailsSimilars(event: V1ProductDetailsSimilars): StreamEventUISpec {
  const base = buildProductGridUISpec(event.payload.similarProducts ?? [], 'chat');
  // Mark for panel append rather than replace
  const root = base.spec.elements[base.spec.root];
  if (root) root.props = { ...root.props, similarsAppend: true };
  return { ...base, panelHint: 'panel' };
}

function adaptComparisonTable(event: V1ComparisonTable): StreamEventUISpec {
  const products = event.payload.multiple_product_details ?? [];
  const payloadRecord = event.payload as Record<string, unknown>;
  const framework = {
    key_differences: payloadRecord['key_differences'],
    recommended_choice: payloadRecord['recommended_choice'],
    recommended_choice_sku: payloadRecord['recommended_choice_sku'],
    special_considerations: payloadRecord['special_considerations'],
    criteria_view: payloadRecord['criteria_view'],
    criteria_view_short: payloadRecord['criteria_view_short'],
    compared_field_names: payloadRecord['compared_field_names'],
    winner_product: payloadRecord['winner_product'],
    winner_hits: payloadRecord['winner_hits'],
    ...(event.payload.product_comparison_framework ?? {}),
  } as NonNullable<V1ComparisonTable['payload']['product_comparison_framework']>;
  const table = event.payload.table;
  const featuresList = event.payload.features_list;

  // Normalize products
  const normalizedProducts: Array<Record<string, unknown>> = [];
  for (const p of products) {
    const norm = productToNormalized(p);
    normalizedProducts.push(norm as unknown as Record<string, unknown>);
  }

  const attributes = buildComparisonAttributes(table, normalizedProducts, framework, featuresList);

  // Find recommended product
  let recommendedSku: string | undefined;
  if (framework?.recommended_choice_sku) {
    recommendedSku = framework.recommended_choice_sku;
  } else if (framework?.winner_product && framework.winner_product.length > 0) {
    // Legacy structure wraps sku in product_detail; fall back to flat sku
    recommendedSku = framework.winner_product[0]?.product_detail?.sku ?? framework.winner_product[0]?.sku;
  }

  // Find recommended product object
  const recommended = recommendedSku
    ? (normalizedProducts.find((p) => p['sku'] === recommendedSku) ?? normalizedProducts[0])
    : normalizedProducts[0];

  // Extract highlights (key differences)
  const highlights: string[] = [];
  if (Array.isArray(framework?.key_differences)) {
    for (const diff of framework.key_differences) {
      if (typeof diff === 'string') highlights.push(diff);
    }
  }

  // Extract special cases
  const specialCases = normalizeStringList(framework?.special_considerations);

  // Build recommended choice explanation
  const recommendedText = framework?.recommended_choice;

  // Build winner hits per product
  const winnerHits = framework?.winner_hits;

  // Build product actions for "View Product" buttons
  const productActions: Record<string, Record<string, unknown>> = {};
  for (const p of normalizedProducts) {
    const sku = p['sku'] as string;
    if (sku) {
      productActions[sku] = {
        title: (p['name'] as string) ?? sku,
        type: 'launchSingleProduct',
        payload: { sku },
      };
    }
  }

  const props: Record<string, unknown> = {
    products: normalizedProducts,
    attributes,
    highlights,
    productActions,
  };

  if (recommended) props['recommended'] = recommended;
  if (specialCases.length > 0) props['specialCases'] = specialCases;
  if (recommendedText) props['recommendedText'] = recommendedText;
  if (winnerHits) props['winnerHits'] = winnerHits;

  // key_differences may be a single HTML string — pass raw for formatted rendering
  if (typeof framework?.key_differences === 'string') {
    props['keyDifferencesHtml'] = framework.key_differences;
  }

  // Pass special_considerations as structured data
  if (framework?.special_considerations) {
    props['specialConsiderations'] = framework.special_considerations;
  }

  return {
    type: 'ui_spec',
    widget: 'chat',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'ComparisonTable',
          props,
        },
      },
    },
    panelHint: 'panel',
  };
}

function buildComparisonAttributes(
  table: V1ComparisonTable['payload']['table'],
  products: Array<Record<string, unknown>>,
  framework: NonNullable<V1ComparisonTable['payload']['product_comparison_framework']>,
  featuresList?: string[],
): Array<{ label: string; values: string[] }> {
  if (!table) return [];

  const entries = Object.entries(table);
  if (entries.length === 0) return [];

  const firstValue = entries[0]?.[1];
  if (Array.isArray(firstValue)) {
    const displayNames = framework.criteria_view ?? framework.criteria_view_short ?? {};
    const fieldOrder = framework.compared_field_names ?? Object.keys(table);
    const attributes: Array<{ label: string; values: string[] }> = [];
    for (const fieldName of fieldOrder) {
      const values = table[fieldName];
      if (!values || !Array.isArray(values)) continue;
      const label = displayNames[fieldName] ?? fieldName;
      attributes.push({ label, values: values.map((v) => (typeof v === 'string' ? v : String(v ?? ''))) });
    }
    return attributes;
  }

  const rowMap = table as Record<string, Record<string, unknown>>;
  const orderedSkus = products.map((product) => String(product['sku'] ?? '')).filter((sku) => sku.length > 0);
  const displayNames = framework.criteria_view ?? framework.criteria_view_short ?? {};
  const rawFieldOrder =
    featuresList && featuresList.length > 0
      ? featuresList
      : framework.compared_field_names && framework.compared_field_names.length > 0
        ? framework.compared_field_names
        : collectComparisonFields(rowMap);

  const fieldOrder = rawFieldOrder.filter(
    (field) => field !== 'name' && field !== 'name_short' && !field.endsWith('_short'),
  );
  const attributes: Array<{ label: string; values: string[] }> = [];

  for (const fieldName of fieldOrder) {
    const values = orderedSkus.map((sku) => {
      const row = rowMap[sku];
      if (!row || typeof row !== 'object') return '';
      const shortValue = row[`${fieldName}_short`];
      const longValue = row[fieldName];
      return stringifyComparisonValue(shortValue ?? longValue);
    });
    if (values.every((value) => value.length === 0)) continue;
    const label = displayNames[fieldName] ?? fieldName;
    attributes.push({ label, values });
  }

  return attributes;
}

function collectComparisonFields(rowMap: Record<string, Record<string, unknown>>): string[] {
  const fields: string[] = [];
  const seen = new Set<string>();
  for (const row of Object.values(rowMap)) {
    if (!row || typeof row !== 'object') continue;
    for (const key of Object.keys(row)) {
      if (seen.has(key)) continue;
      seen.add(key);
      fields.push(key);
    }
  }
  return fields;
}

function stringifyComparisonValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function adaptContext(event: V1Context): StreamEventMetadata {
  return {
    type: 'metadata',
    sessionId: '',
    model: '',
    meta: {
      panel: event.payload.panel,
      messages: event.payload.messages,
      message_id: event.payload.message_id,
    },
  };
}

function adaptChatStreamEnd(): StreamEventDone {
  return { type: 'done' };
}

function adaptLoading(event: V1Loading): StreamEventMetadata {
  return {
    type: 'metadata',
    sessionId: '',
    model: '',
    meta: {
      loading: true,
      loadingText: event.payload.text,
      thinkingMessages: event.payload.thinking_messages,
      dynamicLoading: event.payload.is_dynamic === true,
    },
  };
}

function adaptPanelLoading(event: V1PanelLoading): StreamEventMetadata {
  return {
    type: 'metadata',
    sessionId: '',
    model: '',
    meta: {
      loading: true,
      panelLoading: true,
      panelPendingType: event.payload?.pending_type,
      loadingText: event.payload?.text,
    },
  };
}

function adaptSimilarLoading(event: V1SimilarLoading): StreamEventMetadata {
  return {
    type: 'metadata',
    sessionId: '',
    model: '',
    meta: {
      loading: true,
      similarPanelLoading: true,
      panelPendingType: event.payload?.pending_type,
      loadingText: event.payload?.text,
    },
  };
}

function adaptRedirect(event: V1Redirect): StreamEventAction | StreamEventMetadata {
  const url = firstNonEmptyString(event.payload.url);
  if (url) {
    return {
      type: 'action',
      action: {
        kind: 'navigate',
        url,
        newTab: event.payload.new_tab === true,
      },
    };
  }

  return {
    type: 'metadata',
    sessionId: '',
    model: '',
    meta: {
      redirect: event.payload,
      redirectTarget: firstNonEmptyString(event.payload.to),
    },
  };
}

function adaptV1Error(event: V1Error): StreamEventError {
  const message =
    firstNonEmptyString(event.payload?.text, event.payload?.message, event.payload?.error) ??
    'Backend returned an error';
  return {
    type: 'error',
    code: 'BACKEND_ERROR',
    message,
  };
}

function adaptNoop(_event: V1Noop): StreamEventMetadata {
  return {
    type: 'metadata',
    sessionId: '',
    model: '',
    meta: {
      noop: true,
    },
  };
}

function adaptLauncherAction(event: V1LauncherAction): StreamEvent {
  const payload = event.payload ?? {};

  const hasActionList = Array.isArray(payload['action_list']);
  if (hasActionList) {
    const quickQnaPayload: V1LauncherQuickQna['payload'] = {
      action_list: payload['action_list'] as V1SuggestedActionItem[],
    };
    const launcherType = typeof payload['type'] === 'string' ? payload['type'] : undefined;
    const theme = typeof payload['theme'] === 'string' ? payload['theme'] : undefined;
    if (launcherType !== undefined) quickQnaPayload.type = launcherType;
    if (theme !== undefined) quickQnaPayload.theme = theme;

    return adaptLauncherQuickQna({
      type: 'quick_qna',
      payload: quickQnaPayload,
    });
  }

  const action = asRecord(payload['action']);
  if (action) {
    const textImagePayload: V1LauncherTextImage['payload'] = {
      action,
    };
    const text = typeof payload['text'] === 'string' ? payload['text'] : undefined;
    const imageUrl = typeof payload['image_url'] === 'string' ? payload['image_url'] : undefined;
    const theme = typeof payload['theme'] === 'string' ? payload['theme'] : undefined;
    if (text !== undefined) textImagePayload.text = text;
    if (imageUrl !== undefined) textImagePayload.image_url = imageUrl;
    if (theme !== undefined) textImagePayload.theme = theme;

    return adaptLauncherTextImage({
      type: 'text_image',
      payload: textImagePayload,
    });
  }

  const text = typeof payload['text'] === 'string' ? payload['text'] : '';
  if (text) {
    const launcherTextPayload: V1LauncherText['payload'] = { text };
    const launcherType = typeof payload['type'] === 'string' ? payload['type'] : undefined;
    const theme = typeof payload['theme'] === 'string' ? payload['theme'] : undefined;
    const payloadObj = asRecord(payload['payload']) ?? undefined;
    if (launcherType !== undefined) launcherTextPayload.type = launcherType;
    if (payloadObj !== undefined) launcherTextPayload.payload = payloadObj;
    if (theme !== undefined) launcherTextPayload.theme = theme;

    return adaptLauncherText({
      type: 'text',
      payload: launcherTextPayload,
    });
  }

  return {
    type: 'metadata',
    sessionId: '',
    model: '',
    meta: {
      launcherAction: payload,
    },
  };
}

function adaptLauncherText(event: V1LauncherText): StreamEventUISpec {
  const props: Record<string, unknown> = {
    text: firstNonEmptyString(event.payload.text) ?? '',
  };
  if (typeof event.payload.theme === 'string') props['theme'] = event.payload.theme;
  if (event.payload.payload !== undefined) props['payload'] = event.payload.payload;

  return {
    type: 'ui_spec',
    widget: 'qna',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'QuestionHeading',
          props,
        },
      },
    },
  };
}

function adaptProductItem(event: V1ProductItem): StreamEventUISpec {
  return buildSingleProductUISpec(event.payload, 'qna');
}

function adaptLauncherTextImage(event: V1LauncherTextImage): StreamEventUISpec {
  const label = firstNonEmptyString(event.payload.text) ?? '';
  const action = requestDetailsToAction(event.payload.action, label);
  if (action) {
    const props: Record<string, unknown> = {
      label: label || action.title,
      action,
    };
    if (typeof event.payload.image_url === 'string') props['image'] = event.payload.image_url;
    if (typeof event.payload.theme === 'string') props['theme'] = event.payload.theme;

    return {
      type: 'ui_spec',
      widget: 'qna',
      spec: {
        root: 'root',
        elements: {
          root: {
            type: 'ActionButton',
            props,
          },
        },
      },
    };
  }

  const fallbackPayload: V1LauncherText['payload'] = {
    text: label,
  };
  if (typeof event.payload.theme === 'string') fallbackPayload.theme = event.payload.theme;

  return adaptLauncherText({
    type: 'text',
    payload: fallbackPayload,
  });
}

function adaptLauncherQuickQna(event: V1LauncherQuickQna): StreamEventUISpec {
  const entries = (event.payload.action_list ?? []).map((action) => {
    const label = firstNonEmptyString(action.title) ?? '';
    const actionPayload = requestDetailsToAction(action.requestDetails, label);
    const result: ButtonEntry | null = actionPayload
      ? {
          label,
          action: actionPayload,
        }
      : null;
    if (!result) return null;
    if (typeof action.icon === 'string') result.icon = action.icon;
    if (typeof action.image === 'string') result.image = action.image;
    return result;
  });

  return buildActionButtonsUISpec(entries.filter(isNonNullable), 'qna');
}

function adaptReviewHighlights(event: V1ReviewHighlights): StreamEventUISpec {
  const reviews = (event.payload.reviews ?? []).map((item) => {
    const review: Record<string, unknown> = {};
    if (typeof item.review_class === 'string') review['review_class'] = item.review_class;
    if (typeof item.review_text === 'string') review['review_text'] = item.review_text;
    if (typeof item.review_rating === 'string' || typeof item.review_rating === 'number') {
      review['review_rating'] = item.review_rating;
    }
    if (typeof item.review_tag === 'string') review['review_tag'] = item.review_tag;
    return review;
  });

  const props: Record<string, unknown> = { reviews };
  if (typeof event.payload.sku === 'string') props['sku'] = event.payload.sku;

  return {
    type: 'ui_spec',
    widget: 'chat',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'ReviewHighlights',
          props,
        },
      },
    },
  };
}

function adaptProsAndCons(event: V1ProsAndCons): StreamEventUISpec {
  const props: Record<string, unknown> = {};
  if (Array.isArray(event.payload.pros)) props['pros'] = event.payload.pros;
  if (Array.isArray(event.payload.cons)) props['cons'] = event.payload.cons;
  if (typeof event.payload.product_name === 'string') props['productName'] = event.payload.product_name;

  return {
    type: 'ui_spec',
    widget: 'chat',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'ProsAndCons',
          props,
        },
      },
    },
  };
}

function adaptVisitorDataResponse(event: V1VisitorDataResponse): StreamEventMetadata {
  return {
    type: 'metadata',
    sessionId: '',
    model: '',
    meta: {
      visitorDataResponse: event.payload,
    },
  };
}

function adaptAiProductSuggestions(event: V1AiProductSuggestions): StreamEventUISpec | StreamEventMetadata {
  const suggestions = event.payload.product_suggestions ?? [];
  const items: Record<string, unknown>[] = [];

  for (let i = 0; i < suggestions.length; i++) {
    const suggestion = suggestions[i];
    if (!suggestion) continue;

    const product = suggestionToNormalizedProduct(suggestion);
    if (!product) continue;

    const item: Record<string, unknown> = { product };

    const action = requestDetailsToAction(suggestion.requestDetails, product.name);
    if (action) item['action'] = action;
    if (typeof suggestion.role === 'string') item['role'] = suggestion.role;
    if (typeof suggestion.reason === 'string') item['reason'] = suggestion.reason;
    if (typeof suggestion.review_highlight === 'string') item['reviewHighlight'] = suggestion.review_highlight;
    if (Array.isArray(suggestion.labels)) item['labels'] = suggestion.labels;
    if (typeof suggestion.expert_quality_score === 'number')
      item['expertQualityScore'] = suggestion.expert_quality_score;

    items.push(item);
  }

  if (items.length === 0) {
    return {
      type: 'metadata',
      sessionId: '',
      model: '',
      meta: {
        aiProductSuggestions: event.payload.product_suggestions ?? [],
      },
    };
  }

  return {
    type: 'ui_spec',
    widget: 'chat',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'AITopPicks',
          props: { suggestions: items },
        },
      },
    },
  };
}

function adaptAiProductGroupings(event: V1AiProductGroupings): StreamEventUISpec | StreamEventMetadata {
  const payloadGroupings = event.payload.product_groupings ?? [];
  const entries: Array<Record<string, unknown>> = [];

  for (let i = 0; i < payloadGroupings.length; i++) {
    const grouping = payloadGroupings[i];
    if (!grouping) continue;
    const label = firstNonEmptyString(grouping.name) ?? '';
    const fallbackRequest: V1RequestDetails | undefined =
      grouping.sku && grouping.sku.length > 0 ? { type: 'findSimilar', payload: { sku: grouping.sku } } : undefined;
    const action = requestDetailsToAction(grouping.requestDetails ?? fallbackRequest, label);
    if (!action) continue;

    const entry: Record<string, unknown> = { name: label, action };
    if (Array.isArray(grouping.labels)) {
      const filteredLabels = grouping.labels.filter((x) => typeof x === 'string');
      if (filteredLabels.length > 0) entry['labels'] = filteredLabels;
    }
    if (typeof grouping.image === 'string') entry['image'] = grouping.image;
    entries.push(entry);
  }

  if (entries.length === 0) {
    return {
      type: 'metadata',
      sessionId: '',
      model: '',
      meta: {
        aiProductGroupings: event.payload.product_groupings ?? [],
      },
    };
  }

  return {
    type: 'ui_spec',
    widget: 'chat',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'AIGroupingCards',
          props: { entries },
        },
      },
    },
  };
}

function adaptAiSuggestedSearches(event: V1AiSuggestedSearches): StreamEventUISpec | StreamEventMetadata {
  const searches = event.payload.suggested_searches ?? [];
  const entries: Array<Record<string, unknown>> = [];

  for (let i = 0; i < searches.length; i++) {
    const search = searches[i];
    if (!search) continue;

    const shortName =
      firstNonEmptyString(search.short_name, search.chosen_attribute, search.detailed_user_message) ??
      `Search ${i + 1}`;
    const fallbackPayload: Record<string, unknown> = {};
    const text = firstNonEmptyString(search.detailed_user_message);
    if (text) fallbackPayload['text'] = text;
    const requestDetailsRecord = asRecord(search.requestDetails);
    const requestPayload = asRecord(requestDetailsRecord?.['payload']);
    const requestGroupSkus = requestPayload?.['group_skus'];
    if (search.group_skus && Array.isArray(search.group_skus)) {
      fallbackPayload['group_skus'] = search.group_skus;
    } else if (Array.isArray(requestGroupSkus)) {
      fallbackPayload['group_skus'] = requestGroupSkus.filter((sku): sku is string => typeof sku === 'string');
    }
    const sku = firstNonEmptyString(search.sku, search.representative_product_sku, requestPayload?.['sku']);
    if (sku) fallbackPayload['sku'] = sku;
    fallbackPayload['is_suggested_text'] = 1;

    const fallbackRequest: V1RequestDetails = { type: 'inputText', payload: fallbackPayload };
    const requestedAction = requestDetailsToAction(search.requestDetails, shortName);
    const action =
      requestedAction?.type === 'findSimilar' && typeof fallbackPayload['text'] === 'string'
        ? requestDetailsToAction(fallbackRequest, shortName)
        : (requestedAction ?? requestDetailsToAction(fallbackRequest, shortName));
    if (!action) continue;

    const entry: Record<string, unknown> = { shortName, action };
    const detailedMessage = firstNonEmptyString(search.detailed_user_message);
    if (detailedMessage && detailedMessage !== shortName) entry['detailedMessage'] = detailedMessage;
    const keywordLine = getSuggestedSearchKeywordsText(search);
    if (keywordLine) {
      const dm = detailedMessage ?? '';
      if (keywordLine !== shortName && keywordLine !== dm) {
        entry['whyDifferent'] = keywordLine;
      }
    }
    if (typeof search.image === 'string') entry['image'] = search.image;
    entries.push(entry);
  }

  if (entries.length === 0) {
    return {
      type: 'metadata',
      sessionId: '',
      model: '',
      meta: {
        aiSuggestedSearches: event.payload.suggested_searches ?? [],
      },
    };
  }

  return {
    type: 'ui_spec',
    widget: 'chat',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'AISuggestedSearchCards',
          props: { entries },
        },
      },
    },
  };
}

function adaptGetGroundingReview(event: V1GetGroundingReview): StreamEventUISpec | StreamEventMetadata {
  const p = event.payload;
  const requestDetails = p.requestDetails ?? p['request_details'];
  const action = requestDetailsToAction(
    requestDetails,
    firstNonEmptyString(p.review_count, p['reviewCount'], p.text, p.title) ?? 'Show product reviews',
  );
  if (!action) {
    return {
      type: 'metadata',
      sessionId: '',
      model: '',
      meta: {
        groundingReview: p,
      },
    };
  }

  const props: Record<string, unknown> = { action };
  if (p.title) props['title'] = p.title;
  if (p.text) props['text'] = p.text;
  if (p.review_count) props['reviewCount'] = p.review_count;
  else if (typeof p['reviewCount'] === 'string' && p['reviewCount'].trim()) props['reviewCount'] = p['reviewCount'];

  return {
    type: 'ui_spec',
    widget: 'chat',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'GroundingReviewCard',
          props,
        },
      },
    },
  };
}

function adaptProductListPreview(): StreamEventMetadata {
  return {
    type: 'metadata',
    sessionId: '',
    model: '',
    meta: {
      analyzeAnimation: true,
    },
  };
}

function adaptVoice(event: V1Voice): StreamEventMetadata {
  return {
    type: 'metadata',
    sessionId: '',
    model: '',
    meta: {
      voice: event.payload,
    },
  };
}

function adaptGroupList(event: V1GroupList): StreamEventUISpec {
  const groupList = event.payload.group_list ?? [];
  const groups: Array<{ groupName: string; products: NormalizedProduct[] }> = [];

  for (const group of groupList) {
    const groupName = group.group_name ?? '';
    const products = (group.product_list ?? []).map(productToNormalized);
    groups.push({ groupName, products });
  }

  const filterTags: Array<{ title: string; action?: { title: string; type: string; payload?: unknown } }> = [];
  for (const tag of event.payload.filter_tags ?? []) {
    const title = tag.title ?? '';
    if (!title) continue;
    const action = requestDetailsToAction(tag.requestDetails, title);
    const entry: (typeof filterTags)[number] = { title };
    if (action) entry.action = action;
    filterTags.push(entry);
  }

  return {
    type: 'ui_spec',
    widget: 'chat',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'CategoriesContainer',
          props: { groups, filterTags },
        },
      },
    },
    panelHint: 'panel',
  };
}

function adaptFormEvent(event: V1FormEvent): StreamEventMetadata {
  return {
    type: 'metadata',
    sessionId: '',
    model: '',
    meta: {
      formType: event.type,
      formPayload: event.payload ?? {},
    },
  };
}

function adaptHandoff(event: V1Handoff): StreamEventUISpec {
  const props: Record<string, unknown> = {};
  if (typeof event.payload?.summary === 'string') props['summary'] = event.payload.summary;
  if (Array.isArray(event.payload?.products_discussed)) {
    props['products_discussed'] = event.payload.products_discussed;
  }
  if (typeof event.payload?.user_sentiment === 'string') {
    props['user_sentiment'] = event.payload.user_sentiment;
  }

  return {
    type: 'ui_spec',
    widget: 'chat',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'HandoffNotice',
          props,
        },
      },
    },
  };
}

function adaptLauncherContent(event: V1LauncherContent): StreamEventMetadata {
  return {
    type: 'metadata',
    sessionId: '',
    model: '',
    meta: {
      launcherContent: event.payload ?? {},
    },
  };
}

interface ButtonEntry {
  label: string;
  action: { title: string; type: string; payload?: unknown };
  icon?: string;
  image?: string;
  description?: string;
}

function buildActionButtonsUISpec(entries: ButtonEntry[], widget: WidgetName): StreamEventUISpec {
  const elements: Record<string, UIElement> = {};
  const childIds: string[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;
    const id = `action-${i}`;
    childIds.push(id);
    const props: Record<string, unknown> = {
      label: entry.label,
      action: entry.action,
    };
    if (entry.icon !== undefined) props['icon'] = entry.icon;
    if (entry.image !== undefined) props['image'] = entry.image;
    if (entry.description !== undefined) props['description'] = entry.description;

    elements[id] = {
      type: 'ActionButton',
      props,
    };
  }

  elements['root'] = {
    type: 'ActionButtons',
    props: {
      buttons: entries.map((entry) => {
        const btn: Record<string, unknown> = {
          label: entry.label,
          action: entry.action,
        };
        if (entry.image !== undefined) btn['image'] = entry.image;
        if (entry.description !== undefined) btn['description'] = entry.description;
        if (entry.icon !== undefined) btn['icon'] = entry.icon;
        return btn;
      }),
    },
    children: childIds,
  };

  return {
    type: 'ui_spec',
    widget,
    spec: { root: 'root', elements },
  };
}

function buildProductGridUISpec(products: V1Product[], widget: WidgetName): StreamEventUISpec {
  const elements: Record<string, UIElement> = {};
  const childIds: string[] = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    if (!product) continue;
    const normalized = productToNormalized(product);
    const id = `product-${i}`;
    childIds.push(id);
    const props: Record<string, unknown> = { product: normalized, index: i };
    if (normalized.sku) {
      props['action'] = {
        title: normalized.name,
        type: 'launchSingleProduct',
        payload: { sku: normalized.sku },
      };
    }
    elements[id] = {
      type: 'ProductCard',
      props,
    };
  }

  elements['root'] = {
    type: 'ProductGrid',
    props: { layout: 'grid' },
    children: childIds,
  };

  return {
    type: 'ui_spec',
    widget,
    spec: { root: 'root', elements },
  };
}

function buildSingleProductUISpec(product: V1Product, widget: WidgetName): StreamEventUISpec {
  return {
    type: 'ui_spec',
    widget,
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'ProductCard',
          props: { product: productToNormalized(product), index: 0 },
        },
      },
    },
  };
}

function buildEmptyUISpec(widget: WidgetName): StreamEventUISpec {
  return {
    type: 'ui_spec',
    widget,
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'ActionButtons',
          props: { buttons: [] },
          children: [],
        },
      },
    },
  };
}

function suggestionToNormalizedProduct(suggestion: V1AiProductSuggestion): NormalizedProduct | null {
  const fallbackSku = firstNonEmptyString(suggestion.sku);
  const fallbackName = firstNonEmptyString(suggestion.short_name);
  const inner = asRecord(suggestion.product_item);
  const base = inner ?? (suggestion as Record<string, unknown>);
  const merged: Record<string, unknown> = { ...base };
  const fromSuggestionRoot = firstNonEmptyString(suggestion.discount_reason, suggestion['discountReason']);
  if (
    fromSuggestionRoot &&
    !firstNonEmptyString(merged['discount_reason'] as unknown, merged['discountReason'] as unknown)
  ) {
    merged['discount_reason'] = fromSuggestionRoot;
  }
  return productRecordToNormalized(merged, fallbackSku, fallbackName);
}

function productRecordToNormalized(
  raw: Record<string, unknown>,
  fallbackSku?: string,
  fallbackName?: string,
): NormalizedProduct | null {
  const sku = firstNonEmptyString(raw['sku'], fallbackSku);
  const name = firstNonEmptyString(raw['name'], fallbackName);
  if (!sku || !name) return null;

  const product: V1Product = {
    sku,
    name,
  };

  const brand = firstNonEmptyString(raw['brand']);
  if (brand) product.brand = brand;

  const url = firstNonEmptyString(raw['url']);
  if (url) product.url = url;

  const images = stringArray(raw['images']);
  if (images.length > 0) {
    product.images = images;
  } else {
    const image = firstNonEmptyString(raw['image'], raw['image_url'], raw['imageUrl']);
    if (image) product.images = [image];
  }

  const priceDiscounted = toNumber(raw['price_discounted']);
  if (priceDiscounted !== undefined) product.price_discounted = priceDiscounted;
  const price = toNumber(raw['price']);
  if (price !== undefined) product.price = price;
  const rating = toNumber(raw['rating']);
  if (rating !== undefined) product.rating = rating;
  const reviewCount = toNumber(raw['review_count']) ?? toNumber(raw['reviewCount']);
  if (reviewCount !== undefined) product.review_count = reviewCount;
  const cartCode = firstNonEmptyString(raw['cart_code'], raw['cartCode']);
  if (cartCode) product.cart_code = cartCode;
  if (typeof raw['in_stock'] === 'boolean') product.in_stock = raw['in_stock'];
  if (typeof raw['inStock'] === 'boolean') product.in_stock = raw['inStock'];

  const discountReason = firstNonEmptyString(raw['discount_reason'], raw['discountReason']);
  if (discountReason) product.discount_reason = discountReason;

  return productToNormalized(product);
}

function requestDetailsToAction(
  requestDetails: unknown,
  label: string,
): { title: string; type: string; payload?: unknown } | null {
  const details = asRecord(requestDetails);
  if (!details) return null;

  const type = details['type'];
  if (typeof type !== 'string' || type.length === 0) return null;

  const action: { title: string; type: string; payload?: unknown } = {
    title: label || type,
    type,
  };
  if (details['payload'] !== undefined) action.payload = details['payload'];
  return action;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function firstNonEmptyString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return undefined;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function normalizeStringList(value: unknown): string[] {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    // Handle Turkish number format: "1.299,99" → "1299.99"
    // If the string contains both '.' and ',', treat '.' as thousands separator and ',' as decimal
    let normalized: string;
    if (value.includes('.') && value.includes(',')) {
      normalized = value.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = value.replace(',', '.');
    }
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function isNonNullable<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export interface NormalizedProduct {
  sku: string;
  name: string;
  imageUrl?: string;
  images?: string[];
  price?: string;
  originalPrice?: string;
  discountPercent?: number;
  url: string;
  brand?: string;
  rating?: number;
  reviewCount?: number;
  cartCode?: string;
  inStock?: boolean;
  variants?: Array<Record<string, unknown>>;
  discountReason?: string;
  promotions?: string[];
  description?: string;
  descriptionHtml?: string;
  features?: Array<{ name?: string; key?: string; value?: string | number | boolean; [key: string]: unknown }>;
  specifications?: Record<string, string> | Array<{ key: string; value: string }>;
  facetHits?: Record<string, unknown>;
  shortName?: string;
  /** Pass-through bag for backend fields not consumed by the SDK. */
  extras?: Record<string, unknown>;
}

/** V1 product keys consumed by productToNormalized — hoisted to avoid per-call Set allocation. */
const KNOWN_V1_PRODUCT_KEYS: ReadonlySet<string> = new Set([
  'sku',
  'name',
  'brand',
  'images',
  'price',
  'price_discounted',
  'price_discount_rate',
  'price_currency',
  'discount_reason',
  'url',
  'rating',
  'review_count',
  'cart_code',
  'in_stock',
  'description',
  'description_html',
  'features',
  'specifications',
  'facet_tags',
  'short_name',
  'category_ids',
  'category_names',
  'variants',
  'facet_hits',
  'promotions',
]);

export function productToNormalized(p: V1Product): NormalizedProduct {
  const hasDiscount = p.price_discounted != null && p.price_discounted > 0;
  const price = hasDiscount ? p.price_discounted : p.price;
  const originalPrice = hasDiscount && p.price != null ? p.price : undefined;

  let discountPercent: number | undefined;
  if (originalPrice != null && price != null && originalPrice > 0) {
    discountPercent = Math.round(((originalPrice - price) / originalPrice) * 100);
  } else if (p.price_discount_rate != null && p.price_discount_rate > 0) {
    discountPercent = p.price_discount_rate;
  }

  const brand = firstNonEmptyString(p.brand);
  const name = firstNonEmptyString(p.name) ?? p.sku;
  const normalizedName = brand && !name.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${name}` : name;

  const result: NormalizedProduct = {
    sku: p.sku,
    name: normalizedName,
    url: firstNonEmptyString(p.url) ?? '',
  };

  const image = p.images?.[0];
  if (image) result.imageUrl = image;
  if (p.images && p.images.length > 1) result.images = p.images;
  if (price != null) result.price = String(price);
  if (originalPrice != null) result.originalPrice = String(originalPrice);
  if (discountPercent !== undefined) result.discountPercent = discountPercent;
  if (brand !== undefined) result.brand = brand;
  if (p.rating !== undefined) result.rating = p.rating;
  if (p.review_count !== undefined) result.reviewCount = p.review_count;
  if (p.cart_code !== undefined) result.cartCode = p.cart_code;
  if (p.in_stock !== undefined) result.inStock = p.in_stock;
  if (p.variants && p.variants.length > 0) result.variants = p.variants;
  if (p.discount_reason !== undefined) result.discountReason = p.discount_reason;
  if (p.promotions && p.promotions.length > 0) result.promotions = p.promotions;
  if (p.description !== undefined) result.description = p.description;
  if (p.description_html !== undefined) result.descriptionHtml = p.description_html;
  if (p.features && p.features.length > 0) result.features = p.features;
  if (p.specifications !== undefined) result.specifications = p.specifications;
  if (p.facet_hits) result.facetHits = p.facet_hits;
  if (p.short_name !== undefined) result.shortName = p.short_name;

  // Collect any extra backend fields not consumed above.
  const raw = p as unknown as Record<string, unknown>;
  const extras: Record<string, unknown> = {};
  let hasExtras = false;
  for (const key of Object.keys(raw)) {
    if (!KNOWN_V1_PRODUCT_KEYS.has(key)) {
      extras[key] = raw[key];
      hasExtras = true;
    }
  }
  if (hasExtras) result.extras = extras;

  return result;
}

export interface SimilarProductsJsonResponse {
  results: V1Product[];
  count: number;
  source_sku?: string;
}

export interface ProductGroupingsJsonResponse {
  intro_message?: string;
  product_groupings: Array<{
    name: string;
    description?: string;
    highlight?: string;
    repr_sku?: string;
    repr_image?: string;
    group_skus?: string[];
    group_products?: V1Product[];
  }>;
  count: number;
}

export function normalizeSimilarProductsResponse(json: SimilarProductsJsonResponse): NormalizedProduct[] {
  return json.results.map(productToNormalized);
}

export function normalizeProductGroupingsResponse(json: ProductGroupingsJsonResponse): Array<{
  name: string;
  highlight?: string;
  products: NormalizedProduct[];
}> {
  return json.product_groupings.map((group) => {
    const result: { name: string; highlight?: string; products: NormalizedProduct[] } = {
      name: group.name,
      products: (group.group_products ?? []).map(productToNormalized),
    };
    if (group.highlight !== undefined) result.highlight = group.highlight;
    return result;
  });
}

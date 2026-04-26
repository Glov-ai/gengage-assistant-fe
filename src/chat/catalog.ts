/**
 * Chat widget — json-render catalog definition.
 *
 * This catalog describes all UI components the chat widget understands.
 * The backend streams `ui_spec` events whose element types must match names
 * defined here. Component implementations live in ./registry.tsx.
 *
 * HOW IT WORKS:
 *   1. Backend streams NDJSON events including `ui_spec` events.
 *   2. Each `ui_spec` event contains a `spec: UISpec` field.
 *   3. The `<ChatRenderer>` component feeds specs into json-render's `<Renderer>`.
 *   4. json-render looks up the element `type` in the registry and renders it.
 *
 * CUSTOMISING:
 *   Fork this repo, edit ./registry.tsx to swap in your own components.
 *   The catalog schema below stays the same — only the visual implementation changes.
 *
 * See: https://github.com/vercel-labs/json-render
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Component schemas (Zod)
// ---------------------------------------------------------------------------

export const MessageBubbleSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.number().optional(),
});

export const ProductCardSchema = z.object({
  sku: z.string(),
  name: z.string(),
  imageUrl: z.string().url().optional(),
  price: z.string().optional(),
  originalPrice: z.string().optional(),
  url: z.string().url(),
  /** Override CTA label (default: "View product") */
  ctaLabel: z.string().optional(),
});

export const ActionButtonsSchema = z.object({
  buttons: z.array(
    z.object({
      label: z.string(),
      /** Opaque action payload forwarded to the backend when clicked. */
      action: z.object({
        title: z.string(),
        type: z.string(),
        payload: z.unknown().optional(),
      }),
    }),
  ),
});

export const TypingIndicatorSchema = z.object({});

export const DividerSchema = z.object({
  label: z.string().optional(),
});

const ComparisonProductSchema = z.object({
  sku: z.string(),
  name: z.string(),
  price: z.string(),
  imageUrl: z.string().optional(),
  rating: z.number().optional(),
  reviewCount: z.number().optional(),
});

export const ComparisonTableSchema = z.object({
  recommended: ComparisonProductSchema,
  products: z.array(ComparisonProductSchema),
  attributes: z.array(
    z.object({
      label: z.string(),
      values: z.array(z.string()),
    }),
  ),
  highlights: z.array(z.string()),
  specialCases: z.array(z.string()).optional(),
  recommendedText: z.string().optional(),
  winnerHits: z
    .record(
      z.string(),
      z.object({
        positive: z.array(z.string()).optional(),
        negative: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  productActions: z
    .record(
      z.string(),
      z.object({
        title: z.string(),
        type: z.string(),
        payload: z.unknown().optional(),
      }),
    )
    .optional(),
});

export const SentimentLabelSchema = z.object({
  label: z.string(),
  sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
});

export const AITopPickItemSchema = z.object({
  product: z.record(z.string(), z.unknown()),
  role: z.string().optional(),
  reason: z.string().optional(),
  labels: z.array(SentimentLabelSchema).optional(),
  expertQualityScore: z.number().optional(),
  reviewHighlight: z.string().optional(),
  action: z
    .object({
      title: z.string(),
      type: z.string(),
      payload: z.unknown().optional(),
    })
    .optional(),
});

export const AITopPicksSchema = z.object({
  suggestions: z.array(AITopPickItemSchema),
});

export const GroundingReviewCardSchema = z.object({
  title: z.string().optional(),
  text: z.string().optional(),
  reviewCount: z.string().optional(),
  action: z.object({ title: z.string(), type: z.string(), payload: z.unknown().optional() }),
});

export const AIGroupingCardsSchema = z.object({
  entries: z.array(
    z.object({
      name: z.string(),
      image: z.string().optional(),
      description: z.string().optional(),
      action: z.object({ title: z.string(), type: z.string(), payload: z.unknown().optional() }),
    }),
  ),
});

export const AISuggestedSearchCardsSchema = z.object({
  entries: z.array(
    z.object({
      shortName: z.string(),
      detailedMessage: z.string().optional(),
      whyDifferent: z.string().optional(),
      image: z.string().optional(),
      action: z.object({ title: z.string(), type: z.string(), payload: z.unknown().optional() }),
    }),
  ),
});

const ActionPayloadSchema = z.object({
  title: z.string(),
  type: z.string(),
  payload: z.unknown().optional(),
});

const ProductVariantSchema = z.object({
  name: z.string().optional(),
  value: z.string().optional(),
  option_value: z.string().optional(),
  attribute_value: z.string().optional(),
  type: z.string().optional(),
  attribute: z.string().optional(),
  option_name: z.string().optional(),
  attribute_name: z.string().optional(),
  variant_name: z.string().optional(),
  sku: z.string().optional(),
  price: z.union([z.number(), z.string()]).optional(),
  price_discounted: z.union([z.number(), z.string()]).optional(),
  image: z.string().optional(),
  imageUrl: z.string().optional(),
  image_url: z.string().optional(),
  color: z.string().optional(),
  colour: z.string().optional(),
  color_hex: z.string().optional(),
  hex: z.string().optional(),
  swatch: z.string().optional(),
  swatchColor: z.string().optional(),
  in_stock: z.boolean().optional(),
  inStock: z.boolean().optional(),
});

export const ProductDetailsPanelSchema = z.object({
  product: z
    .object({
      sku: z.string().optional(),
      name: z.string().optional(),
      images: z.array(z.string()).optional(),
      imageUrl: z.string().optional(),
      rating: z.number().optional(),
      reviewCount: z.number().optional(),
      price: z.string().optional(),
      originalPrice: z.string().optional(),
      discountReason: z.string().optional(),
      discount_reason: z.string().optional(),
      campaignReason: z.string().optional(),
      campaign_reason: z.string().optional(),
      originalPriceStyle: z.enum(['strikethrough', 'inline']).optional(),
      price_original_style: z.enum(['strikethrough', 'inline']).optional(),
      price_discount_rate: z.number().optional(),
      price_async: z.boolean().optional(),
      inStock: z.boolean().optional(),
      promotions: z.array(z.string()).optional(),
      variants: z.array(ProductVariantSchema).optional(),
      variantOptions: z.array(ProductVariantSchema).optional(),
      variant_options: z.array(ProductVariantSchema).optional(),
      productVariants: z.array(ProductVariantSchema).optional(),
      product_variants: z.array(ProductVariantSchema).optional(),
      url: z.string().optional(),
      cartCode: z.string().optional(),
      description: z.string().optional(),
      description_html: z.string().optional(),
      descriptionHtml: z.string().optional(),
      facet_hits: z.record(z.string(), z.unknown()).optional(),
      facetHits: z.record(z.string(), z.unknown()).optional(),
      features: z
        .array(
          z.object({
            name: z.string().optional(),
            key: z.string().optional(),
            label: z.string().optional(),
            value: z.union([z.string(), z.number(), z.boolean()]).optional(),
          }),
        )
        .optional(),
      specifications: z
        .union([z.record(z.string(), z.string()), z.array(z.object({ key: z.string(), value: z.string() }))])
        .optional(),
    })
    .optional(),
  action: ActionPayloadSchema.optional(),
});

export const ProductGridSchema = z.object({
  endOfList: z.boolean().optional(),
});

const ReviewItemSchema = z.object({
  review_class: z.string().optional(),
  review_text: z.string().optional(),
  review_rating: z.union([z.string(), z.number()]).optional(),
  review_tag: z.string().optional(),
});

export const ReviewHighlightsSchema = z.object({
  reviews: z.array(ReviewItemSchema).optional(),
});

export const ProsAndConsSchema = z.object({
  productName: z.string().optional(),
  pros: z.array(z.string()).optional(),
  cons: z.array(z.string()).optional(),
});

export const CategoriesContainerSchema = z.object({
  groups: z
    .array(
      z.object({
        groupName: z.string(),
        image: z.string().optional(),
        products: z.array(z.record(z.string(), z.unknown())).optional(),
      }),
    )
    .optional(),
  filterTags: z
    .array(
      z.object({
        title: z.string(),
        action: ActionPayloadSchema.optional(),
      }),
    )
    .optional(),
});

export const HandoffNoticeSchema = z.object({
  summary: z.string().optional(),
  products_discussed: z.array(z.string()).optional(),
  user_sentiment: z.string().optional(),
});

export const PhotoAnalysisCardSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()).optional(),
  focus_points: z.array(z.string()).optional(),
  celeb_style: z.string().optional(),
  celeb_style_reason: z.string().optional(),
  next_question: z.string().optional(),
  style_images: z.array(z.string()).optional(),
});

export const BeautyPhotoStepSchema = z.object({
  processing: z.boolean().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  upload_label: z.string().optional(),
  skip_label: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Catalog definition
//
// When @json-render/core ships a stable defineCatalog() API, replace this
// plain object with the official defineCatalog() call. For now the schema
// map acts as both documentation and runtime validation.
// ---------------------------------------------------------------------------

export const chatCatalog = {
  components: {
    MessageBubble: {
      schema: MessageBubbleSchema,
      description: 'A single chat message bubble for user or assistant turns.',
    },
    ProductCard: {
      schema: ProductCardSchema,
      description: 'A product card rendered inline in the chat stream.',
    },
    ActionButtons: {
      schema: ActionButtonsSchema,
      description: 'A horizontal row of quick-reply action buttons.',
    },
    TypingIndicator: {
      schema: TypingIndicatorSchema,
      description: 'An animated indicator shown while the assistant is typing.',
    },
    Divider: {
      schema: DividerSchema,
      description: 'A horizontal rule with an optional label.',
    },
    ComparisonTable: {
      schema: ComparisonTableSchema,
      description: 'A product comparison table with recommended pick, attribute rows, and highlights.',
    },
    AITopPicks: {
      schema: AITopPicksSchema,
      description: 'Rich AI-curated product suggestion cards with roles, sentiment labels, scores, and review quotes.',
    },
    GroundingReviewCard: {
      schema: GroundingReviewCardSchema,
      description: 'A card showing review grounding data with review count and CTA.',
    },
    AIGroupingCards: {
      schema: AIGroupingCardsSchema,
      description: 'Category grouping cards with images and labels for product discovery.',
    },
    AISuggestedSearchCards: {
      schema: AISuggestedSearchCardsSchema,
      description: 'Suggested search cards with images, descriptions, and differentiation.',
    },
    ProductDetailsPanel: {
      schema: ProductDetailsPanelSchema,
      description: 'Full product detail view with images, specs, variants, and purchase actions.',
    },
    ProductGrid: {
      schema: ProductGridSchema,
      description: 'A scrollable grid of ProductCard children with optional "more" pagination.',
    },
    ReviewHighlights: {
      schema: ReviewHighlightsSchema,
      description: 'A list of highlighted customer reviews with sentiment and ratings.',
    },
    ProsAndCons: {
      schema: ProsAndConsSchema,
      description: 'A pros and cons list for a product.',
    },
    CategoriesContainer: {
      schema: CategoriesContainerSchema,
      description: 'Tabbed product groups with optional filter tag buttons.',
    },
    HandoffNotice: {
      schema: HandoffNoticeSchema,
      description: 'A notice shown when the conversation is escalated to a human agent.',
    },
    PhotoAnalysisCard: {
      schema: PhotoAnalysisCardSchema,
      description: 'Structured photo analysis card with strengths, focus points, celeb vibe, and follow-up question.',
    },
    BeautyPhotoStep: {
      schema: BeautyPhotoStepSchema,
      description: 'Transient selfie upload prompt for beauty consulting init flow.',
    },
  },
} as const;

export type ChatCatalog = typeof chatCatalog;
export type ChatComponentName = keyof ChatCatalog['components'];

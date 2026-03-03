/**
 * QNA widget — json-render catalog definition.
 *
 * Backend endpoint: POST /chat/launcher_action
 * Response format: NDJSON stream, each line a StreamEvent.
 *
 * The backend returns a `ui_spec` event whose elements are typed to the
 * component names defined below. The frontend renders them via ./registry.
 *
 * Customising:
 *   Fork this repo and replace ./registry implementations with your own.
 *   The catalog schema (component names + prop types) is the API contract
 *   with the backend — do not rename components without a backend release.
 */

import { z } from 'zod';

const ActionPayloadSchema = z.object({
  title: z.string(),
  type: z.string(),
  payload: z.unknown().optional(),
});

export const ActionButtonSchema = z.object({
  label: z.string(),
  action: ActionPayloadSchema,
  variant: z.enum(['primary', 'outline', 'ghost']).optional(),
});

export const ButtonRowSchema = z.object({
  orientation: z.enum(['horizontal', 'vertical']).optional(),
  wrap: z.boolean().optional(),
});

export const TextInputSchema = z.object({
  placeholder: z.union([z.string(), z.array(z.string())]).optional(),
  ctaLabel: z.string().optional(),
});

export const QuestionHeadingSchema = z.object({
  text: z.string(),
});

export const qnaCatalog = {
  components: {
    ActionButton: {
      schema: ActionButtonSchema,
      description: 'A single clickable QNA action button.',
    },
    ButtonRow: {
      schema: ButtonRowSchema,
      description: 'Container for a group of QNA action buttons.',
    },
    TextInput: {
      schema: TextInputSchema,
      description: 'Free-text input with rotating placeholder and CTA button.',
    },
    QuestionHeading: {
      schema: QuestionHeadingSchema,
      description: 'A heading displayed above the QNA button group.',
    },
  },
} as const;

export type QNACatalog = typeof qnaCatalog;
export type QNAComponentName = keyof QNACatalog['components'];

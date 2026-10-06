/**
 * @file reusable.schema.ts
 * @description Centralized Zod validation schemas for cross-module use.
 * This file contains base pagination, resource filtering, and common parameter schemas (Slug, ID).
 * @module Common/Schemas
 */
import { z } from 'zod';
import { MESSAGES } from '@/constants/messages';
import { FIELDS } from '@/constants/fields';
import { APP_CONFIG } from '@/constants/app.constant';

/**
 * @constant SLUG_REGEX
 * @description Validates e-commerce slugs: lowercase alphanumeric segments separated by hyphens,
 * ending with a 13-digit Unix timestamp (e.g., "cool-product-name-1712345678901").
 */
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9]{13}$/;

// 1. BASE UTILITY SCHEMAS

/**
 * @schema paginationSchema
 * @description Standardized pagination validation. Coerces URL strings into integers.
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(APP_CONFIG.COMMON.PAGINATION.DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(APP_CONFIG.COMMON.PAGINATION.MAX_LIMIT)
    .default(APP_CONFIG.COMMON.PAGINATION.DEFAULT_LIMIT),
});

/**
 * @schema getSlugSchema
 * @description Validates a resource slug passed in request parameters using SLUG_REGEX.
 */
export const getSlugSchema = z.object({
  params: z.object({
    slug: z
      .string({ message: MESSAGES.VALIDATION.REQUIRED(FIELDS.SLUG) })
      .trim()
      .regex(SLUG_REGEX, { message: MESSAGES.VALIDATION.INVALID_FORMAT(FIELDS.SLUG) }),
  }),
});

/**
 * @schema getIDSchema
 * @description Validates a single UUID identifier passed in request parameters.
 */
export const getIDSchema = z.object({
  params: z.object({
    id: z
      .string({ message: MESSAGES.VALIDATION.REQUIRED(FIELDS.ID) })
      .trim()
      .uuid({ message: MESSAGES.VALIDATION.INVALID_FORMAT(FIELDS.ID) }),
  }),
});

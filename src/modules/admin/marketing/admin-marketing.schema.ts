import { z } from 'zod';

// --- DISCOUNTS ---
export const createDiscountSchema = z.object({
  body: z.object({
    name: z.string().min(2, { message: 'Tiêu đề quá ngắn' }),
    type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
    value: z.number().positive(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    isActive: z.boolean().default(true),
    isGlobal: z.boolean().default(false),
  }),
});

export const attachCoursesToDiscountSchema = z.object({
  body: z.object({
    courseIds: z.array(z.string().uuid()),
  }),
});

// --- VOUCHERS ---
export const createVoucherSchema = z.object({
  body: z.object({
    code: z.string().min(4).toUpperCase(),
    type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
    value: z.number().positive(),
    minOrderValue: z.number().min(0).optional(),
    maxDiscountAmount: z.number().min(0).optional(),
    maxUsesTotal: z.number().int().min(1).optional(),
    maxUsesPerUser: z.number().int().min(1).default(1),
    startDate: z.string().datetime(),
    endDate: z.string().datetime().optional(),
    audience: z.enum(['GLOBAL', 'SPECIFIC_USERS']).default('GLOBAL'),
    isActive: z.boolean().default(true),
  }),
});

export const giftVoucherSchema = z.object({
  body: z.object({
    userIds: z.array(z.string().uuid()).min(1, { message: 'Phải chọn ít nhất 1 người dùng' }),
  }),
});

export const toggleStatusSchema = z.object({
  body: z.object({
    isActive: z.boolean(),
  }),
});

export const paramIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export type CreateDiscountDTO = z.infer<typeof createDiscountSchema>['body'];
export type CreateVoucherDTO = z.infer<typeof createVoucherSchema>['body'];
export type AttachCoursesDTO = z.infer<typeof attachCoursesToDiscountSchema>['body'];
export type GiftVoucherDTO = z.infer<typeof giftVoucherSchema>['body'];

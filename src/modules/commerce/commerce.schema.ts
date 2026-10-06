import { z } from 'zod';
import { MESSAGES } from '@/constants/messages';
import { FIELDS } from '@/constants/fields';
import { APP_CONFIG } from '@/constants/app.constant';

// Đồng nhất Regex Slug từ phân hệ Public
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9]{13}$/;

// ==========================================
// 1. WISHLIST & RECENTLY VIEWED SCHEMAS
// ==========================================

export const toggleWishlistSchema = z.object({
  body: z.object({
    courseId: z.string().uuid({ message: MESSAGES.VALIDATION.INVALID_UUID(FIELDS.COURSE_ID) }),
  }),
});

// Silent API dùng Slug để Frontend dễ gọi trực tiếp từ trang chi tiết
export const trackRecentlyViewedSchema = z.object({
  params: z.object({
    slug: z
      .string()
      .trim()
      .regex(SLUG_REGEX, { message: MESSAGES.VALIDATION.INVALID_FORMAT(FIELDS.SLUG) }),
  }),
});

export const deleteRecentlyViewedItemSchema = z.object({
  params: z.object({
    courseId: z.string().uuid({ message: MESSAGES.VALIDATION.INVALID_UUID(FIELDS.COURSE_ID) }),
  }),
});

// ==========================================
// 2. CART (GIỎ HÀNG) SCHEMAS
// ==========================================

export const cartItemSchema = z.object({
  body: z.object({
    courseId: z.string().uuid({ message: MESSAGES.VALIDATION.INVALID_UUID(FIELDS.COURSE_ID) }),
  }),
});

export const cartItemParamSchema = z.object({
  params: z.object({
    courseId: z.string().uuid({ message: MESSAGES.VALIDATION.INVALID_UUID(FIELDS.COURSE_ID) }),
  }),
});

export const mergeGuestCartSchema = z.object({
  body: z.object({
    courseIds: z
      .array(z.string().uuid({ message: MESSAGES.VALIDATION.INVALID_UUID(FIELDS.COURSE_ID) }))
      .max(10, { message: MESSAGES.CART.ERROR.MAX_VALUE(APP_CONFIG.CART.MAX_ITEMS) }),
  }),
});

// ==========================================
// 3. VOUCHER (MÃ GIẢM GIÁ) SCHEMAS
// ==========================================

export const saveVoucherParamSchema = z.object({
  params: z.object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, { message: MESSAGES.VALIDATION.INVALID_UUID(FIELDS.VOUCHER_CODE) }),
  }),
});

export const applyVoucherSchema = z.object({
  body: z.object({
    voucherId: z.string().uuid({ message: MESSAGES.VALIDATION.INVALID_UUID(FIELDS.VOUCHER_ID) }),
  }),
});

// ==========================================
// 4. CHECKOUT & PAYMENT SCHEMAS
// ==========================================

export const checkoutSchema = z.object({
  body: z.object({
    // voucherId là tùy chọn vì khách có thể không dùng mã
    voucherId: z
      .string()
      .uuid({ message: MESSAGES.VALIDATION.INVALID_UUID(FIELDS.VOUCHER_ID) })
      .optional(),
  }),
});

export const createPaymentUrlSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: MESSAGES.VALIDATION.INVALID_UUID(FIELDS.ORDER_ID) }),
  }),
  body: z.object({
    provider: z.enum(['VNPAY', 'MOMO'], { message: MESSAGES.PAYMENT.ERROR.INVALID_PAYMENT_METHOD }),
  }),
});

export const orderParamSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: MESSAGES.VALIDATION.INVALID_UUID(FIELDS.ORDER_ID) }),
  }),
});

export type CartItemDTO = z.infer<typeof cartItemSchema>['body'];
export type MergeGuestCartDTO = z.infer<typeof mergeGuestCartSchema>['body'];
export type ToggleWishlistDTO = z.infer<typeof toggleWishlistSchema>['body'];
export type ApplyVoucherDTO = z.infer<typeof applyVoucherSchema>['body'];

export type CheckoutDTO = z.infer<typeof checkoutSchema>['body'];
export type CreatePaymentUrlDTO = z.infer<typeof createPaymentUrlSchema>['body'];

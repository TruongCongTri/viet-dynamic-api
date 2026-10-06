import { z } from 'zod';
import { MESSAGES } from '@/constants/messages';
import { FIELDS } from '@/constants/fields';
import { APP_CONFIG, SORT_OPTIONS, TIMEFRAME_OPTIONS } from '@/constants/app.constant';

// ĐỒNG NHẤT REGEX CHO TẤT CẢ SLUG (Chứa chữ, số, gạch ngang, và kết thúc bằng 13 số timestamp)
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9]{13}$/;

// HÀM HELPER: Xử lý Pagination dùng chung
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(APP_CONFIG.COMMON.PAGINATION.DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(APP_CONFIG.COMMON.PAGINATION.MAX_LIMIT)
    .default(APP_CONFIG.COMMON.PAGINATION.DEFAULT_LIMIT), // Giới hạn max item/lần để chống DDoS
});

// 1. SCHEMA CHO KHOÁ HỌC (COURSES)
export const getCoursesQuerySchema = z.object({
  query: paginationSchema
    .extend({
      search: z.string().trim().optional(),
      categorySlug: z.string().trim().optional(),
      instructorSlug: z.string().trim().optional(),

      // Ép kiểu String từ Query URL sang Number cho Price
      minPrice: z.coerce.number().min(0).optional(),
      maxPrice: z.coerce.number().min(0).optional(),

      sortBy: z.enum(SORT_OPTIONS.COURSE).default(SORT_OPTIONS.COURSE[0]), // newest
      timeframe: z.enum(TIMEFRAME_OPTIONS).optional(), // Phục vụ cho trending sau này
    })
    .refine(
      (data) => {
        // Đảm bảo minPrice không lớn hơn maxPrice nếu cả 2 được nhập
        if (data.minPrice !== undefined && data.maxPrice !== undefined) {
          return data.minPrice <= data.maxPrice;
        }
        return true;
      },
      { message: MESSAGES.VALIDATION.MIN_PRICE_INVALID, path: ['minPrice'] }
    ),
});

export const getCourseSlugSchema = z.object({
  params: z.object({
    slug: z.string({ message: MESSAGES.VALIDATION.REQUIRED(FIELDS.SLUG) }).trim(),
    // .regex(SLUG_REGEX, { message: MESSAGES.VALIDATION.INVALID_FORMAT(FIELDS.SLUG) }),
  }),
});

export const getCourseReviewsSchema = z.object({
  params: z.object({
    slug: z.string().trim().regex(SLUG_REGEX, { message: 'Định dạng Slug không hợp lệ' }),
  }),
  query: paginationSchema.extend({
    // Cho phép lọc theo số sao (Ví dụ: ?rating=5 để lấy review 5 sao)
    rating: z.coerce.number().int().min(1).max(5).optional(),
  }),
});

// 2. SCHEMA CHO GIẢNG VIÊN (INSTRUCTORS)
export const getInstructorsQuerySchema = z.object({
  query: paginationSchema.extend({
    sortBy: z.enum(SORT_OPTIONS.INSTRUCTOR).default(SORT_OPTIONS.INSTRUCTOR[0]), // popular
  }),
});

export const getInstructorSlugSchema = z.object({
  params: z.object({
    slug: z
      .string({ message: MESSAGES.VALIDATION.MUST_BE_STRING(FIELDS.SLUG) })
      .trim()
      .regex(SLUG_REGEX, { message: MESSAGES.VALIDATION.INVALID_FORMAT(FIELDS.SLUG) }),
  }),
  query: getCoursesQuerySchema.shape.query,
});

// 3. SCHEMA CHO DANH MỤC (CATEGORIES)
export const getCategoriesQuerySchema = z.object({
  query: paginationSchema.extend({
    sortBy: z.enum(SORT_OPTIONS.CATEGORY).default(SORT_OPTIONS.CATEGORY[0]), // popular
  }),
});

export const getCategorySlugSchema = z.object({
  params: z.object({
    slug: z
      .string({ message: MESSAGES.VALIDATION.MUST_BE_STRING(FIELDS.SLUG) })
      .trim()
      .regex(SLUG_REGEX, { message: MESSAGES.VALIDATION.INVALID_FORMAT(FIELDS.SLUG) }),
  }),
  query: getCoursesQuerySchema.shape.query,
});

// Thêm vùng SCHEMA CHO PAYMENTS
export const paymentWebhookSchema = z.object({
  // Webhook của các cổng thanh toán thường gửi dữ liệu rất đa dạng,
  // ta dùng z.record() để lấy toàn bộ payload và validate bằng Hash (Chữ ký)
  body: z.record(z.string(), z.any()),
});

// TRÍCH XUẤT TYPE (DTO)
export type GetCoursesQueryDTO = z.infer<typeof getCoursesQuerySchema>['query'];
export type GetInstructorsQueryDTO = z.infer<typeof getInstructorsQuerySchema>['query'];
export type GetCategoriesQueryDTO = z.infer<typeof getCategoriesQuerySchema>['query'];

export type GetCourseReviewsQueryDTO = z.infer<typeof getCourseReviewsSchema>['query'];

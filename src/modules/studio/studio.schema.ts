import { z } from 'zod';
import { MESSAGES } from '@/constants/messages';
import { FIELDS } from '@/constants/fields';

// ==========================================
// 1. COURSE MANAGEMENT SCHEMAS
// ==========================================

export const createCourseSchema = z.object({
  body: z.object({
    title: z
      .string()
      .min(10, { message: MESSAGES.VALIDATION.MIN_LENGTH(FIELDS.TITLE, 10) })
      .max(100, { message: MESSAGES.VALIDATION.MAX_LENGTH(FIELDS.TITLE, 100) }),
    categoryId: z.string().uuid({ message: MESSAGES.VALIDATION.INVALID_UUID(FIELDS.CATEGORY_ID) }),
  }),
});

export const updateCourseSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: MESSAGES.VALIDATION.INVALID_UUID(FIELDS.COURSE_ID) }),
  }),
  body: z.object({
    title: z.string().min(10).max(100).optional(),
    subtitle: z.string().max(200).optional(),
    description: z.string().optional(),
    basePrice: z.number().min(0).optional(),
    categoryId: z.string().uuid().optional(),
    thumbnailUrl: z.string().url().optional(),
    // Các trường khác có thể bổ sung sau
  }),
});

export const courseParamSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: MESSAGES.VALIDATION.INVALID_UUID(FIELDS.COURSE_ID) }),
  }),
});

// ==========================================
// 2. CURRICULUM SCHEMAS (MODULES & LESSONS)
// ==========================================

export const createModuleSchema = z.object({
  body: z.object({
    title: z.string().min(5, { message: 'Tên chương quá ngắn' }),
    order: z.number().int().min(1),
  }),
});

export const updateModuleSchema = z.object({
  body: z.object({
    title: z.string().min(5).optional(),
    order: z.number().int().min(1).optional(),
  }),
});

export const createLessonSchema = z.object({
  body: z.object({
    title: z.string().min(5),
    type: z.enum(['VIDEO', 'TEXT', 'QUIZ']),
    order: z.number().int().min(1),
  }),
});

export const updateLessonSchema = z.object({
  body: z.object({
    title: z.string().min(5).optional(),
    content: z.string().optional(), // Lưu HTML/Markdown hoặc JSON (cho QUIZ)
    videoId: z.string().optional(),
    videoUrl: z.string().url().optional(),
    duration: z.number().int().min(0).optional(),
    isPreview: z.boolean().optional(),
    order: z.number().int().min(1).optional(),
  }),
});

export const getUploadUrlSchema = z.object({
  query: z.object({
    contentType: z.string().default('video/mp4'), // Frontend truyền lên: video/mp4, image/png...
  }),
});

// ==========================================
// 3. ANALYTICS & QNA SCHEMAS
// ==========================================

export const revenueChartQuerySchema = z.object({
  query: z.object({
    timeframe: z.enum(['7d', '30d', '12m']).default('30d'), // Mặc định xem 30 ngày gần nhất
  }),
});

// Các param schemas để check UUID
export const moduleParamSchema = z.object({ params: z.object({ moduleId: z.string().uuid() }) });
export const lessonParamSchema = z.object({ params: z.object({ lessonId: z.string().uuid() }) });

export type CreateCourseDTO = z.infer<typeof createCourseSchema>['body'];
export type UpdateCourseDTO = z.infer<typeof updateCourseSchema>['body'];

export type CreateModuleDTO = z.infer<typeof createModuleSchema>['body'];
export type UpdateModuleDTO = z.infer<typeof updateModuleSchema>['body'];
export type CreateLessonDTO = z.infer<typeof createLessonSchema>['body'];
export type UpdateLessonDTO = z.infer<typeof updateLessonSchema>['body'];

export type RevenueChartQuery = z.infer<typeof revenueChartQuerySchema>['query'];

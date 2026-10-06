import { FIELDS } from '@/constants/fields';
import { MESSAGES } from '@/constants/messages';
import { z } from 'zod';

// 1. SCHEMA CẬP NHẬT TIẾN ĐỘ VIDEO (HEARTBEAT)
export const updateProgressSchema = z.object({
  body: z.object({
    watchedSeconds: z
      .number({ message: MESSAGES.VALIDATION.MUST_BE_NUMBER(FIELDS.WATCHED_SECONDS) })
      .int({ message: MESSAGES.VALIDATION.MUST_BE_INTEGER(FIELDS.WATCHED_SECONDS) })
      .min(0, { message: MESSAGES.VALIDATION.MIN_VALUE(FIELDS.WATCHED_SECONDS, 0) }),
    isCompleted: z.boolean().optional(),
  }),
  params: z.object({
    id: z
      .string({ message: MESSAGES.VALIDATION.MUST_BE_STRING(FIELDS.LESSON_ID) })
      .uuid({ message: MESSAGES.VALIDATION.INVALID_UUID(FIELDS.LESSON_ID) }),
  }),
});

// 2. SCHEMA BÌNH LUẬN BÀI HỌC
export const createCommentSchema = z.object({
  body: z.object({
    content: z
      .string({ message: MESSAGES.VALIDATION.MUST_BE_STRING(FIELDS.CONTENT) })
      .trim()
      .min(1, { message: MESSAGES.VALIDATION.REQUIRED(FIELDS.CONTENT) })
      .max(2000, { message: MESSAGES.VALIDATION.MAX_LENGTH(FIELDS.CONTENT, 2000) }),
    parentId: z
      .string({ message: MESSAGES.VALIDATION.MUST_BE_STRING(FIELDS.PARENT_ID) })
      .uuid({ message: MESSAGES.VALIDATION.INVALID_UUID(FIELDS.PARENT_ID) })
      .optional(),
  }),
  params: z.object({
    id: z
      .string({ message: MESSAGES.VALIDATION.MUST_BE_STRING(FIELDS.LESSON_ID) })
      .uuid({ message: MESSAGES.VALIDATION.INVALID_UUID(FIELDS.LESSON_ID) }),
  }),
});

// 3. SCHEMA ĐÁNH GIÁ KHÓA HỌC (REVIEW)
export const createReviewSchema = z.object({
  body: z.object({
    rating: z
      .number({ message: MESSAGES.VALIDATION.MUST_BE_NUMBER(FIELDS.RATING) })
      .int({ message: MESSAGES.VALIDATION.MUST_BE_INTEGER(FIELDS.RATING) })
      .min(1, { message: MESSAGES.VALIDATION.MIN_VALUE(FIELDS.RATING, 1) })
      .max(5, { message: MESSAGES.VALIDATION.MAX_VALUE(FIELDS.RATING, 5) }),
    content: z
      .string({ message: MESSAGES.VALIDATION.MUST_BE_STRING(FIELDS.CONTENT) })
      .trim()
      .max(1000, { message: MESSAGES.VALIDATION.MAX_LENGTH(FIELDS.CONTENT, 1000) })
      .optional(),
  }),
  params: z.object({
    slug: z
      .string({ message: MESSAGES.VALIDATION.MUST_BE_STRING(FIELDS.SLUG) })
      .min(1, { message: MESSAGES.VALIDATION.REQUIRED(FIELDS.SLUG) }),
  }),
});

// Thêm vào phần SCHEMA BÌNH LUẬN BÀI HỌC
export const updateCommentSchema = z.object({
  body: z.object({
    content: z.string().trim().min(1, { message: 'Nội dung không được để trống' }).max(2000),
  }),
});

export const commentParamSchema = z.object({
  params: z.object({
    commentId: z.string().uuid({ message: 'ID Bình luận không hợp lệ' }),
  }),
});

// TRÍCH XUẤT TYPE (DTO) CHO TẦNG SERVICE
export type UpdateProgressDTO = z.infer<typeof updateProgressSchema>['body'];
export type UpdateProgressParamsDTO = z.infer<typeof updateProgressSchema>['params'];

export type CreateCommentDTO = z.infer<typeof createCommentSchema>['body'];
export type CreateCommentParamsDTO = z.infer<typeof createCommentSchema>['params'];

export type CreateReviewDTO = z.infer<typeof createReviewSchema>['body'];
export type CreateReviewParamsDTO = z.infer<typeof createReviewSchema>['params'];

export type UpdateCommentDTO = z.infer<typeof updateCommentSchema>['body'];

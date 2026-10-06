import { z } from 'zod';
// import { MESSAGES } from '@/constants/messages';

export const categorySchema = z.object({
  body: z.object({
    name: z.string().min(2, { message: 'Tên danh mục quá ngắn' }),
    description: z.string().optional(),
    // Có thể thêm parentId nếu làm danh mục đa cấp (Sub-category)
  }),
});

export const rejectCourseSchema = z.object({
  body: z.object({
    reason: z
      .string()
      .min(5, { message: 'Vui lòng nhập lý do từ chối rõ ràng để Giảng viên khắc phục.' }),
  }),
});

export const assignInstructorsSchema = z.object({
  body: z.object({
    instructors: z
      .array(
        z.object({
          userId: z.string().uuid(),
          isOwner: z.boolean(), // Đánh dấu ai là Giảng viên chính
          revenueShare: z.number().min(0).max(100), // Tỷ lệ ăn chia %
        })
      )
      .min(1, { message: 'Phải có ít nhất 1 giảng viên cho khóa học.' }),
  }),
});

export const courseParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const queryReviewsSchema = z.object({
  query: z.object({
    page: z.string().optional().transform(Number),
    limit: z.string().optional().transform(Number),
  }),
});

export type CategoryDTO = z.infer<typeof categorySchema>['body'];
export type RejectCourseDTO = z.infer<typeof rejectCourseSchema>['body'];
export type AssignInstructorsDTO = z.infer<typeof assignInstructorsSchema>['body'];

export type QueryReviewsDTO = z.infer<typeof queryReviewsSchema>['query'];

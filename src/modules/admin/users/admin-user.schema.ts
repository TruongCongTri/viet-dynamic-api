import { z } from 'zod';

export const queryUsersSchema = z.object({
  query: z.object({
    page: z.string().optional().transform(Number),
    limit: z.string().optional().transform(Number),
    search: z.string().optional(),
    role: z.string().optional(),
    status: z.enum(['ACTIVE', 'BANNED', 'PENDING']).optional(),
    sortBy: z.enum(['createdAt', 'fullName', 'email']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

export const updateRoleSchema = z.object({
  body: z.object({
    roleId: z.string().uuid(),
  }),
});

export const updateStatusSchema = z.object({
  body: z.object({
    isActive: z.boolean(),
    reason: z.string().optional(), // Lý do khóa tài khoản (lưu log)
  }),
});

export const updatePermissionsSchema = z.object({
  body: z.object({
    permissionIds: z.array(z.string().uuid()),
  }),
});

export const manualEnrollmentSchema = z.object({
  body: z.object({
    courseId: z.string().uuid(),
    note: z.string().optional(), // Ghi chú: "Bán B2B công ty A"
  }),
});

export const userParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const revokeEnrollmentParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'ID người dùng không được để trống'), // Hoặc .uuid() tùy logic của bạn
    courseId: z.string().min(1, 'ID khóa học không được để trống'), // Hoặc .uuid()
  }),
});

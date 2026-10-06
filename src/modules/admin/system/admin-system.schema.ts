import { z } from 'zod';

// --- FORBIDDEN WORDS ---
export const createForbiddenWordSchema = z.object({
  body: z.object({
    word: z.string().min(2, { message: 'Từ cấm phải có ít nhất 2 ký tự' }).toLowerCase(),
  }),
});

// --- ROLES & PERMISSIONS ---
export const createRoleSchema = z.object({
  body: z.object({
    name: z.string().min(3).toUpperCase(),
    description: z.string().optional(),
  }),
});

export const updateRolePermissionsSchema = z.object({
  body: z.object({
    permissionIds: z.array(z.string().uuid()),
  }),
});

export const paramIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export type CreateForbiddenWordDTO = z.infer<typeof createForbiddenWordSchema>['body'];
export type CreateRoleDTO = z.infer<typeof createRoleSchema>['body'];
export type UpdateRolePermissionsDTO = z.infer<typeof updateRolePermissionsSchema>['body'];

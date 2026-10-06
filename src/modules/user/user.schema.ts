import { z } from 'zod';
import { MESSAGES } from '@/constants/messages';
import { FIELDS } from '@/constants/fields';

// ==========================================
// 1. USER PROFILE SCHEMAS
// ==========================================

export const updateProfileSchema = z.object({
  body: z.object({
    fullName: z
      .string()
      .min(2, { message: MESSAGES.VALIDATION.MIN_LENGTH(FIELDS.FULL_NAME, 2) })
      .max(50)
      .optional(),
    bio: z
      .string()
      .max(500, { message: MESSAGES.VALIDATION.MAX_LENGTH(FIELDS.BIO, 500) })
      .optional(),
    phone: z
      .string()
      .regex(/^(0|\+84)[3|5|7|8|9][0-9]{8}$/, {
        message: MESSAGES.VALIDATION.INVALID_FORMAT(FIELDS.PHONE),
      })
      .optional(),
  }),
});

// Avatar sẽ được validate bằng thư viện Multer (kiểm tra dung lượng, định dạng ảnh) ở tầng Middleware thay vì Zod.

// ==========================================
// 2. SESSION & SECURITY SCHEMAS
// ==========================================

export const sessionParamSchema = z.object({
  params: z.object({
    sessionId: z.string().uuid({ message: 'ID Phiên đăng nhập không hợp lệ' }),
  }),
});

export const requestEmailChangeSchema = z.object({
  body: z.object({
    newEmail: z.string().email({ message: 'Định dạng email không hợp lệ' }),
  }),
});

export const deleteAccountSchema = z.object({
  body: z.object({
    passwordConfirm: z
      .string()
      .min(1, { message: 'Vui lòng nhập mật khẩu xác nhận để xóa tài khoản' }),
  }),
});

export type DeleteAccountDTO = z.infer<typeof deleteAccountSchema>['body'];
export type RequestEmailChangeDTO = z.infer<typeof requestEmailChangeSchema>['body'];

export type UpdateProfileDTO = z.infer<typeof updateProfileSchema>['body'];

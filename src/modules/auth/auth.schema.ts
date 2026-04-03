import { z } from 'zod';
import { OTP_CHANNELS } from '@/constants/app.constant';
import { MESSAGES } from '@/constants/messages';
import { FIELDS, FieldName } from '@/constants/fields';

// HÀM HELPER: RULE CHUNG CHO MẬT KHẨU
const passwordValidationRule = (fieldName: FieldName) =>
  z
    .string({ message: MESSAGES.VALIDATION.MUST_BE_STRING(fieldName) })
    .min(6, { message: MESSAGES.VALIDATION.MIN_LENGTH(fieldName, 6) })
    .regex(/[A-Z]/, { message: MESSAGES.VALIDATION.PASSWORD_UPPERCASE })
    .regex(/[0-9]/, { message: MESSAGES.VALIDATION.PASSWORD_NUMBER });

// 1. SCHEMA XÁC THỰC (Đăng ký / Đăng nhập)
export const registerSchema = z.object({
  body: z.object({
    email: z
      .string({ message: MESSAGES.VALIDATION.MUST_BE_STRING(FIELDS.EMAIL) })
      .trim()
      .min(1, { message: MESSAGES.VALIDATION.REQUIRED(FIELDS.EMAIL) })
      .pipe(z.email({ message: MESSAGES.VALIDATION.INVALID_EMAIL })),
    password: passwordValidationRule(FIELDS.PASSWORD),
    fullName: z
      .string({ message: MESSAGES.VALIDATION.MUST_BE_STRING(FIELDS.FULL_NAME) })
      .trim()
      .min(2, { message: MESSAGES.VALIDATION.MIN_LENGTH(FIELDS.FULL_NAME, 2) })
      .max(100, { message: MESSAGES.VALIDATION.MAX_LENGTH(FIELDS.FULL_NAME, 100) }),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string({ message: MESSAGES.VALIDATION.MUST_BE_STRING(FIELDS.EMAIL) })
      .trim()
      .min(1, { message: MESSAGES.VALIDATION.REQUIRED(FIELDS.EMAIL) })
      .pipe(z.email({ message: MESSAGES.VALIDATION.INVALID_EMAIL })),
    password: z
      .string({ message: MESSAGES.VALIDATION.MUST_BE_STRING(FIELDS.PASSWORD) })
      .min(1, { message: MESSAGES.VALIDATION.REQUIRED(FIELDS.PASSWORD) }),
    deviceId: z
      .string({ message: MESSAGES.VALIDATION.MUST_BE_STRING(FIELDS.DEVICE_ID) })
      .trim()
      .max(255, { message: MESSAGES.VALIDATION.MAX_LENGTH(FIELDS.DEVICE_ID, 255) })
      .regex(/^[a-zA-Z0-9_-]+$/, { message: MESSAGES.VALIDATION.INVALID_CHARS(FIELDS.DEVICE_ID) })
      .optional(),
    rememberMe: z.boolean().optional().default(false),
  }),
});

// 2. SCHEMA LÀM MỚI & ĐĂNG XUẤT
export const refreshTokenSchema = z.object({
  cookies: z.object({
    refreshToken: z
      .string({
        error: (issue) =>
          issue.input === undefined
            ? MESSAGES.VALIDATION.MISSING_COOKIE_TOKEN
            : MESSAGES.VALIDATION.MUST_BE_STRING(FIELDS.REFRESH_TOKEN),
      })
      .regex(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/, {
        message: MESSAGES.VALIDATION.INVALID_FORMAT(FIELDS.REFRESH_TOKEN),
      }),
  }),
});

export const revokeSessionSchema = z.object({
  params: z.object({
    sessionId: z
      .string({ message: MESSAGES.VALIDATION.MUST_BE_STRING(FIELDS.SESSION_ID) })
      .uuid({ message: MESSAGES.VALIDATION.INVALID_UUID(FIELDS.SESSION_ID) }),
  }),
});

// 3. SCHEMA XÁC THỰC ĐỊNH DANH (OTP)
export const sendVerifyEmailSchema = z.object({
  body: z.object({
    identifier: z
      .string({ message: MESSAGES.VALIDATION.MUST_BE_STRING(FIELDS.IDENTIFIER) })
      .trim()
      .min(1, { message: MESSAGES.VALIDATION.REQUIRED(FIELDS.IDENTIFIER) }),
    channel: z.nativeEnum(OTP_CHANNELS, {
      message: MESSAGES.VALIDATION.INVALID_ENUM(FIELDS.CHANNEL),
    }),
  }),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    identifier: z
      .string({ message: MESSAGES.VALIDATION.MUST_BE_STRING(FIELDS.IDENTIFIER) })
      .trim()
      .min(1, { message: MESSAGES.VALIDATION.REQUIRED(FIELDS.IDENTIFIER) }),
    code: z
      .string({ message: MESSAGES.VALIDATION.MUST_BE_STRING(FIELDS.OTP_CODE) })
      .length(6, { message: MESSAGES.VALIDATION.EXACT_LENGTH(FIELDS.OTP_CODE, 6) })
      .regex(/^\d+$/, { message: MESSAGES.VALIDATION.ONLY_NUMBERS(FIELDS.OTP_CODE) }),
    channel: z.nativeEnum(OTP_CHANNELS, {
      message: MESSAGES.VALIDATION.INVALID_ENUM(FIELDS.CHANNEL),
    }),
  }),
});

// 4. SCHEMA MẬT KHẨU
export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string({ message: MESSAGES.VALIDATION.MUST_BE_STRING(FIELDS.EMAIL) })
      .trim()
      .min(1, { message: MESSAGES.VALIDATION.REQUIRED(FIELDS.EMAIL) })
      .pipe(z.email({ message: MESSAGES.VALIDATION.INVALID_EMAIL })),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: z
      .string({ message: MESSAGES.VALIDATION.MUST_BE_STRING(FIELDS.EMAIL) })
      .trim()
      .min(1, { message: MESSAGES.VALIDATION.REQUIRED(FIELDS.EMAIL) })
      .pipe(z.email({ message: MESSAGES.VALIDATION.INVALID_EMAIL })),
    code: z
      .string({ message: MESSAGES.VALIDATION.MUST_BE_STRING(FIELDS.OTP_CODE) })
      .length(6, { message: MESSAGES.VALIDATION.EXACT_LENGTH(FIELDS.OTP_CODE, 6) })
      .regex(/^\d+$/, { message: MESSAGES.VALIDATION.ONLY_NUMBERS(FIELDS.OTP_CODE) }),
    newPassword: passwordValidationRule(FIELDS.NEW_PASSWORD),
  }),
});

export const changePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z
        .string({ message: MESSAGES.VALIDATION.MUST_BE_STRING(FIELDS.CURRENT_PASSWORD) })
        .min(1, { message: MESSAGES.VALIDATION.REQUIRED(FIELDS.CURRENT_PASSWORD) }),
      newPassword: passwordValidationRule(FIELDS.NEW_PASSWORD),
    })
    // 1. Check không được giống y hệt
    .refine((data) => data.currentPassword !== data.newPassword, {
      message: MESSAGES.VALIDATION.PASSWORD_NOT_MATCH_OLD,
      path: ['newPassword'],
    })
    // 2. Check không được chứa chuỗi con của nhau (Nâng cao)
    .refine(
      (data) => {
        const oldPass = data.currentPassword.toLowerCase();
        const newPass = data.newPassword.toLowerCase();
        // Trả về false nếu newPass chứa oldPass hoặc ngược lại
        return !newPass.includes(oldPass) && !oldPass.includes(newPass);
      },
      {
        message: MESSAGES.VALIDATION.PASSWORD_TOO_SIMILAR,
        path: ['newPassword'],
      }
    ),
});

// TRÍCH XUẤT TYPE (DTO) CHO TẦNG SERVICE
export type RegisterDTO = z.infer<typeof registerSchema>['body'];
export type LoginDTO = z.infer<typeof loginSchema>['body'];
export type RevokeSessionDTO = z.infer<typeof revokeSessionSchema>['params'];
export type SendVerifyEmailDTO = z.infer<typeof sendVerifyEmailSchema>['body'];
export type VerifyEmailDTO = z.infer<typeof verifyEmailSchema>['body'];
export type ForgotPasswordDTO = z.infer<typeof forgotPasswordSchema>['body'];
export type ResetPasswordDTO = z.infer<typeof resetPasswordSchema>['body'];
export type RefreshTokenDTO = z.infer<typeof refreshTokenSchema>['cookies'];
export type ChangePasswordDTO = z.infer<typeof changePasswordSchema>['body'];

import { z } from 'zod';

// ============================================================================
// 1. SCHEMA XÁC THỰC
// ============================================================================

export const registerSchema = z.object({
  body: z.object({
    email: z
      .string({ message: 'Email bắt buộc phải là chuỗi' })
      .trim()
      .min(1, { message: 'Email không được để trống' })
      .pipe(z.email({ message: 'Email không đúng định dạng' })),
    password: z
      .string()
      .min(6, 'Mật khẩu phải có ít nhất 6 ký tự')
      .regex(/[A-Z]/, 'Mật khẩu phải chứa ít nhất 1 chữ hoa') // [Bảo mật cơ bản]
      .regex(/[0-9]/, 'Mật khẩu phải chứa ít nhất 1 chữ số'),
    fullName: z.string().trim().min(2, 'Họ tên phải có ít nhất 2 ký tự').max(100, 'Họ tên quá dài'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string({ message: 'Email bắt buộc' })
      .trim()
      .min(1, { message: 'Email không được để trống' })
      .pipe(z.email({ message: 'Email không đúng định dạng' })),
    password: z
      .string({ message: 'Mật khẩu bắt buộc' })
      .min(1, { message: 'Vui lòng nhập mật khẩu' }),
    deviceId: z
      .string({ message: 'Device ID phải là chuỗi' })
      .trim()
      .max(255, { message: 'Device ID quá dài' }) // Chặn payload rác
      .regex(/^[a-zA-Z0-9_-]+$/, { message: 'Device ID chứa ký tự không hợp lệ' }) // Chỉ cho phép chữ, số, gạch ngang
      .optional(),
  }),
});

// ============================================================================
// 2. SCHEMA LÀM MỚI & ĐĂNG XUẤT
// ============================================================================

export const refreshTokenSchema = z.object({
  // Refresh Token được gửi ngầm qua HttpOnly Cookie, không nằm trong body
  cookies: z.object({
    refreshToken: z
      .string({
        error: (issue) =>
          issue.input === undefined
            ? 'Không tìm thấy Refresh Token trong Cookie'
            : 'Refresh Token phải là chuỗi hợp lệ',
      })
      .regex(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/, {
        message: 'Định dạng Refresh Token không hợp lệ',
      }),
  }),
});

// ============================================================================
// 3. SCHEMA XÁC THỰC EMAIL (OTP)
// ============================================================================

export const sendVerifyEmailSchema = z.object({
  body: z.object({
    identifier: z.string({ message: 'Email hoặc Số điện thoại bắt buộc' }).trim().min(1),
    channel: z.enum(['EMAIL', 'SMS', 'ZALO'], { message: 'Kênh gửi không hợp lệ' }),
  }),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    // Đổi 'email' thành 'identifier' để dùng chung cho cả Email/SĐT
    identifier: z
      .string({ message: 'Email hoặc Số điện thoại bắt buộc' })
      .trim()
      .min(1, { message: 'Định danh không được để trống' }),

    code: z
      .string({ message: 'Mã OTP bắt buộc' })
      .length(6, { message: 'Mã OTP phải có đúng 6 ký tự' })
      .regex(/^\d+$/, { message: 'Mã OTP chỉ được chứa các chữ số' }),

    // Bổ sung channel vì logic verify của chúng ta cần biết verify cho kênh nào
    channel: z.enum(['EMAIL', 'SMS', 'ZALO'], { message: 'Kênh xác thực không hợp lệ' }),
  }),
});

// ============================================================================
// 4. SCHEMA QUÊN MẬT KHẨU
// ============================================================================

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string({ message: 'Email bắt buộc' })
      .trim()
      .min(1, { message: 'Email không được để trống' })
      .pipe(z.email({ message: 'Email không đúng định dạng' })),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: z
      .string({ message: 'Email bắt buộc' })
      .trim()
      .min(1, { message: 'Email không được để trống' })
      .pipe(z.email({ message: 'Email không đúng định dạng' })),
    code: z
      .string()
      .length(6, 'Mã OTP phải có đúng 6 ký tự')
      .regex(/^\d+$/, 'Mã OTP chỉ được chứa các chữ số'),
    newPassword: z
      .string()
      .min(6, 'Mật khẩu mới phải có ít nhất 6 ký tự')
      .regex(/[A-Z]/, 'Mật khẩu phải chứa ít nhất 1 chữ hoa')
      .regex(/[0-9]/, 'Mật khẩu phải chứa ít nhất 1 chữ số'),
  }),
});

export const revokeSessionSchema = z.object({
  params: z.object({
    sessionId: z
      .string({ message: 'Session ID bắt buộc' })
      .uuid({ message: 'Session ID không đúng định dạng UUID' }), // Ép chuẩn UUID
  }),
});

// ============================================================================
// TRÍCH XUẤT TYPE (DTO) CHO TẦNG SERVICE (End-to-End Type Safety)
// ============================================================================
export type RegisterDTO = z.infer<typeof registerSchema>['body'];
export type LoginDTO = z.infer<typeof loginSchema>['body'];
export type RevokeSessionDTO = z.infer<typeof revokeSessionSchema>['params'];
export type SendVerifyEmailDTO = z.infer<typeof sendVerifyEmailSchema>['body'];
export type VerifyEmailDTO = z.infer<typeof verifyEmailSchema>['body'];
export type ForgotPasswordDTO = z.infer<typeof forgotPasswordSchema>['body'];
export type ResetPasswordDTO = z.infer<typeof resetPasswordSchema>['body'];
export type RefreshTokenDTO = z.infer<typeof refreshTokenSchema>['cookies'];

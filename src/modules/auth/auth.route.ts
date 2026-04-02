import { Router } from 'express';
import { ENDPOINTS } from '@/constants/endpoints';
import { AuthController } from './auth.controller';
import { validate } from '@/middlewares/validate.middleware';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  sendVerifyEmailSchema, // Chứa identifier & channel
  verifyEmailSchema, // Chứa identifier, code & channel
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from './auth.schema';
import { authLimiter } from '@/middlewares/rate-limit.middleware'; // Middleware chống Spam
import { verifyToken } from '@/middlewares/auth.middleware';

const authRoute = Router();
const authController = new AuthController();

// PUBLIC ROUTES
// 1. ĐĂNG KÝ (REGISTER)
authRoute.post(
  ENDPOINTS.AUTH.REGISTER,
  authLimiter,
  validate(registerSchema),
  authController.register
);

// 2. ĐĂNG NHẬP (LOGIN)
authRoute.post(ENDPOINTS.AUTH.LOGIN, authLimiter, validate(loginSchema), authController.login);

// 3. REFRESH TOKEN (Cấp lại Access Token)
authRoute.post(
  ENDPOINTS.AUTH.REFRESH_TOKEN,
  validate(refreshTokenSchema),
  authController.refreshToken
);

// 6. XÁC THỰC EMAIL (Gửi & Xác nhận OTP)
authRoute.post(
  ENDPOINTS.AUTH.SEND_VERIFY_EMAIL,
  authLimiter,
  validate(sendVerifyEmailSchema),
  authController.sendVerifyOTP
);
authRoute.post(
  ENDPOINTS.AUTH.VERIFY_EMAIL,
  authLimiter,
  validate(verifyEmailSchema),
  authController.verifyOTP
);

// 7. QUÊN MẬT KHẨU & KHÔI PHỤC MẬT KHẨU
authRoute.post(
  ENDPOINTS.AUTH.FORGOT_PASSWORD,
  authLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword
);
authRoute.post(
  ENDPOINTS.AUTH.RESET_PASSWORD,
  authLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword
);

// 8. ĐỔI MẬT KHẨU (Khi đã đăng nhập)
authRoute.put(
  '/change-password',
  verifyToken,
  validate(changePasswordSchema),
  authController.changePassword
);

// PROTECTED ROUTES (Cần token hợp lệ mới truy cập được)
// 4. QUẢN LÝ THIẾT BỊ
authRoute.get(ENDPOINTS.AUTH.SESSIONS, verifyToken, authController.getSessions);
authRoute.delete(ENDPOINTS.AUTH.REVOKE_SESSION, verifyToken, authController.revokeSession);
authRoute.delete(
  ENDPOINTS.AUTH.REVOKE_OTHER_SESSIONS,
  verifyToken,
  authController.revokeOtherSessions
);

// 5. LOGOUT (Đăng xuất)
authRoute.post(ENDPOINTS.AUTH.LOGOUT, verifyToken, authController.logout);

// // OAuth2 Google
// authRoute.get(ENDPOINTS.AUTH.GOOGLE, authController.googleInit);
// authRoute.get(ENDPOINTS.AUTH.GOOGLE_CALLBACK, authController.googleCallback);

export default authRoute;

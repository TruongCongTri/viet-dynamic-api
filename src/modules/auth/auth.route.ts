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
} from './auth.schema';
import { authLimiter } from '@/middlewares/rate-limit.middleware'; // Middleware chống Spam
import { verifyToken } from '@/middlewares/auth.middleware';

const authRoute = Router();
const authController = new AuthController();

// PUBLIC ROUTES
// ==========================================

// 1. Đăng ký tài khoản
authRoute.post(
  ENDPOINTS.AUTH.REGISTER,
  authLimiter,
  validate(registerSchema),
  authController.register
);

// 2. Đăng nhập
authRoute.post(ENDPOINTS.AUTH.LOGIN, authLimiter, validate(loginSchema), authController.login);

// 3. Refresh Token
authRoute.post(
  ENDPOINTS.AUTH.REFRESH_TOKEN,
  validate(refreshTokenSchema),
  authController.refreshToken
);

// OTP & PASSWORD (Cần Limiter để chống đốt tiền SMS/Email)
// ==========================================
// 4. Gửi mã OTP xác thực email/SĐT (Dùng chung cho cả verify email và forgot password)
authRoute.post(
  ENDPOINTS.AUTH.SEND_VERIFY_EMAIL,
  authLimiter,
  validate(sendVerifyEmailSchema),
  authController.sendVerifyOTP
);
// 5. Xác thực mã OTP (Dùng chung cho cả verify email và forgot password)
authRoute.post(ENDPOINTS.AUTH.VERIFY_EMAIL, validate(verifyEmailSchema), authController.verifyOTP);

// 6. Quên mật khẩu
authRoute.post(
  ENDPOINTS.AUTH.FORGOT_PASSWORD,
  authLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword
);
// 7. Reset mật khẩu
authRoute.post(
  ENDPOINTS.AUTH.RESET_PASSWORD,
  validate(resetPasswordSchema),
  authController.resetPassword
);

// PRIVATE ROUTES (CẦN ACCESS TOKEN)
// ==========================================
// 8. Đăng xuất
authRoute.post(ENDPOINTS.AUTH.LOGOUT, verifyToken, authController.logout);

// // OAuth2 Google
// authRoute.get(ENDPOINTS.AUTH.GOOGLE, authController.googleInit);
// authRoute.get(ENDPOINTS.AUTH.GOOGLE_CALLBACK, authController.googleCallback);

// ==========================================
// VÍ DỤ CÁCH SỬ DỤNG MIDDLEWARE BẢO MẬT (Cho các task sau)
// ==========================================
/*
import { verifyToken, requirePermission } from '@/middlewares/auth.middleware';

// Ví dụ: Đăng xuất (Cần biết là ai đang gửi request)
authRoute.post(ENDPOINTS.AUTH.LOGOUT, verifyToken, authController.logout);

// Ví dụ: Một API nhạy cảm đòi hỏi quyền Cấp phát Voucher
authRoute.post(
  '/admin/issue-voucher', 
  verifyToken, 
  requirePermission('ISSUE_VOUCHER'), // Lớp khiên quyền hạn tối thượng
  voucherController.issueVoucher
);
*/

export default authRoute;

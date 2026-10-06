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
  revokeSessionSchema,
} from './auth.schema';
import { authLimiter } from '@/middlewares/rate-limit.middleware'; // Middleware chống Spam
import { verifyToken } from '@/middlewares/auth.middleware';

export class AuthRoute {
  public router: Router;
  private readonly authController: AuthController;

  constructor(controller?: AuthController) {
    this.router = Router();
    this.authController = controller || new AuthController();

    this.initializeRoutes();
  }

  private initializeRoutes() {
    // PUBLIC ROUTES
    // 1. ĐĂNG KÝ (REGISTER)
    this.router.post(
      ENDPOINTS.AUTH.REGISTER,
      authLimiter,
      validate(registerSchema),
      this.authController.register
    );

    // 2. ĐĂNG NHẬP (LOGIN)
    this.router.post(
      ENDPOINTS.AUTH.LOGIN,
      authLimiter,
      validate(loginSchema),
      this.authController.login
    );

    // 3. REFRESH TOKEN (Cấp lại Access Token)
    this.router.post(
      ENDPOINTS.AUTH.REFRESH_TOKEN,
      validate(refreshTokenSchema),
      this.authController.refreshToken
    );

    // 6. XÁC THỰC EMAIL (Gửi & Xác nhận OTP)
    this.router.post(
      ENDPOINTS.AUTH.SEND_VERIFY_EMAIL,
      authLimiter,
      validate(sendVerifyEmailSchema),
      this.authController.sendVerifyOTP
    );
    this.router.post(
      ENDPOINTS.AUTH.VERIFY_EMAIL,
      authLimiter,
      validate(verifyEmailSchema),
      this.authController.verifyOTP
    );

    // 7. QUÊN MẬT KHẨU & KHÔI PHỤC MẬT KHẨU
    this.router.post(
      ENDPOINTS.AUTH.FORGOT_PASSWORD,
      authLimiter,
      validate(forgotPasswordSchema),
      this.authController.forgotPassword
    );
    this.router.post(
      ENDPOINTS.AUTH.RESET_PASSWORD,
      authLimiter,
      validate(resetPasswordSchema),
      this.authController.resetPassword
    );

    // 8. ĐỔI MẬT KHẨU (Khi đã đăng nhập)
    this.router.put(
      ENDPOINTS.AUTH.CHANGE_PASSWORD,
      verifyToken,
      validate(changePasswordSchema),
      this.authController.changePassword
    );

    // PROTECTED ROUTES (Cần token hợp lệ mới truy cập được)
    // 4. QUẢN LÝ THIẾT BỊ
    this.router.get(ENDPOINTS.AUTH.SESSIONS, verifyToken, this.authController.getSessions);
    this.router.delete(
      ENDPOINTS.AUTH.REVOKE_SESSION,
      verifyToken,
      validate(revokeSessionSchema),
      this.authController.revokeSession
    );
    this.router.delete(
      ENDPOINTS.AUTH.REVOKE_OTHER_SESSIONS,
      verifyToken,
      this.authController.revokeOtherSessions
    );

    // 5. LOGOUT (Đăng xuất)
    this.router.post(ENDPOINTS.AUTH.LOGOUT, verifyToken, this.authController.logout);

    // // OAuth2 Google
    // this.router.get(ENDPOINTS.AUTH.GOOGLE, this.authController.googleInit);
    // this.router.get(ENDPOINTS.AUTH.GOOGLE_CALLBACK, this.authController.googleCallback);
  }
}

export default new AuthRoute().router;

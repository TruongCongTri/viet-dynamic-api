import { NextFunction, Request, Response } from 'express';
import { AuthService } from './auth.service';
import { successResponse } from '@/common/utils/responses/api-response';
import { AppError } from '@/common/errors/app.error';
import { MESSAGES } from '@/constants/messages';
import { ERROR_CODES } from '@/constants/error-codes';
import {
  ChangePasswordDTO,
  ForgotPasswordDTO,
  LoginDTO,
  RegisterDTO,
  ResetPasswordDTO,
  SendVerifyEmailDTO,
  VerifyEmailDTO,
} from './auth.schema';
import { RESOURCES } from '@/constants/resources';

// Helper để đảm bảo Cookie Options luôn đồng nhất giữa Login/Logout/Refresh
const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  path: '/', // Đảm bảo cookie có hiệu lực toàn trang
});

export class AuthController {
  private readonly authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  // 1. ĐĂNG KÝ (REGISTER)
  public register = async (req: Request, res: Response): Promise<void> => {
    const payload = req.body as RegisterDTO;
    const user = await this.authService.register(payload);

    successResponse(res, {
      statusCode: 201,
      message: MESSAGES.AUTH.SUCCESS.REGISTER,
      data: user,
    });
  };

  // 2. ĐĂNG NHẬP (LOGIN)
  login = async (req: Request, res: Response): Promise<void> => {
    const payload = req.body as LoginDTO;

    const clientMeta = {
      ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    };

    const result = await this.authService.login(payload, clientMeta);

    // Khởi tạo cookie options mặc định (httpOnly, secure, sameSite, path)
    const cookieOptions: any = getCookieOptions();

    // Nếu chọn Remember Me -> Gắn maxAge (Persistent Cookie)
    // Nếu không chọn -> Bỏ qua maxAge (Session Cookie, tự xóa khi đóng trình duyệt)
    if (result.rememberMe) {
      cookieOptions.maxAge = result.expiresAt.getTime() - Date.now();
    }

    res.cookie('refreshToken', result.refreshToken, cookieOptions);

    successResponse(res, {
      statusCode: 200,
      message: MESSAGES.AUTH.SUCCESS.LOGIN,
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  };

  // 3. REFRESH TOKEN (Cấp lại Access Token)
  refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken)
      throw new AppError(
        401,
        MESSAGES.AUTH.ERROR.MISSING_COOKIE_TOKEN,
        ERROR_CODES.AUTH.MISSING_COOKIE_TOKEN
      );
    try {
      // Nhận Token mới và thông tin Remember Me từ Service
      const result = await this.authService.refreshToken({ refreshToken });

      const cookieOptions: any = getCookieOptions();

      // Nếu là Session Remember Me -> Gắn lại maxAge để Cookie sống dai
      // Nếu không -> Bỏ qua maxAge để trình duyệt tự xóa khi tắt
      if (result.rememberMe) {
        cookieOptions.maxAge = result.expiresAt.getTime() - Date.now();
      }

      // Ghi đè Cookie bằng Refresh Token mới
      res.cookie('refreshToken', result.refreshToken, cookieOptions);

      successResponse(res, {
        statusCode: 200,
        message: MESSAGES.AUTH.SUCCESS.REFRESH_TOKEN,
        data: { accessToken: result.accessToken },
      });
    } catch (error) {
      // Nếu Refresh Token lỗi, xóa luôn cookie để tránh loop lỗi ở FE
      res.clearCookie('refreshToken', getCookieOptions());
      next(error);
    }
  };

  // 4. QUẢN LÝ THIẾT BỊ
  getSessions = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const sessions = await this.authService.getActiveSessions(userId);
    successResponse(res, {
      statusCode: 200,
      message: MESSAGES.AUTH.SUCCESS.GET_SESSIONS,
      data: sessions,
    });
  };

  revokeSession = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const sessionId = req.params.sessionId as string;

    if (!sessionId) {
      throw new AppError(
        400,
        MESSAGES.COMMON.ERROR.NOT_FOUND(RESOURCES.SESSION),
        ERROR_CODES.COMMON.INVALID_INPUT
      );
    }

    await this.authService.revokeDeviceSession(userId, sessionId);
    successResponse(res, { statusCode: 200, message: MESSAGES.AUTH.SUCCESS.REVOKE_SESSION });
  };

  revokeOtherSessions = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const currentSessionId = req.user!.sessionId;

    await this.authService.revokeOtherSessions(userId, currentSessionId);

    successResponse(res, {
      statusCode: 200,
      message: MESSAGES.AUTH.SUCCESS.REVOKE_OTHER_SESSIONS,
    });
  };

  // 5. LOGOUT (Đăng xuất)
  logout = async (req: Request, res: Response): Promise<void> => {
    const user = (req as Request & { user?: { sessionId: string } }).user;
    const sessionId = user?.sessionId;

    if (!sessionId)
      throw new AppError(
        401,
        MESSAGES.AUTH.ERROR.INVALID_SESSION,
        ERROR_CODES.AUTH.INVALID_SESSION
      );

    await this.authService.logout(sessionId);

    // Xóa cookie ở phía Client
    res.clearCookie('refreshToken', getCookieOptions());

    successResponse(res, {
      statusCode: 200,
      message: MESSAGES.AUTH.SUCCESS.LOGOUT,
    });
  };

  // 6. XÁC THỰC EMAIL (Gửi & Xác nhận OTP)
  sendVerifyOTP = async (req: Request, res: Response): Promise<void> => {
    const payload = req.body as SendVerifyEmailDTO;
    await this.authService.sendVerifyOTP(payload);
    successResponse(res, { statusCode: 200, message: MESSAGES.AUTH.SUCCESS.OTP_SENT });
  };

  verifyOTP = async (req: Request, res: Response): Promise<void> => {
    const payload = req.body as VerifyEmailDTO;
    await this.authService.verifyOTP(payload);
    successResponse(res, { statusCode: 200, message: MESSAGES.AUTH.SUCCESS.OTP_VERIFIED });
  };

  // 7. QUÊN MẬT KHẨU & KHÔI PHỤC MẬT KHẨU
  forgotPassword = async (req: Request, res: Response): Promise<void> => {
    const payload = req.body as ForgotPasswordDTO;
    await this.authService.forgotPassword(payload);
    successResponse(res, {
      statusCode: 200,
      message: MESSAGES.AUTH.SUCCESS.FORGOT_PASSWORD_SENT,
    });
  };

  resetPassword = async (req: Request, res: Response): Promise<void> => {
    const payload = req.body as ResetPasswordDTO;
    await this.authService.resetPassword(payload);

    res.clearCookie('refreshToken', getCookieOptions());

    successResponse(res, {
      statusCode: 200,
      message: MESSAGES.AUTH.SUCCESS.RESET_PASSWORD,
    });
  };

  // 8. ĐỔI MẬT KHẨU (Khi đã đăng nhập)
  changePassword = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const payload = req.body as ChangePasswordDTO;
    await this.authService.changePassword(userId, payload);

    successResponse(res, { statusCode: 200, message: MESSAGES.AUTH.SUCCESS.CHANGE_PASSWORD });
  };
}

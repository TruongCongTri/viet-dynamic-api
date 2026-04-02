import { NextFunction, Request, Response } from 'express';
import ms, { StringValue } from 'ms';
import { env } from '@/common/configs/env';
import { AuthService } from './auth.service';
import { successResponse } from '@/common/utils/responses/api-response';
import { AppError } from '@/common/errors/app.error';
import { MESSAGES } from '@/constants/messages';

const authService = new AuthService();

// Helper để đảm bảo Cookie Options luôn đồng nhất giữa Login/Logout/Refresh
const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  path: '/', // Đảm bảo cookie có hiệu lực toàn trang
});

export class AuthController {
  // 1. ĐĂNG KÝ (REGISTER)
  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await authService.register(req.body);

      successResponse(res, {
        statusCode: 201,
        message: 'Đăng ký thành công. Vui lòng kiểm tra email để xác thực.',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  // 2. ĐĂNG NHẬP (LOGIN)
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clientMeta = {
        ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      };

      const result = await authService.login(req.body, clientMeta);

      res.cookie('refreshToken', result.refreshToken, {
        ...getCookieOptions(),
        maxAge: ms(env.JWT_REFRESH_EXPIRES_IN as StringValue) || 7 * 24 * 60 * 60 * 1000,
      });

      successResponse(res, {
        statusCode: 200,
        message: MESSAGES.AUTH.SUCCESS.LOGIN,
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // 3. REFRESH TOKEN (Cấp lại Access Token)
  refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken)
        throw new AppError(
          401,
          'Phiên làm việc hết hạn. Vui lòng đăng nhập lại.',
          'MISSING_COOKIE_TOKEN'
        );

      // Nhận 2 token mới
      const tokens = await authService.refreshToken({ refreshToken });

      // Cập nhật lại Cookie với Refresh Token MỚI
      res.cookie('refreshToken', tokens.refreshToken, {
        ...getCookieOptions(),
        maxAge: ms(env.JWT_REFRESH_EXPIRES_IN as StringValue) || 7 * 24 * 60 * 60 * 1000,
      });

      successResponse(res, {
        statusCode: 200,
        message: 'Làm mới token thành công.',
        data: { accessToken: tokens.accessToken },
      });
    } catch (error) {
      // Nếu Refresh Token lỗi, xóa luôn cookie để tránh loop lỗi ở FE
      res.clearCookie('refreshToken', getCookieOptions());
      next(error);
    }
  };

  // 4. QUẢN LÝ THIẾT BỊ
  getSessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessions = await authService.getActiveSessions(req.user!.id);
      successResponse(res, {
        statusCode: 200,
        message: 'Lấy danh sách thiết bị thành công.',
        data: sessions,
      });
    } catch (error) {
      next(error);
    }
  };

  revokeSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = req.params.sessionId as string;

      if (!sessionId) {
        throw new AppError(400, 'Thiếu mã phiên đăng nhập (sessionId).', 'INVALID_INPUT');
      }

      await authService.revokeDeviceSession(req.user!.id, sessionId);
      successResponse(res, { statusCode: 200, message: 'Đã đăng xuất khỏi thiết bị.' });
    } catch (error) {
      next(error);
    }
  };

  revokeOtherSessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const currentSessionId = req.user!.sessionId;

      await authService.revokeOtherSessions(userId, currentSessionId);

      successResponse(res, {
        statusCode: 200,
        message: 'Đã đăng xuất khỏi tất cả các thiết bị khác.',
      });
    } catch (error) {
      next(error);
    }
  };

  // 5. LOGOUT (Đăng xuất)
  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as Request & { user?: { sessionId: string } }).user;
      const sessionId = user?.sessionId;

      if (!sessionId)
        throw new AppError(
          401,
          'Không thể xác định phiên đăng nhập hợp lệ để đăng xuất.',
          'INVALID_SESSION'
        );

      await authService.logout(sessionId);

      // Xóa cookie ở phía Client
      res.clearCookie('refreshToken', getCookieOptions());

      successResponse(res, {
        statusCode: 200,
        message: 'Đăng xuất thành công.',
      });
    } catch (error) {
      next(error);
    }
  };

  // 6. XÁC THỰC EMAIL (Gửi & Xác nhận OTP)
  sendVerifyOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await authService.sendVerifyOTP(req.body);
      successResponse(res, { statusCode: 200, message: 'Mã xác thực đã được gửi.' });
    } catch (error) {
      next(error);
    }
  };

  verifyOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await authService.verifyOTP(req.body);
      successResponse(res, { statusCode: 200, message: 'Xác thực email thành công.' });
    } catch (error) {
      next(error);
    }
  };

  // 7. QUÊN MẬT KHẨU & KHÔI PHỤC MẬT KHẨU
  forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await authService.forgotPassword(req.body);
      successResponse(res, {
        statusCode: 200,
        message: 'Mã khôi phục mật khẩu đã được gửi.',
      });
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await authService.resetPassword(req.body);

      res.clearCookie('refreshToken', getCookieOptions());

      successResponse(res, {
        statusCode: 200,
        message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.',
      });
    } catch (error) {
      next(error);
    }
  };

  // 8. ĐỔI MẬT KHẨU (Khi đã đăng nhập)
  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await authService.changePassword(req.user!.id, req.body);

      successResponse(res, { statusCode: 200, message: 'Đổi mật khẩu thành công.' });
    } catch (error) {
      next(error);
    }
  };
}

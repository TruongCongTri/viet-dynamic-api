import { NextFunction, Request, Response } from 'express';
import ms, { StringValue } from 'ms';
import { env } from '@/common/configs/env';
import { AuthService } from './auth.service';
import { successResponse } from '@/common/utils/responses/api-response';
import { AppError } from '@/common/errors/app.error';

const authService = new AuthService();

// Helper để đảm bảo Cookie Options luôn đồng nhất giữa Login/Logout/Refresh
const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  path: '/', // Đảm bảo cookie có hiệu lực toàn trang
});

export class AuthController {
  // ĐĂNG KÝ
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

  // ĐĂNG NHẬP
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
        message: 'Đăng nhập thành công.',
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // LÀM MỚI TOKEN
  refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken)
        throw new AppError(
          401,
          'Phiên làm việc hết hạn. Vui lòng đăng nhập lại.',
          'MISSING_COOKIE_TOKEN'
        );

      const newAccessToken = await authService.refreshToken({ refreshToken });

      successResponse(res, {
        statusCode: 200,
        message: 'Làm mới token thành công.',
        data: { accessToken: newAccessToken },
      });
    } catch (error) {
      // Nếu Refresh Token lỗi, xóa luôn cookie để tránh loop lỗi ở FE
      res.clearCookie('refreshToken', getCookieOptions());
      next(error);
    }
  };

  // ĐĂNG XUẤT
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

  // OTP & MẬT KHẨU
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
}

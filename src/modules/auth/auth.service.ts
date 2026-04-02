import bcrypt from 'bcryptjs';
import ms, { StringValue } from 'ms';
import { prisma } from '@/common/configs/prisma';
import { env } from '@/common/configs/env';
import { JwtUtil } from '@/common/utils/auth/jwt.util';
import {
  RegisterDTO,
  LoginDTO,
  ForgotPasswordDTO,
  ResetPasswordDTO,
  RefreshTokenDTO,
  ChangePasswordDTO,
} from './auth.schema';
import { AppError } from '@/common/errors/app.error';
import { notificationService } from '@/common/services/notification.service';

import { ERROR_CODES } from '@/constants/error-codes';
import { MESSAGES } from '@/constants/messages';
import { RESOURCES } from '@/constants/resources';
import { APP_CONFIG, OTP_CHANNELS, OtpChannel } from '@/constants/app.constant';

export class AuthService {
  // 1. ĐĂNG KÝ (REGISTER)
  async register(data: RegisterDTO) {
    const { email, password, fullName } = data;

    // 1. Kiểm tra email tồn tại
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser)
      throw new AppError(
        409,
        MESSAGES.COMMON.ERROR.ALREADY_EXISTS(RESOURCES.EMAIL),
        ERROR_CODES.AUTH.EMAIL_EXISTS
      );

    // 2. Lấy Role STUDENT mặc định
    const studentRole = await prisma.role.findUnique({
      where: { name: APP_CONFIG.AUTH.DEFAULT_ROLE },
    });
    if (!studentRole)
      throw new AppError(500, MESSAGES.AUTH.ERROR.ROLE_NOT_FOUND, ERROR_CODES.AUTH.ROLE_NOT_FOUND);

    // 3. Mã hóa Mật khẩu bằng số SALT từ biến môi trường
    const salt = await bcrypt.genSalt(env.BCRYPT_SALT);
    const hashedPassword = await bcrypt.hash(password, salt);

    return await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        roleId: studentRole.id,
        isEmailVerified: false, // Chờ verify email ở bước sau
        profile: {
          create: { fullName },
        },
      },
      select: {
        id: true,
        email: true,
        isEmailVerified: true,
        profile: { select: { fullName: true } },
      },
    });
  }

  // 2. ĐĂNG NHẬP (Bảo vệ 3 lớp: Khoá Spam + Soft Limit thiết bị + Flatten Permissions)
  async login(data: LoginDTO, clientMeta: { ipAddress: string; userAgent: string }) {
    const { email, password, deviceId } = data;

    // 1. Tìm User và "Đào sâu" (Deep Include) để lấy toàn bộ Quyền
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
        role: {
          include: {
            permissions: {
              include: { permission: true }, // Lấy tên các Action (Quyền gốc)
            },
          },
        },
        extraPermissions: {
          include: { permission: true }, // Lấy tên các Action (Quyền ngoại lệ)
        },
      },
    });

    if (!user || !user.password || !user.isActive)
      throw new AppError(
        401,
        MESSAGES.AUTH.ERROR.INVALID_CREDENTIALS,
        ERROR_CODES.AUTH.INVALID_CREDENTIALS
      );

    // 2. Kiểm tra tài khoản có bị khóa do nhập sai quá nhiều lần không?
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const lockMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new AppError(
        403,
        MESSAGES.AUTH.ERROR.ACCOUNT_LOCKED(lockMinutes),
        ERROR_CODES.AUTH.ACCOUNT_LOCKED
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Tăng số lần nhập sai, nếu >= 5 thì khóa 15 phút
      const attempts = user.failedLoginAttempts + 1;
      const maxAttempts = APP_CONFIG.AUTH.MAX_FAILED_LOGIN_ATTEMPTS;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil:
            attempts >= maxAttempts
              ? new Date(Date.now() + APP_CONFIG.AUTH.LOCKOUT_DURATION_MINUTES * 60000)
              : null,
        },
      });
      throw new AppError(
        401,
        MESSAGES.AUTH.ERROR.WRONG_PASSWORD(maxAttempts - attempts),
        ERROR_CODES.AUTH.INVALID_CREDENTIALS
      );
    }

    // Nếu nhập đúng -> Reset số lần sai về 0
    if (user.failedLoginAttempts > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    // 3. Tính toán quyền hạn
    const rolePermissions = user.role.permissions.map((rp) => rp.permission.action);
    const extraPermissions = user.extraPermissions.map((up) => up.permission.action);
    const mergedPermissions = Array.from(new Set([...rolePermissions, ...extraPermissions]));

    // 4. Soft Limit: Giữ tối đa 3 thiết bị đăng nhập
    const activeSessions = await prisma.session.findMany({
      where: { userId: user.id, isRevoked: false, expiresAt: { gt: new Date() } },
      orderBy: { lastActive: 'asc' }, // Sắp xếp từ cũ nhất đến mới nhất
    });

    // Nếu số thiết bị vượt mức, tính toán cần xóa bao nhiêu thiết bị cũ nhất
    if (activeSessions.length >= APP_CONFIG.AUTH.MAX_DEVICES_PER_USER) {
      const numToRevoke = activeSessions.length - APP_CONFIG.AUTH.MAX_DEVICES_PER_USER + 1;
      const sessionsToRevoke = activeSessions.slice(0, numToRevoke);
      const sessionIdsToRevoke = sessionsToRevoke.map((s) => s.id);

      await prisma.session.updateMany({
        where: { id: { in: sessionIdsToRevoke } },
        data: { isRevoked: true },
      });
    }

    // 5. Tạo Refresh Token mới
    const refreshToken = JwtUtil.generateRefreshToken({ id: user.id });
    const expiresAt = new Date(
      Date.now() + (ms(env.JWT_REFRESH_EXPIRES_IN as StringValue) || 604800000)
    );

    // 6. Tạo bản ghi Session trong Database
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt,
        ipAddress: clientMeta.ipAddress,
        userAgent: clientMeta.userAgent,
        deviceId: deviceId || 'unknown',
      },
    });

    // 7. Cấp Access Token
    const accessToken = JwtUtil.generateAccessToken({
      id: user.id,
      role: user.role.name,
      sessionId: session.id,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.profile?.fullName,
        role: user.role.name,
        permissions: mergedPermissions,
        avatarUrl: user.profile?.avatarUrl,
      },
      accessToken,
      refreshToken,
    };
  }

  // 3. REFRESH TOKEN (Cấp lại Token & Xoay vòng Token)
  async refreshToken(dto: RefreshTokenDTO) {
    const { refreshToken } = dto;

    if (!refreshToken)
      throw new AppError(401, MESSAGES.AUTH.ERROR.MISSING_TOKEN, ERROR_CODES.AUTH.MISSING_TOKEN);

    // Tìm session trong DB dựa vào refreshToken
    const session = await prisma.session.findUnique({
      where: { refreshToken },
      include: { user: { include: { role: true } } },
    });

    if (!session)
      throw new AppError(
        401,
        MESSAGES.AUTH.ERROR.INVALID_SESSION,
        ERROR_CODES.AUTH.INVALID_SESSION
      );
    if (session.isRevoked)
      throw new AppError(
        401,
        MESSAGES.AUTH.ERROR.SESSION_REVOKED,
        ERROR_CODES.AUTH.SESSION_REVOKED
      );
    if (new Date() > session.expiresAt)
      throw new AppError(
        401,
        MESSAGES.AUTH.ERROR.SESSION_EXPIRED,
        ERROR_CODES.AUTH.SESSION_EXPIRED
      );

    // REFRESH TOKEN ROTATION (Cấp luôn một Refresh Token mới để thay thế cái cũ)
    const newRefreshToken = JwtUtil.generateRefreshToken({ id: session.user.id });

    // Cấp lại Access Token mới
    const newAccessToken = JwtUtil.generateAccessToken({
      id: session.user.id,
      role: session.user.role.name,
      sessionId: session.id,
    });

    // Cập nhật lastActive
    await prisma.session.update({
      where: { id: session.id },
      data: {
        refreshToken: newRefreshToken, // Xoay vòng Token
        lastActive: new Date(),
      },
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  // 4. QUẢN LÝ THIẾT BỊ
  async getActiveSessions(userId: string) {
    return await prisma.session.findMany({
      where: { userId, isRevoked: false, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        deviceId: true,
        createdAt: true,
        lastActive: true,
      },
      orderBy: { lastActive: 'desc' },
    });
  }

  async revokeDeviceSession(userId: string, sessionId: string) {
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      throw new AppError(
        404,
        MESSAGES.COMMON.ERROR.NOT_FOUND(RESOURCES.SESSION),
        ERROR_CODES.AUTH.SESSION_NOT_FOUND
      );
    }
    await prisma.session.update({ where: { id: sessionId }, data: { isRevoked: true } });
    return true;
  }

  async revokeOtherSessions(userId: string, currentSessionId: string) {
    await prisma.session.updateMany({
      where: {
        userId: userId,
        isRevoked: false,
        id: { not: currentSessionId }, // Không đá thiết bị hiện tại
      },
      data: { isRevoked: true },
    });
    return true;
  }

  // 5. LOGOUT (Đăng xuất)
  async logout(sessionId: string) {
    await prisma.session.update({
      where: { id: sessionId },
      data: { isRevoked: true },
    });
    return true;
  }

  // 6. XÁC THỰC EMAIL (Gửi & Xác nhận OTP)
  async sendVerifyOTP(data: { identifier: string; channel: OtpChannel }) {
    const { identifier, channel } = data;

    // 1. Tìm User (Bằng Email hoặc Phone tùy kênh)
    const user = await prisma.user.findFirst({
      where: channel === OTP_CHANNELS.EMAIL ? { email: identifier } : { phone: identifier },
    });

    if (!user)
      throw new AppError(
        404,
        MESSAGES.COMMON.ERROR.NOT_FOUND(RESOURCES.USER),
        ERROR_CODES.AUTH.USER_NOT_FOUND
      );

    // Check xem kênh đó đã verify chưa
    if (channel === OTP_CHANNELS.EMAIL && user.isEmailVerified)
      throw new AppError(
        400,
        MESSAGES.AUTH.ERROR.EMAIL_ALREADY_VERIFIED,
        ERROR_CODES.AUTH.EMAIL_ALREADY_VERIFIED
      );
    if ((channel === OTP_CHANNELS.SMS || channel === OTP_CHANNELS.ZALO) && user.isPhoneVerified)
      throw new AppError(
        400,
        MESSAGES.AUTH.ERROR.PHONE_ALREADY_VERIFIED,
        ERROR_CODES.AUTH.PHONE_ALREADY_VERIFIED
      );

    // Check cooldown 60s cho cùng một identifier và cùng loại OTP
    const lastOtp = await prisma.otp.findFirst({
      where: { email: identifier, type: 'VERIFY_ACCOUNT' },
      orderBy: { createdAt: 'desc' },
    });

    if (
      lastOtp &&
      Date.now() - lastOtp.createdAt.getTime() < APP_CONFIG.AUTH.OTP_COOLDOWN_SECONDS * 1000
    ) {
      throw new AppError(
        429,
        MESSAGES.AUTH.ERROR.OTP_COOLDOWN(APP_CONFIG.AUTH.OTP_COOLDOWN_SECONDS),
        ERROR_CODES.AUTH.OTP_COOLDOWN
      );
    }

    // 2. Tạo OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(
      Date.now() + APP_CONFIG.AUTH.OTP_VERIFY_EXPIRATION_MINUTES * 60 * 1000
    );
    // Lưu vào DB
    await prisma.otp.create({
      data: { email: identifier, code: otpCode, type: 'VERIFY_ACCOUNT', expiresAt },
    });

    // 3. Thực thi gửi theo Channel
    if (channel === OTP_CHANNELS.EMAIL) {
      await notificationService.sendEmailOTP(identifier, otpCode);
    } else if (channel === OTP_CHANNELS.SMS) {
      await notificationService.sendSmsOTP(identifier, otpCode);
    } else if (channel === OTP_CHANNELS.ZALO) {
      await notificationService.sendZaloOTP(identifier, otpCode);
    }

    return true;
  }

  async verifyOTP(data: { identifier: string; code: string; channel: OtpChannel }) {
    const { identifier, code, channel } = data;

    // Tìm mã OTP
    const otpRecord = await prisma.otp.findFirst({
      where: { email: identifier, code, type: 'VERIFY_ACCOUNT', isUsed: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord)
      throw new AppError(400, MESSAGES.AUTH.ERROR.INVALID_OTP, ERROR_CODES.AUTH.INVALID_OTP);
    if (new Date() > otpRecord.expiresAt)
      throw new AppError(400, MESSAGES.AUTH.ERROR.EXPIRED_OTP, ERROR_CODES.AUTH.EXPIRED_OTP);

    // Transaction an toàn
    await prisma.$transaction([
      prisma.otp.update({ where: { id: otpRecord.id }, data: { isUsed: true } }),
      prisma.user.update({
        where: channel === OTP_CHANNELS.EMAIL ? { email: identifier } : { phone: identifier },
        data:
          channel === OTP_CHANNELS.EMAIL ? { isEmailVerified: true } : { isPhoneVerified: true },
      }),
    ]);

    return true;
  }

  // 7. QUÊN MẬT KHẨU & KHÔI PHỤC MẬT KHẨU
  async forgotPassword(dto: ForgotPasswordDTO) {
    const user = await prisma.user.findUnique({ where: { email: dto.email } });
    if (!user)
      throw new AppError(
        404,
        MESSAGES.COMMON.ERROR.NOT_FOUND(RESOURCES.USER),
        ERROR_CODES.AUTH.USER_NOT_FOUND
      );

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    await prisma.otp.create({
      data: {
        email: dto.email,
        code: otpCode,
        type: 'FORGOT_PASSWORD',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    // console.log(`[MOCK EMAIL] Mã OTP khôi phục mật khẩu của ${dto.email} là: ${otpCode}`);
    await notificationService.sendEmailOTP(dto.email, otpCode);
    return true;
  }

  async resetPassword(dto: ResetPasswordDTO) {
    // 1. Kiểm tra mã OTP
    const otpRecord = await prisma.otp.findFirst({
      where: { email: dto.email, code: dto.code, type: 'FORGOT_PASSWORD', isUsed: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord)
      throw new AppError(400, MESSAGES.AUTH.ERROR.INVALID_OTP, ERROR_CODES.AUTH.INVALID_OTP);
    if (new Date() > otpRecord.expiresAt)
      throw new AppError(400, MESSAGES.AUTH.ERROR.EXPIRED_OTP, ERROR_CODES.AUTH.EXPIRED_OTP);

    // 2. Lấy User TRƯỚC khi chạy Transaction
    const user = await prisma.user.findUnique({ where: { email: dto.email } });
    if (!user)
      throw new AppError(
        404,
        MESSAGES.COMMON.ERROR.NOT_FOUND(RESOURCES.USER),
        ERROR_CODES.AUTH.USER_NOT_FOUND
      );

    // 3. Mã hóa mật khẩu mới
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(dto.newPassword, salt);

    // 4. Thực thi Transaction (Giao dịch an toàn)
    await prisma.$transaction([
      // Đánh dấu OTP đã sử dụng
      prisma.otp.update({
        where: { id: otpRecord.id },
        data: { isUsed: true },
      }),
      // Cập nhật mật khẩu mới (Dùng user.id truy vấn sẽ nhanh hơn dùng email)
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      // Thu hồi toàn bộ phiên đăng nhập cũ (Bắt buộc người dùng phải login lại bằng pass mới)
      prisma.session.updateMany({
        // user.id lúc này đã được TS công nhận chắc chắn là 'string'
        where: { userId: user.id, isRevoked: false },
        data: { isRevoked: true },
      }),
    ]);

    return true;
  }

  // 8. ĐỔI MẬT KHẨU (Khi đã đăng nhập)
  async changePassword(userId: string, dto: ChangePasswordDTO) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user)
      throw new AppError(
        404,
        MESSAGES.COMMON.ERROR.NOT_FOUND(RESOURCES.USER),
        ERROR_CODES.AUTH.USER_NOT_FOUND
      );

    // 1. Kiểm tra mật khẩu cũ
    const isMatch = await bcrypt.compare(dto.currentPassword, user.password!);
    if (!isMatch)
      throw new AppError(
        400,
        MESSAGES.AUTH.ERROR.WRONG_CURRENT_PASSWORD,
        ERROR_CODES.AUTH.WRONG_CURRENT_PASSWORD
      );

    // 2. Mã hóa mật khẩu mới
    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
    return true;
  }
}

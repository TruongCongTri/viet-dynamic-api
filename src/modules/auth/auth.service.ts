import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { env } from '@/common/configs/env.config';
import { JwtUtil } from '@/common/utils/auth/jwt.util';
import { AuthRepository } from './auth.repository';
import { AppError } from '@/common/errors/app.error';
import { notificationService } from '@/common/services/notification.service';

import {
  RegisterDTO,
  LoginDTO,
  ForgotPasswordDTO,
  ResetPasswordDTO,
  RefreshTokenDTO,
  ChangePasswordDTO,
} from './auth.schema';
import { ERROR_CODES } from '@/constants/error-codes';
import { MESSAGES } from '@/constants/messages';
import { RESOURCES } from '@/constants/resources';
import { APP_CONFIG, OTP_CHANNELS, OtpChannel } from '@/constants/app.constant';

export class AuthService {
  private readonly authRepository: AuthRepository;

  constructor() {
    this.authRepository = new AuthRepository();
  }

  // 1. ĐĂNG KÝ (REGISTER)
  async register(data: RegisterDTO) {
    const { email, password, fullName } = data;

    // 1. Kiểm tra email tồn tại
    const existingUser = await this.authRepository.findByEmail(email);
    if (existingUser)
      throw new AppError(
        409,
        MESSAGES.COMMON.ERROR.ALREADY_EXISTS(RESOURCES.EMAIL),
        ERROR_CODES.AUTH.EMAIL_EXISTS
      );

    // 2. Lấy Role STUDENT mặc định
    const studentRole = await this.authRepository.findRoleByName(APP_CONFIG.AUTH.DEFAULT_ROLE);
    if (!studentRole)
      throw new AppError(500, MESSAGES.AUTH.ERROR.ROLE_NOT_FOUND, ERROR_CODES.AUTH.ROLE_NOT_FOUND);

    // 3. Mã hóa Mật khẩu bằng số SALT từ biến môi trường
    const salt = await bcrypt.genSalt(env.BCRYPT_SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);

    return await this.authRepository.createUser({
      email,
      password: hashedPassword,
      role: { connect: { id: studentRole.id } },
      isEmailVerified: false,
      profile: { create: { fullName } },
    });
  }

  // 2. ĐĂNG NHẬP (Bảo vệ 3 lớp: Khoá Spam + Soft Limit thiết bị + Flatten Permissions)
  async login(data: LoginDTO, clientMeta: { ipAddress: string; userAgent: string }) {
    const { email, password, deviceId, rememberMe } = data;

    // 1. Tìm User và "Đào sâu" (Deep Include) để lấy toàn bộ Quyền
    const user = await this.authRepository.findUserForLogin(email);

    if (!user || !user.password || !user.isActive)
      throw new AppError(
        401,
        MESSAGES.AUTH.ERROR.INVALID_CREDENTIALS,
        ERROR_CODES.AUTH.INVALID_CREDENTIALS
      );

    // 2a. Kiểm tra trạng thái QA/QC
    if (user.accountStatus === 'PENDING') {
      throw new AppError(
        403,
        'Your account is pending admin approval.',
        ERROR_CODES.COMMON.FORBIDDEN
      );
    }
    if (user.accountStatus === 'REJECTED') {
      throw new AppError(
        403,
        'Your account application was rejected.',
        ERROR_CODES.COMMON.FORBIDDEN
      );
    }
    if (user.accountStatus === 'SUSPENDED') {
      throw new AppError(
        403,
        'Your account has been suspended by an administrator.',
        ERROR_CODES.COMMON.FORBIDDEN
      );
    }

    // 2b. Kiểm tra tài khoản có bị khóa do nhập sai quá nhiều lần không?
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
      const lockedUntil =
        attempts >= maxAttempts
          ? new Date(Date.now() + APP_CONFIG.AUTH.LOCKOUT_DURATION_MINUTES * 60000)
          : null;

      await this.authRepository.updateUserLoginAttempts(user.id, attempts, lockedUntil);

      throw new AppError(
        401,
        MESSAGES.AUTH.ERROR.WRONG_PASSWORD(maxAttempts - attempts),
        ERROR_CODES.AUTH.INVALID_CREDENTIALS
      );
    }

    // Nếu nhập đúng -> Reset số lần sai về 0
    if (user.failedLoginAttempts > 0) {
      await this.authRepository.updateUserLoginAttempts(user.id, 0, null);
    }

    // 3. Tính toán quyền hạn
    const rolePermissions = user.role.permissions.map((rp) => rp.permission.action);
    const extraPermissions = user.extraPermissions.map((up) => up.permission.action);
    const mergedPermissions = Array.from(new Set([...rolePermissions, ...extraPermissions]));

    // 4. Soft Limit: Giữ tối đa 3 thiết bị đăng nhập
    const activeSessions = await this.authRepository.findActiveSessionsForLogin(user.id);

    // Nếu số thiết bị vượt mức, tính toán cần xóa bao nhiêu thiết bị cũ nhất
    if (activeSessions.length >= APP_CONFIG.AUTH.MAX_DEVICES_PER_USER) {
      const numToRevoke = activeSessions.length - APP_CONFIG.AUTH.MAX_DEVICES_PER_USER + 1;

      const sessionsToRevoke = activeSessions.slice(-numToRevoke);
      const sessionIdsToRevoke = sessionsToRevoke.map((s) => s.id);

      await this.authRepository.revokeSessions(sessionIdsToRevoke);
    }

    // 5. Tạo Refresh Token mới
    const refreshToken = JwtUtil.generateRefreshToken({ id: user.id, jti: crypto.randomUUID() });
    // Tính toán thời gian hết hạn dựa trên rememberMe
    const expiresInDays = rememberMe
      ? APP_CONFIG.AUTH.REMEMBER_ME_EXPIRES_IN_DAYS
      : APP_CONFIG.AUTH.SESSION_EXPIRES_IN_DAYS;

    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    // 6. Tạo bản ghi Session trong Database
    const session = await this.authRepository.createSession({
      userId: user.id,
      refreshToken,
      expiresAt,
      ipAddress: clientMeta.ipAddress,
      userAgent: clientMeta.userAgent,
      deviceId: deviceId || 'unknown',
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
      rememberMe,
      expiresAt,
    };
  }

  // 3. REFRESH TOKEN (Cấp lại Token & Xoay vòng Token)
  async refreshToken(dto: RefreshTokenDTO) {
    const { refreshToken } = dto;

    if (!refreshToken)
      throw new AppError(401, MESSAGES.AUTH.ERROR.MISSING_TOKEN, ERROR_CODES.AUTH.MISSING_TOKEN);

    // Tìm session trong DB dựa vào refreshToken
    const session = await this.authRepository.findSessionByRefreshToken(dto.refreshToken);

    if (!session || session.isRevoked || new Date() > session.expiresAt)
      throw new AppError(
        401,
        MESSAGES.AUTH.ERROR.INVALID_SESSION,
        ERROR_CODES.AUTH.INVALID_SESSION
      );

    // 1. Phân tích trạng thái "Remember Me" từ Session cũ
    // Tính vòng đời cũ (Đổi ra ngày)
    const lifespanInDays = Math.round(
      (session.expiresAt.getTime() - session.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Nếu vòng đời > 1 ngày (VD: 30 ngày) -> Trạng thái là Remember Me
    const isRememberMe = lifespanInDays > APP_CONFIG.AUTH.SESSION_EXPIRES_IN_DAYS;

    // 2. Tính toán ngày hết hạn mới (Gia hạn Session - Rolling Session)
    const newExpiresInDays = isRememberMe
      ? APP_CONFIG.AUTH.REMEMBER_ME_EXPIRES_IN_DAYS
      : APP_CONFIG.AUTH.SESSION_EXPIRES_IN_DAYS;

    const newExpiresAt = new Date(Date.now() + newExpiresInDays * 24 * 60 * 60 * 1000);

    // 3. Xoay vòng Token
    const newRefreshToken = JwtUtil.generateRefreshToken({ id: session.user.id });
    const newAccessToken = JwtUtil.generateAccessToken({
      id: session.user.id,
      role: session.user.role.name,
      sessionId: session.id,
    });

    // 4. Cập nhật vào Database
    await this.authRepository.updateSession(session.id, {
      refreshToken: newRefreshToken,
      lastActive: new Date(),
      expiresAt: newExpiresAt,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      rememberMe: isRememberMe,
      expiresAt: newExpiresAt,
    };
  }

  // 4. QUẢN LÝ THIẾT BỊ
  async getActiveSessions(userId: string) {
    return await this.authRepository.findDeviceSessions(userId);
  }

  async revokeDeviceSession(userId: string, sessionId: string) {
    const session = await this.authRepository.findSessionById(sessionId);
    if (!session || session.userId !== userId) {
      throw new AppError(
        404,
        MESSAGES.COMMON.ERROR.NOT_FOUND(RESOURCES.SESSION),
        ERROR_CODES.AUTH.SESSION_NOT_FOUND
      );
    }
    await this.authRepository.revokeSessions([sessionId]);
    return true;
  }

  async revokeOtherSessions(userId: string, currentSessionId: string) {
    await this.authRepository.revokeOtherSessions(userId, currentSessionId);
    return true;
  }

  // 5. LOGOUT (Đăng xuất)
  async logout(sessionId: string) {
    await this.authRepository.revokeSessions([sessionId]);
    return true;
  }

  // 6. XÁC THỰC EMAIL (Gửi & Xác nhận OTP)
  async sendVerifyOTP(data: { identifier: string; channel: OtpChannel }) {
    const { identifier, channel } = data;

    // 1. Tìm User (Bằng Email hoặc Phone tùy kênh)
    const user = await this.authRepository.findUserByIdentifier(identifier, channel);

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
    const lastOtp = await this.authRepository.findLatestOtp(identifier, 'VERIFY_ACCOUNT');

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
    await this.authRepository.createOtp({
      email: identifier,
      code: otpCode,
      type: 'VERIFY_ACCOUNT',
      expiresAt,
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
    const otpRecord = await this.authRepository.findValidOtp(identifier, code, 'VERIFY_ACCOUNT');

    if (!otpRecord)
      throw new AppError(400, MESSAGES.AUTH.ERROR.INVALID_OTP, ERROR_CODES.AUTH.INVALID_OTP);
    if (new Date() > otpRecord.expiresAt)
      throw new AppError(400, MESSAGES.AUTH.ERROR.EXPIRED_OTP, ERROR_CODES.AUTH.EXPIRED_OTP);

    // Transaction an toàn
    await this.authRepository.verifyAccountTransaction(otpRecord.id, identifier, channel);

    return true;
  }

  // 7. QUÊN MẬT KHẨU & KHÔI PHỤC MẬT KHẨU
  async forgotPassword(dto: ForgotPasswordDTO) {
    const user = await this.authRepository.findByEmail(dto.email);
    if (!user)
      throw new AppError(
        404,
        MESSAGES.COMMON.ERROR.NOT_FOUND(RESOURCES.USER),
        ERROR_CODES.AUTH.USER_NOT_FOUND
      );

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    await this.authRepository.createOtp({
      email: dto.email,
      code: otpCode,
      type: 'FORGOT_PASSWORD',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    // console.log(`[MOCK EMAIL] Mã OTP khôi phục mật khẩu của ${dto.email} là: ${otpCode}`);
    await notificationService.sendEmailOTP(dto.email, otpCode);
    return true;
  }

  async resetPassword(dto: ResetPasswordDTO) {
    // 1. Kiểm tra mã OTP
    const otpRecord = await this.authRepository.findValidOtp(
      dto.email,
      dto.code,
      'FORGOT_PASSWORD'
    );

    if (!otpRecord)
      throw new AppError(400, MESSAGES.AUTH.ERROR.INVALID_OTP, ERROR_CODES.AUTH.INVALID_OTP);
    if (new Date() > otpRecord.expiresAt)
      throw new AppError(400, MESSAGES.AUTH.ERROR.EXPIRED_OTP, ERROR_CODES.AUTH.EXPIRED_OTP);

    // 2. Lấy User TRƯỚC khi chạy Transaction
    const user = await this.authRepository.findByEmail(dto.email);
    if (!user)
      throw new AppError(
        404,
        MESSAGES.COMMON.ERROR.NOT_FOUND(RESOURCES.USER),
        ERROR_CODES.AUTH.USER_NOT_FOUND
      );

    // 3. So sánh mật khẩu mới nhập vào với hash cũ trong DB
    const isSameAsOld = await bcrypt.compare(dto.newPassword, user.password!);
    if (isSameAsOld) {
      throw new AppError(
        400,
        MESSAGES.AUTH.ERROR.PASSWORD_MUST_BE_DIFFERENT,
        ERROR_CODES.AUTH.PASSWORD_MUST_BE_DIFFERENT
      );
    }

    // 3. Mã hóa mật khẩu mới
    const salt = await bcrypt.genSalt(env.BCRYPT_SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(dto.newPassword, salt);

    // 4. Thực thi Transaction (Giao dịch an toàn)
    await this.authRepository.resetPasswordTransaction(otpRecord.id, user.id, hashedPassword);

    // Đổi pass xong phải đá văng mọi thiết bị đang đăng nhập
    await this.adminRevokeAllUserSessions(user.id);

    return true;
  }

  // 8. ĐỔI MẬT KHẨU (Khi đã đăng nhập)
  async changePassword(userId: string, dto: ChangePasswordDTO) {
    const user = await this.authRepository.findById(userId);
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
    const salt = await bcrypt.genSalt(env.BCRYPT_SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(dto.newPassword, salt);

    await this.authRepository.updatePassword(userId, hashedPassword);

    await this.adminRevokeAllUserSessions(userId);

    return true;
  }

  // ==========================================
  // ADMIN OVERRIDE METHODS
  // ==========================================

  /**
   * @description Admin explicitly triggers a password reset email for a user
   */
  async adminTriggerPasswordReset(targetUserId: string) {
    const user = await this.authRepository.findById(targetUserId);

    if (!user) {
      throw new AppError(
        404,
        MESSAGES.COMMON.ERROR.NOT_FOUND(RESOURCES.USER),
        ERROR_CODES.COMMON.RECORD_NOT_FOUND
      );
    }

    // Generate standard reset OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    await this.authRepository.createOtp({
      email: user.email,
      code: otpCode,
      type: 'FORGOT_PASSWORD',
      expiresAt: new Date(Date.now() + APP_CONFIG.AUTH.OTP_FORGOT_EXPIRATION_MINUTES * 60 * 1000),
    });

    console.log(
      `[MOCK EMAIL to ${user.email}] Your Admin has requested a password reset. Your OTP is: ${otpCode}`
    );
    // await notificationService.sendEmailOTP(user.email, otpCode);

    return true;
  }

  /**
   * @description Admin instantly logs a user out of all devices
   */
  async adminRevokeAllUserSessions(targetUserId: string) {
    const activeSessions = await this.authRepository.findActiveSessionsForLogin(targetUserId);

    if (activeSessions.length > 0) {
      const sessionIds = activeSessions.map((s) => s.id);
      await this.authRepository.revokeSessions(sessionIds);
    }

    return activeSessions.length; // Return how many sessions were killed
  }

  /**
   * @description Admin manually verifies a user's email (Bypasses OTP)
   */
  async adminVerifyUserEmail(targetUserId: string) {
    const user = await this.authRepository.findById(targetUserId);

    if (!user) {
      throw new AppError(
        404,
        MESSAGES.COMMON.ERROR.NOT_FOUND(RESOURCES.USER),
        ERROR_CODES.COMMON.RECORD_NOT_FOUND
      );
    }
    if (user.isEmailVerified) {
      throw new AppError(400, 'User email is already verified.', ERROR_CODES.COMMON.INVALID_INPUT);
    }

    // Update the user directly (You will need to ensure this method exists in your Auth or User repository)
    // await prisma.user.update({ where: { id: targetUserId }, data: { isEmailVerified: true } });

    return true;
  }
}

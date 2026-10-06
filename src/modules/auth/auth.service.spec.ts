import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { JwtUtil } from '../../common/utils/auth/jwt.util';
import { notificationService } from '../../common/services/notification.service';
import { APP_CONFIG, OTP_CHANNELS } from '../../constants/app.constant';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// 1. Mock toàn bộ các class/thư viện bên ngoài
jest.mock('./auth.repository');
jest.mock('bcryptjs');
jest.mock('../../common/utils/auth/jwt.util');
jest.mock('../../common/services/notification.service');
jest.mock('crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('mocked-uuid'),
}));

describe('AuthService (Unit Tests - Full Coverage)', () => {
  let authService: AuthService;
  let mockAuthRepo: jest.Mocked<AuthRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthRepo = new AuthRepository() as jest.Mocked<AuthRepository>;

    authService = new AuthService();
    (authService as any).authRepository = mockAuthRepo;
  });

  // ==========================================
  // 1. ĐĂNG KÝ (REGISTER)
  // ==========================================
  describe('register', () => {
    const mockRegisterDTO = {
      email: 'test@example.com',
      password: 'Password123!',
      fullName: 'Test User',
    };

    it('should throw an error if email already exists (409)', async () => {
      mockAuthRepo.findByEmail.mockResolvedValueOnce({ id: '123' } as any);
      await expect(authService.register(mockRegisterDTO)).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('should throw an error if default role is not found (500)', async () => {
      mockAuthRepo.findByEmail.mockResolvedValueOnce(null);
      mockAuthRepo.findRoleByName.mockResolvedValueOnce(null);
      await expect(authService.register(mockRegisterDTO)).rejects.toMatchObject({
        statusCode: 500,
      });
    });

    it('should create a new user successfully', async () => {
      mockAuthRepo.findByEmail.mockResolvedValueOnce(null);
      mockAuthRepo.findRoleByName.mockResolvedValueOnce({ id: 'role-1' } as any);

      (bcrypt.genSalt as jest.Mock<any>).mockResolvedValueOnce('mockSalt');
      (bcrypt.hash as jest.Mock<any>).mockResolvedValueOnce('hashedPassword');
      mockAuthRepo.createUser.mockResolvedValueOnce({
        id: 'user-1',
        email: 'test@example.com',
      } as any);

      const result = await authService.register(mockRegisterDTO);

      expect(mockAuthRepo.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          password: 'hashedPassword',
          isEmailVerified: false,
        })
      );
      expect(result.id).toBe('user-1');
    });
  });

  // ==========================================
  // 2. ĐĂNG NHẬP (LOGIN)
  // ==========================================
  describe('login', () => {
    const mockLoginDTO = {
      email: 'test@example.com',
      password: 'Password123!',
      rememberMe: false,
      deviceId: 'device-1',
    };
    const mockClientMeta = { ipAddress: '127.0.0.1', userAgent: 'Jest' };

    it('should throw error if user not found, missing password, or inactive (401)', async () => {
      mockAuthRepo.findUserForLogin.mockResolvedValueOnce(null);
      await expect(authService.login(mockLoginDTO, mockClientMeta)).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it('should throw error if account status is PENDING, REJECTED, or SUSPENDED (403)', async () => {
      const baseUser = { password: 'pwd', isActive: true };

      // Test PENDING
      mockAuthRepo.findUserForLogin.mockResolvedValueOnce({
        ...baseUser,
        accountStatus: 'PENDING',
      } as any);
      await expect(authService.login(mockLoginDTO, mockClientMeta)).rejects.toMatchObject({
        statusCode: 403,
      });

      // Test REJECTED
      mockAuthRepo.findUserForLogin.mockResolvedValueOnce({
        ...baseUser,
        accountStatus: 'REJECTED',
      } as any);
      await expect(authService.login(mockLoginDTO, mockClientMeta)).rejects.toMatchObject({
        statusCode: 403,
      });

      // Test SUSPENDED
      mockAuthRepo.findUserForLogin.mockResolvedValueOnce({
        ...baseUser,
        accountStatus: 'SUSPENDED',
      } as any);
      await expect(authService.login(mockLoginDTO, mockClientMeta)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('should throw error if account is currently locked (403)', async () => {
      const futureDate = new Date(Date.now() + 10 * 60000); // Khóa 10 phút nữa
      mockAuthRepo.findUserForLogin.mockResolvedValueOnce({
        password: 'pwd',
        isActive: true,
        accountStatus: 'APPROVED',
        lockedUntil: futureDate,
      } as any);
      await expect(authService.login(mockLoginDTO, mockClientMeta)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('should increment login attempts and lock account if max attempts reached (401)', async () => {
      mockAuthRepo.findUserForLogin.mockResolvedValueOnce({
        id: 'user-1',
        password: 'hashedPassword',
        isActive: true,
        accountStatus: 'APPROVED',
        failedLoginAttempts: APP_CONFIG.AUTH.MAX_FAILED_LOGIN_ATTEMPTS - 1,
        lockedUntil: null,
      } as any);
      (bcrypt.compare as jest.Mock<any>).mockResolvedValueOnce(false);

      await expect(authService.login(mockLoginDTO, mockClientMeta)).rejects.toMatchObject({
        statusCode: 401,
      });
      expect(mockAuthRepo.updateUserLoginAttempts).toHaveBeenCalledWith(
        'user-1',
        APP_CONFIG.AUTH.MAX_FAILED_LOGIN_ATTEMPTS,
        expect.any(Date) // Thời gian khóa đã được set
      );
    });

    it('should revoke oldest session if soft limit is exceeded', async () => {
      const mockUser = {
        id: 'user-1',
        password: 'hashedPassword',
        isActive: true,
        accountStatus: 'APPROVED',
        failedLoginAttempts: 0,
        role: { name: 'STUDENT', permissions: [] },
        extraPermissions: [],
        profile: { fullName: 'Tester' },
      };
      mockAuthRepo.findUserForLogin.mockResolvedValueOnce(mockUser as any);
      (bcrypt.compare as jest.Mock<any>).mockResolvedValueOnce(true);

      // Giả lập vượt quá số thiết bị cho phép
      const mockSessions = [{ id: 'session-1' }, { id: 'session-2' }, { id: 'session-oldest' }];
      mockAuthRepo.findActiveSessionsForLogin.mockResolvedValueOnce(mockSessions as any);
      mockAuthRepo.createSession.mockResolvedValueOnce({ id: 'new-session' } as any);

      await authService.login(mockLoginDTO, mockClientMeta);

      // Phải xóa 1 session cũ nhất
      expect(mockAuthRepo.revokeSessions).toHaveBeenCalledWith(['session-oldest']);
    });

    it('should login successfully, reset failed attempts, and return tokens', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashedPassword',
        isActive: true,
        accountStatus: 'APPROVED',
        failedLoginAttempts: 2, // Đã từng nhập sai 2 lần
        role: { name: 'STUDENT', permissions: [{ permission: { action: 'READ' } }] },
        extraPermissions: [{ permission: { action: 'WRITE' } }],
        profile: { fullName: 'Test User' },
      };
      mockAuthRepo.findUserForLogin.mockResolvedValueOnce(mockUser as any);
      (bcrypt.compare as jest.Mock<any>).mockResolvedValueOnce(true);
      mockAuthRepo.findActiveSessionsForLogin.mockResolvedValueOnce([]);

      (JwtUtil.generateRefreshToken as jest.Mock<any>).mockReturnValue('mock-refresh-token');
      (JwtUtil.generateAccessToken as jest.Mock<any>).mockReturnValue('mock-access-token');
      mockAuthRepo.createSession.mockResolvedValueOnce({ id: 'session-1' } as any);

      const result = await authService.login({ ...mockLoginDTO, rememberMe: true }, mockClientMeta);

      expect(mockAuthRepo.updateUserLoginAttempts).toHaveBeenCalledWith('user-1', 0, null);
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.user.permissions).toEqual(expect.arrayContaining(['READ', 'WRITE'])); // Đảm bảo quyền được gộp
    });
  });

  // ==========================================
  // 3. REFRESH TOKEN
  // ==========================================
  describe('refreshToken', () => {
    it('should throw error if token is missing (401)', async () => {
      await expect(authService.refreshToken({ refreshToken: '' })).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it('should throw error if session is invalid, revoked, or expired (401)', async () => {
      mockAuthRepo.findSessionByRefreshToken.mockResolvedValueOnce({ isRevoked: true } as any);
      await expect(authService.refreshToken({ refreshToken: 'fake' })).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it('should correctly rotate tokens and recalculate rememberMe state', async () => {
      // Giả lập session cũ có lifespan dài (Remember Me = true)
      const now = Date.now();
      const createdAt = new Date(now - 40 * 24 * 60 * 60 * 1000); // Tạo từ 40 ngày trước
      const expiresAt = new Date(now + 10 * 24 * 60 * 60 * 1000); // 10 ngày NỮA mới hết hạn (Còn hạn)

      const mockSession = {
        id: 'session-1',
        isRevoked: false,
        expiresAt,
        createdAt,
        user: { id: 'user-1', role: { name: 'STUDENT' } },
      };
      mockAuthRepo.findSessionByRefreshToken.mockResolvedValueOnce(mockSession as any);

      (JwtUtil.generateRefreshToken as jest.Mock<any>).mockReturnValue('new-refresh');
      (JwtUtil.generateAccessToken as jest.Mock<any>).mockReturnValue('new-access');

      const result = await authService.refreshToken({ refreshToken: 'valid-token' });

      expect(mockAuthRepo.updateSession).toHaveBeenCalled();
      expect(result.accessToken).toBe('new-access');
      expect(result.rememberMe).toBe(true);
    });
  });

  // ==========================================
  // 4. QUẢN LÝ THIẾT BỊ & LOGOUT
  // ==========================================
  describe('Session Management & Logout', () => {
    it('getActiveSessions should return active sessions', async () => {
      mockAuthRepo.findDeviceSessions.mockResolvedValueOnce([{ id: 's1' }] as any);
      expect(await authService.getActiveSessions('user-1')).toHaveLength(1);
    });

    it('revokeDeviceSession should throw 404 if not found or unauthorized', async () => {
      mockAuthRepo.findSessionById.mockResolvedValueOnce({ userId: 'other-user' } as any);
      await expect(authService.revokeDeviceSession('user-1', 's1')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('revokeDeviceSession should successfully revoke', async () => {
      mockAuthRepo.findSessionById.mockResolvedValueOnce({ userId: 'user-1' } as any);
      await authService.revokeDeviceSession('user-1', 's1');
      expect(mockAuthRepo.revokeSessions).toHaveBeenCalledWith(['s1']);
    });

    it('revokeOtherSessions should execute', async () => {
      await authService.revokeOtherSessions('u1', 's1');
      expect(mockAuthRepo.revokeOtherSessions).toHaveBeenCalledWith('u1', 's1');
    });

    it('logout should revoke current session', async () => {
      await authService.logout('s1');
      expect(mockAuthRepo.revokeSessions).toHaveBeenCalledWith(['s1']);
    });
  });

  // ==========================================
  // 5. XÁC THỰC EMAIL & ĐIỆN THOẠI (OTP)
  // ==========================================
  describe('sendVerifyOTP', () => {
    it('should throw 404 if user not found', async () => {
      mockAuthRepo.findUserByIdentifier.mockResolvedValueOnce(null);
      await expect(
        authService.sendVerifyOTP({ identifier: 'test@ex.com', channel: 'EMAIL' })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 400 if EMAIL is already verified', async () => {
      mockAuthRepo.findUserByIdentifier.mockResolvedValueOnce({ isEmailVerified: true } as any);
      await expect(
        authService.sendVerifyOTP({ identifier: 'test@ex.com', channel: 'EMAIL' })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should throw 400 if PHONE is already verified (SMS/ZALO)', async () => {
      mockAuthRepo.findUserByIdentifier.mockResolvedValueOnce({ isPhoneVerified: true } as any);
      await expect(
        authService.sendVerifyOTP({ identifier: '0123', channel: 'ZALO' })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should throw 429 if OTP is in cooldown', async () => {
      mockAuthRepo.findUserByIdentifier.mockResolvedValueOnce({ isEmailVerified: false } as any);
      mockAuthRepo.findLatestOtp.mockResolvedValueOnce({ createdAt: new Date() } as any); // Vừa gửi xong
      await expect(
        authService.sendVerifyOTP({ identifier: 'test@ex.com', channel: 'EMAIL' })
      ).rejects.toMatchObject({ statusCode: 429 });
    });

    it('should successfully route OTP based on Channel', async () => {
      mockAuthRepo.findUserByIdentifier.mockResolvedValue({
        isEmailVerified: false,
        isPhoneVerified: false,
      } as any);
      mockAuthRepo.findLatestOtp.mockResolvedValue(null);

      await authService.sendVerifyOTP({ identifier: 'test@ex.com', channel: 'EMAIL' });
      expect(notificationService.sendEmailOTP).toHaveBeenCalled();

      await authService.sendVerifyOTP({ identifier: '0123', channel: 'SMS' });
      expect(notificationService.sendSmsOTP).toHaveBeenCalled();

      await authService.sendVerifyOTP({ identifier: '0123', channel: 'ZALO' });
      expect(notificationService.sendZaloOTP).toHaveBeenCalled();
    });
  });

  describe('verifyOTP', () => {
    const dto = { identifier: 'test@ex.com', code: '123456', channel: OTP_CHANNELS.EMAIL };

    it('should throw 400 if OTP is invalid or expired', async () => {
      mockAuthRepo.findValidOtp.mockResolvedValueOnce(null);
      await expect(authService.verifyOTP(dto)).rejects.toMatchObject({ statusCode: 400 });

      mockAuthRepo.findValidOtp.mockResolvedValueOnce({
        expiresAt: new Date(Date.now() - 1000),
      } as any);
      await expect(authService.verifyOTP(dto)).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should verify account via transaction', async () => {
      mockAuthRepo.findValidOtp.mockResolvedValueOnce({
        id: 'otp-1',
        expiresAt: new Date(Date.now() + 1000),
      } as any);
      await authService.verifyOTP(dto);
      expect(mockAuthRepo.verifyAccountTransaction).toHaveBeenCalledWith(
        'otp-1',
        dto.identifier,
        dto.channel
      );
    });
  });

  // ==========================================
  // 6. QUÊN & ĐỔI MẬT KHẨU
  // ==========================================
  describe('forgotPassword', () => {
    it('should throw 404 if email not found', async () => {
      mockAuthRepo.findByEmail.mockResolvedValueOnce(null);
      await expect(authService.forgotPassword({ email: 'x@x.com' })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should generate and send forgot password OTP', async () => {
      mockAuthRepo.findByEmail.mockResolvedValueOnce({ id: 'u1' } as any);
      await authService.forgotPassword({ email: 'x@x.com' });
      expect(mockAuthRepo.createOtp).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const dto = { email: 'x@x.com', code: '123', newPassword: 'NewPassword123!' };

    it('should throw errors for invalid OTP or Missing User (400, 404)', async () => {
      mockAuthRepo.findValidOtp.mockResolvedValueOnce(null);
      await expect(authService.resetPassword(dto)).rejects.toMatchObject({ statusCode: 400 });

      mockAuthRepo.findValidOtp.mockResolvedValueOnce({
        expiresAt: new Date(Date.now() + 1000),
      } as any);
      mockAuthRepo.findByEmail.mockResolvedValueOnce(null);
      await expect(authService.resetPassword(dto)).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 400 if new password matches the old password', async () => {
      mockAuthRepo.findValidOtp.mockResolvedValueOnce({
        expiresAt: new Date(Date.now() + 1000),
      } as any);
      mockAuthRepo.findByEmail.mockResolvedValueOnce({ id: 'u1', password: 'old' } as any);
      (bcrypt.compare as jest.Mock<any>).mockResolvedValueOnce(true);

      await expect(authService.resetPassword(dto)).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should reset password AND call adminRevokeAllUserSessions', async () => {
      mockAuthRepo.findValidOtp.mockResolvedValueOnce({
        id: 'otp-1',
        expiresAt: new Date(Date.now() + 1000),
      } as any);
      mockAuthRepo.findByEmail.mockResolvedValueOnce({ id: 'u1', password: 'old' } as any);
      (bcrypt.compare as jest.Mock<any>).mockResolvedValueOnce(false);
      (bcrypt.hash as jest.Mock<any>).mockResolvedValueOnce('new-hash');

      // Mock cho hàm adminRevokeAllUserSessions bên trong gọi
      mockAuthRepo.findActiveSessionsForLogin.mockResolvedValueOnce([{ id: 's1' }] as any);

      await authService.resetPassword(dto);

      expect(mockAuthRepo.resetPasswordTransaction).toHaveBeenCalledWith('otp-1', 'u1', 'new-hash');
      expect(mockAuthRepo.revokeSessions).toHaveBeenCalledWith(['s1']); // Đảm bảo có đá văng thiết bị
    });
  });

  describe('changePassword', () => {
    const dto = { currentPassword: 'OldPassword123!', newPassword: 'NewPassword123!' };

    it('should throw 404 if user not found, 400 if wrong current password', async () => {
      (mockAuthRepo as any).findById.mockResolvedValueOnce(null);
      await expect(authService.changePassword('u1', dto)).rejects.toMatchObject({
        statusCode: 404,
      });

      (mockAuthRepo as any).findById.mockResolvedValueOnce({ id: 'u1', password: 'old' } as any);
      (bcrypt.compare as jest.Mock<any>).mockResolvedValueOnce(false);
      await expect(authService.changePassword('u1', dto)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should change password AND call adminRevokeAllUserSessions', async () => {
      (mockAuthRepo as any).findById.mockResolvedValueOnce({ id: 'u1', password: 'old' } as any);
      (bcrypt.compare as jest.Mock<any>).mockResolvedValueOnce(true);
      (bcrypt.hash as jest.Mock<any>).mockResolvedValueOnce('new-hash');

      // Mock cho hàm adminRevokeAllUserSessions bên trong gọi
      mockAuthRepo.findActiveSessionsForLogin.mockResolvedValueOnce([{ id: 's1' }] as any);

      await authService.changePassword('u1', dto);

      expect(mockAuthRepo.updatePassword).toHaveBeenCalledWith('u1', 'new-hash');
      expect(mockAuthRepo.revokeSessions).toHaveBeenCalledWith(['s1']); // Đảm bảo có đá văng thiết bị
    });
  });

  // ==========================================
  // 7. ADMIN OVERRIDES
  // ==========================================
  describe('Admin Override Methods', () => {
    it('adminTriggerPasswordReset should create OTP if user exists', async () => {
      (mockAuthRepo as any).findById.mockResolvedValueOnce(null);
      await expect(authService.adminTriggerPasswordReset('u1')).rejects.toMatchObject({
        statusCode: 404,
      });

      (mockAuthRepo as any).findById.mockResolvedValueOnce({ email: 'u@u.com' } as any);
      await authService.adminTriggerPasswordReset('u1');
      expect(mockAuthRepo.createOtp).toHaveBeenCalled();
    });

    it('adminRevokeAllUserSessions should revoke active sessions and return count', async () => {
      mockAuthRepo.findActiveSessionsForLogin.mockResolvedValueOnce([
        { id: 's1' },
        { id: 's2' },
      ] as any);
      const count = await authService.adminRevokeAllUserSessions('u1');
      expect(mockAuthRepo.revokeSessions).toHaveBeenCalledWith(['s1', 's2']);
      expect(count).toBe(2);
    });

    it('adminVerifyUserEmail should throw 400 if already verified, or return true', async () => {
      (mockAuthRepo as any).findById.mockResolvedValueOnce(null);
      await expect(authService.adminVerifyUserEmail('u1')).rejects.toMatchObject({
        statusCode: 404,
      });

      (mockAuthRepo as any).findById.mockResolvedValueOnce({ isEmailVerified: true } as any);
      await expect(authService.adminVerifyUserEmail('u1')).rejects.toMatchObject({
        statusCode: 400,
      });

      (mockAuthRepo as any).findById.mockResolvedValueOnce({ isEmailVerified: false } as any);
      expect(await authService.adminVerifyUserEmail('u1')).toBe(true);
    });
  });
});

import * as bcrypt from 'bcryptjs';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Buffer } from 'buffer';

// --- MOCKS ---
jest.mock('./user.repository');
jest.mock('bcryptjs');

describe('UserService (Unit Tests - Full Coverage)', () => {
  let userService: UserService;
  let mockUserRepo: jest.Mocked<UserRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepo = new UserRepository() as jest.Mocked<UserRepository>;

    userService = new UserService();
    // Thay thế repo thực tế bằng repo mock
    (userService as any).userRepository = mockUserRepo;
  });

  // ==========================================
  // [A] USER PROFILE MANAGEMENT
  // ==========================================
  describe('getMyProfile', () => {
    it('should throw 404 if user is not found', async () => {
      (mockUserRepo as any).getUserProfile.mockResolvedValueOnce(null);
      await expect(userService.getMyProfile('u1')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should combine permissions and flatten profile data correctly', async () => {
      const rawData = {
        id: 'u1',
        email: 'test@ex.com',
        phone: '0123',
        isEmailVerified: true,
        authProvider: 'LOCAL',
        createdAt: new Date(),
        profile: { fullName: 'Test User', avatarUrl: 'img.jpg', bio: 'Hello', slug: 'test-user' },
        role: { name: 'ADMIN', permissions: [{ permission: { action: 'READ' } }] },
        extraPermissions: [{ permission: { action: 'WRITE' } }, { permission: { action: 'READ' } }], // Test trùng quyền
      };

      (mockUserRepo as any).getUserProfile.mockResolvedValueOnce(rawData);

      const result = await userService.getMyProfile('u1');

      expect(result.id).toBe('u1');
      expect(result.profile.fullName).toBe('Test User');
      expect(result.accessControl.role).toBe('ADMIN');
      // Set lọc quyền trùng, nên READ chỉ xuất hiện 1 lần
      expect(result.accessControl.permissions).toEqual(expect.arrayContaining(['READ', 'WRITE']));
      expect(result.accessControl.permissions.length).toBe(2);
    });

    it('should handle missing profile or role safely (Fallbacks)', async () => {
      const rawData = {
        id: 'u2',
        email: 'test2@ex.com',
        extraPermissions: [],
        // Không có profile và role
      };
      (mockUserRepo as any).getUserProfile.mockResolvedValueOnce(rawData);

      const result = await userService.getMyProfile('u2');
      expect(result.profile.fullName).toBeNull();
      expect(result.accessControl.role).toBe('STUDENT'); // Giá trị mặc định
      expect(result.accessControl.permissions).toEqual([]);
    });
  });

  describe('updateMyProfile', () => {
    it('should throw 409 if new phone is already taken', async () => {
      (mockUserRepo as any).checkPhoneExists.mockResolvedValueOnce(true); // Có người xài rồi

      await expect(
        userService.updateMyProfile('u1', { phone: '0999999999' })
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('should update phone and profile data successfully', async () => {
      const dto = { phone: '0888888888', fullName: 'New Name', bio: undefined }; // bio undefined sẽ bị lọc

      (mockUserRepo as any).checkPhoneExists.mockResolvedValueOnce(false);
      (mockUserRepo as any).updateUserPhone.mockResolvedValueOnce({});
      (mockUserRepo as any).upsertUserProfile.mockResolvedValueOnce({});

      // Mock cho hàm getMyProfile gọi ở cuối
      jest
        .spyOn(userService, 'getMyProfile')
        .mockResolvedValueOnce({ id: 'u1', profile: { fullName: 'New Name' } } as any);

      const result = await userService.updateMyProfile('u1', dto);

      expect(mockUserRepo.updateUserPhone).toHaveBeenCalledWith('u1', '0888888888');
      expect(mockUserRepo.upsertUserProfile).toHaveBeenCalledWith('u1', { fullName: 'New Name' }); // Bio bị gạt bỏ
      expect(result.profile.fullName).toBe('New Name');
    });
  });

  describe('updateAvatar', () => {
    it('should throw 400 if no file is provided', async () => {
      await expect(userService.updateAvatar('u1', null)).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should update avatar URL and return it', async () => {
      (mockUserRepo as any).updateAvatarUrl.mockResolvedValueOnce({});
      const result = await userService.updateAvatar('u1', { buffer: Buffer.from('mock') });

      expect(mockUserRepo.updateAvatarUrl).toHaveBeenCalledWith(
        'u1',
        expect.stringContaining('https://vietdynamic.com/uploads/avatars/')
      );
      expect(result.avatarUrl).toBeDefined();
    });
  });

  // ==========================================
  // [B] SESSION & SECURITY MANAGEMENT
  // ==========================================
  describe('getMySessions', () => {
    it('should format and return sessions list', async () => {
      const dbSessions = [
        {
          id: 's1',
          userAgent: 'Chrome',
          ipAddress: '192.168.1.1',
          lastActive: new Date(),
          createdAt: new Date(),
        },
        {
          id: 's2',
          userAgent: null,
          ipAddress: null,
          lastActive: new Date(),
          createdAt: new Date(),
        }, // Test Fallback
      ];
      (mockUserRepo as any).getActiveSessions.mockResolvedValueOnce(dbSessions);

      const result = await userService.getMySessions('u1');
      expect(result).toHaveLength(2);
      expect(result[0].ip).toBe('192.168.1.1');
      expect(result[1].device).toBe('Thiết bị không xác định'); // Test giá trị mặc định
    });
  });

  describe('revokeSession', () => {
    it('should throw 404 if session is not found or already revoked (count: 0)', async () => {
      (mockUserRepo as any).revokeSession.mockResolvedValueOnce({ count: 0 });
      await expect(userService.revokeSession('u1', 's1')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should revoke session successfully', async () => {
      (mockUserRepo as any).revokeSession.mockResolvedValueOnce({ count: 1 });
      const result = await userService.revokeSession('u1', 's1');
      expect(result.message).toBeDefined();
    });
  });

  describe('revokeAllOtherSessions', () => {
    it('should throw 400 if current session ID is missing', async () => {
      await expect(userService.revokeAllOtherSessions('u1', '')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should revoke all other sessions successfully', async () => {
      (mockUserRepo as any).revokeAllOtherSessions.mockResolvedValueOnce({ count: 3 });
      const result = await userService.revokeAllOtherSessions('u1', 'current-s1');
      expect(result.message).toContain('3');
    });
  });

  describe('deleteMyAccount', () => {
    it('should throw 400 if password is not provided', async () => {
      await expect(userService.deleteMyAccount('u1', '')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should throw 404 if user does not exist', async () => {
      (mockUserRepo as any).findUserWithTaughtCourses.mockResolvedValueOnce(null);
      await expect(userService.deleteMyAccount('u1', 'pass')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should throw 401 if password does not match', async () => {
      (mockUserRepo as any).findUserWithTaughtCourses.mockResolvedValueOnce({ password: 'hash' });
      (bcrypt.compare as jest.Mock<any>).mockResolvedValueOnce(false); // Nhập sai

      await expect(userService.deleteMyAccount('u1', 'wrongpass')).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it('should throw 403 if user is an instructor with PUBLISHED courses', async () => {
      const userDb = {
        password: 'hash',
        taughtCourses: [
          { course: { status: 'DRAFT' } },
          { course: { status: 'PUBLISHED' } }, // Bị vướng khóa học đang xuất bản
        ],
      };
      (mockUserRepo as any).findUserWithTaughtCourses.mockResolvedValueOnce(userDb);
      (bcrypt.compare as jest.Mock<any>).mockResolvedValueOnce(true);

      await expect(userService.deleteMyAccount('u1', 'rightpass')).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('should successfully delete account if conditions are met', async () => {
      const userDb = {
        password: 'hash',
        taughtCourses: [{ course: { status: 'DRAFT' } }], // DRAFT thì vẫn xóa được
      };
      (mockUserRepo as any).findUserWithTaughtCourses.mockResolvedValueOnce(userDb);
      (bcrypt.compare as jest.Mock<any>).mockResolvedValueOnce(true);
      (mockUserRepo as any).deleteUserAccount.mockResolvedValueOnce({});

      const result = await userService.deleteMyAccount('u1', 'rightpass');
      expect(mockUserRepo.deleteUserAccount).toHaveBeenCalledWith('u1');
      expect(result.message).toBeDefined();
    });
  });

  describe('requestEmailChange', () => {
    it('should throw 404 if current user not found', async () => {
      (mockUserRepo as any).findUserById.mockResolvedValueOnce(null);
      await expect(userService.requestEmailChange('u1', 'new@ex.com')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should throw 400 if new email is identical to current email', async () => {
      (mockUserRepo as any).findUserById.mockResolvedValueOnce({ email: 'old@ex.com' });
      await expect(userService.requestEmailChange('u1', 'old@ex.com')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should throw 409 if new email is already in use by someone else', async () => {
      (mockUserRepo as any).findUserById.mockResolvedValueOnce({ email: 'old@ex.com' });
      (mockUserRepo as any).checkEmailExists.mockResolvedValueOnce(true); // Có người xài rồi

      await expect(userService.requestEmailChange('u1', 'new@ex.com')).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('should generate OTP and save to DB successfully', async () => {
      (mockUserRepo as any).findUserById.mockResolvedValueOnce({ email: 'old@ex.com' });
      (mockUserRepo as any).checkEmailExists.mockResolvedValueOnce(false);
      (mockUserRepo as any).createEmailChangeOtp.mockResolvedValueOnce({});

      // Đón lõng console.log
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const result = await userService.requestEmailChange('u1', 'new@ex.com');

      expect(mockUserRepo.createEmailChangeOtp).toHaveBeenCalledWith(
        'new@ex.com',
        expect.any(String), // OTP 6 số
        expect.any(Date) // Thời gian hết hạn
      );
      expect(consoleSpy).toHaveBeenCalledTimes(2); // 1 cảnh báo mail cũ, 1 OTP mail mới
      expect(result.message).toBeDefined();

      consoleSpy.mockRestore(); // Trả lại console.log sau khi test xong
    });
  });
});

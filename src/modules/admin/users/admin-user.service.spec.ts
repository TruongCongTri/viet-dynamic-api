import { AdminUserService } from './admin-user.service';
import { AdminUserRepository } from './admin-user.repository';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('./admin-user.repository');

describe('AdminUserService (Unit Tests)', () => {
  let adminUserService: AdminUserService;
  let mockRepo: jest.Mocked<AdminUserRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = new AdminUserRepository() as jest.Mocked<AdminUserRepository>;
    adminUserService = new AdminUserService();
    (adminUserService as any).adminUserRepo = mockRepo;
  });

  // ==========================================
  // [A] TRUY XUẤT DỮ LIỆU
  // ==========================================
  describe('Get Users & Detail', () => {
    it('1. Nên lấy danh sách Users và phân trang chuẩn', async () => {
      mockRepo.findUsers.mockResolvedValueOnce({ total: 100, users: [{ id: 'u1' } as any] });
      const res = await adminUserService.getUsers({ page: 2, limit: 10 });

      expect(res.data).toHaveLength(1);
      expect(res.meta.total).toBeDefined();
    });

    it('2. Nên lấy chi tiết User thành công', async () => {
      mockRepo.findUserDetail.mockResolvedValueOnce({ id: 'u1', email: 'test@ex.com' } as any);
      const res = await adminUserService.getUserDetail('u1');
      expect(res.email).toBe('test@ex.com');
    });

    it('3. Nên ném 404 nếu lấy chi tiết User không tồn tại', async () => {
      mockRepo.findUserDetail.mockResolvedValueOnce(null);
      await expect(adminUserService.getUserDetail('u2')).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ==========================================
  // [B] PHÂN QUYỀN & TRẠNG THÁI
  // ==========================================
  describe('Roles, Status & Permissions', () => {
    it('4. Nên ném 403 (Anti-Suicide) khi Admin tự đổi Role của mình', async () => {
      await expect(
        adminUserService.changeUserRole('admin-1', 'admin-1', 'role-2')
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('5. Nên đổi Role người khác thành công', async () => {
      mockRepo.updateUserRole.mockResolvedValueOnce({} as any);
      const res = await adminUserService.changeUserRole('admin-1', 'user-2', 'role-2');
      expect(res.message).toBe('Cập nhật phân quyền thành công.');
    });

    it('6. Nên ném 403 (Anti-Suicide) khi Admin tự khóa tài khoản của mình', async () => {
      await expect(
        adminUserService.changeUserStatus('admin-1', 'admin-1', false)
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('7. Nên Khóa tài khoản (Ban) và thu hồi toàn bộ JWT Sessions', async () => {
      mockRepo.updateUserStatus.mockResolvedValueOnce({} as any);
      mockRepo.revokeAllUserSessions.mockResolvedValueOnce({ count: 2 } as any);

      const res = await adminUserService.changeUserStatus('admin-1', 'user-2', false); // false = BAN
      expect(res.message).toContain('khóa tài khoản và đăng xuất');
      expect(mockRepo.revokeAllUserSessions).toHaveBeenCalledWith('user-2'); // Đảm bảo gọi hàm thu hồi session
    });

    it('8. Nên Mở khóa tài khoản (Unban) thành công', async () => {
      mockRepo.updateUserStatus.mockResolvedValueOnce({} as any);

      const res = await adminUserService.changeUserStatus('admin-1', 'user-2', true); // true = ACTIVE
      expect(res.message).toBe('Đã mở khóa tài khoản.');
      expect(mockRepo.revokeAllUserSessions).not.toHaveBeenCalled(); // Không được gọi hàm thu hồi
    });

    it('9. Nên ghi đè quyền ngoại lệ thành công', async () => {
      mockRepo.updateExtraPermissions.mockResolvedValueOnce({} as any);
      const res = await adminUserService.overridePermissions('user-1', ['perm-1']);
      expect(res.message).toBe('Đã ghi đè quyền ngoại lệ thành công.');
    });
  });

  // ==========================================
  // [C] CAN THIỆP HỆ THỐNG
  // ==========================================
  describe('System Interventions', () => {
    it('10. Nên đá tất cả session của User thành công', async () => {
      mockRepo.revokeAllUserSessions.mockResolvedValueOnce({ count: 5 } as any);
      const res = await adminUserService.revokeAllSessions('user-1');
      expect(res.message).toBe('Đã cưỡng chế đăng xuất khỏi 5 thiết bị.');
    });

    it('11. Nên ném lỗi 400 nếu học viên đã có khóa học B2B (isNew = false)', async () => {
      mockRepo.createManualEnrollment.mockResolvedValueOnce({
        isNew: false,
        enrollment: {},
      } as any);
      await expect(adminUserService.enrollCourseB2B('user-1', 'course-1')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('12. Nên cấp khóa học B2B thành công (isNew = true)', async () => {
      mockRepo.createManualEnrollment.mockResolvedValueOnce({ isNew: true, enrollment: {} } as any);
      const res = await adminUserService.enrollCourseB2B('user-1', 'course-1');
      expect(res.message).toContain('thành công');
    });

    it('13. Nên thu hồi quyền truy cập khóa học thành công', async () => {
      mockRepo.deleteEnrollment.mockResolvedValueOnce({} as any);
      const res = await adminUserService.revokeCourseAccess('user-1', 'course-1');
      expect(res.message).toContain('Đã thu hồi');
    });

    it('14. Nên ném lỗi 404 nếu thu hồi khóa học mà học viên chưa sở hữu', async () => {
      mockRepo.deleteEnrollment.mockRejectedValueOnce(new Error('Not found'));
      await expect(adminUserService.revokeCourseAccess('user-1', 'course-1')).rejects.toMatchObject(
        { statusCode: 404 }
      );
    });
  });
});

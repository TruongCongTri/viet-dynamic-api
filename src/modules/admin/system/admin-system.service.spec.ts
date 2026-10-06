import { AdminSystemService } from './admin-system.service';
import { AdminSystemRepository } from './admin-system.repository';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock Repository
jest.mock('./admin-system.repository');

describe('AdminSystemService (Unit Tests)', () => {
  let adminSystemService: AdminSystemService;
  let mockRepo: jest.Mocked<AdminSystemRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = new AdminSystemRepository() as jest.Mocked<AdminSystemRepository>;
    adminSystemService = new AdminSystemService();
    (adminSystemService as any).systemRepo = mockRepo;
  });

  // ==========================================
  // [A] HEALTH CHECK
  // ==========================================
  describe('getSystemHealth', () => {
    it('1. Nên trả về trạng thái HEALTHY nếu DB kết nối tốt', async () => {
      mockRepo.checkDatabaseConnection.mockResolvedValueOnce(true);
      const res = await adminSystemService.getSystemHealth();

      expect(res.status).toBe('HEALTHY');
      expect(res.services.database).toBe('UP');
      expect(res.metrics).toBeDefined();
    });

    it('2. Nên ném lỗi 503 nếu DB mất kết nối', async () => {
      mockRepo.checkDatabaseConnection.mockResolvedValueOnce(false);

      await expect(adminSystemService.getSystemHealth()).rejects.toMatchObject({
        statusCode: 503,
        message: 'Mất kết nối Database',
      });
    });
  });

  // ==========================================
  // [B] FORBIDDEN WORDS
  // ==========================================
  describe('Forbidden Words', () => {
    it('3. Nên lấy danh sách từ cấm thành công', async () => {
      mockRepo.getForbiddenWords.mockResolvedValueOnce([{ id: '1', word: 'badword' }] as any);
      const res = await adminSystemService.getForbiddenWords();
      expect(res).toHaveLength(1);
    });

    it('4. Nên thêm từ cấm mới thành công', async () => {
      mockRepo.createForbiddenWord.mockResolvedValueOnce({ id: '1', word: 'scam' } as any);
      const res = await adminSystemService.addForbiddenWord({ word: 'scam' });
      expect(res.message).toContain('scam');
    });

    it('5. Nên gỡ bỏ từ cấm thành công', async () => {
      mockRepo.deleteForbiddenWord.mockResolvedValueOnce({} as any);
      const res = await adminSystemService.removeForbiddenWord('1');
      expect(res.message).toBe('Đã gỡ bỏ từ cấm khỏi sổ đen.');
    });

    it('6. Nên ném lỗi 404 nếu xóa từ cấm không tồn tại', async () => {
      mockRepo.deleteForbiddenWord.mockRejectedValueOnce(new Error('Not found'));
      await expect(adminSystemService.removeForbiddenWord('invalid-id')).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  // ==========================================
  // [C] ROLES & PERMISSIONS
  // ==========================================
  describe('Roles & Permissions', () => {
    it('7. Nên lấy danh sách Roles và Permissions', async () => {
      mockRepo.getRoles.mockResolvedValueOnce([{ id: '1', name: 'ADMIN' }] as any);
      mockRepo.getPermissions.mockResolvedValueOnce([{ id: 'p1', action: 'MANAGE_USERS' }] as any);

      const res = await adminSystemService.getRolesAndPermissions();
      expect(res.roles).toHaveLength(1);
      expect(res.availablePermissions).toHaveLength(1);
    });

    it('8. Nên tạo Role mới thành công (Có Description)', async () => {
      const payload = { name: 'MODERATOR', description: 'Quản trị viên cấp thấp' };
      mockRepo.createRole.mockResolvedValueOnce({ id: '2', ...payload } as any);

      const res = await adminSystemService.createRole(payload);
      expect(res.message).toBe('Tạo Role mới thành công');
      expect(mockRepo.createRole).toHaveBeenCalledWith(payload);
    });

    it('9. Nên ném lỗi 409 nếu tạo Role trùng tên', async () => {
      mockRepo.createRole.mockRejectedValueOnce({ code: 'P2002' });
      await expect(adminSystemService.createRole({ name: 'ADMIN' })).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('10. Nên ném lỗi 404 nếu cập nhật quyền cho Role không tồn tại', async () => {
      mockRepo.getRoleById.mockResolvedValueOnce(null);
      await expect(
        adminSystemService.updateRolePermissions('ghost-id', ['p1'])
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('11. Nên ném lỗi 403 nếu cố gắng thay đổi quyền của Role hệ thống (ADMIN/STUDENT)', async () => {
      mockRepo.getRoleById.mockResolvedValueOnce({ id: '1', name: 'ADMIN' } as any);
      await expect(adminSystemService.updateRolePermissions('1', ['p1'])).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('12. Nên cập nhật quyền cho Role thường thành công', async () => {
      mockRepo.getRoleById.mockResolvedValueOnce({ id: '2', name: 'MANAGER' } as any);
      mockRepo.updateRolePermissions.mockResolvedValueOnce({} as any);

      const res = await adminSystemService.updateRolePermissions('2', ['p1', 'p2']);
      expect(res.message).toBe('Cập nhật phân quyền cho Role thành công.');
      expect(mockRepo.updateRolePermissions).toHaveBeenCalledWith('2', ['p1', 'p2']);
    });
  });
});

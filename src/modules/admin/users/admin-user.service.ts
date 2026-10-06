import { AdminUserRepository } from './admin-user.repository';
import { AppError } from '@/common/errors/app.error';
import { ERROR_CODES } from '@/constants/error-codes';
import { PaginationMetaDto } from '@/data/dtos/pagination.dto'; // Import DTO phân trang chuẩn của hệ thống

export class AdminUserService {
  private readonly adminUserRepo: AdminUserRepository;

  constructor() {
    this.adminUserRepo = new AdminUserRepository();
  }

  // ==========================================
  // [A] TRUY XUẤT DỮ LIỆU
  // ==========================================

  public async getUsers(query: any) {
    const { total, users } = await this.adminUserRepo.findUsers(query);

    // Đóng gói Meta Phân trang ngay tại Service để Controller nhàn rỗi hơn
    const meta = PaginationMetaDto.create(query.page || 1, query.limit || 20, total);

    return { data: users, meta };
  }

  public async getUserDetail(id: string) {
    const user = await this.adminUserRepo.findUserDetail(id);
    if (!user)
      throw new AppError(404, 'Người dùng không tồn tại', ERROR_CODES.DATABASE.RECORD_NOT_FOUND);
    return user;
  }

  // ==========================================
  // [B] PHÂN QUYỀN & TRẠNG THÁI
  // ==========================================

  public async changeUserRole(adminId: string, targetUserId: string, roleId: string) {
    // [ANTI-SUICIDE]: Không cho phép Admin tự đổi Role của chính mình
    if (adminId === targetUserId) {
      throw new AppError(
        403,
        'Bạn không thể tự thay đổi chức danh của chính mình.',
        ERROR_CODES.COMMON.FORBIDDEN
      );
    }
    await this.adminUserRepo.updateUserRole(targetUserId, roleId);
    return { message: 'Cập nhật phân quyền thành công.' };
  }

  public async changeUserStatus(adminId: string, targetUserId: string, isActive: boolean) {
    // [ANTI-SUICIDE]
    if (adminId === targetUserId && !isActive) {
      throw new AppError(
        403,
        'Bạn không thể tự khóa tài khoản của mình.',
        ERROR_CODES.COMMON.FORBIDDEN
      );
    }

    await this.adminUserRepo.updateUserStatus(targetUserId, isActive);

    // [BẢO MẬT - TRẢM CỎ TẬN GỐC]: Nếu Khóa mỏm (Ban) user, bắt buộc phải thu hồi toàn bộ JWT Token/Session của họ
    if (!isActive) {
      await this.adminUserRepo.revokeAllUserSessions(targetUserId);
    }

    return {
      message: isActive
        ? 'Đã mở khóa tài khoản.'
        : 'Đã khóa tài khoản và đăng xuất mọi thiết bị của người dùng này.',
    };
  }

  public async overridePermissions(targetUserId: string, permissionIds: string[]) {
    await this.adminUserRepo.updateExtraPermissions(targetUserId, permissionIds);
    return { message: 'Đã ghi đè quyền ngoại lệ thành công.' };
  }

  // ==========================================
  // [C] CAN THIỆP HỆ THỐNG
  // ==========================================

  public async revokeAllSessions(targetUserId: string) {
    const result = await this.adminUserRepo.revokeAllUserSessions(targetUserId);
    return { message: `Đã cưỡng chế đăng xuất khỏi ${result.count} thiết bị.` };
  }

  public async enrollCourseB2B(targetUserId: string, courseId: string) {
    const result = await this.adminUserRepo.createManualEnrollment(targetUserId, courseId);

    if (!result.isNew) {
      throw new AppError(
        400,
        'Học viên đã sở hữu khóa học này từ trước.',
        ERROR_CODES.COMMON.INVALID_INPUT
      );
    }

    return { message: 'Cấp quyền truy cập và đồng bộ thống kê khóa học thành công.' };
  }

  public async revokeCourseAccess(targetUserId: string, courseId: string) {
    try {
      await this.adminUserRepo.deleteEnrollment(targetUserId, courseId);
    } catch (_e) {
      throw new AppError(
        404,
        'Học viên chưa sở hữu khóa học này.',
        ERROR_CODES.DATABASE.RECORD_NOT_FOUND
      );
    }
    return { message: 'Đã thu hồi quyền truy cập khóa học của học viên.' };
  }
}

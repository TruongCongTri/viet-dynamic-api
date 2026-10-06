import { prisma } from '@/common/configs/prisma.config';
import { Prisma, User } from '@prisma/client';
import { BaseRepository } from '@/common/repositories/base.repository'; // Nhớ trỏ đúng đường dẫn của bạn

export class AdminUserRepository extends BaseRepository<User> {
  constructor() {
    // Truyền tên model tương ứng trong Prisma Client vào super()
    super('user');
  }

  // ==========================================
  // [A] KẾ THỪA PHÂN TRANG (PAGINATION)
  // ==========================================
  public async findUsers(params: any) {
    const {
      page = 1,
      limit = 20,
      search,
      role,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { profile: { is: { fullName: { contains: search, mode: 'insensitive' } } } },
        { phone: { contains: search } },
      ];
    }
    if (role) where.role = { name: role };
    if (status === 'ACTIVE') where.isActive = true;
    if (status === 'BANNED') where.isActive = false;

    // Tái sử dụng executePagination từ BaseRepository
    const { total, data } = await this.executePagination<any>({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        email: true,
        isActive: true,
        createdAt: true,
        profile: { select: { fullName: true, avatarUrl: true } },
        role: { select: { name: true } },
      },
    });

    return { total, users: data };
  }

  // ==========================================
  // [B] KẾ THỪA CRUD CƠ BẢN
  // ==========================================

  // Lấy Hồ sơ 360 độ (Tái sử dụng findById)
  public async findUserDetail(id: string) {
    return this.findById(id, {
      include: {
        profile: true,
        role: { include: { permissions: { include: { permission: true } } } },
        extraPermissions: { include: { permission: true } },
        enrollments: { include: { course: { select: { id: true, title: true, slug: true } } } },
        sessions: { where: { isRevoked: false }, orderBy: { lastActive: 'desc' }, take: 5 }, // 5 thiết bị gần nhất
        orders: { orderBy: { createdAt: 'desc' }, take: 5 }, // 5 hóa đơn gần nhất
      },
    });
  }

  // Đổi Role (Tái sử dụng update)
  public async updateUserRole(id: string, roleId: string) {
    return this.update(id, { roleId });
  }

  // Đổi Trạng thái (Tái sử dụng update)
  public async updateUserStatus(id: string, isActive: boolean) {
    return this.update(id, { isActive });
  }

  // ==========================================
  // [C] CÁC QUERY NGOẠI LỆ (Tương tác với bảng khác)
  // ==========================================

  public async revokeAllUserSessions(userId: string) {
    return prisma.session.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  public async updateExtraPermissions(userId: string, permissionIds: string[]) {
    return prisma.$transaction(async (tx) => {
      // Xóa quyền ngoại lệ cũ
      await tx.userPermission.deleteMany({ where: { userId } });
      // Thêm quyền mới
      if (permissionIds.length > 0) {
        await tx.userPermission.createMany({
          data: permissionIds.map((permissionId) => ({ userId, permissionId })),
        });
      }
    });
  }

  public async createManualEnrollment(userId: string, courseId: string) {
    const existing = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });

    if (existing) return { isNew: false };

    // Tìm danh sách giảng viên của khóa học này
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { instructors: true },
    });

    await prisma.$transaction(async (tx) => {
      // 1. Thêm học viên vào bảng Enrollment
      await tx.enrollment.create({
        data: { userId, courseId },
      });

      // 2. Tăng tổng học viên của Khóa học
      await tx.course.update({
        where: { id: courseId },
        data: { studentCount: { increment: 1 } },
      });

      // 3. Tăng tổng học viên của TẤT CẢ Giảng viên phụ trách khóa học này
      if (course && course.instructors.length > 0) {
        const instructorIds = course.instructors.map((inst) => inst.userId);
        await tx.userProfile.updateMany({
          where: { userId: { in: instructorIds } },
          data: { totalStudents: { increment: 1 } },
        });
      }
    });

    return { isNew: true };
  }

  public async deleteEnrollment(userId: string, courseId: string) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { instructors: true },
    });

    return prisma.$transaction(async (tx) => {
      // 1. Xóa quyền
      const enrollment = await tx.enrollment.delete({
        where: { userId_courseId: { userId, courseId } },
      });

      // 2. Giảm tổng học viên của Khóa học
      await tx.course.update({
        where: { id: courseId },
        data: { studentCount: { decrement: 1 } },
      });

      // 3. Giảm tổng học viên của Giảng viên
      if (course && course.instructors.length > 0) {
        const instructorIds = course.instructors.map((inst) => inst.userId);
        await tx.userProfile.updateMany({
          where: { userId: { in: instructorIds } },
          data: { totalStudents: { decrement: 1 } },
        });
      }

      return enrollment;
    });
  }
}

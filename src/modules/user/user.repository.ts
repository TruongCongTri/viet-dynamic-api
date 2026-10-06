import { prisma } from '@/common/configs/prisma.config';
import { UpdateProfileDTO } from './user.schema';

export class UserRepository {
  // 1. Lấy thông tin cá nhân 360 độ
  public async getUserProfile(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        isEmailVerified: true,
        authProvider: true,
        createdAt: true,
        // Lấy Profile
        profile: {
          select: { fullName: true, avatarUrl: true, bio: true, slug: true },
        },
        // [SỬA LỖI 1]: Gộp thông tin Role và Permissions vào chung 1 key 'role'
        role: {
          select: {
            name: true,
            description: true,
            permissions: { select: { permission: { select: { action: true } } } },
          },
        },
        extraPermissions: { select: { permission: { select: { action: true } } } },
      },
    });
  }

  // 2. Upsert Profile (Phòng hờ trường hợp bảng UserProfile chưa được tạo lúc đăng ký)
  public async upsertUserProfile(userId: string, data: UpdateProfileDTO) {
    // [SỬA LỖI 2]: Lọc bỏ toàn bộ các key có giá trị undefined để chiều lòng TypeScript
    const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));

    return prisma.userProfile.upsert({
      where: { userId },
      update: cleanData,
      create: {
        userId,
        ...cleanData,
      },
    });
  }

  // 3. Cập nhật Số điện thoại (Nằm ở bảng User gốc)
  public async updateUserPhone(userId: string, phone: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { phone },
    });
  }

  // 4. Lưu Avatar URL
  public async updateAvatarUrl(userId: string, avatarUrl: string) {
    return prisma.userProfile.upsert({
      where: { userId },
      update: { avatarUrl },
      create: { userId, avatarUrl },
    });
  }

  // 5. Query dùng cho Gác cổng (Kiểm tra phone trùng lặp)
  public async checkPhoneExists(phone: string, excludeUserId: string) {
    return prisma.user.findFirst({
      where: { phone, id: { not: excludeUserId } },
    });
  }

  // ==========================================
  // [B] SESSION & SECURITY MANAGEMENT
  // ==========================================

  // 1. Lấy danh sách thiết bị đang đăng nhập (Session còn hạn và chưa bị thu hồi)
  public async getActiveSessions(userId: string) {
    return prisma.session.findMany({
      where: {
        userId,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        deviceId: true,
        userAgent: true,
        ipAddress: true,
        lastActive: true,
        createdAt: true,
      },
      orderBy: { lastActive: 'desc' }, // Thiết bị hoạt động gần nhất lên đầu
    });
  }

  // 2. Thu hồi 1 phiên cụ thể (Đăng xuất từ xa)
  public async revokeSession(sessionId: string, userId: string) {
    return prisma.session.updateMany({
      where: {
        id: sessionId,
        userId,
        isRevoked: false,
      },
      data: { isRevoked: true },
    });
  }

  // 3. Thu hồi TẤT CẢ các phiên KHÁC (Chỉ giữ lại thiết bị đang cầm trên tay)
  public async revokeAllOtherSessions(userId: string, currentSessionId: string) {
    return prisma.session.updateMany({
      where: {
        userId,
        id: { not: currentSessionId },
        isRevoked: false,
      },
      data: { isRevoked: true },
    });
  }

  // 4. Xóa vĩnh viễn tài khoản
  public async deleteUserAccount(userId: string) {
    return prisma.user.delete({
      where: { id: userId },
    });
  }

  // Thêm vào cuối file
  public async checkEmailExists(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  // Khởi tạo OTP
  public async createEmailChangeOtp(email: string, code: string, expiresAt: Date) {
    return prisma.otp.create({
      data: {
        email,
        code,
        type: 'VERIFY_EMAIL', // Tái sử dụng Enum
        expiresAt,
      },
    });
  }

  // ==========================================
  // [C] CORE USER QUERIES (Dành cho Service gọi)
  // ==========================================

  // Lấy thông tin user cơ bản (Thay thế cho prisma.user.findUnique)
  public async findUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
    });
  }

  // Lấy thông tin user kèm danh sách khóa học đang dạy (Để chặn xóa tài khoản Giảng viên)
  public async findUserWithTaughtCourses(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      include: {
        taughtCourses: {
          include: { course: true }, // Lấy để check status khóa học
        },
      },
    });
  }
}

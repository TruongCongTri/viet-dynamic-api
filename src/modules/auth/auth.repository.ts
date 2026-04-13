import { Prisma, OtpType } from '@/generated/client';
import { prisma } from '@/common/configs/prisma';
import { BaseRepository } from '@/common/repositories/base.repository';
import { OtpChannel, OTP_CHANNELS } from '@/constants/app.constant';

export class AuthRepository extends BaseRepository<Prisma.UserDelegate> {
  constructor() {
    super('user');
  }

  // [USER & ROLE]
  public async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  public async findRoleByName(name: string) {
    return prisma.role.findUnique({ where: { name } });
  }

  public async createUser(data: Prisma.UserCreateInput) {
    return prisma.user.create({
      data,
      select: {
        id: true,
        email: true,
        isEmailVerified: true,
        profile: { select: { fullName: true } },
      },
    });
  }

  public async findUserForLogin(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
        extraPermissions: {
          include: { permission: true },
        },
      },
    });
  }

  public async updateUserLoginAttempts(userId: string, attempts: number, lockedUntil: Date | null) {
    return prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: attempts, lockedUntil },
    });
  }

  public async updatePassword(userId: string, hashedPassword: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }

  // [SESSION / THIẾT BỊ]
  public async findActiveSessionsForLogin(userId: string) {
    return prisma.session.findMany({
      where: { userId, isRevoked: false, expiresAt: { gt: new Date() } },
      select: { id: true }, // Tối ưu: Chỉ lấy ID
      orderBy: { lastActive: 'asc' },
    });
  }

  /**
   * Dùng cho API Quản lý thiết bị: Lấy chi tiết để hiển thị giao diện.
   * Ưu tiên sắp xếp mới nhất lên đầu (desc) và lấy đủ dữ liệu.
   */
  public async findDeviceSessions(userId: string) {
    return prisma.session.findMany({
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

  public async createSession(data: Prisma.SessionUncheckedCreateInput) {
    return prisma.session.create({ data });
  }

  public async findSessionById(sessionId: string) {
    return prisma.session.findUnique({ where: { id: sessionId } });
  }

  public async findSessionByRefreshToken(refreshToken: string) {
    return prisma.session.findUnique({
      where: { refreshToken },
      include: { user: { include: { role: true } } },
    });
  }

  public async updateSession(sessionId: string, data: Prisma.SessionUpdateInput) {
    return prisma.session.update({ where: { id: sessionId }, data });
  }

  public async revokeSessions(sessionIds: string[]) {
    return prisma.session.updateMany({
      where: { id: { in: sessionIds } },
      data: { isRevoked: true },
    });
  }

  public async revokeOtherSessions(userId: string, currentSessionId: string) {
    return prisma.session.updateMany({
      where: { userId, isRevoked: false, id: { not: currentSessionId } },
      data: { isRevoked: true },
    });
  }

  // [OTP & VERIFICATION]
  public async findUserByIdentifier(identifier: string, channel: OtpChannel) {
    return prisma.user.findFirst({
      where: channel === OTP_CHANNELS.EMAIL ? { email: identifier } : { phone: identifier },
    });
  }

  public async findLatestOtp(identifier: string, type: OtpType) {
    return prisma.otp.findFirst({
      where: { email: identifier, type },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async findValidOtp(identifier: string, code: string, type: OtpType) {
    return prisma.otp.findFirst({
      where: { email: identifier, code, type, isUsed: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async createOtp(data: Prisma.OtpUncheckedCreateInput) {
    return prisma.otp.create({ data });
  }

  /**
   * Transaction xác thực tài khoản
   */
  public async verifyAccountTransaction(otpId: string, identifier: string, channel: OtpChannel) {
    return prisma.$transaction([
      prisma.otp.update({ where: { id: otpId }, data: { isUsed: true } }),
      prisma.user.updateMany({
        // Dùng updateMany để tránh lỗi Unique nếu dùng biến động cho where
        where: channel === OTP_CHANNELS.EMAIL ? { email: identifier } : { phone: identifier },
        data:
          channel === OTP_CHANNELS.EMAIL ? { isEmailVerified: true } : { isPhoneVerified: true },
      }),
    ]);
  }

  /**
   * Transaction đặt lại mật khẩu
   */
  public async resetPasswordTransaction(otpId: string, userId: string, hashedPassword: string) {
    return prisma.$transaction([
      prisma.otp.update({ where: { id: otpId }, data: { isUsed: true } }),
      prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } }),
      prisma.session.updateMany({ where: { userId, isRevoked: false }, data: { isRevoked: true } }),
    ]);
  }
}

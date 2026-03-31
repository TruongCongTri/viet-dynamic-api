/* eslint-disable no-console */
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
} from './auth.schema';
import { AppError } from '@/common/errors/app.error';
import { notificationService } from '@/common/services/notification.service';

export class AuthService {
  // ==========================================
  // 1. ĐĂNG KÝ (REGISTER)
  // ==========================================
  async register(data: RegisterDTO) {
    const { email, password, fullName } = data;

    // 1. Kiểm tra email tồn tại
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new AppError(409, 'Email này đã được sử dụng trong hệ thống.', 'EMAIL_EXISTS');
    }

    // 2. Lấy Role STUDENT mặc định
    const studentRole = await prisma.role.findUnique({ where: { name: 'STUDENT' } });
    if (!studentRole)
      throw new AppError(500, 'Lỗi hệ thống: Không tìm thấy Role mặc định.', 'ROLE_NOT_FOUND');

    // 3. Mã hóa Mật khẩu bằng số SALT từ biến môi trường
    const salt = await bcrypt.genSalt(env.BCRYPT_SALT);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Khởi tạo User và UserProfile (Dùng Nested Writes)
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        roleId: studentRole.id,
        isEmailVerified: false, // Chờ verify email ở step sau
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

    return newUser;
  }

  // ==========================================
  // 2. ĐĂNG NHẬP (LOGIN)
  // ==========================================
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
      throw new AppError(401, 'Tài khoản không tồn tại hoặc đã bị khóa.', 'INVALID_CREDENTIALS');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new AppError(401, 'Mật khẩu không chính xác.', 'INVALID_CREDENTIALS');

    // TÍNH TOÁN QUYỀN HẠN (PERMISSION FLATTENING)
    const rolePermissions = user.role.permissions.map((rp) => rp.permission.action);
    const extraPermissions = user.extraPermissions.map((up) => up.permission.action);
    const mergedPermissions = Array.from(new Set([...rolePermissions, ...extraPermissions]));

    // KHỞI TẠO SESSION & TOKEN
    const refreshToken = JwtUtil.generateRefreshToken({ id: user.id });

    // SỬ DỤNG 'ms' ĐỂ PARSE THỜI GIAN TỪ BIẾN MÔI TRƯỜNG
    // Parse chuỗi (VD: '7d', '14d') thành số milliseconds
    const refreshExpiresInMs = ms(env.JWT_REFRESH_EXPIRES_IN as StringValue);

    // Nếu parse thất bại (trả về undefined), fallback về 7 ngày an toàn
    const safeExpiresInMs = refreshExpiresInMs ?? 7 * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + safeExpiresInMs);

    // 4. Tạo bản ghi Session trong Database
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken, // Lưu luôn chuỗi JWT Refresh Token vào đây
        expiresAt,
        ipAddress: clientMeta.ipAddress,
        userAgent: clientMeta.userAgent,
        deviceId: deviceId || 'unknown',
      },
    });

    // 5. CẢNH BÁO BẢO MẬT: KHÔNG nhét `mergedPermissions` vào JWT Token.
    // Việc nhét hàng chục quyền vào Token sẽ làm Token bị phình to (Bloat), tốn băng thông mỗi lần gọi API.
    // Token chỉ nên giữ Role cơ bản và Session ID.
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
        permissions: mergedPermissions, // <--- TRẢ VỀ CHO FRONTEND DÙNG
        avatarUrl: user.profile?.avatarUrl,
      },
      accessToken,
      refreshToken,
    };
  }

  // ==========================================
  // 3. REFRESH TOKEN (Cấp lại Access Token)
  // ==========================================
  async refreshToken(dto: RefreshTokenDTO) {
    const { refreshToken } = dto;

    if (!refreshToken) throw new AppError(401, 'Không tìm thấy Refresh Token.', 'MISSING_TOKEN');

    // Tìm session trong DB dựa vào refreshToken
    const session = await prisma.session.findUnique({
      where: { refreshToken },
      include: { user: { include: { role: true } } },
    });

    if (!session) throw new AppError(401, 'Phiên đăng nhập không tồn tại.', 'INVALID_SESSION');
    if (session.isRevoked)
      throw new AppError(401, 'Phiên đăng nhập đã bị thu hồi.', 'SESSION_REVOKED');
    if (new Date() > session.expiresAt)
      throw new AppError(401, 'Phiên đăng nhập đã hết hạn.', 'SESSION_EXPIRED');

    // Cấp lại Access Token mới
    const newAccessToken = JwtUtil.generateAccessToken({
      id: session.user.id,
      role: session.user.role.name,
      sessionId: session.id,
    });

    // Cập nhật lastActive
    await prisma.session.update({
      where: { id: session.id },
      data: { lastActive: new Date() },
    });

    return newAccessToken;
  }

  // ==========================================
  // 4. LOGOUT (Đăng xuất)
  // ==========================================
  async logout(sessionId: string) {
    // Chuyển isRevoked = true theo đúng tài liệu thiết kế
    await prisma.session.update({
      where: { id: sessionId },
      data: { isRevoked: true },
    });
    return true;
  }

  // ==========================================
  // 5. XÁC THỰC EMAIL (Gửi & Xác nhận OTP)
  // ==========================================
  async sendVerifyOTP(data: { identifier: string; channel: 'EMAIL' | 'SMS' | 'ZALO' }) {
    const { identifier, channel } = data;

    // 1. Tìm User (Bằng Email hoặc Phone tùy kênh)
    const user = await prisma.user.findFirst({
      where: channel === 'EMAIL' ? { email: identifier } : { phone: identifier },
    });

    if (!user) throw new AppError(404, 'Tài khoản không tồn tại.', 'USER_NOT_FOUND');

    // Check xem kênh đó đã verify chưa
    if (channel === 'EMAIL' && user.isEmailVerified) throw new AppError(400, 'Email đã xác thực.');
    if ((channel === 'SMS' || channel === 'ZALO') && user.isPhoneVerified)
      throw new AppError(400, 'SĐT đã xác thực.');

    // Check cooldown 60s cho cùng một identifier và cùng loại OTP
    const lastOtp = await prisma.otp.findFirst({
      where: { email: identifier, type: 'VERIFY_ACCOUNT' },
      orderBy: { createdAt: 'desc' },
    });

    if (lastOtp && Date.now() - lastOtp.createdAt.getTime() < 60000) {
      throw new AppError(429, 'Vui lòng thử lại sau 60 giây.', 'OTP_COOLDOWN');
    }

    // 2. Tạo OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Lưu vào DB
    await prisma.otp.create({
      data: { email: identifier, code: otpCode, type: 'VERIFY_ACCOUNT', expiresAt },
    });

    // 3. Thực thi gửi theo Channel
    if (channel === 'EMAIL') {
      await notificationService.sendEmailOTP(identifier, otpCode);
    } else if (channel === 'SMS') {
      await notificationService.sendSmsOTP(identifier, otpCode);
    } else if (channel === 'ZALO') {
      await notificationService.sendZaloOTP(identifier, otpCode);
    }

    return true;
  }

  async verifyOTP(data: { identifier: string; code: string; channel: 'EMAIL' | 'SMS' | 'ZALO' }) {
    const { identifier, code, channel } = data;

    // Tìm mã OTP
    const otpRecord = await prisma.otp.findFirst({
      where: { email: identifier, code, type: 'VERIFY_ACCOUNT', isUsed: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) throw new AppError(400, 'Mã OTP không hợp lệ hoặc không tồn tại.');
    if (new Date() > otpRecord.expiresAt) throw new AppError(400, 'Mã OTP đã hết hạn.');

    // Cập nhật trạng thái User dựa trên kênh
    const updateData = channel === 'EMAIL' ? { isEmailVerified: true } : { isPhoneVerified: true };

    // Transaction an toàn
    await prisma.$transaction([
      prisma.otp.update({ where: { id: otpRecord.id }, data: { isUsed: true } }),
      prisma.user.update({
        where: channel === 'EMAIL' ? { email: identifier } : { phone: identifier },
        data: updateData,
      }),
    ]);

    return true;
  }

  // ==========================================
  // 4. QUÊN MẬT KHẨU
  // ==========================================
  async forgotPassword(dto: ForgotPasswordDTO) {
    const { email } = dto;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError(404, 'Email không tồn tại trong hệ thống.', 'USER_NOT_FOUND');

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 phút cho quên pass

    await prisma.otp.create({
      data: {
        email,
        code: otpCode,
        type: 'FORGOT_PASSWORD',
        expiresAt,
      },
    });

    console.log(`[MOCK EMAIL] Mã OTP khôi phục mật khẩu của ${email} là: ${otpCode}`);
    // await notificationService.sendEmailOTP(dto.email, otpCode);
    return true;
  }

  async resetPassword(dto: ResetPasswordDTO) {
    const { email, code, newPassword } = dto;
    // 1. Kiểm tra mã OTP
    const otpRecord = await prisma.otp.findFirst({
      where: { email, code, type: 'FORGOT_PASSWORD', isUsed: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) throw new AppError(400, 'Mã OTP không hợp lệ.', 'INVALID_OTP');
    if (new Date() > otpRecord.expiresAt)
      throw new AppError(400, 'Mã OTP đã hết hạn.', 'EXPIRED_OTP');

    // 2. Lấy User TRƯỚC khi chạy Transaction
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError(404, 'Tài khoản không tồn tại.', 'USER_NOT_FOUND');

    // 3. Mã hóa mật khẩu mới
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

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
}

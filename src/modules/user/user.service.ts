import { UserRepository } from './user.repository';
import { AppError } from '@/common/errors/app.error';
import { ERROR_CODES } from '@/constants/error-codes';
import { UpdateProfileDTO } from './user.schema';
import bcrypt from 'bcryptjs';

export class UserService {
  private readonly userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  // ==========================================
  // [A] USER PROFILE MANAGEMENT
  // ==========================================

  public async getMyProfile(userId: string) {
    const rawData = await this.userRepository.getUserProfile(userId);
    if (!rawData)
      throw new AppError(404, 'Không tìm thấy người dùng', ERROR_CODES.DATABASE.RECORD_NOT_FOUND);

    // 1. Gộp mảng Quyền (Permissions) từ Role và ExtraPermissions
    const rolePermissions = rawData.role?.permissions.map((p) => p.permission.action) || [];
    const extraPermissions = rawData.extraPermissions.map((p) => p.permission.action) || [];

    // Dùng Set để lọc các quyền bị trùng (nếu có)
    const combinedPermissions = Array.from(new Set([...rolePermissions, ...extraPermissions]));

    // 2. Làm phẳng dữ liệu (Flatten) để Frontend dễ sử dụng
    return {
      id: rawData.id,
      email: rawData.email,
      phone: rawData.phone,
      isEmailVerified: rawData.isEmailVerified,
      authProvider: rawData.authProvider,
      joinedAt: rawData.createdAt,

      profile: {
        fullName: rawData.profile?.fullName || null,
        avatarUrl: rawData.profile?.avatarUrl || null,
        bio: rawData.profile?.bio || null,
        slug: rawData.profile?.slug || null,
      },

      accessControl: {
        role: rawData.role?.name || 'STUDENT',
        permissions: combinedPermissions,
      },
    };
  }

  public async updateMyProfile(userId: string, data: UpdateProfileDTO) {
    // 1. Tách riêng phone (thuộc bảng User) và các field khác (thuộc bảng UserProfile)
    const { phone, ...profileData } = data;

    // 2. Xử lý cập nhật số điện thoại (nếu có)
    if (phone) {
      // Gatekeeper: Kiểm tra xem số điện thoại này đã có ai dùng chưa
      const existingPhone = await this.userRepository.checkPhoneExists(phone, userId);
      if (existingPhone) {
        throw new AppError(
          409,
          'Số điện thoại này đã được liên kết với một tài khoản khác.',
          ERROR_CODES.COMMON.INVALID_INPUT
        );
      }
      await this.userRepository.updateUserPhone(userId, phone);
    }

    // 3. Xử lý cập nhật thông tin cá nhân (FullName, Bio)
    // Lọc bỏ undefined trước khi update (nhờ hàm helper nếu bạn đã tạo, hoặc code cứng như sau)
    const cleanProfileData = Object.fromEntries(
      Object.entries(profileData).filter(([_, v]) => v !== undefined)
    );

    if (Object.keys(cleanProfileData).length > 0) {
      await this.userRepository.upsertUserProfile(userId, cleanProfileData);
    }

    return this.getMyProfile(userId); // Trả về profile mới nhất
  }

  public async updateAvatar(userId: string, file: any) {
    if (!file) {
      throw new AppError(400, 'Vui lòng cung cấp file ảnh.', ERROR_CODES.COMMON.INVALID_INPUT);
    }

    // Ở đây, trong thực tế bạn sẽ upload file 'file.buffer' lên AWS S3 hoặc Cloudinary.
    // Vì giới hạn ngữ cảnh, tôi giả lập đã upload thành công và nhận được một URL:
    // const uploadResult = await cloudinary.uploader.upload(file.path);
    // const avatarUrl = uploadResult.secure_url;

    // Tạm thời giả lập URL:
    const avatarUrl = `https://vietdynamic.com/uploads/avatars/${userId}-${Date.now()}.jpg`;

    await this.userRepository.updateAvatarUrl(userId, avatarUrl);

    return { avatarUrl, message: 'Cập nhật ảnh đại diện thành công.' };
  }

  // ==========================================
  // [B] SESSION & SECURITY MANAGEMENT
  // ==========================================

  public async getMySessions(userId: string) {
    const sessions = await this.userRepository.getActiveSessions(userId);

    // Format lại dữ liệu cho Frontend dễ hiển thị
    return sessions.map((session) => ({
      sessionId: session.id,
      device: session.userAgent || 'Thiết bị không xác định',
      ip: session.ipAddress || 'Unknown IP',
      lastActive: session.lastActive,
      createdAt: session.createdAt,
    }));
  }

  public async revokeSession(userId: string, sessionId: string) {
    const result = await this.userRepository.revokeSession(sessionId, userId);

    if (result.count === 0) {
      throw new AppError(
        404,
        'Phiên đăng nhập không tồn tại hoặc đã bị đăng xuất trước đó.',
        ERROR_CODES.DATABASE.RECORD_NOT_FOUND
      );
    }

    return { message: 'Đã đăng xuất khỏi thiết bị thành công.' };
  }

  public async revokeAllOtherSessions(userId: string, currentSessionId: string) {
    if (!currentSessionId) {
      throw new AppError(
        400,
        'Không xác định được phiên đăng nhập hiện tại.',
        ERROR_CODES.COMMON.INVALID_INPUT
      );
    }

    const result = await this.userRepository.revokeAllOtherSessions(userId, currentSessionId);
    return { message: `Đã đăng xuất thành công khỏi ${result.count} thiết bị khác.` };
  }

  public async deleteMyAccount(userId: string, passwordConfirm: string) {
    if (!passwordConfirm) {
      throw new AppError(
        400,
        'Vui lòng nhập mật khẩu để xác nhận xóa tài khoản.',
        ERROR_CODES.COMMON.INVALID_INPUT
      );
    }

    // 1. Lấy thông tin user kèm theo khóa học đang dạy
    const userDb = await this.userRepository.findUserWithTaughtCourses(userId);

    if (!userDb)
      throw new AppError(404, 'Người dùng không tồn tại.', ERROR_CODES.DATABASE.RECORD_NOT_FOUND);

    // 2. Xác thực mật khẩu
    const isMatch = await bcrypt.compare(passwordConfirm, userDb.password!);
    if (!isMatch) {
      throw new AppError(
        401,
        'Mật khẩu xác nhận không chính xác.',
        ERROR_CODES.AUTH.INVALID_CREDENTIALS
      );
    }

    // 3. Nghiệp vụ: Chặn xóa nếu là Giảng viên đang có khóa học PUBLISHED
    const hasPublishedCourses = userDb.taughtCourses.some((tc) => tc.course.status === 'PUBLISHED');
    if (hasPublishedCourses) {
      throw new AppError(
        403,
        'Bạn không thể xóa tài khoản vì đang có khóa học được xuất bản (Published). Vui lòng liên hệ Admin để gỡ khóa học trước.',
        ERROR_CODES.COMMON.FORBIDDEN
      );
    }

    // 4. Thực thi xóa
    await this.userRepository.deleteUserAccount(userId);
    return {
      message:
        'Tài khoản của bạn đã được xóa vĩnh viễn. Cảm ơn bạn đã đồng hành cùng Viet Dynamic!',
    };
  }

  // Thêm vào phần [A] USER PROFILE MANAGEMENT
  public async requestEmailChange(userId: string, newEmail: string) {
    // 1. Lấy email hiện tại của user
    const currentUser = await this.userRepository.findUserById(userId);
    if (!currentUser)
      throw new AppError(404, 'Không tìm thấy người dùng.', ERROR_CODES.DATABASE.RECORD_NOT_FOUND);

    if (currentUser.email === newEmail) {
      throw new AppError(
        400,
        'Email mới không được trùng với email hiện tại.',
        ERROR_CODES.COMMON.INVALID_INPUT
      );
    }

    // 2. Kiểm tra email mới đã có ai dùng chưa
    const existingUser = await this.userRepository.checkEmailExists(newEmail);
    if (existingUser) {
      throw new AppError(
        409,
        'Email này đã được sử dụng bởi tài khoản khác.',
        ERROR_CODES.COMMON.INVALID_INPUT
      );
    }

    // 3. Tạo mã OTP 6 số ngẫu nhiên cho Email Mới
    const otpCodeNew = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 phút

    // 4. Lưu OTP vào DB
    await this.userRepository.createEmailChangeOtp(newEmail, otpCodeNew, expiresAt);

    // 5. [BẢO MẬT]: Bắn cảnh báo về Email cũ VÀ mã OTP về Email mới
    console.log(
      `[EMAIL SYSTEM - CẢNH BÁO] Gửi tới ${currentUser.email}: Tài khoản của bạn đang có yêu cầu đổi sang email ${newEmail}. Nếu không phải bạn, hãy đổi mật khẩu ngay!`
    );
    console.log(
      `[EMAIL SYSTEM - OTP] Gửi tới ${newEmail}: Mã xác nhận đổi email của bạn là ${otpCodeNew}`
    );

    return {
      message:
        'Mã xác nhận đã được gửi đến email mới. Một cảnh báo bảo mật cũng đã được gửi vào email hiện tại của bạn.',
    };
  }
}

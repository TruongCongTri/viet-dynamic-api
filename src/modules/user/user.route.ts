import { Router } from 'express';
import multer from 'multer';
import { UserController } from './user.controller';
import { validate } from '@/middlewares/validate.middleware';
import { verifyToken } from '@/middlewares/auth.middleware';
import {
  deleteAccountSchema,
  requestEmailChangeSchema,
  sessionParamSchema,
  updateProfileSchema,
} from './user.schema';
import { ENDPOINTS } from '@/constants/endpoints';
import { AppError } from '@/common/errors/app.error';
import { ERROR_CODES } from '@/constants/error-codes';

export class UserRoute {
  public router: Router;
  private readonly userController: UserController;
  private readonly upload: multer.Multer;

  constructor() {
    this.router = Router();
    this.userController = new UserController();

    // Cấu hình Multer để lưu file tạm trên RAM (memoryStorage) trước khi đẩy lên Cloud
    this.upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // Giới hạn ảnh 5MB
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else
          cb(
            new AppError(
              400,
              'Chỉ chấp nhận file định dạng ảnh.',
              ERROR_CODES.FILE.INVALID_FILE_TYPE
            ) as any,
            false
          );
      },
    });

    this.initializeRoutes();
  }

  private initializeRoutes() {
    // TẤT CẢ CÁC API USER ĐỀU BẮT BUỘC ĐĂNG NHẬP
    this.router.use(verifyToken);

    // ==========================================
    // [A] USER PROFILE MANAGEMENT
    // ==========================================

    this.router.get(
      ENDPOINTS.USER.PROFILE, // /me
      this.userController.getMyProfile
    );

    this.router.put(
      ENDPOINTS.USER.PROFILE, // /me
      validate(updateProfileSchema),
      this.userController.updateMyProfile
    );

    // Sử dụng middleware .single('avatar') của multer để hứng file có field name là 'avatar'
    this.router.patch(
      ENDPOINTS.USER.AVATAR, // /me/avatar
      this.upload.single('avatar'),
      this.userController.updateAvatar
    );

    // ==========================================
    // [B] SESSION & SECURITY MANAGEMENT
    // ==========================================

    // Danh sách thiết bị
    this.router.get(
      ENDPOINTS.USER.SESSIONS, // /sessions
      this.userController.getMySessions
    );

    // Đăng xuất 1 thiết bị cụ thể
    this.router.delete(
      `${ENDPOINTS.USER.SESSIONS}/:sessionId`,
      validate(sessionParamSchema),
      this.userController.revokeSession
    );

    // Đăng xuất TẤT CẢ thiết bị KHÁC
    this.router.delete(ENDPOINTS.USER.SESSIONS, this.userController.revokeAllOtherSessions);

    // Xóa vĩnh viễn tài khoản (Thường ở FE sẽ yêu cầu nhập lại password trước khi gọi API này)
    this.router.delete('/', validate(deleteAccountSchema), this.userController.deleteMyAccount); // Xóa account gốc

    this.router.post(
      ENDPOINTS.USER.EMAIL_CHANGE_REQUEST,
      validate(requestEmailChangeSchema),
      this.userController.requestEmailChange
    );
  }
}

export default new UserRoute().router;

// --- Quản lý Hồ sơ (Profile) ---
// // Đường dẫn thực tế: /api/v1/users/me/
// userRoute.get(ENDPOINTS.USER.PROFILE, userController.getMe);
// userRoute.put(ENDPOINTS.USER.PROFILE, userController.updateMe);

// // Cập nhật Avatar (Sử dụng PATCH vì chỉ thay đổi một phần dữ liệu)
// userRoute.patch(
//   ENDPOINTS.USER.AVATAR,
//   upload.single('avatar'), // Nhận file từ field 'avatar'
//   userController.updateAvatar
// );

// // --- Bảo mật & Tài khoản ---
// userRoute.put(ENDPOINTS.USER.PASSWORD, userController.changePassword);

// // Quản lý phiên đăng nhập (Sessions)
// userRoute.get(ENDPOINTS.USER.SESSIONS, userController.getSessions);
// // Đăng xuất một thiết bị cụ thể
// userRoute.delete(`${ENDPOINTS.USER.SESSIONS}/:sessionId`, userController.revokeSession);
// // Đăng xuất tất cả thiết bị khác (Clear all except current)
// userRoute.delete(ENDPOINTS.USER.SESSIONS, userController.clearOtherSessions);

// // Xóa tài khoản (GDPR)
// userRoute.delete(ENDPOINTS.USER.PROFILE, userController.deleteAccount);

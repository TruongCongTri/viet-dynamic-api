import { Router } from 'express';
// import { ENDPOINTS } from '../../constants/endpoints';
// import { userController } from './user.controller';
// import { upload } from '../../middlewares/upload.middleware'; // Middleware xử lý Multer

const userRoute = Router();

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

export default userRoute;

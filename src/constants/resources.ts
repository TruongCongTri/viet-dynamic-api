// Định nghĩa danh sách TẤT CẢ các thực thể/tài nguyên trong hệ thống
export const RESOURCES = {
  USER: 'Người dùng',
  COURSE: 'Khóa học',
  CATEGORY: 'Danh mục',
  LESSON: 'Bài học',
  PAYMENT: 'Giao dịch',
  ROLE: 'Vai trò',
  PERMISSION: 'Quyền hạn',
  SESSION: 'Phiên đăng nhập',
  OTP: 'Mã xác thực',
  EMAIL: 'Email',
  SMS: 'SMS',
  ZALO: 'Zalo',
} as const;

export type ResourceName = (typeof RESOURCES)[keyof typeof RESOURCES];

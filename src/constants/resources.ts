// Định nghĩa danh sách TẤT CẢ các thực thể/tài nguyên trong hệ thống
export const RESOURCES = {
  USER: 'Người dùng',
  COURSE: 'Khóa học',
  COURSE_CONTENT: 'Nội dung khóa học',
  CONTINUE_LEARNING: 'Tiếp tục học',
  CATEGORY: 'Danh mục',
  LESSON: 'Bài học',
  LESSON_CONTENT: 'Nội dung bài học',
  PROGRESS: 'Tiến độ học tập',

  COMMENT: 'Bình luận',
  REVIEW: 'Đánh giá',

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

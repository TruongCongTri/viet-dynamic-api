// Định nghĩa danh sách TẤT CẢ các tên trường (Input Fields) dùng cho thông báo lỗi
export const FIELDS = {
  // --- SERVER ---
  DIRECT_URL: 'DIRECT_URL',
  DB: 'DATABASE_URL',
  CLIENT: 'CLIENT_URL',
  REDIS_HOST: 'REDIS_HOST',
  REDIS_PORT: 'REDIS_PORT',
  REDIS_URL: 'REDIS_URL',

  // --- AUTH & USER ---
  EMAIL: 'Email',
  PHONE: 'Số điện thoại',
  PASSWORD: 'Mật khẩu',
  CURRENT_PASSWORD: 'Mật khẩu hiện tại',
  NEW_PASSWORD: 'Mật khẩu mới',
  CONFIRM_PASSWORD: 'Xác nhận mật khẩu',
  FULL_NAME: 'Họ tên',
  AVATAR: 'Ảnh đại diện',
  DEVICE_ID: 'Mã thiết bị',
  SESSION_ID: 'Mã phiên đăng nhập',
  IDENTIFIER: 'Định danh (Email/SĐT)',
  OTP_CODE: 'Mã xác thực (OTP)',
  CHANNEL: 'Kênh gửi',
  TOKEN: 'Token',
  REFRESH_TOKEN: 'Token Refresh',
  BIO: 'Giới thiệu',

  // --- COURSE ---
  COURSE_ID: 'ID khóa học',
  COURSE_NAME: 'Tên khóa học',
  TITLE: 'Tiêu đề',
  DESCRIPTION: 'Mô tả',
  PRICE: 'Giá bán',
  THUMBNAIL: 'Ảnh bìa',
  SLUG: 'Đường dẫn tĩnh (Slug)',
  WISHLIST: 'khóa học yêu thích',

  // --- LEARN & COMMUNITY ---
  WATCHED_SECONDS: 'Số giây đã xem',
  IS_COMPLETED: 'Trạng thái hoàn thành',
  CONTENT: 'Nội dung',
  PARENT_ID: 'ID bình luận cha',
  RATING: 'Đánh giá (Số sao)',
  LESSON_ID: 'ID Bài học',
  INSTRUCTOR_ID: 'ID Giảng viên',
  CATEGORY_ID: 'ID Danh mục',

  // --- GENERAL ---
  ID: 'ID',
  STATUS: 'Trạng thái',

  // --- VOUCHER ---
  VOUCHER_ID: 'ID mã giảm giá',
  VOUCHER_CODE: 'Mã giảm giá',
  VOUCHER_NAME: 'Tên mã giảm giá',

  // --- ORDER ---
  ORDER_ID: 'ID đơn hàng',
  ORDER_STATUS: 'Trạng thái đơn hàng',
} as const;

export type FieldName = (typeof FIELDS)[keyof typeof FIELDS];

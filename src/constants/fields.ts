// Định nghĩa danh sách TẤT CẢ các tên trường (Input Fields) dùng cho thông báo lỗi
export const FIELDS = {
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

  // --- COURSE (Chuẩn bị cho Phase sau) ---
  TITLE: 'Tiêu đề',
  DESCRIPTION: 'Mô tả',
  PRICE: 'Giá bán',
  THUMBNAIL: 'Ảnh bìa',

  // --- GENERAL ---
  ID: 'ID',
  STATUS: 'Trạng thái',
} as const;

export type FieldName = (typeof FIELDS)[keyof typeof FIELDS];

import { ResourceName } from './resources';
import { FieldName } from './fields';

export const MESSAGES = {
  SERVER: {
    CONFIGURE: (field: FieldName) => `Thiếu cấu hình cho ${field}.`,
  },
  // THÔNG BÁO CHUNG (Tái sử dụng 100% cho các Module sau này)
  COMMON: {
    SUCCESS: {
      CREATED: (resource: ResourceName) => `Tạo ${resource} thành công.`,
      UPDATED: (resource: ResourceName) => `Cập nhật ${resource} thành công.`,
      DELETED: (resource: ResourceName) => `Xóa ${resource} thành công.`,
      FETCHED_ALL: (resource: ResourceName) => `Lấy danh sách ${resource} thành công.`,
      FETCHED: (resource: ResourceName) => `Lấy thông tin ${resource} thành công.`,
    },
    ERROR: {
      NOT_FOUND: (resource: ResourceName) => `Không tìm thấy ${resource} trong hệ thống.`,
      ALREADY_EXISTS: (resource: ResourceName) => `${resource} này đã tồn tại.`,
      INVALID_INPUT: 'Dữ liệu đầu vào không hợp lệ',
      INTERNAL_SERVER_ERROR: 'Lỗi máy chủ nội bộ. Vui lòng thử lại sau.',
    },
  },
  SYSTEM: {
    UNIQUE_CONSTRAINT: (field: string) =>
      `Dữ liệu đã tồn tại. Vi phạm ràng buộc duy nhất trên: ${field}`,
    RECORD_NOT_FOUND: 'Không tìm thấy dữ liệu yêu cầu trong hệ thống.',
  },
  MIDDLEWARE: {
    FORBIDDEN: 'Bạn không có quyền truy cập tài nguyên này.',
    FORBIDDEN_OWNERSHIP: 'Bạn không có quyền thao tác trên dữ liệu của người khác.',
    MISSING_PERMISSION: (action: string) =>
      `Truy cập bị từ chối. Bạn thiếu quyền hạn: [${action}].`,
  },
  RATE_LIMIT: {
    API_SPAM: (minutes: number) =>
      `Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau ${minutes} phút.`,
    AUTH_SPAM: (minutes: number) => `Quá nhiều lần thử. Vui lòng thử lại sau ${minutes} phút.`,
  },
  NOTIFICATION: {
    MISSING_ESMS_KEYS: 'Chưa cấu hình eSMS Keys',
    MISSING_ZALO_TOKEN: 'Chưa cấu hình Zalo Access Token',
    SMS_REJECTED: 'SMS Gateway từ chối gửi',
    EMAIL_FAILED: 'Không thể gửi Email OTP lúc này.',
    SMS_FAILED: 'Không thể gửi SMS OTP lúc này.',
    ZALO_FAILED: 'Không thể gửi tin nhắn Zalo lúc này.',
  },

  // THÔNG BÁO CHO ZOD VALIDATION (Dùng chung toàn dự án)
  VALIDATION: {
    REQUIRED: (field: FieldName) => `${field} không được để trống`,
    MUST_BE_STRING: (field: FieldName) => `${field} bắt buộc phải là chuỗi`,
    MUST_BE_NUMBER: (field: FieldName) => `${field} bắt buộc phải là số`,
    MUST_BE_INTEGER: (field: FieldName) => `${field} phải là số nguyên`,
    MIN_VALUE: (field: FieldName, min: number) => `${field} tối thiểu là ${min}`,
    MAX_VALUE: (field: FieldName, max: number) => `${field} tối đa là ${max}`,
    INVALID_EMAIL: 'Email không đúng định dạng',
    MIN_LENGTH: (field: FieldName, min: number) => `${field} phải có ít nhất ${min} ký tự`,
    MAX_LENGTH: (field: FieldName, max: number) => `${field} không được vượt quá ${max} ký tự`,
    EXACT_LENGTH: (field: FieldName, length: number) => `${field} phải có đúng ${length} ký tự`,
    INVALID_FORMAT: (field: FieldName) => `Định dạng ${field} không hợp lệ`,
    INVALID_CHARS: (field: FieldName) => `${field} chứa ký tự không hợp lệ`,
    ONLY_NUMBERS: (field: FieldName) => `${field} chỉ được chứa các chữ số`,
    INVALID_UUID: (field: FieldName) => `${field} không đúng định dạng UUID`,
    INVALID_ENUM: (field: FieldName) => `${field} không hợp lệ`,
    MIN_PRICE_INVALID: 'Giá tối thiểu không được lớn hơn giá tối đa',

    // Đặc thù bảo mật (Auth)
    PASSWORD_UPPERCASE: 'Mật khẩu phải chứa ít nhất 1 chữ hoa',
    PASSWORD_NUMBER: 'Mật khẩu phải chứa ít nhất 1 chữ số',
    PASSWORD_NOT_MATCH_OLD: 'Mật khẩu mới không được trùng với mật khẩu cũ',
    PASSWORD_TOO_SIMILAR: 'Mật khẩu mới không được chứa một phần của mật khẩu cũ',
    MISSING_COOKIE_TOKEN: 'Không tìm thấy Refresh Token trong Cookie',
  },

  // THÔNG BÁO ĐẶC THÙ NGHIỆP VỤ (AUTH MODULE)
  AUTH: {
    SUCCESS: {
      REGISTER: 'Đăng ký thành công. Vui lòng kiểm tra email để xác thực.',
      LOGIN: 'Đăng nhập thành công.',
      REFRESH_TOKEN: 'Làm mới token thành công.',
      GET_SESSIONS: 'Lấy danh sách thiết bị thành công.',
      REVOKE_SESSION: 'Đã đăng xuất khỏi thiết bị.',
      REVOKE_OTHER_SESSIONS: 'Đã đăng xuất khỏi tất cả các thiết bị khác.',
      LOGOUT: 'Đăng xuất thành công.',
      OTP_SENT: 'Mã xác thực đã được gửi.',
      OTP_VERIFIED: 'Xác thực email thành công.',
      FORGOT_PASSWORD_SENT: 'Mã khôi phục mật khẩu đã được gửi.',
      RESET_PASSWORD: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.',
      CHANGE_PASSWORD: 'Đổi mật khẩu thành công.',
    },
    ERROR: {
      UNAUTHENTICATED: 'Chưa xác thực. Vui lòng đăng nhập.',
      MISSING_TOKEN: 'Không tìm thấy Token.',
      INVALID_TOKEN: 'Định dạng Token không hợp lệ.',
      TOKEN_EXPIRED: 'Token đã hết hạn.',
      MISSING_COOKIE_TOKEN: 'Phiên làm việc hết hạn.',
      INVALID_SESSION: 'Phiên đăng nhập không hợp lệ.',
      SESSION_REVOKED: 'Phiên đăng nhập đã bị thu hồi.',
      SESSION_EXPIRED: 'Phiên đăng nhập đã hết hạn.',
      INVALID_CREDENTIALS: 'Tài khoản không tồn tại hoặc đã bị khóa.',
      WRONG_PASSWORD: (attemptsLeft: number) =>
        `Mật khẩu không chính xác. Bạn còn ${attemptsLeft} lần thử.`,
      ACCOUNT_LOCKED: (minutes: number) =>
        `Tài khoản bị khóa. Vui lòng thử lại sau ${minutes} phút.`,
      EMAIL_ALREADY_VERIFIED: 'Email đã được xác thực.',
      PHONE_ALREADY_VERIFIED: 'Số điện thoại đã được xác thực.',
      OTP_COOLDOWN: (seconds: number) => `Vui lòng thử lại sau ${seconds} giây.`,
      INVALID_OTP: 'Mã OTP không hợp lệ hoặc không tồn tại.',
      EXPIRED_OTP: 'Mã OTP đã hết hạn.',
      WRONG_CURRENT_PASSWORD: 'Mật khẩu hiện tại không chính xác.',
      PASSWORD_MUST_BE_DIFFERENT: 'Mật khẩu mới phải khác với mật khẩu hiện tại',
      ROLE_NOT_FOUND: 'Lỗi cấu hình: Không tìm thấy Role mặc định.',
    },
  },

  // THÔNG BÁO ĐẶC THÙ NGHIỆP VỤ (PAYMENT MODULE)
  PAYMENT: {
    SUCCESS: {
      VNPAY_WEBHOOK_PROCESSED: 'Xác nhận giao dịch đang được xử lý.',
      VNPAY_WEBHOOK_COMPLETED: 'Xác nhận giao dịch thành công.',
    },
    ERROR: {
      INVALID_PAYMENT_METHOD: 'Phương thức thanh toán không hợp lệ.',
      INVALID_SIGNATURE: 'Chữ ký điện tử không hợp lệ hoặc đã bị giả mạo.',
      INVALID_AMOUNT: 'Số tiền thanh toán không khớp với giá trị đơn hàng.',
      ALREADY_PROCESSED: 'Giao dịch này đã được xử lý trước đó.',
      MOMO_NOT_IMPLEMENTED: 'Cổng thanh toán MoMo đang được bảo trì',
      NOT_SUPPORTED_PAYMENT_METHOD: 'Cổng thanh toán không được hỗ trợ',
    },
  },

  CART: {
    SUCCESS: {
      SYNC: 'Đồng bộ giỏ hàng thành công',
    },
    ERROR: {
      EMPTY: 'Giỏ hàng trống',
      MAX_VALUE: (max: number) => `Giỏ hàng không được vượt quá ${max} khóa học tối đa`,
      OWNED: (resource: ResourceName) => `Bạn đã sở hữu ${resource} này, không thể thêm vào giỏ.`,
      EXISTING: (resource: ResourceName) => `${resource} này đã có trong giỏ hàng.`,
    },
  },

  WISHLIST: {
    SUCCESS: {},
    ERROR: {},
  },
  VIEW: {
    SUCCESS: {
      TRACKED: 'Ghi nhận lịch sử xem thành công.',
    },
    ERROR: {},
  },

  VOUCHER: {
    SUCCESS: {
      FETCHED_ALL_AVAILABLE: 'Lấy danh sách mã có thể áp dụng thành công',
      APPLIED: 'Áp dụng mã giảm giá thành công',
    },
    ERROR: {
      INVALID: 'Mã giảm giá không hợp lệ, chưa bắt đầu, đã hết hạn hoặc bị khóa',
      OFF_LIMIT: 'Mã giảm giá đã hết lượt sử dụng',
      FORBIDDEN: 'Bạn không thể tự lưu mã giảm giá đặc quyền này',
      HAVE_NOT_SAVED: 'Bạn đã lưu mã giảm giá này rồi',
      EMPTY_CART: 'Giỏ hàng trống, không thể áp mã',
      NOT_OWNED: 'Bạn không sở hữu mã giảm giá này',
      MIN_ORDER_VALUE: (min: number) => `Đơn hàng chưa đạt mức tối thiểu ${min} để áp mã này`,
      RACE_CONDITION:
        'Rất tiếc, mã giảm giá vừa hết lượt sử dụng trong tích tắc. Vui lòng thử mã khác.',
    },
  },

  ORDER: {
    SUCCESS: {
      CREATED_PAYMENT_URL: 'Tạo link thanh toán thành công',
      CREATED: 'Tạo đơn hàng thành công, vui lòng tiến hành thanh toán.',
      POLLING: 'Polling trạng thái',
    },
    ERROR: {
      PENDING:
        'Bạn đang có một đơn hàng chờ thanh toán cho các khóa học này. Vui lòng hoàn tất hoặc hủy đơn cũ.',
      STATUS: (status: string) => `Đơn hàng này đã ở trạng thái ${status}.`,
    },
  },
  ACTIVITY: {
    SUCCESS: {
      ADDED: (resource: ResourceName, location: ResourceName) =>
        `Đã thêm ${resource} vào ${location} thành công.`,
      SAVED: (resource: ResourceName, location: ResourceName) =>
        `Lưu ${resource} vào ${location} thành công.`,
      REMOVED: (resource: ResourceName, location: ResourceName) =>
        `Đã xóa ${resource} khỏi ${location} thành công.`,
      CLEARED: (location: ResourceName) => `Đã dọn sạch ${location}.`,
      MOVED: (resource: ResourceName, from: ResourceName, to: ResourceName) =>
        `Đã chuyển ${resource} từ ${from} sang ${to}.`,
    },
    ERROR: {
      NON_EXISTING: (resource: ResourceName, location: ResourceName) =>
        `${resource} không tồn tại trong ${location}.`,
    },
  },
};

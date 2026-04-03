export const APP_CONFIG = {
  // Dùng chung cho toàn bộ hệ thống
  COMMON: {
    PAGINATION: {
      DEFAULT_PAGE: 1,
      DEFAULT_LIMIT: 10,
      MAX_LIMIT: 100, // Chặn client request quá nhiều dữ liệu
    },
    UPLOAD: {
      MAX_IMAGE_SIZE_MB: 5,
      MAX_VIDEO_SIZE_MB: 500,
    },
  },
  AUTH: {
    DEFAULT_ROLE: 'STUDENT',
    MAX_DEVICES_PER_USER: 3,
    MAX_FAILED_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION_MINUTES: 15,
    OTP_VERIFY_EXPIRATION_MINUTES: 5,
    OTP_FORGOT_EXPIRATION_MINUTES: 15,
    OTP_COOLDOWN_SECONDS: 60,
    SESSION_EXPIRES_IN_DAYS: 1,
    REMEMBER_ME_EXPIRES_IN_DAYS: 30,
  },
  RATE_LIMIT: {
    API_WINDOW_MINUTES: 15,
    API_MAX_REQUESTS: 100,
    AUTH_WINDOW_MINUTES: 1,
    AUTH_MAX_REQUESTS: 5,
  },
  // Sau này có các module khác:
  // COURSE: { MAX_VIDEO_SIZE_MB: 500 }
};

// Định nghĩa các kênh gửi OTP
export const OTP_CHANNELS = {
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  ZALO: 'ZALO',
} as const;

export type OtpChannel = keyof typeof OTP_CHANNELS;

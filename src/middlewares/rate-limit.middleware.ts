import rateLimit from 'express-rate-limit';
import { APP_CONFIG } from '@/constants/app.constant';
import { MESSAGES } from '@/constants/messages';
import { ERROR_CODES } from '@/constants/error-codes';

// 1. Limiter chung cho toàn bộ API (Chống spam request)
export const apiLimiter = rateLimit({
  windowMs: APP_CONFIG.RATE_LIMIT.API_WINDOW_MINUTES * 60 * 1000, // 15 phút
  max: APP_CONFIG.RATE_LIMIT.API_MAX_REQUESTS, // Giới hạn 100 request / 1 IP / 15 phút
  message: {
    success: false,
    message: MESSAGES.RATE_LIMIT.API_SPAM(APP_CONFIG.RATE_LIMIT.API_WINDOW_MINUTES),
    error_code: ERROR_CODES.RATE_LIMIT.TOO_MANY_REQUESTS,
  },
  standardHeaders: true, // Trả về thông tin limit trong header `RateLimit-*`
  legacyHeaders: false, // Tắt các header cũ `X-RateLimit-*`
});

// 2. Limiter nghiêm ngặt dành riêng cho Auth (Chống dò mật khẩu/Spam OTP)
export const authLimiter = rateLimit({
  windowMs: APP_CONFIG.RATE_LIMIT.AUTH_WINDOW_MINUTES * 60 * 1000, // 1 phút
  max: APP_CONFIG.RATE_LIMIT.AUTH_MAX_REQUESTS, // Giới hạn 5 request / 1 IP / 1 phút
  message: {
    success: false,
    message: MESSAGES.RATE_LIMIT.AUTH_SPAM(APP_CONFIG.RATE_LIMIT.AUTH_WINDOW_MINUTES),
    error_code: ERROR_CODES.RATE_LIMIT.TOO_MANY_REQUESTS,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

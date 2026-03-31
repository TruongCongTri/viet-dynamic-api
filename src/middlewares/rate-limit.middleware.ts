import rateLimit from 'express-rate-limit';

// 1. Limiter chung cho toàn bộ API (Chống spam request)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 100, // Giới hạn 100 request / 1 IP / 15 phút
  message: {
    success: false,
    message: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.',
  },
  standardHeaders: true, // Trả về thông tin limit trong header `RateLimit-*`
  legacyHeaders: false, // Tắt các header cũ `X-RateLimit-*`
});

// 2. Limiter nghiêm ngặt dành riêng cho Auth (Chống dò mật khẩu/Spam OTP)
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 5, // Giới hạn 5 request / 1 IP / 1 phút
  message: {
    success: false,
    message: 'Quá nhiều lần thử đăng nhập/đăng ký. Vui lòng thử lại sau 1 phút.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

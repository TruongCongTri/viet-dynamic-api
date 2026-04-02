export const API_VERSION = '/api/v1';

export const ENDPOINTS = {
  AUTH: {
    BASE: '/auth',
    REGISTER: '/register',
    LOGIN: '/login',
    LOGOUT: '/logout',
    REFRESH_TOKEN: '/refresh-token',
    GOOGLE: '/google',
    GOOGLE_CALLBACK: '/google/callback',
    SEND_VERIFY_EMAIL: '/send-verify-email',
    VERIFY_EMAIL: '/verify-email',
    FORGOT_PASSWORD: '/forgot-password',
    RESET_PASSWORD: '/reset-password',
    CHANGE_PASSWORD: '/change-password',
    SESSIONS: '/sessions',
    REVOKE_SESSION: '/sessions/:sessionId',
    REVOKE_OTHER_SESSIONS: '/sessions/others',
  },
  PUBLIC: {
    CATEGORIES: '/categories',
    COURSES: '/courses',
    COURSE_DETAIL: '/courses/:slug', // Chi tiết khóa học cho khách
    COURSE_REVIEWS: '/courses/:slug/reviews', // Xem review public
    INSTRUCTORS: '/instructors',
    INSTRUCTOR_DETAIL: '/instructors/:id', // Xem profile giảng viên
    WEBHOOK_PAYMENT: '/payments/webhook',
  },
  USER: {
    BASE: '/users/me',
    PROFILE: '/',
    AVATAR: '/avatar',
    PASSWORD: '/password',
    SESSIONS: '/sessions',
    EMAIL_CHANGE_REQUEST: '/request-email-change', // BỔ SUNG: Rào cản 3 tài liệu Auth
  },
  COMMERCE: {
    BASE: '', // Thường gắn trực tiếp vào root v1
    WISHLIST: '/wishlist',
    WISHLIST_TOGGLE: '/wishlist/toggle',
    CART: '/cart',
    CART_ITEMS: '/cart/items',
    MERGE_GUEST_CART: '/cart/merge-guest-cart', // BỔ SUNG: Rào cản 4 tài liệu E-com
    VOUCHERS: '/vouchers',
    VOUCHERS_APPLICABLE: '/vouchers/applicable', // BỔ SUNG: Gợi ý mã có thể dùng
    ORDERS: '/orders',
    ORDER_PAY: '/orders/:id/pay',
    ORDER_STATUS: '/orders/:id/status-polling',
    // BỔ SUNG: Recently Viewed (Vũ khí chốt sale)
    RECENTLY_VIEWED: '/courses/recently-viewed',
  },
  LEARN: {
    BASE: '/learn',
    MY_COURSES: '/my-courses',
    COURSE_SYLLABUS: '/courses/:slug', // BỔ SUNG: Lấy mục lục bài học đã mua
    COURSE_RESUME: '/courses/:slug/resume',
    LESSON: '/lessons/:id',
    PROGRESS: '/lessons/:id/progress',
    COMMENTS: '/lessons/:id/comments', // BỔ SUNG: Thảo luận bài học
    REVIEWS: '/courses/:slug/reviews', // BỔ SUNG: Đăng review (cần progress > 20%)
  },
  STUDIO: {
    BASE: '/studio',
    COURSES: '/courses',
    COURSE_DETAIL: '/courses/:id',
    PUBLISH_REQUEST: '/courses/:id/publish-request', // BỔ SUNG: Luồng duyệt bài
    MODULES: '/modules',
    LESSONS: '/lessons',
    UPLOAD_URL: '/lessons/:lessonId/upload-url',
    ANALYTICS: '/analytics/overview', // BỔ SUNG: Thống kê doanh thu giảng viên
    WEBHOOK_CLOUDFLARE: '/webhooks/cloudflare', // BỔ SUNG: Rào cản 4 tài liệu Video
  },
  ADMIN: {
    BASE: '/admin',
    USERS: '/users',
    USER_SESSIONS: '/users/:id/sessions', // BỔ SUNG: Chức năng "Đá văng" user
    COURSES: '/courses',
    CATEGORIES: '/categories',
    ORDERS: '/orders',
    ORDER_REFUND: '/orders/:id/refund', // BỔ SUNG: Nghiệp vụ hoàn tiền
    ORDER_SYNC: '/orders/:id/query-payment-status', // BỔ SUNG: Rào cản 3 tài liệu Payment
    VOUCHERS: '/vouchers',
    SYSTEM: '/system',
    SYSTEM_HEALTH: '/system/health',
    FORBIDDEN_WORDS: '/system/forbidden-words', // BỔ SUNG: Quản lý từ cấm
  },
} as const;

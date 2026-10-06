import request from 'supertest';
import app from '../../app';
import { prisma } from '../../common/configs/prisma.config';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('Auth API (E2E Tests - Full Coverage)', () => {
  const testEmail = 'e2e-edge-test@example.com';
  const correctPassword = 'Password123!';
  const wrongPassword = 'WrongPassword999!';

  // Lưu trữ Token để test các route Protected
  let validAccessToken: string;
  let validRefreshToken: string;

  beforeAll(async () => {
    // Dọn dẹp sạch sẽ trước khi bắt đầu
    await prisma.user.deleteMany({ where: { email: testEmail } });
  });

  afterAll(async () => {
    // Trả lại môi trường vô trùng sau khi test xong
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await prisma.$disconnect();
  });

  // ==========================================
  // 1. ĐĂNG KÝ (REGISTER)
  // ==========================================
  describe('POST /api/v1/auth/register', () => {
    it('1. Nên báo lỗi 422 khi Email sai định dạng (Zod Validation)', async () => {
      const response = await request(app).post('/api/v1/auth/register').send({
        email: 'invalid-email-format',
        password: correctPassword,
        fullName: 'Tester',
      });
      expect(response.status).toBe(422);
    });

    it('2. Nên báo lỗi 422 khi Mật khẩu quá yếu (Zod Validation)', async () => {
      const response = await request(app).post('/api/v1/auth/register').send({
        email: testEmail,
        password: '123', // Quá ngắn, không có ký tự đặc biệt
        fullName: 'Tester',
      });
      expect(response.status).toBe(422);
    });

    it('3. Nên Đăng ký tài khoản thành công (Happy Path)', async () => {
      const response = await request(app).post('/api/v1/auth/register').send({
        email: testEmail,
        password: correctPassword,
        fullName: 'E2E Edge Tester',
      });
      expect(response.status).toBe(201);
      expect(response.body.data.email).toBe(testEmail);
    });

    it('4. Nên báo lỗi 409 (Conflict) nếu đăng ký trùng Email', async () => {
      const response = await request(app).post('/api/v1/auth/register').send({
        email: testEmail, // Email vừa tạo ở test case 3
        password: correctPassword,
        fullName: 'Hacker',
      });
      expect(response.status).toBe(409);
    });
  });

  // ==========================================
  // 2. ĐĂNG NHẬP (LOGIN) & ANTI-BRUTEFORCE
  // ==========================================
  describe('POST /api/v1/auth/login', () => {
    it('5. Nên báo lỗi 401 khi đăng nhập bằng Email chưa đăng ký', async () => {
      const response = await request(app).post('/api/v1/auth/login').send({
        email: 'ghost@example.com',
        password: correctPassword,
      });
      expect(response.status).toBe(401);
    });

    it('6. Nên chặn đăng nhập (Lỗi 403) vì tài khoản mới tạo đang ở trạng thái PENDING', async () => {
      const response = await request(app).post('/api/v1/auth/login').send({
        email: testEmail,
        password: correctPassword,
      });
      // Do test case 3 tạo xong mặc định là PENDING
      expect(response.status).toBe(403);
    });

    it('7. Nên báo lỗi 401 khi nhập sai mật khẩu', async () => {
      // Đầu tiên, "Hack" DB để duyệt tài khoản này thành APPROVED
      await prisma.user.update({
        where: { email: testEmail },
        data: { accountStatus: 'APPROVED' },
      });

      const response = await request(app).post('/api/v1/auth/login').send({
        email: testEmail,
        password: wrongPassword, // Cố tình nhập sai
      });
      expect(response.status).toBe(401);
    });

    it('8. Nên KHÓA tài khoản (Lỗi 403) sau 5 lần nhập sai liên tiếp', async () => {
      // Lặp 4 lần nhập sai nữa (Lần 1 đã làm ở test case 7)
      for (let i = 0; i < 4; i++) {
        await request(app).post('/api/v1/auth/login').send({
          email: testEmail,
          password: wrongPassword,
        });
      }

      // Lần thứ 6 sẽ bị báo lỗi Khóa tài khoản (Account Locked)
      const lockedResponse = await request(app).post('/api/v1/auth/login').send({
        email: testEmail,
        password: correctPassword, // Dù giờ nhập ĐÚNG cũng không cho vào!
      });

      expect(lockedResponse.status).toBe(403);
      expect(lockedResponse.body.meta.error_code).toBe('ACCOUNT_LOCKED');

      // (Reset lại số lần sai trong DB để các bài test sau được chạy)
      await prisma.user.update({
        where: { email: testEmail },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    });

    it('9. Nên Đăng nhập thành công và cấp Tokens (Happy Path)', async () => {
      const response = await request(app).post('/api/v1/auth/login').send({
        email: testEmail,
        password: correctPassword,
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('accessToken');

      // 1. Lấy Access Token từ Body
      validAccessToken = response.body.data.accessToken;

      // 2. Lấy Refresh Token từ HttpOnly Cookie (Header 'set-cookie')
      const setCookieHeader = response.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined(); // Đảm bảo server có trả về cookie

      // [BẢN VÁ LỖI]: Chuẩn hóa về mảng. Nếu là string đơn thì tự bọc vào mảng [].
      const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];

      // Bây giờ cookies chắc chắn 100% là Array, hàm .find() sẽ hoạt động hoàn hảo
      const refreshTokenCookie = cookies.find((c: string) => c && c.startsWith('refreshToken='));

      if (refreshTokenCookie) {
        validRefreshToken = refreshTokenCookie.split(';')[0].split('=')[1];
      } else {
        // Fallback
        validRefreshToken = response.body.refreshToken;
      }

      expect(validRefreshToken).toBeDefined();
    });
  });

  // ==========================================
  // 3. REFRESH TOKEN
  // ==========================================
  describe('POST /api/v1/auth/refresh-token', () => {
    it('10. Nên báo lỗi 422 khi truyền Refresh Token giả mạo/không hợp lệ', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh-token')
        // Gắn vào cả Cookie và Body để test case này tương thích với mọi cấu hình Zod của bạn
        .set('Cookie', [`refreshToken=fake-refresh-token`])
        .send({ refreshToken: 'fake-refresh-token' });

      // Zod chặn thành công chuỗi không hợp lệ
      expect(response.status).toBe(422);
    });

    it('11. Nên cấp lại Access Token mới thành công', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh-token')
        .set('Cookie', [`refreshToken=${validRefreshToken}`]) // Gửi qua Cookie
        .send({ refreshToken: validRefreshToken }); // Gửi qua Body

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('accessToken');

      // Cập nhật Access Token mới nhất để dùng cho hàm Logout
      validAccessToken = response.body.data.accessToken;
    });
  });

  // ==========================================
  // 4. LOGOUT (PROTECTED ROUTE)
  // ==========================================
  describe('POST /api/v1/auth/logout', () => {
    it('12. Nên chặn truy cập (Lỗi 401) nếu không gửi kèm Access Token', async () => {
      const response = await request(app).post('/api/v1/auth/logout');
      expect(response.status).toBe(401);
    });

    it('13. Nên Đăng xuất thành công (Hủy Session)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${validAccessToken}`); // Gắn token hợp lệ

      expect(response.status).toBe(200);
    });
  });

  // ==========================================
  // 5. XÁC THỰC EMAIL (SEND & VERIFY OTP)
  // ==========================================
  describe('POST /api/v1/auth/send-verify-email & /verify-email', () => {
    let currentOtpCode: string;

    it('14. Nên gửi OTP xác thực Email thành công', async () => {
      // Dọn dẹp bảng OTP của user này trước để tránh dính Cooldown 60s
      await prisma.otp.deleteMany({ where: { email: testEmail } });

      const response = await request(app).post('/api/v1/auth/send-verify-email').send({
        identifier: testEmail,
        channel: 'EMAIL',
      });
      expect(response.status).toBe(200);

      // [HACK]: Truy vấn Database để lấy mã OTP vừa được tạo
      const otpRecord = await prisma.otp.findFirst({
        where: { email: testEmail, type: 'VERIFY_ACCOUNT' },
        orderBy: { createdAt: 'desc' },
      });

      expect(otpRecord).toBeDefined();
      currentOtpCode = otpRecord!.code; // Lưu lại để dùng cho test case sau
    });

    it('15. Nên báo lỗi 400 khi nhập sai mã OTP xác thực', async () => {
      const response = await request(app).post('/api/v1/auth/verify-email').send({
        identifier: testEmail,
        code: '000000', // Cố tình nhập sai
        channel: 'EMAIL',
      });
      expect(response.status).toBe(400);
      expect(response.body.meta.error_code).toBe('INVALID_OTP');
    });

    it('16. Nên Xác thực Email thành công với mã OTP đúng', async () => {
      const response = await request(app).post('/api/v1/auth/verify-email').send({
        identifier: testEmail,
        code: currentOtpCode, // Mã lấy từ DB
        channel: 'EMAIL',
      });
      expect(response.status).toBe(200);
    });

    it('17. Nên báo lỗi 400 nếu yêu cầu gửi lại OTP khi tài khoản đã verify', async () => {
      const response = await request(app).post('/api/v1/auth/send-verify-email').send({
        identifier: testEmail,
        channel: 'EMAIL',
      });
      expect(response.status).toBe(400);
      expect(response.body.meta.error_code).toBe('EMAIL_ALREADY_VERIFIED');
    });
  });

  // ==========================================
  // 6. QUÊN MẬT KHẨU & KHÔI PHỤC (FORGOT / RESET)
  // ==========================================
  describe('POST /api/v1/auth/forgot-password & /reset-password', () => {
    let resetOtpCode: string;
    const newResetPassword = 'NewPassword999!';

    it('18. Nên báo lỗi 404 khi yêu cầu quên mật khẩu cho Email lạ', async () => {
      const response = await request(app).post('/api/v1/auth/forgot-password').send({
        email: 'nobody@example.com',
      });
      expect(response.status).toBe(404);
    });

    it('19. Nên gửi OTP Khôi phục mật khẩu thành công', async () => {
      const response = await request(app).post('/api/v1/auth/forgot-password').send({
        email: testEmail,
      });
      expect(response.status).toBe(200);

      // Lấy OTP từ DB
      const otpRecord = await prisma.otp.findFirst({
        where: { email: testEmail, type: 'FORGOT_PASSWORD' },
        orderBy: { createdAt: 'desc' },
      });
      expect(otpRecord).toBeDefined();
      resetOtpCode = otpRecord!.code;
    });

    it('20. Nên báo lỗi 400 nếu mật khẩu mới trùng mật khẩu cũ', async () => {
      const response = await request(app).post('/api/v1/auth/reset-password').send({
        email: testEmail,
        code: resetOtpCode,
        newPassword: correctPassword, // Trùng pass cũ
      });
      expect(response.status).toBe(400);
      expect(response.body.meta.error_code).toBe('PASSWORD_MUST_BE_DIFFERENT');
    });

    it('21. Nên Khôi phục mật khẩu thành công', async () => {
      const response = await request(app).post('/api/v1/auth/reset-password').send({
        email: testEmail,
        code: resetOtpCode,
        newPassword: newResetPassword,
      });
      expect(response.status).toBe(200);
    });
  });

  // ==========================================
  // 7. ĐỔI MẬT KHẨU (CHANGE PASSWORD - PROTECTED)
  // ==========================================
  describe('PUT /api/v1/auth/change-password', () => {
    let freshAccessToken: string;

    // Sau khi Reset Password ở trên, TOÀN BỘ Session cũ đã bị Hủy (Logic AdminRevokeAll).
    // Chúng ta phải Login lại bằng mật khẩu MỚI để lấy Token đi test.
    beforeAll(async () => {
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: testEmail,
        password: 'NewPassword999!', // Pass vừa đổi ở Test 21
      });
      freshAccessToken = loginRes.body.data.accessToken;
    });

    it('22. Nên báo lỗi 400 khi nhập sai mật khẩu hiện tại', async () => {
      const response = await request(app)
        .put('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${freshAccessToken}`)
        .send({
          currentPassword: 'WrongCurrentPassword!',
          newPassword: 'FinalPassword123!',
        });
      expect(response.status).toBe(400);
    });

    it('23. Nên Đổi mật khẩu thành công và tự động Đăng xuất', async () => {
      const response = await request(app)
        .put('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${freshAccessToken}`)
        .send({
          currentPassword: 'NewPassword999!',
          newPassword: correctPassword, // Đổi ngược lại pass gốc
        });
      expect(response.status).toBe(200);

      // Kiểm chứng: Sau khi đổi pass, token cũ sẽ bị vô hiệu hóa
      const checkRes = await request(app)
        .get('/api/v1/auth/sessions') // Gọi bừa 1 route protected
        .set('Authorization', `Bearer ${freshAccessToken}`);

      // Token bị thu hồi nên sẽ văng 401
      expect(checkRes.status).toBe(401);
    });
  });
});

import request from 'supertest';
import app from '../../app';
import { prisma } from '../../common/configs/prisma.config';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('User API (E2E Tests - Full Coverage)', () => {
  // Dữ liệu dùng chung
  const mainUser = { email: 'main-user@ex.com', password: 'Password123!', fullName: 'Main User' };
  const targetUser = {
    email: 'target-user@ex.com',
    password: 'Password123!',
    fullName: 'Target User',
  };

  let accessToken: string;
  const targetPhone = '0999999999'; // Số điện thoại giả định của targetUser để test Conflict

  beforeAll(async () => {
    // 1. Dọn dẹp sạch sẽ DB
    await prisma.user.deleteMany({ where: { email: { in: [mainUser.email, targetUser.email] } } });

    // 2. Tạo Target User (để chiếm dụng email và phone, test lỗi 409 Conflict)
    const targetRes = await request(app).post('/api/v1/auth/register').send(targetUser);
    const targetId = targetRes.body.data?.id;
    if (targetId) {
      await prisma.user.update({ where: { id: targetId }, data: { phone: targetPhone } });
    }

    // 3. Tạo Main User
    const mainRes = await request(app).post('/api/v1/auth/register').send(mainUser);
    const mainId = mainRes.body.data?.id;

    // Bắt buộc phải Active/Approve tài khoản trước khi Login
    if (mainId) {
      await prisma.user.update({
        where: { id: mainId },
        data: { accountStatus: 'APPROVED', isEmailVerified: true },
      });
    }

    // 4. Đăng nhập để lấy Token
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: mainUser.email,
      password: mainUser.password,
    });

    // Nếu Login văng lỗi, in thẳng ra Terminal để debug (phòng hờ)
    if (loginRes.status !== 200) {
      console.error('LỖI LOGIN BƯỚC SETUP:', loginRes.body);
    }

    accessToken = loginRes.body.data?.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [mainUser.email, targetUser.email] } } });
    await prisma.$disconnect();
  });

  // ==========================================
  // [0] MIDDLEWARE BẢO VỆ
  // ==========================================
  describe('Authentication Middleware', () => {
    it('1. Nên chặn mọi API User (Lỗi 401) nếu không có Access Token', async () => {
      const response = await request(app).get('/api/v1/users/me');
      expect(response.status).toBe(401);
    });
  });

  // ==========================================
  // [A] USER PROFILE MANAGEMENT
  // ==========================================
  describe('GET /api/v1/users/me', () => {
    it('2. Nên lấy thông tin Profile thành công', async () => {
      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.email).toBe(mainUser.email);
      expect(response.body.data.profile.fullName).toBe(mainUser.fullName);
      expect(response.body.data.accessControl).toBeDefined();
    });
  });

  describe('PUT /api/v1/users/me', () => {
    it('3. Nên báo lỗi 409 khi cập nhật số điện thoại đã có người khác dùng', async () => {
      const response = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ phone: targetPhone, fullName: 'Change Name' }); // Trùng phone với Target User

      expect(response.status).toBe(409);
    });

    it('4. Nên cập nhật Profile và Phone thành công', async () => {
      const response = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ phone: '0888888888', fullName: 'Updated Main User', bio: 'I am a tester' });

      expect(response.status).toBe(200);
      expect(response.body.data.phone).toBe('0888888888');
      expect(response.body.data.profile.fullName).toBe('Updated Main User');
      expect(response.body.data.profile.bio).toBe('I am a tester');
    });
  });

  describe('PATCH /api/v1/users/me/avatar', () => {
    it('5. Nên báo lỗi 400 nếu Multer phát hiện file không phải là ảnh', async () => {
      // Gửi một file text giả mạo
      const fakeTxtBuffer = Buffer.from('Hello, I am a text file masquerading as an image!');

      const response = await request(app)
        .patch('/api/v1/users/me/avatar')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('avatar', fakeTxtBuffer, 'hack.txt'); // File txt sẽ bị multer fileFilter chặn

      expect(response.status).toBe(400); // Lỗi do Filter của Multer
    });

    it('6. Nên Upload Avatar thành công', async () => {
      // Tạo một ảnh giả bằng bộ nhớ (Buffer)
      const fakeImageBuffer = Buffer.from('89504E470D0A1A0A', 'hex'); // Magic bytes của PNG

      const response = await request(app)
        .patch('/api/v1/users/me/avatar')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('avatar', fakeImageBuffer, 'avatar.png'); // Gắn đúng file ảnh

      expect(response.status).toBe(200);
      expect(response.body.data.avatarUrl).toContain('https://vietdynamic.com');
    });
  });

  // ==========================================
  // [B] ĐỔI EMAIL
  // ==========================================
  describe('POST /api/v1/users/me/request-email-change', () => {
    it('7. Nên báo lỗi 400 nếu đổi sang chính email hiện tại', async () => {
      const response = await request(app)
        .post('/api/v1/users/me/request-email-change')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ newEmail: mainUser.email });

      expect(response.status).toBe(400);
    });

    it('8. Nên báo lỗi 409 nếu email mới đã bị người khác đăng ký', async () => {
      const response = await request(app)
        .post('/api/v1/users/me/request-email-change')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ newEmail: targetUser.email }); // Trùng với email của Target User

      expect(response.status).toBe(409);
    });

    it('9. Nên gửi OTP xác thực thay đổi Email thành công', async () => {
      const response = await request(app)
        .post('/api/v1/users/me/request-email-change')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ newEmail: 'fresh-new-email@ex.com' });

      expect(response.status).toBe(200);
    });
  });

  // ==========================================
  // [C] SESSION & SECURITY MANAGEMENT
  // ==========================================
  describe('GET & DELETE /api/v1/users/me/sessions', () => {
    let currentSessionId: string;

    it('10. Nên lấy được danh sách phiên đăng nhập', async () => {
      const response = await request(app)
        .get('/api/v1/users/me/sessions')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);

      // Lưu lại Session ID để test API Revoke ở bên dưới
      currentSessionId = response.body.data[0].sessionId;
    });

    it('11. Nên đăng xuất tất cả thiết bị khác thành công', async () => {
      const response = await request(app)
        .delete('/api/v1/users/me/sessions')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
    });

    it('12. Nên đăng xuất chính phiên hiện tại bằng ID thành công', async () => {
      const response = await request(app)
        .delete(`/api/v1/users/me/sessions/${currentSessionId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
    });
  });

  // ==========================================
  // [D] DELETE ACCOUNT (Phải chạy cuối cùng)
  // ==========================================
  describe('DELETE /api/v1/users/me', () => {
    // Vì phiên hiện tại đã bị đăng xuất ở Test số 12, ta phải Login lại!
    let freshToken: string;

    beforeAll(async () => {
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: mainUser.email,
        password: mainUser.password,
      });

      if (loginRes.status !== 200) {
        console.error('LỖI LOGIN TRƯỚC KHI XÓA TK:', loginRes.body);
      }
      freshToken = loginRes.body.data?.accessToken;
    });

    it('13. Nên báo lỗi 401 khi nhập sai mật khẩu xác nhận', async () => {
      const response = await request(app)
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ passwordConfirm: 'WrongPassword99!' });

      expect(response.status).toBe(401);
    });

    it('14. Nên xóa vĩnh viễn tài khoản thành công', async () => {
      const response = await request(app)
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ passwordConfirm: mainUser.password }); // Mật khẩu đúng

      expect(response.status).toBe(200);

      // Thử gọi lại Profile xem còn không
      const checkRes = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${freshToken}`);

      // Hệ thống trả về 401 vì User đã biến mất khỏi DB (middleware xác thực sẽ fail)
      expect(checkRes.status).toBe(401);
    });
  });
});

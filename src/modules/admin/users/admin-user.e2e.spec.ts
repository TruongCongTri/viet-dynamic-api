import request from 'supertest';
import app from '../../../app';
import { prisma } from '../../../common/configs/prisma.config';
import jwt from 'jsonwebtoken';
import { env } from '../../../common/configs/env.config';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('Admin User API (E2E Tests)', () => {
  let adminToken: string;
  let adminUserId: string | undefined = undefined;
  let testSessionId: string | undefined = undefined;
  let targetUserId: string | undefined = undefined;
  let testCourseId: string | undefined = undefined;

  beforeAll(async () => {
    // 1. TẠO ADMIN USER
    const adminUser = await prisma.user.create({
      data: {
        email: 'superadmin-user@test.com',
        password: 'hashedpassword',
        isActive: true,
        role: { connectOrCreate: { where: { name: 'ADMIN' }, create: { name: 'ADMIN' } } },
      },
    });
    adminUserId = adminUser.id;

    // 2. TẠO ADMIN SESSION (Bắt buộc để vượt qua auth middleware)
    const session = await prisma.session.create({
      data: {
        userId: adminUserId,
        refreshToken: 'fake-refresh-token-admin-user',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    testSessionId = session.id;

    // 3. TẠO ADMIN TOKEN
    const secret = env.JWT_SECRET || process.env.JWT_SECRET || 'fallback_secret';
    adminToken = jwt.sign({ id: adminUserId, role: 'ADMIN', sessionId: testSessionId }, secret, {
      expiresIn: '1h',
    });

    // 4. TẠO TARGET USER (Nạn nhân để test Ban, Đổi Role,...)
    const user = await prisma.user.create({
      data: {
        email: 'target-e2e@test.com',
        password: 'hashedpassword',
        isActive: true,
        role: { connectOrCreate: { where: { name: 'STUDENT' }, create: { name: 'STUDENT' } } },
      },
    });
    targetUserId = user.id;

    // 5. Tạo một khóa học tạm
    const course = await prisma.course.create({
      data: {
        title: 'E2E Admin B2B Course',
        slug: 'e2e-admin-b2b',
        basePrice: 1000,
        status: 'PUBLISHED',
      },
    });
    testCourseId = course.id;
  });

  afterAll(async () => {
    // Clean up chặt chẽ theo thứ tự: xóa bảng con (Enrollment, Session) -> xóa bảng cha (User, Course)
    if (targetUserId) {
      await prisma.enrollment.deleteMany({ where: { userId: targetUserId } });
    }
    if (testCourseId) {
      await prisma.course.deleteMany({ where: { id: testCourseId } });
    }
    if (testSessionId) {
      await prisma.session.deleteMany({ where: { id: testSessionId } });
    }
    if (targetUserId) {
      await prisma.user.deleteMany({ where: { id: targetUserId } });
    }
    if (adminUserId) {
      await prisma.user.deleteMany({ where: { id: adminUserId } });
    }
  });

  // ==========================================
  // [A] TRUY XUẤT DỮ LIỆU
  // ==========================================
  describe('User Retrieval', () => {
    it('1. Nên LẤY danh sách User kèm phân trang', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      // console.log(res.body)
      expect(res.body.data).toBeDefined();
      expect(res.body.meta.pagination.current_page).toBe(1);
    });

    it('2. Nên LẤY chi tiết Target User', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('target-e2e@test.com');
    });
  });

  // ==========================================
  // [B] PHÂN QUYỀN & TRẠNG THÁI
  // ==========================================
  describe('User Status & Roles', () => {
    it('3. Nên KHÓA (Ban) tài khoản User thành công', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/users/${targetUserId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.meta.message).toContain('Đã khóa tài khoản');
    });

    it('4. Nên GHI ĐÈ Permissions ngoại lệ thành công', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/users/${targetUserId}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ permissionIds: [] }); // Gửi mảng rỗng để test

      expect(res.status).toBe(200);
      expect(res.body.meta.message).toBe('Đã ghi đè quyền ngoại lệ thành công.');
    });
  });

  // ==========================================
  // [C] CAN THIỆP HỆ THỐNG
  // ==========================================
  describe('System Intervention', () => {
    it('5. Nên ĐÁ tất cả sessions của User', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/users/${targetUserId}/sessions`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.meta.message).toContain('Đã cưỡng chế đăng xuất');
    });

    it('6. Nên CẤP khóa học (Enroll B2B) cho User', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/users/${targetUserId}/enrollments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ courseId: testCourseId });

      expect(res.status).toBe(200);
      expect(res.body.meta.message).toContain('Cấp quyền truy cập');
    });

    it('7. Nên báo lỗi 400 nếu CẤP LẠI khóa học đã sở hữu', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/users/${targetUserId}/enrollments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ courseId: testCourseId });

      expect(res.status).toBe(400);
    });

    it('8. Nên THU HỒI khóa học B2B thành công', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/users/${targetUserId}/enrollments/${testCourseId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.meta.message).toContain('Đã thu hồi quyền truy cập');
    });
  });
});

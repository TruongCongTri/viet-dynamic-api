import request from 'supertest';
import app from '../../../app';
import { prisma } from '../../../common/configs/prisma.config';
import jwt from 'jsonwebtoken';
import { env } from '../../../common/configs/env.config';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('Admin Course API (E2E Tests)', () => {
  let adminToken: string;
  let adminUserId: string | undefined = undefined;
  let testSessionId: string | undefined = undefined;
  let testCategoryId: string | undefined = undefined;
  let createdCategoryId: string | undefined = undefined;
  let testCourseId: string | undefined = undefined;
  let testInstructorId: string | undefined = undefined;

  beforeAll(async () => {
    // 1. Tạo Admin & Session
    const adminUser = await prisma.user.create({
      data: {
        email: 'superadmin-course@test.com',
        password: 'hashedpassword',
        isActive: true,
        role: { connectOrCreate: { where: { name: 'ADMIN' }, create: { name: 'ADMIN' } } },
      },
    });
    adminUserId = adminUser.id;

    const session = await prisma.session.create({
      data: {
        userId: adminUserId,
        refreshToken: 'fake-refresh-token-admin-course',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    testSessionId = session.id;

    const secret = env.JWT_SECRET || process.env.JWT_SECRET || 'fallback_secret';
    adminToken = jwt.sign({ id: adminUserId, role: 'ADMIN', sessionId: testSessionId }, secret, {
      expiresIn: '1h',
    });

    // 2. Tạo Mock Category & Course & Instructor
    const category = await prisma.category.create({
      data: { name: 'E2E Tech', slug: 'e2e-tech', description: 'Test' },
    });
    testCategoryId = category.id;

    const course = await prisma.course.create({
      data: {
        title: 'E2E Pending Course',
        slug: 'e2e-pending-course',
        basePrice: 1000,
        status: 'PENDING',
        categoryId: testCategoryId,
      },
    });
    testCourseId = course.id;

    const instructor = await prisma.user.create({
      data: {
        email: 'inst-course-e2e@test.com',
        password: 'hash',
        role: {
          connectOrCreate: { where: { name: 'INSTRUCTOR' }, create: { name: 'INSTRUCTOR' } },
        },
      },
    });
    testInstructorId = instructor.id;
  });

  afterAll(async () => {
    if (testCourseId)
      await prisma.courseInstructor.deleteMany({ where: { courseId: testCourseId } });
    if (testCourseId) await prisma.course.deleteMany({ where: { id: testCourseId } });
    if (createdCategoryId) await prisma.category.deleteMany({ where: { id: createdCategoryId } });
    if (testCategoryId) await prisma.category.deleteMany({ where: { id: testCategoryId } });
    if (testInstructorId) await prisma.user.deleteMany({ where: { id: testInstructorId } });
    if (testSessionId) await prisma.session.deleteMany({ where: { id: testSessionId } });
    if (adminUserId) await prisma.user.deleteMany({ where: { id: adminUserId } });
  });

  // ==========================================
  // [A] CATEGORIES
  // ==========================================
  describe('Category Management', () => {
    it('1. Nên TẠO danh mục mới', async () => {
      const uniqueSuffix = Date.now();
      const uniqueName = `E2E Design ${uniqueSuffix}`;
      const uniqueSlug = `e2e-design-${uniqueSuffix}`;

      const res = await request(app)
        .post('/api/v1/admin/courses/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: uniqueName, slug: uniqueSlug });

      expect(res.status).toBe(201);
      // Kiểm tra tên có khớp không
      expect(res.body.data.name).toBe(uniqueName);

      // Lưu lại ID để tí nữa xóa
      createdCategoryId = res.body.data.id;
    });

    it('2. Nên LẤY danh sách danh mục', async () => {
      const res = await request(app)
        .get('/api/v1/admin/courses/categories')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBeTruthy();
    });
  });

  // ==========================================
  // [B] COURSE MODERATION
  // ==========================================
  describe('Course Moderation', () => {
    it('3. Nên lấy danh sách Khóa học chờ duyệt', async () => {
      const res = await request(app)
        .get('/api/v1/admin/courses/courses?status=PENDING')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('4. Nên TỪ CHỐI (Reject) khóa học (Yêu cầu có lý do)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/courses/courses/${testCourseId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Nội dung vi phạm bản quyền' });

      expect(res.status).toBe(200);
      expect(res.body.meta.message).toContain('từ chối');
    });

    it('5. Nên PHÊ DUYỆT (Approve) khóa học', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/courses/courses/${testCourseId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.meta.message).toContain('PHÊ DUYỆT');
    });

    it('6. Nên KÉO SẬP (Takedown) khóa học', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/courses/courses/${testCourseId}/takedown`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.meta.message).toContain('KÉO SẬP');
    });
  });

  // ==========================================
  // [C] INSTRUCTOR ASSIGNMENT
  // ==========================================
  describe('Instructor Assignment', () => {
    it('7. Nên ném lỗi 400 nếu chia tiền không đủ 100%', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/courses/courses/${testCourseId}/instructors`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          instructors: [{ userId: testInstructorId, isOwner: true, revenueShare: 90 }], // Thiếu 10%
        });

      expect(res.status).toBe(400);
      expect(res.body.meta.message).toContain('100%');
    });

    it('8. Nên phân công giảng viên hợp lệ', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/courses/courses/${testCourseId}/instructors`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          instructors: [{ userId: testInstructorId, isOwner: true, revenueShare: 100 }],
        });

      expect(res.status).toBe(200);
      expect(res.body.meta.message).toContain('thành công');
    });
  });
});

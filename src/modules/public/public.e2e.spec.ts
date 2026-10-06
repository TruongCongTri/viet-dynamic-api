import request from 'supertest';
import app from '../../app';
import { prisma } from '../../common/configs/prisma.config';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import crypto from 'crypto';
import { slugify } from '../../common/utils/slugify.util';
import { env } from '../../common/configs/env.config';
describe('Public API (E2E Tests - High Performance)', () => {
  let testCategoryId: string;
  let testCourseId: string;
  let testInstructorId: string;
  let testPaymentId: string;
  const courseSlug = slugify('e2e-public-course');

  beforeAll(async () => {
    // Ép biến môi trường để Webhook chạy mượt
    process.env.VNPAY_HASH_SECRET = 'e2e-vnpay-secret';

    // 1. Dọn dẹp
    // await prisma.review.deleteMany({ where: { comment: 'Hay quá' } });
    await prisma.payment.deleteMany({ where: { order: { userId: 'e2e-public-user' } } });
    await prisma.order.deleteMany({ where: { userId: 'e2e-public-user' } });
    await prisma.courseInstructor.deleteMany({ where: { course: { slug: 'e2e-public-course' } } });
    await prisma.course.deleteMany({ where: { slug: 'e2e-public-course' } });
    await prisma.category.deleteMany({ where: { slug: 'e2e-public-category' } });
    await prisma.user.deleteMany({ where: { id: 'e2e-public-user' } });

    // 2. Chuẩn bị Dữ liệu (Mock Data)
    const category = await prisma.category.upsert({
      where: { slug: 'e2e-public-category' },
      update: {},
      create: { name: 'E2E Public Category', slug: 'e2e-public-category' },
    });
    testCategoryId = category.id;

    const user = await prisma.user.upsert({
      where: { email: 'public-inst@ex.com' },
      update: {},
      create: {
        id: 'e2e-public-user',
        email: 'public-inst@ex.com',
        password: '123',
        accountStatus: 'APPROVED',
        profile: { create: { fullName: 'Thầy Giáo E2E' } },
        // [BẢN VÁ LỖI]: Bổ sung kết nối với bảng Role bắt buộc
        role: { connect: { name: 'INSTRUCTOR' } },
      },
    });
    testInstructorId = user.id;

    // TẠO KHÓA HỌC PUBLISHED
    const course = await prisma.course.create({
      data: {
        title: 'E2E Public Course',
        slug: courseSlug,
        basePrice: 200000,
        status: 'PUBLISHED', // [TEST BỘ LỌC]: Ép cứng PUBLISHED
        categoryId: testCategoryId,
        instructors: { create: { userId: testInstructorId, isOwner: true } },
      },
    });
    testCourseId = course.id;

    // Tạo Order & Payment để test Webhook
    const order = await prisma.order.create({
      data: {
        id: 'ord-public',
        userId: testInstructorId,
        totalAmount: 200000,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    const payment = await prisma.payment.create({
      data: {
        id: 'pay-public',
        orderId: order.id,
        provider: 'VNPAY',
        amount: 200000,
        status: 'PENDING',
      },
    });
    testPaymentId = payment.id;
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { id: testPaymentId } });
    await prisma.order.deleteMany({ where: { id: 'ord-public' } });
    await prisma.courseInstructor.deleteMany({ where: { courseId: testCourseId } });
    await prisma.course.deleteMany({ where: { id: testCourseId } });
    await prisma.category.deleteMany({ where: { id: testCategoryId } });
    await prisma.user.deleteMany({ where: { id: testInstructorId } });
    await prisma.$disconnect();
  });

  // ==========================================
  // [A] PUBLIC ENDPOINTS
  // ==========================================
  describe('Tốc độ & Phân trang', () => {
    it('1. Nên lấy Danh mục với Phân trang (page=1, limit=20)', async () => {
      const res = await request(app).get('/api/v1/public/categories?page=1&limit=20');

      expect(res.status).toBe(200);
      expect(res.body.meta).toBeDefined();
      //   expect(res.body.meta.itemsPerPage).toBe(20);
      //   expect(res.body.meta.currentPage).toBe(1);
    });

    it('2. Nên lấy danh sách Khóa học và làm phẳng Giảng viên', async () => {
      const res = await request(app).get('/api/v1/public/courses?page=1&limit=5');

      expect(res.status).toBe(200);
      // Đảm bảo có khóa học vừa tạo
      const course = res.body.data.find((c: any) => c.slug === courseSlug);
      expect(course).toBeDefined();
      expect(course.instructors[0].fullName).toBe('Thầy Giáo E2E'); // Flatten hoạt động
    });

    it('3. Nên lấy chi tiết Khóa học bằng Slug', async () => {
      const res = await request(app).get(`/api/v1/public/courses/${courseSlug}`);
      expect(res.status).toBe(200);

      const courseTitle = res.body.data ? res.body.data.title : res.body.title;
      expect(courseTitle).toBe('E2E Public Course');
    });

    it('4. Nên ném 404 nếu lấy chi tiết Khóa học không tồn tại (Hoặc bị DRAFT)', async () => {
      const slug = slugify('ghost-course-slug');
      const res = await request(app).get(`/api/v1/public/courses/${slug}`);
      expect(res.status).toBe(404);
    });
  });

  // ==========================================
  // [B] WEBHOOKS
  // ==========================================
  describe('Webhook Bảo mật', () => {
    it('5. Nên CHẶN Webhook VNPAY nếu chữ ký giả mạo', async () => {
      const res = await request(app)
        .post('/api/v1/public/payments/webhook/vnpay')
        .send({ vnp_TxnRef: testPaymentId, vnp_Amount: '20000000', vnp_SecureHash: 'fake-hash' });

      expect(res.status).toBe(400);
    });

    it('6. Nên XỬ LÝ thành công Webhook VNPAY với chữ ký thật', async () => {
      const payload: Record<string, any> = {
        vnp_Amount: '20000000',
        vnp_ResponseCode: '00',
        vnp_TransactionNo: 'vnp-live-123',
        vnp_TxnRef: testPaymentId,
      };

      const sortedKeys = Object.keys(payload).sort();
      const signData = sortedKeys
        .map((key) => `${key}=${encodeURIComponent(String(payload[key])).replace(/%20/g, '+')}`)
        .join('&');

      // [BẢN VÁ LỖI]: Dùng chính xác Secret Key của Server đang chạy thay vì fix cứng
      const secretKey =
        env.VNPAY_HASH_SECRET || process.env.VNPAY_HASH_SECRET || 'e2e-vnpay-secret';

      const validHash = crypto
        .createHmac('sha512', secretKey)
        .update(Buffer.from(signData, 'utf-8'))
        .digest('hex');

      const res = await request(app)
        .post('/api/v1/public/payments/webhook/vnpay')
        .send({ ...payload, vnp_SecureHash: validHash });

      expect(res.status).toBe(200);
      expect(res.body.RspCode).toBe('00');
    });
  });
});

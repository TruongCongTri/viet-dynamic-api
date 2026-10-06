import request from 'supertest';
import app from '../../../app';
import { prisma } from '../../../common/configs/prisma.config';
import jwt from 'jsonwebtoken';
import { env } from '../../../common/configs/env.config';
import { describe, it, expect, beforeAll, afterAll, jest, afterEach } from '@jest/globals';

const unmockedFetch = global.fetch;

describe('Admin Finance API (E2E Tests)', () => {
  let adminToken: string;
  let adminUserId: string | undefined = undefined;
  let testSessionId: string | undefined = undefined;

  let targetUserId: string | undefined = undefined;
  let testCourseId: string | undefined = undefined;

  let pendingOrderId: string | undefined = undefined;
  let successOrderId: string | undefined = undefined;
  let paymentVnpayId: string | undefined = undefined;

  beforeAll(async () => {
    // 1. TẠO ADMIN & JWT
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin-finance@test.com',
        password: 'hash',
        role: { connectOrCreate: { where: { name: 'ADMIN' }, create: { name: 'ADMIN' } } },
      },
    });
    adminUserId = adminUser.id;

    const session = await prisma.session.create({
      data: {
        userId: adminUserId,
        refreshToken: 'admin-finance-token',
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    testSessionId = session.id;

    const secret = env.JWT_SECRET || process.env.JWT_SECRET || 'fallback_secret';
    adminToken = jwt.sign({ id: adminUserId, role: 'ADMIN', sessionId: testSessionId }, secret, {
      expiresIn: '1h',
    });

    // 2. TẠO DỮ LIỆU ĐƠN HÀNG ĐỂ TEST
    const user = await prisma.user.create({
      data: {
        email: 'customer-finance@test.com',
        password: 'hash',
        // [VÁ LỖI Ở ĐÂY]: Bổ sung trường role bị thiếu
        role: {
          connectOrCreate: {
            where: { name: 'STUDENT' },
            create: { name: 'STUDENT' },
          },
        },
      },
    });
    targetUserId = user.id;

    const course = await prisma.course.create({
      data: { title: 'Finance Tech', slug: 'finance-tech', basePrice: 2000, status: 'PUBLISHED' },
    });
    testCourseId = course.id;

    // Đơn Pending (Chờ thanh toán qua VNPAY)
    const pendingOrder = await prisma.order.create({
      data: {
        userId: targetUserId,
        status: 'PENDING',
        totalPrice: 2000,
        finalPrice: 2000,
        items: { create: [{ courseId: testCourseId, price: 2000 }] },
        payments: { create: [{ amount: 2000, provider: 'VNPAY', status: 'PENDING' }] },
      } as any,
      include: { payments: true },
    });
    pendingOrderId = pendingOrder.id;
    paymentVnpayId = (pendingOrder as any).payments[0].id;

    // Đơn Success (Để test Refund)
    const successOrder = await prisma.order.create({
      data: {
        userId: targetUserId,
        status: 'SUCCESS',
        totalPrice: 2000,
        finalPrice: 2000,
        items: { create: [{ courseId: testCourseId, price: 2000 }] },
      } as any,
    });
    successOrderId = successOrder.id;
  });

  afterAll(async () => {
    // Dọn dẹp sạch sẽ theo chuỗi quan hệ
    if (pendingOrderId) await prisma.payment.deleteMany({ where: { orderId: pendingOrderId } });
    await prisma.orderItem.deleteMany({ where: { courseId: testCourseId } });
    if (successOrderId) await prisma.order.deleteMany({ where: { id: successOrderId } });
    if (pendingOrderId) await prisma.order.deleteMany({ where: { id: pendingOrderId } });

    if (testCourseId) await prisma.course.deleteMany({ where: { id: testCourseId } });
    if (testSessionId) await prisma.session.deleteMany({ where: { id: testSessionId } });
    if (targetUserId) await prisma.user.deleteMany({ where: { id: targetUserId } });
    if (adminUserId) await prisma.user.deleteMany({ where: { id: adminUserId } });
  });

  afterEach(() => {
    global.fetch = unmockedFetch; // Clear mock fetch sau các test tra soát
  });

  describe('GET Orders & Payments', () => {
    it('1. Nên LẤY tổng quan doanh thu (Overview)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/finance/overview')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('2. Nên LẤY danh sách Orders', async () => {
      const res = await request(app)
        .get('/api/v1/admin/finance/orders')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('3. Nên LẤY chi tiết đơn hàng', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/finance/orders/${pendingOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(pendingOrderId);
    });

    it('4. Nên LẤY payload Payment raw JSON', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/finance/payments/${paymentVnpayId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe('Order Operations', () => {
    it('5. Nên DỌN RÁC (Cleanup) các đơn hàng Pending', async () => {
      const res = await request(app)
        .post('/api/v1/admin/finance/orders/cleanup-trash')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.meta.message).toContain('Đã dọn dẹp');
    });

    it('6. Lỗi 400: Không cho REFUND đơn đang PENDING', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/finance/orders/${pendingOrderId}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Test' });
      expect(res.status).toBe(400);
    });

    it('7. Nên CẬP NHẬT TRẠNG THÁI (Manual Update) thành CANCELLED', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/finance/orders/${pendingOrderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CANCELLED' });
      expect(res.status).toBe(200);
      expect(res.body.meta.message).toContain('CANCELLED');
    });
  });

  describe('VNPAY Query Integration', () => {
    it('8. Trả về ALREADY_SUCCESS nếu tra soát đơn đã SUCCESS', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/finance/orders/${successOrderId}/query-payment-status`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.providerStatus).toBe('ALREADY_SUCCESS');
    });

    it('9. Nên xử lý TRA SOÁT (Mock Fetch) - Lỗi từ VNPAY (02)', async () => {
      // Mock fetch trả về response VNPAY lỗi
      global.fetch = jest.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ vnp_ResponseCode: '00', vnp_TransactionStatus: '02' }),
        })
      ) as any;

      const res = await request(app)
        .post(`/api/v1/admin/finance/orders/${pendingOrderId}/query-payment-status`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.providerStatus).toBe('02');
      expect(res.body.meta.message).toContain('chưa thanh toán');
    });
  });
});

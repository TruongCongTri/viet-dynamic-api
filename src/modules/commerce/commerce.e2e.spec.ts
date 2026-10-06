import request from 'supertest';
import app from '../../app';
import { prisma } from '../../common/configs/prisma.config';
import crypto from 'crypto';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { slugify } from '../../common/utils/slugify.util';
describe('Commerce API (E2E Tests - Full Coverage)', () => {
  const customerData = {
    email: 'customer-com@ex.com',
    password: 'Password123!',
    fullName: 'Com Customer',
  };

  let accessToken: string;
  let customerId: string;
  let testCourseId: string;
  let testVoucherId: string;
  let currentOrderId: string; // Lưu mã Order để test Payment & Polling

  const slug = slugify('E2E Commerce Course');
  beforeAll(async () => {
    // 1. Dọn dẹp Database
    await prisma.user.deleteMany({ where: { email: customerData.email } });
    await prisma.course.deleteMany({ where: { slug: 'e2e-commerce-course' } });
    await prisma.voucher.deleteMany({ where: { code: 'E2ETEST' } });

    // 2. Tạo Khách hàng & Lấy Token
    const registerRes = await request(app).post('/api/v1/auth/register').send(customerData);
    customerId = registerRes.body.data.id;
    await prisma.user.update({ where: { id: customerId }, data: { accountStatus: 'APPROVED' } });

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: customerData.email,
      password: customerData.password,
    });
    accessToken = loginRes.body.data.accessToken;

    // 3. Chuẩn bị dữ liệu Khóa học (Có giá tiền)
    const forcedCourseUuid = crypto.randomUUID();
    const instructor =
      (await prisma.user.findFirst({ where: { role: { name: 'INSTRUCTOR' } } })) ||
      (await prisma.user.create({
        data: {
          email: 'inst-com@ex.com',
          password: '123',
          profile: { create: { fullName: 'Inst' } },
          role: { connect: { name: 'INSTRUCTOR' } },
        },
      }));

    const course = await prisma.course.create({
      data: {
        id: forcedCourseUuid,
        title: 'E2E Commerce Course',
        slug: slug,
        instructors: { create: { userId: instructor.id, isOwner: true } },
        basePrice: 500000, // Khóa học giá 500k
        status: 'PUBLISHED',
      },
    });
    testCourseId = course.id;

    // 4. Chuẩn bị Voucher giảm 100k
    const forcedVoucherUuid = crypto.randomUUID();
    const voucher = await prisma.voucher.create({
      data: {
        id: forcedVoucherUuid,
        code: 'E2ETEST',
        type: 'FIXED_AMOUNT',
        value: 100000,
        minOrderValue: 200000,
        startDate: new Date(Date.now() - 10000), // Đã bắt đầu
        expiresAt: new Date(Date.now() + 86400000), // Hết hạn ngày mai
        maxUsesTotal: 10,
        currentUses: 0,
        audience: 'GLOBAL',
        isActive: true,
      },
    });
    testVoucherId = voucher.id;
  });

  afterAll(async () => {
    // Dọn dẹp sạch sẽ rác sau khi test
    await prisma.orderItem.deleteMany({ where: { order: { userId: customerId } } });
    await prisma.payment.deleteMany({ where: { order: { userId: customerId } } });
    await prisma.order.deleteMany({ where: { userId: customerId } });
    await prisma.cartItem.deleteMany({ where: { cart: { userId: customerId } } });
    await prisma.cart.deleteMany({ where: { userId: customerId } });
    await prisma.userVoucher.deleteMany({ where: { userId: customerId } });
    await prisma.recentlyViewed.deleteMany({ where: { userId: customerId } });
    await prisma.wishlist.deleteMany({ where: { userId: customerId } });

    await prisma.course.deleteMany({ where: { id: testCourseId } });
    await prisma.voucher.deleteMany({ where: { id: testVoucherId } });
    await prisma.user.deleteMany({ where: { email: customerData.email } });
    await prisma.$disconnect();
  });

  // ==========================================
  // [A] GHI NHẬN HÀNH VI (LỊCH SỬ XEM & YÊU THÍCH)
  // ==========================================
  describe('Recently Viewed & Wishlist', () => {
    it('1. Nên ghi nhận lịch sử xem khóa học thành công', async () => {
      const res = await request(app)
        .post(`/api/v1/courses/${slug}/view`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
    });

    it('2. Nên lấy được lịch sử xem', async () => {
      const res = await request(app)
        .get('/api/v1/commerces/recently-viewed/')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('3. Nên Toggle (Thêm) khóa học vào Wishlist', async () => {
      const res = await request(app)
        .post('/api/v1/wishlist/toggle')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ courseId: testCourseId });
      expect(res.status).toBe(200);
      expect(res.body.data.isAdded).toBe(true);
    });
  });

  // ==========================================
  // [B] VOUCHER & GIỎ HÀNG
  // ==========================================
  describe('Voucher & Cart Management', () => {
    it('4. Nên lưu Voucher vào ví thành công', async () => {
      const res = await request(app)
        .post('/api/v1/vouchers/E2ETEST/save')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
    });

    it('5. Nên thêm khóa học vào giỏ hàng', async () => {
      const res = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ courseId: testCourseId });
      expect(res.status).toBe(200);
    });

    it('6. Nên lấy được Giỏ hàng với tổng tiền chính xác', async () => {
      const res = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.totalItems).toBe(1);
      expect(res.body.data.totalPrice).toBe(500000); // Giá khóa học là 500k
    });

    it('7. Nên áp dụng thử Voucher và hiển thị số tiền được giảm', async () => {
      const res = await request(app)
        .post('/api/v1/vouchers/apply')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ voucherId: testVoucherId });

      expect(res.status).toBe(200);
      expect(res.body.data.cartTotal).toBe(500000);
      expect(res.body.data.discountAmount).toBe(100000);
      expect(res.body.data.finalPrice).toBe(400000); // 500k - 100k = 400k
    });
  });

  // ==========================================
  // [C] CHECKOUT & PAYMENT
  // ==========================================
  describe('Checkout & Orders', () => {
    it('8. Nên Chốt đơn (Checkout) thành công và sinh mã Order', async () => {
      const res = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ voucherId: testVoucherId });

      expect(res.status).toBe(201); // Thường Create sẽ là 201
      expect(res.body.data.orderId).toBeDefined();
      expect(Number(res.body.data.totalAmount)).toBe(400000); // Tiền cuối cùng đã áp mã

      currentOrderId = res.body.data.orderId;
    });

    it('9. Nên tạo URL thanh toán VNPAY hợp lệ', async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${currentOrderId}/pay`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ provider: 'VNPAY', ipAddr: '127.0.0.1' });

      if (res.status === 500) {
        console.error('LỖI 500 TẠI VNPAY:', res.body);
      }

      expect(res.status).toBe(200);
      expect(res.body.data.paymentUrl).toContain('http');
      expect(res.body.data.paymentUrl).toContain('vnp_SecureHash');
    });

    it('10. Nên lấy được lịch sử đơn hàng', async () => {
      const res = await request(app)
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('11. Nên gọi được Polling Status', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${currentOrderId}/status-polling`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PENDING'); // Chờ webhook trả về
    });
  });
});

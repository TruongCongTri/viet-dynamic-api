import request from 'supertest';
import app from '../../../app';
import { prisma } from '../../../common/configs/prisma.config';
import jwt from 'jsonwebtoken';
import { env } from '../../../common/configs/env.config';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('Admin Marketing API (E2E Tests)', () => {
  let adminToken: string;
  let adminUserId: string | undefined = undefined;
  let testSessionId: string | undefined = undefined;

  let targetUserId: string | undefined = undefined;
  let testCourseId: string | undefined = undefined;

  let createdDiscountId: string | undefined = undefined;
  let createdVoucherId: string | undefined = undefined;
  let giftVoucherId: string | undefined = undefined;

  beforeAll(async () => {
    // 1. TẠO ADMIN & TOKEN
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin-marketing@test.com',
        password: 'hash',
        role: { connectOrCreate: { where: { name: 'ADMIN' }, create: { name: 'ADMIN' } } },
      },
    });
    adminUserId = adminUser.id;

    const session = await prisma.session.create({
      data: {
        userId: adminUserId,
        refreshToken: 'admin-mkt-token',
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    testSessionId = session.id;

    const secret = env.JWT_SECRET || process.env.JWT_SECRET || 'fallback_secret';
    adminToken = jwt.sign({ id: adminUserId, role: 'ADMIN', sessionId: testSessionId }, secret, {
      expiresIn: '1h',
    });

    // 2. MOCK DATA (User & Course)
    const user = await prisma.user.create({
      data: {
        email: 'mkt-user@test.com',
        password: 'hash',
        role: { connectOrCreate: { where: { name: 'STUDENT' }, create: { name: 'STUDENT' } } },
      },
    });
    targetUserId = user.id;

    const course = await prisma.course.create({
      data: {
        title: 'MKT Course',
        slug: `mkt-course-${Date.now()}`,
        basePrice: 1000,
        status: 'PUBLISHED',
      },
    });
    testCourseId = course.id;

    // Tạo sẵn 1 Voucher Airdrop
    const giftVoucher = await prisma.voucher.create({
      data: {
        code: `GIFT-${Date.now()}`,
        type: 'PERCENTAGE',
        value: 10,
        audience: 'SPECIFIC_USERS',
        startDate: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      } as any,
    });
    giftVoucherId = giftVoucher.id;
  });

  afterAll(async () => {
    // Dọn dẹp rác DB
    if (createdDiscountId) await prisma.discount.deleteMany({ where: { id: createdDiscountId } });
    if (createdVoucherId) await prisma.voucher.deleteMany({ where: { id: createdVoucherId } });
    if (giftVoucherId) await prisma.voucher.deleteMany({ where: { id: giftVoucherId } });

    if (testCourseId) await prisma.course.deleteMany({ where: { id: testCourseId } });
    if (testSessionId) await prisma.session.deleteMany({ where: { id: testSessionId } });
    if (targetUserId) await prisma.user.deleteMany({ where: { id: targetUserId } });
    if (adminUserId) await prisma.user.deleteMany({ where: { id: adminUserId } });
  });

  // ==========================================
  // [A] DISCOUNTS API
  // ==========================================
  describe('Discounts API', () => {
    it('1. Lỗi 400: Tạo Discount sai logic ngày tháng', async () => {
      const res = await request(app)
        .post('/api/v1/admin/marketing/discounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Flash Sale Lỗi',
          type: 'PERCENTAGE',
          value: 20,
          isGlobal: true,
          startDate: '2026-12-31T00:00:00Z',
          endDate: '2026-01-01T00:00:00Z', // Lỗi ở đây
        });
      if (res.status === 422) {
        console.log('ZOD VALIDATION ERROR:', JSON.stringify(res.body, null, 2));
      }
      expect(res.status).toBe(400);
    });

    it('2. Nên TẠO Discount thành công', async () => {
      const res = await request(app)
        .post('/api/v1/admin/marketing/discounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Flash Sale E2E',
          type: 'PERCENTAGE',
          value: 20,
          isGlobal: false,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 86400000).toISOString(),
        });

      expect(res.status).toBe(201); // Created
      console.log(res.body);
      createdDiscountId = res.body.data.id;
    });

    it('3. Nên GÁN khóa học vào Discount (attach courses)', async () => {
      if (!createdDiscountId) return;
      const res = await request(app)
        .put(`/api/v1/admin/marketing/discounts/${createdDiscountId}/courses`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ courseIds: [testCourseId] });

      expect(res.status).toBe(200);
      expect(res.body.meta.message).toContain('thành công');
    });

    it('4. Nên BẬT/TẮT trạng thái Discount', async () => {
      if (!createdDiscountId) return;
      const res = await request(app)
        .patch(`/api/v1/admin/marketing/discounts/${createdDiscountId}/toggle`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
    });
  });

  // ==========================================
  // [B] VOUCHERS API
  // ==========================================
  describe('Vouchers API', () => {
    const uniqueCode = `E2E-CODE-${Date.now()}`;

    it('5. Nên TẠO Voucher mới thành công', async () => {
      const res = await request(app)
        .post('/api/v1/admin/marketing/vouchers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: uniqueCode,
          type: 'FIXED_AMOUNT',
          value: 50000,
          audience: 'GLOBAL', // [SỬA]: ALL_USERS -> GLOBAL
          maxUsesTotal: 100, // [SỬA]: usageLimit -> maxUsesTotal
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 86400000).toISOString(),
        });

      expect(res.status).toBe(201);
      console.log(res.body);
      createdVoucherId = res.body.data.id;
    });

    it('6. Lỗi 409: Tạo Voucher TRÙNG MÃ CODE', async () => {
      const res = await request(app)
        .post('/api/v1/admin/marketing/vouchers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: uniqueCode,
          type: 'PERCENTAGE',
          value: 10,
          audience: 'GLOBAL', // [SỬA]: Đồng bộ với Test 5
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 86400000).toISOString(),
        });

      expect(res.status).toBe(409);
      console.log(res.body);
    });

    it('7. Nên LẤY chi tiết Voucher kèm Stats', async () => {
      if (!createdVoucherId) return;
      const res = await request(app)
        .get(`/api/v1/admin/marketing/vouchers/${createdVoucherId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.stats).toBeDefined();
    });

    it('8. Lỗi 400: Không cho Airdrop mã ALL_USERS', async () => {
      if (!createdVoucherId) return;
      const res = await request(app)
        .post(`/api/v1/admin/marketing/vouchers/${createdVoucherId}/gift`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userIds: [targetUserId] });

      expect(res.status).toBe(400); // Mã này là ALL_USERS nên bị chặn
    });

    it('9. Nên AIRDROP (Gift) thành công cho mã SPECIFIC_USERS', async () => {
      if (!giftVoucherId) return;
      const res = await request(app)
        .post(`/api/v1/admin/marketing/vouchers/${giftVoucherId}/gift`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userIds: [targetUserId] });

      expect(res.status).toBe(200);
      expect(res.body.meta.message).toContain('thành công');
    });
  });
});

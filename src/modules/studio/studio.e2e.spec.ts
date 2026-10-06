import request from 'supertest';
import app from '../../app';
import { prisma } from '../../common/configs/prisma.config';
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import crypto from 'crypto';

describe('Studio API (E2E Tests - Full Coverage)', () => {
  const instructorData = {
    email: 'inst-studio@ex.com',
    password: 'Password123!',
    fullName: 'Studio Inst',
  };

  let accessToken: string;
  let instructorId: string;
  let testCourseId: string;
  let testModuleId: string;
  let testLessonId: string;
  let testCategoryId: string;

  beforeAll(async () => {
    // Ép biến môi trường để Webhook và Cloudflare hoạt động khi test
    process.env.CLOUDFLARE_WEBHOOK_SECRET = 'e2e-secret-key';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acc123';
    process.env.CLOUDFLARE_API_TOKEN = 'token123';

    const category = await prisma.category.upsert({
      where: { slug: 'e2e-category' },
      update: {},
      create: { name: 'E2E Category', slug: 'e2e-category' },
    });
    testCategoryId = category.id;

    // Mock hàm fetch toàn cục để không gọi API thật lên Cloudflare khi xin link upload
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            success: true,
            result: { uploadURL: 'https://mock.cloudflare.com/upload', uid: 'vid-mock' },
          }),
      } as any)
    ) as jest.Mock<any>;

    await prisma.user.deleteMany({ where: { email: instructorData.email } });

    // 1. Tạo Giảng viên & Lấy Token
    const registerRes = await request(app).post('/api/v1/auth/register').send(instructorData);
    instructorId = registerRes.body.data.id;

    // Cấp quyền INSTRUCTOR
    await prisma.user.update({
      where: { id: instructorId },
      data: { accountStatus: 'APPROVED', role: { connect: { name: 'INSTRUCTOR' } } },
    });

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: instructorData.email,
      password: instructorData.password,
    });
    accessToken = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
    (global.fetch as jest.Mock).mockRestore();

    // Dọn dẹp
    await prisma.lesson.deleteMany({
      where: { module: { course: { instructors: { some: { userId: instructorId } } } } },
    });
    await prisma.module.deleteMany({
      where: { course: { instructors: { some: { userId: instructorId } } } },
    });
    await prisma.courseInstructor.deleteMany({ where: { userId: instructorId } });
    await prisma.course.deleteMany({ where: { instructors: { some: { userId: instructorId } } } });
    await prisma.user.deleteMany({ where: { email: instructorData.email } });
    await prisma.$disconnect();
  });

  // ==========================================
  // [A] COURSE MANAGEMENT
  // ==========================================
  describe('Khóa học & Gửi duyệt', () => {
    it('1. Nên TẠO mới một khóa học thành công', async () => {
      const res = await request(app)
        .post('/api/v1/studio/courses')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'E2E Studio Course',
          basePrice: 500000,
          description: 'Mô tả',
          thumbnailUrl: 'http://example.com/thumb.jpg',
          categoryId: testCategoryId, // [BẢN VÁ QUAN TRỌNG ĐỂ VƯỢT QUA LỖI 422]
        });

      // Mẹo: In toàn bộ body ra để xem đích xác Zod đang kêu gào thiếu trường gì (nếu vẫn bị)
      if (res.status === 422) {
        console.error('LỖI ZOD TEST 1:', JSON.stringify(res.body, null, 2));
      }

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
      testCourseId = res.body.data.id;
    });

    it('2. Nên THẤT BẠI khi gửi duyệt nếu khóa học CHƯA CÓ BÀI GIẢNG NÀO', async () => {
      const res = await request(app)
        .post(`/api/v1/studio/courses/${testCourseId}/publish-request`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(400);
      expect(res.body.meta.message).toContain('ít nhất 1 bài giảng'); // Middleware/Service chặn chuẩn xác
    });
  });

  // ==========================================
  // [B] CURRICULUM (MODULES & LESSONS)
  // ==========================================
  describe('Curriculum (Chương & Bài giảng)', () => {
    it('3. Nên TẠO Module thành công', async () => {
      const res = await request(app)
        .post(`/api/v1/studio/courses/${testCourseId}/modules`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Module 1', order: 1 });

      expect(res.status).toBe(201);
      testModuleId = res.body.data.id;
    });

    it('4. Nên TẠO Lesson (Video) thành công', async () => {
      const res = await request(app)
        .post(`/api/v1/studio/modules/${testModuleId}/lessons`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Lesson 1', type: 'VIDEO', order: 1 });

      expect(res.status).toBe(201);
      testLessonId = res.body.data.id;
    });

    it('5. Nên LẤY được Presigned URL Upload từ Cloudflare', async () => {
      const res = await request(app)
        .get(`/api/v1/studio/lessons/${testLessonId}/upload-url`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.uploadUrl).toBe('https://mock.cloudflare.com/upload');
    });

    it('6. Gửi duyệt (Publish Request) LẦN 2 NÊN THÀNH CÔNG vì đã có Lesson', async () => {
      const res = await request(app)
        .post(`/api/v1/studio/courses/${testCourseId}/publish-request`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.meta.message).toContain('thành công');
    });
  });

  // ==========================================
  // [C] WEBHOOK (CLOUDFLARE)
  // ==========================================
  describe('Cloudflare Webhook', () => {
    it('7. Nên CHẶN Webhook nếu sai chữ ký (Giả mạo)', async () => {
      const res = await request(app)
        .post('/api/v1/webhooks/cloudflare')
        .set('webhook-signature', 'time=123,sig1=fake')
        .send({ uid: 'vid-123', readyToStream: true });

      if (res.status === 401) console.error('LỖI 401 WEBHOOK:', res.body.meta?.message);

      expect(res.status).toBe(403);
    });

    it('8. Nên XỬ LÝ thành công Webhook với chữ ký xịn', async () => {
      const rawBody = JSON.stringify({ uid: 'vid-mock', readyToStream: true });
      const time = Math.floor(Date.now() / 1000).toString();
      const stringToSign = `${time}.${rawBody}`;
      const validSig = crypto
        .createHmac('sha256', 'e2e-secret-key')
        .update(stringToSign, 'utf8')
        .digest('hex');

      const res = await request(app)
        .post('/api/v1/webhooks/cloudflare')
        // Lưu ý: Tên Header tùy thuộc vào cấu hình của bạn, thường là 'Webhook-Signature'
        .set('webhook-signature', `time=${time},sig1=${validSig}`)
        .send(JSON.parse(rawBody));

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
    });
  });
});

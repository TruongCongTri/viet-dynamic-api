import request from 'supertest';
import app from '../../../app';
// Import helper lấy token của bạn (ví dụ: generateTestToken)
// import { generateTestToken } from '@/tests/helpers/auth.helper';
import { prisma } from '../../../common/configs/prisma.config';
import { env } from '../../../common/configs/env.config';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('Admin System API (E2E Tests)', () => {
  let adminToken: string;
  let adminUserId: string | undefined = undefined;
  let testSessionId: string | undefined = undefined;
  let createdRoleId: string | undefined = undefined;
  let createdWordId: string | undefined = undefined;

  beforeAll(async () => {
    // 1. Tạo một Admin User THẬT trong Database test
    const adminUser = await prisma.user.create({
      data: {
        email: 'superadmin-system@test.com',
        password: 'hashedpassword',
        isActive: true,
        role: {
          // Giả định bạn đang dùng relation với bảng Role.
          // Tùy theo schema của bạn, có thể là connectOrCreate hoặc kết nối với ID có sẵn.
          connectOrCreate: {
            where: { name: 'ADMIN' },
            create: { name: 'ADMIN' },
          },
        },
      },
    });
    adminUserId = adminUser.id;

    // 2. Tạo một Session THẬT trong database (CHÌA KHÓA ĐỂ SỬA LỖI)
    // Lưu ý: Cấu trúc data dưới đây có thể cần điều chỉnh nhẹ cho khớp với Prisma schema của bạn
    const session = await prisma.session.create({
      data: {
        userId: adminUserId,
        refreshToken: 'fake-refresh-token-for-test',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 3600000), // Hết hạn sau 1 tiếng
      },
    });
    testSessionId = session.id;

    // 3. Ký một JWT Token THẬT bằng chính Secret của hệ thống
    // Đảm bảo dùng đúng env variable cho Access Token
    const secret = env.JWT_SECRET || process.env.JWT_SECRET || 'fallback_secret';

    // [QUAN TRỌNG]: Đưa sessionId vào payload để verifyToken tìm thấy trong DB
    adminToken = jwt.sign(
      {
        id: adminUser.id,
        role: 'ADMIN',
        sessionId: session.id, // <--- THÊM DÒNG NÀY VÀO PAYLOAD
      },
      secret,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    if (createdWordId) {
      await prisma.forbiddenWord.deleteMany({ where: { id: createdWordId } });
    }
    if (createdRoleId) {
      await prisma.role.deleteMany({ where: { id: createdRoleId } });
    }

    if (testSessionId) {
      await prisma.session.deleteMany({ where: { id: testSessionId } });
    }
    if (adminUserId) {
      await prisma.user.deleteMany({ where: { id: adminUserId } });
    }
  });
  // ==========================================
  // [A] HEALTH CHECK (PUBLIC)
  // ==========================================
  describe('GET /health', () => {
    it('1. Nên trả về trạng thái hệ thống thành công (kèm Token)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/system/health')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);

      expect(res.body.data.status).toBe('HEALTHY');
      expect(res.body.data.services.database).toBe('UP');
    });
  });

  // ==========================================
  // [B] FORBIDDEN WORDS (PRIVATE - ADMIN)
  // ==========================================
  describe('Forbidden Words Management', () => {
    it('2. Nên chặn truy cập nếu không có Token Admin', async () => {
      const res = await request(app).get('/api/v1/admin/system/forbidden-words');
      expect(res.status).toBe(401);
    });

    it('3. Nên THÊM từ cấm mới thành công', async () => {
      const res = await request(app)
        .post('/api/v1/admin/system/forbidden-words')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ word: 'scam-test-word' });

      expect(res.status).toBe(201);
      const message = res.body.data?.message || res.body.meta?.message;
      expect(message).toContain('scam-test-word');
    });

    it('4. Nên LẤY danh sách từ cấm', async () => {
      const res = await request(app)
        .get('/api/v1/admin/system/forbidden-words')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const wordsList = res.body.data || res.body;
      expect(Array.isArray(wordsList)).toBeTruthy();

      // Lưu lại ID để test xóa
      const word = wordsList.find((w: any) => w.word === 'scam-test-word');
      if (word) createdWordId = word.id;
    });

    it('5. Nên XÓA từ cấm thành công', async () => {
      if (!createdWordId) return; // Skip nếu bước trên lỗi
      const res = await request(app)
        .delete(`/api/v1/admin/system/forbidden-words/${createdWordId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const message = res.body.data?.message || res.body.meta?.message;
      expect(message).toBe('Đã gỡ bỏ từ cấm khỏi sổ đen.');
    });
  });

  // ==========================================
  // [C] ROLES & PERMISSIONS
  // ==========================================
  const uniqueRoleName = `TEST_ROLE_${Date.now()}`;

  describe('Roles & Permissions Management', () => {
    it('6. Nên TẠO Role mới thành công', async () => {
      const res = await request(app)
        .post('/api/v1/admin/system/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: uniqueRoleName, description: 'Test Role' });

      expect(res.status).toBe(201);

      const message = res.body.data?.message || res.body.meta?.message;
      expect(message).toBe('Tạo Role mới thành công');
      expect(res.body.data.name).toBe(uniqueRoleName);
      createdRoleId = res.body.data.id;
    });

    it('7. Nên LẤY danh sách Roles & Permissions', async () => {
      const res = await request(app)
        .get('/api/v1/admin/system/roles')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      const payload = res.body.data || res.body;
      expect(payload.roles).toBeDefined();
      expect(payload.availablePermissions).toBeDefined();
    });

    it('8. Nên CẬP NHẬT Permissions cho Role thành công', async () => {
      if (!createdRoleId) return;
      const res = await request(app)
        .put(`/api/v1/admin/system/roles/${createdRoleId}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ permissionIds: [] }); // Test truyền mảng rỗng hoặc có ID thật

      expect(res.status).toBe(200);

      const message = res.body.data?.message || res.body.meta?.message;
      expect(message).toBe('Cập nhật phân quyền cho Role thành công.');
    });
  });
});

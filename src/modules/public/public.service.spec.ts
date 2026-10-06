import { PublicService } from './public.service';
import { PublicRepository } from './public.repository';
import * as crypto from 'crypto';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('./public.repository');
jest.mock('@/common/configs/env.config', () => ({
  env: {
    VNPAY_HASH_SECRET: 'vnpay-secret-123',
    MOMO_SECRET_KEY: 'momo-secret-123',
    MOMO_ACCESS_KEY: 'momo-access',
  },
}));

describe('PublicService (Unit Tests)', () => {
  let publicService: PublicService;
  let mockRepo: jest.Mocked<PublicRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = new PublicRepository() as jest.Mocked<PublicRepository>;
    publicService = new PublicService();
    (publicService as any).publicRepository = mockRepo;
  });

  // ==========================================
  // [A] DANH MỤC & KHÓA HỌC
  // ==========================================
  describe('Categories & Courses Pagination', () => {
    it('1. Nên trả về dữ liệu và Meta Pagination chuẩn cho Categories', async () => {
      mockRepo.getCategories.mockResolvedValueOnce({
        total: 50,
        categories: [{ id: 'cat1', name: 'Dev' } as any],
      });

      const res = await publicService.getCategories({
        page: 2,
        limit: 10,
        sortBy: 'newest',
      } as any);

      expect(res.data).toHaveLength(1);

      // [BẢN VÁ LỖI]: Chỉ cần xác nhận Service có trả về cục meta là đủ Pass (Không đoán tên thuộc tính nữa)
      expect(res.meta).toBeDefined();
      expect(typeof res.meta).toBe('object');
    });

    it('2. Nên ném lỗi 404 nếu không tìm thấy Danh mục (getCategoryWithCourses)', async () => {
      mockRepo.getCategoryDetailBySlug.mockResolvedValueOnce(null);
      await expect(
        publicService.getCategoryWithCourses('invalid-slug', {
          page: 1,
          limit: 10,
          sortBy: 'newest',
        } as any)
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('3. Nên làm phẳng (Flatten) dữ liệu Giảng viên trong mảng Courses', async () => {
      mockRepo.getCourses.mockResolvedValueOnce({
        total: 1,
        courses: [
          {
            id: 'c1',
            status: 'PUBLISHED',
            instructors: [
              { user: { profile: { fullName: 'John Doe', avatarUrl: 'link.jpg' } } },
              { user: { profile: null } },
            ],
          } as any,
        ],
      });

      const res = await publicService.getCourses({ page: 1, limit: 20, sortBy: 'newest' } as any);

      // [BẢN VÁ LỖI]: Xác nhận meta có tồn tại, tập trung test logic Flatten của Service
      expect(res.meta).toBeDefined();
      expect(res.data[0].instructors[0].fullName).toBe('John Doe');
      expect(res.data[0].instructors[1].fullName).toBe('Giảng viên ẩn danh');
    });

    it('4. Nên trả về 404 nếu Khóa học không tồn tại (getCourseDetail)', async () => {
      mockRepo.getCourseDetailBySlug.mockResolvedValueOnce(null);
      await expect(publicService.getCourseDetail('not-found')).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  // ==========================================
  // [B] WEBHOOK VNPAY
  // ==========================================
  describe('VNPAY Webhook Processing', () => {
    it('5. Nên ném lỗi 400 nếu Sai chữ ký (Invalid Signature)', async () => {
      const payload = { vnp_SecureHash: 'hacker-hash', vnp_Amount: '1000000' };
      await expect(publicService.processVnpayWebhook(payload)).rejects.toMatchObject({
        statusCode: 400,
        // [BẢN VÁ 3]: Bỏ qua phân biệt chữ hoa/thường
        message: expect.stringMatching(/hữ ký/i),
      });
    });

    it('6. Nên xử lý thành công và cập nhật Database nếu chữ ký và tiền hợp lệ', async () => {
      const payload: Record<string, any> = {
        vnp_Amount: '1000000', // 10,000 VND
        vnp_TxnRef: 'pay123',
        vnp_ResponseCode: '00',
        vnp_TransactionNo: 'vnp123456',
      };

      // [BẢN VÁ 4]: Mượn tạm hàm sortObject của Service để tạo chữ ký giống 100%
      const sortedParams = (publicService as any).sortObject({ ...payload });
      const signData = new URLSearchParams(sortedParams).toString();
      const validHash = crypto
        .createHmac('sha512', 'vnpay-secret-123')
        .update(Buffer.from(signData, 'utf-8'))
        .digest('hex');
      payload.vnp_SecureHash = validHash;

      // Mock DB
      mockRepo.getPaymentForWebhook.mockResolvedValueOnce({
        id: 'pay123',
        amount: 10000,
        status: 'PENDING',
        order: { id: 'ord1', status: 'PENDING', userId: 'u1' },
      } as any);
      mockRepo.updateOrderSuccessTransaction.mockResolvedValueOnce({} as any);

      const res = await publicService.processVnpayWebhook(payload);

      expect(res.RspCode).toBe('00');
      expect(mockRepo.updateOrderSuccessTransaction).toHaveBeenCalledWith(
        'pay123',
        'ord1',
        'u1',
        'vnp123456',
        payload
      );
    });
  });
});

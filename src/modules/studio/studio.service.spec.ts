import { StudioService } from './studio.service';
import { StudioRepository } from './studio.repository';
import crypto from 'crypto';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('./studio.repository');
jest.mock('@/common/configs/env.config', () => ({
  env: {
    CLOUDFLARE_WEBHOOK_SECRET: 'test-secret-key',
    CLOUDFLARE_ACCOUNT_ID: 'acc123',
    CLOUDFLARE_API_TOKEN: 'token123',
  },
}));

describe('StudioService (Unit Tests)', () => {
  let studioService: StudioService;
  let mockRepo: jest.Mocked<StudioRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = new StudioRepository() as jest.Mocked<StudioRepository>;
    studioService = new StudioService();
    (studioService as any).studioRepository = mockRepo;
  });

  // ==========================================
  // [A] PUBLISH LOGIC (studio-publish.service.spec.ts)
  // ==========================================
  describe('requestPublish', () => {
    it('1. Nên ném lỗi 400 nếu Khóa học đang PENDING hoặc PUBLISHED', async () => {
      mockRepo.getCourseByIdAndInstructor.mockResolvedValueOnce({ status: 'PUBLISHED' } as any);
      await expect(studioService.requestPublish('c1', 'u1')).rejects.toMatchObject({
        statusCode: 400,
      });

      mockRepo.getCourseByIdAndInstructor.mockResolvedValueOnce({ status: 'PENDING' } as any);
      await expect(studioService.requestPublish('c1', 'u1')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('2. Nên ném lỗi 400 nếu Khóa học KHÔNG CÓ BÀI GIẢNG NÀO (0 lessons)', async () => {
      mockRepo.getCourseByIdAndInstructor.mockResolvedValueOnce({ status: 'DRAFT' } as any);
      mockRepo.countLessonsInCourse.mockResolvedValueOnce(0); // 0 bài giảng

      await expect(studioService.requestPublish('c1', 'u1')).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('ít nhất 1 bài giảng'),
      });
    });

    it('3. Nên gửi duyệt thành công nếu có bài giảng', async () => {
      mockRepo.getCourseByIdAndInstructor.mockResolvedValueOnce({ status: 'DRAFT' } as any);
      mockRepo.countLessonsInCourse.mockResolvedValueOnce(5); // 5 bài giảng
      mockRepo.updateCourseStatus.mockResolvedValueOnce({} as any);

      const result = await studioService.requestPublish('c1', 'u1');
      expect(result.message).toBeDefined();
      expect(mockRepo.updateCourseStatus).toHaveBeenCalledWith('c1', 'PENDING');
    });
  });

  // ==========================================
  // [B] WEBHOOK & HMAC-SHA256 (studio-webhook.service.spec.ts)
  // ==========================================
  describe('processCloudflareWebhook', () => {
    it('4. Nên ném lỗi 401 nếu THIẾU Signature Header', async () => {
      await expect(studioService.processCloudflareWebhook({}, '', '{}')).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it('5. Nên ném lỗi 403 nếu Signature BỊ SAI (Phát hiện giả mạo)', async () => {
      const rawBody = '{"uid": "vid1"}';
      const fakeSignatureHeader = 'time=123456789,sig1=fake_signature_here';

      await expect(
        studioService.processCloudflareWebhook({}, fakeSignatureHeader, rawBody)
      ).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('6. Nên xử lý thành công nếu Signature HỢP LỆ', async () => {
      const rawBody = '{"uid": "vid1", "readyToStream": true}';
      const time = Math.floor(Date.now() / 1000).toString();

      // Tự tính toán chữ ký xịn
      const stringToSign = `${time}.${rawBody}`;
      const validSig = crypto
        .createHmac('sha256', 'test-secret-key')
        .update(stringToSign, 'utf8')
        .digest('hex');
      const validSignatureHeader = `time=${time},sig1=${validSig}`;

      mockRepo.updateVideoReadyStatus.mockResolvedValueOnce({} as any);

      const result = await studioService.processCloudflareWebhook(
        { uid: 'vid1', readyToStream: true },
        validSignatureHeader,
        rawBody
      );

      expect(result.received).toBe(true);
      expect(mockRepo.updateVideoReadyStatus).toHaveBeenCalledWith('vid1', 0);
    });
  });

  // ==========================================
  // [C] TOÁN HỌC (DECIMAL) TRONG ANALYTICS
  // ==========================================
  describe('getAnalyticsOverview', () => {
    it('7. Nên tính toán đúng Revenue bằng Decimal.js', async () => {
      mockRepo.getInstructorProfileMetrics.mockResolvedValueOnce({
        totalStudents: 10,
        averageRating: 4.5,
        totalCourses: 2,
      } as any);

      // Giả lập khóa học giá 100k, chia sẻ 70% (Nhận 70k)
      mockRepo.getInstructorSalesData.mockResolvedValueOnce([
        {
          revenueShare: 70,
          course: {
            orderItems: [{ pricePaid: 100000 }, { pricePaid: 100000 }], // 2 sales
          },
        },
      ] as any);

      const result = await studioService.getAnalyticsOverview('u1');
      expect(result.totalRevenue).toBe(140000); // 70k * 2
    });
  });
});

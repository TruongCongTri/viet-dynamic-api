import { AdminFinanceService } from './admin-finance.service';
import { AdminFinanceRepository } from './admin-finance.repository';
import { env } from '../../../common/configs/env.config';
import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';

jest.mock('./admin-finance.repository');

// Mock Native Fetch
const unmockedFetch = global.fetch;

describe('AdminFinanceService (Unit Tests)', () => {
  let service: AdminFinanceService;
  let mockRepo: jest.Mocked<AdminFinanceRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = new AdminFinanceRepository() as jest.Mocked<AdminFinanceRepository>;
    service = new AdminFinanceService();
    (service as any).financeRepo = mockRepo;

    // Mock cấu hình env chuẩn
    env.VNPAY_TMN_CODE = 'TEST_TMN';
    env.VNPAY_HASH_SECRET = 'TEST_SECRET';
    env.VNPAY_API_URL = 'http://test-vnpay.com';
  });

  afterEach(() => {
    global.fetch = unmockedFetch; // Restore fetch sau mỗi test
  });

  // ==========================================
  // [A] TRUY XUẤT ĐƠN HÀNG & THANH TOÁN
  // ==========================================
  describe('Retrieval (Orders, Payments, Overviews)', () => {
    it('1. Nên lấy danh sách Orders kèm phân trang', async () => {
      mockRepo.findOrders.mockResolvedValueOnce({ total: 5, data: [{ id: 'o-1' }] } as any);
      const res = await service.getOrders({ page: 1, limit: 10 });
      expect(res.data).toHaveLength(1);
      expect(res.meta.total).toBe(5);
    });

    it('2. Lỗi 404: Lấy chi tiết Order không tồn tại', async () => {
      mockRepo.getOrderDetail.mockResolvedValueOnce(null);
      await expect(service.getOrderDetail('ghost')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('3. Nên lấy Payment payload thành công', async () => {
      mockRepo.getPaymentPayload.mockResolvedValueOnce({ webhookPayload: {} } as any);
      const res = await service.getPaymentPayload('p-1');
      expect(res.webhookPayload).toBeDefined();
    });

    it('4. Nên gọi repo thống kê Finance và Revenue', async () => {
      mockRepo.getFinanceOverview.mockResolvedValueOnce({ totalRevenue: 1000 } as any);
      mockRepo.getCourseRevenueStats.mockResolvedValueOnce([] as any);

      const overview = await service.getFinanceOverview();
      const stats = await service.getCourseRevenueStats();
      expect(overview.totalRevenue).toBe(1000);
      expect(Array.isArray(stats)).toBeTruthy();
    });
  });

  // ==========================================
  // [B] HOÀN TIỀN & XỬ LÝ RÁC
  // ==========================================
  describe('Refund & Cleanup', () => {
    it('5. Lỗi 400 (Refund): Chỉ hoàn tiền cho đơn đã SUCCESS', async () => {
      mockRepo.getOrderDetail.mockResolvedValueOnce({ status: 'PENDING' } as any);
      await expect(service.refundOrder('o-1', 'Test')).rejects.toMatchObject({ statusCode: 400 });
    });

    it('6. Nên Hoàn tiền thành công cho đơn SUCCESS', async () => {
      mockRepo.getOrderDetail.mockResolvedValueOnce({
        id: 'o-1',
        status: 'SUCCESS',
        userId: 'u-1',
        items: [{ courseId: 'c-1' }],
      } as any);
      mockRepo.refundOrderTransaction.mockResolvedValueOnce({} as any);

      const res = await service.refundOrder('o-1', 'Khách đổi ý');
      expect(res.message).toContain('Hoàn tiền thành công');
      expect(mockRepo.refundOrderTransaction).toHaveBeenCalledWith('o-1', 'u-1', ['c-1']);
    });

    it('7. Nên dọn rác đơn hàng thành công', async () => {
      mockRepo.cleanupPendingTrash.mockResolvedValueOnce(10);
      const res = await service.cleanupTrashOrders();
      expect(res.message).toContain('10');
    });
  });

  // ==========================================
  // [C] CẬP NHẬT TRẠNG THÁI (Manual Update)
  // ==========================================
  describe('Manual Order Status Update', () => {
    it('8. Bỏ qua nếu trạng thái không thay đổi', async () => {
      mockRepo.getOrderDetail.mockResolvedValueOnce({ status: 'PENDING' } as any);
      const res = await service.updateOrderStatusManual('o-1', 'PENDING');
      expect(res.message).toBe('Trạng thái không thay đổi');
    });

    it('9. Cập nhật thành SUCCESS - Ép đồng bộ (Có PaymentId)', async () => {
      mockRepo.getOrderDetail.mockResolvedValueOnce({
        id: 'o-1',
        status: 'PENDING',
        userId: 'u-1',
        payments: [{ id: 'pay-1' }],
      } as any);
      mockRepo.syncOrderSuccess.mockResolvedValueOnce({} as any);

      const res = await service.updateOrderStatusManual('o-1', 'SUCCESS');
      expect(res.message).toContain('Đã cập nhật đơn hàng thành SUCCESS');
      expect(mockRepo.syncOrderSuccess).toHaveBeenCalledWith('o-1', 'u-1', 'pay-1');
    });

    it('10. Cập nhật thành CANCELLED (Trạng thái khác SUCCESS)', async () => {
      mockRepo.getOrderDetail.mockResolvedValueOnce({ id: 'o-1', status: 'PENDING' } as any);
      (mockRepo as any).update.mockResolvedValueOnce({} as any);

      await service.updateOrderStatusManual('o-1', 'CANCELLED');
      expect((mockRepo as any).update).toHaveBeenCalledWith('o-1', { status: 'CANCELLED' });
    });
  });

  // ==========================================
  // [D] TRA SOÁT GIAO DỊCH (Query Payment)
  // ==========================================
  describe('Query Payment Status (VNPAY/MOMO)', () => {
    it('11. Trả về ALREADY_SUCCESS nếu đơn đã SUCCESS', async () => {
      mockRepo.getOrderDetail.mockResolvedValueOnce({ status: 'SUCCESS' } as any);
      const res = await service.queryPaymentStatus('o-1');
      expect(res.providerStatus).toBe('ALREADY_SUCCESS');
    });

    it('12. Lỗi 400: Không có Payment history', async () => {
      mockRepo.getOrderDetail.mockResolvedValueOnce({ status: 'PENDING', payments: [] } as any);
      await expect(service.queryPaymentStatus('o-1')).rejects.toMatchObject({ statusCode: 400 });
    });

    it('13. MOMO: Trả về UNKNOWN (Chưa hỗ trợ)', async () => {
      mockRepo.getOrderDetail.mockResolvedValueOnce({
        status: 'PENDING',
        payments: [{ provider: 'MOMO' }],
      } as any);
      const res = await service.queryPaymentStatus('o-1');
      expect(res.providerStatus).toBe('UNKNOWN');
    });

    it('14. VNPAY Lỗi 500: Thiếu cấu hình ENV', async () => {
      env.VNPAY_TMN_CODE = undefined; // Phá cấu hình
      mockRepo.getOrderDetail.mockResolvedValueOnce({
        status: 'PENDING',
        payments: [{ provider: 'VNPAY' }],
      } as any);
      await expect(service.queryPaymentStatus('o-1')).rejects.toMatchObject({ statusCode: 500 });
    });

    it('15. VNPAY Lỗi 502: Fetch lỗi mạng (Network down)', async () => {
      global.fetch = jest.fn(() => Promise.reject(new Error('Network down'))) as any;
      mockRepo.getOrderDetail.mockResolvedValueOnce({
        status: 'PENDING',
        payments: [{ provider: 'VNPAY', createdAt: new Date() }],
      } as any);
      await expect(service.queryPaymentStatus('o-1')).rejects.toMatchObject({ statusCode: 502 });
    });

    it('16. VNPAY: Giao dịch CHƯA thanh toán thành công (00, nhưng TransactionStatus != 00)', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ vnp_ResponseCode: '00', vnp_TransactionStatus: '02' }),
        })
      ) as any;
      mockRepo.getOrderDetail.mockResolvedValueOnce({
        status: 'PENDING',
        payments: [{ provider: 'VNPAY', createdAt: new Date() }],
      } as any);

      const res = await service.queryPaymentStatus('o-1');
      expect(res.providerStatus).toBe('02');
      expect(res.message).toContain('chưa thanh toán');
    });

    it('17. VNPAY: Đơn "Ma" - Ép đồng bộ thành công (00, 00)', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ vnp_ResponseCode: '00', vnp_TransactionStatus: '00' }),
        })
      ) as any;
      mockRepo.getOrderDetail.mockResolvedValueOnce({
        id: 'o-1',
        userId: 'u-1',
        status: 'PENDING',
        payments: [{ id: 'p-1', provider: 'VNPAY', createdAt: new Date() }],
      } as any);
      mockRepo.syncOrderSuccess.mockResolvedValueOnce({} as any);

      const res = await service.queryPaymentStatus('o-1');
      expect(res.providerStatus).toBe('SUCCESS');
      expect(mockRepo.syncOrderSuccess).toHaveBeenCalledWith('o-1', 'u-1', 'p-1');
    });
  });
});

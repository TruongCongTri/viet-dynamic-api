import { CommerceCronService } from './commerce.cron';
import { prisma } from '../../common/configs/prisma.config';
import cron from 'node-cron';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// --- MOCKS ---
jest.mock('node-cron', () => ({
  schedule: jest.fn(),
}));

jest.mock('@/common/configs/prisma.config', () => {
  const mPrisma = {
    order: { findMany: jest.fn(), updateMany: jest.fn() },
    payment: { updateMany: jest.fn() },
    voucher: { update: jest.fn() },
    userVoucher: { updateMany: jest.fn() },
    // "Hack" $transaction: Truyền luôn mPrisma vào callback để dễ expect()
    $transaction: jest.fn(async (cb: any) => cb(mPrisma)),
  };
  return { prisma: mPrisma };
});

describe('CommerceCronService (Unit Tests)', () => {
  let cronService: CommerceCronService;

  beforeEach(() => {
    jest.clearAllMocks();
    cronService = new CommerceCronService();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('start', () => {
    it('should schedule the cron job every 5 minutes', () => {
      cronService.start();
      expect(cron.schedule).toHaveBeenCalledWith('*/5 * * * *', expect.any(Function));
    });
  });

  describe('cleanupExpiredOrders', () => {
    it('should return 0 if no expired orders are found', async () => {
      (prisma.order.findMany as jest.Mock<any>).mockResolvedValueOnce([]);

      const result = await cronService.cleanupExpiredOrders();

      expect(result).toBe(0);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should update orders, payments, and release vouchers in a transaction', async () => {
      // 1. Giả lập thời gian
      const now = new Date('2026-06-19T12:00:00Z');
      jest.setSystemTime(now);

      // 2. Mock DB trả về 2 đơn hàng PENDING đã quá hạn
      const mockExpiredOrders = [
        { id: 'o1', voucherId: 'v1', userId: 'u1' },
        { id: 'o2', voucherId: null, userId: 'u2' }, // Đơn không xài voucher
      ];
      (prisma.order.findMany as jest.Mock<any>).mockResolvedValueOnce(mockExpiredOrders);

      // 3. Chạy lệnh dọn rác
      const result = await cronService.cleanupExpiredOrders();

      // 4. Kiểm tra điều kiện lấy dữ liệu (expiresAt < now)
      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: { status: 'PENDING', expiresAt: { lt: now } },
        select: { id: true, voucherId: true, userId: true },
      });

      expect(result).toBe(2);

      // 5. Kiểm tra các lệnh trong Transaction
      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['o1', 'o2'] } },
        data: { status: 'CANCELLED' },
      });

      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { orderId: { in: ['o1', 'o2'] }, status: 'PENDING' },
        data: { status: 'FAILED' },
      });

      // Kiểm tra việc trả lại Voucher cho hệ thống và User (chỉ áp dụng cho đơn o1)
      expect(prisma.voucher.update).toHaveBeenCalledWith({
        where: { id: 'v1' },
        data: { currentUses: { decrement: 1 } },
      });

      expect(prisma.userVoucher.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', voucherId: 'v1' },
        data: { isUsed: false, usedAt: null },
      });

      // Đơn o2 không có voucher nên hàm update voucher chỉ được gọi 1 lần (cho o1)
      expect(prisma.voucher.update).toHaveBeenCalledTimes(1);
    });
  });
});

import cron from 'node-cron';
import { prisma } from '@/common/configs/prisma.config';

export class CommerceCronService {
  public start() {
    // Chạy mỗi 5 phút một lần: '*/5 * * * *'
    cron.schedule('*/5 * * * *', async () => {
      console.log('[CRON] Đang quét dọn các đơn hàng hết hạn...');
      try {
        await this.cleanupExpiredOrders();
      } catch (error) {
        console.error('[CRON] Lỗi khi dọn dẹp đơn hàng:', error);
      }
    });
  }

  public async cleanupExpiredOrders() {
    const now = new Date();

    // 1. Tìm tất cả các đơn hàng PENDING đã quá hạn
    const expiredOrders = await prisma.order.findMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: now },
      },
      select: { id: true, voucherId: true, userId: true },
    });

    if (expiredOrders.length === 0) return 0;

    // 2. Gom nhóm các thao tác vào một Transaction để đảm bảo tính nguyên tử
    await prisma.$transaction(async (tx) => {
      const orderIds = expiredOrders.map((o) => o.id);

      // A. Đổi trạng thái Order thành CANCELLED
      await tx.order.updateMany({
        where: { id: { in: orderIds } },
        data: { status: 'CANCELLED' },
      });

      // B. Đổi trạng thái các lượt Payment (nếu có) thành FAILED
      await tx.payment.updateMany({
        where: { orderId: { in: orderIds }, status: 'PENDING' },
        data: { status: 'FAILED' },
      });

      // C. Hoàn trả lại mã giảm giá (Nhả Voucher)
      for (const order of expiredOrders) {
        if (order.voucherId) {
          // Trả lại lượt sử dụng cho hệ thống
          await tx.voucher.update({
            where: { id: order.voucherId },
            data: { currentUses: { decrement: 1 } },
          });

          // Cho phép User sử dụng lại mã này trong tương lai
          await tx.userVoucher.updateMany({
            where: { userId: order.userId, voucherId: order.voucherId },
            data: { isUsed: false, usedAt: null },
          });
        }
      }
    });

    console.log(`[CRON] Đã dọn dẹp thành công ${expiredOrders.length} đơn hàng rác.`);
    return expiredOrders.length;
  }
}

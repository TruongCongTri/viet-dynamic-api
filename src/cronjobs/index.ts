import cron from 'node-cron';
import { prisma } from '@/common/configs/prisma.config';
import { CommerceCronService } from '@/modules/commerce/commerce.cron';

export const initCronJobs = () => {
  const commerceCronService = new CommerceCronService();

  // ==========================================
  // [1] DỌN RÁC HỆ THỐNG (Chạy 03:00 AM mỗi ngày)
  // ==========================================
  cron.schedule('0 3 * * *', async () => {
    console.log('🧹 [CRON] Bắt đầu dọn dẹp DB System...');
    try {
      // 1. Xóa OTP đã hết hạn hoặc đã sử dụng
      const deletedOtps = await prisma.otp.deleteMany({
        where: { OR: [{ isUsed: true }, { expiresAt: { lt: new Date() } }] },
      });

      // 2. Xóa Session đã hết hạn hơn 30 ngày
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const deletedSessions = await prisma.session.deleteMany({
        where: { expiresAt: { lt: thirtyDaysAgo } },
      });

      console.log(
        `✅ [CRON] Đã xóa ${deletedOtps.count} OTP và ${deletedSessions.count} Session rác.`
      );
    } catch (error) {
      console.error('❌ [CRON] Lỗi dọn dẹp System:', error);
    }
  });

  // ==========================================
  // [2] DỌN RÁC THƯƠNG MẠI (Chạy mỗi 5 phút)
  // ==========================================
  cron.schedule('*/5 * * * *', async () => {
    console.log('🛍️ [CRON] Đang quét dọn đơn hàng hết hạn...');
    try {
      // Tách bạch hoàn toàn Business Logic
      const count = await commerceCronService.cleanupExpiredOrders();
      if (count > 0) {
        console.log(`✅ [CRON] Đã nhả Voucher và hủy ${count} đơn hàng rác.`);
      }
    } catch (error) {
      console.error('❌ [CRON] Lỗi dọn dẹp Commerce:', error);
    }
  });
};

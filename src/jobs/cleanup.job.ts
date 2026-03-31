import cron from 'node-cron';
import { prisma } from '@/common/configs/prisma';

export const initCronJobs = () => {
  // Chạy vào lúc 03:00 AM mỗi ngày: '0 3 * * *'
  // Chạy mỗi phút (để test): '* * * * *'
  cron.schedule('0 3 * * *', async () => {
    console.log('🧹 [CRON] Bắt đầu dọn dẹp Database...');
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
      console.error('❌ [CRON] Lỗi dọn dẹp Database:', error);
    }
  });
};

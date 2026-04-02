import cron from 'node-cron';
import { prisma } from '@/common/configs/prisma';

// Chạy vào lúc 02:00 sáng mỗi ngày
cron.schedule('0 2 * * *', async () => {
  try {
    console.log('🧹 Đang dọn dẹp Database...');
    const now = new Date();

    // 1. Xóa các Session đã hết hạn hoặc bị thu hồi quá 7 ngày
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    await prisma.session.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: now } }, { isRevoked: true, lastActive: { lt: sevenDaysAgo } }],
      },
    });

    // 2. Xóa các mã OTP đã hết hạn
    await prisma.otp.deleteMany({
      where: { expiresAt: { lt: now } },
    });

    console.log('✅ Dọn dẹp hoàn tất!');
  } catch (error) {
    console.error('❌ Lỗi dọn dẹp Database:', error);
  }
});

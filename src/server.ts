import app from '@/app';
import { prisma } from '@/common/configs/prisma';
import { env } from '@/common/configs/env';
import { initCronJobs } from './jobs/cleanup.job';

// Hàm kiểm tra kết nối Database
const checkDatabaseConnection = async () => {
  try {
    // Thử ép Prisma kết nối đến DB (Dùng URL trong .env)
    await prisma.$connect();
    console.log('✅ [Database]: Kết nối đến PostgreSQL thành công!');
  } catch (error) {
    console.error('❌ [Database]: Kết nối thất bại. Lỗi:', error);
    // Nếu không có DB, bắt buộc phải tắt Server ngay lập tức (Fail-fast)
    process.exit(1);
  }
};

const startServer = async () => {
  try {
    // 1. Chờ kết nối DB thành công trước
    await checkDatabaseConnection();

    const port = parseInt(env.PORT, 10);

    app.listen(port, () => {
      console.log(`=================================`);
      console.log(`🚀 API Server đang chạy tại: http://localhost:${port}`);
      console.log(`🛡️  Chấp nhận kết nối từ: ${env.CLIENT_URL}`);
      console.log(`=================================`);
    });

    initCronJobs(); // Khởi động CronJob chạy ngầm
  } catch (error) {
    console.error('Lỗi khởi động server:', error);
    process.exit(1);
  }
};

startServer();

// // Lắng nghe sự kiện tắt Server (Ctrl+C hoặc hệ thống yêu cầu tắt)
// process.on('SIGINT', async () => {
//   console.log('⏳ Đang ngắt kết nối Database...');
//   await prisma.$disconnect();
//   console.log('🛑 [Database]: Đã ngắt kết nối PostgreSQL an toàn.');
//   process.exit(0);
// });

// process.on('SIGTERM', async () => {
//   await prisma.$disconnect();
//   process.exit(0);
// });

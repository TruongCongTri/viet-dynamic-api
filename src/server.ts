import { prisma } from '@/common/configs/prisma.config';
import { env } from '@/common/configs/env.config';
import app from '@/app';

import http from 'http';
import { initializeSocket } from '@/common/configs/socket.config';
import { redisConnection } from '@/common/configs/redis.config';

import '@/common/utils/cron/cleanup.cron';
import { initCronJobs } from './cronjobs';

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

/**
 * @function checkRedisConnection
 * @description Verifies connection to Upstash/Redis before starting the server.
 */
const checkRedisConnection = async () => {
  try {
    await redisConnection.ping();
    console.log('[Redis]: Connected successfully!');
  } catch (error) {
    console.error('[Redis]: Failed to connect to Redis. Error:', error);
    process.exit(1);
  }
};

// --- GLOBAL CRASH HANDLERS ---
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const startServer = async () => {
  try {
    console.log('[System]: server.ts has started!');
    console.log('[System]: Starting initialization...');

    // 1. Check Infrastructure
    await checkDatabaseConnection();
    await checkRedisConnection();

    // 2. Start Server
    const port = parseInt(env.PORT, 10);
    const server = http.createServer(app);

    initializeSocket(server);

    app.listen(port, () => {
      console.log(`=================================`);
      console.log(`🚀 API Server đang chạy tại 0.0.0.0:${port}`);
      console.log(`🛡️  Chấp nhận kết nối từ: ${env.CLIENT_URL}`);
      console.log(`=================================`);
    });

    initCronJobs();
  } catch (error) {
    console.error('Lỗi khởi động server:', error);
    process.exit(1);
  }
};

startServer();

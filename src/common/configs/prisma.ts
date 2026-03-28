import { PrismaClient } from '../../generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { env } from './env'; // Đảm bảo đường dẫn đúng tới file env config của bạn

// 1. Khởi tạo pool kết nối của thư viện 'pg'
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

// 2. Tạo adapter để Prisma có thể nói chuyện với 'pg'
const adapter = new PrismaPg(pool as any);

// 3. Khởi tạo Prisma Client với adapter này
export const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

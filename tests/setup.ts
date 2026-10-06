import { prisma } from '@/common/configs/prisma.config';
import { env } from '@/common/configs/env.config';

// 1. CHỐT AN TOÀN: Đảm bảo NODE_ENV phải là 'test'
if (env.NODE_ENV !== 'test') {
  console.error('🚨 CẢNH BÁO: Đang cố gắng chạy Test trên môi trường KHÔNG PHẢI TEST!');
  console.error(`NODE_ENV hiện tại: ${env.NODE_ENV}`);
  process.exit(1); // Dừng khẩn cấp
}

// 2. Dọn dẹp Database TRƯỚC khi chạy toàn bộ E2E Test
beforeAll(async () => {
  await cleanDatabase();
});

// 3. Đóng kết nối sau khi Test xong
afterAll(async () => {
  await prisma.$disconnect();
});

// Hàm dọn dẹp (Truncate) toàn bộ các bảng trong DB
async function cleanDatabase() {
  const tablenames = await prisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

  // Danh sách các bảng "Bất khả xâm phạm" (Dữ liệu nền tảng đã được Seed)
  const tablesToKeep = [
    '_prisma_migrations',
    'Role',
    'Permission',
    'RolePermission',
    'Category',
    'ForbiddenWord'
  ];

  const tables = tablenames
    .map(({ tablename }) => tablename)
    // Lọc bỏ các bảng cần giữ lại
    .filter((name) => !tablesToKeep.includes(name)) 
    .map((name) => `"public"."${name}"`)
    .join(', ');

  if (tables.length === 0) return;

  try {
    // CASCADE: Xóa sạch dữ liệu (như User, Course, Order) nhưng giữ nguyên Role, Category
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
  } catch (error) {
    console.log({ error });
  }
}
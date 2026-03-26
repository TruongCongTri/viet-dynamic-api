import { LessonType, DiscountType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { slugify } from '../src/common/utils/slugify.util';

import "dotenv/config";
import { prisma } from '../src/common/configs/prisma';

async function main() {
  console.log('🤖 Starting Robotics & Automation Seeding...');

  // Kiểm tra kết nối trước khi seed
  await prisma.$connect();

  // 1. SEED ROLES
  const roles = [
    { name: 'ADMIN', description: 'Quản trị viên hệ thống' },
    { name: 'INSTRUCTOR', description: 'Chuyên gia Robotics' },
    { name: 'STUDENT', description: 'Kỹ sư/Sinh viên kỹ thuật' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }

  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  const instructorRole = await prisma.role.findUnique({ where: { name: 'INSTRUCTOR' } });

  // 2. SEED USERS
  const salt = await bcrypt.genSalt(12);
  const password = await bcrypt.hash('VietDynamic@2026', salt);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@vietdynamic.vn' },
    update: {},
    create: {
      email: 'admin@vietdynamic.vn',
      password,
      roleId: adminRole!.id,
      profile: { create: { fullName: 'Viet Dynamic Admin' } }
    }
  });

  const expert = await prisma.user.upsert({
    where: { email: 'expert.robotics@vietdynamic.vn' },
    update: {},
    create: {
      email: 'expert.robotics@vietdynamic.vn',
      password,
      roleId: instructorRole!.id,
      profile: { 
        create: { 
          fullName: 'TS. Nguyễn Tự Động', 
          bio: 'Chuyên gia 10 năm kinh nghiệm trong lĩnh vực Robot cánh tay và SCADA.' 
        } 
      }
    }
  });

  // 3. SEED CATEGORIES (Chuyên môn Robotics)
  console.log('Creating Robotics Categories...');
  const roboticsCategories = [
    { name: 'Robot Công Nghiệp', slug: slugify('Robot Công Nghiệp') },
    { name: 'Lập trình PLC & SCADA', slug: slugify('Lập trình PLC & SCADA') },
    { name: 'AI & Computer Vision', slug: slugify('AI & Computer Vision') },
    { name: 'IoT cho Nhà Máy', slug: slugify('IoT cho Nhà Máy') },
  ];

  for (const cat of roboticsCategories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }

  const robotCat = await prisma.category.findUnique({ where: { name: 'Robot Công Nghiệp' } });

  // 4. SEED ROBOTICS COURSES
  console.log('Creating Advanced Courses...');
  if (robotCat && expert) {
    const courses = [
      {
        title: 'Lập trình Cánh tay Robot ABB cơ bản',
        desc: 'Làm chủ ngôn ngữ RAPID và vận hành Robot ABB trong dây chuyền sản xuất.',
        price: 3500000
      },
      {
        title: 'Thiết kế hệ thống Tự động hóa với PLC S7-1200',
        desc: 'Hướng dẫn đấu nối, lập trình TIA Portal và giám sát qua HMI.',
        price: 2800000
      }
    ];

    for (const c of courses) {
      const slug = slugify(c.title);
      await prisma.course.upsert({
        where: { slug: slug },
        update: {},
        create: {
          title: c.title,
          slug: slug,
          description: c.desc,
          basePrice: c.price,
          isPublished: true,
          categoryId: robotCat.id,
          instructors: { create: { userId: expert.id, isOwner: true } },
          modules: {
            create: [
              {
                title: 'Chương 1: Tổng quan thiết bị',
                order: 1,
                lessons: {
                  create: [
                    { title: 'An toàn trong vận hành Robot', type: LessonType.VIDEO, order: 1, duration: 600 },
                    { title: 'Cấu trúc phần cứng và tủ điều khiển', type: LessonType.VIDEO, order: 2, duration: 1200 },
                  ]
                }
              }
            ]
          }
        }
      });
    }
  }

  // 5. SEED VOUCHERS
  await prisma.voucher.upsert({
    where: { code: 'ROBOTICS_MASTER' },
    update: {},
    create: {
      code: 'ROBOTICS_MASTER',
      type: DiscountType.PERCENTAGE,
      value: 15,
      maxDiscountAmount: 1000000,
      minOrderValue: 2000000,
      startDate: new Date(),
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    }
  });

  console.log('✅ Robotics & Automation data seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
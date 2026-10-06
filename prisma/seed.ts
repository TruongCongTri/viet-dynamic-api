import { AuthProvider, AccountStatus, CourseStatus, LessonType, VideoStatus, DiscountType, VoucherAudience } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { prisma } from '../src/common/configs/prisma.config';
// Đảm bảo đường dẫn import tương ứng với nơi bạn lưu file mock
import { mockCategories } from '../mocks/categories.mock';
import { mockCourses } from '../mocks/courses.mock';

async function main() {
  console.log('🌱 Bắt đầu chạy Seed Data...');

  // ==========================================
  // 1. TẠO QUYỀN HẠN (PERMISSIONS)
  // ==========================================
  const permissionsData = [
    { action: 'MANAGE_SYSTEM', description: 'Quyền quản trị hệ thống tối cao' },
    { action: 'MANAGE_USERS', description: 'Quản lý người dùng' },
    { action: 'MANAGE_ALL_COURSES', description: 'Quản lý, duyệt mọi khóa học' },
    { action: 'VIEW_FINANCE', description: 'Xem báo cáo tài chính toàn sàn' },
    { action: 'CREATE_COURSE', description: 'Tạo khóa học mới' },
    { action: 'EDIT_OWN_COURSE', description: 'Chỉnh sửa khóa học của mình' },
    { action: 'VIEW_OWN_COURSE', description: 'Học khóa học đã mua' },
    { action: 'LEAVE_REVIEW', description: 'Đánh giá khóa học' },
  ];

  for (const p of permissionsData) {
    await prisma.permission.upsert({
      where: { action: p.action },
      update: { description: p.description },
      create: p,
    });
  }
  console.log('✅ Đã seed Permissions');

  // ==========================================
  // 2. TẠO VAI TRÒ (ROLES) & GÁN QUYỀN
  // ==========================================
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'Quản trị viên hệ thống',
      permissions: {
        create: [
          { permission: { connect: { action: 'MANAGE_SYSTEM' } } },
          { permission: { connect: { action: 'MANAGE_USERS' } } },
          { permission: { connect: { action: 'MANAGE_ALL_COURSES' } } },
          { permission: { connect: { action: 'VIEW_FINANCE' } } },
        ]
      }
    },
  });

  const instructorRole = await prisma.role.upsert({
    where: { name: 'INSTRUCTOR' },
    update: {},
    create: {
      name: 'INSTRUCTOR',
      description: 'Giảng viên',
      permissions: {
        create: [
          { permission: { connect: { action: 'CREATE_COURSE' } } },
          { permission: { connect: { action: 'EDIT_OWN_COURSE' } } },
          { permission: { connect: { action: 'VIEW_OWN_COURSE' } } },
          { permission: { connect: { action: 'LEAVE_REVIEW' } } },
        ]
      }
    },
  });

  const studentRole = await prisma.role.upsert({
    where: { name: 'STUDENT' },
    update: {},
    create: {
      name: 'STUDENT',
      description: 'Học viên',
      permissions: {
        create: [
          { permission: { connect: { action: 'VIEW_OWN_COURSE' } } },
          { permission: { connect: { action: 'LEAVE_REVIEW' } } },
        ]
      }
    },
  });
  console.log('✅ Đã seed Roles');

  // ==========================================
  // 3. TẠO CATEGORIES (TỪ MOCK DATA)
  // ==========================================
  for (const cat of mockCategories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, description: cat.description },
      create: cat,
    });
  }
  console.log('✅ Đã seed Categories từ Mock Files');

  // ==========================================
  // 4. TẠO FORBIDDEN WORDS (TỪ CẤM)
  // ==========================================
  const badWords = ['đm', 'vcl', 'lừa đảo', 'scam', 'cứt'];
  for (const word of badWords) {
    await prisma.forbiddenWord.upsert({
      where: { word },
      update: {},
      create: { word },
    });
  }
  console.log('✅ Đã seed Forbidden Words');

  // ==========================================
  // 5. TẠO USERS (ADMIN, INSTRUCTOR, STUDENT)
  // ==========================================
  const defaultPassword = await bcrypt.hash('Password123!', 10);

  await prisma.user.upsert({
    where: { email: 'admin@vietdynamic.vn' },
    update: {},
    create: {
      email: 'admin@vietdynamic.vn',
      password: defaultPassword,
      accountStatus: AccountStatus.APPROVED,
      isEmailVerified: true,
      authProvider: AuthProvider.LOCAL,
      roleId: adminRole.id,
      profile: {
        create: {
          fullName: 'Super Admin',
          slug: 'super-admin',
          bio: 'Quản trị viên tối cao của nền tảng.',
        }
      }
    },
  });

  const instructor = await prisma.user.upsert({
    where: { email: 'instructor@vietdynamic.vn' },
    update: {},
    create: {
      email: 'instructor@vietdynamic.vn',
      password: defaultPassword,
      accountStatus: AccountStatus.APPROVED,
      isEmailVerified: true,
      authProvider: AuthProvider.LOCAL,
      roleId: instructorRole.id,
      profile: {
        create: {
          fullName: 'Bui Vien Giảng Viên',
          slug: 'bui-vien-giang-vien',
          bio: 'Senior Automation Engineer & Robotics Expert.',
        }
      }
    },
  });

  await prisma.user.upsert({
    where: { email: 'student@vietdynamic.vn' },
    update: {},
    create: {
      email: 'student@vietdynamic.vn',
      password: defaultPassword,
      accountStatus: AccountStatus.APPROVED,
      isEmailVerified: true,
      authProvider: AuthProvider.LOCAL,
      roleId: studentRole.id,
      profile: {
        create: {
          fullName: 'Nguyễn Học Viên',
          slug: 'nguyen-hoc-vien',
        }
      }
    },
  });
  console.log('✅ Đã seed Users');

  // ==========================================
  // 6. TẠO KHÓA HỌC MẪU TỪ MOCK DATA
  // ==========================================
  console.log('⏳ Đang tạo các khóa học mẫu. Vui lòng chờ...');
  
  let courseCount = 0;

  for (const courseData of mockCourses) {
    const category = await prisma.category.findUnique({ where: { slug: courseData.categorySlug } });
    if (!category) continue;

    const course = await prisma.course.upsert({
      where: { slug: courseData.slug },
      update: {},
      create: {
        title: courseData.title,
        slug: courseData.slug,
        description: courseData.description,
        basePrice: courseData.basePrice,
        status: CourseStatus.PUBLISHED,
        categoryId: category.id,
        // Phân quyền giảng viên
        instructors: {
          create: {
            userId: instructor.id,
            isOwner: true,
            revenueShare: 80.00
          }
        },
        // Tạo Chapters và Bài học
        modules: {
          create: courseData.modules.map(mod => ({
            title: mod.title,
            order: mod.order,
            lessons: {
              create: mod.lessons.map(lesson => ({
                title: lesson.title,
                type: LessonType.VIDEO,
                videoStatus: VideoStatus.READY,
                duration: lesson.duration,
                order: lesson.order,
                isPreview: lesson.isPreview,
              }))
            }
          }))
        }
      }
    });

    // Tăng Course Count trên Category
    await prisma.category.update({
      where: { id: category.id },
      data: { publishedCourseCount: { increment: 1 } }
    });

    courseCount++;
  }

  // Cập nhật Profile giảng viên
  await prisma.userProfile.update({
    where: { userId: instructor.id },
    data: { totalCourses: courseCount }
  });

  console.log(`✅ Đã seed ${courseCount} Khóa học từ Mock Data`);

  // ==========================================
  // 7. TẠO VOUCHER MẪU (GLOBAL)
  // ==========================================
  await prisma.voucher.upsert({
    where: { code: 'WELCOME100K' },
    update: {},
    create: {
      code: 'WELCOME100K',
      type: DiscountType.FIXED_AMOUNT,
      value: 100000, 
      minOrderValue: 500000, 
      maxUsesTotal: 1000,
      maxUsesPerUser: 1,
      audience: VoucherAudience.GLOBAL,
      startDate: new Date(),
      expiresAt: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
    }
  });
  console.log('✅ Đã seed Voucher');

  console.log('🎉 Quá trình Seed hoàn tất!');
}

main()
  .catch((e) => {
    console.error('❌ Có lỗi xảy ra trong quá trình Seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
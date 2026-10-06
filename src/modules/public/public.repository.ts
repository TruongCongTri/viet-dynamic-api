import { Prisma } from '@prisma/client';
import { prisma } from '@/common/configs/prisma.config';
import { APP_CONFIG } from '@/constants/app.constant';
import {
  GetCoursesQueryDTO,
  GetInstructorsQueryDTO,
  GetCategoriesQueryDTO,
  GetCourseReviewsQueryDTO,
} from './public.schema';

export class PublicRepository {
  // [A] DANH MỤC (CATEGORIES)
  public async getCategories(query: GetCategoriesQueryDTO) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const { sortBy } = query;
    // Dịch logic sortBy sang Prisma orderBy
    const orderBy: Prisma.CategoryOrderByWithRelationInput = (() => {
      if (sortBy === 'popular') return { totalStudents: 'desc' };
      if (sortBy === 'courseCount') return { publishedCourseCount: 'desc' };
      return { createdAt: 'desc' };
    })();

    const where: Prisma.CategoryWhereInput = { publishedCourseCount: { gt: 0 } };

    // Dùng transaction để lấy cả total và data
    const [total, categories] = await prisma.$transaction([
      prisma.category.count({ where }),
      prisma.category.findMany({ skip, take: limit, orderBy, where }),
    ]);

    return { total, categories };
  }

  public async getCategoryDetailBySlug(slug: string) {
    return prisma.category.findFirst({
      // Chỉ lấy danh mục có chứa ít nhất 1 khóa học PUBLISHED
      where: { slug, publishedCourseCount: { gt: 0 } },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        publishedCourseCount: true,
        totalStudents: true,
      },
    });
  }

  // [B] KHÓA HỌC (COURSES)
  public async getCourses(query: GetCoursesQueryDTO) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const { search, categorySlug, instructorSlug, minPrice, maxPrice, sortBy } = query;

    // 1. LUÔN BẮT BUỘC: Chỉ lấy khóa học PUBLISHED
    const where: Prisma.CourseWhereInput = { status: 'PUBLISHED' };

    // 2. Build filter động
    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }
    if (categorySlug) {
      where.category = { slug: categorySlug };
    }
    if (instructorSlug) {
      where.instructors = {
        some: { user: { profile: { slug: instructorSlug } } },
      };
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.basePrice = {};
      if (minPrice !== undefined) where.basePrice.gte = minPrice;
      if (maxPrice !== undefined) where.basePrice.lte = maxPrice;
    }

    // 3. Dịch sortBy sang Prisma orderBy (Sử dụng Indexes đã tạo)
    const orderBy: Prisma.CourseOrderByWithRelationInput = (() => {
      switch (sortBy) {
        case 'popular':
          return { studentCount: 'desc' };
        case 'rating':
          return { averageRating: 'desc' };
        case 'trending':
          return { viewCount: 'desc' };
        case 'newest':
        default:
          return { createdAt: 'desc' };
      }
    })();

    // Thực thi truy vấn song song (Đếm tổng số dòng + Lấy dữ liệu)
    const [total, courses] = await prisma.$transaction([
      prisma.course.count({ where }),
      prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          title: true,
          slug: true,
          thumbnailUrl: true,
          basePrice: true,
          averageRating: true,
          reviewCount: true,
          studentCount: true,
          totalDuration: true,
          category: { select: { name: true, slug: true } },
          // Chỉ lấy avatar và tên giảng viên ra trang chủ
          instructors: {
            select: {
              user: { select: { profile: { select: { fullName: true, avatarUrl: true } } } },
            },
          },
        },
      }),
    ]);

    return { total, courses };
  }

  public async getCourseDetailBySlug(slug: string) {
    return prisma.course.findFirst({
      // BẢO MẬT: Phải kèm status PUBLISHED để user không thể gõ link ẩn
      where: { slug, status: 'PUBLISHED' },
      include: {
        category: { select: { name: true, slug: true } },
        instructors: {
          select: {
            user: {
              select: {
                id: true,
                profile: { select: { fullName: true, avatarUrl: true, bio: true } },
              },
            },
          },
        },
        // SỰ SỐNG CÒN CỦA DRM: TUYỆT ĐỐI KHÔNG SELECT videoUrl HOẶC videoId
        modules: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            order: true,
            totalDuration: true,
            lessons: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                title: true,
                type: true,
                duration: true,
                isPreview: true,
              },
            },
          },
        },
      },
    });
  }

  public async getCourseReviewsBySlug(slug: string, query: GetCourseReviewsQueryDTO) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const { rating } = query;

    const where: Prisma.CourseReviewWhereInput = {
      course: { slug, status: 'PUBLISHED' }, // BẢO MẬT: Phải là khóa học public
      ...(rating ? { rating } : {}), // Lọc theo sao nếu có
    };

    const [total, reviews] = await prisma.$transaction([
      prisma.courseReview.count({ where }),
      prisma.courseReview.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }, // Ưu tiên review mới nhất
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          user: {
            select: { profile: { select: { fullName: true, avatarUrl: true } } },
          },
        },
      }),
    ]);

    return { total, reviews };
  }

  // [C] GIẢNG VIÊN (INSTRUCTORS)
  public async getInstructors(query: GetInstructorsQueryDTO) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const { sortBy } = query;

    const orderBy: Prisma.UserProfileOrderByWithRelationInput = (() => {
      if (sortBy === 'popular') return { totalStudents: 'desc' };
      if (sortBy === 'rating') return { averageRating: 'desc' };
      return {};
    })();

    const where: Prisma.UserProfileWhereInput = {
      user: { role: { name: APP_CONFIG.AUTH.INSTRUCTOR_ROLE }, isActive: true },
      totalCourses: { gt: 0 },
    };

    // Dùng transaction để lấy total
    const [total, instructors] = await prisma.$transaction([
      prisma.userProfile.count({ where }),
      prisma.userProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          userId: true,
          fullName: true,
          avatarUrl: true,
          bio: true,
          totalStudents: true,
          averageRating: true,
          totalCourses: true,
        },
      }),
    ]);

    return { total, instructors };
  }

  public async getInstructorDetailBySlug(slug: string) {
    return prisma.userProfile.findFirst({
      where: {
        slug,
        user: { role: { name: 'INSTRUCTOR' }, isActive: true },
      },
      include: {
        // Kéo ra danh sách các khóa học của thầy đó (Nhớ chặn PUBLISHED)
        user: {
          select: {
            taughtCourses: {
              where: { course: { status: 'PUBLISHED' } },
              select: {
                course: {
                  select: {
                    id: true,
                    title: true,
                    slug: true,
                    thumbnailUrl: true,
                    basePrice: true,
                    averageRating: true,
                    studentCount: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  // [D] PAYMENTS (Dành cho Webhook)
  public async getOrderForWebhook(orderId: string) {
    return prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true }, // Lấy thông tin items để cấp quyền khóa học
    });
  }

  public async getPaymentForWebhook(paymentId: string) {
    return prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          include: { items: true }, // Lấy thông tin items để cấp quyền khóa học
        },
      },
    });
  }

  public async updateOrderSuccessTransaction(
    paymentId: string,
    orderId: string,
    userId: string,
    providerTransactionId: string,
    rawPayload: any
  ) {
    // Transaction nguyên tử: Cập nhật đơn hàng, tạo Payment log, sinh Enrollment, và tăng Metrics
    return prisma.$transaction(async (tx) => {
      // 1. Cập nhật trạng thái Payment (Lịch sử giao dịch)
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'SUCCESS',
          providerTransactionId,
          webhookPayload: rawPayload,
        },
      });

      // 2. Cập nhật trạng thái Order (Đơn hàng tổng)
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'SUCCESS' },
      });

      // 3. Cấp khóa học (Enrollment) và cập nhật Metrics
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (order) {
        for (const item of order.items) {
          // Tránh lỗi ném ra từ Prisma nếu webhook gọi 2 lần sát nhau (Race Condition dự phòng)
          const existingEnrollment = await tx.enrollment.findUnique({
            where: { userId_courseId: { userId, courseId: item.courseId } },
          });

          if (!existingEnrollment) {
            await tx.enrollment.create({
              data: { userId, courseId: item.courseId },
            });

            // Cập nhật Metrics Khóa học (studentCount)
            await tx.course.update({
              where: { id: item.courseId },
              data: { studentCount: { increment: 1 } },
            });
          }
        }
      }
    });
  }
}

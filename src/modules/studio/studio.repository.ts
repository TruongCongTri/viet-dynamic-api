import { prisma } from '@/common/configs/prisma.config';
import {
  CreateCourseDTO,
  CreateLessonDTO,
  CreateModuleDTO,
  UpdateCourseDTO,
  UpdateLessonDTO,
  UpdateModuleDTO,
} from './studio.schema';

export class StudioRepository {
  // 1. Lấy danh sách khóa học của tôi
  public async getMyCourses(instructorId: string) {
    return prisma.course.findMany({
      where: {
        instructors: { some: { userId: instructorId } },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        category: { select: { name: true } },
        _count: { select: { enrollments: true, modules: true } },
      },
    });
  }

  // 2. Gatekeeper: Kiểm tra quyền sở hữu
  public async getCourseByIdAndInstructor(courseId: string, instructorId: string) {
    return prisma.course.findFirst({
      where: {
        id: courseId,
        instructors: { some: { userId: instructorId } },
      },
      include: {
        category: true,
        instructors: {
          include: {
            user: {
              select: {
                id: true,
                profile: {
                  select: {
                    fullName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  // 3. Tạo Khóa học (Transaction bọc kèm tạo CourseInstructor)
  public async createCourse(instructorId: string, slug: string, data: CreateCourseDTO) {
    return prisma.$transaction(async (tx) => {
      const course = await tx.course.create({
        data: {
          title: data.title,
          slug,
          categoryId: data.categoryId,
          status: 'DRAFT', // Mặc định luôn là bản nháp
          instructors: {
            create: {
              userId: instructorId,
              isOwner: true,
            },
          },
        },
      });
      return course;
    });
  }

  // 4. Cập nhật thông tin
  public async updateCourse(courseId: string, data: UpdateCourseDTO, newSlug?: string) {
    // Lọc bỏ toàn bộ các key có giá trị undefined để vượt qua strict mode của TypeScript
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined)
    );

    return prisma.course.update({
      where: { id: courseId },
      data: {
        ...cleanData,
        ...(newSlug && { slug: newSlug }),
      },
    });
  }

  // 5. Đổi trạng thái (Gửi duyệt)
  public async updateCourseStatus(courseId: string, status: any) {
    // Type OrderStatus tùy DB bạn cấu hình
    return prisma.course.update({
      where: { id: courseId },
      data: { status },
    });
  }

  // 6. Xóa khóa học an toàn
  public async deleteCourse(courseId: string) {
    return prisma.course.delete({
      where: { id: courseId },
    });
  }

  public async countLessonsInCourse(courseId: string): Promise<number> {
    return prisma.lesson.count({
      where: { module: { courseId: courseId } },
    });
  }

  // ==========================================
  // [B] CURRICULUM (MODULES & LESSONS)
  // ==========================================

  // 1. Lấy toàn bộ cây Giáo trình (Modules + Lessons)
  public async getCurriculum(courseId: string) {
    return prisma.module.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
      include: {
        lessons: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            type: true,
            isPreview: true,
            duration: true,
            order: true,
            videoStatus: true,
          },
        },
      },
    });
  }

  // 2. Gatekeeper cho Module: Check xem Module này có thuộc Course mà Giảng viên này sở hữu không?
  public async getModuleWithOwnership(moduleId: string, instructorId: string) {
    return prisma.module.findFirst({
      where: {
        id: moduleId,
        course: { instructors: { some: { userId: instructorId } } },
      },
      include: { course: true },
    });
  }

  // 3. Gatekeeper cho Lesson: Check xuyên qua Lesson -> Module -> Course
  public async getLessonWithOwnership(lessonId: string, instructorId: string) {
    return prisma.lesson.findFirst({
      where: {
        id: lessonId,
        module: { course: { instructors: { some: { userId: instructorId } } } },
      },
      include: { module: { include: { course: true } } },
    });
  }

  // CRUD MODULE
  public async createModule(courseId: string, data: CreateModuleDTO) {
    return prisma.module.create({ data: { courseId, ...data } });
  }

  public async updateModule(moduleId: string, data: UpdateModuleDTO) {
    // Lọc bỏ toàn bộ các thuộc tính có giá trị undefined
    const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));

    return prisma.module.update({
      where: { id: moduleId },
      data: cleanData,
    });
  }

  public async deleteModule(moduleId: string) {
    return prisma.module.delete({ where: { id: moduleId } });
  }

  // CRUD LESSON
  public async createLesson(moduleId: string, data: CreateLessonDTO) {
    return prisma.lesson.create({ data: { moduleId, ...data } });
  }

  public async updateLesson(lessonId: string, data: UpdateLessonDTO) {
    // Lọc bỏ undefined y hệt như Update Course
    const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
    return prisma.lesson.update({ where: { id: lessonId }, data: cleanData });
  }

  public async deleteLesson(lessonId: string) {
    return prisma.lesson.delete({ where: { id: lessonId } });
  }

  // Cập nhật trạng thái video khi Cloudflare transcode xong
  public async updateVideoReadyStatus(videoId: string, duration: number) {
    return prisma.lesson.updateMany({
      where: { videoId },
      data: {
        videoStatus: 'READY',
        duration: Math.round(duration), // Lưu chính xác số giây để FE tính Progress sau này
      },
    });
  }

  // ==========================================
  // [C] ANALYTICS & QNA (THỐNG KÊ & HỖ TRỢ)
  // ==========================================

  // 1. Lấy thông tin tổng quan của Giảng viên từ Profile
  public async getInstructorProfileMetrics(instructorId: string) {
    return prisma.userProfile.findUnique({
      where: { userId: instructorId },
      select: { totalStudents: true, averageRating: true, totalCourses: true },
    });
  }

  // 2. Lấy dữ liệu Sales để tính doanh thu thực nhận
  public async getInstructorSalesData(instructorId: string, startDate?: Date) {
    return prisma.courseInstructor.findMany({
      where: { userId: instructorId },
      select: {
        revenueShare: true,
        course: {
          select: {
            id: true,
            title: true,
            orderItems: {
              where: {
                order: {
                  status: 'SUCCESS',
                  ...(startDate && { createdAt: { gte: startDate } }), // Lọc theo thời gian nếu có
                },
              },
              select: { pricePaid: true, order: { select: { createdAt: true } } },
            },
          },
        },
      },
    });
  }

  // 3. Gom bình luận chưa ai trả lời
  public async getUnansweredQuestions(instructorId: string) {
    return prisma.lessonComment.findMany({
      where: {
        parentId: null, // Chỉ lấy bình luận gốc (Câu hỏi)
        replies: { none: {} }, // Chưa có bất kỳ ai reply
        lesson: {
          module: {
            course: {
              instructors: { some: { userId: instructorId } }, // Thuộc khóa học của Giảng viên này
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit 50 câu hỏi mới nhất để chống lag
      include: {
        user: { select: { id: true, profile: { select: { fullName: true, avatarUrl: true } } } },
        lesson: {
          select: {
            id: true,
            title: true,
            module: { select: { course: { select: { id: true, title: true } } } },
          },
        },
      },
    });
  }

  // ==========================================
  // [E] VIDEO PROCESSING & METADATA
  // ==========================================

  /**
   * Cập nhật trạng thái xử lý Video của bài học
   */
  public async updateLessonVideoStatus(lessonId: string, status: any) {
    return prisma.lesson.update({
      where: { id: lessonId },
      data: { videoStatus: status },
    });
  }
}

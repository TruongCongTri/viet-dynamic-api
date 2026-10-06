import { Lesson, Prisma } from '@prisma/client';
import { prisma } from '@/common/configs/prisma.config';
import { BaseRepository } from '@/common/repositories/base.repository';
import { UpdateProgressDTO, CreateCommentDTO, CreateReviewDTO } from './learn.schema';

export class LearnRepository extends BaseRepository<Lesson> {
  constructor() {
    super('lesson');
  }

  // --- QUERIES CHO ENROLLMENT ---
  public async findEnrollmentsByUserId(userId: string) {
    return prisma.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            // thumbnail: true,
            totalDuration: true,
            _count: { select: { modules: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async findEnrollment(userId: string, courseId: string) {
    return prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
  }

  public async findEnrollmentBySlug(userId: string, slug: string) {
    return prisma.enrollment.findFirst({
      where: { userId, course: { slug } },
    });
  }

  public async updateLastAccessed(enrollmentId: string, lessonId: string) {
    return prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { lastAccessedLessonId: lessonId },
    });
  }

  // --- QUERIES CHO COURSE & SYLLABUS ---
  public async findCourseBySlug(slug: string, userId?: string) {
    const queryOptions: Prisma.CourseFindUniqueArgs = {
      where: { slug },
    };

    if (userId) {
      queryOptions.include = {
        modules: {
          orderBy: { order: 'asc' },
          include: {
            lessons: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                title: true,
                type: true,
                duration: true,
                videoStatus: true,
                isPreview: true,
                progress: {
                  where: { userId },
                  select: { isCompleted: true, watchedSeconds: true },
                },
              },
            },
          },
        },
      };
    }

    return prisma.course.findUnique(queryOptions);
  }

  // --- QUERIES CHO LESSON & PROGRESS ---

  public async findLessonWithModule(lessonId: string) {
    return prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: { select: { courseId: true } } },
    });
  }

  public async findFirstLesson(courseId: string) {
    return prisma.lesson.findFirst({
      where: { module: { courseId } },
      orderBy: [{ module: { order: 'asc' } }, { order: 'asc' }],
      select: { id: true },
    });
  }

  public async findProgress(userId: string, lessonId: string) {
    return prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });
  }

  /**
   * Cập nhật tiến độ bài học (Dùng UpdateProgressDTO)
   */
  public async upsertProgress(userId: string, lessonId: string, dto: UpdateProgressDTO) {
    return prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: {
        watchedSeconds: dto.watchedSeconds,
        ...(dto.isCompleted !== undefined && { isCompleted: dto.isCompleted }),
      },
      create: {
        userId,
        lessonId,
        watchedSeconds: dto.watchedSeconds,
        isCompleted: dto.isCompleted || false,
      },
    });
  }

  public async countLessonsInCourse(courseId: string) {
    return prisma.lesson.count({ where: { module: { courseId } } });
  }

  public async countCompletedLessons(userId: string, courseId: string) {
    return prisma.lessonProgress.count({
      where: { userId, isCompleted: true, lesson: { module: { courseId } } },
    });
  }

  // --- QUERIES CHO COMMENTS ---
  public async findCommentsByLessonId(lessonId: string) {
    return prisma.lessonComment.findMany({
      where: { lessonId, parentId: null },
      include: {
        user: { select: { id: true, profile: { select: { fullName: true, avatarUrl: true } } } },
        replies: {
          include: {
            user: {
              select: { id: true, profile: { select: { fullName: true, avatarUrl: true } } },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async findCommentById(commentId: string) {
    return prisma.lessonComment.findUnique({ where: { id: commentId } });
  }

  /**
   * Tạo bình luận mới (Dùng CreateCommentDTO)
   */
  public async createComment(userId: string, lessonId: string, dto: CreateCommentDTO) {
    return prisma.lessonComment.create({
      data: {
        content: dto.content,
        userId,
        lessonId,
        parentId: dto.parentId || null,
      },
      include: {
        user: { select: { profile: { select: { fullName: true, avatarUrl: true } } } },
      },
    });
  }

  // --- QUERIES CHO REVIEWS ---
  /**
   * Cập nhật hoặc tạo đánh giá mới (Dùng CreateReviewDTO)
   */
  public async upsertReview(userId: string, courseId: string, dto: CreateReviewDTO) {
    const commentValue = dto.content ?? null;

    return prisma.courseReview.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: {
        rating: dto.rating,
        comment: commentValue, // Map content từ DTO vào trường comment của Schema
      },
      create: {
        userId,
        courseId,
        rating: dto.rating,
        comment: commentValue,
      },
    });
  }

  // --- BỔ SUNG QUERIES CHO COMMENTS ---
  public async updateComment(commentId: string, content: string) {
    return prisma.lessonComment.update({
      where: { id: commentId },
      data: { content },
    });
  }

  public async deleteComment(commentId: string) {
    return prisma.lessonComment.delete({
      where: { id: commentId },
    });
  }

  // ==========================================
  // [D] SECURITY & ACCESS CONTROL
  // ==========================================

  /**
   * Rào cản 3 lớp cho khu vực Hỏi Đáp (Q&A)
   * Quyền truy cập: ADMIN, Giảng viên của khóa, Học viên đã mua khóa
   */
  public async checkUserHasQnaAccess(userId: string, courseId: string): Promise<boolean> {
    // Chạy song song 3 câu query để tối ưu tốc độ (Performance)
    const [user, isInstructor, isEnrolled] = await Promise.all([
      // Lớp 1: Check Admin
      prisma.user.findUnique({
        where: { id: userId },
        select: { role: { select: { name: true } } },
      }),
      // Lớp 2: Check Giảng viên của khóa học này
      prisma.courseInstructor.findUnique({
        where: { courseId_userId: { courseId, userId } },
      }),
      // Lớp 3: Check Học viên đã mua khóa học này
      prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
      }),
    ]);

    if (user?.role?.name === 'ADMIN') return true;
    if (isInstructor) return true;
    if (isEnrolled) return true;

    return false; // Trượt cả 3 lớp -> Từ chối truy cập
  }
}

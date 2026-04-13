import { prisma } from '@/common/configs/prisma';

import { CreateCommentDTO, CreateReviewDTO, UpdateProgressDTO } from './learn.schema';

import { AppError } from '@/common/errors/app.error';
import { MESSAGES } from '@/constants/messages';
import { RESOURCES } from '@/constants/resources';
import { LearnRepository } from './learn.repository';

// import { signCloudflareVideoToken } from '@/common/utils/cloudflare.util';

export class LearnService {
  private readonly learnRepository: LearnRepository;

  constructor() {
    this.learnRepository = new LearnRepository();
  }

  // [A] BẢNG ĐIỀU KHIỂN HỌC TẬP (DASHBOARD)
  public async getMyCourses(userId: string) {
    const enrollments = await this.learnRepository.findEnrollmentsByUserId(userId);

    // Tính toán phần trăm hoàn thành cho từng khóa học
    const courseProgressPromises = enrollments.map(async (enrollment) => {
      const courseId = enrollment.courseId;

      // Đếm tổng số bài học của khóa
      const totalLessons = await prisma.lesson.count({
        where: { module: { courseId } },
      });

      // Đếm số bài user đã hoàn thành trong khóa này
      const completedLessons = await prisma.lessonProgress.count({
        where: {
          userId,
          isCompleted: true,
          lesson: { module: { courseId } },
        },
      });

      const progressPercent = await this.calculateProgress(userId, enrollment.courseId);

      return {
        ...enrollment.course,
        progressPercent,
        completedLessons,
        totalLessons,
        lastAccessedLessonId: enrollment.lastAccessedLessonId,
      };
    });

    return Promise.all(courseProgressPromises);
  }

  public async resumeCourse(userId: string, slug: string) {
    const course = await prisma.course.findUnique({ where: { slug } });
    if (!course) throw new AppError(404, MESSAGES.COMMON.ERROR.NOT_FOUND(RESOURCES.COURSE));

    const enrollment = await this.learnRepository.findEnrollmentBySlug(userId, slug);

    if (!enrollment) throw new AppError(403, 'Bạn chưa ghi danh khóa học này.');

    // Nếu đã có bài học lưu dở, trả về luôn
    if (enrollment.lastAccessedLessonId) {
      return { lessonId: enrollment.lastAccessedLessonId };
    }

    // Nếu học lần đầu, tìm bài học đầu tiên của module đầu tiên
    const firstLesson = await prisma.lesson.findFirst({
      where: { module: { courseId: course.id } },
      orderBy: [{ module: { order: 'asc' } }, { order: 'asc' }],
      select: { id: true },
    });

    if (!firstLesson) throw new AppError(404, 'Khóa học chưa có nội dung.');

    return { lessonId: firstLesson.id };
  }

  // [B] TRÌNH PHÁT VIDEO & NỘI DUNG
  public async getCourseSyllabus(userId: string, slug: string) {
    const course = await this.learnRepository.findCourseBySlug(slug, userId);

    if (!course) throw new AppError(404, MESSAGES.COMMON.ERROR.NOT_FOUND(RESOURCES.COURSE));

    return course;
  }

  public async getLessonDetail(userId: string, lessonId: string) {
    const lesson = await this.learnRepository.findLessonWithModule(lessonId);

    if (!lesson) throw new AppError(404, MESSAGES.COMMON.ERROR.NOT_FOUND(RESOURCES.LESSON));

    const courseId = lesson.module.courseId;

    // 1. GATEKEEPER: Kiểm tra sở hữu
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });

    // Nếu không sở hữu VÀ bài này không cho học thử -> Chặn!
    if (!enrollment && !lesson.isPreview) {
      throw new AppError(403, 'Bạn phải sở hữu khóa học này để xem nội dung.');
    }

    // 2. Ghi nhận vị trí học tập (Fire and Forget - Không cần await để tránh làm chậm API)
    if (enrollment) {
      prisma.enrollment
        .update({
          where: { id: enrollment.id },
          data: { lastAccessedLessonId: lesson.id },
        })
        .catch(console.error);
    }

    // 3. KIỂM TRA TRẠNG THÁI VIDEO TRƯỚC KHI CẤP TOKEN
    let videoToken = null;
    if (lesson.type === 'VIDEO') {
      if (lesson.videoStatus === 'READY' && lesson.videoId) {
        // Chỉ cấp token phát khi video đã xử lý xong hoàn toàn
        // videoToken = signCloudflareVideoToken(lesson.videoId);
        videoToken = `signed_token_${lesson.videoId}_${Date.now()}`;
      }
      // Nếu videoStatus là PROCESSING hoặc FAILED, videoToken sẽ null.
      // FE check thấy type=VIDEO nhưng videoToken=null và videoStatus=PROCESSING -> Hiện màn hình chờ.
    }

    // 4. Lấy lịch sử xem dở (nếu có) để Player nhảy đến đúng giây
    const progress = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
      select: { watchedSeconds: true, isCompleted: true },
    });

    return {
      ...lesson,
      videoToken,
      watchedSeconds: progress?.watchedSeconds || 0,
      isCompleted: progress?.isCompleted || false,
    };
  }

  public async updateProgress(userId: string, lessonId: string, payload: UpdateProgressDTO) {
    const lesson = await this.learnRepository.findById(lessonId, {
      select: { duration: true },
    });

    if (!lesson) throw new AppError(404, MESSAGES.COMMON.ERROR.NOT_FOUND(RESOURCES.LESSON));

    // Thuật toán Heartbeat Threshold (90%)
    let isCompletedAuto = false;
    if (lesson.duration > 0 && payload.watchedSeconds / lesson.duration >= 0.9) {
      isCompletedAuto = true;
    }

    // FE có thể truyền lên true nếu user bấm nút "Mark as Completed"
    const finalIsCompleted = payload.isCompleted || isCompletedAuto;

    // Upsert để tối ưu hóa việc tạo/cập nhật
    const progress = await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: {
        watchedSeconds: payload.watchedSeconds,
        ...(finalIsCompleted && { isCompleted: true }), // Chỉ update nếu thành true
      },
      create: {
        userId,
        lessonId,
        watchedSeconds: payload.watchedSeconds,
        isCompleted: finalIsCompleted,
      },
    });

    return progress;
  }

  // [C] TƯƠNG TÁC & CỘNG ĐỒNG
  public async getComments(lessonId: string) {
    return await this.learnRepository.findCommentsByLessonId(lessonId);
  }

  public async createComment(userId: string, lessonId: string, payload: CreateCommentDTO) {
    // Kiểm tra xem parentId có hợp lệ không (nếu có)
    if (payload.parentId) {
      const parent = await this.learnRepository.findCommentById(payload.parentId);
      if (!parent || parent.lessonId !== lessonId) {
        throw new AppError(400, 'Bình luận cha không hợp lệ hoặc không thuộc bài học này.');
      }
    }

    const comment = await prisma.lessonComment.create({
      data: {
        userId,
        lessonId,
        content: payload.content,
        parentId: payload.parentId || null,
      },
      include: {
        user: { select: { profile: { select: { fullName: true, avatarUrl: true } } } },
      },
    });

    return comment;
  }

  public async createReview(userId: string, slug: string, payload: CreateReviewDTO) {
    const course = await this.learnRepository.findCourseBySlug(slug);

    if (!course) throw new AppError(404, MESSAGES.COMMON.ERROR.NOT_FOUND(RESOURCES.COURSE));

    const courseId = course.id;

    // 1. Kiểm tra sở hữu khóa học
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });

    if (!enrollment) {
      throw new AppError(403, 'Bạn phải sở hữu khóa học này mới được phép đánh giá.');
    }

    // 2. Tính toán tiến độ thực tế (Chống Seeding/Review ảo)
    const totalLessons = await prisma.lesson.count({
      where: { module: { courseId } },
    });

    const completedLessons = await prisma.lessonProgress.count({
      where: {
        userId,
        isCompleted: true,
        lesson: { module: { courseId } },
      },
    });

    const progressPercent = totalLessons === 0 ? 0 : completedLessons / totalLessons;

    if (progressPercent < 0.2) {
      throw new AppError(
        403,
        `Vui lòng hoàn thành ít nhất 20% khóa học (hiện tại: ${Math.round(progressPercent * 100)}%) trước khi đánh giá.`
      );
    }

    // 3. Upsert Review
    const review = await this.learnRepository.upsertReview(userId, course.id, payload);

    return review;
  }

  private async calculateProgress(userId: string, courseId: string): Promise<number> {
    const total = await this.learnRepository.countLessonsInCourse(courseId);
    if (total === 0) return 0;
    const completed = await this.learnRepository.countCompletedLessons(userId, courseId);
    return Math.round((completed / total) * 100);
  }
}

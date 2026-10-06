import { prisma } from '@/common/configs/prisma.config';
import { env } from '@/common/configs/env.config'; // Nhớ import env

import { CreateCommentDTO, CreateReviewDTO, UpdateProgressDTO } from './learn.schema';

import { AppError } from '@/common/errors/app.error';
import { MESSAGES } from '@/constants/messages';
import { RESOURCES } from '@/constants/resources';
import { LearnRepository } from './learn.repository';
import { ERROR_CODES } from '@/constants/error-codes';

export class LearnService {
  private readonly learnRepository: LearnRepository;

  constructor() {
    this.learnRepository = new LearnRepository();
  }

  // [A] BẢNG ĐIỀU KHIỂN HỌC TẬP (DASHBOARD)
  public async getMyCourses(userId: string) {
    const enrollments = await this.learnRepository.findEnrollmentsByUserId(userId);

    const courseProgressPromises = enrollments.map(async (enrollment) => {
      const courseId = enrollment.courseId;

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

      // Tiến độ khóa học tính dựa trên số lượng bài học đã hoàn thành [cite: 44]
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

    if (enrollment.lastAccessedLessonId) {
      return { lessonId: enrollment.lastAccessedLessonId };
    }

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

    if (!enrollment && !lesson.isPreview) {
      throw new AppError(403, 'Bạn phải sở hữu khóa học này để xem nội dung.');
    }

    // 2. Ghi nhận vị trí học tập (Fire and Forget)
    if (enrollment) {
      prisma.enrollment
        .update({
          where: { id: enrollment.id },
          data: { lastAccessedLessonId: lesson.id },
        })
        .catch(console.error);
    }

    // 3. KIỂM TRA TRẠNG THÁI VIDEO TRƯỚC KHI CẤP TOKEN BẢO MẬT
    let videoToken = null;
    if (lesson.type === 'VIDEO') {
      if (lesson.videoStatus === 'READY' && lesson.videoId) {
        const accountId = env.CLOUDFLARE_ACCOUNT_ID;
        const apiToken = env.CLOUDFLARE_API_TOKEN;

        if (accountId && apiToken) {
          try {
            // Thay vì giao Video ID gốc, Backend gọi API tạo ra một "Signed Token" [cite: 56]
            const response = await fetch(
              `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${lesson.videoId}/token`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${apiToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  exp: Math.floor(Date.now() / 1000) + 7200, // Token sống 2 tiếng [cite: 56]
                  downloadable: false,
                }),
              }
            );
            const data: any = await response.json();
            if (data.success) {
              videoToken = data.result.token;
            }
          } catch (error) {
            console.error('Lỗi lấy token Cloudflare:', error);
          }
        }
      }
    }

    // 4. Lấy lịch sử xem dở (nếu có) để Player nhảy đến đúng giây
    const progress = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
      select: { watchedSeconds: true, isCompleted: true },
    });

    const { videoId: _hiddenVideoId, videoUrl: _hiddenVideoUrl, ...safeLesson } = lesson;

    return {
      ...safeLesson,
      videoToken,
      watchedSeconds: progress?.watchedSeconds || 0,
      isCompleted: progress?.isCompleted || false,
    };
  }

  public async updateProgress(userId: string, lessonId: string, payload: UpdateProgressDTO) {
    // Dùng findLessonWithModule để lấy được courseId tính % khóa học
    const lesson = await this.learnRepository.findLessonWithModule(lessonId);

    if (!lesson) throw new AppError(404, MESSAGES.COMMON.ERROR.NOT_FOUND(RESOURCES.LESSON));

    // Lấy tiến độ cũ để đảm bảo số giây lưu vào Database luôn là thời gian xem cao nhất [cite: 23]
    const existingProgress = await this.learnRepository.findProgress(userId, lessonId);
    const maxWatchedSeconds = Math.max(
      existingProgress?.watchedSeconds || 0,
      payload.watchedSeconds
    );

    // Thuật toán Heartbeat Threshold (90%) [cite: 40]
    let isCompletedAuto = existingProgress?.isCompleted || false;
    if (!isCompletedAuto && lesson.duration > 0 && maxWatchedSeconds / lesson.duration >= 0.9) {
      isCompletedAuto = true;
    }

    const finalIsCompleted = payload.isCompleted || isCompletedAuto;

    // Upsert Tiến độ
    const progress = await this.learnRepository.upsertProgress(userId, lessonId, {
      watchedSeconds: maxWatchedSeconds,
      isCompleted: finalIsCompleted,
    });

    // Tính toán lại ngay tiến độ toàn khóa để FE cập nhật UI
    const courseId = lesson.module.courseId;
    const courseProgressPercent = await this.calculateProgress(userId, courseId);

    return {
      ...progress,
      courseProgressPercent,
    };
  }

  // [C] TƯƠNG TÁC & CỘNG ĐỒNG
  public async getComments(lessonId: string) {
    const comments = await this.learnRepository.findCommentsByLessonId(lessonId);

    // [BẢN VÁ]: Định dạng lại response để có "Hào quang Giảng viên"
    return comments.map((c) => {
      // Giả sử repository trả về role của user
      const role = (c.user as any).role?.name || 'STUDENT';
      const isInstructorOrAdmin = role === 'ADMIN' || role === 'INSTRUCTOR';

      return {
        id: c.id,
        content: c.content,
        parentId: c.parentId,
        createdAt: c.createdAt,
        user: {
          id: c.user.id,
          fullName: c.user.profile?.fullName,
          avatarUrl: c.user.profile?.avatarUrl,
          role: role,
        },
        isAuthor: isInstructorOrAdmin, // Frontend dùng cờ này để tô nền màu vàng
      };
    });
  }

  public async createComment(userId: string, lessonId: string, payload: CreateCommentDTO) {
    const lesson = await this.learnRepository.findLessonWithModule(lessonId);
    if (!lesson)
      throw new AppError(404, 'Bài học không tồn tại', ERROR_CODES.DATABASE.RECORD_NOT_FOUND);

    // return true nếu User là ADMIN, Giảng viên của khóa, hoặc Học viên đã mua khóa.
    const hasAccess = await this.learnRepository.checkUserHasQnaAccess(
      userId,
      lesson.module.courseId
    );
    if (!hasAccess) {
      throw new AppError(
        403,
        'Bạn không có quyền truy cập khu vực thảo luận của bài học này.',
        ERROR_CODES.COMMON.FORBIDDEN
      );
    }

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

    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });

    if (!enrollment) {
      throw new AppError(403, 'Bạn phải sở hữu khóa học này mới được phép đánh giá.');
    }

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

    const review = await this.learnRepository.upsertReview(userId, course.id, payload);

    return review;
  }

  private async calculateProgress(userId: string, courseId: string): Promise<number> {
    const total = await this.learnRepository.countLessonsInCourse(courseId);
    if (total === 0) return 0;
    const completed = await this.learnRepository.countCompletedLessons(userId, courseId);
    return Math.round((completed / total) * 100);
  }

  // Thêm vào cuối phần [C] TƯƠNG TÁC & CỘNG ĐỒNG
  public async updateComment(userId: string, commentId: string, content: string) {
    const comment = await this.learnRepository.findCommentById(commentId);
    if (!comment)
      throw new AppError(404, 'Không tìm thấy bình luận.', ERROR_CODES.DATABASE.RECORD_NOT_FOUND);

    // Gác cổng: Chỉ người tạo ra bình luận mới được sửa
    if (comment.userId !== userId) {
      throw new AppError(
        403,
        'Bạn không có quyền chỉnh sửa bình luận này.',
        ERROR_CODES.COMMON.FORBIDDEN_OWNERSHIP
      );
    }

    return this.learnRepository.updateComment(commentId, content);
  }

  public async deleteComment(userId: string, commentId: string) {
    const comment = await this.learnRepository.findCommentById(commentId);
    if (!comment)
      throw new AppError(404, 'Không tìm thấy bình luận.', ERROR_CODES.DATABASE.RECORD_NOT_FOUND);

    // Gác cổng: Chỉ người tạo ra bình luận mới được xóa (Hoặc Admin - sẽ được xử lý ở phân hệ Admin)
    if (comment.userId !== userId) {
      throw new AppError(
        403,
        'Bạn không có quyền xóa bình luận này.',
        ERROR_CODES.COMMON.FORBIDDEN_OWNERSHIP
      );
    }

    // Prisma onDelete: Cascade sẽ tự động dọn dẹp các replies con nếu đây là bình luận cha
    await this.learnRepository.deleteComment(commentId);
    return { message: 'Đã xóa bình luận thành công.' };
  }
}

import { LearnService } from './learn.service';
import { LearnRepository } from './learn.repository';
import { prisma } from '../../common/configs/prisma.config';
import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';

// --- MOCKS ---
jest.mock('./learn.repository');
jest.mock('@/common/configs/prisma.config', () => ({
  prisma: {
    course: { findUnique: jest.fn() },
    lesson: { count: jest.fn(), findFirst: jest.fn() },
    lessonProgress: { count: jest.fn(), findUnique: jest.fn() },
    enrollment: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
    lessonComment: { create: jest.fn() },
  },
}));

// Mock biến môi trường cho Cloudflare
jest.mock('@/common/configs/env.config', () => ({
  env: { CLOUDFLARE_ACCOUNT_ID: 'mock-account', CLOUDFLARE_API_TOKEN: 'mock-token' },
}));

describe('LearnService (Unit Tests - Full Coverage)', () => {
  let learnService: LearnService;
  let mockRepo: jest.Mocked<LearnRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = new LearnRepository() as jest.Mocked<LearnRepository>;
    learnService = new LearnService();
    (learnService as any).learnRepository = mockRepo;

    // [BẢN VÁ LỖI FETCH]: Ép kiểu as any để bypass yêu cầu chuẩn cấu trúc Response của TS
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ success: true, result: { token: 'mock-cf-token' } }),
      } as any)
    ) as jest.Mock<any>;
  });

  afterEach(() => {
    (global.fetch as jest.Mock<any>).mockRestore();
  });

  // ==========================================
  // [A] DASHBOARD & RESUME
  // ==========================================
  describe('getMyCourses', () => {
    it('should return mapped courses with progress', async () => {
      mockRepo.findEnrollmentsByUserId.mockResolvedValueOnce([
        { courseId: 'c1', course: { title: 'Course 1' }, lastAccessedLessonId: 'l1' },
      ] as any);

      // [BẢN VÁ LỖI NEVER]: Dùng jest.Mock<any> thay vì jest.Mock
      (prisma.lesson.count as jest.Mock<any>).mockResolvedValueOnce(10);
      (prisma.lessonProgress.count as jest.Mock<any>).mockResolvedValueOnce(5);
      mockRepo.countLessonsInCourse.mockResolvedValueOnce(10);
      mockRepo.countCompletedLessons.mockResolvedValueOnce(5); // 50%

      const result = await learnService.getMyCourses('u1');

      expect(result).toHaveLength(1);
      expect(result[0].progressPercent).toBe(50);
      expect(result[0].completedLessons).toBe(5);
      expect(result[0].totalLessons).toBe(10);
    });
  });

  describe('resumeCourse', () => {
    it('should throw 404 if course not found', async () => {
      (prisma.course.findUnique as jest.Mock<any>).mockResolvedValueOnce(null);
      await expect(learnService.resumeCourse('u1', 'slug')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should throw 403 if not enrolled', async () => {
      (prisma.course.findUnique as jest.Mock<any>).mockResolvedValueOnce({ id: 'c1' });
      mockRepo.findEnrollmentBySlug.mockResolvedValueOnce(null);
      await expect(learnService.resumeCourse('u1', 'slug')).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('should return lastAccessedLessonId if exists', async () => {
      (prisma.course.findUnique as jest.Mock<any>).mockResolvedValueOnce({ id: 'c1' });
      mockRepo.findEnrollmentBySlug.mockResolvedValueOnce({ lastAccessedLessonId: 'l1' } as any);
      const result = await learnService.resumeCourse('u1', 'slug');
      expect(result.lessonId).toBe('l1');
    });

    it('should return first lesson if no lastAccessedLessonId', async () => {
      (prisma.course.findUnique as jest.Mock<any>).mockResolvedValueOnce({ id: 'c1' });
      mockRepo.findEnrollmentBySlug.mockResolvedValueOnce({ lastAccessedLessonId: null } as any);
      (prisma.lesson.findFirst as jest.Mock<any>).mockResolvedValueOnce({ id: 'l-first' });

      const result = await learnService.resumeCourse('u1', 'slug');
      expect(result.lessonId).toBe('l-first');
    });

    it('should throw 404 if course has no content (no first lesson)', async () => {
      (prisma.course.findUnique as jest.Mock<any>).mockResolvedValueOnce({ id: 'c1' });
      mockRepo.findEnrollmentBySlug.mockResolvedValueOnce({ lastAccessedLessonId: null } as any);
      (prisma.lesson.findFirst as jest.Mock<any>).mockResolvedValueOnce(null);

      await expect(learnService.resumeCourse('u1', 'slug')).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  // ==========================================
  // [B] VIDEO PLAYER & PROGRESS
  // ==========================================
  describe('getCourseSyllabus', () => {
    it('should throw 404 if course not found', async () => {
      mockRepo.findCourseBySlug.mockResolvedValueOnce(null);
      await expect(learnService.getCourseSyllabus('u1', 'slug')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should return course syllabus', async () => {
      mockRepo.findCourseBySlug.mockResolvedValueOnce({ id: 'c1', title: 'Syllabus' } as any);
      const result = await learnService.getCourseSyllabus('u1', 'slug');
      expect(result.title).toBe('Syllabus');
    });
  });

  describe('getLessonDetail', () => {
    it('should throw 404 if lesson not found', async () => {
      mockRepo.findLessonWithModule.mockResolvedValueOnce(null);
      await expect(learnService.getLessonDetail('u1', 'l1')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should throw 403 if user not enrolled and lesson is not preview', async () => {
      mockRepo.findLessonWithModule.mockResolvedValueOnce({
        id: 'l1',
        module: { courseId: 'c1' },
        isPreview: false,
      } as any);
      (prisma.enrollment.findUnique as jest.Mock<any>).mockResolvedValueOnce(null);

      await expect(learnService.getLessonDetail('u1', 'l1')).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('should generate Cloudflare token and strip hidden fields', async () => {
      const dbLesson = {
        id: 'l1',
        type: 'VIDEO',
        videoStatus: 'READY',
        videoId: 'cf-123',
        videoUrl: 'hidden',
        module: { courseId: 'c1' },
        isPreview: true,
      };
      mockRepo.findLessonWithModule.mockResolvedValueOnce(dbLesson as any);
      // Giả lập user ĐÃ MUA khóa học
      (prisma.enrollment.findUnique as jest.Mock<any>).mockResolvedValueOnce({
        id: 'enrollment-1',
      });
      (prisma.enrollment.update as jest.Mock<any>).mockResolvedValueOnce({}); // Mock cho hàm update ngầm

      const result = await learnService.getLessonDetail('u1', 'l1');

      // 1. Kiểm tra Token Cloudflare có được tạo không
      expect(global.fetch).toHaveBeenCalled();
      expect(result.videoToken).toBe('mock-cf-token');

      // 2. Đảm bảo hệ thống đã ngầm cập nhật lastAccessedLessonId
      expect(prisma.enrollment.update).toHaveBeenCalledWith({
        where: { id: 'enrollment-1' },
        data: { lastAccessedLessonId: 'l1' },
      });

      expect((result as any).videoId).toBeUndefined();
      expect((result as any).videoUrl).toBeUndefined();
    });
  });

  describe('updateProgress', () => {
    it('should throw 404 if lesson not found', async () => {
      mockRepo.findLessonWithModule.mockResolvedValueOnce(null);
      await expect(
        learnService.updateProgress('u1', 'l1', { watchedSeconds: 10 })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should auto complete lesson if watched >= 90%', async () => {
      mockRepo.findLessonWithModule.mockResolvedValueOnce({
        duration: 100,
        module: { courseId: 'c1' },
      } as any);
      mockRepo.findProgress.mockResolvedValueOnce({
        watchedSeconds: 50,
        isCompleted: false,
      } as any);
      mockRepo.upsertProgress.mockResolvedValueOnce({
        watchedSeconds: 95,
        isCompleted: true,
      } as any);

      mockRepo.countLessonsInCourse.mockResolvedValueOnce(1);
      mockRepo.countCompletedLessons.mockResolvedValueOnce(1);

      const result = await learnService.updateProgress('u1', 'l1', { watchedSeconds: 95 });

      expect(mockRepo.upsertProgress).toHaveBeenCalledWith('u1', 'l1', {
        watchedSeconds: 95,
        isCompleted: true,
      });
      expect(result.courseProgressPercent).toBe(100);
    });
  });

  // ==========================================
  // [C] COMMUNITY & REVIEWS
  // ==========================================
  describe('getComments', () => {
    it('should format comments with author halo', async () => {
      const mockComments = [
        {
          id: 'c1',
          content: 'hello',
          user: { id: 'u1', role: { name: 'INSTRUCTOR' } },
        },
      ];
      mockRepo.findCommentsByLessonId.mockResolvedValueOnce(mockComments as any);

      const result = await learnService.getComments('l1');
      expect(result[0].isAuthor).toBe(true);
    });
  });

  describe('createComment', () => {
    it('should throw 404 if lesson not found', async () => {
      mockRepo.findLessonWithModule.mockResolvedValueOnce(null);
      await expect(
        learnService.createComment('u1', 'l1', { content: 'test' })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 403 if user has no access', async () => {
      mockRepo.findLessonWithModule.mockResolvedValueOnce({ module: { courseId: 'c1' } } as any);
      mockRepo.checkUserHasQnaAccess.mockResolvedValueOnce(false);
      await expect(
        learnService.createComment('u1', 'l1', { content: 'test' })
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('should throw 400 if parent comment is invalid', async () => {
      mockRepo.findLessonWithModule.mockResolvedValueOnce({ module: { courseId: 'c1' } } as any);
      mockRepo.checkUserHasQnaAccess.mockResolvedValueOnce(true);
      mockRepo.findCommentById.mockResolvedValueOnce({ lessonId: 'other-lesson' } as any);

      await expect(
        learnService.createComment('u1', 'l1', { content: 'test', parentId: 'p1' })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should create comment successfully', async () => {
      mockRepo.findLessonWithModule.mockResolvedValueOnce({ module: { courseId: 'c1' } } as any);
      mockRepo.checkUserHasQnaAccess.mockResolvedValueOnce(true);
      (prisma.lessonComment.create as jest.Mock<any>).mockResolvedValueOnce({ id: 'c1' });

      const result = await learnService.createComment('u1', 'l1', { content: 'test' });
      expect(result.id).toBe('c1');
    });
  });

  describe('createReview', () => {
    it('should throw 404 if course not found', async () => {
      mockRepo.findCourseBySlug.mockResolvedValueOnce(null);
      await expect(
        learnService.createReview('u1', 'slug', { rating: 5, content: 'Good' })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 403 if user is not enrolled', async () => {
      mockRepo.findCourseBySlug.mockResolvedValueOnce({ id: 'c1' } as any);
      (prisma.enrollment.findUnique as jest.Mock<any>).mockResolvedValueOnce(null);
      await expect(
        learnService.createReview('u1', 'slug', { rating: 5, content: 'Good' })
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('should throw 403 if course progress is below 20%', async () => {
      mockRepo.findCourseBySlug.mockResolvedValueOnce({ id: 'c1' } as any);
      (prisma.enrollment.findUnique as jest.Mock<any>).mockResolvedValueOnce({});
      (prisma.lesson.count as jest.Mock<any>).mockResolvedValueOnce(10);
      (prisma.lessonProgress.count as jest.Mock<any>).mockResolvedValueOnce(1);

      await expect(
        learnService.createReview('u1', 'slug', { rating: 5, content: 'Good' })
      ).rejects.toMatchObject({ statusCode: 403, message: expect.stringContaining('20%') });
    });

    it('should upsert review if progress is >= 20%', async () => {
      mockRepo.findCourseBySlug.mockResolvedValueOnce({ id: 'c1' } as any);
      (prisma.enrollment.findUnique as jest.Mock<any>).mockResolvedValueOnce({});
      (prisma.lesson.count as jest.Mock<any>).mockResolvedValueOnce(10);
      (prisma.lessonProgress.count as jest.Mock<any>).mockResolvedValueOnce(5);
      mockRepo.upsertReview.mockResolvedValueOnce({ id: 'r1' } as any);

      const result = await learnService.createReview('u1', 'slug', { rating: 5, content: 'Good' });
      expect(result.id).toBe('r1');
    });
  });

  describe('update & delete Comment', () => {
    it('should throw 404 if comment not found', async () => {
      mockRepo.findCommentById.mockResolvedValueOnce(null);
      await expect(learnService.updateComment('u1', 'c1', 'content')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should throw 403 if not the owner', async () => {
      mockRepo.findCommentById.mockResolvedValueOnce({ userId: 'other-user' } as any);
      await expect(learnService.deleteComment('u1', 'c1')).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('should delete comment if owner', async () => {
      mockRepo.findCommentById.mockResolvedValueOnce({ userId: 'u1' } as any);
      mockRepo.deleteComment.mockResolvedValueOnce({} as any);

      const result = await learnService.deleteComment('u1', 'c1');
      expect(result.message).toBeDefined();
    });

    it('should update comment if owner', async () => {
      mockRepo.findCommentById.mockResolvedValueOnce({ userId: 'u1' } as any);
      mockRepo.updateComment.mockResolvedValueOnce({ content: 'new' } as any);

      const result = await learnService.updateComment('u1', 'c1', 'new');
      expect(result.content).toBe('new');
    });
  });
});

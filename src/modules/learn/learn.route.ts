import { Router } from 'express';
import { ENDPOINTS } from '@/constants/endpoints';
import { validate } from '@/middlewares/validate.middleware';
import { requireRole, verifyToken } from '@/middlewares/auth.middleware';
import { LearnController } from './learn.controller';
import {
  commentParamSchema,
  createCommentSchema,
  createReviewSchema,
  updateCommentSchema,
  updateProgressSchema,
} from './learn.schema';

export class LearnRoute {
  public router: Router;
  private readonly learnController: LearnController;

  /**
   * DEPENDENCY INJECTION (DI)
   */
  constructor(controller?: LearnController) {
    this.router = Router();
    this.learnController = controller || new LearnController();

    // Tự động map các route khi Class được khởi tạo
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Centralized Auth Middleware
    const studentAuth = [verifyToken, requireRole(['STUDENT'])];

    // [A] BẢNG ĐIỀU KHIỂN HỌC TẬP (DASHBOARD)
    this.router.get(ENDPOINTS.LEARN.MY_COURSES, studentAuth, this.learnController.getMyCourses);
    this.router.get(ENDPOINTS.LEARN.COURSE_RESUME, studentAuth, this.learnController.resumeCourse);

    // [B] TRÌNH PHÁT VIDEO & NỘI DUNG (VIDEO PLAYER)
    this.router.get(
      ENDPOINTS.LEARN.COURSE_SYLLABUS,
      studentAuth,
      this.learnController.getCourseContent
    );
    this.router.get(ENDPOINTS.LEARN.LESSON, studentAuth, this.learnController.getLessonDetail);

    this.router.put(
      ENDPOINTS.LEARN.PROGRESS,
      studentAuth,
      validate(updateProgressSchema),
      this.learnController.updateProgress
    );

    // [C] TƯƠNG TÁC & CỘNG ĐỒNG (COMMUNITY)
    this.router.get(ENDPOINTS.LEARN.COMMENTS, this.learnController.getComments);

    this.router.post(
      ENDPOINTS.LEARN.COMMENTS,
      studentAuth,
      validate(createCommentSchema),
      this.learnController.createComment
    );

    this.router.post(
      ENDPOINTS.LEARN.REVIEWS,
      studentAuth,
      validate(createReviewSchema),
      this.learnController.createReview
    );

    // Sửa bình luận
    this.router.put(
      '/comments/:commentId',
      studentAuth,
      validate(commentParamSchema),
      validate(updateCommentSchema),
      this.learnController.updateComment
    );

    // Xóa bình luận
    this.router.delete(
      '/comments/:commentId',
      studentAuth,
      validate(commentParamSchema),
      this.learnController.deleteComment
    );
  }
}

// Export một instance mặc định để dễ tương thích với file server.ts cũ
export default new LearnRoute().router;

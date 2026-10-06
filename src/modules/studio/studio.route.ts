import { Router } from 'express';
import { StudioController } from './studio.controller';
import { validate } from '@/middlewares/validate.middleware';
import { verifyToken, requireRole } from '@/middlewares/auth.middleware';
import { checkCourseOwnership } from '@/middlewares/course-ownership.middleware';

import {
  createCourseSchema,
  updateCourseSchema,
  courseParamSchema,
  createModuleSchema,
  moduleParamSchema,
  updateModuleSchema,
  createLessonSchema,
  lessonParamSchema,
  updateLessonSchema,
  revenueChartQuerySchema,
} from './studio.schema';

export class StudioRoute {
  public router: Router;
  private readonly studioController: StudioController;

  constructor() {
    this.router = Router();
    this.studioController = new StudioController();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // ==========================================
    // [WEBHOOKS] (Public - Dành cho bên thứ 3)
    // ==========================================
    // Điểm cộng lớn: Đặt trước verifyToken để Cloudflare có thể chọc vào
    // this.router.post('/webhooks/cloudflare', this.studioController.processCloudflareWebhook);

    // ==========================================
    // TƯỜNG LỬA 2 LỚP: Đăng nhập + Là Giảng Viên/Admin
    // ==========================================
    this.router.use(verifyToken, requireRole(['INSTRUCTOR', 'ADMIN']));

    // ==========================================
    // [A] COURSE MANAGEMENT
    // ==========================================
    this.router.get('/courses', this.studioController.getMyCourses);

    this.router.post('/courses', validate(createCourseSchema), this.studioController.createCourse);

    // Bắt đầu áp dụng checkCourseOwnership cho các thao tác trên 1 khóa học cụ thể
    this.router.get(
      '/courses/:id',
      validate(courseParamSchema),
      checkCourseOwnership, // [BẢN VÁ]
      this.studioController.getCourseDetail
    );

    this.router.put(
      '/courses/:id',
      validate(courseParamSchema),
      validate(updateCourseSchema),
      checkCourseOwnership, // [BẢN VÁ]
      this.studioController.updateCourse
    );

    this.router.post(
      '/courses/:id/publish-request',
      validate(courseParamSchema),
      checkCourseOwnership, // [BẢN VÁ]
      this.studioController.requestPublish
    );

    this.router.delete(
      '/courses/:id',
      validate(courseParamSchema),
      checkCourseOwnership, // [BẢN VÁ]
      this.studioController.deleteCourse
    );

    // ==========================================
    // [B] CURRICULUM
    // ==========================================

    this.router.get(
      '/courses/:id/curriculum',
      validate(courseParamSchema),
      checkCourseOwnership, // [BẢN VÁ]
      this.studioController.getCurriculum
    );

    // --- MODULES ---
    this.router.post(
      '/courses/:id/modules',
      validate(courseParamSchema),
      validate(createModuleSchema),
      checkCourseOwnership, // Có req.params.id (chính là courseId) -> Dùng Middleware được
      this.studioController.createModule
    );

    // KHÔNG dùng checkCourseOwnership ở đây vì URL không có courseId.
    // Logic gác cổng đã được xử lý bên trong StudioService (getModuleWithOwnership).
    this.router.put(
      '/modules/:moduleId',
      validate(moduleParamSchema),
      validate(updateModuleSchema),
      this.studioController.updateModule
    );

    this.router.delete(
      '/modules/:moduleId',
      validate(moduleParamSchema),
      this.studioController.deleteModule
    );

    // --- LESSONS ---
    // KHÔNG dùng checkCourseOwnership ở đây vì URL chỉ có moduleId/lessonId.
    this.router.post(
      '/modules/:moduleId/lessons',
      validate(moduleParamSchema),
      validate(createLessonSchema),
      this.studioController.createLesson
    );

    this.router.put(
      '/lessons/:lessonId',
      validate(lessonParamSchema),
      validate(updateLessonSchema),
      this.studioController.updateLesson
    );

    this.router.delete(
      '/lessons/:lessonId',
      validate(lessonParamSchema),
      this.studioController.deleteLesson
    );

    // --- CLOUDFLARE UPLOAD URL ---
    this.router.get(
      '/lessons/:lessonId/upload-url',
      validate(lessonParamSchema),
      // Validate schema nếu có tham số phụ (như type video, v.v.), nếu không có thì bỏ validate(getUploadUrlSchema)
      this.studioController.getUploadUrl // [LƯU Ý]: Đảm bảo hàm này trong Controller gọi đúng service.generateCloudflareUploadUrl
    );

    // ==========================================
    // [C] ANALYTICS & QNA
    // ==========================================
    this.router.get('/analytics/overview', this.studioController.getAnalyticsOverview);

    this.router.get(
      '/analytics/revenue',
      validate(revenueChartQuerySchema),
      this.studioController.getRevenueChart
    );

    this.router.get('/qna/unanswered', this.studioController.getUnansweredQnA);
  }
}

export default new StudioRoute().router;

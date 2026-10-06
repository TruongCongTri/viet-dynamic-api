import { Router } from 'express';
import { AdminCourseController } from './admin-course.controller';
import { validate } from '@/middlewares/validate.middleware';
import { verifyToken, requireRole } from '@/middlewares/auth.middleware';
import {
  categorySchema,
  courseParamSchema,
  rejectCourseSchema,
  assignInstructorsSchema,
  queryReviewsSchema,
} from './admin-course.schema';
import { paramIdSchema } from '../finance/admin-finance.schema';

export class AdminCourseRoute {
  public router: Router;
  private readonly controller: AdminCourseController;

  constructor() {
    this.router = Router();
    this.controller = new AdminCourseController();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // TOÀN BỘ CÁC ROUTE YÊU CẦU QUYỀN ADMIN
    this.router.use(verifyToken, requireRole(['ADMIN']));

    // ==========================================
    // [A] DANH MỤC (CATEGORIES)
    // ==========================================
    this.router.get('/categories', this.controller.getCategories);
    this.router.post('/categories', validate(categorySchema), this.controller.createCategory);
    this.router.put('/categories/:id', validate(categorySchema), this.controller.updateCategory);
    this.router.delete('/categories/:id', this.controller.deleteCategory);

    this.router.get('/instructors', this.controller.getInstructorList);
    // ==========================================
    // [B] KIỂM DUYỆT KHÓA HỌC (COURSE MODERATION)
    // ==========================================
    this.router.get('/courses', this.controller.getCourses);
    this.router.get('/courses/:id', validate(courseParamSchema), this.controller.getCourseDetail);

    // Các lệnh phán quyết (Phê duyệt, Từ chối, Kéo sập)
    this.router.patch(
      '/courses/:id/approve',
      validate(courseParamSchema),
      this.controller.approveCourse
    );
    this.router.patch(
      '/courses/:id/reject',
      validate(courseParamSchema),
      validate(rejectCourseSchema),
      this.controller.rejectCourse
    );
    this.router.patch(
      '/courses/:id/takedown',
      validate(courseParamSchema),
      this.controller.takedownCourse
    );

    // ==========================================
    // [C] QUẢN LÝ GIẢNG VIÊN (INSTRUCTOR ASSIGNMENT)
    // ==========================================
    // (Route /instructors phải đặt lên trên /courses/:id để không bị Express nhầm chữ 'instructors' là ID)

    this.router.put(
      '/courses/:id/instructors',
      validate(courseParamSchema),
      validate(assignInstructorsSchema),
      this.controller.assignInstructors
    );

    // Thêm vào initializeRoutes() trong AdminCourseRoute
    this.router.get('/reviews', validate(queryReviewsSchema), this.controller.getReviews);
    this.router.delete('/reviews/:id', validate(paramIdSchema), this.controller.deleteReview);
  }
}

export default new AdminCourseRoute().router;

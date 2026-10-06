import { Router } from 'express';
import { PublicController } from './public.controller';
import { validate } from '@/middlewares/validate.middleware';
import {
  getCategoriesQuerySchema,
  getCategorySlugSchema,
  getCoursesQuerySchema,
  getCourseSlugSchema,
  getInstructorsQuerySchema,
  getInstructorSlugSchema,
  getCourseReviewsSchema,
  paymentWebhookSchema,
} from './public.schema';
import { ENDPOINTS } from '@/constants/endpoints';

export class PublicRoute {
  public router: Router;
  private readonly publicController: PublicController;

  /**
   * Init Route with Dependency Injection (DI)
   */
  constructor(controller?: PublicController) {
    this.router = Router();
    this.publicController = controller || new PublicController();

    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.use((req, _res, next) => {
      console.log(`🕵️ Request đến ${req.originalUrl} - Headers:`, req.headers.authorization);
      next();
    });
    // [A] DANH MỤC (CATEGORIES)

    // [POST] CREATE NEW Public
    this.router.get(
      ENDPOINTS.PUBLIC.CATEGORIES,
      validate(getCategoriesQuerySchema),
      this.publicController.getCategories
    );

    this.router.get(
      ENDPOINTS.PUBLIC.CATEGORY_DETAIL,
      validate(getCategorySlugSchema),
      this.publicController.getCategoryWithCourses
    );

    // [B] KHÓA HỌC (COURSES)
    this.router.get(
      ENDPOINTS.PUBLIC.COURSES,
      validate(getCoursesQuerySchema),
      this.publicController.getCourses
    );

    this.router.get(
      ENDPOINTS.PUBLIC.COURSE_DETAIL,
      validate(getCourseSlugSchema),
      this.publicController.getCourseDetail
    );

    this.router.get(
      ENDPOINTS.PUBLIC.COURSE_REVIEWS,
      validate(getCourseReviewsSchema),
      this.publicController.getCourseReviews
    );

    // [C] GIẢNG VIÊN (INSTRUCTORS)
    this.router.get(
      ENDPOINTS.PUBLIC.INSTRUCTORS,
      validate(getInstructorsQuerySchema),
      this.publicController.getInstructors
    );

    this.router.get(
      ENDPOINTS.PUBLIC.INSTRUCTOR_DETAIL,
      validate(getInstructorSlugSchema),
      this.publicController.getInstructorWithCourses
    );

    // [D] PAYMENTS
    this.router.post(
      ENDPOINTS.PUBLIC.WEBHOOK_PAYMENT_VNPAY,
      validate(paymentWebhookSchema),
      this.publicController.vnpayWebhook
    );

    this.router.post(
      ENDPOINTS.PUBLIC.WEBHOOK_PAYMENT_MOMO,
      validate(paymentWebhookSchema),
      this.publicController.momoWebhook
    );
  }
}

// Export default instance of Route to be used in main route configuration
export default new PublicRoute().router;

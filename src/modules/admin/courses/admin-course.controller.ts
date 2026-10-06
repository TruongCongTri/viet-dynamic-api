import { Request, Response } from 'express';
import { AdminCourseService } from './admin-course.service';
import { successResponse } from '@/common/utils/responses/api-response';
import {
  CategoryDTO,
  RejectCourseDTO,
  AssignInstructorsDTO,
  QueryReviewsDTO,
} from './admin-course.schema';

export class AdminCourseController {
  private readonly adminCourseService: AdminCourseService;

  constructor() {
    this.adminCourseService = new AdminCourseService();
  }

  // ==========================================
  // [A] CATEGORIES (DANH MỤC)
  // ==========================================

  public getCategories = async (_req: Request, res: Response) => {
    const result = await this.adminCourseService.getCategories();
    successResponse(res, {
      statusCode: 200,
      message: 'Lấy danh sách danh mục thành công',
      data: result,
    });
  };

  public createCategory = async (req: Request, res: Response) => {
    const data = req.body as CategoryDTO;

    const result = await this.adminCourseService.createCategory(data);
    successResponse(res, { statusCode: 201, message: 'Tạo danh mục thành công', data: result });
  };

  public updateCategory = async (req: Request, res: Response) => {
    const categoryId = req.params.id as string;
    const data = req.body as CategoryDTO;

    const result = await this.adminCourseService.updateCategory(categoryId, data);
    successResponse(res, {
      statusCode: 200,
      message: 'Cập nhật danh mục thành công',
      data: result,
    });
  };

  public deleteCategory = async (req: Request, res: Response) => {
    const categoryId = req.params.id as string;

    const result = await this.adminCourseService.deleteCategory(categoryId);
    successResponse(res, { statusCode: 200, message: result.message });
  };

  // ==========================================
  // [B] COURSE MODERATION (KIỂM DUYỆT KHÓA HỌC)
  // ==========================================

  public getCourses = async (req: Request, res: Response) => {
    const query = req.query as Record<string, any>;

    const { data, meta } = await this.adminCourseService.getCourses(query);
    successResponse(res, {
      statusCode: 200,
      message: 'Lấy danh sách khóa học thành công',
      data,
      meta,
    });
  };

  public getCourseDetail = async (req: Request, res: Response) => {
    const courseId = req.params.id as string;

    const result = await this.adminCourseService.getCourseDetail(courseId);
    successResponse(res, {
      statusCode: 200,
      message: 'Lấy chi tiết khóa học thành công',
      data: result,
    });
  };

  public approveCourse = async (req: Request, res: Response) => {
    const courseId = req.params.id as string;

    const result = await this.adminCourseService.approveCourse(courseId);
    successResponse(res, { statusCode: 200, message: result.message });
  };

  public rejectCourse = async (req: Request, res: Response) => {
    const courseId = req.params.id as string;
    const payload = req.body as RejectCourseDTO;

    const result = await this.adminCourseService.rejectCourse(courseId, payload.reason);
    successResponse(res, { statusCode: 200, message: result.message });
  };

  public takedownCourse = async (req: Request, res: Response) => {
    const courseId = req.params.id as string;

    const result = await this.adminCourseService.takedownCourse(courseId);
    successResponse(res, { statusCode: 200, message: result.message });
  };

  // ==========================================
  // [C] INSTRUCTOR ASSIGNMENT (PHÂN QUYỀN GIẢNG VIÊN)
  // ==========================================

  public getInstructorList = async (_req: Request, res: Response) => {
    const result = await this.adminCourseService.getInstructorList();
    successResponse(res, {
      statusCode: 200,
      message: 'Lấy danh sách giảng viên thành công',
      data: result,
    });
  };

  public assignInstructors = async (req: Request, res: Response) => {
    const courseId = req.params.id as string;
    const payload = req.body as AssignInstructorsDTO;

    const result = await this.adminCourseService.assignInstructors(courseId, payload.instructors);
    successResponse(res, { statusCode: 200, message: result.message });
  };

  public getReviews = async (req: Request, res: Response) => {
    const query = req.query as unknown as QueryReviewsDTO;
    const { data, meta } = await this.adminCourseService.getReviews(query);
    successResponse(res, {
      statusCode: 200,
      message: 'Lấy danh sách đánh giá thành công',
      data,
      meta,
    });
  };

  public deleteReview = async (req: Request, res: Response) => {
    const reviewId = req.params.id as string;
    const result = await this.adminCourseService.deleteReview(reviewId);
    successResponse(res, { statusCode: 200, message: result.message });
  };
}

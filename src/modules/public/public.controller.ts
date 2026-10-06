import { NextFunction, Request, Response } from 'express';
import { PublicService } from './public.service';
import { successResponse } from '@/common/utils/responses/api-response';
import {
  GetCoursesQueryDTO,
  GetInstructorsQueryDTO,
  GetCategoriesQueryDTO,
  GetCourseReviewsQueryDTO,
} from './public.schema';
import { MESSAGES } from '@/constants/messages';
import { RESOURCES } from '@/constants/resources';

export class PublicController {
  private readonly publicService: PublicService;

  constructor() {
    this.publicService = new PublicService();
  }

  // [A] DANH MỤC (CATEGORIES)
  public getCategories = async (req: Request, res: Response) => {
    const query = req.query as unknown as GetCategoriesQueryDTO;
    const { data, meta } = await this.publicService.getCategories(query);

    successResponse(res, {
      statusCode: 200,
      message: MESSAGES.COMMON.SUCCESS.FETCHED(RESOURCES.CATEGORY),
      data,
      meta,
    });
  };

  public getCategoryWithCourses = async (req: Request, res: Response) => {
    const slug = req.params.slug as string;
    const query = req.query as unknown as GetCoursesQueryDTO;

    const result = await this.publicService.getCategoryWithCourses(slug, query);

    successResponse(res, {
      statusCode: 200,
      message: MESSAGES.COMMON.SUCCESS.FETCHED(RESOURCES.CATEGORY),
      data: {
        category: result.category,
        courses: result.courses, // Mảng khóa học nằm cùng cấp với category
      },
      meta: result.meta,
    });
  };

  // [B] KHÓA HỌC (COURSES)
  public getCourses = async (req: Request, res: Response) => {
    const query = req.query as unknown as GetCoursesQueryDTO;
    const result = await this.publicService.getCourses(query);

    successResponse(res, {
      statusCode: 200,
      message: MESSAGES.COMMON.SUCCESS.FETCHED(RESOURCES.COURSE),
      data: result.data,
      meta: result.meta,
    });
  };

  public getCourseDetail = async (req: Request, res: Response) => {
    const slug = req.params.slug as string;
    const result = await this.publicService.getCourseDetail(slug);

    successResponse(res, {
      statusCode: 200,
      message: MESSAGES.COMMON.SUCCESS.FETCHED(RESOURCES.COURSE_CONTENT),
      data: result,
    });
  };

  public getCourseReviews = async (req: Request, res: Response) => {
    const slug = req.params.slug as string;
    const query = req.query as unknown as GetCourseReviewsQueryDTO;
    const result = await this.publicService.getCourseReviews(slug, query);

    successResponse(res, {
      statusCode: 200,
      message: 'Lấy danh sách đánh giá thành công',
      data: result.reviews,
      meta: result.meta,
    });
  };

  // [C] GIẢNG VIÊN (INSTRUCTORS)
  public getInstructors = async (req: Request, res: Response) => {
    const query = req.query as unknown as GetInstructorsQueryDTO;
    const result = await this.publicService.getInstructors(query);

    successResponse(res, {
      statusCode: 200,
      message: MESSAGES.COMMON.SUCCESS.FETCHED(RESOURCES.INSTRUCTOR),
      data: result.data,
      meta: result.meta,
    });
  };

  public getInstructorWithCourses = async (req: Request, res: Response) => {
    const slug = req.params.slug as string;
    const query = req.query as unknown as GetCoursesQueryDTO;

    const result = await this.publicService.getInstructorDetail(slug, query);

    successResponse(res, {
      statusCode: 200,
      message: MESSAGES.COMMON.SUCCESS.FETCHED(RESOURCES.INSTRUCTOR),
      data: {
        instructor: result.instructor,
        courses: result.courses, // Mảng khóa học nằm cùng cấp với instructor
      },
      meta: result.meta,
    });
  };

  // [D] XỬ LÝ WEBHOOK THANH TOÁN
  public vnpayWebhook = async (req: Request, res: Response, next: NextFunction) => {
    // Không dùng try-catch throw lỗi chuẩn, vì VNPAY chỉ đọc mã code
    try {
      const result = await this.publicService.processVnpayWebhook(req.body); // Hoặc req.query tùy chuẩn VNPAY
      res.status(200).json(result);
    } catch (error) {
      // Return 97 cho lỗi checksum
      // res.status(200).json({ RspCode: '97', Message: 'Invalid Checksum or Unknown Error' });
      next(error);
    }
  };

  public momoWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Vì MoMo gửi dữ liệu dạng JSON thông thường, req.body đã chứa sẵn payload
      await this.publicService.processMomoWebhook(req.body);

      // MoMo IPN yêu cầu trả về HTTP Code 204 (No Content) để xác nhận đã nhận
      res.status(204).send();
    } catch (error) {
      // Tương tự, dùng _error để pass qua quy tắc của ESLint.
      // Nếu lỗi chữ ký hoặc dữ liệu sai, trả về 400 để ghi log hoặc 204 để MoMo ngừng gọi lại.
      // Tốt nhất nên trả 400 để có cảnh báo lỗi trên trang quản lý của MoMo.
      // res.status(400).json({ message: 'Invalid Signature or Bad Request' });
      next(error);
    }
  };
}

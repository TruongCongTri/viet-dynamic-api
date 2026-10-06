import { NextFunction, Request, Response } from 'express';
import { StudioService } from './studio.service';
import { successResponse } from '@/common/utils/responses/api-response';
import {
  CreateCourseDTO,
  CreateLessonDTO,
  CreateModuleDTO,
  UpdateCourseDTO,
  UpdateLessonDTO,
  UpdateModuleDTO,
} from './studio.schema';
import { AppError } from '@/common/errors/app.error';

export class StudioController {
  private readonly studioService: StudioService;

  constructor() {
    this.studioService = new StudioService();
  }

  // ==========================================
  // [A] COURSE MANAGEMENT (QUẢN LÝ KHÓA HỌC)
  // ==========================================

  public getMyCourses = async (req: Request, res: Response) => {
    const instructorId = (req as any).user.id;
    const result = await this.studioService.getMyCourses(instructorId);

    successResponse(res, {
      statusCode: 200,
      message: 'Lấy danh sách khóa học thành công',
      data: result,
    });
  };

  public createCourse = async (req: Request, res: Response) => {
    const instructorId = (req as any).user.id;
    const data = req.body as CreateCourseDTO;

    const result = await this.studioService.createCourse(instructorId, data);

    successResponse(res, {
      statusCode: 201, // 201 Created
      message: 'Khởi tạo khóa học thành công',
      data: result,
    });
  };

  public getCourseDetail = async (req: Request, res: Response) => {
    const instructorId = (req as any).user.id;
    const courseId = req.params.id as string;

    const result = await this.studioService.getCourseDetail(courseId, instructorId);

    successResponse(res, {
      statusCode: 200,
      message: 'Lấy thông tin chi tiết khóa học thành công',
      data: result,
    });
  };

  public updateCourse = async (req: Request, res: Response) => {
    const instructorId = (req as any).user.id;
    const courseId = req.params.id as string;
    const data = req.body as UpdateCourseDTO;

    const result = await this.studioService.updateCourse(courseId, instructorId, data);

    successResponse(res, {
      statusCode: 200,
      message: 'Cập nhật khóa học thành công',
      data: result,
    });
  };

  public requestPublish = async (req: Request, res: Response) => {
    const instructorId = (req as any).user.id;
    const courseId = req.params.id as string;

    const result = await this.studioService.requestPublish(courseId, instructorId);

    successResponse(res, {
      statusCode: 200,
      message: result.message,
    });
  };

  public deleteCourse = async (req: Request, res: Response) => {
    const instructorId = (req as any).user.id;
    const courseId = req.params.id as string;

    const result = await this.studioService.deleteCourse(courseId, instructorId);

    successResponse(res, {
      statusCode: 200,
      message: result.message,
    });
  };

  // ==========================================
  // [B] CURRICULUM (MODULES & LESSONS)
  // ==========================================

  public getCurriculum = async (req: Request, res: Response) => {
    const instructorId = (req as any).user.id;
    const courseId = req.params.id as string;

    const result = await this.studioService.getCurriculum(courseId, instructorId);
    successResponse(res, { statusCode: 200, message: 'Lấy giáo trình thành công', data: result });
  };

  public createModule = async (req: Request, res: Response) => {
    const instructorId = (req as any).user.id;
    const courseId = req.params.id as string;

    const result = await this.studioService.createModule(
      courseId,
      instructorId,
      req.body as CreateModuleDTO
    );
    successResponse(res, { statusCode: 201, message: 'Tạo chương thành công', data: result });
  };

  public updateModule = async (req: Request, res: Response) => {
    const instructorId = (req as any).user.id;
    const moduleId = req.params.moduleId as string;

    const result = await this.studioService.updateModule(
      moduleId,
      instructorId,
      req.body as UpdateModuleDTO
    );
    successResponse(res, { statusCode: 200, message: 'Cập nhật chương thành công', data: result });
  };

  public deleteModule = async (req: Request, res: Response) => {
    const instructorId = (req as any).user.id;
    const moduleId = req.params.moduleId as string;
    const result = await this.studioService.deleteModule(moduleId, instructorId);
    successResponse(res, { statusCode: 200, message: result.message });
  };

  public createLesson = async (req: Request, res: Response) => {
    const instructorId = (req as any).user.id;
    const moduleId = req.params.moduleId as string;
    const result = await this.studioService.createLesson(
      moduleId,
      instructorId,
      req.body as CreateLessonDTO
    );
    successResponse(res, { statusCode: 201, message: 'Tạo bài học thành công', data: result });
  };

  public updateLesson = async (req: Request, res: Response) => {
    const instructorId = (req as any).user.id;
    const lessonId = req.params.lessonId as string;

    const result = await this.studioService.updateLesson(
      lessonId,
      instructorId,
      req.body as UpdateLessonDTO
    );
    successResponse(res, { statusCode: 200, message: 'Cập nhật bài học thành công', data: result });
  };

  public deleteLesson = async (req: Request, res: Response) => {
    const instructorId = (req as any).user.id;
    const lessonId = req.params.lessonId as string;

    const result = await this.studioService.deleteLesson(lessonId, instructorId);
    successResponse(res, { statusCode: 200, message: result.message });
  };

  public getUploadUrl = async (req: Request, res: Response) => {
    const instructorId = (req as any).user.id;
    const lessonId = req.params.lessonId as string;
    // Không cần contentType nữa vì Cloudflare Stream lo hết
    const result = await this.studioService.generateCloudflareUploadUrl(lessonId, instructorId);
    successResponse(res, {
      statusCode: 200,
      message: 'Lấy link tải lên Cloudflare thành công',
      data: result,
    });
  };

  // ==========================================
  // [C] ANALYTICS & QNA
  // ==========================================

  public getAnalyticsOverview = async (req: Request, res: Response) => {
    const instructorId = (req as any).user.id;
    const result = await this.studioService.getAnalyticsOverview(instructorId);
    successResponse(res, {
      statusCode: 200,
      message: 'Lấy thống kê tổng quan thành công',
      data: result,
    });
  };

  public getRevenueChart = async (req: Request, res: Response) => {
    const instructorId = (req as any).user.id;
    // Ép kiểu req.query qua z.infer type
    const result = await this.studioService.getRevenueChart(instructorId, req.query as any);
    successResponse(res, {
      statusCode: 200,
      message: 'Lấy dữ liệu biểu đồ thành công',
      data: result,
    });
  };

  public getUnansweredQnA = async (req: Request, res: Response) => {
    const instructorId = (req as any).user.id;
    const result = await this.studioService.getUnansweredQnA(instructorId);
    successResponse(res, {
      statusCode: 200,
      message: 'Lấy danh sách Q&A cần hỗ trợ thành công',
      data: result,
    });
  };

  // ==========================================
  // [D] WEBHOOKS
  // ==========================================

  public processCloudflareWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Lấy chuỗi ký xác thực từ Header do Cloudflare gửi
      const signatureHeader =
        req.header('webhook-signature') || req.header('Webhook-Signature') || '';

      if (!signatureHeader) {
        // Log để debug xem header có thực sự rỗng không
        console.log('DEBUG: Headers nhận được:', req.headers);
        throw new AppError(401, 'Thiếu chữ ký xác thực Webhook');
      }

      // 2. Lấy Raw Body (Chuỗi JSON thô chưa qua xử lý)
      // LƯU Ý QUAN TRỌNG: Mã hóa Crypto đòi hỏi dấu cách/xuống dòng phải y hệt bản gốc.
      // Nếu đã cài express.json({ verify: ... }) ở file Server tổng để giữ lại rawBody, hãy gọi req.rawBody.
      // Nếu chưa, tạm thời dùng JSON.stringify (nhưng có rủi ro bị lệch format).
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);

      const result = await this.studioService.processCloudflareWebhook(
        req.body,
        signatureHeader,
        rawBody
      );

      // Cloudflare chỉ cần Server trả về status 200 là đủ
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}

import { Request, Response } from 'express';
import { AdminUserService } from './admin-user.service';
import { successResponse } from '@/common/utils/responses/api-response';

export class AdminUserController {
  private readonly adminUserService: AdminUserService;

  constructor() {
    this.adminUserService = new AdminUserService();
  }

  // ==========================================
  // [A] TRUY XUẤT & HỒ SƠ 360 ĐỘ
  // ==========================================

  public getUsers = async (req: Request, res: Response) => {
    // req.query đã được Zod parse và ép kiểu định dạng ở tầng Route
    const query = req.query;

    // Lấy nguyên cụm data và meta từ Service
    const { data, meta } = await this.adminUserService.getUsers(query);

    successResponse(res, {
      statusCode: 200,
      message: 'Lấy danh sách người dùng thành công',
      data,
      meta, // Gắn trực tiếp meta vào Response
    });
  };

  public getUserDetail = async (req: Request, res: Response) => {
    const targetUserId = req.params.id as string;

    const result = await this.adminUserService.getUserDetail(targetUserId);

    successResponse(res, {
      statusCode: 200,
      message: 'Lấy hồ sơ chi tiết người dùng thành công',
      data: result,
    });
  };

  // ==========================================
  // [B] PHÂN QUYỀN & TRẠNG THÁI
  // ==========================================

  public changeUserRole = async (req: Request, res: Response) => {
    const adminId = (req as any).user.id;
    const targetUserId = req.params.id as string;
    const { roleId } = req.body;

    const result = await this.adminUserService.changeUserRole(adminId, targetUserId, roleId);

    successResponse(res, { statusCode: 200, message: result.message });
  };

  public changeUserStatus = async (req: Request, res: Response) => {
    const adminId = (req as any).user.id;
    const targetUserId = req.params.id as string;
    const { isActive } = req.body;

    const result = await this.adminUserService.changeUserStatus(adminId, targetUserId, isActive);

    successResponse(res, { statusCode: 200, message: result.message });
  };

  public overridePermissions = async (req: Request, res: Response) => {
    const targetUserId = req.params.id as string;
    const { permissionIds } = req.body;

    const result = await this.adminUserService.overridePermissions(targetUserId, permissionIds);

    successResponse(res, { statusCode: 200, message: result.message });
  };

  // ==========================================
  // [C] CAN THIỆP HỆ THỐNG
  // ==========================================

  public revokeAllSessions = async (req: Request, res: Response) => {
    const targetUserId = req.params.id as string;

    const result = await this.adminUserService.revokeAllSessions(targetUserId);

    successResponse(res, { statusCode: 200, message: result.message });
  };

  public enrollCourseB2B = async (req: Request, res: Response) => {
    const targetUserId = req.params.id as string;
    const { courseId } = req.body;

    const result = await this.adminUserService.enrollCourseB2B(targetUserId, courseId);

    successResponse(res, { statusCode: 200, message: result.message });
  };

  public revokeCourseAccess = async (req: Request, res: Response) => {
    const targetUserId = req.params.id as string;
    const courseId = req.params.courseId as string;

    const result = await this.adminUserService.revokeCourseAccess(targetUserId, courseId);

    successResponse(res, { statusCode: 200, message: result.message });
  };
}

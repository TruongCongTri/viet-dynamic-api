import { Request, Response } from 'express';
import { AdminSystemService } from './admin-system.service';
import { successResponse } from '@/common/utils/responses/api-response';
import {
  CreateForbiddenWordDTO,
  CreateRoleDTO,
  UpdateRolePermissionsDTO,
} from './admin-system.schema';

export class AdminSystemController {
  private readonly systemService: AdminSystemService;

  constructor() {
    this.systemService = new AdminSystemService();
  }

  // --- HEALTH CHECK ---
  public getSystemHealth = async (_req: Request, res: Response) => {
    const result = await this.systemService.getSystemHealth();
    successResponse(res, { statusCode: 200, message: 'Health Check OK', data: result });
  };

  // --- FORBIDDEN WORDS ---
  public getForbiddenWords = async (_req: Request, res: Response) => {
    const result = await this.systemService.getForbiddenWords();
    successResponse(res, {
      statusCode: 200,
      message: 'Lấy danh sách từ cấm thành công',
      data: result,
    });
  };

  public addForbiddenWord = async (req: Request, res: Response) => {
    const payload = req.body as CreateForbiddenWordDTO;
    const result = await this.systemService.addForbiddenWord(payload);
    successResponse(res, { statusCode: 201, message: result.message });
  };

  public removeForbiddenWord = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await this.systemService.removeForbiddenWord(id);
    successResponse(res, { statusCode: 200, message: result.message });
  };

  // --- ROLES & PERMISSIONS ---
  public getRolesAndPermissions = async (_req: Request, res: Response) => {
    const result = await this.systemService.getRolesAndPermissions();
    successResponse(res, {
      statusCode: 200,
      message: 'Lấy cấu trúc phân quyền thành công',
      data: result,
    });
  };

  public createRole = async (req: Request, res: Response) => {
    const payload = req.body as CreateRoleDTO;
    const result = await this.systemService.createRole(payload);
    successResponse(res, { statusCode: 201, message: result.message, data: result.role });
  };

  public updateRolePermissions = async (req: Request, res: Response) => {
    const roleId = req.params.id as string;
    const payload = req.body as UpdateRolePermissionsDTO;
    const result = await this.systemService.updateRolePermissions(roleId, payload.permissionIds);
    successResponse(res, { statusCode: 200, message: result.message });
  };
}
